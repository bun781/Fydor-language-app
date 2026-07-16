use crate::{
    db,
    models::{StudyPackMeta, StudyPackUnitMeta},
};
use anyhow::{anyhow, Result};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Deserialize;
use tauri::State;

const UNSORTED_PACK_ID: &str = "personal-unsorted";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackUnitManifestInput {
    pub manifest_id: String,
    pub title: String,
    pub position: i64,
    pub lesson_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackInput {
    pub stable_id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub author_name: Option<String>,
    pub organization: Option<String>,
    pub author_url: Option<String>,
    pub language: Option<String>,
    pub base_language: Option<String>,
    pub level: Option<String>,
    pub tags: Option<Vec<String>>,
    pub version: Option<String>,
    pub license: Option<String>,
    pub source_type: Option<String>,
}

#[tauri::command]
pub fn get_packs(state: State<db::AppState>) -> Result<Vec<StudyPackMeta>, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    get_packs_inner(&conn).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn get_pack_units(state: State<db::AppState>) -> Result<Vec<StudyPackUnitMeta>, String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let mut statement = conn
        .prepare(
            r#"
        SELECT u.id, u.pack_id, u.title, u.position, COUNT(l.id), u.manifest_id
        FROM pack_units u
        LEFT JOIN lessons l ON l.pack_unit_id = u.id
        GROUP BY u.id
        ORDER BY u.pack_id, u.position
        "#,
        )
        .map_err(|err| err.to_string())?;
    let units = statement
        .query_map([], |row| {
            Ok(StudyPackUnitMeta {
                id: row.get(0)?,
                pack_id: row.get(1)?,
                title: row.get(2)?,
                position: row.get(3)?,
                lesson_count: row.get(4)?,
                manifest_id: row.get(5)?,
            })
        })
        .map_err(|err| err.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|err| err.to_string())?;
    Ok(units)
}

#[tauri::command]
pub fn create_pack_unit(
    pack_id: String,
    title: String,
    state: State<db::AppState>,
) -> Result<StudyPackUnitMeta, String> {
    let title = title.trim();
    if title.is_empty() {
        return Err("Unit name is required.".to_string());
    }
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let pack_exists: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM packs WHERE id = ?1)",
            [&pack_id],
            |row| row.get(0),
        )
        .map_err(|err| err.to_string())?;
    if !pack_exists {
        return Err("Selected pack was not found.".to_string());
    }
    let position: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM pack_units WHERE pack_id = ?1",
            [&pack_id],
            |row| row.get(0),
        )
        .map_err(|err| err.to_string())?;
    let id = db::id();
    conn.execute(
        "INSERT INTO pack_units (id, pack_id, title, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
        params![id, pack_id, title, position, db::now()],
    ).map_err(|err| err.to_string())?;
    Ok(StudyPackUnitMeta {
        id,
        pack_id,
        title: title.to_string(),
        position,
        lesson_count: 0,
        manifest_id: None,
    })
}

#[tauri::command]
pub fn rename_pack_unit(
    unit_id: String,
    title: String,
    state: State<db::AppState>,
) -> Result<(), String> {
    let title = title.trim();
    if title.is_empty() {
        return Err("Unit name is required.".to_string());
    }
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let changed = conn
        .execute(
            "UPDATE pack_units SET title = ?1, updated_at = ?2 WHERE id = ?3",
            params![title, db::now(), unit_id],
        )
        .map_err(|err| err.to_string())?;
    if changed == 0 {
        return Err("Selected unit was not found.".to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn sync_pack_unit_manifest(
    pack_id: String,
    units: Vec<PackUnitManifestInput>,
    state: State<db::AppState>,
) -> Result<(), String> {
    let mut conn = state.conn.lock().map_err(|err| err.to_string())?;
    sync_pack_unit_manifest_inner(&mut conn, &pack_id, &units).map_err(|err| err.to_string())
}

pub(crate) fn sync_pack_unit_manifest_inner(
    conn: &mut Connection,
    pack_id: &str,
    units: &[PackUnitManifestInput],
) -> Result<()> {
    let pack_exists: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM packs WHERE id = ?1)",
        [pack_id],
        |row| row.get(0),
    )?;
    if !pack_exists {
        return Err(anyhow!("Selected pack was not found."));
    }

    let mut manifest_ids = std::collections::HashSet::new();
    let mut positions = std::collections::HashSet::new();
    for unit in units {
        if unit.manifest_id.trim().is_empty() || unit.title.trim().is_empty() {
            return Err(anyhow!("Unit manifest IDs and titles are required."));
        }
        if !manifest_ids.insert(unit.manifest_id.as_str()) {
            return Err(anyhow!("Unit manifest contains a duplicate ID."));
        }
        if !positions.insert(unit.position) {
            return Err(anyhow!("Unit manifest contains a duplicate position."));
        }
        for lesson_id in &unit.lesson_ids {
            let belongs: bool = conn.query_row(
                "SELECT EXISTS(SELECT 1 FROM lessons WHERE id = ?1 AND pack_id = ?2)",
                params![lesson_id, pack_id],
                |row| row.get(0),
            )?;
            if !belongs {
                return Err(anyhow!(
                    "A manifest lesson does not belong to the selected pack."
                ));
            }
        }
    }

    let tx = conn.transaction()?;
    let managed_ids: Vec<(String, Option<String>)> = {
        let mut statement = tx.prepare(
            "SELECT id, manifest_id FROM pack_units WHERE pack_id = ?1 AND manifest_id IS NOT NULL",
        )?;
        let rows = statement
            .query_map([pack_id], |row| Ok((row.get(0)?, row.get(1)?)))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        rows
    };
    for (_, manifest_id) in &managed_ids {
        if let Some(manifest_id) = manifest_id {
            if !manifest_ids.contains(manifest_id.as_str()) {
                tx.execute(
                    "DELETE FROM pack_units WHERE pack_id = ?1 AND manifest_id = ?2",
                    params![pack_id, manifest_id],
                )?;
            }
        }
    }

    let manual_unit_ids: Vec<String> = {
        let mut statement = tx.prepare(
            "SELECT id FROM pack_units WHERE pack_id = ?1 AND manifest_id IS NULL ORDER BY position, id",
        )?;
        let rows = statement
            .query_map([pack_id], |row| row.get(0))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        rows
    };
    tx.execute(
        "UPDATE pack_units SET position = 1000000 + rowid WHERE pack_id = ?1",
        [pack_id],
    )?;

    let now = db::now();
    for unit in units {
        let existing_id: Option<String> = tx
            .query_row(
                "SELECT id FROM pack_units WHERE pack_id = ?1 AND manifest_id = ?2",
                params![pack_id, unit.manifest_id],
                |row| row.get(0),
            )
            .optional()?;
        let id = existing_id.clone().unwrap_or_else(db::id);
        if existing_id.is_some() {
            tx.execute(
                "UPDATE pack_units SET title = ?1, position = ?2, updated_at = ?3 WHERE id = ?4",
                params![unit.title.trim(), unit.position, now, id],
            )?;
        } else {
            tx.execute(
                "INSERT INTO pack_units (id, pack_id, title, position, created_at, updated_at, manifest_id) VALUES (?1, ?2, ?3, ?4, ?5, ?5, ?6)",
                params![id, pack_id, unit.title.trim(), unit.position, now, unit.manifest_id],
            )?;
        }
        for lesson_id in &unit.lesson_ids {
            tx.execute(
                "UPDATE lessons SET pack_unit_id = ?1, updated_at = ?2 WHERE id = ?3 AND pack_id = ?4",
                params![id, now, lesson_id, pack_id],
            )?;
        }
    }
    let next_manual_position = units.iter().map(|unit| unit.position).max().unwrap_or(-1) + 1;
    for (offset, unit_id) in manual_unit_ids.iter().enumerate() {
        tx.execute(
            "UPDATE pack_units SET position = ?1, updated_at = ?2 WHERE id = ?3",
            params![next_manual_position + offset as i64, now, unit_id],
        )?;
    }
    tx.commit()?;
    Ok(())
}

#[tauri::command]
pub fn delete_pack_unit(unit_id: String, state: State<db::AppState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let changed = conn
        .execute("DELETE FROM pack_units WHERE id = ?1", [&unit_id])
        .map_err(|err| err.to_string())?;
    if changed == 0 {
        return Err("Selected unit was not found.".to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn move_lessons_to_pack_unit(
    lesson_ids: Vec<String>,
    pack_id: String,
    unit_id: Option<String>,
    state: State<db::AppState>,
) -> Result<(), String> {
    let mut conn = state.conn.lock().map_err(|err| err.to_string())?;
    if let Some(ref unit_id) = unit_id {
        let unit_matches: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM pack_units WHERE id = ?1 AND pack_id = ?2)",
                params![unit_id, pack_id],
                |row| row.get(0),
            )
            .map_err(|err| err.to_string())?;
        if !unit_matches {
            return Err("Selected unit does not belong to this pack.".to_string());
        }
    }
    move_lessons_to_pack_inner(&mut conn, &lesson_ids, &pack_id).map_err(|err| err.to_string())?;
    let tx = conn.transaction().map_err(|err| err.to_string())?;
    for lesson_id in lesson_ids {
        tx.execute(
            "UPDATE lessons SET pack_unit_id = ?1, updated_at = ?2 WHERE id = ?3",
            params![unit_id, db::now(), lesson_id],
        )
        .map_err(|err| err.to_string())?;
    }
    tx.commit().map_err(|err| err.to_string())
}

#[tauri::command]
pub fn upsert_pack(input: PackInput, state: State<db::AppState>) -> Result<StudyPackMeta, String> {
    let mut conn = state.conn.lock().map_err(|err| err.to_string())?;
    let pack = upsert_pack_inner(&mut conn, input).map_err(|err| err.to_string())?;
    get_pack_inner(&conn, &pack).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn update_pack(
    pack_id: String,
    title: String,
    description: Option<String>,
    archived: bool,
    state: State<db::AppState>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let changed = conn
        .execute(
            "UPDATE packs SET title = ?1, description = ?2, archived = ?3, updated_at = ?4 WHERE id = ?5",
            params![title.trim(), description, archived as i64, db::now(), pack_id],
        )
        .map_err(|err| err.to_string())?;
    if changed == 0 {
        return Err("Selected pack was not found.".to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn move_lessons_to_pack(
    lesson_ids: Vec<String>,
    pack_id: String,
    state: State<db::AppState>,
) -> Result<(), String> {
    let mut conn = state.conn.lock().map_err(|err| err.to_string())?;
    move_lessons_to_pack_inner(&mut conn, &lesson_ids, &pack_id).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn delete_pack(pack_id: String, state: State<db::AppState>) -> Result<(), String> {
    if pack_id == UNSORTED_PACK_ID {
        return Err("The Personal / Unsorted pack cannot be deleted.".to_string());
    }
    let mut conn = state.conn.lock().map_err(|err| err.to_string())?;
    let tx = conn.transaction().map_err(|err| err.to_string())?;
    let now = db::now();
    tx.execute(
        "UPDATE lessons SET pack_id = ?1, pack_position = NULL, updated_at = ?2 WHERE pack_id = ?3",
        params![UNSORTED_PACK_ID, now, pack_id],
    )
    .map_err(|err| err.to_string())?;
    let changed = tx
        .execute("DELETE FROM packs WHERE id = ?1", [pack_id])
        .map_err(|err| err.to_string())?;
    if changed == 0 {
        return Err("Selected pack was not found.".to_string());
    }
    tx.commit().map_err(|err| err.to_string())
}

pub(crate) fn get_packs_inner(conn: &Connection) -> Result<Vec<StudyPackMeta>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT p.id, p.stable_id, p.title, p.description, p.author_name, p.organization,
               p.author_url, p.language, p.base_language, p.level, p.tags, p.version,
               p.license, p.source_type, p.archived,
               COUNT(DISTINCT l.id), COUNT(ls.sentence_id)
        FROM packs p
        LEFT JOIN lessons l ON l.pack_id = p.id
        LEFT JOIN lesson_sentences ls ON ls.lesson_id = l.id
        GROUP BY p.id
        ORDER BY p.archived, p.title COLLATE NOCASE
        "#,
    )?;
    let rows = stmt.query_map([], map_pack)?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(Into::into)
}

fn get_pack_inner(conn: &Connection, id: &str) -> Result<StudyPackMeta> {
    let mut stmt = conn.prepare(
        r#"
        SELECT p.id, p.stable_id, p.title, p.description, p.author_name, p.organization,
               p.author_url, p.language, p.base_language, p.level, p.tags, p.version,
               p.license, p.source_type, p.archived,
               COUNT(DISTINCT l.id), COUNT(ls.sentence_id)
        FROM packs p
        LEFT JOIN lessons l ON l.pack_id = p.id
        LEFT JOIN lesson_sentences ls ON ls.lesson_id = l.id
        WHERE p.id = ?1
        GROUP BY p.id
        "#,
    )?;
    stmt.query_row([id], map_pack).map_err(Into::into)
}

fn map_pack(row: &rusqlite::Row<'_>) -> rusqlite::Result<StudyPackMeta> {
    Ok(StudyPackMeta {
        id: row.get(0)?,
        stable_id: row.get(1)?,
        title: row.get(2)?,
        description: row.get(3)?,
        author_name: row.get(4)?,
        organization: row.get(5)?,
        author_url: row.get(6)?,
        language: row.get(7)?,
        base_language: row.get(8)?,
        level: row.get(9)?,
        tags: db::parse_json_array(row.get(10)?),
        version: row.get(11)?,
        license: row.get(12)?,
        source_type: row.get(13)?,
        archived: row.get::<_, i64>(14)? != 0,
        lesson_count: row.get(15)?,
        sentence_count: row.get(16)?,
    })
}

pub(crate) fn upsert_pack_inner(conn: &mut Connection, input: PackInput) -> Result<String> {
    let stable_id = input
        .stable_id
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(db::id);
    let existing_id = conn
        .query_row(
            "SELECT id FROM packs WHERE stable_id = ?1",
            [&stable_id],
            |row| row.get::<_, String>(0),
        )
        .optional()?;
    let id = existing_id.unwrap_or_else(db::id);
    let now = db::now();
    conn.execute(
        r#"
        INSERT INTO packs
          (id, stable_id, title, description, author_name, organization, author_url,
           language, base_language, level, tags, version, license, source_type, archived,
           created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, 0, ?15, ?15)
        ON CONFLICT(stable_id) DO UPDATE SET
          title = excluded.title,
          description = excluded.description,
          author_name = excluded.author_name,
          organization = excluded.organization,
          author_url = excluded.author_url,
          language = excluded.language,
          base_language = excluded.base_language,
          level = excluded.level,
          tags = excluded.tags,
          version = excluded.version,
          license = excluded.license,
          source_type = excluded.source_type,
          archived = 0,
          updated_at = excluded.updated_at
        "#,
        params![
            id,
            stable_id,
            input.title.trim(),
            input.description,
            input.author_name,
            input.organization,
            input.author_url,
            input.language.unwrap_or_default(),
            input.base_language.unwrap_or_default(),
            input.level,
            db::json_array(&input.tags.unwrap_or_default()),
            input.version.unwrap_or_else(|| "1.0.0".to_string()),
            input.license,
            input.source_type.unwrap_or_else(|| "import".to_string()),
            now,
        ],
    )?;
    Ok(id)
}

pub(crate) fn move_lessons_to_pack_inner(
    conn: &mut Connection,
    lesson_ids: &[String],
    pack_id: &str,
) -> Result<()> {
    let pack_exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM packs WHERE id = ?1",
        [pack_id],
        |row| Ok(row.get::<_, i64>(0)? > 0),
    )?;
    if !pack_exists {
        return Err(anyhow!("Selected pack was not found."));
    }
    let next_position: i64 = conn.query_row(
        "SELECT COALESCE(MAX(pack_position), -1) + 1 FROM lessons WHERE pack_id = ?1",
        [pack_id],
        |row| row.get(0),
    )?;
    let tx = conn.transaction()?;
    for (offset, lesson_id) in lesson_ids.iter().enumerate() {
        tx.execute(
            "UPDATE lessons SET pack_id = ?1, pack_unit_id = NULL, pack_position = ?2, updated_at = ?3 WHERE id = ?4",
            params![pack_id, next_position + offset as i64, db::now(), lesson_id],
        )?;
    }
    tx.commit()?;
    Ok(())
}

pub(crate) fn assign_lesson_to_pack(
    conn: &mut Connection,
    lesson_id: &str,
    pack_id: &str,
) -> Result<()> {
    move_lessons_to_pack_inner(conn, &[lesson_id.to_string()], pack_id)
}

pub(crate) fn ensure_lesson_pack(conn: &mut Connection, lesson_id: &str) -> Result<()> {
    let current: Option<String> = conn
        .query_row(
            "SELECT pack_id FROM lessons WHERE id = ?1",
            [lesson_id],
            |row| row.get(0),
        )
        .optional()?;
    if current.is_none() {
        assign_lesson_to_pack(conn, lesson_id, UNSORTED_PACK_ID)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_sync_is_idempotent_and_assigns_lessons() {
        let conn = Connection::open_in_memory().expect("open database");
        conn.pragma_update(None, "foreign_keys", "ON")
            .expect("enable foreign keys");
        db::migrate(&conn).expect("migrate database");
        let mut conn = conn;
        let pack_id = upsert_pack_inner(
            &mut conn,
            PackInput {
                stable_id: Some("manifest-test".to_string()),
                title: "Manifest test".to_string(),
                description: None,
                author_name: None,
                organization: None,
                author_url: None,
                language: Some("zh".to_string()),
                base_language: Some("en".to_string()),
                level: None,
                tags: None,
                version: None,
                license: None,
                source_type: None,
            },
        )
        .expect("create pack");
        for (index, lesson_id) in ["lesson-one", "lesson-two"].iter().enumerate() {
            conn.execute(
                "INSERT INTO lessons (id, target_language, base_language, title, source_hash, imported_at, created_at, updated_at, pack_id, pack_position) VALUES (?1, 'zh', 'en', ?2, ?3, ?4, ?4, ?4, ?5, ?6)",
                params![lesson_id, lesson_id, format!("hash-{lesson_id}"), db::now(), pack_id, index as i64],
            )
            .expect("insert lesson");
        }
        let units = vec![
            PackUnitManifestInput {
                manifest_id: "unit-1".to_string(),
                title: "First".to_string(),
                position: 0,
                lesson_ids: vec!["lesson-one".to_string()],
            },
            PackUnitManifestInput {
                manifest_id: "unit-2".to_string(),
                title: "Second".to_string(),
                position: 1,
                lesson_ids: vec!["lesson-two".to_string()],
            },
        ];

        sync_pack_unit_manifest_inner(&mut conn, &pack_id, &units).expect("sync units");
        sync_pack_unit_manifest_inner(&mut conn, &pack_id, &units).expect("resync units");

        let unit_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM pack_units WHERE pack_id = ?1",
                [&pack_id],
                |row| row.get(0),
            )
            .expect("count units");
        let assigned_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM lessons WHERE pack_id = ?1 AND pack_unit_id IS NOT NULL",
                [&pack_id],
                |row| row.get(0),
            )
            .expect("count assignments");
        assert_eq!(unit_count, 2);
        assert_eq!(assigned_count, 2);
    }
}
