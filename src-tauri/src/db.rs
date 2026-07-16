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

    if current < 7 {
        run_migration(
            conn,
            7,
            r#"
            CREATE TABLE packs (
              id TEXT PRIMARY KEY,
              stable_id TEXT NOT NULL UNIQUE,
              title TEXT NOT NULL,
              description TEXT,
              author_name TEXT,
              organization TEXT,
              author_url TEXT,
              language TEXT NOT NULL DEFAULT '',
              base_language TEXT NOT NULL DEFAULT '',
              level TEXT,
              tags TEXT NOT NULL DEFAULT '[]',
              version TEXT NOT NULL DEFAULT '1.0.0',
              license TEXT,
              source_type TEXT NOT NULL DEFAULT 'personal',
              archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );
            CREATE INDEX packs_archived_idx ON packs(archived);
            ALTER TABLE lessons ADD COLUMN pack_id TEXT;
            ALTER TABLE lessons ADD COLUMN pack_position INTEGER;
            INSERT INTO packs
              (id, stable_id, title, description, language, base_language, source_type, created_at, updated_at)
            VALUES
              ('personal-unsorted', 'personal-unsorted', 'Personal / Unsorted', 'Lessons without a dedicated pack.', '', '', 'personal', datetime('now'), datetime('now'));
            UPDATE lessons
            SET pack_id = 'personal-unsorted',
                pack_position = (
                  SELECT COUNT(*) FROM lessons later
                  WHERE later.imported_at < lessons.imported_at
                     OR (later.imported_at = lessons.imported_at AND later.id < lessons.id)
                )
            WHERE pack_id IS NULL;
            CREATE INDEX lessons_pack_idx ON lessons(pack_id, pack_position);
            "#,
        )?;
    }

    if current < 8 {
        // Earlier releases created missing review rows as a side effect of opening
        // the queue. Backfill once during migration so reads remain read-only.
        run_migration(
            conn,
            8,
            r#"
            INSERT OR IGNORE INTO review_items
            (id, sentence_id, lesson_id, import_id, due_at, last_reviewed_at, repetitions, lapses, difficulty, stability, recall_mode, scheduler_engine, created_at, updated_at)
            SELECT
              lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
              id, lesson_id, lesson_id, COALESCE(reviewed_at, datetime('now')), reviewed_at,
              review_streak, CASE WHEN review_state = 'forgotten' THEN 1 ELSE 0 END,
              0.3, review_streak, 'full_support', 'fixed-interval', datetime('now'), datetime('now')
            FROM sentences;
            "#,
        )?;
    }

    if current < 9 {
        // Language identity is deliberately separate from display strings.  Legacy
        // values are retained on lessons for export compatibility, while all new
        // scoping uses these canonical records and directional pairs.
        run_migration(
            conn,
            9,
            r#"
            CREATE TABLE languages (
              id TEXT PRIMARY KEY,
              code TEXT NOT NULL UNIQUE,
              name TEXT NOT NULL,
              is_unknown INTEGER NOT NULL DEFAULT 0 CHECK (is_unknown IN (0, 1)),
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );
            INSERT INTO languages (id, code, name, is_unknown, created_at, updated_at)
              VALUES ('language-unknown', 'und', 'Unknown Language', 1, datetime('now'), datetime('now'));
            INSERT OR IGNORE INTO languages (id, code, name, created_at, updated_at)
              SELECT 'language:' || lower(trim(target_language)), lower(trim(target_language)), trim(target_language), datetime('now'), datetime('now')
              FROM lessons WHERE trim(target_language) <> '';
            INSERT OR IGNORE INTO languages (id, code, name, created_at, updated_at)
              SELECT 'language:' || lower(trim(base_language)), lower(trim(base_language)), trim(base_language), datetime('now'), datetime('now')
              FROM lessons WHERE trim(base_language) <> '';
            CREATE TABLE language_pairs (
              id TEXT PRIMARY KEY,
              target_language_id TEXT NOT NULL REFERENCES languages(id) ON DELETE RESTRICT,
              base_language_id TEXT NOT NULL REFERENCES languages(id) ON DELETE RESTRICT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              UNIQUE(target_language_id, base_language_id)
            );
            INSERT INTO language_pairs (id, target_language_id, base_language_id, created_at, updated_at)
              VALUES ('pair:language-unknown:language-unknown', 'language-unknown', 'language-unknown', datetime('now'), datetime('now'));
            ALTER TABLE lessons ADD COLUMN language_pair_id TEXT REFERENCES language_pairs(id);
            INSERT OR IGNORE INTO language_pairs (id, target_language_id, base_language_id, created_at, updated_at)
              SELECT 'pair:' || COALESCE(t.id, 'language-unknown') || ':' || COALESCE(b.id, 'language-unknown'),
                     COALESCE(t.id, 'language-unknown'), COALESCE(b.id, 'language-unknown'), datetime('now'), datetime('now')
              FROM lessons l
              LEFT JOIN languages t ON t.code = lower(trim(l.target_language))
              LEFT JOIN languages b ON b.code = lower(trim(l.base_language));
            UPDATE lessons SET language_pair_id = (
              SELECT p.id FROM language_pairs p
              JOIN languages t ON t.id = p.target_language_id
              JOIN languages b ON b.id = p.base_language_id
              WHERE t.code = COALESCE(NULLIF(lower(trim(lessons.target_language)), ''), 'und')
                AND b.code = COALESCE(NULLIF(lower(trim(lessons.base_language)), ''), 'und')
            );
            CREATE INDEX lessons_language_pair_idx ON lessons(language_pair_id);
            INSERT OR REPLACE INTO user_settings(key, value, updated_at)
              SELECT 'active_language_pair_id', COALESCE((SELECT language_pair_id FROM lessons ORDER BY imported_at DESC LIMIT 1), 'pair:language-unknown:language-unknown'), datetime('now')
              WHERE NOT EXISTS (SELECT 1 FROM user_settings WHERE key = 'active_language_pair_id');
        "#,
        )?;
    }

    if current < 10 {
        run_migration(
            conn,
            10,
            r#"
            CREATE TABLE courses (
              id TEXT PRIMARY KEY,
              language_pair_id TEXT NOT NULL REFERENCES language_pairs(id) ON DELETE RESTRICT,
              title TEXT NOT NULL,
              description TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );
            CREATE INDEX courses_language_pair_idx ON courses(language_pair_id);
            CREATE TABLE course_units (
              id TEXT PRIMARY KEY,
              course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
              title TEXT NOT NULL,
              description TEXT,
              position INTEGER NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              UNIQUE(course_id, position)
            );
            CREATE TABLE unit_lessons (
              unit_id TEXT NOT NULL REFERENCES course_units(id) ON DELETE CASCADE,
              lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
              position INTEGER NOT NULL,
              created_at TEXT NOT NULL,
              PRIMARY KEY(unit_id, lesson_id), UNIQUE(unit_id, position)
            );
            CREATE INDEX unit_lessons_lesson_idx ON unit_lessons(lesson_id);
            CREATE TABLE course_lessons (
              course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
              lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
              position INTEGER NOT NULL,
              created_at TEXT NOT NULL,
              PRIMARY KEY(course_id, lesson_id), UNIQUE(course_id, position)
            );
            CREATE TABLE collections (
              id TEXT PRIMARY KEY,
              language_pair_id TEXT NOT NULL REFERENCES language_pairs(id) ON DELETE RESTRICT,
              title TEXT NOT NULL,
              kind TEXT NOT NULL CHECK (kind IN ('manual', 'smart')),
              query_json TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );
            CREATE TABLE collection_lessons (
              collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
              lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
              position INTEGER NOT NULL,
              created_at TEXT NOT NULL,
              PRIMARY KEY(collection_id, lesson_id), UNIQUE(collection_id, position)
            );
        "#,
        )?;
    }

    if current < 11 {
        // These nullable additions preserve every historical event verbatim. New
        // writes populate the normalized response while legacy grade remains the
        // compatibility field used by existing clients.
        run_migration(
            conn,
            11,
            r#"
            ALTER TABLE review_events ADD COLUMN response TEXT;
            ALTER TABLE review_events ADD COLUMN hint_used INTEGER NOT NULL DEFAULT 0 CHECK (hint_used IN (0, 1));
            ALTER TABLE review_events ADD COLUMN session_id TEXT;
            ALTER TABLE review_events ADD COLUMN mode TEXT;
            ALTER TABLE review_events ADD COLUMN language_pair_id TEXT REFERENCES language_pairs(id);
            CREATE INDEX review_events_pair_reviewed_idx ON review_events(language_pair_id, reviewed_at);
            CREATE TABLE annotation_aliases (
              id TEXT PRIMARY KEY, learning_item_id TEXT NOT NULL REFERENCES learning_items(id) ON DELETE CASCADE,
              alias_key TEXT NOT NULL, language_pair_id TEXT REFERENCES language_pairs(id) ON DELETE CASCADE,
              created_at TEXT NOT NULL, UNIQUE(learning_item_id, alias_key, language_pair_id)
            );
            CREATE INDEX annotation_aliases_lookup_idx ON annotation_aliases(alias_key, language_pair_id);
            CREATE TABLE annotation_provenance (
              learning_item_id TEXT PRIMARY KEY REFERENCES learning_items(id) ON DELETE CASCADE,
              source_lesson_id TEXT REFERENCES lessons(id) ON DELETE SET NULL,
              source_sentence_id TEXT REFERENCES sentences(id) ON DELETE SET NULL,
              reuse_eligible INTEGER NOT NULL DEFAULT 1 CHECK (reuse_eligible IN (0, 1)),
              promoted_at TEXT, updated_at TEXT NOT NULL
            );
            CREATE TABLE annotation_suppressions (
              language_pair_id TEXT NOT NULL REFERENCES language_pairs(id) ON DELETE CASCADE,
              normalized_text TEXT NOT NULL, item_type TEXT NOT NULL,
              created_at TEXT NOT NULL, PRIMARY KEY(language_pair_id, normalized_text, item_type)
            );
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
