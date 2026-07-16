use crate::{
    db,
    models::{AnnotationSearchInput, AnnotationSearchResult},
};
use anyhow::{bail, Result};
use rusqlite::{params, Connection, OptionalExtension};
use tauri::State;

#[tauri::command]
pub fn search_annotations(
    input: AnnotationSearchInput,
    state: State<db::AppState>,
) -> Result<Vec<AnnotationSearchResult>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    search_annotations_inner(&conn, &input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn copy_annotation_to_lesson(
    annotation_id: String,
    lesson_id: String,
    sentence_id: String,
    state: State<db::AppState>,
) -> Result<String, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    copy_annotation_inner(&conn, &annotation_id, &lesson_id, &sentence_id)
        .map_err(|e| e.to_string())
}

pub(crate) fn search_annotations_inner(
    conn: &Connection,
    input: &AnnotationSearchInput,
) -> Result<Vec<AnnotationSearchResult>> {
    let needle = input.query.as_deref().unwrap_or("").trim().to_lowercase();
    let item_type = input.item_type.as_deref().unwrap_or("").trim();
    if !item_type.is_empty() && !matches!(item_type, "word" | "grammar" | "chunk") {
        bail!("Invalid annotation type.");
    }
    let mut stmt = conn.prepare(r#"
      SELECT a.id,a.lesson_id,a.sentence_id,l.title,l.target_language,l.base_language,a.item_type,a.canonical_key,a.surface_text,a.display_text,a.meaning,a.explanation,a.source_annotation_id
      FROM annotation_records a JOIN lessons l ON l.id=a.lesson_id
      WHERE a.language_pair_id=?1
        AND (?2='' OR a.item_type=?2)
        AND (?3='' OR lower(a.surface_text) LIKE '%' || ?3 || '%' OR lower(a.display_text) LIKE '%' || ?3 || '%' OR lower(COALESCE(a.meaning,'')) LIKE '%' || ?3 || '%' OR lower(COALESCE(a.explanation,'')) LIKE '%' || ?3 || '%' OR lower(a.canonical_key) LIKE '%' || ?3 || '%')
      ORDER BY l.title,a.surface_text,a.id LIMIT 100
    "#)?;
    let rows = stmt.query_map(params![input.language_pair_id, item_type, needle], |r| {
        Ok(AnnotationSearchResult {
            id: r.get(0)?,
            lesson_id: r.get(1)?,
            sentence_id: r.get(2)?,
            source_lesson_title: r.get(3)?,
            language: r.get(4)?,
            base_language: r.get(5)?,
            item_type: r.get(6)?,
            canonical_key: r.get(7)?,
            surface_text: r.get(8)?,
            display_text: r.get(9)?,
            meaning: r.get(10)?,
            explanation: r.get(11)?,
            copied_from_id: r.get(12)?,
        })
    })?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(Into::into)
}

pub(crate) fn copy_annotation_inner(
    conn: &Connection,
    annotation_id: &str,
    lesson_id: &str,
    sentence_id: &str,
) -> Result<String> {
    let source = conn.query_row("SELECT language_pair_id,item_type,canonical_key,surface_text,display_text,meaning,explanation FROM annotation_records WHERE id=?1", [annotation_id], |r| Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?,r.get::<_,String>(3)?,r.get::<_,String>(4)?,r.get::<_,Option<String>>(5)?,r.get::<_,Option<String>>(6)?))).optional()?;
    let Some((pair, kind, key, surface, display, meaning, explanation)) = source else {
        bail!("Annotation not found.");
    };
    let target_pair: Option<String> = conn
        .query_row(
            "SELECT language_pair_id FROM lessons WHERE id=?1",
            [lesson_id],
            |r| r.get(0),
        )
        .optional()?;
    if target_pair.as_deref() != Some(pair.as_str()) {
        bail!("Annotations can only be copied within the same language direction.");
    }
    let text: Option<String> = conn
        .query_row(
            "SELECT text FROM sentences WHERE id=?1 AND lesson_id=?2",
            params![sentence_id, lesson_id],
            |r| r.get(0),
        )
        .optional()?;
    let Some(text) = text else {
        bail!("Target sentence not found.");
    };
    if !text.contains(&surface) {
        bail!("Annotation surface does not occur in the target sentence.");
    }
    let id = db::id();
    let now = db::now();
    conn.execute("INSERT INTO annotation_records(id,lesson_id,sentence_id,language_pair_id,item_type,canonical_key,surface_text,display_text,meaning,explanation,source_annotation_id,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?12) ON CONFLICT(sentence_id,item_type,canonical_key,surface_text) DO UPDATE SET display_text=excluded.display_text,meaning=excluded.meaning,explanation=excluded.explanation,source_annotation_id=excluded.source_annotation_id,updated_at=excluded.updated_at", params![id,lesson_id,sentence_id,pair,kind,key,surface,display,meaning,explanation,annotation_id,now])?;
    Ok(id)
}
