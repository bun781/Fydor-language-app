#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod external_links;
mod lessons;
mod models;
mod normalize;
mod public_library;
mod reading;
mod review;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            let _migrated_pglite_from = db::migrate_legacy_pglite_data(&app_data_dir)?;
            let conn = db::open_database(&app_data_dir)?;
            app.manage(db::AppState {
                conn: std::sync::Mutex::new(conn),
            });

            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.open_devtools();
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            lessons::get_lessons,
            lessons::get_lesson,
            lessons::export_lesson,
            lessons::update_lesson,
            lessons::delete_lesson,
            lessons::preview_lesson_import,
            lessons::import_lesson,
            review::get_review_queue,
            review::update_review_item,
            review::reset_review_progress,
            review::get_item_review_targets,
            review::update_item_review,
            review::get_review_progress,
            reading::get_reading_inputs,
            public_library::install_published_lesson,
            external_links::open_generation_destination
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
