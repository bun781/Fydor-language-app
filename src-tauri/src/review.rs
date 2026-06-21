use crate::{db, models::ReviewSentence};
use anyhow::Result;
use rusqlite::{params, Connection, OptionalExtension};
use tauri::State;

#[tauri::command]
pub fn get_review_queue(state: State<db::AppState>) -> Result<Vec<ReviewSentence>, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    get_review_queue_inner(&conn).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn update_review_item(
    sentence_id: String,
    decision: String,
    state: State<db::AppState>,
) -> Result<ReviewSentence, String> {
    if decision != "remembered" && decision != "forgotten" {
        return Err("Missing sentenceId or valid review decision.".to_string());
    }

    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let current = get_sentence(&conn, &sentence_id)
        .map_err(|err| err.to_string())?
        .ok_or_else(|| "Sentence not found.".to_string())?;

    let next_streak = if decision == "remembered" {
        current.review_streak + 1
    } else {
        0
    };
    let reviewed_at = db::now();

    conn.execute(
        "UPDATE sentences SET review_state = ?1, review_streak = ?2, reviewed_at = ?3, updated_at = ?3 WHERE id = ?4",
        params![decision, next_streak, reviewed_at, sentence_id],
    )
    .map_err(|err| err.to_string())?;

    get_sentence(&conn, &sentence_id)
        .map_err(|err| err.to_string())?
        .ok_or_else(|| "Sentence not found.".to_string())
}

fn get_review_queue_inner(conn: &Connection) -> Result<Vec<ReviewSentence>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT id, language, text, translation, review_state, review_streak, reviewed_at
        FROM sentences
        ORDER BY text ASC
        "#,
    )?;

    let rows = stmt.query_map([], map_review_sentence)?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(Into::into)
}

fn get_sentence(conn: &Connection, sentence_id: &str) -> Result<Option<ReviewSentence>> {
    conn.query_row(
        r#"
        SELECT id, language, text, translation, review_state, review_streak, reviewed_at
        FROM sentences
        WHERE id = ?1
        "#,
        [sentence_id],
        map_review_sentence,
    )
    .optional()
    .map_err(Into::into)
}

fn map_review_sentence(row: &rusqlite::Row<'_>) -> rusqlite::Result<ReviewSentence> {
    Ok(ReviewSentence {
        id: row.get(0)?,
        language: row.get(1)?,
        text: row.get(2)?,
        translation: row.get(3)?,
        review_state: row.get(4)?,
        review_streak: row.get(5)?,
        reviewed_at: row.get(6)?,
    })
}
