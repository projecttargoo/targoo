use rusqlite::{Connection, params};
use crate::normalize::NormalizedRow;

pub fn create_esg_state_table(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS esg_state (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER DEFAULT 1,
            project_id INTEGER DEFAULT 1,
            category TEXT NOT NULL,
            subcategory TEXT,
            value REAL NOT NULL,
            unit TEXT NOT NULL,
            normalized_value REAL,
            normalized_unit TEXT,
            confidence REAL DEFAULT 1.0,
            source TEXT,
            origin_file TEXT,
            timestamp TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS esg_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER DEFAULT 1,
            snapshot_date TEXT NOT NULL,
            category TEXT NOT NULL,
            total_value REAL NOT NULL,
            unit TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
    ")?;
    Ok(())
}

pub fn upsert_esg_state(
    conn: &Connection,
    row: &NormalizedRow,
    client_id: i32,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO esg_state 
        (client_id, category, value, unit, normalized_value, normalized_unit, confidence, source, origin_file, timestamp)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            client_id,
            row.category,
            row.value,
            row.unit,
            row.normalized_value,
            row.normalized_unit,
            row.confidence,
            row.source,
            row.origin_file,
            row.timestamp,
        ],
    )?;
    Ok(())
}

pub fn get_esg_total(
    conn: &Connection,
    client_id: i32,
    category: &str,
) -> f64 {
    conn.query_row(
        "SELECT COALESCE(SUM(value), 0.0) FROM esg_state WHERE client_id = ?1 AND category = ?2",
        params![client_id, category],
        |row| row.get(0),
    ).unwrap_or(0.0)
}

pub fn get_esg_count(
    conn: &Connection,
    client_id: i32,
    category: &str,
) -> i64 {
    conn.query_row(
        "SELECT COALESCE(SUM(value), 0) FROM esg_state WHERE client_id = ?1 AND category = ?2",
        params![client_id, category],
        |row| row.get(0),
    ).unwrap_or(0)
}

pub fn clear_esg_state_for_client(
    conn: &Connection,
    client_id: i32,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "DELETE FROM esg_state WHERE client_id = ?1",
        params![client_id],
    )?;
    Ok(())
}
