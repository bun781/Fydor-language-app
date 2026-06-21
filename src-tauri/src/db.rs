use anyhow::Result;
use rusqlite::Connection;
use std::{path::Path, sync::Mutex};

pub struct AppState {
    pub conn: Mutex<Connection>,
}

pub fn open_database(app_data_dir: &Path) -> Result<Connection> {
    std::fs::create_dir_all(app_data_dir)?;
    let db_path = app_data_dir.join("fydor.sqlite3");
    let conn = Connection::open(db_path)?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    migrate(&conn)?;
    Ok(conn)
}

fn migrate(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          applied_at TEXT NOT NULL
        );
        "#,
    )?;

    let current: i64 = conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
        [],
        |row| row.get(0),
    )?;

    if current < 1 {
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
              updated_at TEXT NOT NULL
            );
            CREATE INDEX lessons_title_idx ON lessons(title);

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
            CREATE INDEX learning_items_language_type_idx ON learning_items(language, type);

            CREATE TABLE sentences (
              id TEXT PRIMARY KEY,
              lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
              language TEXT NOT NULL,
              text TEXT NOT NULL,
              normalized_text TEXT NOT NULL,
              translation TEXT NOT NULL,
              review_state TEXT NOT NULL DEFAULT 'unknown' CHECK (review_state IN ('unknown', 'remembered', 'forgotten')),
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
            CREATE INDEX sentences_lesson_idx ON sentences(lesson_id);

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
            CREATE INDEX sentence_vocabulary_links_sentence_idx ON sentence_vocabulary_links(sentence_id);

            CREATE TABLE sentence_grammar_links (
              id TEXT PRIMARY KEY,
              sentence_id TEXT NOT NULL REFERENCES sentences(id) ON DELETE CASCADE,
              grammar_item_id TEXT NOT NULL REFERENCES learning_items(id) ON DELETE CASCADE,
              surface_text TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              UNIQUE(sentence_id, grammar_item_id, surface_text)
            );
            CREATE INDEX sentence_grammar_links_sentence_idx ON sentence_grammar_links(sentence_id);

            CREATE TABLE sentence_chunk_links (
              id TEXT PRIMARY KEY,
              sentence_id TEXT NOT NULL REFERENCES sentences(id) ON DELETE CASCADE,
              chunk_item_id TEXT NOT NULL REFERENCES learning_items(id) ON DELETE CASCADE,
              surface_text TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              UNIQUE(sentence_id, chunk_item_id, surface_text)
            );
            CREATE INDEX sentence_chunk_links_sentence_idx ON sentence_chunk_links(sentence_id);

            CREATE TABLE user_settings (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            INSERT INTO schema_migrations(version, applied_at) VALUES (1, datetime('now'));
            "#,
        )?;
    }

    Ok(())
}

pub fn now() -> String {
    chrono::Utc::now().to_rfc3339()
}

pub fn id() -> String {
    uuid::Uuid::new_v4().to_string()
}

pub fn json_array<T: serde::Serialize>(value: &T) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| "[]".to_string())
}

pub fn parse_json_array(value: String) -> Vec<String> {
    serde_json::from_str(&value).unwrap_or_default()
}
