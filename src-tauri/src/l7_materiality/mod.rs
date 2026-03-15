use serde::{Deserialize, Serialize};
use tauri::{command, AppHandle};
use crate::l6_audit::get_db_connection;
use rusqlite::{params, Result};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MaterialityTopic {
    pub id: i32,
    pub topic_name: String,
    pub esrs_code: String,
    pub impact_score: f64,
    pub financial_score: f64,
    pub stakeholder_importance: f64,
    pub is_material: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MaterialityMatrix {
    pub impact_material: Vec<MaterialityTopic>,
    pub financial_material: Vec<MaterialityTopic>,
    pub double_material: Vec<MaterialityTopic>,
    pub not_material: Vec<MaterialityTopic>,
}

pub fn init_materiality_db(app_handle: &AppHandle) -> Result<()> {
    let conn = get_db_connection(app_handle).map_err(|e| e)?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS materiality_assessments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_name TEXT,
            topic_name TEXT NOT NULL,
            esrs_code TEXT NOT NULL UNIQUE,
            impact_score REAL DEFAULT 0,
            financial_score REAL DEFAULT 0,
            stakeholder_importance REAL DEFAULT 0,
            is_material BOOLEAN DEFAULT 0,
            assessed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // Pre-populate with ESRS topics
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM materiality_assessments", [], |row| row.get(0)).unwrap_or(0);
    if count == 0 {
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
                "INSERT INTO materiality_assessments (topic_name, esrs_code) VALUES (?, ?)",
                [name, code],
            )?;
        }
    }

    Ok(())
}

#[command]
pub fn get_materiality_topics(app_handle: AppHandle) -> Result<Vec<MaterialityTopic>, String> {
    let conn = get_db_connection(&app_handle).map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, topic_name, esrs_code, impact_score, financial_score, stakeholder_importance, is_material FROM materiality_assessments")
        .map_err(|e| e.to_string())?;

    let topics = stmt.query_map([], |row| {
        Ok(MaterialityTopic {
            id: row.get(0)?,
            topic_name: row.get(1)?,
            esrs_code: row.get(2)?,
            impact_score: row.get(3)?,
            financial_score: row.get(4)?,
            stakeholder_importance: row.get(5)?,
            is_material: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    Ok(topics)
}

#[command]
pub fn update_materiality_score(
    app_handle: AppHandle,
    topic_id: i32,
    impact_score: f64,
    financial_score: f64,
    stakeholder_importance: f64,
) -> Result<(), String> {
    let conn = get_db_connection(&app_handle).map_err(|e| e.to_string())?;
    
    let is_material = impact_score > 5.0 || financial_score > 5.0;

    conn.execute(
        "UPDATE materiality_assessments 
         SET impact_score = ?, financial_score = ?, stakeholder_importance = ?, is_material = ?, assessed_at = CURRENT_TIMESTAMP
         WHERE id = ?",
        params![impact_score, financial_score, stakeholder_importance, is_material, topic_id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
pub fn get_materiality_matrix(app_handle: AppHandle) -> Result<MaterialityMatrix, String> {
    let topics = get_materiality_topics(app_handle)?;
    
    let mut matrix = MaterialityMatrix {
        impact_material: Vec::new(),
        financial_material: Vec::new(),
        double_material: Vec::new(),
        not_material: Vec::new(),
    };

    for topic in topics {
        let impact_high = topic.impact_score > 5.0;
        let financial_high = topic.financial_score > 5.0;

        if impact_high && financial_high {
            matrix.double_material.push(topic);
        } else if impact_high {
            matrix.impact_material.push(topic);
        } else if financial_high {
            matrix.financial_material.push(topic);
        } else {
            matrix.not_material.push(topic);
        }
    }

    Ok(matrix)
}
