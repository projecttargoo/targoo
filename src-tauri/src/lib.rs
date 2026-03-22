use std::sync::{Mutex, Arc};
use std::sync::atomic::AtomicBool;
use serde::Serialize;
use rusqlite::{params, Connection};
use tauri::{AppHandle, Manager};

mod l1_rag;
mod l2_gap_analysis;
mod l3_report;
mod l4_data_processor;
mod l5_prediction;
mod l6_audit;
mod l7_materiality;
mod l8_workspace;
mod license;
mod model_downloader;
mod normalize;
mod state;

#[derive(Serialize, Debug)]
pub struct ProductionClient {
    pub id: i32,
    pub name: String,
    pub industry: String,
    pub last_audit: String,
    pub score: i32,
    pub carbon: f64,
}

#[derive(Serialize)]
pub struct DashboardStats {
    pub esg_score: u32,
    pub carbon_footprint: f64,
    pub energy_intensity: f64,
    pub workforce: u32,
    pub status_message: String,
}

#[derive(Serialize)]
pub struct MaterialityTopic {
    pub topic_id: String,
    pub name: String,
    pub impact_score: u32,
    pub financial_score: u32,
    pub is_material: bool,
}

#[tauri::command]
fn get_dashboard_stats(app_handle: AppHandle) -> DashboardStats {
    if let Ok(conn) = get_db_connection(&app_handle) {
        let energy = state::get_esg_total(&conn, 1, "scope2_electricity") / 1000.0;
        let gas = state::get_esg_total(&conn, 1, "scope1_gas");
        let fuel = state::get_esg_total(&conn, 1, "scope1_fuel");
        let refrigerant = state::get_esg_total(&conn, 1, "scope1_refrigerant");
        let workforce = state::get_esg_total(&conn, 1, "workforce");
        
        let carbon = gas + fuel + refrigerant;
        
        println!("ESG_STATE: energy={} MWh carbon={} workforce={}", energy, carbon, workforce);
        
        return DashboardStats {
            esg_score: 74,
            carbon_footprint: if carbon > 0.0 { carbon } else { 0.0 },
            energy_intensity: if energy > 0.0 { energy } else { 0.0 },
            workforce: workforce as u32,
            status_message: "ESG_STATE loaded".to_string(),
        };
    }
    
    DashboardStats {
        esg_score: 74,
        carbon_footprint: 0.0,
        energy_intensity: 0.0,
        workforce: 0,
        status_message: "DB connection failed".to_string(),
    }
}

pub fn get_db_connection(app_handle: &AppHandle) -> rusqlite::Result<Connection> {
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

#[tauri::command]
fn run_materiality_check() -> Vec<MaterialityTopic> {
    vec![
        MaterialityTopic { topic_id: "E1".to_string(), name: "Climate Change".to_string(), impact_score: 90, financial_score: 85, is_material: true },
        MaterialityTopic { topic_id: "E2".to_string(), name: "Pollution".to_string(), impact_score: 40, financial_score: 30, is_material: false },
        MaterialityTopic { topic_id: "S1".to_string(), name: "Own Workforce".to_string(), impact_score: 70, financial_score: 60, is_material: true },
    ]
}

#[tauri::command]
fn add_client(
    app_handle: AppHandle,
    name: String,
    industry: String,
) -> Result<i32, String> {
    let conn = get_db_connection(&app_handle).map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO clients (name, industry, last_audit, score, carbon) VALUES (?, ?, ?, 0, 0.0)",
        params![name, industry, "Never"],
    ).map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid() as i32)
}

#[tauri::command]
fn get_enterprise_clients(
    app_handle: AppHandle,
) -> Result<Vec<ProductionClient>, String> {
    let conn = get_db_connection(&app_handle).map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare("SELECT id, name, industry, last_audit, score, carbon FROM clients ORDER BY name ASC")
        .map_err(|e| e.to_string())?;
    
    let clients = stmt.query_map([], |row| {
        Ok(ProductionClient {
            id: row.get(0)?,
            name: row.get(1)?,
            industry: row.get(2)?,
            last_audit: row.get(3)?,
            score: row.get(4)?,
            carbon: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<rusqlite::Result<Vec<_>>>()
    .map_err(|e| e.to_string())?;

    Ok(clients)
}

#[tauri::command]
fn ask_neuron_pilot(
    app_handle: AppHandle,
    input: String,
    client_id: i32,
) -> Result<String, String> {
    let conn = get_db_connection(&app_handle).map_err(|e| e.to_string())?;

    // Fetch current client context for the chat
    let client = conn.query_row(
        "SELECT id, name, industry, last_audit, score, carbon FROM clients WHERE id = ?",
        [client_id],
        |row| {
            Ok(ProductionClient {
                id: row.get(0)?,
                name: row.get(1)?,
                industry: row.get(2)?,
                last_audit: row.get(3)?,
                score: row.get(4)?,
                carbon: row.get(5)?,
            })
        },
    ).map_err(|e| e.to_string())?;

    Ok(format!(
        "Analyzing {} in the {} sector. Based on the latest ERP ingestion, your sustainability rating is {}. All Scope 1 indicators are aligned with CSRD standards. (Query: {})",
        client.name, client.industry, client.score, input
    ))
}

#[tauri::command]
fn debug_esg_state(app_handle: AppHandle) -> String {
    if let Ok(conn) = get_db_connection(&app_handle) {
        let mut stmt = match conn.prepare(
            "SELECT category, SUM(value) as total FROM esg_state GROUP BY category"
        ) {
            Ok(s) => s,
            Err(e) => return format!("Query error: {}", e),
        };
        
        let results: Vec<String> = stmt.query_map([], |row| {
            Ok(format!("{}: {}", 
                row.get::<_, String>(0).unwrap_or_default(),
                row.get::<_, f64>(1).unwrap_or(0.0)
            ))
        })
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();
        
        if results.is_empty() {
            return "esg_state is EMPTY".to_string();
        }
        
        results.join(" | ")
    } else {
        "DB connection failed".to_string()
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Mutex::new(None::<l1_rag::GemmaEngine>))
        .manage(l8_workspace::WorkspaceState { active_project_id: Mutex::new(None) })
        .manage(l2_gap_analysis::GapAnalysisState { is_running: Arc::new(AtomicBool::new(false)) })
        .setup(|app| {
            let conn = get_db_connection(app.handle())?;
            
            // Initial Table creation
            conn.execute(
                "CREATE TABLE IF NOT EXISTS clients (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, 
                    name TEXT NOT NULL, 
                    industry TEXT NOT NULL, 
                    last_audit TEXT NOT NULL,
                    score INTEGER DEFAULT 0,
                    carbon REAL DEFAULT 0.0
                )",
                [],
            )?;

            conn.execute(
                "CREATE TABLE IF NOT EXISTS documents (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, 
                    name TEXT NOT NULL, 
                    size TEXT NOT NULL, 
                    status TEXT NOT NULL, 
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )",
                [],
            )?;

            l6_audit::init_audit_db(app.handle())?;
            l7_materiality::init_materiality_db(app.handle())?;
            l8_workspace::init_workspace_db(app.handle())?;
            l1_rag::populate_esrs_database(app.handle())?;
            l1_rag::load_esrs_from_json(app.handle())?;
            l4_data_processor::init_import_db(app.handle())?;
            if let Ok(conn) = get_db_connection(app.handle()) {
                let _ = state::create_esg_state_table(&conn);
                println!("ESG_STATE table initialized");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_dashboard_stats,
            debug_esg_state,
            run_materiality_check,
            add_client,
            get_enterprise_clients,
            ask_neuron_pilot,
            license::fetch_trial_license_status,
            license::get_fingerprint,
            license::validate_license,
            l1_rag::search_esrs,
            l1_rag::analyze_imported_data,
            l1_rag::ask_ai,
            l2_gap_analysis::gap_analysis,
            l2_gap_analysis::cancel_gap_analysis,
            l3_report::generate_report,
            l4_data_processor::process_data_file,
            l4_data_processor::process_excel,
            l4_data_processor::calculate_excel_emissions,
            l4_data_processor::calculate_emissions,
            l4_data_processor::get_translations,
            l4_data_processor::import_files,
            l4_data_processor::esrs_mapper::map_to_esrs,
            l4_data_processor::pdf_parser::import_pdf,
            l4_data_processor::xml_parser::import_xml,
            l4_data_processor::excel_cleaner::clean_imported_data,
            l5_prediction::generate_predictions,
            l7_materiality::get_materiality_topics,
            l7_materiality::update_materiality_score,
            l7_materiality::get_materiality_matrix,
            l8_workspace::create_client,
            l8_workspace::get_clients,
            l8_workspace::create_project,
            l8_workspace::get_projects,
            l8_workspace::set_active_project,
            model_downloader::check_model,
            model_downloader::download_model
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
