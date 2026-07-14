use anyhow::{Context, Result};
use rusqlite::Connection;
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};

pub struct AppState {
    pub conn: Mutex<Connection>,
}

const SQLITE_FILE_NAME: &str = "fydor.sqlite3";

pub fn database_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(SQLITE_FILE_NAME)
}

pub fn prepare_app_data_dir(app_data_dir: &Path) -> Result<()> {
    // Runtime databases live in OS app data so the source repo stays source-only.
    fs::create_dir_all(app_data_dir).with_context(|| {
        format!(
            "failed to create app data directory {}",
            app_data_dir.display()
        )
    })
}

pub fn open_database(app_data_dir: &Path) -> Result<Connection> {
    prepare_app_data_dir(app_data_dir)?;
    let db_path = database_path(app_data_dir);
    let conn = Connection::open(&db_path)
        .with_context(|| format!("failed to open SQLite database {}", db_path.display()))?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    migrate(&conn)?;
    Ok(conn)
}

pub(crate) fn migrate(conn: &Connection) -> Result<()> {
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
        run_migration(
            conn,
            1,
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
            "#,
        )?;
    }

    if current < 2 {
        run_migration(
            conn,
            2,
            r#"
            CREATE TABLE IF NOT EXISTS review_items (
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
              recall_mode TEXT NOT NULL DEFAULT 'full_support' CHECK (recall_mode IN ('full_support', 'translation_hidden', 'sentence_only', 'fill_blank', 'reverse_translate')),
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              UNIQUE(sentence_id)
            );
            CREATE INDEX IF NOT EXISTS review_items_due_idx ON review_items(due_at);
            CREATE INDEX IF NOT EXISTS review_items_lesson_idx ON review_items(lesson_id);

            INSERT OR IGNORE INTO review_items
            (id, sentence_id, lesson_id, import_id, due_at, last_reviewed_at, repetitions, lapses, difficulty, stability, recall_mode, created_at, updated_at)
            SELECT
              lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
              id,
              lesson_id,
              lesson_id,
              COALESCE(reviewed_at, datetime('now')),
              reviewed_at,
              review_streak,
              CASE WHEN review_state = 'forgotten' THEN 1 ELSE 0 END,
              0.3,
              review_streak,
              'full_support',
              datetime('now'),
              datetime('now')
            FROM sentences;
            "#,
        )?;
    }

    if current < 3 {
        run_migration(
            conn,
            3,
            r#"
            ALTER TABLE review_items
            ADD COLUMN scheduler_engine TEXT NOT NULL DEFAULT 'fixed-interval'
            CHECK (scheduler_engine IN ('fixed-interval', 'fsrs'));
            "#,
        )?;
    }

    if current < 4 {
        // Item-level review state gets its own table instead of overloading the
        // sentence-shaped review_items (UNIQUE(sentence_id)). Rows are created lazily on
        // first grade; items without a row are treated as new/unreviewed. Existing
        // review_items rows are untouched, so fixed-interval sentence scheduling is preserved.
        run_migration(
            conn,
            4,
            r#"
            CREATE TABLE item_review_states (
              id TEXT PRIMARY KEY,
              learning_item_id TEXT NOT NULL REFERENCES learning_items(id) ON DELETE CASCADE,
              due_at TEXT NOT NULL,
              last_reviewed_at TEXT,
              repetitions INTEGER NOT NULL DEFAULT 0,
              lapses INTEGER NOT NULL DEFAULT 0,
              difficulty REAL NOT NULL DEFAULT 0.3,
              stability REAL NOT NULL DEFAULT 0,
              scheduler_engine TEXT NOT NULL DEFAULT 'fixed-interval' CHECK (scheduler_engine IN ('fixed-interval', 'fsrs')),
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              UNIQUE(learning_item_id)
            );
            CREATE INDEX item_review_states_due_idx ON item_review_states(due_at);
            "#,
        )?;
    }

    if current < 5 {
        // Append-only review log. One row per grade action (sentence or item), used for
        // daily new-card caps, streaks, and heatmaps. was_new marks the first-ever grade
        // of a card. Never updated or deleted by review flows; resets leave it intact so
        // history survives progress resets.
        run_migration(
            conn,
            5,
            r#"
            CREATE TABLE review_events (
              id TEXT PRIMARY KEY,
              target_kind TEXT NOT NULL CHECK (target_kind IN ('sentence', 'item')),
              target_id TEXT NOT NULL,
              grade TEXT NOT NULL CHECK (grade IN ('forgot', 'hard', 'remembered', 'easy')),
              was_new INTEGER NOT NULL DEFAULT 0,
              reviewed_at TEXT NOT NULL
            );
            CREATE INDEX review_events_reviewed_idx ON review_events(reviewed_at);
            "#,
        )?;
    }

    if current < 6 {
        // Public-library provenance is kept beside the local personal copy. The
        // desktop never stores contributor drafts or moderation state in study tables.
        run_migration(
            conn,
            6,
            r#"
            ALTER TABLE lessons ADD COLUMN purpose TEXT NOT NULL DEFAULT 'personal'
              CHECK (purpose IN ('personal', 'contributor'));
            ALTER TABLE lessons ADD COLUMN published_stable_id TEXT;
            ALTER TABLE lessons ADD COLUMN published_version TEXT;
            ALTER TABLE lessons ADD COLUMN published_checksum TEXT;
            ALTER TABLE lessons ADD COLUMN published_installed_at TEXT;
            CREATE UNIQUE INDEX lessons_published_stable_id_idx
              ON lessons(published_stable_id) WHERE published_stable_id IS NOT NULL;
            "#,
        )?;
    }

    Ok(())
}

fn run_migration(conn: &Connection, version: i64, sql: &str) -> Result<()> {
    let tx = conn.unchecked_transaction()?;
    tx.execute_batch(sql)
        .with_context(|| format!("failed to apply SQLite migration {version}"))?;
    tx.execute(
        "INSERT INTO schema_migrations(version, applied_at) VALUES (?1, datetime('now'))",
        [version],
    )
    .with_context(|| format!("failed to record SQLite migration {version}"))?;
    tx.commit()
        .with_context(|| format!("failed to commit SQLite migration {version}"))?;
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn failed_migration_rolls_back_schema_and_version() {
        let conn = Connection::open_in_memory().expect("open database");
        conn.execute_batch(
            r#"
            CREATE TABLE schema_migrations (
              version INTEGER PRIMARY KEY,
              applied_at TEXT NOT NULL
            );
            "#,
        )
        .expect("create migrations table");

        let result = run_migration(
            &conn,
            99,
            r#"
            CREATE TABLE migration_atomicity_check (id TEXT PRIMARY KEY);
            CREATE TABLE migration_atomicity_check (id TEXT PRIMARY KEY);
            "#,
        );

        assert!(result.is_err());
        let table_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'migration_atomicity_check'",
                [],
                |row| row.get(0),
            )
            .expect("query sqlite_master");
        let version_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM schema_migrations WHERE version = 99",
                [],
                |row| row.get(0),
            )
            .expect("query schema version");

        assert_eq!(table_exists, 0);
        assert_eq!(version_exists, 0);
    }
}
