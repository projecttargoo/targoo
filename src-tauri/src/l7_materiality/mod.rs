use serde::{Deserialize, Serialize};
use tauri::{command, AppHandle};
use crate::l6_audit::get_db_connection;
use rusqlite::{params, Connection};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MaterialityTopic {
    pub id: i32,
    pub client_id: i32,
    pub topic_name: String,
    pub esrs_code: String,
    pub impact_score: f64,
    pub financial_score: f64,
    pub is_material: bool,
}

pub fn init_materiality_db(app_handle: &AppHandle) -> Result<(), String> {
    let conn = get_db_connection(app_handle).map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS materiality_assessments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            topic_name TEXT NOT NULL,
            esrs_code TEXT NOT NULL,
            impact_score REAL DEFAULT 0,
            financial_score REAL DEFAULT 0,
            is_material BOOLEAN DEFAULT 0,
            assessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(client_id, esrs_code)
        )",
        [],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

fn seed_materiality_for_client(conn: &Connection, client_id: i32) -> Result<(), rusqlite::Error> {
    let topics = vec![
        ("Climate Change", "E1"),
        ("Pollution", "E2"),
        ("Water and Marine Resources", "E3"),
        ("Biodiversity and Ecosystems", "E4"),
        ("Resource Use and Circular Economy", "E5"),
        ("Own Workforce", "S1"),
        ("Workers in the Value Chain", "S2"),
        ("Affected Communities", "S3"),
        ("Consumers and End-users", "S4"),
        ("Business Conduct", "G1"),
    ];

    for (name, code) in topics {
        conn.execute(
            "INSERT OR IGNORE INTO materiality_assessments (client_id, topic_name, esrs_code) VALUES (?, ?, ?)",
            params![client_id, name, code],
        )?;
    }
    Ok(())
}

#[command]
pub fn get_materiality_assessment(app_handle: AppHandle, client_id: i32) -> Result<String, String> {
    let conn = get_db_connection(&app_handle).map_err(|e| e.to_string())?;
    
    // Auto-seed if empty for this client
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM materiality_assessments WHERE client_id = ?1",
        [client_id],
        |row| row.get(0)
    ).unwrap_or(0);

    if count == 0 {
        seed_materiality_for_client(&conn, client_id).map_err(|e| e.to_string())?;
    }

    let mut stmt = conn
        .prepare("SELECT id, client_id, topic_name, esrs_code, impact_score, financial_score, is_material FROM materiality_assessments WHERE client_id = ?1")
        .map_err(|e| e.to_string())?;

    let topics = stmt.query_map([client_id], |row| {
        Ok(MaterialityTopic {
            id: row.get(0)?,
            client_id: row.get(1)?,
            topic_name: row.get(2)?,
            esrs_code: row.get(3)?,
            impact_score: row.get(4)?,
            financial_score: row.get(5)?,
            is_material: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<rusqlite::Result<Vec<_>>>()
    .map_err(|e| e.to_string())?;

    serde_json::to_string(&topics).map_err(|e| e.to_string())
}

#[command]
pub fn update_materiality_score(
    app_handle: AppHandle,
    client_id: i32,
    topic_id: String, // esrs_code
    impact_score: f64,
    financial_score: f64,
) -> Result<(), String> {
    let conn = get_db_connection(&app_handle).map_err(|e| e.to_string())?;
    
    // Logic: Automatically set is_material = true if score > 3.0
    let is_material = impact_score > 3.0 || financial_score > 3.0;

    conn.execute(
        "UPDATE materiality_assessments 
         SET impact_score = ?, financial_score = ?, is_material = ?, assessed_at = CURRENT_TIMESTAMP
         WHERE client_id = ? AND esrs_code = ?",
        params![impact_score, financial_score, is_material, client_id, topic_id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}
