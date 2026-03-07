use rusqlite::{Connection, Result};
use std::fs;
use tauri::AppHandle;
use tauri::Manager;

pub fn init_audit_db(app_handle: &AppHandle) -> Result<()> {
    // Get the app data directory
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .expect("failed to get app data directory");

    // Ensure the directory exists
    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir).expect("failed to create app data directory");
    }

    // Path to the database file
    let db_path = app_data_dir.join("audit.db");
    
    // Open connection (creates the file if it doesn't exist)
    let conn = Connection::open(db_path)?;

    // Create the audit_log table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            action TEXT NOT NULL,
            details TEXT,
            client_id TEXT
        )",
        [],
    )?;

    Ok(())
}
