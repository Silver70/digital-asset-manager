use std::path::PathBuf;

/// Jobs dispatched to the background worker.
/// Each job carries `org_id` so the worker can look up the correct SQLite pool.
pub enum WorkerJob {
    Process {
        asset_id: i64,
        file_path: PathBuf,
        org_id: String,
    },
}
