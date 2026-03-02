pub mod metadata;
pub mod queue;
pub mod thumbnail;

use std::path::{Path, PathBuf};

use sqlx::SqlitePool;
use tauri::{Emitter, Manager};
use tokio::sync::mpsc;

use crate::state::AppState;
use queue::WorkerJob;

// ─── Public entry point ───────────────────────────────────────────────────────

/// Drives the background processing loop.
///
/// One tokio task per job is spawned so multiple assets can be processed
/// concurrently. The outer loop simply dispatches jobs from the channel.
pub async fn spawn_worker(mut rx: mpsc::Receiver<WorkerJob>, app_handle: tauri::AppHandle) {
    while let Some(job) = rx.recv().await {
        let app = app_handle.clone();
        tokio::spawn(async move {
            match job {
                WorkerJob::Process {
                    asset_id,
                    file_path,
                    org_id,
                } => {
                    process_one(asset_id, file_path, org_id, app).await;
                }
            }
        });
    }
}

// ─── Per-job processing ───────────────────────────────────────────────────────

async fn process_one(
    asset_id: i64,
    file_path: PathBuf,
    org_id: String,
    app: tauri::AppHandle,
) {
    // Mark as processing
    if let Some(pool) = get_pool(&app, &org_id).await {
        let _ = sqlx::query(
            "UPDATE assets SET processing_status = 'processing', updated_at = CURRENT_TIMESTAMP \
             WHERE id = ?",
        )
        .bind(asset_id)
        .execute(&pool)
        .await;
    }
    let _ = app.emit(
        "asset:processing",
        serde_json::json!({ "asset_id": asset_id }),
    );

    // Determine MIME type from file extension
    let mime = mime_guess::from_path(&file_path)
        .first()
        .map(|m| m.to_string())
        .unwrap_or_default();

    let mime_prefix = mime.split('/').next().unwrap_or("").to_string();

    let result = match mime_prefix.as_str() {
        "image" => process_image(asset_id, &file_path, &org_id, &app).await,
        "video" => process_video(asset_id, &file_path, &org_id, &app).await,
        _ => complete_asset(asset_id, None, &org_id, &app).await,
    };

    match result {
        Ok(thumbnail_path) => {
            let _ = app.emit(
                "asset:ready",
                serde_json::json!({
                    "asset_id": asset_id,
                    "thumbnail_path": thumbnail_path
                }),
            );
        }
        Err(err) => {
            eprintln!("[worker] asset {asset_id} failed: {err}");
            if let Some(pool) = get_pool(&app, &org_id).await {
                let _ = sqlx::query(
                    "UPDATE assets SET processing_status = 'failed', \
                     updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                )
                .bind(asset_id)
                .execute(&pool)
                .await;
            }
            let _ = app.emit(
                "asset:error",
                serde_json::json!({ "asset_id": asset_id, "error": err }),
            );
        }
    }
}

// ─── Image processing ─────────────────────────────────────────────────────────

async fn process_image(
    asset_id: i64,
    file_path: &Path,
    org_id: &str,
    app: &tauri::AppHandle,
) -> Result<Option<String>, String> {
    let thumb_path = resolve_thumbnail_path(asset_id, org_id, app).await?;

    // Thumbnail generation — CPU-bound, run on blocking thread pool
    let src = file_path.to_path_buf();
    let dst = thumb_path.clone();
    let thumb_result = tokio::task::spawn_blocking(move || thumbnail::generate_image_thumbnail(&src, &dst))
        .await
        .map_err(|e| e.to_string())?;

    // If thumbnail fails with an IO error, propagate as a hard failure.
    // Unsupported format errors surface here too — treat them as non-fatal
    // (complete with no thumbnail) rather than marking the asset 'failed'.
    let thumbnail_path_str = match thumb_result {
        Ok(()) => Some(thumb_path.to_string_lossy().to_string()),
        Err(msg) if msg.contains("IO error") => return Err(msg),
        Err(_) => None, // unsupported format — complete without thumbnail
    };

    // Metadata extraction — also CPU-bound
    let src2 = file_path.to_path_buf();
    let meta_result = tokio::task::spawn_blocking(move || metadata::extract_image_metadata(asset_id, &src2))
        .await
        .map_err(|e| e.to_string())?;

    if let Ok(meta) = meta_result {
        if let Some(pool) = get_pool(app, org_id).await {
            let _ = sqlx::query(
                "INSERT OR REPLACE INTO image_metadata \
                 (asset_id, width, height, color_profile, dpi, has_alpha) \
                 VALUES (?, ?, ?, ?, ?, ?)",
            )
            .bind(meta.asset_id)
            .bind(meta.width)
            .bind(meta.height)
            .bind(&meta.color_profile)
            .bind(meta.dpi)
            .bind(meta.has_alpha as i32)
            .execute(&pool)
            .await;
        }
    }

    complete_asset(asset_id, thumbnail_path_str.clone(), org_id, app).await?;
    Ok(thumbnail_path_str)
}

// ─── Video processing ─────────────────────────────────────────────────────────

async fn process_video(
    asset_id: i64,
    file_path: &Path,
    org_id: &str,
    app: &tauri::AppHandle,
) -> Result<Option<String>, String> {
    let (ffmpeg, ffprobe) = find_media_binaries(app);

    // Thumbnail via ffmpeg (best-effort — skip if binary is absent)
    let thumbnail_path_str = if let Some(ffmpeg_path) = ffmpeg {
        let thumb_path = resolve_thumbnail_path(asset_id, org_id, app).await?;
        match run_ffmpeg(&ffmpeg_path, file_path, &thumb_path).await {
            Ok(()) => Some(thumb_path.to_string_lossy().to_string()),
            Err(e) => {
                eprintln!("[worker] ffmpeg failed for asset {asset_id}: {e}");
                None
            }
        }
    } else {
        None
    };

    // Metadata via ffprobe (best-effort)
    if let Some(ffprobe_path) = ffprobe {
        let probe_out = tokio::process::Command::new(&ffprobe_path)
            .args([
                "-v",
                "quiet",
                "-print_format",
                "json",
                "-show_streams",
                file_path.to_str().unwrap_or(""),
            ])
            .output()
            .await
            .map_err(|e| format!("ffprobe error: {e}"))?;

        if let Ok(meta) = metadata::parse_ffprobe_json(asset_id, &probe_out.stdout) {
            if let Some(pool) = get_pool(app, org_id).await {
                let _ = sqlx::query(
                    "INSERT OR REPLACE INTO video_metadata \
                     (asset_id, width, height, duration, frame_rate, codec, audio_codec, bit_rate) \
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                )
                .bind(meta.asset_id)
                .bind(meta.width)
                .bind(meta.height)
                .bind(meta.duration)
                .bind(meta.frame_rate)
                .bind(&meta.codec)
                .bind(&meta.audio_codec)
                .bind(meta.bit_rate)
                .execute(&pool)
                .await;
            }
        }
    }

    complete_asset(asset_id, thumbnail_path_str.clone(), org_id, app).await?;
    Ok(thumbnail_path_str)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/// Sets `processing_status = 'complete'` and optionally writes `thumbnail_path`.
async fn complete_asset(
    asset_id: i64,
    thumbnail_path: Option<String>,
    org_id: &str,
    app: &tauri::AppHandle,
) -> Result<Option<String>, String> {
    if let Some(pool) = get_pool(app, org_id).await {
        sqlx::query(
            "UPDATE assets \
             SET thumbnail_path = ?, processing_status = 'complete', \
                 updated_at = CURRENT_TIMESTAMP \
             WHERE id = ?",
        )
        .bind(thumbnail_path.as_deref())
        .bind(asset_id)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    }
    Ok(thumbnail_path)
}

/// Resolves (and creates) the thumbnails directory for the given org, returning
/// the full path for `<asset_id>.jpg`.
async fn resolve_thumbnail_path(
    asset_id: i64,
    org_id: &str,
    app: &tauri::AppHandle,
) -> Result<PathBuf, String> {
    let storage_path: Option<PathBuf> = {
        let state = app.state::<AppState>();
        let guard = state.storage_paths.read().await;
        guard.get(org_id).cloned()
    };

    let base = storage_path.ok_or_else(|| "Storage path not configured".to_string())?;
    let thumb_dir = base.join(org_id).join("thumbnails");

    tokio::fs::create_dir_all(&thumb_dir)
        .await
        .map_err(|e| format!("Cannot create thumbnails dir: {e}"))?;

    Ok(thumb_dir.join(format!("{asset_id}.jpg")))
}

/// Gets a cloned `SqlitePool` for the given org from the managed AppState.
async fn get_pool(app: &tauri::AppHandle, org_id: &str) -> Option<SqlitePool> {
    let state = app.state::<AppState>();
    let guard = state.db_pool.read().await;
    guard.get(org_id).cloned()
}

/// Locates bundled `ffmpeg.exe` and `ffprobe.exe`.
///
/// Search order:
/// 1. Tauri resource directory (bundled production binaries)
/// 2. Directory of the current executable (convenient for dev)
///
/// To use video features during development, place `ffmpeg.exe` and
/// `ffprobe.exe` next to the compiled binary at
/// `target/debug/dam-app.exe`.
///
/// For production, add them to `tauri.conf.json`:
/// ```json
/// "bundle": { "resources": ["resources/ffmpeg.exe", "resources/ffprobe.exe"] }
/// ```
/// and place the binaries in `src-tauri/resources/`.
fn find_media_binaries(app: &tauri::AppHandle) -> (Option<PathBuf>, Option<PathBuf>) {
    let candidates: Vec<PathBuf> = {
        let mut dirs = Vec::new();
        if let Ok(dir) = app.path().resource_dir() {
            dirs.push(dir);
        }
        if let Ok(exe) = std::env::current_exe() {
            if let Some(dir) = exe.parent() {
                dirs.push(dir.to_path_buf());
            }
        }
        dirs
    };

    let find = |name: &str| -> Option<PathBuf> {
        candidates
            .iter()
            .map(|dir| dir.join(name))
            .find(|p| p.exists())
    };

    (find("ffmpeg.exe"), find("ffprobe.exe"))
}

/// Runs ffmpeg to extract a single frame as a JPEG thumbnail.
async fn run_ffmpeg(ffmpeg: &Path, src: &Path, dst: &Path) -> Result<(), String> {
    if let Some(parent) = dst.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Cannot create thumbnail dir: {e}"))?;
    }

    let status = tokio::process::Command::new(ffmpeg)
        .args([
            "-y",
            "-i",
            src.to_str().unwrap_or(""),
            "-ss",
            "00:00:01",
            "-vframes",
            "1",
            "-vf",
            "scale=256:256:force_original_aspect_ratio=decrease",
            "-q:v",
            "2",
            dst.to_str().unwrap_or(""),
        ])
        .status()
        .await
        .map_err(|e| format!("Failed to run ffmpeg: {e}"))?;

    if status.success() {
        Ok(())
    } else {
        Err(format!("ffmpeg exited with status {status}"))
    }
}
