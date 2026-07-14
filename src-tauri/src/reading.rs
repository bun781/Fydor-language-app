// Read-only Tauri command for the /reading workbench: returns the minimal analysis
// inputs (lexicon surfaces, graded item states, remembered-sentence fallback keys) so
// large libraries do not require loading every full lesson in the frontend. Knowledge
// inference itself lives in lib/reading/analyzer.ts (deriveReadingKnowledge).
use crate::{
    db,
    models::{ReadingInputs, ReadingItemStateInput, ReadingLexiconInput},
};
use anyhow::Result;
use rusqlite::Connection;
use std::collections::HashMap;
use tauri::State;

#[tauri::command]
pub fn get_reading_inputs(state: State<db::AppState>) -> Result<ReadingInputs, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    get_reading_inputs_inner(&conn).map_err(|err| err.to_string())
}

fn get_reading_inputs_inner(conn: &Connection) -> Result<ReadingInputs> {
    Ok(ReadingInputs {
        lexicon: get_lexicon(conn)?,
        item_states: get_item_states(conn)?,
        remembered_sentence_keys: get_remembered_sentence_keys(conn)?,
    })
}

fn get_lexicon(conn: &Connection) -> Result<Vec<ReadingLexiconInput>> {
    let arm = |link_table: &str, item_column: &str| {
        format!(
            "SELECT li.type, li.canonical_key, li.display_text, li.meaning, link.surface_text
             FROM learning_items li
             JOIN {link_table} link ON link.{item_column} = li.id"
        )
    };
    let sql = format!(
        "{} UNION ALL {} UNION ALL {}",
        arm("sentence_vocabulary_links", "vocabulary_item_id"),
        arm("sentence_grammar_links", "grammar_item_id"),
        arm("sentence_chunk_links", "chunk_item_id"),
    );

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, Option<String>>(3)?,
            row.get::<_, String>(4)?,
        ))
    })?;

    let mut entries: HashMap<(String, String), ReadingLexiconInput> = HashMap::new();
    let mut order: Vec<(String, String)> = Vec::new();
    for row in rows {
        let (item_type, canonical_key, display_text, meaning, surface_text) = row?;
        let key = (item_type.clone(), canonical_key.clone());
        let entry = entries.entry(key.clone()).or_insert_with(|| {
            order.push(key);
            ReadingLexiconInput {
                item_type,
                canonical_key,
                display_text: display_text.clone(),
                meaning: None,
                surfaces: vec![display_text],
            }
        });
        if entry.meaning.is_none() {
            entry.meaning = meaning;
        }
        if !entry.surfaces.contains(&surface_text) {
            entry.surfaces.push(surface_text);
        }
    }

    Ok(order
        .into_iter()
        .filter_map(|key| entries.remove(&key))
        .collect())
}

fn get_item_states(conn: &Connection) -> Result<Vec<ReadingItemStateInput>> {
    let mut stmt = conn.prepare(
        "SELECT li.type, li.canonical_key, irs.repetitions
         FROM item_review_states irs
         JOIN learning_items li ON li.id = irs.learning_item_id
         ORDER BY li.canonical_key ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(ReadingItemStateInput {
            item_type: row.get(0)?,
            canonical_key: row.get(1)?,
            repetitions: row.get(2)?,
        })
    })?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(Into::into)
}

fn get_remembered_sentence_keys(conn: &Connection) -> Result<Vec<String>> {
    let arm = |link_table: &str, item_column: &str| {
        format!(
            "SELECT li.canonical_key
             FROM learning_items li
             JOIN {link_table} link ON link.{item_column} = li.id
             JOIN sentences s ON s.id = link.sentence_id
             WHERE s.review_state = 'remembered'"
        )
    };
    let sql = format!(
        "{} UNION {} UNION {} ORDER BY 1",
        arm("sentence_vocabulary_links", "vocabulary_item_id"),
        arm("sentence_grammar_links", "grammar_item_id"),
        arm("sentence_chunk_links", "chunk_item_id"),
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(Into::into)
}

#[cfg(test)]
mod tests {
    use super::get_reading_inputs_inner;
    use rusqlite::Connection;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("open in-memory database");
        conn.pragma_update(None, "foreign_keys", "ON")
            .expect("enable foreign keys");
        crate::db::migrate(&conn).expect("run migrations");
        conn
    }

    fn seed(conn: &Connection) {
        conn.execute_batch(
            r#"
            INSERT INTO lessons (id, target_language, base_language, title, source_hash, imported_at, created_at, updated_at)
            VALUES ('lesson-1', 'ko', 'en', 'Lesson 1', 'hash-1', '2026-07-01', '2026-07-01', '2026-07-01');

            INSERT INTO learning_items (id, language, type, canonical_key, display_text, meaning, created_at, updated_at)
            VALUES ('item-1', 'ko', 'word', 'ko:학생', '학생', 'student', '2026-07-01', '2026-07-01'),
                   ('item-2', 'ko', 'grammar', 'ko:이에요', 'N + 이에요', 'to be', '2026-07-01', '2026-07-01'),
                   ('item-3', 'ko', 'word', 'ko:왔어요', '왔어요', NULL, '2026-07-01', '2026-07-01');

            INSERT INTO sentences (id, lesson_id, language, text, normalized_text, translation, review_state, created_at, updated_at)
            VALUES ('sent-1', 'lesson-1', 'ko', '저는 학생이에요.', '저는 학생이에요.', 'I am a student.', 'remembered', '2026-07-01', '2026-07-01'),
                   ('sent-2', 'lesson-1', 'ko', '학생 왔어요.', '학생 왔어요.', 'The student came.', 'unknown', '2026-07-01', '2026-07-01');

            INSERT INTO sentence_vocabulary_links (id, sentence_id, vocabulary_item_id, surface_text, created_at, updated_at)
            VALUES ('link-1', 'sent-1', 'item-1', '학생', '2026-07-01', '2026-07-01'),
                   ('link-2', 'sent-2', 'item-1', '학생', '2026-07-01', '2026-07-01'),
                   ('link-3', 'sent-2', 'item-3', '왔어요', '2026-07-01', '2026-07-01');

            INSERT INTO sentence_grammar_links (id, sentence_id, grammar_item_id, surface_text, created_at, updated_at)
            VALUES ('link-4', 'sent-1', 'item-2', '이에요', '2026-07-01', '2026-07-01');
            "#,
        )
        .expect("seed reading data");
    }

    #[test]
    fn lexicon_aggregates_surfaces_per_canonical_item_without_full_lessons() {
        let conn = test_conn();
        seed(&conn);

        let inputs = get_reading_inputs_inner(&conn).expect("load reading inputs");

        assert_eq!(inputs.lexicon.len(), 3);
        let word = inputs
            .lexicon
            .iter()
            .find(|entry| entry.canonical_key == "ko:학생")
            .expect("word entry");
        assert_eq!(word.item_type, "word");
        assert_eq!(word.meaning.as_deref(), Some("student"));
        assert!(word.surfaces.contains(&"학생".to_string()));

        let grammar = inputs
            .lexicon
            .iter()
            .find(|entry| entry.canonical_key == "ko:이에요")
            .expect("grammar entry");
        // Both the pattern (display text) and the surface form must be matchable.
        assert!(grammar.surfaces.contains(&"N + 이에요".to_string()));
        assert!(grammar.surfaces.contains(&"이에요".to_string()));
    }

    #[test]
    fn item_states_reflect_graded_item_review_rows() {
        let conn = test_conn();
        seed(&conn);
        conn.execute(
            "INSERT INTO item_review_states (id, learning_item_id, due_at, last_reviewed_at, repetitions, lapses, difficulty, stability, scheduler_engine, created_at, updated_at)
             VALUES ('irs-1', 'item-1', '2026-07-10', '2026-07-07', 2, 0, 0.3, 5.0, 'fsrs', '2026-07-07', '2026-07-07')",
            [],
        )
        .expect("insert item state");

        let inputs = get_reading_inputs_inner(&conn).expect("load reading inputs");

        assert_eq!(inputs.item_states.len(), 1);
        assert_eq!(inputs.item_states[0].canonical_key, "ko:학생");
        assert_eq!(inputs.item_states[0].repetitions, 2);
    }

    #[test]
    fn remembered_sentence_keys_cover_only_remembered_sentences() {
        let conn = test_conn();
        seed(&conn);

        let inputs = get_reading_inputs_inner(&conn).expect("load reading inputs");

        // sent-1 (remembered) links 학생 and 이에요; sent-2 (unknown) is excluded, so
        // 왔어요 stays out even though it is in the lexicon.
        assert_eq!(
            inputs.remembered_sentence_keys,
            vec!["ko:이에요".to_string(), "ko:학생".to_string()]
        );
    }
}
