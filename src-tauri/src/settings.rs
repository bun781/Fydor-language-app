use crate::db;
use rusqlite::params;
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub fn save_user_settings(settings: Value, state: State<db::AppState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let now = db::now();

    if let Value::Object(entries) = settings {
        for (key, value) in entries {
            conn.execute(
                r#"
                INSERT INTO user_settings (key, value, updated_at)
                VALUES (?1, ?2, ?3)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
                "#,
                params![key, value.to_string(), now],
            )
            .map_err(|err| err.to_string())?;
        }
        Ok(())
    } else {
        Err("Settings must be an object.".to_string())
    }
}
