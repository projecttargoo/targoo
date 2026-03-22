use rusqlite::{Connection, Result, params};
use std::fs;
use tauri::AppHandle;
use tauri::Manager;
use tauri::command;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct AuditLog {
    pub id: i32,
    pub timestamp: String,
    pub action: String,
    pub details: String,
    pub client_id: i32,
}

pub fn init_audit_db(app_handle: &AppHandle) -> Result<()> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .expect("failed to get app data directory");

    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir).expect("failed to create app data directory");
    }

    let db_path = app_data_dir.join("targoo.db");
    let conn = Connection::open(db_path)?;

    // Create the audit_log table with integer client_id
    conn.execute(
        "CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
            action TEXT NOT NULL,
            details TEXT,
            client_id INTEGER NOT NULL
        )",
        [],
    )?;

    // Create emission_factors table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS emission_factors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT,
            subcategory TEXT,
            unit TEXT,
            factor_kg_co2e REAL,
            source TEXT,
            valid_year INTEGER,
            scope INTEGER,
            UNIQUE(category, subcategory)
        )",
        [],
    )?;

    // Create unit_conversions table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS unit_conversions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_unit TEXT,
            to_unit TEXT,
            multiplier REAL
        )",
        [],
    )?;

    // Create translations table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS translations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key_name TEXT UNIQUE,
            hu TEXT,
            de TEXT,
            en TEXT
        )",
        [],
    )?;

    // Create FTS5 knowledge table
    conn.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS esrs_knowledge USING fts5(topic, standard_code, content, language, requirement_level, applicable_company_size)",
        [],
    )?;

    Ok(())
}

pub fn get_db_connection(app_handle: &AppHandle) -> Result<Connection> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .expect("failed to get app data directory");
    
    if !app_data_dir.exists() {
        std::fs::create_dir_all(&app_data_dir).expect("failed to create app data directory");
    }

    let db_path = app_data_dir.join("targoo.db");
    Connection::open(db_path)
}

#[command]
pub fn log_audit_event(app_handle: AppHandle, client_id: i32, action: String, details: String) -> Result<(), String> {
    let conn = get_db_connection(&app_handle).map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO audit_log (action, details, client_id) VALUES (?, ?, ?)",
        params![action, details, client_id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
pub fn get_audit_logs(app_handle: AppHandle, client_id: i32) -> Result<String, String> {
    let conn = get_db_connection(&app_handle).map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT id, timestamp, action, details, client_id 
         FROM audit_log 
         WHERE client_id = ?1 
         ORDER BY timestamp DESC"
    ).map_err(|e| e.to_string())?;
    
    let rows = stmt.query_map([client_id], |row| {
        Ok(AuditLog {
            id: row.get(0)?,
            timestamp: row.get(1)?,
            action: row.get(2)?,
            details: row.get(3)?,
            client_id: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut logs = Vec::new();
    for row in rows {
        logs.push(row.map_err(|e| e.to_string())?);
    }
    
    serde_json::to_string(&logs).map_err(|e| e.to_string())
}
