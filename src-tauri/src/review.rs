// Tauri commands for the review system: get_review_queue, update_review_item, reset_review_progress.
// This file is the ONLY implementation of review scheduling (fixed-interval and FSRS);
// the client never computes intervals. The grade/recall-mode semantics shared with the
// frontend are pinned by tests/fixtures/review-grade-contract.json.
use crate::{
    db,
    models::{
        ReviewDayActivity, ReviewItemTarget, ReviewMasteryStats, ReviewProgressSnapshot,
        ReviewSentence,
    },
};
use anyhow::Result;
use chrono::{DateTime, Duration, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Deserialize;
use std::collections::HashMap;
use tauri::State;

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ReviewResetScope {
    Lesson {
        #[serde(rename = "lessonId")]
        lesson_id: String,
    },
    Sentence {
        #[serde(rename = "sentenceId")]
        sentence_id: String,
    },
    Item {
        #[serde(rename = "itemType")]
        item_type: String,
        #[serde(rename = "canonicalKey")]
        canonical_key: String,
        #[serde(rename = "lessonId")]
        lesson_id: Option<String>,
    },
}

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
    let grade = normalize_grade(&decision)
        .ok_or_else(|| "Missing sentenceId or valid review decision.".to_string())?;

    let mut conn = state.conn.lock().map_err(|err| err.to_string())?;
    update_review_item_inner(&mut conn, &sentence_id, &grade).map_err(|err| err.to_string())
}

fn update_review_item_inner(
    conn: &mut Connection,
    sentence_id: &str,
    grade: &str,
) -> Result<ReviewSentence> {
    ensure_review_items(conn)?;
    let current =
        get_sentence(conn, sentence_id)?.ok_or_else(|| anyhow::anyhow!("Sentence not found."))?;

    let reviewed_at = db::now();
    let mut scheduler_state = SchedulerState::from(&current);
    let was_new = is_new_card(&scheduler_state);
    if was_new {
        scheduler_state.scheduler_engine = NEW_CARD_SCHEDULER_ENGINE.to_string();
    }
    let schedule = schedule_review(&scheduler_state, grade, &reviewed_at);
    let review_state = legacy_review_state(grade);
    let review_streak = if grade == "remembered" || grade == "easy" {
        current.review_streak + 1
    } else if grade == "forgot" {
        0
    } else {
        current.review_streak
    };
    let recall_mode = next_recall_mode(&current.recall_mode, grade);

    let tx = conn.transaction()?;
    tx.execute(
        r#"
        INSERT INTO review_items
        (id, sentence_id, lesson_id, import_id, due_at, last_reviewed_at, repetitions, lapses, difficulty, stability, recall_mode, scheduler_engine, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?5, ?5)
        ON CONFLICT(sentence_id) DO UPDATE SET
          lesson_id = excluded.lesson_id,
          import_id = excluded.import_id,
          due_at = excluded.due_at,
          last_reviewed_at = excluded.last_reviewed_at,
          repetitions = excluded.repetitions,
          lapses = excluded.lapses,
          difficulty = excluded.difficulty,
          stability = excluded.stability,
          recall_mode = excluded.recall_mode,
          scheduler_engine = excluded.scheduler_engine,
          updated_at = excluded.updated_at
        "#,
        params![
            db::id(),
            sentence_id,
            current.lesson_id,
            schedule.due_at,
            reviewed_at,
            schedule.repetitions,
            schedule.lapses,
            schedule.difficulty,
            schedule.stability,
            recall_mode,
            scheduler_state.scheduler_engine,
        ],
    )?;

    tx.execute(
        "UPDATE sentences SET review_state = ?1, review_streak = ?2, reviewed_at = ?3, updated_at = ?3 WHERE id = ?4",
        params![review_state, review_streak, reviewed_at, sentence_id],
    )?;
    record_review_event(&tx, "sentence", sentence_id, grade, was_new, &reviewed_at)?;
    tx.commit()?;

    get_sentence(conn, sentence_id)?.ok_or_else(|| anyhow::anyhow!("Sentence not found."))
}

#[tauri::command]
pub fn reset_review_progress(
    scope: ReviewResetScope,
    state: State<db::AppState>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    ensure_review_items(&conn).map_err(|err| err.to_string())?;

    match scope {
        ReviewResetScope::Lesson { lesson_id } => reset_lesson_progress(&conn, &lesson_id),
        ReviewResetScope::Sentence { sentence_id } => {
            reset_sentences_progress(&conn, &[sentence_id])
        }
        ReviewResetScope::Item {
            item_type,
            canonical_key,
            lesson_id,
        } => {
            let sentence_ids =
                get_item_sentence_ids(&conn, &item_type, &canonical_key, lesson_id.as_deref())
                    .map_err(|err| err.to_string())?;
            reset_sentences_progress(&conn, &sentence_ids)
                .and_then(|()| reset_item_review_state(&conn, &item_type, &canonical_key))
        }
    }
    .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn get_item_review_targets(
    state: State<db::AppState>,
) -> Result<Vec<ReviewItemTarget>, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    get_item_review_targets_inner(&conn, None).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn update_item_review(
    learning_item_id: String,
    decision: String,
    state: State<db::AppState>,
) -> Result<ReviewItemTarget, String> {
    let grade = normalize_grade(&decision)
        .ok_or_else(|| "Missing learningItemId or valid review decision.".to_string())?;
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    update_item_review_inner(&conn, &learning_item_id, &grade).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn get_review_progress(state: State<db::AppState>) -> Result<ReviewProgressSnapshot, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    get_review_progress_inner(&conn).map_err(|err| err.to_string())
}

// FSRS default policy: cards graded for the first time (no prior review on their row)
// are scheduled with FSRS from that grade onward. Rows that already have review history
// keep whatever engine they were using, so existing fixed-interval schedules are never
// reinterpreted on the FSRS scale.
const NEW_CARD_SCHEDULER_ENGINE: &str = "fsrs";

// A card counts toward mastery once it has been successfully recalled this many times.
const MASTERED_REPETITIONS: i64 = 5;

fn is_new_card(state: &SchedulerState) -> bool {
    state.repetitions == 0 && state.lapses == 0 && state.last_reviewed_at.is_none()
}

fn record_review_event(
    conn: &Connection,
    target_kind: &str,
    target_id: &str,
    grade: &str,
    was_new: bool,
    reviewed_at: &str,
) -> Result<()> {
    conn.execute(
        "INSERT INTO review_events (id, target_kind, target_id, grade, was_new, reviewed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            db::id(),
            target_kind,
            target_id,
            grade,
            was_new as i64,
            reviewed_at
        ],
    )?;
    Ok(())
}

fn get_review_progress_inner(conn: &Connection) -> Result<ReviewProgressSnapshot> {
    let mut stmt = conn.prepare(
        r#"
        SELECT date(reviewed_at, 'localtime') AS day, COUNT(*), COALESCE(SUM(was_new), 0)
        FROM review_events
        GROUP BY day
        ORDER BY day ASC
        "#,
    )?;
    let daily_activity = stmt
        .query_map([], |row| {
            Ok(ReviewDayActivity {
                day: row.get(0)?,
                reviews: row.get(1)?,
                new_cards: row.get(2)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    // Item mastery is measured over reviewable items only (items with at least one
    // sentence example), matching what get_item_review_targets can actually serve.
    let item_total: i64 = conn.query_row(
        r#"
        SELECT COUNT(*) FROM learning_items WHERE id IN (
          SELECT vocabulary_item_id FROM sentence_vocabulary_links
          UNION SELECT grammar_item_id FROM sentence_grammar_links
          UNION SELECT chunk_item_id FROM sentence_chunk_links
        )
        "#,
        [],
        |row| row.get(0),
    )?;
    let item_graded: i64 =
        conn.query_row("SELECT COUNT(*) FROM item_review_states", [], |row| {
            row.get(0)
        })?;
    let item_mastered: i64 = conn.query_row(
        "SELECT COUNT(*) FROM item_review_states WHERE repetitions >= ?1",
        [MASTERED_REPETITIONS],
        |row| row.get(0),
    )?;

    let sentence_total: i64 =
        conn.query_row("SELECT COUNT(*) FROM sentences", [], |row| row.get(0))?;
    let sentence_graded: i64 = conn.query_row(
        "SELECT COUNT(*) FROM review_items WHERE last_reviewed_at IS NOT NULL",
        [],
        |row| row.get(0),
    )?;
    let sentence_mastered: i64 = conn.query_row(
        "SELECT COUNT(*) FROM review_items WHERE repetitions >= ?1",
        [MASTERED_REPETITIONS],
        |row| row.get(0),
    )?;

    Ok(ReviewProgressSnapshot {
        daily_activity,
        item_stats: ReviewMasteryStats {
            total: item_total,
            graded: item_graded,
            mastered: item_mastered,
        },
        sentence_stats: ReviewMasteryStats {
            total: sentence_total,
            graded: sentence_graded,
            mastered: sentence_mastered,
        },
    })
}

// Items are reviewed through their best sentence example: the linked sentence with the
// fewest competing annotations, tie-broken by shorter text then sentence id. Items with no
// sentence examples are not returned — there is nothing to review them through.
fn get_item_review_targets_inner(
    conn: &Connection,
    learning_item_id: Option<&str>,
) -> Result<Vec<ReviewItemTarget>> {
    let filter = if learning_item_id.is_some() {
        "AND li.id = ?2"
    } else {
        ""
    };
    let arm = |link_table: &str, item_column: &str, item_type: &str| {
        format!(
            r#"
            SELECT
              li.id, li.type, li.canonical_key, li.display_text, li.meaning, li.explanation, li.language,
              COALESCE(irs.due_at, ?1), irs.last_reviewed_at,
              COALESCE(irs.repetitions, 0), COALESCE(irs.lapses, 0),
              COALESCE(irs.difficulty, 0.3), COALESCE(irs.stability, 0),
              COALESCE(irs.scheduler_engine, 'fixed-interval'),
              s.id, s.text, s.translation, link.surface_text,
              (SELECT COUNT(*) FROM sentence_vocabulary_links x WHERE x.sentence_id = s.id)
                + (SELECT COUNT(*) FROM sentence_grammar_links x WHERE x.sentence_id = s.id)
                + (SELECT COUNT(*) FROM sentence_chunk_links x WHERE x.sentence_id = s.id)
            FROM learning_items li
            JOIN {link_table} link ON link.{item_column} = li.id
            JOIN sentences s ON s.id = link.sentence_id
            LEFT JOIN item_review_states irs ON irs.learning_item_id = li.id
            WHERE li.type = '{item_type}' {filter}
            "#
        )
    };
    let sql = format!(
        "{} UNION ALL {} UNION ALL {}",
        arm("sentence_vocabulary_links", "vocabulary_item_id", "word"),
        arm("sentence_grammar_links", "grammar_item_id", "grammar"),
        arm("sentence_chunk_links", "chunk_item_id", "chunk"),
    );

    let now = db::now();
    let mut stmt = conn.prepare(&sql)?;
    let map_row = |row: &rusqlite::Row<'_>| -> rusqlite::Result<(ReviewItemTarget, i64)> {
        Ok((
            ReviewItemTarget {
                id: row.get(0)?,
                item_type: row.get(1)?,
                canonical_key: row.get(2)?,
                display_text: row.get(3)?,
                meaning: row.get(4)?,
                explanation: row.get(5)?,
                language: row.get(6)?,
                due_at: row.get(7)?,
                last_reviewed_at: row.get(8)?,
                repetitions: row.get(9)?,
                lapses: row.get(10)?,
                difficulty: row.get(11)?,
                stability: row.get(12)?,
                scheduler_engine: row.get(13)?,
                example_sentence_id: row.get(14)?,
                example_text: row.get(15)?,
                example_translation: row.get(16)?,
                example_surface_text: row.get(17)?,
                example_count: 0,
            },
            row.get(18)?,
        ))
    };
    let rows = if let Some(item_id) = learning_item_id {
        stmt.query_map(params![now, item_id], map_row)?
            .collect::<rusqlite::Result<Vec<_>>>()?
    } else {
        stmt.query_map(params![now], map_row)?
            .collect::<rusqlite::Result<Vec<_>>>()?
    };

    let mut targets: HashMap<String, (ReviewItemTarget, i64)> = HashMap::new();
    let mut example_sentences: HashMap<String, std::collections::HashSet<String>> = HashMap::new();
    for (candidate, annotation_count) in rows {
        example_sentences
            .entry(candidate.id.clone())
            .or_default()
            .insert(candidate.example_sentence_id.clone());

        match targets.get_mut(&candidate.id) {
            None => {
                targets.insert(candidate.id.clone(), (candidate, annotation_count));
            }
            Some((best, best_count)) => {
                let better = annotation_count < *best_count
                    || (annotation_count == *best_count
                        && (
                            candidate.example_text.chars().count(),
                            &candidate.example_sentence_id,
                        ) < (best.example_text.chars().count(), &best.example_sentence_id));
                if better {
                    *best = candidate;
                    *best_count = annotation_count;
                }
            }
        }
    }

    let mut result: Vec<ReviewItemTarget> = targets
        .into_values()
        .map(|(mut target, _)| {
            target.example_count = example_sentences
                .get(&target.id)
                .map(|sentences| sentences.len() as i64)
                .unwrap_or(0);
            target
        })
        .collect();
    result.sort_by(|a, b| {
        a.due_at
            .cmp(&b.due_at)
            .then_with(|| a.canonical_key.cmp(&b.canonical_key))
    });
    Ok(result)
}

fn update_item_review_inner(
    conn: &Connection,
    learning_item_id: &str,
    grade: &str,
) -> Result<ReviewItemTarget> {
    let current = get_item_review_targets_inner(conn, Some(learning_item_id))?
        .into_iter()
        .next()
        .ok_or_else(|| anyhow::anyhow!("Learning item not found or has no sentence examples."))?;

    let reviewed_at = db::now();
    let mut scheduler_state = SchedulerState::from(&current);
    let was_new = is_new_card(&scheduler_state);
    if was_new {
        scheduler_state.scheduler_engine = NEW_CARD_SCHEDULER_ENGINE.to_string();
    }
    let schedule = schedule_review(&scheduler_state, grade, &reviewed_at);
    conn.execute(
        r#"
        INSERT INTO item_review_states
        (id, learning_item_id, due_at, last_reviewed_at, repetitions, lapses, difficulty, stability, scheduler_engine, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?4, ?4)
        ON CONFLICT(learning_item_id) DO UPDATE SET
          due_at = excluded.due_at,
          last_reviewed_at = excluded.last_reviewed_at,
          repetitions = excluded.repetitions,
          lapses = excluded.lapses,
          difficulty = excluded.difficulty,
          stability = excluded.stability,
          scheduler_engine = excluded.scheduler_engine,
          updated_at = excluded.updated_at
        "#,
        params![
            db::id(),
            learning_item_id,
            schedule.due_at,
            reviewed_at,
            schedule.repetitions,
            schedule.lapses,
            schedule.difficulty,
            schedule.stability,
            scheduler_state.scheduler_engine,
        ],
    )?;
    record_review_event(conn, "item", learning_item_id, grade, was_new, &reviewed_at)?;

    get_item_review_targets_inner(conn, Some(learning_item_id))?
        .into_iter()
        .next()
        .ok_or_else(|| anyhow::anyhow!("Learning item not found after review update."))
}

// Deleting the row returns the item to lazy new-item defaults on the next read.
fn reset_item_review_state(conn: &Connection, item_type: &str, canonical_key: &str) -> Result<()> {
    conn.execute(
        r#"
        DELETE FROM item_review_states
        WHERE learning_item_id IN (
          SELECT id FROM learning_items WHERE type = ?1 AND canonical_key = ?2
        )
        "#,
        params![item_type, canonical_key],
    )?;
    Ok(())
}

// Column order must match map_review_sentence.
const REVIEW_SENTENCE_SELECT: &str = r#"
    SELECT
      s.id, s.id, s.lesson_id, s.lesson_id, s.language, s.text, s.translation,
      s.review_state, s.review_streak, s.reviewed_at,
      ri.due_at, ri.last_reviewed_at, ri.repetitions, ri.lapses,
      ri.difficulty, ri.stability, ri.recall_mode, ri.scheduler_engine,
      s.focus_display_text, s.focus_meaning, s.focus_explanation
    FROM sentences s
    JOIN review_items ri ON ri.sentence_id = s.id
"#;

fn get_review_queue_inner(conn: &Connection) -> Result<Vec<ReviewSentence>> {
    ensure_review_items(conn)?;
    let mut stmt = conn.prepare(&format!(
        "{REVIEW_SENTENCE_SELECT} ORDER BY ri.due_at ASC, s.text ASC"
    ))?;
    let rows = stmt.query_map([], map_review_sentence)?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(Into::into)
}

fn get_sentence(conn: &Connection, sentence_id: &str) -> Result<Option<ReviewSentence>> {
    ensure_review_items(conn)?;
    conn.query_row(
        &format!("{REVIEW_SENTENCE_SELECT} WHERE s.id = ?1"),
        [sentence_id],
        map_review_sentence,
    )
    .optional()
    .map_err(Into::into)
}

fn reset_lesson_progress(conn: &Connection, lesson_id: &str) -> Result<()> {
    let mut stmt = conn.prepare("SELECT id FROM sentences WHERE lesson_id = ?1")?;
    let rows = stmt.query_map([lesson_id], |row| row.get::<_, String>(0))?;
    let sentence_ids = rows.collect::<rusqlite::Result<Vec<_>>>()?;
    reset_sentences_progress(conn, &sentence_ids)
}

fn reset_sentences_progress(conn: &Connection, sentence_ids: &[String]) -> Result<()> {
    let now = db::now();
    for sentence_id in sentence_ids {
        conn.execute(
            "UPDATE sentences SET review_state = 'unknown', review_streak = 0, reviewed_at = NULL, updated_at = ?1 WHERE id = ?2",
            params![now, sentence_id],
        )?;
        conn.execute(
            r#"
            UPDATE review_items
            SET due_at = ?1,
                last_reviewed_at = NULL,
                repetitions = 0,
                lapses = 0,
                difficulty = CASE WHEN scheduler_engine = 'fsrs' THEN 0 ELSE 0.3 END,
                stability = 0,
                recall_mode = 'full_support',
                updated_at = ?1
            WHERE sentence_id = ?2
            "#,
            params![now, sentence_id],
        )?;
    }
    Ok(())
}

fn get_item_sentence_ids(
    conn: &Connection,
    item_type: &str,
    canonical_key: &str,
    lesson_id: Option<&str>,
) -> Result<Vec<String>> {
    let (table, item_column) = match item_type {
        "word" => ("sentence_vocabulary_links", "vocabulary_item_id"),
        "grammar" => ("sentence_grammar_links", "grammar_item_id"),
        "chunk" => ("sentence_chunk_links", "chunk_item_id"),
        _ => return Ok(Vec::new()),
    };
    let lesson_filter = if lesson_id.is_some() {
        "AND s.lesson_id = ?3"
    } else {
        ""
    };
    let sql = format!(
        r#"
        SELECT DISTINCT s.id
        FROM sentences s
        JOIN {table} link ON link.sentence_id = s.id
        JOIN learning_items li ON li.id = link.{item_column}
        WHERE li.type = ?1 AND li.canonical_key = ?2 {lesson_filter}
        "#
    );
    let mut stmt = conn.prepare(&sql)?;
    if let Some(lesson_id) = lesson_id {
        let rows = stmt.query_map(params![item_type, canonical_key, lesson_id], |row| {
            row.get::<_, String>(0)
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    } else {
        let rows = stmt.query_map(params![item_type, canonical_key], |row| {
            row.get::<_, String>(0)
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    }
}

fn ensure_review_items(conn: &Connection) -> Result<()> {
    let now = db::now();
    conn.execute(
        r#"
        INSERT OR IGNORE INTO review_items
        (id, sentence_id, lesson_id, import_id, due_at, last_reviewed_at, repetitions, lapses, difficulty, stability, recall_mode, created_at, updated_at)
        SELECT id, id, lesson_id, lesson_id, ?1, reviewed_at, review_streak,
               CASE WHEN review_state = 'forgotten' THEN 1 ELSE 0 END,
               0.3, review_streak, 'full_support', ?1, ?1
        FROM sentences
        "#,
        [now],
    )?;
    Ok(())
}

fn map_review_sentence(row: &rusqlite::Row<'_>) -> rusqlite::Result<ReviewSentence> {
    Ok(ReviewSentence {
        id: row.get(0)?,
        sentence_id: row.get(1)?,
        lesson_id: row.get(2)?,
        import_id: row.get(3)?,
        language: row.get(4)?,
        text: row.get(5)?,
        translation: row.get(6)?,
        review_state: row.get(7)?,
        review_streak: row.get(8)?,
        reviewed_at: row.get(9)?,
        due_at: row.get(10)?,
        last_reviewed_at: row.get(11)?,
        repetitions: row.get(12)?,
        lapses: row.get(13)?,
        difficulty: row.get(14)?,
        stability: row.get(15)?,
        recall_mode: row.get(16)?,
        scheduler_engine: row.get(17)?,
        focus_text: row.get(18)?,
        focus_meaning: row.get(19)?,
        focus_explanation: row.get(20)?,
    })
}

fn normalize_grade(decision: &str) -> Option<String> {
    match decision {
        "forgot" | "forgotten" => Some("forgot".to_string()),
        "hard" => Some("hard".to_string()),
        "remembered" => Some("remembered".to_string()),
        "easy" => Some("easy".to_string()),
        _ => None,
    }
}

#[derive(Debug, PartialEq)]
struct ReviewSchedule {
    due_at: String,
    repetitions: i64,
    lapses: i64,
    difficulty: f64,
    stability: f64,
}

// The scheduling state shared by sentence review rows and item review rows. Both engines
// only need these fields, so sentence and item grading go through the same schedule_review.
struct SchedulerState {
    repetitions: i64,
    lapses: i64,
    difficulty: f64,
    stability: f64,
    last_reviewed_at: Option<String>,
    scheduler_engine: String,
}

impl From<&ReviewSentence> for SchedulerState {
    fn from(sentence: &ReviewSentence) -> Self {
        SchedulerState {
            repetitions: sentence.repetitions,
            lapses: sentence.lapses,
            difficulty: sentence.difficulty,
            stability: sentence.stability,
            last_reviewed_at: sentence.last_reviewed_at.clone(),
            scheduler_engine: sentence.scheduler_engine.clone(),
        }
    }
}

impl From<&ReviewItemTarget> for SchedulerState {
    fn from(item: &ReviewItemTarget) -> Self {
        SchedulerState {
            repetitions: item.repetitions,
            lapses: item.lapses,
            difficulty: item.difficulty,
            stability: item.stability,
            last_reviewed_at: item.last_reviewed_at.clone(),
            scheduler_engine: item.scheduler_engine.clone(),
        }
    }
}

fn schedule_review(current: &SchedulerState, grade: &str, reviewed_at: &str) -> ReviewSchedule {
    if current.scheduler_engine == "fsrs" {
        return schedule_fsrs_review(current, grade, reviewed_at);
    }

    ReviewSchedule {
        due_at: next_fixed_due_at(grade, reviewed_at),
        repetitions: if grade == "remembered" || grade == "easy" {
            current.repetitions + 1
        } else {
            current.repetitions
        },
        lapses: if grade == "forgot" {
            current.lapses + 1
        } else {
            current.lapses
        },
        difficulty: update_fixed_difficulty(current.difficulty, grade),
        stability: update_fixed_stability(current.stability, grade),
    }
}

fn next_fixed_due_at(grade: &str, reviewed_at: &str) -> String {
    let parsed = parse_utc(reviewed_at);
    let next = match grade {
        "forgot" => parsed + Duration::minutes(10),
        "hard" => parsed + Duration::days(1),
        "remembered" => parsed + Duration::days(3),
        "easy" => parsed + Duration::days(7),
        _ => parsed + Duration::days(1),
    };
    next.to_rfc3339()
}

fn schedule_fsrs_review(
    current: &SchedulerState,
    grade: &str,
    reviewed_at: &str,
) -> ReviewSchedule {
    let fsrs_grade = fsrs_grade(grade);
    let reviewed_at_date = parse_utc(reviewed_at);
    let first_review =
        current.repetitions == 0 && current.lapses == 0 && current.last_reviewed_at.is_none();

    let (difficulty, stability) = if first_review {
        (
            fsrs_initial_difficulty(fsrs_grade),
            fsrs_initial_stability(fsrs_grade),
        )
    } else {
        let last_reviewed_at = current
            .last_reviewed_at
            .as_deref()
            .map(parse_utc)
            .unwrap_or(reviewed_at_date);
        let elapsed_days =
            (reviewed_at_date - last_reviewed_at).num_seconds().max(0) as f64 / 86_400.0;
        let recall = fsrs_retrievability(current.stability, elapsed_days);
        let next_difficulty = fsrs_next_difficulty(current.difficulty, fsrs_grade);
        let next_stability = if fsrs_grade == 1 {
            fsrs_forget_stability(current.difficulty, current.stability, recall)
        } else {
            fsrs_recall_stability(current.difficulty, current.stability, recall, fsrs_grade)
        };
        (next_difficulty, next_stability)
    };

    let due_at = if fsrs_grade == 1 {
        reviewed_at_date + Duration::minutes(10)
    } else {
        reviewed_at_date + Duration::days(fsrs_next_interval_days(stability) as i64)
    };

    ReviewSchedule {
        due_at: due_at.to_rfc3339(),
        repetitions: if fsrs_grade == 1 {
            current.repetitions
        } else {
            current.repetitions + 1
        },
        lapses: if fsrs_grade == 1 {
            current.lapses + 1
        } else {
            current.lapses
        },
        difficulty: round4(difficulty),
        stability: round4(stability),
    }
}

fn legacy_review_state(grade: &str) -> String {
    match grade {
        "forgot" => "forgotten",
        "hard" => "unknown",
        _ => "remembered",
    }
    .to_string()
}

fn update_fixed_difficulty(current: f64, grade: &str) -> f64 {
    let delta = match grade {
        "forgot" => 0.18,
        "hard" => 0.08,
        "remembered" => -0.04,
        "easy" => -0.08,
        _ => 0.0,
    };
    ((current + delta).clamp(0.0, 1.0) * 100.0).round() / 100.0
}

fn update_fixed_stability(current: f64, grade: &str) -> f64 {
    let next = match grade {
        "forgot" => (current * 0.45).max(0.5),
        "hard" => (current + 0.5).max(1.0),
        "remembered" => (current + 2.0).max(3.0),
        "easy" => (current + 4.0).max(7.0),
        _ => current,
    };
    (next * 100.0).round() / 100.0
}

const FSRS_WEIGHTS: [f64; 17] = [
    0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072,
    0.0793, 0.3246, 1.587, 0.2272, 2.8755,
];
const FSRS_DECAY: f64 = -0.5;
const FSRS_FACTOR: f64 = 19.0 / 81.0;
const FSRS_REQUEST_RETENTION: f64 = 0.9;

fn fsrs_grade(grade: &str) -> i64 {
    match grade {
        "forgot" => 1,
        "hard" => 2,
        "remembered" => 3,
        "easy" => 4,
        _ => 3,
    }
}

fn fsrs_retrievability(stability: f64, elapsed_days: f64) -> f64 {
    if stability <= 0.0 {
        return 0.0;
    }
    (1.0 + (FSRS_FACTOR * elapsed_days.max(0.0)) / stability).powf(FSRS_DECAY)
}

fn fsrs_next_interval_days(stability: f64) -> i64 {
    let interval =
        (stability / FSRS_FACTOR) * (FSRS_REQUEST_RETENTION.powf(1.0 / FSRS_DECAY) - 1.0);
    interval.round().max(1.0) as i64
}

fn fsrs_initial_stability(grade: i64) -> f64 {
    FSRS_WEIGHTS[(grade - 1) as usize].max(0.1)
}

fn fsrs_initial_difficulty(grade: i64) -> f64 {
    fsrs_clamp_difficulty(FSRS_WEIGHTS[4] - (FSRS_WEIGHTS[5] * ((grade - 1) as f64)).exp() + 1.0)
}

fn fsrs_next_difficulty(difficulty: f64, grade: i64) -> f64 {
    let updated = difficulty - FSRS_WEIGHTS[6] * ((grade - 3) as f64);
    fsrs_clamp_difficulty(
        FSRS_WEIGHTS[7] * fsrs_initial_difficulty(4) + (1.0 - FSRS_WEIGHTS[7]) * updated,
    )
}

fn fsrs_recall_stability(difficulty: f64, stability: f64, recall: f64, grade: i64) -> f64 {
    let hard_penalty = if grade == 2 { FSRS_WEIGHTS[15] } else { 1.0 };
    let easy_bonus = if grade == 4 { FSRS_WEIGHTS[16] } else { 1.0 };
    stability
        * (1.0
            + FSRS_WEIGHTS[8].exp()
                * (11.0 - difficulty)
                * stability.powf(-FSRS_WEIGHTS[9])
                * ((FSRS_WEIGHTS[10] * (1.0 - recall)).exp() - 1.0)
                * hard_penalty
                * easy_bonus)
}

fn fsrs_forget_stability(difficulty: f64, stability: f64, recall: f64) -> f64 {
    let next = FSRS_WEIGHTS[11]
        * difficulty.powf(-FSRS_WEIGHTS[12])
        * ((stability + 1.0).powf(FSRS_WEIGHTS[13]) - 1.0)
        * (FSRS_WEIGHTS[14] * (1.0 - recall)).exp();
    next.min(stability).max(0.1)
}

fn fsrs_clamp_difficulty(value: f64) -> f64 {
    value.clamp(1.0, 10.0)
}

fn parse_utc(value: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(value)
        .map(|date| date.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now())
}

fn round4(value: f64) -> f64 {
    (value * 10_000.0).round() / 10_000.0
}

fn next_recall_mode(current: &str, grade: &str) -> String {
    let modes = [
        "full_support",
        "translation_hidden",
        "sentence_only",
        "fill_blank",
        "reverse_translate",
    ];
    let index = modes.iter().position(|mode| *mode == current).unwrap_or(0) as i64;
    let next_index = match grade {
        "forgot" => (index - 1).max(0),
        "hard" => index,
        "easy" => (index + 2).min((modes.len() - 1) as i64),
        _ => (index + 1).min((modes.len() - 1) as i64),
    };
    modes[next_index as usize].to_string()
}

#[cfg(test)]
mod tests {
    use super::{
        get_item_review_targets_inner, get_review_progress_inner, legacy_review_state,
        next_recall_mode, normalize_grade, reset_item_review_state, schedule_review,
        update_item_review_inner, update_review_item_inner, ReviewResetScope, SchedulerState,
    };
    use rusqlite::Connection;

    // Rust side of the Rust<->TS review contract. The same fixture is asserted from
    // tests/unit/review-contract.test.ts, so a change to either implementation fails
    // one side's suite.
    #[test]
    fn review_grade_contract_matches_shared_fixture() {
        let fixture: serde_json::Value = serde_json::from_str(include_str!(
            "../../tests/fixtures/review-grade-contract.json"
        ))
        .expect("parse contract fixture");

        let grades = fixture["grades"].as_array().expect("grades array");
        assert_eq!(grades.len(), 5);
        for case in grades {
            let decision = case["decision"].as_str().unwrap();
            let normalized = case["normalized"].as_str().unwrap();
            let legacy = case["legacyState"].as_str().unwrap();
            assert_eq!(
                normalize_grade(decision).as_deref(),
                Some(normalized),
                "normalize_grade({decision})"
            );
            assert_eq!(
                legacy_review_state(normalized),
                legacy,
                "legacy_review_state({normalized})"
            );
        }

        let transitions = fixture["recallModeProgression"]
            .as_array()
            .expect("recall array");
        assert_eq!(transitions.len(), 20);
        for case in transitions {
            let mode = case["mode"].as_str().unwrap();
            let grade = case["grade"].as_str().unwrap();
            let next = case["next"].as_str().unwrap();
            assert_eq!(
                next_recall_mode(mode, grade),
                next,
                "next_recall_mode({mode}, {grade})"
            );
        }
    }

    #[test]
    fn deserializes_lesson_reset_scope_from_frontend_payload() {
        let scope: ReviewResetScope =
            serde_json::from_str(r#"{"type":"lesson","lessonId":"lesson-1"}"#).unwrap();

        match scope {
            ReviewResetScope::Lesson { lesson_id } => assert_eq!(lesson_id, "lesson-1"),
            _ => panic!("expected lesson reset scope"),
        }
    }

    #[test]
    fn deserializes_sentence_reset_scope_from_frontend_payload() {
        let scope: ReviewResetScope =
            serde_json::from_str(r#"{"type":"sentence","sentenceId":"sentence-1"}"#).unwrap();

        match scope {
            ReviewResetScope::Sentence { sentence_id } => assert_eq!(sentence_id, "sentence-1"),
            _ => panic!("expected sentence reset scope"),
        }
    }

    #[test]
    fn deserializes_item_reset_scope_from_frontend_payload() {
        let scope: ReviewResetScope = serde_json::from_str(
            r#"{"type":"item","itemType":"word","canonicalKey":"ko:hello","lessonId":"lesson-1"}"#,
        )
        .unwrap();

        match scope {
            ReviewResetScope::Item {
                item_type,
                canonical_key,
                lesson_id,
            } => {
                assert_eq!(item_type, "word");
                assert_eq!(canonical_key, "ko:hello");
                assert_eq!(lesson_id.as_deref(), Some("lesson-1"));
            }
            _ => panic!("expected item reset scope"),
        }
    }

    #[test]
    fn fixed_interval_schedule_keeps_existing_intervals() {
        let current = review_sentence("fixed-interval", 0, 0, 0.3, 0.0, None);
        let schedule = schedule_review(&current, "remembered", "2026-07-01T10:00:00+00:00");

        assert_eq!(schedule.due_at, "2026-07-04T10:00:00+00:00");
        assert_eq!(schedule.repetitions, 1);
        assert_eq!(schedule.lapses, 0);
        assert_eq!(schedule.difficulty, 0.26);
        assert_eq!(schedule.stability, 3.0);
    }

    #[test]
    fn fsrs_schedule_uses_fsrs_scale_for_marked_rows() {
        let current = review_sentence("fsrs", 0, 0, 0.0, 0.0, None);
        let schedule = schedule_review(&current, "remembered", "2026-07-01T10:00:00+00:00");

        assert_eq!(schedule.due_at, "2026-07-05T10:00:00+00:00");
        assert_eq!(schedule.repetitions, 1);
        assert_eq!(schedule.lapses, 0);
        assert_eq!(schedule.stability, 3.7145);
        assert_eq!(schedule.difficulty, 1.0);
    }

    #[test]
    fn fsrs_again_relearns_in_ten_minutes() {
        let current = review_sentence(
            "fsrs",
            2,
            0,
            5.0,
            8.0,
            Some("2026-06-28T10:00:00+00:00".to_string()),
        );
        let schedule = schedule_review(&current, "forgot", "2026-07-01T10:00:00+00:00");

        assert_eq!(schedule.due_at, "2026-07-01T10:10:00+00:00");
        assert_eq!(schedule.repetitions, 2);
        assert_eq!(schedule.lapses, 1);
        assert!(schedule.stability <= 8.0);
        assert!(schedule.difficulty > 5.0);
    }

    fn review_sentence(
        scheduler_engine: &str,
        repetitions: i64,
        lapses: i64,
        difficulty: f64,
        stability: f64,
        last_reviewed_at: Option<String>,
    ) -> SchedulerState {
        SchedulerState {
            repetitions,
            lapses,
            difficulty,
            stability,
            last_reviewed_at,
            scheduler_engine: scheduler_engine.to_string(),
        }
    }

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("open in-memory database");
        conn.pragma_update(None, "foreign_keys", "ON")
            .expect("enable foreign keys");
        crate::db::migrate(&conn).expect("run migrations");
        conn
    }

    fn seed_item_with_examples(conn: &Connection) {
        conn.execute_batch(
            r#"
            INSERT INTO lessons (id, target_language, base_language, title, source_hash, imported_at, created_at, updated_at)
            VALUES ('lesson-1', 'ko', 'en', 'Lesson 1', 'hash-1', '2026-07-01', '2026-07-01', '2026-07-01');

            INSERT INTO learning_items (id, language, type, canonical_key, display_text, meaning, created_at, updated_at)
            VALUES ('item-1', 'ko', 'word', 'ko:학생', '학생', 'student', '2026-07-01', '2026-07-01'),
                   ('item-2', 'ko', 'grammar', 'ko:이에요', 'N + 이에요', 'to be', '2026-07-01', '2026-07-01');

            -- busy: 학생 + grammar annotation (2 annotations); plain: 학생 only (1 annotation)
            INSERT INTO sentences (id, lesson_id, language, text, normalized_text, translation, created_at, updated_at)
            VALUES ('sent-busy', 'lesson-1', 'ko', '저는 학생이에요.', '저는 학생이에요.', 'I am a student.', '2026-07-01', '2026-07-01'),
                   ('sent-plain', 'lesson-1', 'ko', '학생 왔어요.', '학생 왔어요.', 'The student came.', '2026-07-01', '2026-07-01');

            INSERT INTO sentence_vocabulary_links (id, sentence_id, vocabulary_item_id, surface_text, created_at, updated_at)
            VALUES ('link-1', 'sent-busy', 'item-1', '학생', '2026-07-01', '2026-07-01'),
                   ('link-2', 'sent-plain', 'item-1', '학생', '2026-07-01', '2026-07-01');

            INSERT INTO sentence_grammar_links (id, sentence_id, grammar_item_id, surface_text, created_at, updated_at)
            VALUES ('link-3', 'sent-busy', 'item-2', '이에요', '2026-07-01', '2026-07-01');
            "#,
        )
        .expect("seed items and sentences");
    }

    #[test]
    fn item_targets_use_least_annotated_sentence_as_best_example() {
        let conn = test_conn();
        seed_item_with_examples(&conn);

        let targets = get_item_review_targets_inner(&conn, None).expect("load targets");

        assert_eq!(targets.len(), 2);
        let word = targets
            .iter()
            .find(|target| target.id == "item-1")
            .expect("word target");
        assert_eq!(word.example_sentence_id, "sent-plain");
        assert_eq!(word.example_surface_text, "학생");
        assert_eq!(word.example_count, 2);
        assert_eq!(word.repetitions, 0);
        assert_eq!(word.scheduler_engine, "fixed-interval");

        let grammar = targets
            .iter()
            .find(|target| target.id == "item-2")
            .expect("grammar target");
        assert_eq!(grammar.example_sentence_id, "sent-busy");
        assert_eq!(grammar.example_count, 1);
    }

    #[test]
    fn items_without_sentence_examples_are_not_reviewable_targets() {
        let conn = test_conn();
        seed_item_with_examples(&conn);
        conn.execute(
            "INSERT INTO learning_items (id, language, type, canonical_key, display_text, created_at, updated_at)
             VALUES ('item-orphan', 'ko', 'chunk', 'ko:고아', '고아', '2026-07-01', '2026-07-01')",
            [],
        )
        .expect("insert orphan item");

        let targets = get_item_review_targets_inner(&conn, None).expect("load targets");

        assert!(targets.iter().all(|target| target.id != "item-orphan"));
    }

    #[test]
    fn grading_a_new_item_starts_it_on_fsrs_and_survives_reload() {
        let conn = test_conn();
        seed_item_with_examples(&conn);

        let updated = update_item_review_inner(&conn, "item-1", "remembered").expect("grade item");

        assert_eq!(updated.repetitions, 1);
        assert_eq!(updated.lapses, 0);
        // FSRS default policy: first-ever grades start the card on FSRS.
        assert_eq!(updated.scheduler_engine, "fsrs");
        assert_eq!(updated.stability, 3.7145);
        assert!(updated.last_reviewed_at.is_some());

        let reloaded = get_item_review_targets_inner(&conn, Some("item-1"))
            .expect("reload target")
            .into_iter()
            .next()
            .expect("target exists");
        assert_eq!(reloaded.repetitions, 1);
        assert_eq!(reloaded.due_at, updated.due_at);
    }

    #[test]
    fn grading_forgot_counts_a_lapse_without_touching_other_items() {
        let conn = test_conn();
        seed_item_with_examples(&conn);
        update_item_review_inner(&conn, "item-1", "remembered").expect("first grade");

        let lapsed = update_item_review_inner(&conn, "item-1", "forgot").expect("lapse");

        assert_eq!(lapsed.repetitions, 1);
        assert_eq!(lapsed.lapses, 1);
        let grammar = get_item_review_targets_inner(&conn, Some("item-2"))
            .expect("load other item")
            .into_iter()
            .next()
            .expect("target exists");
        assert_eq!(grammar.repetitions, 0);
    }

    #[test]
    fn grading_an_unknown_item_fails_cleanly() {
        let conn = test_conn();
        seed_item_with_examples(&conn);

        let result = update_item_review_inner(&conn, "missing-item", "remembered");

        assert!(result.is_err());
        let row_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM item_review_states", [], |row| {
                row.get(0)
            })
            .expect("count rows");
        assert_eq!(row_count, 0);
    }

    #[test]
    fn resetting_an_item_returns_it_to_new_defaults() {
        let conn = test_conn();
        seed_item_with_examples(&conn);
        update_item_review_inner(&conn, "item-1", "easy").expect("grade item");

        reset_item_review_state(&conn, "word", "ko:학생").expect("reset item");

        let target = get_item_review_targets_inner(&conn, Some("item-1"))
            .expect("reload target")
            .into_iter()
            .next()
            .expect("target exists");
        assert_eq!(target.repetitions, 0);
        assert_eq!(target.lapses, 0);
        assert_eq!(target.difficulty, 0.3);
        assert_eq!(target.scheduler_engine, "fixed-interval");
    }

    #[test]
    fn migration_preserves_existing_fixed_interval_review_rows() {
        let conn = test_conn();
        seed_item_with_examples(&conn);
        conn.execute(
            r#"
            INSERT INTO review_items
            (id, sentence_id, lesson_id, import_id, due_at, last_reviewed_at, repetitions, lapses, difficulty, stability, recall_mode, created_at, updated_at)
            VALUES ('ri-1', 'sent-busy', 'lesson-1', 'lesson-1', '2026-07-05T10:00:00+00:00', '2026-07-02T10:00:00+00:00', 2, 0, 0.26, 5.0, 'sentence_only', '2026-07-01', '2026-07-02')
            "#,
            [],
        )
        .expect("insert review row");

        // Re-running migrations must not alter sentence review rows or their engine default.
        crate::db::migrate(&conn).expect("re-run migrations");

        let (repetitions, stability, engine): (i64, f64, String) = conn
            .query_row(
                "SELECT repetitions, stability, scheduler_engine FROM review_items WHERE id = 'ri-1'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("read review row");
        assert_eq!(repetitions, 2);
        assert_eq!(stability, 5.0);
        assert_eq!(engine, "fixed-interval");
    }

    #[test]
    fn previously_graded_items_keep_their_fixed_interval_engine() {
        let conn = test_conn();
        seed_item_with_examples(&conn);
        conn.execute(
            "INSERT INTO item_review_states (id, learning_item_id, due_at, last_reviewed_at, repetitions, lapses, difficulty, stability, scheduler_engine, created_at, updated_at)
             VALUES ('irs-1', 'item-1', '2026-07-05T10:00:00+00:00', '2026-07-02T10:00:00+00:00', 2, 0, 0.26, 5.0, 'fixed-interval', '2026-07-01', '2026-07-02')",
            [],
        )
        .expect("insert graded row");

        let updated = update_item_review_inner(&conn, "item-1", "remembered").expect("grade item");

        assert_eq!(updated.scheduler_engine, "fixed-interval");
        assert_eq!(updated.repetitions, 3);
        assert_eq!(updated.stability, 7.0);
    }

    #[test]
    fn grading_a_new_sentence_starts_it_on_fsrs() {
        let mut conn = test_conn();
        seed_item_with_examples(&conn);

        let updated = update_review_item_inner(&mut conn, "sent-plain", "remembered")
            .expect("grade sentence");

        assert_eq!(updated.scheduler_engine, "fsrs");
        assert_eq!(updated.repetitions, 1);
        assert_eq!(updated.stability, 3.7145);
    }

    #[test]
    fn previously_graded_sentences_keep_their_fixed_interval_engine() {
        let mut conn = test_conn();
        seed_item_with_examples(&conn);
        conn.execute(
            r#"
            INSERT INTO review_items
            (id, sentence_id, lesson_id, import_id, due_at, last_reviewed_at, repetitions, lapses, difficulty, stability, recall_mode, created_at, updated_at)
            VALUES ('ri-1', 'sent-plain', 'lesson-1', 'lesson-1', '2026-07-05T10:00:00+00:00', '2026-07-02T10:00:00+00:00', 2, 0, 0.26, 5.0, 'sentence_only', '2026-07-01', '2026-07-02')
            "#,
            [],
        )
        .expect("insert graded row");

        let updated = update_review_item_inner(&mut conn, "sent-plain", "remembered")
            .expect("grade sentence");

        assert_eq!(updated.scheduler_engine, "fixed-interval");
        assert_eq!(updated.repetitions, 3);
        assert_eq!(updated.stability, 7.0);
    }

    #[test]
    fn review_events_log_first_grade_as_new_and_later_grades_as_repeat() {
        let mut conn = test_conn();
        seed_item_with_examples(&conn);

        update_item_review_inner(&conn, "item-1", "remembered").expect("first item grade");
        update_item_review_inner(&conn, "item-1", "forgot").expect("second item grade");
        update_review_item_inner(&mut conn, "sent-plain", "easy").expect("sentence grade");

        let rows: Vec<(String, String, String, i64)> = conn
            .prepare(
                "SELECT target_kind, target_id, grade, was_new FROM review_events ORDER BY rowid",
            )
            .expect("prepare")
            .query_map([], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
            })
            .expect("query")
            .collect::<rusqlite::Result<Vec<_>>>()
            .expect("collect");

        assert_eq!(
            rows,
            vec![
                (
                    "item".to_string(),
                    "item-1".to_string(),
                    "remembered".to_string(),
                    1
                ),
                (
                    "item".to_string(),
                    "item-1".to_string(),
                    "forgot".to_string(),
                    0
                ),
                (
                    "sentence".to_string(),
                    "sent-plain".to_string(),
                    "easy".to_string(),
                    1
                ),
            ]
        );
    }

    #[test]
    fn review_progress_aggregates_daily_activity_and_mastery_counts() {
        let mut conn = test_conn();
        seed_item_with_examples(&conn);
        update_item_review_inner(&conn, "item-1", "remembered").expect("grade item");
        update_review_item_inner(&mut conn, "sent-plain", "remembered").expect("grade sentence");

        let progress = get_review_progress_inner(&conn).expect("load progress");

        assert_eq!(progress.daily_activity.len(), 1);
        assert_eq!(progress.daily_activity[0].reviews, 2);
        assert_eq!(progress.daily_activity[0].new_cards, 2);
        // Both seeded items have sentence examples; only item-1 has been graded.
        assert_eq!(progress.item_stats.total, 2);
        assert_eq!(progress.item_stats.graded, 1);
        assert_eq!(progress.item_stats.mastered, 0);
        assert_eq!(progress.sentence_stats.total, 2);
        assert_eq!(progress.sentence_stats.graded, 1);
        assert_eq!(progress.sentence_stats.mastered, 0);
    }

    #[test]
    fn review_progress_counts_mastered_rows_at_five_repetitions() {
        let conn = test_conn();
        seed_item_with_examples(&conn);
        conn.execute(
            "INSERT INTO item_review_states (id, learning_item_id, due_at, last_reviewed_at, repetitions, lapses, difficulty, stability, scheduler_engine, created_at, updated_at)
             VALUES ('irs-1', 'item-1', '2026-08-01', '2026-07-01', 5, 0, 0.3, 20.0, 'fsrs', '2026-06-01', '2026-07-01')",
            [],
        )
        .expect("insert mastered row");

        let progress = get_review_progress_inner(&conn).expect("load progress");

        assert_eq!(progress.item_stats.mastered, 1);
    }
}
