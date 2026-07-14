use tauri::AppHandle;
#[cfg(not(debug_assertions))]
use tauri_plugin_updater::UpdaterExt;

#[cfg(not(debug_assertions))]
pub fn check_on_startup(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        if let Err(err) = check_and_install(app).await {
            eprintln!("update check failed: {err}");
        }
    });
}

#[cfg(debug_assertions)]
pub fn check_on_startup(_app: AppHandle) {}

#[cfg(not(debug_assertions))]
async fn check_and_install(app: AppHandle) -> tauri_plugin_updater::Result<()> {
    let Some(update) = app.updater()?.check().await? else {
        return Ok(());
    };

    update
        .download_and_install(
            |_chunk_length, _content_length| {},
            || {
                eprintln!("update downloaded");
            },
        )
        .await?;
    app.restart();
    Ok(())
}
