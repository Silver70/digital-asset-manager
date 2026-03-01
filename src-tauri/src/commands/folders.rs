use tauri::State;

use crate::error::AppError;
use crate::models::folder::{Folder, FolderNode};
use crate::state::AppState;

// ─── Helper ──────────────────────────────────────────────────────────────────

macro_rules! active_pool {
    ($state:expr) => {{
        let org_id = $state
            .active_org_id
            .read()
            .await
            .clone()
            .ok_or(AppError::NotAuthenticated)?;

        let guard = $state.db_pool.read().await;
        let pool = guard
            .get(&org_id)
            .cloned()
            .ok_or(AppError::NotAuthenticated)?;

        (org_id, pool)
    }};
}

/// Recursively builds a nested `FolderNode` tree from a flat slice sorted by depth.
fn build_tree(folders: &[Folder], parent_id: Option<i64>) -> Vec<FolderNode> {
    folders
        .iter()
        .filter(|f| f.parent_id == parent_id)
        .map(|f| FolderNode {
            folder: f.clone(),
            children: build_tree(folders, Some(f.id)),
        })
        .collect()
}

// ─── Commands ─────────────────────────────────────────────────────────────────

/// Returns the full nested folder tree for the active org.
#[tauri::command]
pub async fn get_folder_tree(state: State<'_, AppState>) -> Result<Vec<FolderNode>, AppError> {
    let (_org_id, pool) = active_pool!(state);

    let folders: Vec<Folder> =
        sqlx::query_as("SELECT * FROM folders ORDER BY depth ASC, path ASC")
            .fetch_all(&pool)
            .await?;

    Ok(build_tree(&folders, None))
}

/// Creates a new folder under `parent_id`, or at the root when `parent_id` is `None`.
///
/// The materialized `path` is set to `/<new_id>` for root folders, or
/// `<parent.path>/<new_id>` for nested folders.
#[tauri::command]
pub async fn create_folder(
    name: String,
    parent_id: Option<i64>,
    state: State<'_, AppState>,
) -> Result<Folder, AppError> {
    let (_org_id, pool) = active_pool!(state);

    let name = name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::Logic("Folder name cannot be empty".into()));
    }

    // Resolve parent path + depth
    let (parent_path, parent_depth): (Option<String>, i32) = match parent_id {
        None => (None, -1),
        Some(pid) => {
            let row: Option<(String, i32)> =
                sqlx::query_as("SELECT path, depth FROM folders WHERE id = ?")
                    .bind(pid)
                    .fetch_optional(&pool)
                    .await?;
            match row {
                Some((p, d)) => (Some(p), d),
                None => {
                    return Err(AppError::Logic(format!(
                        "Parent folder {pid} does not exist"
                    )))
                }
            }
        }
    };

    let new_depth = parent_depth + 1;

    // Insert with a placeholder path, then update once we have the auto-generated ID.
    let mut tx = pool.begin().await?;

    let new_id: i64 = sqlx::query(
        "INSERT INTO folders (name, parent_id, path, depth) VALUES (?, ?, '', ?)",
    )
    .bind(&name)
    .bind(parent_id)
    .bind(new_depth)
    .execute(&mut *tx)
    .await?
    .last_insert_rowid();

    let path = match parent_path {
        None => format!("/{new_id}"),
        Some(p) => format!("{p}/{new_id}"),
    };

    sqlx::query("UPDATE folders SET path = ? WHERE id = ?")
        .bind(&path)
        .bind(new_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    let folder: Folder = sqlx::query_as("SELECT * FROM folders WHERE id = ?")
        .bind(new_id)
        .fetch_one(&pool)
        .await?;

    Ok(folder)
}

/// Renames a folder.
///
/// The materialized path is not affected because paths store IDs, not names.
#[tauri::command]
pub async fn rename_folder(
    id: i64,
    name: String,
    state: State<'_, AppState>,
) -> Result<Folder, AppError> {
    let (_org_id, pool) = active_pool!(state);

    let name = name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::Logic("Folder name cannot be empty".into()));
    }

    let rows = sqlx::query(
        "UPDATE folders SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    )
    .bind(&name)
    .bind(id)
    .execute(&pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Err(AppError::Logic(format!("Folder {id} not found")));
    }

    Ok(sqlx::query_as("SELECT * FROM folders WHERE id = ?")
        .bind(id)
        .fetch_one(&pool)
        .await?)
}

/// Moves a folder (and all its descendants) to a new parent.
///
/// Rewrites the materialized `path` and adjusts `depth` for the moved folder
/// and every descendant. Rejects moves that would create a cycle (moving a
/// folder into itself or into one of its own descendants).
#[tauri::command]
pub async fn move_folder(
    id: i64,
    new_parent_id: Option<i64>,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let (_org_id, pool) = active_pool!(state);

    // Load the folder being moved
    let folder: Folder = sqlx::query_as("SELECT * FROM folders WHERE id = ?")
        .bind(id)
        .fetch_optional(&pool)
        .await?
        .ok_or_else(|| AppError::Logic(format!("Folder {id} not found")))?;

    // Resolve new parent, checking for cycles
    let (new_parent_path, new_parent_depth): (Option<String>, i32) = match new_parent_id {
        None => (None, -1),
        Some(pid) => {
            let row: Option<(String, i32)> =
                sqlx::query_as("SELECT path, depth FROM folders WHERE id = ?")
                    .bind(pid)
                    .fetch_optional(&pool)
                    .await?;
            match row {
                Some((p, d)) => {
                    // Reject if target is within the subtree being moved
                    if p == folder.path
                        || p.starts_with(&format!("{}/", folder.path))
                    {
                        return Err(AppError::Logic(
                            "Cannot move a folder into itself or one of its descendants".into(),
                        ));
                    }
                    (Some(p), d)
                }
                None => return Err(AppError::Logic(format!("Target folder {pid} not found"))),
            }
        }
    };

    let old_path = &folder.path;
    let new_path = match &new_parent_path {
        None => format!("/{id}"),
        Some(p) => format!("{p}/{id}"),
    };
    let depth_delta = (new_parent_depth + 1) - folder.depth;

    let mut tx = pool.begin().await?;

    // Update the moved folder itself
    sqlx::query(
        "UPDATE folders
         SET parent_id = ?, depth = ?, path = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?",
    )
    .bind(new_parent_id)
    .bind(folder.depth + depth_delta)
    .bind(&new_path)
    .bind(id)
    .execute(&mut *tx)
    .await?;

    // Rewrite path prefix and shift depth for every descendant.
    // SUBSTR(path, old_len + 1) strips the old prefix (1-based SQL index).
    sqlx::query(
        "UPDATE folders
         SET path  = ? || SUBSTR(path, ? + 1),
             depth = depth + ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE path LIKE ? || '/%'",
    )
    .bind(&new_path)
    .bind(old_path.len() as i64)
    .bind(depth_delta)
    .bind(old_path)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(())
}

/// Deletes a folder and all its descendants (subtree identified by materialized path).
///
/// Returns an error if any asset exists within the subtree — those must be
/// moved or deleted before the folder can be removed.
#[tauri::command]
pub async fn delete_folder(id: i64, state: State<'_, AppState>) -> Result<(), AppError> {
    let (_org_id, pool) = active_pool!(state);

    let path: Option<(String,)> = sqlx::query_as("SELECT path FROM folders WHERE id = ?")
        .bind(id)
        .fetch_optional(&pool)
        .await?;

    let path = match path {
        Some((p,)) => p,
        None => return Err(AppError::Logic(format!("Folder {id} not found"))),
    };

    // Reject if any assets live in this subtree
    let (asset_count,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM assets a
         JOIN folders f ON f.id = a.folder_id
         WHERE f.path = ? OR f.path LIKE ? || '/%'",
    )
    .bind(&path)
    .bind(&path)
    .fetch_one(&pool)
    .await?;

    if asset_count > 0 {
        return Err(AppError::Logic(format!(
            "Cannot delete: {asset_count} asset(s) exist in this folder or its subfolders. \
             Move or delete assets first."
        )));
    }

    // Delete the entire subtree (root folder + all descendants) in one statement.
    // We do this explicitly because SQLite foreign-key CASCADE is disabled by default.
    sqlx::query("DELETE FROM folders WHERE path = ? OR path LIKE ? || '/%'")
        .bind(&path)
        .bind(&path)
        .execute(&pool)
        .await?;

    Ok(())
}
