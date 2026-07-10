use crate::{db, lessons, models::*, normalize};
use rusqlite::{params, OptionalExtension};
use serde_json::Value;
use std::collections::HashSet;
use tauri::State;

const MAX_PUBLISHED_LESSON_BYTES: usize = 1_000_000;
const MAX_JSON_DEPTH: usize = 24;

#[tauri::command]
pub fn install_published_lesson(
    stable_lesson_id: String,
    lesson_version: String,
    checksum: String,
    source: String,
    state: State<db::AppState>,
) -> Result<PublishedLessonInstallResult, String> {
    let mut conn = state.conn.lock().map_err(|error| error.to_string())?;
    install_published_lesson_inner(
        &mut conn,
        stable_lesson_id,
        lesson_version,
        checksum,
        source,
    )
}

fn install_published_lesson_inner(
    conn: &mut rusqlite::Connection,
    stable_lesson_id: String,
    lesson_version: String,
    checksum: String,
    source: String,
) -> Result<PublishedLessonInstallResult, String> {
    validate_manifest_fields(&stable_lesson_id, &lesson_version, &checksum)?;
    if source.len() > MAX_PUBLISHED_LESSON_BYTES {
        return Err("Published lesson exceeds the 1 MB import limit.".to_string());
    }

    let canonical: Value = lessons::parse_strict_json(&source)
        .map_err(|error| format!("Published lesson JSON is malformed: {error}"))?;
    validate_json_value(&canonical, 0)?;
    let actual_checksum = normalize::hash_json_value(&canonical);
    if actual_checksum != checksum {
        return Err("Published lesson checksum verification failed.".to_string());
    }
    let schema_version = canonical
        .get("schemaVersion")
        .and_then(Value::as_u64)
        .ok_or_else(|| "Published lesson schemaVersion is required.".to_string())?;
    if schema_version != 1 {
        return Err(format!(
            "Published lesson schema version {schema_version} is not supported."
        ));
    }

    let mut personal_value = canonical.clone();
    let object = personal_value
        .as_object_mut()
        .ok_or_else(|| "Published lesson must be a JSON object.".to_string())?;
    object.remove("schemaVersion");
    if let Some(sentences) = object.get_mut("sentences").and_then(Value::as_array_mut) {
        for sentence in sentences {
            if let Some(sentence_object) = sentence.as_object_mut() {
                sentence_object.remove("metadata");
                sentence_object.remove("notes");
            }
        }
    }
    let personal_source =
        serde_json::to_string(&personal_value).map_err(|error| error.to_string())?;
    let (mut lesson, _) = lessons::parse_lesson_json(&personal_source).map_err(|errors| {
        format!(
            "Published lesson is incompatible with this Fydor version: {}",
            errors.join("\n")
        )
    })?;
    lesson.source = Some(format!(
        "Fydor Library: {stable_lesson_id}@{lesson_version}"
    ));
    let raw_value = serde_json::to_value(&lesson).map_err(|error| error.to_string())?;

    let existing = conn
        .query_row(
            "SELECT id, published_version, published_checksum FROM lessons WHERE published_stable_id = ?1",
            [&stable_lesson_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?, row.get::<_, Option<String>>(2)?)),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    if let Some((lesson_id, installed_version, installed_checksum)) = &existing {
        if installed_checksum.as_deref() == Some(checksum.as_str()) {
            return Ok(PublishedLessonInstallResult {
                status: "already_installed".to_string(),
                lesson_id: lesson_id.clone(),
                lesson_version,
                progress_preserved: true,
                warning: None,
                summary: empty_summary(),
            });
        }
        if version_number(&lesson_version)?
            <= version_number(installed_version.as_deref().unwrap_or("0"))?
        {
            return Err(
                "A different equal or newer version of this published lesson is already installed."
                    .to_string(),
            );
        }
    }

    let (lesson_id, status, progress_preserved, warning, summary) = if let Some((lesson_id, _, _)) =
        existing
    {
        let progress_preserved = reviewed_sentences_are_preserved(conn, &lesson_id, &lesson)
            .map_err(|error| error.to_string())?;
        let plan = lessons::build_import_plan(conn, lesson, raw_value, Some(&lesson_id))
            .map_err(|error| error.to_string())?;
        let summary =
            lessons::replace_lesson(conn, &lesson_id, plan).map_err(|error| error.to_string())?;
        let warning = (!progress_preserved).then(|| {
            "Some previously reviewed sentences were removed by this update. Progress for unchanged sentences was preserved.".to_string()
        });
        (
            lesson_id,
            "updated".to_string(),
            progress_preserved,
            warning,
            summary,
        )
    } else {
        let source_hash = normalize::hash_json_value(&raw_value);
        let plan = lessons::build_import_plan(conn, lesson, raw_value, None)
            .map_err(|error| error.to_string())?;
        let summary = lessons::import_plan(conn, plan).map_err(|error| error.to_string())?;
        let lesson_id = conn
            .query_row(
                "SELECT id FROM lessons WHERE source_hash = ?1",
                [&source_hash],
                |row| row.get::<_, String>(0),
            )
            .map_err(|error| error.to_string())?;
        (lesson_id, "installed".to_string(), true, None, summary)
    };

    conn.execute(
        r#"
        UPDATE lessons
        SET purpose = 'personal', published_stable_id = ?1, published_version = ?2,
            published_checksum = ?3, published_installed_at = ?4, updated_at = ?4
        WHERE id = ?5
        "#,
        params![
            stable_lesson_id,
            lesson_version,
            checksum,
            db::now(),
            lesson_id
        ],
    )
    .map_err(|error| error.to_string())?;

    Ok(PublishedLessonInstallResult {
        status,
        lesson_id,
        lesson_version,
        progress_preserved,
        warning,
        summary,
    })
}

fn validate_manifest_fields(stable_id: &str, version: &str, checksum: &str) -> Result<(), String> {
    if !stable_id.starts_with("lesson-")
        || stable_id.len() != 43
        || !stable_id[7..]
            .chars()
            .all(|ch| ch.is_ascii_hexdigit() || ch == '-')
    {
        return Err("Invalid published lesson identifier.".to_string());
    }
    version_number(version)?;
    if checksum.len() != 64
        || !checksum
            .chars()
            .all(|ch| ch.is_ascii_hexdigit() && !ch.is_ascii_uppercase())
    {
        return Err("Invalid published lesson checksum.".to_string());
    }
    Ok(())
}

fn version_number(version: &str) -> Result<u64, String> {
    version
        .parse::<u64>()
        .map_err(|_| "Published lesson version must be a positive integer.".to_string())
        .and_then(|value| {
            if value == 0 {
                Err("Published lesson version must be positive.".to_string())
            } else {
                Ok(value)
            }
        })
}

fn validate_json_value(value: &Value, depth: usize) -> Result<(), String> {
    if depth > MAX_JSON_DEPTH {
        return Err(format!(
            "Published lesson JSON exceeds {MAX_JSON_DEPTH} nesting levels."
        ));
    }
    match value {
        Value::Object(object) => {
            for (key, value) in object {
                if matches!(key.as_str(), "__proto__" | "prototype" | "constructor") {
                    return Err(format!("Published lesson contains a dangerous key: {key}."));
                }
                validate_json_value(value, depth + 1)?;
            }
        }
        Value::Array(values) => {
            if values.len() > 10_000 {
                return Err("Published lesson contains an oversized array.".to_string());
            }
            for value in values {
                validate_json_value(value, depth + 1)?;
            }
        }
        Value::String(text) => {
            if text.len() > 20_000
                || text
                    .chars()
                    .any(|ch| matches!(ch, '\u{202A}'..='\u{202E}' | '\u{2066}'..='\u{2069}'))
            {
                return Err("Published lesson contains an unsafe or oversized string.".to_string());
            }
        }
        _ => {}
    }
    Ok(())
}

fn reviewed_sentences_are_preserved(
    conn: &rusqlite::Connection,
    lesson_id: &str,
    next: &LessonImportInput,
) -> anyhow::Result<bool> {
    let next_texts = next
        .sentences
        .iter()
        .map(|sentence| normalize::normalize_sentence_text(&sentence.text))
        .collect::<HashSet<_>>();
    let mut stmt = conn.prepare(
        r#"SELECT s.normalized_text FROM review_items ri JOIN sentences s ON s.id=ri.sentence_id
           WHERE ri.lesson_id=?1 AND ri.repetitions>0"#,
    )?;
    let reviewed = stmt
        .query_map([lesson_id], |row| row.get::<_, String>(0))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(reviewed.into_iter().all(|text| next_texts.contains(&text)))
}

fn empty_summary() -> LessonImportSummary {
    LessonImportSummary {
        lesson_created: false,
        lesson_updated: false,
        sentences_imported: 0,
        sentences_skipped: 0,
        vocabulary_created: 0,
        vocabulary_reused: 0,
        grammar_created: 0,
        grammar_reused: 0,
        chunks_created: 0,
        chunks_reused: 0,
        links_created: 0,
        errors: Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("open database");
        conn.pragma_update(None, "foreign_keys", "ON")
            .expect("foreign keys");
        db::migrate(&conn).expect("migrate database");
        conn
    }

    fn canonical(text: &str, translation: &str) -> String {
        serde_json::to_string(&serde_json::json!({
            "schemaVersion": 1,
            "language": "ko",
            "baseLanguage": "en",
            "title": "Published lesson",
            "description": "A reviewed public lesson.",
            "level": "beginner",
            "tags": ["daily"],
            "sentences": [{"text": text, "translation": translation, "words": [], "grammar": [], "chunks": []}]
        })).expect("canonical JSON")
    }

    #[test]
    fn rejects_unsafe_manifest_fields() {
        assert!(validate_manifest_fields("https://evil.test", "1", &"a".repeat(64)).is_err());
        assert!(validate_manifest_fields(
            &format!("lesson-{}", "0".repeat(36)),
            "0",
            &"a".repeat(64)
        )
        .is_err());
        assert!(validate_manifest_fields(
            &format!("lesson-{}", "0".repeat(36)),
            "1",
            &"A".repeat(64)
        )
        .is_err());
    }

    #[test]
    fn rejects_deep_or_dangerous_json() {
        let dangerous = serde_json::json!({"__proto__": {"polluted": true}});
        assert!(validate_json_value(&dangerous, 0).is_err());
        let mut deep = serde_json::json!(null);
        for _ in 0..30 {
            deep = serde_json::json!([deep]);
        }
        assert!(validate_json_value(&deep, 0).is_err());
    }

    #[test]
    fn installs_verifies_and_deduplicates_a_published_lesson() {
        let mut conn = test_conn();
        let source = canonical("안녕하세요.", "Hello.");
        let value: Value = serde_json::from_str(&source).expect("parse canonical");
        let checksum = normalize::hash_json_value(&value);
        let stable_id = "lesson-00000000-0000-4000-8000-000000000001".to_string();

        let installed = install_published_lesson_inner(
            &mut conn,
            stable_id.clone(),
            "1".to_string(),
            checksum.clone(),
            source.clone(),
        )
        .expect("install");
        assert_eq!(installed.status, "installed");
        assert!(installed.progress_preserved);
        let duplicate =
            install_published_lesson_inner(&mut conn, stable_id, "1".to_string(), checksum, source)
                .expect("deduplicate");
        assert_eq!(duplicate.status, "already_installed");
    }

    #[test]
    fn rejects_bad_checksum_and_warns_when_update_removes_reviewed_content() {
        let mut conn = test_conn();
        let first = canonical("안녕하세요.", "Hello.");
        let first_value: Value = serde_json::from_str(&first).expect("parse canonical");
        let first_checksum = normalize::hash_json_value(&first_value);
        let stable_id = "lesson-00000000-0000-4000-8000-000000000002".to_string();
        assert!(install_published_lesson_inner(
            &mut conn,
            stable_id.clone(),
            "1".to_string(),
            "0".repeat(64),
            first.clone()
        )
        .is_err());
        let installed = install_published_lesson_inner(
            &mut conn,
            stable_id.clone(),
            "1".to_string(),
            first_checksum,
            first,
        )
        .expect("install");
        let sentence_id: String = conn
            .query_row(
                "SELECT sentence_id FROM lesson_sentences WHERE lesson_id=?1",
                [&installed.lesson_id],
                |row| row.get(0),
            )
            .expect("sentence");
        let now = db::now();
        conn.execute(
            "INSERT INTO review_items(id,sentence_id,lesson_id,import_id,due_at,repetitions,created_at,updated_at) VALUES(?1,?2,?3,?3,?4,1,?4,?4)",
            params![db::id(), sentence_id, installed.lesson_id, now],
        ).expect("review row");

        let second = canonical("감사합니다.", "Thank you.");
        let second_value: Value = serde_json::from_str(&second).expect("parse canonical");
        let second_checksum = normalize::hash_json_value(&second_value);
        let updated = install_published_lesson_inner(
            &mut conn,
            stable_id,
            "2".to_string(),
            second_checksum,
            second,
        )
        .expect("update");
        assert_eq!(updated.status, "updated");
        assert!(!updated.progress_preserved);
        assert!(updated.warning.is_some());
    }
}
