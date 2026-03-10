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
        "CREATE VIRTUAL TABLE IF NOT EXISTS esrs_knowledge USING fts5(topic, paragraph, content, language)",
        [],
    )?;

    // Seed emission_factors
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM emission_factors", [], |row| row.get(0)).unwrap_or(0);
    if count == 0 {
        let factors = vec![
            ("Electricity", "EU grid", "kWh", 0.276, "EEA", 2024, 2),
            ("Energy", "Natural gas", "m3", 2.04, "IPCC", 2024, 1),
            ("Fuel", "Diesel", "l", 2.68, "DEFRA", 2024, 1),
            ("Fuel", "Petrol", "l", 2.31, "DEFRA", 2024, 1),
            ("Travel", "Flight economy short haul", "km/pax", 0.255, "DEFRA", 2024, 3),
            ("Travel", "Flight economy long haul", "km/pax", 0.195, "DEFRA", 2024, 3),
            ("Logistics", "Road freight", "tonne-km", 0.062, "GLEC", 2024, 3),
            ("Energy", "District heating", "kWh", 0.117, "Local", 2024, 2),
            ("Water", "Water supply", "m3", 0.344, "DEFRA", 2024, 3),
            ("Waste", "Waste landfill", "tonne", 0.587, "DEFRA", 2024, 3),
        ];

        for (cat, sub, unit, factor, source, year, scope) in factors {
            let _ = conn.execute(
                "INSERT OR IGNORE INTO emission_factors (category, subcategory, unit, factor_kg_co2e, source, valid_year, scope) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)",
                rusqlite::params![cat, sub, unit, factor, source, year, scope],
            );
        }
    }

    // Seed unit_conversions
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM unit_conversions", [], |row| row.get(0))?;
    if count == 0 {
        conn.execute(
            "INSERT INTO unit_conversions (from_unit, to_unit, multiplier) VALUES 
            ('MWh', 'kWh', 1000.0), 
            ('GJ', 'kWh', 277.78)",
            [],
        )?;
    }

    // Seed translations
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM translations", [], |row| row.get(0))?;
    if count == 0 {
        conn.execute(
            "INSERT INTO translations (key_name, hu, de, en) VALUES 
            ('gap_analysis', 'Megfelelőségi résanalízis', 'Gap-Analyse', 'Gap Analysis'), 
            ('prediction', 'Kibocsátási prognózis', 'Emissionsprognose', 'Emission Prediction'), 
            ('audit_trail', 'Hitelesített eseménynapló', 'Zertifiziertes Audit-Protokoll', 'Certified Audit Trail')",
            [],
        )?;
    }

    // Seed esrs_knowledge
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM esrs_knowledge", [], |row| row.get(0))?;
    if count == 0 {
        let kb_json = include_str!("../../data/esrs_kb.json");
        let kb_data: serde_json::Value = serde_json::from_str(kb_json).expect("failed to parse esrs_kb.json");
        if let Some(array) = kb_data.as_array() {
            for item in array {
                conn.execute(
                    "INSERT INTO esrs_knowledge (topic, paragraph, content, language) VALUES (?, ?, ?, ?)",
                    [
                        item["topic"].as_str().unwrap_or_default(),
                        item["paragraph"].as_str().unwrap_or_default(),
                        item["content"].as_str().unwrap_or_default(),
                        item["language"].as_str().unwrap_or_default(),
                    ],
                )?;
            }
        }
    }

    Ok(())
}

pub fn get_db_connection(app_handle: &AppHandle) -> Result<Connection> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .expect("failed to get app data directory");
    let db_path = app_data_dir.join("audit.db");
    Connection::open(db_path)
}
