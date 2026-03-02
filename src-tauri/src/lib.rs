use std::collections::HashMap;
use tauri::Manager;
use state::AppState;
use worker::queue::WorkerJob;

pub mod commands;
pub mod db;
pub mod error;
pub mod models;
pub mod state;
pub mod worker;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Create background-worker channel
            let (worker_tx, worker_rx) = tokio::sync::mpsc::channel::<WorkerJob>(256);

            // Spawn background worker — handles thumbnail generation and metadata extraction
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(worker::spawn_worker(worker_rx, app_handle));

            // Initialise application state — no org DB yet (created lazily on switch_org)
            app.manage(AppState {
                auth: tokio::sync::RwLock::new(None),
                db_pool: tokio::sync::RwLock::new(HashMap::new()),
                active_org_id: tokio::sync::RwLock::new(None),
                worker_tx,
                storage_paths: tokio::sync::RwLock::new(HashMap::new()),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::auth::set_session,
            commands::auth::switch_org,
            commands::auth::get_auth_state,
            commands::auth::get_cached_session,
            commands::auth::logout,
            commands::settings::get_storage_path,
            commands::settings::set_storage_path,
            commands::folders::get_folder_tree,
            commands::folders::create_folder,
            commands::folders::rename_folder,
            commands::folders::move_folder,
            commands::folders::delete_folder,
            commands::assets::list_assets,
            commands::assets::import_assets,
            commands::assets::delete_assets,
            commands::assets::move_assets,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
