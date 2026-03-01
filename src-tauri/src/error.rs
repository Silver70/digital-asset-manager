use serde::Serializer;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Database migration error: {0}")]
    Migration(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Storage path not configured")]
    StorageNotConfigured,

    #[error("Asset not found: {0}")]
    NotFound(i64),

    #[error("Not authenticated")]
    NotAuthenticated,

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("{0}")]
    Logic(String),
}

// Tauri commands require AppError to be serializable so it can be sent to the frontend.
impl serde::Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}
