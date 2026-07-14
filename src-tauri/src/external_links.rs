use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;
use url::Url;

const DEFAULT_WEB_ORIGIN: &str = "https://fydor.vercel.app";

#[tauri::command]
pub fn open_generation_destination(
    destination: String,
    source_lesson_id: Option<String>,
    app: AppHandle,
) -> Result<(), String> {
    let target = match destination.as_str() {
        "chatgpt" => "https://chatgpt.com/".to_string(),
        "claude" => "https://claude.ai/".to_string(),
        "contributor" => {
            community_url("contribute.html", "contribute", source_lesson_id.as_deref())?
        }
        "moderate" => community_url("moderate.html", "moderate", None)?,
        "admin" => community_url("admin.html", "admin", None)?,
        _ => return Err("Unsupported external destination.".to_string()),
    };
    app.opener()
        .open_url(target, None::<&str>)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn open_community_workspace(
    destination: String,
    source_lesson_id: Option<String>,
    app: AppHandle,
) -> Result<(), String> {
    let (page, fragment, title) = match destination.as_str() {
        "contributor" => (
            "contribute.html",
            "contribute",
            "Fydor Contributor Workspace",
        ),
        "moderate" => ("moderate.html", "moderate", "Fydor Moderation Workspace"),
        "admin" => ("admin.html", "admin", "Fydor Administration Workspace"),
        _ => return Err("Unsupported community workspace.".to_string()),
    };
    let target = Url::parse(&community_url(page, fragment, source_lesson_id.as_deref())?)
        .map_err(|error| error.to_string())?;
    let label = format!("community-{}", destination);

    if let Some(window) = app.get_webview_window(&label) {
        window.navigate(target).map_err(|error| error.to_string())?;
        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
        return Ok(());
    }

    WebviewWindowBuilder::new(&app, label, WebviewUrl::External(target))
        .title(title)
        .inner_size(1200.0, 900.0)
        .resizable(true)
        .center()
        .build()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

fn community_url(
    page: &str,
    fragment: &str,
    source_lesson_id: Option<&str>,
) -> Result<String, String> {
    let mut url = Url::parse(DEFAULT_WEB_ORIGIN).map_err(|error| error.to_string())?;
    url.set_path(&format!("{}/{}", url.path().trim_end_matches('/'), page));
    if let Some(lesson_id) = source_lesson_id {
        if !is_uuid(lesson_id) {
            return Err("Invalid source lesson identifier.".to_string());
        }
        url.query_pairs_mut()
            .append_pair("conversionSource", lesson_id);
    }
    url.set_fragment(Some(fragment));
    Ok(url.to_string())
}

fn is_uuid(value: &str) -> bool {
    uuid::Uuid::parse_str(value).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn community_pages_are_fixed_and_conversion_ids_are_validated() {
        let url = community_url(
            "contribute.html",
            "contribute",
            Some("550e8400-e29b-41d4-a716-446655440000"),
        )
        .expect("valid community URL");
        assert_eq!(url, "https://fydor.vercel.app/contribute.html?conversionSource=550e8400-e29b-41d4-a716-446655440000#contribute");
        assert!(community_url("moderate.html", "moderate", Some("not-a-uuid")).is_err());
    }
}
