use tauri::State;

use crate::error::AppError;
use crate::models::tag::Tag;
use crate::state::AppState;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/// Resolves the active org's DB pool.
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

// ─── Commands ────────────────────────────────────────────────────────────────

/// Returns all tags in the org's tag library, ordered by name.
#[tauri::command]
pub async fn get_all_tags(state: State<'_, AppState>) -> Result<Vec<Tag>, AppError> {
    let (_org_id, pool) = active_pool!(state);

    let tags = sqlx::query_as::<_, Tag>(
        "SELECT * FROM tags ORDER BY name COLLATE NOCASE",
    )
    .fetch_all(&pool)
    .await?;

    Ok(tags)
}

/// Returns all tags assigned to a specific asset.
#[tauri::command]
pub async fn get_asset_tags(
    asset_id: i64,
    state: State<'_, AppState>,
) -> Result<Vec<Tag>, AppError> {
    let (_org_id, pool) = active_pool!(state);

    let tags = sqlx::query_as::<_, Tag>(
        "SELECT t.* FROM tags t \
         JOIN asset_tags at ON t.id = at.tag_id \
         WHERE at.asset_id = ? \
         ORDER BY t.name COLLATE NOCASE",
    )
    .bind(asset_id)
    .fetch_all(&pool)
    .await?;

    Ok(tags)
}

/// Creates a new tag with the given name and hex color.
///
/// Returns `AppError::Conflict` if a tag with the same name already exists.
#[tauri::command]
pub async fn create_tag(
    name: String,
    color: String,
    state: State<'_, AppState>,
) -> Result<Tag, AppError> {
    let (_org_id, pool) = active_pool!(state);

    let new_id = sqlx::query("INSERT INTO tags (name, color) VALUES (?, ?)")
        .bind(&name)
        .bind(&color)
        .execute(&pool)
        .await?
        .last_insert_rowid();

    let tag = sqlx::query_as::<_, Tag>("SELECT * FROM tags WHERE id = ?")
        .bind(new_id)
        .fetch_one(&pool)
        .await?;

    Ok(tag)
}

/// Deletes a tag and removes all its asset assignments (via ON DELETE CASCADE).
#[tauri::command]
pub async fn delete_tag(id: i64, state: State<'_, AppState>) -> Result<(), AppError> {
    let (_org_id, pool) = active_pool!(state);

    sqlx::query("DELETE FROM tags WHERE id = ?")
        .bind(id)
        .execute(&pool)
        .await?;

    Ok(())
}

/// Assigns each tag in `tag_ids` to each asset in `asset_ids`.
///
/// Uses `INSERT OR IGNORE` so re-assigning an already-assigned tag is a no-op.
#[tauri::command]
pub async fn assign_tags(
    asset_ids: Vec<i64>,
    tag_ids: Vec<i64>,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    if asset_ids.is_empty() || tag_ids.is_empty() {
        return Ok(());
    }

    let (_org_id, pool) = active_pool!(state);

    for asset_id in &asset_ids {
        for tag_id in &tag_ids {
            sqlx::query(
                "INSERT OR IGNORE INTO asset_tags (asset_id, tag_id) VALUES (?, ?)",
            )
            .bind(asset_id)
            .bind(tag_id)
            .execute(&pool)
            .await?;
        }
    }

    Ok(())
}

/// Removes specific tag assignments from specific assets.
///
/// Missing assignments are silently ignored.
#[tauri::command]
pub async fn remove_tags(
    asset_ids: Vec<i64>,
    tag_ids: Vec<i64>,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    if asset_ids.is_empty() || tag_ids.is_empty() {
        return Ok(());
    }

    let (_org_id, pool) = active_pool!(state);

    let asset_placeholders = asset_ids.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
    let tag_placeholders = tag_ids.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
    let sql = format!(
        "DELETE FROM asset_tags \
         WHERE asset_id IN ({asset_placeholders}) \
         AND tag_id IN ({tag_placeholders})"
    );

    let mut q = sqlx::query(&sql);
    for id in &asset_ids {
        q = q.bind(id);
    }
    for id in &tag_ids {
        q = q.bind(id);
    }
    q.execute(&pool).await?;

    Ok(())
}
