// Lesson import pipeline: parse/validate JSON, plan against existing data, preview, persist, replace, delete.
use crate::{db, models::*, normalize};
use anyhow::Result;
use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde_json::Value;
use std::collections::{HashMap, HashSet};

// Chunk: import-planning state
#[derive(Clone)]
pub(crate) struct ExistingItem {
    id: String,
    canonical_key: String,
    item_type: String,
    meaning: Option<String>,
    explanation: Option<String>,
}

#[derive(Clone)]
pub(crate) struct CandidateItem {
    canonical_key: String,
    item_type: String,
    display_text: String,
    meaning: Option<String>,
    explanation: Option<String>,
}

pub(crate) struct ImportPlan {
    source_hash: String,
    pub(crate) duplicate_import: bool,
    lesson: LessonImportInput,
    target_lesson: Option<TargetLesson>,
    existing_items_by_key: HashMap<String, ExistingItem>,
    existing_sentences_by_text: HashMap<String, String>,
    candidate_items: Vec<CandidateItem>,
}

pub(crate) struct TargetLesson {
    id: String,
    language: String,
    base_language: String,
    existing_sentence_ids: HashSet<String>,
    next_position: i64,
}

pub(crate) fn parse_lesson_json(source: &str) -> Result<(LessonImportInput, Value), Vec<String>> {
    let raw_value: Value = serde_json::from_str(source).map_err(|_| vec!["Invalid JSON.".to_string()])?;
    let mut lesson: LessonImportInput = serde_json::from_value(raw_value.clone())
        .map_err(|err| vec![format!("Invalid lesson shape: {err}")])?;
    trim_lesson(&mut lesson);

    let mut errors = Vec::new();
    required("language", &lesson.language, &mut errors);
    required("baseLanguage", &lesson.base_language, &mut errors);
    required("title", &lesson.title, &mut errors);
    if lesson.sentences.is_empty() {
        errors.push("At least one sentence is required.".to_string());
    }

    let mut sentence_texts = HashSet::new();
    for (index, sentence) in lesson.sentences.iter().enumerate() {
        required("sentence text", &sentence.text, &mut errors);
        let normalized = normalize::normalize_sentence_text(&sentence.text);
        if !sentence_texts.insert(normalized) {
            errors.push(format!("Duplicate sentence text at sentence {}.", index + 1));
        }

        for word in sentence.words.as_deref().unwrap_or(&[]) {
            required("word surface", &word.surface, &mut errors);
            if !contains_surface(&sentence.text, &word.surface) {
                errors.push(format!("Sentence {}: word surface \"{}\" does not appear in the sentence.", index + 1, word.surface));
            }
        }
        for grammar in sentence.grammar.as_deref().unwrap_or(&[]) {
            required("grammar pattern", &grammar.pattern, &mut errors);
            if let Some(surface) = &grammar.surface {
                if !contains_surface(&sentence.text, surface) {
                    errors.push(format!("Sentence {}: grammar surface \"{}\" does not appear in the sentence.", index + 1, surface));
                }
            }
        }
        for chunk in sentence.chunks.as_deref().unwrap_or(&[]) {
            required("chunk surface", &chunk.surface, &mut errors);
            if !contains_surface(&sentence.text, &chunk.surface) {
                errors.push(format!("Sentence {}: chunk surface \"{}\" does not appear in the sentence.", index + 1, chunk.surface));
            }
        }
    }

    if errors.is_empty() {
        Ok((lesson, raw_value))
    } else {
        Err(errors)
    }
}

// Chunk: import planning and preview
pub(crate) fn build_import_plan(conn: &Connection, lesson: LessonImportInput, raw_value: Value, target_lesson_id: Option<&str>) -> Result<ImportPlan> {
    let source_hash = normalize::hash_json_value(&raw_value);
    let target_lesson = if let Some(target_lesson_id) = target_lesson_id {
        Some(load_target_lesson(conn, target_lesson_id, &lesson)?)
    } else {
        None
    };
    let duplicate_import = if target_lesson.is_some() {
        false
    } else {
        conn
            .query_row("SELECT id FROM lessons WHERE source_hash = ?1 LIMIT 1", [&source_hash], |_| Ok(()))
            .optional()?
            .is_some()
    };

    let normalized_texts = lesson
        .sentences
        .iter()
        .map(|sentence| normalize::normalize_sentence_text(&sentence.text))
        .collect::<Vec<_>>();
    let mut existing_sentences_by_text = HashMap::new();
    for normalized in &normalized_texts {
        if let Some(id) = conn
            .query_row(
                "SELECT id FROM sentences WHERE language = ?1 AND normalized_text = ?2",
                params![lesson.language, normalized],
                |row| row.get::<_, String>(0),
            )
            .optional()?
        {
            existing_sentences_by_text.insert(normalized.clone(), id);
        }
    }

    let candidate_items = collect_candidates(&lesson);
    let mut existing_items_by_key = HashMap::new();
    for candidate in &candidate_items {
        if let Some(item) = conn
            .query_row(
                "SELECT id, canonical_key, type, meaning, explanation FROM learning_items WHERE canonical_key = ?1 AND type = ?2",
                params![candidate.canonical_key, candidate.item_type],
                |row| {
                    Ok(ExistingItem {
                        id: row.get(0)?,
                        canonical_key: row.get(1)?,
                        item_type: row.get(2)?,
                        meaning: row.get(3)?,
                        explanation: row.get(4)?,
                    })
                },
            )
            .optional()?
        {
            existing_items_by_key.insert(item_lookup_key(&item.item_type, &item.canonical_key), item);
        }
    }

    Ok(ImportPlan {
        source_hash,
        duplicate_import,
        lesson,
        target_lesson,
        existing_items_by_key,
        existing_sentences_by_text,
        candidate_items,
    })
}

fn load_target_lesson(conn: &Connection, lesson_id: &str, source_lesson: &LessonImportInput) -> Result<TargetLesson> {
    let target = conn
        .query_row(
            "SELECT id, target_language, base_language FROM lessons WHERE id = ?1",
            [lesson_id],
            |row| {
                Ok(TargetLesson {
                    id: row.get(0)?,
                    language: row.get(1)?,
                    base_language: row.get(2)?,
                    existing_sentence_ids: HashSet::new(),
                    next_position: 0,
                })
            },
        )
        .optional()?;

    let Some(mut target) = target else {
        return Err(anyhow::anyhow!("Selected lesson was not found."));
    };

    if target.language != source_lesson.language || target.base_language != source_lesson.base_language {
        return Err(anyhow::anyhow!(
            "The selected lesson uses {} → {}, but the import source uses {} → {}.",
            target.language,
            target.base_language,
            source_lesson.language,
            source_lesson.base_language
        ));
    }

    let mut stmt = conn.prepare("SELECT sentence_id FROM lesson_sentences WHERE lesson_id = ?1")?;
    let rows = stmt.query_map([lesson_id], |row| row.get::<_, String>(0))?;
    let existing_sentence_ids = rows.collect::<rusqlite::Result<HashSet<_>>>()?;

    let next_position = conn
        .query_row(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM lesson_sentences WHERE lesson_id = ?1",
            [lesson_id],
            |row| row.get::<_, i64>(0),
        )?;

    target.existing_sentence_ids = existing_sentence_ids;
    target.next_position = next_position;
    Ok(target)
}

pub(crate) fn build_preview(plan: &ImportPlan) -> LessonImportPreviewResult {
    LessonImportPreviewResult {
        lesson: LessonImportPreviewLesson {
            language: plan.lesson.language.clone(),
            base_language: plan.lesson.base_language.clone(),
            title: plan.lesson.title.clone(),
            description: plan.lesson.description.clone(),
            source: plan.lesson.source.clone(),
            level: plan.lesson.level.clone(),
            tags: plan.lesson.tags.clone().unwrap_or_default(),
        },
        sentence_count: plan.lesson.sentences.len(),
        duplicate_import: plan.duplicate_import,
        validation_errors: Vec::new(),
        sentences: plan
            .lesson
            .sentences
            .iter()
            .enumerate()
            .map(|(index, sentence)| LessonImportPreviewSentence {
                index,
                text: sentence.text.clone(),
                translation: sentence.translation.clone().unwrap_or_default(),
                duplicate_sentence: plan
                    .existing_sentences_by_text
                    .contains_key(&normalize::normalize_sentence_text(&sentence.text)),
                words: sentence.words.as_deref().unwrap_or(&[]).iter().map(word_output).collect(),
                grammar: sentence.grammar.as_deref().unwrap_or(&[]).iter().map(grammar_output).collect(),
                chunks: sentence.chunks.as_deref().unwrap_or(&[]).iter().map(chunk_output).collect(),
            })
            .collect(),
        vocabulary: preview_items(plan, "word"),
        grammar: preview_items(plan, "grammar"),
        chunks: preview_items(plan, "chunk"),
    }
}

// Chunk: database write path
pub(crate) fn import_plan(conn: &mut Connection, plan: ImportPlan) -> Result<LessonImportSummary> {
    let tx = conn.transaction()?;
    let now = db::now();
    let lesson_id = if let Some(target_lesson) = &plan.target_lesson {
        target_lesson.id.clone()
    } else {
        let lesson_id = db::id();
        tx.execute(
            r#"
            INSERT INTO lessons
            (id, target_language, base_language, description, source, level, title, source_hash, tags, imported_at, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10, ?10)
            "#,
            params![
                lesson_id,
                plan.lesson.language,
                plan.lesson.base_language,
                plan.lesson.description,
                plan.lesson.source,
                plan.lesson.level,
                plan.lesson.title,
                plan.source_hash,
                db::json_array(&plan.lesson.tags.clone().unwrap_or_default()),
                now,
            ],
        )?;
        lesson_id
    };

    let mut item_id_by_key = HashMap::new();
    for item in plan.existing_items_by_key.values() {
        item_id_by_key.insert(item_lookup_key(&item.item_type, &item.canonical_key), item.id.clone());
    }

    let new_items = plan
        .candidate_items
        .iter()
        .filter(|candidate| !plan.existing_items_by_key.contains_key(&item_lookup_key(&candidate.item_type, &candidate.canonical_key)))
        .cloned()
        .collect::<Vec<_>>();
    for item in &new_items {
        let item_id = db::id();
        tx.execute(
            r#"
            INSERT INTO learning_items
            (id, language, type, canonical_key, display_text, meaning, explanation, common_mistakes, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, '[]', ?8, ?8)
            "#,
            params![
                item_id,
                plan.lesson.language,
                item.item_type,
                item.canonical_key,
                item.display_text,
                item.meaning,
                item.explanation,
                db::now(),
            ],
        )?;
        item_id_by_key.insert(item_lookup_key(&item.item_type, &item.canonical_key), item_id);
    }

    for candidate in &plan.candidate_items {
        if let Some(existing) = plan.existing_items_by_key.get(&item_lookup_key(&candidate.item_type, &candidate.canonical_key)) {
            if existing.meaning.is_none() && candidate.meaning.is_some() {
                tx.execute("UPDATE learning_items SET meaning = ?1, updated_at = ?2 WHERE id = ?3", params![candidate.meaning, db::now(), existing.id])?;
            }
            if existing.explanation.is_none() && candidate.explanation.is_some() {
                tx.execute("UPDATE learning_items SET explanation = ?1, updated_at = ?2 WHERE id = ?3", params![candidate.explanation, db::now(), existing.id])?;
            }
        }
    }

    let summary_counts = summarize_item_occurrences(&plan);
    let mut sentences_imported = 0;
    let mut sentences_skipped = 0;
    let mut links_created = 0;
    let mut next_position = plan.target_lesson.as_ref().map(|target| target.next_position).unwrap_or(0);

    for (index, sentence) in plan.lesson.sentences.iter().enumerate() {
        let normalized = normalize::normalize_sentence_text(&sentence.text);
        let sentence_id = if let Some(existing_id) = plan.existing_sentences_by_text.get(&normalized) {
            sentences_skipped += 1;
            existing_id.clone()
        } else {
            let sentence_id = db::id();
            tx.execute(
                r#"
                INSERT INTO sentences
                (id, lesson_id, language, text, normalized_text, translation, review_state, review_streak, reviewed_at, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'unknown', 0, NULL, ?7, ?7)
                "#,
                params![
                    sentence_id,
                    lesson_id,
                    plan.lesson.language,
                    sentence.text,
                    normalized,
                    sentence.translation.clone().unwrap_or_default(),
                    db::now(),
                ],
            )?;
            sentences_imported += 1;
            sentence_id
        };

        let should_link_sentence = plan
            .target_lesson
            .as_ref()
            .map(|target| !target.existing_sentence_ids.contains(&sentence_id))
            .unwrap_or(true);

        if should_link_sentence {
            let position = if plan.target_lesson.is_some() { next_position } else { index as i64 };
            tx.execute(
                "INSERT INTO lesson_sentences (id, lesson_id, sentence_id, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
                params![db::id(), lesson_id, sentence_id, position, db::now()],
            )?;
            links_created += 1;
            if plan.target_lesson.is_some() {
                next_position += 1;
            }
        }
        links_created += create_sentence_item_links(&tx, &plan.lesson.language, &sentence_id, sentence, &item_id_by_key)?;
    }

    tx.commit()?;

    Ok(LessonImportSummary {
        lesson_created: plan.target_lesson.is_none(),
        lesson_updated: plan.target_lesson.is_some(),
        sentences_imported,
        sentences_skipped,
        vocabulary_created: summary_counts.0,
        vocabulary_reused: summary_counts.1,
        grammar_created: summary_counts.2,
        grammar_reused: summary_counts.3,
        chunks_created: summary_counts.4,
        chunks_reused: summary_counts.5,
        links_created,
        errors: Vec::new(),
    })
}

pub(crate) fn replace_lesson(conn: &mut Connection, lesson_id: &str, plan: ImportPlan) -> Result<LessonImportSummary> {
    let tx = conn.transaction()?;
    let now = db::now();
    let previous_sentence_ids = plan
        .target_lesson
        .as_ref()
        .map(|target| target.existing_sentence_ids.clone())
        .unwrap_or_default();

    tx.execute(
        r#"
        UPDATE lessons
        SET target_language = ?1,
            base_language = ?2,
            description = ?3,
            source = ?4,
            level = ?5,
            title = ?6,
            source_hash = ?7,
            tags = ?8,
            updated_at = ?9
        WHERE id = ?10
        "#,
        params![
            plan.lesson.language,
            plan.lesson.base_language,
            plan.lesson.description,
            plan.lesson.source,
            plan.lesson.level,
            plan.lesson.title,
            plan.source_hash,
            db::json_array(&plan.lesson.tags.clone().unwrap_or_default()),
            now,
            lesson_id,
        ],
    )?;

    tx.execute("DELETE FROM lesson_sentences WHERE lesson_id = ?1", [lesson_id])?;

    let mut item_id_by_key = HashMap::new();
    for item in plan.existing_items_by_key.values() {
        item_id_by_key.insert(item_lookup_key(&item.item_type, &item.canonical_key), item.id.clone());
    }

    let new_items = plan
        .candidate_items
        .iter()
        .filter(|candidate| !plan.existing_items_by_key.contains_key(&item_lookup_key(&candidate.item_type, &candidate.canonical_key)))
        .cloned()
        .collect::<Vec<_>>();
    for item in &new_items {
        let item_id = db::id();
        tx.execute(
            r#"
            INSERT INTO learning_items
            (id, language, type, canonical_key, display_text, meaning, explanation, common_mistakes, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, '[]', ?8, ?8)
            "#,
            params![
                item_id,
                plan.lesson.language,
                item.item_type,
                item.canonical_key,
                item.display_text,
                item.meaning,
                item.explanation,
                db::now(),
            ],
        )?;
        item_id_by_key.insert(item_lookup_key(&item.item_type, &item.canonical_key), item_id);
    }

    for candidate in &plan.candidate_items {
        if let Some(existing) = plan.existing_items_by_key.get(&item_lookup_key(&candidate.item_type, &candidate.canonical_key)) {
            if existing.meaning.is_none() && candidate.meaning.is_some() {
                tx.execute("UPDATE learning_items SET meaning = ?1, updated_at = ?2 WHERE id = ?3", params![candidate.meaning, db::now(), existing.id])?;
            }
            if existing.explanation.is_none() && candidate.explanation.is_some() {
                tx.execute("UPDATE learning_items SET explanation = ?1, updated_at = ?2 WHERE id = ?3", params![candidate.explanation, db::now(), existing.id])?;
            }
        }
    }

    let summary_counts = summarize_item_occurrences(&plan);
    let mut sentences_imported = 0;
    let mut sentences_skipped = 0;
    let mut links_created = 0;
    let mut kept_sentence_ids = HashSet::new();

    for (index, sentence) in plan.lesson.sentences.iter().enumerate() {
        let normalized = normalize::normalize_sentence_text(&sentence.text);
        let existing_sentence = tx
            .query_row(
                "SELECT id FROM sentences WHERE language = ?1 AND normalized_text = ?2",
                params![plan.lesson.language, normalized],
                |row| row.get::<_, String>(0),
            )
            .optional()?;

        let sentence_id = if let Some(existing_id) = existing_sentence {
            sentences_skipped += 1;
            tx.execute(
                r#"
                UPDATE sentences
                SET text = ?1,
                    normalized_text = ?2,
                    translation = ?3,
                    updated_at = ?4
                WHERE id = ?5
                "#,
                params![
                    sentence.text,
                    normalized,
                    sentence.translation.clone().unwrap_or_default(),
                    now,
                    existing_id,
                ],
            )?;
            existing_id
        } else {
            let sentence_id = db::id();
            tx.execute(
                r#"
                INSERT INTO sentences
                (id, lesson_id, language, text, normalized_text, translation, review_state, review_streak, reviewed_at, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'unknown', 0, NULL, ?7, ?7)
                "#,
                params![
                    sentence_id,
                    lesson_id,
                    plan.lesson.language,
                    sentence.text,
                    normalized,
                    sentence.translation.clone().unwrap_or_default(),
                    db::now(),
                ],
            )?;
            sentences_imported += 1;
            sentence_id
        };

        tx.execute("DELETE FROM sentence_vocabulary_links WHERE sentence_id = ?1", [&sentence_id])?;
        tx.execute("DELETE FROM sentence_grammar_links WHERE sentence_id = ?1", [&sentence_id])?;
        tx.execute("DELETE FROM sentence_chunk_links WHERE sentence_id = ?1", [&sentence_id])?;
        tx.execute("INSERT INTO lesson_sentences (id, lesson_id, sentence_id, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)", params![db::id(), lesson_id, sentence_id, index as i64, now])?;
        kept_sentence_ids.insert(sentence_id.clone());
        links_created += create_sentence_item_links(&tx, &plan.lesson.language, &sentence_id, sentence, &item_id_by_key)?;
    }

    for sentence_id in previous_sentence_ids.difference(&kept_sentence_ids) {
        let link_count: i64 = tx.query_row(
            "SELECT COUNT(*) FROM lesson_sentences WHERE sentence_id = ?1",
            [sentence_id],
            |row| row.get(0),
        )?;
        if link_count == 0 {
            tx.execute("DELETE FROM sentences WHERE id = ?1", [sentence_id])?;
        }
    }

    tx.commit()?;

    Ok(LessonImportSummary {
        lesson_created: false,
        lesson_updated: true,
        sentences_imported,
        sentences_skipped,
        vocabulary_created: summary_counts.0,
        vocabulary_reused: summary_counts.1,
        grammar_created: summary_counts.2,
        grammar_reused: summary_counts.3,
        chunks_created: summary_counts.4,
        chunks_reused: summary_counts.5,
        links_created,
        errors: Vec::new(),
    })
}

pub(crate) fn delete_lesson_inner(conn: &mut Connection, lesson_id: &str) -> Result<()> {
    let tx = conn.transaction()?;
    let exists = tx
        .query_row("SELECT id FROM lessons WHERE id = ?1", [lesson_id], |_| Ok(()))
        .optional()?
        .is_some();
    if !exists {
        return Err(anyhow::anyhow!("Selected lesson was not found."));
    }

    let lesson_sentence_ids = {
        let mut stmt = tx.prepare("SELECT sentence_id FROM lesson_sentences WHERE lesson_id = ?1")?;
        let rows = stmt.query_map([lesson_id], |row| row.get::<_, String>(0))?;
        rows.collect::<rusqlite::Result<Vec<_>>>()?
    };
    let now = db::now();

    for sentence_id in lesson_sentence_ids {
        tx.execute(
            "DELETE FROM lesson_sentences WHERE lesson_id = ?1 AND sentence_id = ?2",
            params![lesson_id, sentence_id],
        )?;

        let replacement_lesson_id = tx
            .query_row(
                "SELECT lesson_id FROM lesson_sentences WHERE sentence_id = ?1 ORDER BY position ASC LIMIT 1",
                [&sentence_id],
                |row| row.get::<_, String>(0),
            )
            .optional()?;

        if let Some(replacement_lesson_id) = replacement_lesson_id {
            tx.execute(
                "UPDATE sentences SET lesson_id = ?1, updated_at = ?2 WHERE id = ?3 AND lesson_id = ?4",
                params![replacement_lesson_id, now, sentence_id, lesson_id],
            )?;
            tx.execute(
                r#"
                UPDATE review_items
                SET lesson_id = ?1,
                    import_id = CASE WHEN import_id = ?2 THEN ?1 ELSE import_id END,
                    updated_at = ?3
                WHERE sentence_id = ?4 AND (lesson_id = ?2 OR import_id = ?2)
                "#,
                params![replacement_lesson_id, lesson_id, now, sentence_id],
            )?;
        } else {
            tx.execute("DELETE FROM review_items WHERE sentence_id = ?1", [&sentence_id])?;
            tx.execute("DELETE FROM sentence_vocabulary_links WHERE sentence_id = ?1", [&sentence_id])?;
            tx.execute("DELETE FROM sentence_grammar_links WHERE sentence_id = ?1", [&sentence_id])?;
            tx.execute("DELETE FROM sentence_chunk_links WHERE sentence_id = ?1", [&sentence_id])?;
            tx.execute("DELETE FROM sentences WHERE id = ?1", [&sentence_id])?;
        }
    }

    tx.execute(
        "DELETE FROM review_items WHERE lesson_id = ?1 OR import_id = ?1",
        [lesson_id],
    )?;

    let deleted = tx.execute("DELETE FROM lessons WHERE id = ?1", [lesson_id])?;
    if deleted == 0 {
        return Err(anyhow::anyhow!("Selected lesson was not found."));
    }

    tx.commit()?;
    Ok(())
}

fn create_sentence_item_links(
    tx: &Transaction<'_>,
    language: &str,
    sentence_id: &str,
    sentence: &LessonSentenceInput,
    item_id_by_key: &HashMap<String, String>,
) -> Result<i64> {
    let mut seen = HashSet::new();
    let mut inserted = 0;

    for word in sentence.words.as_deref().unwrap_or(&[]) {
        let key = normalize::build_canonical_key(language, word.lemma.as_deref().unwrap_or(&word.surface));
        let Some(item_id) = item_id_by_key.get(&item_lookup_key("word", &key)) else { continue };
        let unique = format!("word:{item_id}:{}", word.surface);
        if !seen.insert(unique) {
            continue;
        }
        inserted += insert_link(tx, "sentence_vocabulary_links", "vocabulary_item_id", sentence_id, item_id, &word.surface)?;
    }

    for grammar in sentence.grammar.as_deref().unwrap_or(&[]) {
        let key = normalize::build_canonical_key(language, &grammar.pattern);
        let Some(item_id) = item_id_by_key.get(&item_lookup_key("grammar", &key)) else { continue };
        let surface = grammar.surface.as_deref().unwrap_or(&grammar.pattern);
        let unique = format!("grammar:{item_id}:{surface}");
        if !seen.insert(unique) {
            continue;
        }
        inserted += insert_link(tx, "sentence_grammar_links", "grammar_item_id", sentence_id, item_id, surface)?;
    }

    for chunk in sentence.chunks.as_deref().unwrap_or(&[]) {
        let key = normalize::build_canonical_key(language, &chunk.surface);
        let Some(item_id) = item_id_by_key.get(&item_lookup_key("chunk", &key)) else { continue };
        let unique = format!("chunk:{item_id}:{}", chunk.surface);
        if !seen.insert(unique) {
            continue;
        }
        inserted += insert_link(tx, "sentence_chunk_links", "chunk_item_id", sentence_id, item_id, &chunk.surface)?;
    }

    Ok(inserted)
}

fn insert_link(tx: &Transaction<'_>, table: &str, item_column: &str, sentence_id: &str, item_id: &str, surface: &str) -> Result<i64> {
    let sql = format!(
        "INSERT OR IGNORE INTO {table} (id, sentence_id, {item_column}, surface_text, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)"
    );
    let changed = tx.execute(&sql, params![db::id(), sentence_id, item_id, surface, db::now()])?;
    Ok(changed as i64)
}

// Chunk: candidate aggregation and counts
fn collect_candidates(lesson: &LessonImportInput) -> Vec<CandidateItem> {
    let mut items: HashMap<String, CandidateItem> = HashMap::new();
    for sentence in &lesson.sentences {
        for word in sentence.words.as_deref().unwrap_or(&[]) {
            upsert_candidate(&mut items, CandidateItem {
                canonical_key: normalize::build_canonical_key(&lesson.language, word.lemma.as_deref().unwrap_or(&word.surface)),
                item_type: "word".to_string(),
                display_text: word.lemma.clone().unwrap_or_else(|| word.surface.clone()),
                meaning: word.meaning.clone(),
                explanation: word.explanation.clone(),
            });
        }
        for grammar in sentence.grammar.as_deref().unwrap_or(&[]) {
            upsert_candidate(&mut items, CandidateItem {
                canonical_key: normalize::build_canonical_key(&lesson.language, &grammar.pattern),
                item_type: "grammar".to_string(),
                display_text: grammar.pattern.clone(),
                meaning: grammar.meaning.clone(),
                explanation: grammar.explanation.clone(),
            });
        }
        for chunk in sentence.chunks.as_deref().unwrap_or(&[]) {
            upsert_candidate(&mut items, CandidateItem {
                canonical_key: normalize::build_canonical_key(&lesson.language, &chunk.surface),
                item_type: "chunk".to_string(),
                display_text: chunk.surface.clone(),
                meaning: chunk.meaning.clone(),
                explanation: chunk.explanation.clone(),
            });
        }
    }
    items.into_values().collect()
}

fn upsert_candidate(items: &mut HashMap<String, CandidateItem>, candidate: CandidateItem) {
    let key = item_lookup_key(&candidate.item_type, &candidate.canonical_key);
    if let Some(existing) = items.get_mut(&key) {
        if existing.meaning.is_none() {
            existing.meaning = candidate.meaning;
        }
        if existing.explanation.is_none() {
            existing.explanation = candidate.explanation;
        }
    } else {
        items.insert(key, candidate);
    }
}

fn preview_items(plan: &ImportPlan, item_type: &str) -> Vec<LessonImportPreviewItem> {
    plan.candidate_items
        .iter()
        .filter(|item| item.item_type == item_type)
        .map(|item| {
            let key = item_lookup_key(&item.item_type, &item.canonical_key);
            LessonImportPreviewItem {
                canonical_key: item.canonical_key.clone(),
                item_type: item.item_type.clone(),
                display_text: item.display_text.clone(),
                meaning: item.meaning.clone(),
                explanation: item.explanation.clone(),
                status: if plan.existing_items_by_key.contains_key(&key) { "existing" } else { "new" }.to_string(),
            }
        })
        .collect()
}

fn summarize_item_occurrences(plan: &ImportPlan) -> (i64, i64, i64, i64, i64, i64) {
    let mut seen = HashSet::new();
    let mut counts = (0, 0, 0, 0, 0, 0);
    for sentence in &plan.lesson.sentences {
        for word in sentence.words.as_deref().unwrap_or(&[]) {
            bump_count(&mut counts.0, &mut counts.1, &mut seen, &plan.existing_items_by_key, "word", &normalize::build_canonical_key(&plan.lesson.language, word.lemma.as_deref().unwrap_or(&word.surface)));
        }
        for grammar in sentence.grammar.as_deref().unwrap_or(&[]) {
            bump_count(&mut counts.2, &mut counts.3, &mut seen, &plan.existing_items_by_key, "grammar", &normalize::build_canonical_key(&plan.lesson.language, &grammar.pattern));
        }
        for chunk in sentence.chunks.as_deref().unwrap_or(&[]) {
            bump_count(&mut counts.4, &mut counts.5, &mut seen, &plan.existing_items_by_key, "chunk", &normalize::build_canonical_key(&plan.lesson.language, &chunk.surface));
        }
    }
    counts
}

fn bump_count(
    created: &mut i64,
    reused: &mut i64,
    seen: &mut HashSet<String>,
    existing: &HashMap<String, ExistingItem>,
    item_type: &str,
    canonical_key: &str,
) {
    let key = item_lookup_key(item_type, canonical_key);
    if existing.contains_key(&key) || seen.contains(&key) {
        *reused += 1;
    } else {
        *created += 1;
        seen.insert(key);
    }
}

// Chunk: lesson normalization
fn trim_lesson(lesson: &mut LessonImportInput) {
    lesson.language = normalize::normalize_text(&lesson.language);
    lesson.base_language = normalize::normalize_text(&lesson.base_language);
    lesson.title = normalize::normalize_text(&lesson.title);
    trim_option(&mut lesson.description);
    trim_option(&mut lesson.source);
    trim_option(&mut lesson.level);
    if let Some(tags) = &mut lesson.tags {
        for tag in tags {
            *tag = normalize::normalize_text(tag);
        }
    }
    for sentence in &mut lesson.sentences {
        sentence.text = normalize::normalize_text(&sentence.text);
        trim_option(&mut sentence.translation);
        for word in sentence.words.as_deref_mut().unwrap_or(&mut []) {
            word.surface = normalize::normalize_text(&word.surface);
            trim_option(&mut word.lemma);
            trim_option(&mut word.meaning);
            trim_option(&mut word.role);
            trim_option(&mut word.explanation);
        }
        for grammar in sentence.grammar.as_deref_mut().unwrap_or(&mut []) {
            grammar.pattern = normalize::normalize_text(&grammar.pattern);
            trim_option(&mut grammar.surface);
            trim_option(&mut grammar.meaning);
            trim_option(&mut grammar.explanation);
        }
        for chunk in sentence.chunks.as_deref_mut().unwrap_or(&mut []) {
            chunk.surface = normalize::normalize_text(&chunk.surface);
            trim_option(&mut chunk.meaning);
            trim_option(&mut chunk.explanation);
            trim_option(&mut chunk.item_type);
            trim_option(&mut chunk.level);
            if let Some(tags) = &mut chunk.tags {
                for tag in tags {
                    *tag = normalize::normalize_text(tag);
                }
            }
        }
    }
}

fn trim_option(value: &mut Option<String>) {
    if let Some(inner) = value {
        *inner = normalize::normalize_text(inner);
    }
}

fn required(label: &str, value: &str, errors: &mut Vec<String>) {
    if value.is_empty() {
        errors.push(format!("{label} is required."));
    }
}

fn contains_surface(sentence_text: &str, surface: &str) -> bool {
    normalize::normalize_sentence_text(sentence_text).contains(&normalize::normalize_sentence_text(surface))
}

fn item_lookup_key(item_type: &str, canonical_key: &str) -> String {
    format!("{item_type}:{canonical_key}")
}

// Chunk: output shaping
fn word_output(word: &LessonWordInput) -> LessonWordOutput {
    LessonWordOutput {
        surface: word.surface.clone(),
        lemma: word.lemma.clone(),
        meaning: word.meaning.clone(),
        role: word.role.clone(),
        explanation: word.explanation.clone(),
    }
}

fn grammar_output(grammar: &LessonGrammarInput) -> LessonGrammarOutput {
    LessonGrammarOutput {
        pattern: grammar.pattern.clone(),
        surface: grammar.surface.clone(),
        meaning: grammar.meaning.clone(),
        explanation: grammar.explanation.clone(),
    }
}

fn chunk_output(chunk: &LessonChunkInput) -> LessonChunkOutput {
    LessonChunkOutput {
        surface: chunk.surface.clone(),
        meaning: chunk.meaning.clone(),
        explanation: chunk.explanation.clone(),
        item_type: chunk.item_type.clone(),
        level: chunk.level.clone(),
        tags: chunk.tags.clone(),
    }
}

pub(crate) fn empty_summary_with_error(error: &str) -> LessonImportSummary {
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
        errors: vec![error.to_string()],
    }
}
