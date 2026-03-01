use sqlx::SqlitePool;
use tauri::Manager;
use crate::error::AppError;

/// Opens (or creates) the SQLite database for the given org, runs migrations,
/// and enables WAL mode for better concurrent read performance.
pub async fn open_org_db(
    org_id: &str,
    app_handle: &tauri::AppHandle,
) -> Result<SqlitePool, AppError> {
    let db_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Logic(format!("Cannot resolve app data dir: {e}")))?
        .join("digital-asset-manager")
        .join(org_id);

    tokio::fs::create_dir_all(&db_dir).await?;

    let db_path = db_dir.join("dam.db");
    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());

    let pool = SqlitePool::connect(&db_url).await?;

    // WAL mode gives better concurrent read performance for a desktop app
    sqlx::query("PRAGMA journal_mode=WAL")
        .execute(&pool)
        .await?;

    run_migrations(&pool).await?;

    Ok(pool)
}

/// Runs all pending SQL migrations against the provided pool.
pub async fn run_migrations(pool: &SqlitePool) -> Result<(), AppError> {
    sqlx::migrate!("src/db/migrations")
        .run(pool)
        .await
        .map_err(|e| AppError::Migration(e.to_string()))
}
