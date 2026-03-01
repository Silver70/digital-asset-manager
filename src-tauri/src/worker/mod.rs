pub mod queue;

use tokio::sync::mpsc;
use queue::WorkerJob;

/// Drives the background processing loop.
///
/// Phase 5 will fill in thumbnail generation and metadata extraction.
/// For now the loop simply drains the channel without processing.
pub async fn spawn_worker(mut rx: mpsc::Receiver<WorkerJob>) {
    while let Some(_job) = rx.recv().await {
        // Phase 5: match job { WorkerJob::Process { .. } => process_asset(...) }
    }
}
