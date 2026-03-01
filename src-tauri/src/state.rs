use std::collections::HashMap;
use std::path::PathBuf;
use sqlx::SqlitePool;
use tokio::sync::{RwLock, mpsc};
use crate::worker::queue::WorkerJob;

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct OrgMembership {
    pub org_id: String,
    pub org_name: String,
    /// "admin" | "member"
    pub role: String,
}

#[derive(Debug, serde::Serialize, Clone)]
pub struct AuthState {
    pub user_id: String,
    pub email: String,
    pub orgs: Vec<OrgMembership>,
    pub active_org_id: Option<String>,
}

/// Global application state managed by Tauri.
///
/// - `auth`           — current logged-in user (None until login)
/// - `db_pool`        — per-org SQLite pools, keyed by org_id; lazily populated on switch_org
/// - `active_org_id`  — the org whose DB is currently in use
/// - `worker_tx`      — channel sender for the background thumbnail/metadata worker
/// - `storage_paths`  — per-org user-chosen storage root paths
pub struct AppState {
    pub auth: RwLock<Option<AuthState>>,
    pub db_pool: RwLock<HashMap<String, SqlitePool>>,
    pub active_org_id: RwLock<Option<String>>,
    pub worker_tx: mpsc::Sender<WorkerJob>,
    pub storage_paths: RwLock<HashMap<String, PathBuf>>,
}
