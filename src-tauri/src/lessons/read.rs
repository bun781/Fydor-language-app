// Read-side lesson queries: list, load, and export lessons from SQLite.
use crate::{db, models::*};
use anyhow::Result;
use rusqlite::{Connection, OptionalExtension};

// Chunk: lesson reads and export
pub(crate) fn get_lessons_inner(conn: &Connection) -> Result<Vec<StudyLessonMeta>> {
    if !table_exists(conn, "packs")? {
        return get_lessons_without_packs(conn);
    }
    let mut stmt = conn.prepare(
        r#"
        SELECT l.id, l.target_language, l.base_language, l.title, l.description, l.level, l.tags,
               COUNT(ls.sentence_id) AS sentence_count, l.purpose, l.published_stable_id, l.published_version,
               l.pack_id, p.title, l.pack_position, COALESCE(p.archived, 0)
        FROM lessons l
        LEFT JOIN lesson_sentences ls ON ls.lesson_id = l.id
        LEFT JOIN packs p ON p.id = l.pack_id
        GROUP BY l.id
        ORDER BY COALESCE(p.archived, 0), p.title, l.pack_position, l.imported_at DESC
        "#,
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(StudyLessonMeta {
            id: row.get(0)?,
            language: row.get(1)?,
            base_language: row.get(2)?,
            title: row.get(3)?,
            description: row.get(4)?,
            level: row.get(5)?,
            tags: db::parse_json_array(row.get(6)?),
            sentence_count: row.get(7)?,
            purpose: row.get(8)?,
            published_stable_id: row.get(9)?,
            published_version: row.get(10)?,
            pack_id: row.get(11)?,
            pack_title: row.get(12)?,
            pack_position: row.get(13)?,
            pack_archived: row.get::<_, i64>(14)? != 0,
        })
    })?;

    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(Into::into)
}

fn get_lessons_without_packs(conn: &Connection) -> Result<Vec<StudyLessonMeta>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT l.id, l.target_language, l.base_language, l.title, l.description, l.level, l.tags,
               COUNT(ls.sentence_id) AS sentence_count, l.purpose, l.published_stable_id, l.published_version
        FROM lessons l
        LEFT JOIN lesson_sentences ls ON ls.lesson_id = l.id
        GROUP BY l.id
        ORDER BY l.imported_at DESC
        "#,
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(StudyLessonMeta {
            id: row.get(0)?,
            language: row.get(1)?,
            base_language: row.get(2)?,
            title: row.get(3)?,
            description: row.get(4)?,
            level: row.get(5)?,
            tags: db::parse_json_array(row.get(6)?),
            sentence_count: row.get(7)?,
            purpose: row.get(8)?,
            published_stable_id: row.get(9)?,
            published_version: row.get(10)?,
            pack_id: None,
            pack_title: None,
            pack_position: None,
            pack_archived: false,
        })
    })?;

    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(Into::into)
}

fn table_exists(conn: &Connection, table: &str) -> Result<bool> {
    Ok(conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
            [table],
            |row| row.get::<_, i64>(0),
        )? > 0)
}

pub(crate) fn get_lesson_inner(conn: &Connection, lesson_id: &str) -> Result<Option<StudyLesson>> {
    let lesson = conn
        .query_row(
            "SELECT id, target_language, base_language, title, description, source, level, tags FROM lessons WHERE id = ?1",
            [lesson_id],
            |row| {
                Ok(StudyLesson {
                    id: row.get(0)?,
                    language: row.get(1)?,
                    base_language: row.get(2)?,
                    title: row.get(3)?,
                    description: row.get(4)?,
                    source: row.get(5)?,
                    level: row.get(6)?,
                    tags: db::parse_json_array(row.get(7)?),
                    sentences: Vec::new(),
                })
            },
        )
        .optional()?;

    let Some(mut lesson) = lesson else {
        return Ok(None);
    };

    let mut stmt = conn.prepare(
        r#"
        SELECT s.id, s.text, s.translation
        FROM lesson_sentences ls
        JOIN sentences s ON s.id = ls.sentence_id
        WHERE ls.lesson_id = ?1
        ORDER BY ls.position
        "#,
    )?;
    let rows = stmt.query_map([lesson_id], |row| {
        Ok(StudySentence {
            id: row.get(0)?,
            text: row.get(1)?,
            translation: row.get(2)?,
            audio_url: None,
            words: Vec::new(),
            grammar: Vec::new(),
            chunks: Vec::new(),
        })
    })?;

    let mut sentences = rows.collect::<rusqlite::Result<Vec<_>>>()?;
    for sentence in &mut sentences {
        sentence.words = load_words(conn, &sentence.id)?;
        sentence.grammar = load_grammar(conn, &sentence.id)?;
        sentence.chunks = load_chunks(conn, &sentence.id)?;
    }
    lesson.sentences = sentences;

    Ok(Some(lesson))
}

pub(crate) fn export_lesson_inner(conn: &Connection, lesson_id: &str) -> Result<LessonImportInput> {
    let lesson = get_lesson_inner(conn, lesson_id)?
        .ok_or_else(|| anyhow::anyhow!("Selected lesson was not found."))?;

    Ok(LessonImportInput {
        language: lesson.language,
        base_language: lesson.base_language,
        title: lesson.title,
        description: lesson.description.and_then(non_empty_string),
        source: lesson.source.and_then(non_empty_string),
        level: lesson.level.and_then(non_empty_string),
        tags: if lesson.tags.is_empty() {
            None
        } else {
            Some(lesson.tags)
        },
        sentences: lesson
            .sentences
            .into_iter()
            .map(|sentence| LessonSentenceInput {
                text: sentence.text,
                translation: non_empty_string(sentence.translation),
                words: if sentence.words.is_empty() {
                    None
                } else {
                    Some(
                        sentence
                            .words
                            .into_iter()
                            .map(|word| {
                                let surface = word.surface;
                                let display_text = word.display_text;
                                let meaning = word.meaning;
                                let explanation = word.explanation;
                                LessonWordInput {
                                    surface: surface.clone(),
                                    lemma: if display_text == surface {
                                        None
                                    } else {
                                        non_empty_string(display_text)
                                    },
                                    meaning: meaning.and_then(non_empty_string),
                                    role: None,
                                    explanation: explanation.and_then(non_empty_string),
                                }
                            })
                            .collect(),
                    )
                },
                grammar: if sentence.grammar.is_empty() {
                    None
                } else {
                    Some(
                        sentence
                            .grammar
                            .into_iter()
                            .map(|grammar| {
                                let pattern = grammar.pattern;
                                let surface_text = grammar.surface_text;
                                let meaning = grammar.meaning;
                                let explanation = grammar.explanation;
                                LessonGrammarInput {
                                    pattern: pattern.clone(),
                                    surface: if surface_text == pattern {
                                        None
                                    } else {
                                        non_empty_string(surface_text)
                                    },
                                    meaning: meaning.and_then(non_empty_string),
                                    explanation: explanation.and_then(non_empty_string),
                                }
                            })
                            .collect(),
                    )
                },
                chunks: if sentence.chunks.is_empty() {
                    None
                } else {
                    Some(
                        sentence
                            .chunks
                            .into_iter()
                            .map(|chunk| LessonChunkInput {
                                surface: chunk.surface_text,
                                meaning: chunk.meaning.and_then(non_empty_string),
                                explanation: chunk.explanation.and_then(non_empty_string),
                                item_type: None,
                                level: None,
                                tags: None,
                            })
                            .collect(),
                    )
                },
            })
            .collect(),
    })
}

fn non_empty_string(value: String) -> Option<String> {
    if value.trim().is_empty() {
        None
    } else {
        Some(value)
    }
}

fn load_words(conn: &Connection, sentence_id: &str) -> Result<Vec<StudyWord>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT svl.surface_text, li.display_text, li.meaning, li.explanation, li.common_mistakes, li.canonical_key
        FROM sentence_vocabulary_links svl
        JOIN learning_items li ON li.id = svl.vocabulary_item_id
        WHERE svl.sentence_id = ?1
        ORDER BY svl.rowid
        "#,
    )?;
    let rows = stmt.query_map([sentence_id], |row| {
        Ok(StudyWord {
            surface: row.get(0)?,
            display_text: row.get(1)?,
            meaning: row.get(2)?,
            explanation: row.get(3)?,
            common_mistakes: db::parse_json_array(row.get(4)?),
            canonical_key: row.get(5)?,
        })
    })?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(Into::into)
}

fn load_grammar(conn: &Connection, sentence_id: &str) -> Result<Vec<StudyGrammar>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT sgl.surface_text, li.display_text, li.meaning, li.explanation, li.common_mistakes, li.canonical_key
        FROM sentence_grammar_links sgl
        JOIN learning_items li ON li.id = sgl.grammar_item_id
        WHERE sgl.sentence_id = ?1
        ORDER BY sgl.rowid
        "#,
    )?;
    let rows = stmt.query_map([sentence_id], |row| {
        Ok(StudyGrammar {
            surface_text: row.get(0)?,
            pattern: row.get(1)?,
            meaning: row.get(2)?,
            explanation: row.get(3)?,
            common_mistakes: db::parse_json_array(row.get(4)?),
            canonical_key: row.get(5)?,
        })
    })?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(Into::into)
}

fn load_chunks(conn: &Connection, sentence_id: &str) -> Result<Vec<StudyChunk>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT scl.surface_text, li.meaning, li.explanation, li.canonical_key
        FROM sentence_chunk_links scl
        JOIN learning_items li ON li.id = scl.chunk_item_id
        WHERE scl.sentence_id = ?1
        ORDER BY scl.rowid
        "#,
    )?;
    let rows = stmt.query_map([sentence_id], |row| {
        Ok(StudyChunk {
            surface_text: row.get(0)?,
            meaning: row.get(1)?,
            explanation: row.get(2)?,
            canonical_key: row.get(3)?,
        })
    })?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(Into::into)
}

// Chunk: import validation
