use serde::{Deserialize, Serialize};
use rusqlite::Connection;
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct EsrsDocument {
    pub id: i32,
    pub topic: String,
    pub paragraph_number: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub results: Vec<EsrsDocument>,
}

pub fn search_esrs_logic(query: String) -> Result<String, String> {
    // In a production environment, the FTS5 virtual table would be initialized on app startup:
    // CREATE VIRTUAL TABLE esrs_fts USING fts5(topic, paragraph_number, content);
    
    // Connect to in-memory DB or existing audit.db
    let conn = Connection::open_in_memory().map_err(|e| e.to_string())?;
    
    // Setup FTS5 for demonstration
    conn.execute("CREATE VIRTUAL TABLE esrs_fts USING fts5(topic, paragraph_number, content)", [])
        .map_err(|e| e.to_string())?;

    // Seed mock ESRS data into the FTS5 table
    let mock_data = vec![
        ("ESRS E1: Climate change", "AR 41", "The undertaking shall disclose its total energy consumption in MWh for the reporting period, including renewable and non-renewable sources."),
        ("ESRS E3: Water and marine resources", "DR 1", "The undertaking shall disclose its total water consumption in m3, including water recycled and reused, at its own operations."),
        ("ESRS G1: Business conduct", "DR 4", "The undertaking shall provide information on its anti-corruption and anti-bribery policies, including training for its workforce."),
    ];

    for (topic, para, content) in mock_data {
        conn.execute(
            "INSERT INTO esrs_fts (topic, paragraph_number, content) VALUES (?, ?, ?)",
            [topic, para, content],
        ).map_err(|e| e.to_string())?;
    }

    // Perform FTS5 search using MATCH
    let mut stmt = conn
        .prepare("SELECT rowid, topic, paragraph_number, content FROM esrs_fts WHERE esrs_fts MATCH ? LIMIT 3")
        .map_err(|e| e.to_string())?;

    let results = stmt.query_map([query], |row| {
        Ok(EsrsDocument {
            id: row.get(0)?,
            topic: row.get(1)?,
            paragraph_number: row.get(2)?,
            content: row.get(3)?,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect::<Vec<EsrsDocument>>();

    let search_result = SearchResult { results };
    serde_json::to_string(&search_result).map_err(|e| e.to_string())
}

#[command]
pub fn search_esrs(query: String) -> Result<String, String> {
    search_esrs_logic(query)
}
