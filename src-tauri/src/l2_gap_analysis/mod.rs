use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{command, AppHandle, Emitter, State};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use std::thread::sleep;
use rusqlite::params;
use crate::l6_audit::get_db_connection;

#[derive(Debug, Serialize, Deserialize)]
pub struct GapAnalysis {
    pub client_id: i32,
    pub company_size: String,
    pub sector: String,
    pub country: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GapResult {
    pub topics: HashMap<String, String>,
}

#[derive(Clone, Serialize)]
pub struct ProgressPayload {
    pub progress: f64,
    pub current_topic: String,
}

pub struct GapAnalysisState {
    pub is_running: Arc<AtomicBool>,
}

#[command]
pub fn gap_analysis(
    app_handle: AppHandle,
    input: GapAnalysis,
    state: State<'_, GapAnalysisState>,
) -> Result<String, String> {
    state.is_running.store(true, Ordering::SeqCst);
    let conn = get_db_connection(&app_handle).map_err(|e| e.to_string())?;
    let client_id = input.client_id;

    let esrs_topics = vec![
        ("E1", "Climate change"),
        ("E2", "Pollution"),
        ("E3", "Water and marine resources"),
        ("E4", "Biodiversity and ecosystems"),
        ("E5", "Resource use and circular economy"),
        ("S1", "Own workforce"),
        ("S2", "Workers in the value chain"),
        ("S3", "Affected communities"),
        ("S4", "Consumers and end-users"),
        ("G1", "Business conduct"),
    ];

    let mut results = HashMap::new();
    let total = esrs_topics.len();

    // Data pre-fetch for efficiency
    let gas = crate::state::get_esg_total(&conn, client_id, "scope1_gas");
    let fuel = crate::state::get_esg_total(&conn, client_id, "scope1_fuel");
    let refrigerant = crate::state::get_esg_total(&conn, client_id, "scope1_refrigerant");
    let electricity = crate::state::get_esg_total(&conn, client_id, "scope2_electricity");
    let water = crate::state::get_esg_total(&conn, client_id, "water");
    let workforce = crate::state::get_esg_total(&conn, client_id, "workforce");
    let training = crate::state::get_esg_total(&conn, client_id, "training_cost");
    let waste = crate::state::get_esg_total(&conn, client_id, "waste");

    // Check for G1 keywords in ledger
    let has_g1: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM esg_state WHERE client_id = ?1 AND (source LIKE '%compliance%' OR source LIKE '%corruption%'))",
        params![client_id],
        |row| row.get(0)
    ).unwrap_or(false);

    for (i, (code, name)) in esrs_topics.iter().enumerate() {
        if !state.is_running.load(Ordering::SeqCst) {
            return Err("Gap analysis was cancelled".to_string());
        }

        let label = format!("ESRS {}: {}", code, name);
        
        // Progress emission
        app_handle.emit("gap_progress", ProgressPayload {
            progress: ((i + 1) as f64 / total as f64) * 100.0,
            current_topic: label.clone(),
        }).map_err(|e| e.to_string())?;

        // Real Comparison Logic
        let status = match *code {
            "E1" => {
                let has_s1 = gas > 0.0 || fuel > 0.0 || refrigerant > 0.0;
                let has_s2 = electricity > 0.0;
                if has_s1 && has_s2 { "green" }
                else if has_s1 || has_s2 { "yellow" }
                else { "red" }
            },
            "E3" => if water > 0.0 { "green" } else { "red" },
            "E5" => if waste > 0.0 { "green" } else { "red" },
            "S1" => {
                if workforce > 0.0 && training > 0.0 { "green" }
                else if workforce > 0.0 { "yellow" }
                else { "red" }
            },
            "G1" => if has_g1 { "green" } else { "red" },
            _ => "red", // Default for topics not yet mapped to data
        };

        results.insert(label, status.to_string());
        
        // Brief artificial delay to ensure UI progress bar is visible on fast DBs
        sleep(Duration::from_millis(150));
    }

    state.is_running.store(false, Ordering::SeqCst);
    let result = GapResult { topics: results };
    serde_json::to_string(&result).map_err(|e| e.to_string())
}

#[command]
pub fn cancel_gap_analysis(state: State<'_, GapAnalysisState>) -> Result<(), String> {
    state.is_running.store(false, Ordering::SeqCst);
    Ok(())
}
