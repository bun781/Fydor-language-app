use tauri::AppHandle;
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
        "contributor" => community_url("contribute", source_lesson_id.as_deref())?,
        "moderate" => community_url("moderate", None)?,
        "admin" => community_url("admin", None)?,
        _ => return Err("Unsupported external destination.".to_string()),
    };
    app.opener()
        .open_url(target, None::<&str>)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn open_community_workspace(
    destination: String,
    source_lesson_id: Option<String>,
    app: AppHandle,
) -> Result<(), String> {
    let path = match destination.as_str() {
        "contributor" => "contribute",
        "moderate" => "moderate",
        "admin" => "admin",
        _ => return Err("Unsupported community workspace.".to_string()),
    };
    let target = community_url(path, source_lesson_id.as_deref())?;
    // Remote website content must never run inside a Tauri webview: a website
    // compromise must not gain access to this app's IPC surface.
    app.opener()
        .open_url(target, None::<&str>)
        .map_err(|error| error.to_string())
}

fn community_url(path: &str, source_lesson_id: Option<&str>) -> Result<String, String> {
    let mut url = Url::parse(web_origin()).map_err(|error| error.to_string())?;
    if url.scheme() != "https"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || url.path() != "/"
    {
        return Err("Fydor website origin must be an HTTPS origin without a path.".to_string());
    }
    url.set_path(&format!("{}/{}", url.path().trim_end_matches('/'), path));
    if let Some(lesson_id) = source_lesson_id {
        if !is_uuid(lesson_id) {
            return Err("Invalid source lesson identifier.".to_string());
        }
        url.query_pairs_mut()
            .append_pair("conversionSource", lesson_id);
    }
    Ok(url.to_string())
}

fn web_origin() -> &'static str {
    option_env!("FYDOR_WEB_ORIGIN").unwrap_or(DEFAULT_WEB_ORIGIN)
}

fn is_uuid(value: &str) -> bool {
    uuid::Uuid::parse_str(value).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn community_pages_are_fixed_and_conversion_ids_are_validated() {
        let url = community_url("contribute", Some("550e8400-e29b-41d4-a716-446655440000"))
            .expect("valid community URL");
        assert_eq!(url, "https://fydor.vercel.app/contribute?conversionSource=550e8400-e29b-41d4-a716-446655440000");
        assert!(community_url("moderate", Some("not-a-uuid")).is_err());
    }
}
