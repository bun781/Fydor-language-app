// Tauri commands for lesson management: get_lessons, get_lesson, export_lesson, update_lesson, delete_lesson, preview_lesson_import, import_lesson.
// This is the authoritative import orchestrator for production — the TypeScript importLesson.ts is preview-only.
// Split: read.rs owns queries/export, import.rs owns the import/update/delete pipeline.
mod import;
mod read;

use crate::{db, models::*};
pub(crate) use import::*;
use read::*;
use tauri::State;

// Chunk: Tauri commands
#[tauri::command]
pub fn get_lessons(state: State<db::AppState>) -> Result<Vec<StudyLessonMeta>, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    get_lessons_inner(&conn).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn get_lesson(
    lesson_id: String,
    state: State<db::AppState>,
) -> Result<Option<StudyLesson>, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    get_lesson_inner(&conn, &lesson_id).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn export_lesson(
    lesson_id: String,
    state: State<db::AppState>,
) -> Result<LessonImportInput, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    export_lesson_inner(&conn, &lesson_id).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn update_lesson(
    lesson_id: String,
    source: String,
    state: State<db::AppState>,
) -> Result<LessonImportSummary, String> {
    let mut conn = state.conn.lock().map_err(|err| err.to_string())?;
    let (lesson, raw_value) = parse_lesson_json(&source).map_err(|errors| errors.join("\n"))?;
    let plan = build_import_plan(&conn, lesson, raw_value, Some(lesson_id.as_str()))
        .map_err(|err| err.to_string())?;
    replace_lesson(&mut conn, &lesson_id, plan).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn delete_lesson(lesson_id: String, state: State<db::AppState>) -> Result<(), String> {
    let mut conn = state.conn.lock().map_err(|err| err.to_string())?;
    delete_lesson_inner(&mut conn, &lesson_id).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn preview_lesson_import(
    source: String,
    lesson_id: Option<String>,
    state: State<db::AppState>,
) -> Result<LessonImportPreviewResult, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let (lesson, raw_value) = parse_lesson_json(&source).map_err(|errors| errors.join("\n"))?;
    let plan = build_import_plan(&conn, lesson, raw_value, lesson_id.as_deref())
        .map_err(|err| err.to_string())?;
    Ok(build_preview(&plan))
}

#[tauri::command]
pub fn import_lesson(
    source: String,
    lesson_id: Option<String>,
    state: State<db::AppState>,
) -> Result<LessonImportSummary, String> {
    let mut conn = state.conn.lock().map_err(|err| err.to_string())?;
    let (lesson, raw_value) = parse_lesson_json(&source).map_err(|errors| errors.join("\n"))?;
    let plan = build_import_plan(&conn, lesson, raw_value, lesson_id.as_deref())
        .map_err(|err| err.to_string())?;

    if plan.duplicate_import {
        return Ok(empty_summary_with_error(
            "This lesson has already been imported.",
        ));
    }

    import_plan(&mut conn, plan).map_err(|err| err.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::{params, Connection};

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("open in-memory database");
        conn.pragma_update(None, "foreign_keys", "ON")
            .expect("enable foreign keys");
        conn.execute_batch(
            r#"
            CREATE TABLE lessons (
              id TEXT PRIMARY KEY,
              target_language TEXT NOT NULL,
              base_language TEXT NOT NULL,
              description TEXT,
              source TEXT,
              level TEXT,
              title TEXT NOT NULL,
              source_hash TEXT NOT NULL UNIQUE,
              tags TEXT NOT NULL DEFAULT '[]',
              imported_at TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              purpose TEXT NOT NULL DEFAULT 'personal',
              published_stable_id TEXT,
              published_version TEXT,
              published_checksum TEXT,
              published_installed_at TEXT
            );

            CREATE TABLE learning_items (
              id TEXT PRIMARY KEY,
              language TEXT NOT NULL,
              type TEXT NOT NULL CHECK (type IN ('word', 'grammar', 'chunk')),
              canonical_key TEXT NOT NULL,
              display_text TEXT NOT NULL,
              meaning TEXT,
              explanation TEXT,
              common_mistakes TEXT NOT NULL DEFAULT '[]',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              UNIQUE(type, canonical_key)
            );

            CREATE TABLE sentences (
              id TEXT PRIMARY KEY,
              lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
              language TEXT NOT NULL,
              text TEXT NOT NULL,
              normalized_text TEXT NOT NULL,
              translation TEXT NOT NULL,
              review_state TEXT NOT NULL DEFAULT 'unknown',
              review_streak INTEGER NOT NULL DEFAULT 0,
              reviewed_at TEXT,
              focus_canonical_key TEXT,
              focus_display_text TEXT,
              focus_meaning TEXT,
              focus_explanation TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              UNIQUE(language, normalized_text)
            );

            CREATE TABLE lesson_sentences (
              id TEXT PRIMARY KEY,
              lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
              sentence_id TEXT NOT NULL REFERENCES sentences(id) ON DELETE CASCADE,
              position INTEGER NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              UNIQUE(lesson_id, sentence_id),
              UNIQUE(lesson_id, position)
            );

            CREATE TABLE sentence_vocabulary_links (
              id TEXT PRIMARY KEY,
              sentence_id TEXT NOT NULL REFERENCES sentences(id) ON DELETE CASCADE,
              vocabulary_item_id TEXT NOT NULL REFERENCES learning_items(id) ON DELETE CASCADE,
              surface_text TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              UNIQUE(sentence_id, vocabulary_item_id, surface_text)
            );

            CREATE TABLE sentence_grammar_links (
              id TEXT PRIMARY KEY,
              sentence_id TEXT NOT NULL REFERENCES sentences(id) ON DELETE CASCADE,
              grammar_item_id TEXT NOT NULL REFERENCES learning_items(id) ON DELETE CASCADE,
              surface_text TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              UNIQUE(sentence_id, grammar_item_id, surface_text)
            );

            CREATE TABLE sentence_chunk_links (
              id TEXT PRIMARY KEY,
              sentence_id TEXT NOT NULL REFERENCES sentences(id) ON DELETE CASCADE,
              chunk_item_id TEXT NOT NULL REFERENCES learning_items(id) ON DELETE CASCADE,
              surface_text TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              UNIQUE(sentence_id, chunk_item_id, surface_text)
            );

            CREATE TABLE review_items (
              id TEXT PRIMARY KEY,
              sentence_id TEXT NOT NULL REFERENCES sentences(id) ON DELETE CASCADE,
              lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
              import_id TEXT NOT NULL,
              due_at TEXT NOT NULL,
              last_reviewed_at TEXT,
              repetitions INTEGER NOT NULL DEFAULT 0,
              lapses INTEGER NOT NULL DEFAULT 0,
              difficulty REAL NOT NULL DEFAULT 0.3,
              stability REAL NOT NULL DEFAULT 0,
              recall_mode TEXT NOT NULL DEFAULT 'full_support',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              UNIQUE(sentence_id)
            );
            "#,
        )
        .expect("create test schema");
        conn
    }

    fn lesson(title: &str, text: &str) -> LessonImportInput {
        LessonImportInput {
            language: "ko".to_string(),
            base_language: "en".to_string(),
            title: title.to_string(),
            description: None,
            source: None,
            level: None,
            tags: None,
            sentences: vec![LessonSentenceInput {
                text: text.to_string(),
                translation: Some(format!("{text} translation")),
                words: Some(vec![LessonWordInput {
                    surface: text.to_string(),
                    lemma: None,
                    meaning: Some("meaning".to_string()),
                    role: None,
                    explanation: None,
                }]),
                grammar: None,
                chunks: None,
            }],
        }
    }

    fn import_test_lesson(
        conn: &mut Connection,
        lesson: LessonImportInput,
        lesson_id: Option<&str>,
    ) -> LessonImportSummary {
        let raw_value = serde_json::to_value(&lesson).expect("serialize lesson");
        let plan =
            build_import_plan(conn, lesson, raw_value, lesson_id).expect("build import plan");
        import_plan(conn, plan).expect("import lesson")
    }

    fn scalar_count(conn: &Connection, sql: &str, value: &str) -> i64 {
        conn.query_row(sql, [value], |row| row.get(0))
            .expect("count rows")
    }

    #[test]
    fn strict_import_parser_accepts_fenced_json_and_rejects_hostile_payloads() {
        let source =
            serde_json::to_string(&lesson("Safe", "안녕하세요")).expect("serialize lesson");
        assert!(parse_lesson_json(&format!("```json\n{source}\n```")).is_ok());

        let duplicate = r#"{"language":"ko","language":"en","baseLanguage":"en","title":"x","sentences":[{"text":"안녕"}]}"#;
        assert!(parse_lesson_json(duplicate)
            .unwrap_err()
            .join("\n")
            .contains("duplicate object key"));

        let polluted = r#"{"language":"ko","baseLanguage":"en","title":"x","__proto__":{},"sentences":[{"text":"안녕"}]}"#;
        assert!(parse_lesson_json(polluted)
            .unwrap_err()
            .join("\n")
            .contains("dangerous object key"));

        let html = r#"{"language":"ko","baseLanguage":"en","title":"<script>alert(1)</script>","sentences":[{"text":"안녕"}]}"#;
        assert!(parse_lesson_json(html)
            .unwrap_err()
            .join("\n")
            .contains("unsafe HTML"));
    }

    #[test]
    fn delete_lesson_removes_owned_sentences_and_links() {
        let mut conn = test_conn();
        let summary = import_test_lesson(&mut conn, lesson("Lesson A", "안녕하세요"), None);
        let lesson_id = get_lessons_inner(&conn).expect("load lessons")[0]
            .id
            .clone();
        assert_eq!(summary.sentences_imported, 1);

        delete_lesson_inner(&mut conn, &lesson_id).expect("delete lesson");

        assert_eq!(
            scalar_count(
                &conn,
                "SELECT COUNT(*) FROM lessons WHERE id = ?1",
                &lesson_id
            ),
            0
        );
        assert_eq!(
            scalar_count(
                &conn,
                "SELECT COUNT(*) FROM lesson_sentences WHERE lesson_id = ?1",
                &lesson_id
            ),
            0
        );
        assert_eq!(
            scalar_count(
                &conn,
                "SELECT COUNT(*) FROM review_items WHERE lesson_id = ?1 OR import_id = ?1",
                &lesson_id
            ),
            0
        );
        assert_eq!(
            scalar_count(
                &conn,
                "SELECT COUNT(*) FROM sentence_vocabulary_links WHERE surface_text = ?1",
                "안녕하세요"
            ),
            0
        );
    }

    #[test]
    fn delete_lesson_keeps_shared_sentence_under_remaining_lesson() {
        let mut conn = test_conn();
        import_test_lesson(&mut conn, lesson("Lesson A", "공부해요"), None);
        let lesson_a_id = get_lessons_inner(&conn).expect("load lessons")[0]
            .id
            .clone();
        import_test_lesson(&mut conn, lesson("Lesson B", "공부해요"), None);

        let lesson_b_id = get_lessons_inner(&conn)
            .expect("load lessons")
            .into_iter()
            .find(|item| item.title == "Lesson B")
            .expect("lesson remains")
            .id;
        let sentence_id: String = conn
            .query_row(
                "SELECT sentence_id FROM lesson_sentences WHERE lesson_id = ?1",
                [&lesson_a_id],
                |row| row.get(0),
            )
            .expect("load shared sentence");
        let now = db::now();
        conn.execute(
            r#"
            INSERT INTO review_items
            (id, sentence_id, lesson_id, import_id, due_at, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?3, ?4, ?4, ?4)
            "#,
            params![db::id(), sentence_id, lesson_a_id, now],
        )
        .expect("insert review item");

        delete_lesson_inner(&mut conn, &lesson_a_id).expect("delete original lesson");

        assert_eq!(
            scalar_count(
                &conn,
                "SELECT COUNT(*) FROM lessons WHERE id = ?1",
                &lesson_a_id
            ),
            0
        );
        assert_eq!(
            scalar_count(
                &conn,
                "SELECT COUNT(*) FROM sentences WHERE lesson_id = ?1",
                &lesson_b_id
            ),
            1
        );
        assert_eq!(
            scalar_count(
                &conn,
                "SELECT COUNT(*) FROM lesson_sentences WHERE lesson_id = ?1",
                &lesson_b_id
            ),
            1
        );
        assert_eq!(
            scalar_count(
                &conn,
                "SELECT COUNT(*) FROM review_items WHERE lesson_id = ?1",
                &lesson_b_id
            ),
            1
        );
    }
}
