#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(feature = "auto-updates")]
mod app_updates;
mod db;
mod external_links;
mod lessons;
mod models;
mod normalize;
mod pack_export;
mod packs;
mod reading;
mod review;

use tauri::Manager;

fn main() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_opener::init());

    // The updater plugin requires a signed-release config (`plugins.updater`) at
    // startup. Keep it out of default builds so an incomplete release setup does
    // not abort the app before the first window opens.
    #[cfg(feature = "auto-updates")]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    builder
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            let conn = db::open_database(&app_data_dir)?;
            app.manage(db::AppState {
                conn: std::sync::Mutex::new(conn),
            });

            #[cfg(feature = "auto-updates")]
            app_updates::check_on_startup(app.handle().clone());

            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
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
            packs::get_packs,
            packs::upsert_pack,
            packs::update_pack,
            packs::move_lessons_to_pack,
            packs::delete_pack,
            review::get_review_queue,
            review::update_review_item,
            review::reset_review_progress,
            review::get_item_review_targets,
            review::update_item_review,
            review::get_review_progress,
            reading::get_reading_inputs,
            pack_export::save_fydor_pack,
            external_links::open_generation_destination,
            external_links::open_community_workspace
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
