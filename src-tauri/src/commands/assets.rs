use std::path::{Path, PathBuf};
use tauri::State;
use uuid::Uuid;
use mime_guess::from_path;

use crate::error::AppError;
use crate::models::asset::Asset;
use crate::state::AppState;
use crate::worker::queue::WorkerJob;

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

/// Resolves the storage root path for the active org.
///
/// Checks `state.storage_paths` first, then falls back to the `app_settings` DB table.
async fn resolve_storage_path(
    org_id: &str,
    pool: &sqlx::SqlitePool,
    state: &AppState,
) -> Result<PathBuf, AppError> {
    {
        let guard = state.storage_paths.read().await;
        if let Some(p) = guard.get(org_id) {
            return Ok(p.clone());
        }
    }

    let row: Option<(String,)> =
        sqlx::query_as("SELECT value FROM app_settings WHERE key = 'storage_path'")
            .fetch_optional(pool)
            .await?;

    match row.and_then(|(v,)| if v.is_empty() { None } else { Some(v) }) {
        Some(path_str) => {
            let pb = PathBuf::from(&path_str);
            state
                .storage_paths
                .write()
                .await
                .insert(org_id.to_string(), pb.clone());
            Ok(pb)
        }
        None => Err(AppError::StorageNotConfigured),
    }
}

// ─── Commands ────────────────────────────────────────────────────────────────

/// Lists all assets in the given folder, ordered by creation date descending.
#[tauri::command]
pub async fn list_assets(
    folder_id: i64,
    state: State<'_, AppState>,
) -> Result<Vec<Asset>, AppError> {
    let (_org_id, pool) = active_pool!(state);

    let assets = sqlx::query_as::<_, Asset>(
        "SELECT * FROM assets WHERE folder_id = ? ORDER BY created_at DESC",
    )
    .bind(folder_id)
    .fetch_all(&pool)
    .await?;

    Ok(assets)
}

/// Imports files into the active org's storage directory.
///
/// For each path:
/// 1. Generates a UUID filename to avoid collisions.
/// 2. Copies the source file to `<storage_root>/<org_id>/assets/<uuid>.<ext>`.
/// 3. Inserts an asset row with `processing_status = 'pending'`.
/// 4. Enqueues `WorkerJob::Process` for background thumbnail + metadata extraction.
#[tauri::command]
pub async fn import_assets(
    file_paths: Vec<String>,
    folder_id: i64,
    state: State<'_, AppState>,
) -> Result<Vec<Asset>, AppError> {
    let (org_id, pool) = active_pool!(state);
    let storage_root = resolve_storage_path(&org_id, &pool, &state).await?;
    let assets_dir = storage_root.join(&org_id).join("assets");

    let mut imported: Vec<Asset> = Vec::with_capacity(file_paths.len());

    for src_path_str in &file_paths {
        let src_path = Path::new(src_path_str);

        let original_name = src_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        let extension = src_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        let uuid_name = if extension.is_empty() {
            Uuid::new_v4().to_string()
        } else {
            format!("{}.{}", Uuid::new_v4(), extension)
        };

        let dest_path = assets_dir.join(&uuid_name);

        let file_size = tokio::fs::metadata(src_path_str)
            .await
            .map(|m| m.len() as i64)
            .unwrap_or(0);

        let mime_type = from_path(src_path_str).first().map(|m| m.to_string());

        tokio::fs::copy(src_path_str, &dest_path).await.map_err(|e| {
            AppError::Logic(format!("Failed to copy '{}': {e}", original_name))
        })?;

        let dest_path_str = dest_path.to_string_lossy().to_string();

        let new_id = sqlx::query(
            "INSERT INTO assets (name, folder_id, file_path, file_size, mime_type, extension, processing_status)
             VALUES (?, ?, ?, ?, ?, ?, 'pending')",
        )
        .bind(&original_name)
        .bind(folder_id)
        .bind(&dest_path_str)
        .bind(file_size)
        .bind(&mime_type)
        .bind(&extension)
        .execute(&pool)
        .await?
        .last_insert_rowid();

        let asset = sqlx::query_as::<_, Asset>("SELECT * FROM assets WHERE id = ?")
            .bind(new_id)
            .fetch_one(&pool)
            .await?;

        let _ = state
            .worker_tx
            .send(WorkerJob::Process {
                asset_id: new_id,
                file_path: dest_path,
                org_id: org_id.clone(),
            })
            .await;

        imported.push(asset);
    }

    Ok(imported)
}

/// Deletes assets: removes DB records and the corresponding files from disk.
#[tauri::command]
pub async fn delete_assets(
    ids: Vec<i64>,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    if ids.is_empty() {
        return Ok(());
    }

    let (_org_id, pool) = active_pool!(state);

    let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(", ");

    // Collect file paths before deletion so we can clean up disk
    let select_sql = format!(
        "SELECT file_path, thumbnail_path FROM assets WHERE id IN ({placeholders})"
    );
    let mut select_q = sqlx::query_as::<_, (String, Option<String>)>(&select_sql);
    for id in &ids {
        select_q = select_q.bind(id);
    }
    let paths = select_q.fetch_all(&pool).await?;

    // Delete DB records (CASCADE removes asset_tags / image_metadata / video_metadata)
    let delete_sql = format!("DELETE FROM assets WHERE id IN ({placeholders})");
    let mut delete_q = sqlx::query(&delete_sql);
    for id in &ids {
        delete_q = delete_q.bind(id);
    }
    delete_q.execute(&pool).await?;

    // Remove files from disk (best-effort — don't fail if a file is already gone)
    for (file_path, thumbnail_path) in paths {
        let _ = tokio::fs::remove_file(&file_path).await;
        if let Some(thumb) = thumbnail_path {
            let _ = tokio::fs::remove_file(&thumb).await;
        }
    }

    Ok(())
}

/// Moves assets to a different folder.
#[tauri::command]
pub async fn move_assets(
    ids: Vec<i64>,
    folder_id: i64,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    if ids.is_empty() {
        return Ok(());
    }

    let (_org_id, pool) = active_pool!(state);

    let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
    let sql = format!(
        "UPDATE assets SET folder_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN ({placeholders})"
    );

    let mut q = sqlx::query(&sql).bind(folder_id);
    for id in &ids {
        q = q.bind(id);
    }
    q.execute(&pool).await?;

    Ok(())
}
