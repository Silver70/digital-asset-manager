use std::path::Path;
use tauri::State;

use crate::error::AppError;
use crate::state::AppState;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/// Resolves the active org's DB pool, returning `NotAuthenticated` when there
/// is no active org or the pool has not been opened yet.
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

/// Returns the storage root path for the currently active org.
///
/// Reads the `storage_path` key from `app_settings` in the org's SQLite DB.
/// Returns `null` (None) when the path has never been set.
#[tauri::command]
pub async fn get_storage_path(
    state: State<'_, AppState>,
) -> Result<Option<String>, AppError> {
    let (_org_id, pool) = active_pool!(state);

    let row: Option<(String,)> =
        sqlx::query_as("SELECT value FROM app_settings WHERE key = 'storage_path'")
            .fetch_optional(&pool)
            .await?;

    Ok(row.and_then(|(v,)| if v.is_empty() { None } else { Some(v) }))
}

/// Sets the storage root path for the currently active org.
///
/// Behaviour:
/// 1. Validates that `path` is an existing directory on disk.
/// 2. Creates `<path>/<org_id>/assets/` and `<path>/<org_id>/thumbnails/`.
/// 3. Persists the chosen path to `app_settings` in the org's DB.
/// 4. Caches the path in `AppState.storage_paths` for fast access.
#[tauri::command]
pub async fn set_storage_path(
    path: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let (org_id, pool) = active_pool!(state);

    // Validate directory exists
    let metadata = tokio::fs::metadata(&path).await.map_err(|_| {
        AppError::Logic(format!("Path does not exist or is not accessible: {path}"))
    })?;
    if !metadata.is_dir() {
        return Err(AppError::Logic(format!(
            "Path is not a directory: {path}"
        )));
    }

    // Create org-scoped subdirectories
    let org_base = Path::new(&path).join(&org_id);
    tokio::fs::create_dir_all(org_base.join("assets")).await?;
    tokio::fs::create_dir_all(org_base.join("thumbnails")).await?;

    // Persist to DB (upsert)
    sqlx::query(
        "INSERT INTO app_settings (key, value)
         VALUES ('storage_path', ?)
         ON CONFLICT(key) DO UPDATE
           SET value = excluded.value,
               updated_at = CURRENT_TIMESTAMP",
    )
    .bind(&path)
    .execute(&pool)
    .await?;

    // Update in-memory cache
    state
        .storage_paths
        .write()
        .await
        .insert(org_id, Path::new(&path).to_path_buf());

    Ok(())
}
