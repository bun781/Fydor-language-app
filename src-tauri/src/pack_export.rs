use std::path::{Path, PathBuf};

const DEFAULT_PACK_FILE_NAME: &str = "fydor-pack.fydorpack";
const PACK_EXTENSION: &str = "fydorpack";

#[tauri::command]
pub fn save_fydor_pack(suggested_name: String, source: String) -> Result<Option<String>, String> {
    let file_name = suggested_pack_file_name(&suggested_name);
    let Some(path) = rfd::FileDialog::new()
        .set_title("Export Fydor Pack")
        .add_filter("Fydor Pack", &[PACK_EXTENSION])
        .set_file_name(&file_name)
        .save_file()
    else {
        return Ok(None);
    };

    let path = ensure_pack_extension(path);
    std::fs::write(&path, source).map_err(|error| format!("Unable to save pack: {error}"))?;

    Ok(Some(path.display().to_string()))
}

fn suggested_pack_file_name(value: &str) -> String {
    let file_name = Path::new(value)
        .file_name()
        .and_then(|name| name.to_str())
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .unwrap_or(DEFAULT_PACK_FILE_NAME);
    ensure_pack_extension(PathBuf::from(file_name))
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(DEFAULT_PACK_FILE_NAME)
        .to_string()
}

fn ensure_pack_extension(path: PathBuf) -> PathBuf {
    if path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case(PACK_EXTENSION))
    {
        return path;
    }

    let mut next = path;
    next.set_extension(PACK_EXTENSION);
    next
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn suggested_file_name_defaults_and_adds_extension() {
        assert_eq!(suggested_pack_file_name(""), DEFAULT_PACK_FILE_NAME);
        assert_eq!(
            suggested_pack_file_name("starter-pack"),
            "starter-pack.fydorpack"
        );
    }

    #[test]
    fn suggested_file_name_strips_paths() {
        assert_eq!(
            suggested_pack_file_name("../unsafe/starter-pack"),
            "starter-pack.fydorpack"
        );
    }

    #[test]
    fn ensure_pack_extension_preserves_existing_pack_extension() {
        assert_eq!(
            ensure_pack_extension(PathBuf::from("starter-pack.fydorpack")),
            PathBuf::from("starter-pack.fydorpack")
        );
    }

    #[test]
    fn ensure_pack_extension_replaces_non_pack_extension() {
        assert_eq!(
            ensure_pack_extension(PathBuf::from("starter-pack.json")),
            PathBuf::from("starter-pack.fydorpack")
        );
    }
}
