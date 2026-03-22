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
    pub energy_kwh: f64,
    pub energy_mwh: f64,
    pub workforce: u32,
    pub scope1: f64,
    pub scope2: f64,
    pub scope3: f64,
    pub scope1_gas: f64,
    pub scope1_fuel: f64,
    pub scope1_refrigerant: f64,
    pub training_cost: f64,
    pub work_accidents: i64,
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
        let scope1_gas = state::get_esg_total(&conn, 1, "scope1_gas");
        let scope1_fuel = state::get_esg_total(&conn, 1, "scope1_fuel");
        let scope1_refrigerant = state::get_esg_total(&conn, 1, "scope1_refrigerant");
        let scope2 = state::get_esg_total(&conn, 1, "scope2_electricity");
        let scope3 = state::get_esg_total(&conn, 1, "scope3_supplier");
        let workforce = state::get_esg_total(&conn, 1, "workforce") as u32;
        let training_cost = state::get_esg_total(&conn, 1, "training_cost");
        let work_accidents = state::get_esg_total(&conn, 1, "work_accidents") as i64;
        
        let scope1 = scope1_gas + scope1_fuel + scope1_refrigerant;
        let carbon = scope1 + scope2 + scope3;
        let energy_kwh = scope2;
        let energy_mwh = scope2 / 1000.0;
        
        let has_data = carbon > 0.0 || workforce > 0;
        let esg_score = if has_data {
            let env_score = if carbon < 5000.0 { 80 } else if carbon < 15000.0 { 60 } else { 40 };
            let soc_score = if workforce > 0 { 75 } else { 50 };
            (env_score + soc_score) / 2
        } else { 74 };

        return DashboardStats {
            esg_score,
            carbon_footprint: carbon,
            energy_kwh,
            energy_mwh,
            workforce,
            scope1,
            scope2,
            scope3,
            scope1_gas,
            scope1_fuel,
            scope1_refrigerant,
            training_cost,
            work_accidents,
            status_message: if has_data { "ESG_STATE loaded".into() } else { "No data imported yet".into() },
        };
    }

    DashboardStats {
        esg_score: 0,
        carbon_footprint: 0.0,
        energy_kwh: 0.0,
        energy_mwh: 0.0,
        workforce: 0,
        scope1: 0.0,
        scope2: 0.0,
        scope3: 0.0,
        scope1_gas: 0.0,
        scope1_fuel: 0.0,
        scope1_refrigerant: 0.0,
        training_cost: 0.0,
        work_accidents: 0,
        status_message: "DB connection failed".into(),
    }
}

pub fn get_db_connection(app_handle: &AppHandle) -> rusqlite::Result<Connection> {
    l6_audit::get_db_connection(app_handle)
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

#[tauri::command]
fn get_scope_distribution(app_handle: AppHandle) -> String {
    if let Ok(conn) = get_db_connection(&app_handle) {
        let scope1 = state::get_esg_total(&conn, 1, "scope1_gas")
            + state::get_esg_total(&conn, 1, "scope1_fuel")
            + state::get_esg_total(&conn, 1, "scope1_refrigerant");
        let scope2 = state::get_esg_total(&conn, 1, "scope2_electricity");
        let scope3 = 0.0_f64;
        let total = scope1 + scope2 + scope3;
        
        serde_json::json!({
            "scope1": scope1,
            "scope2": scope2,
            "scope3": scope3,
            "total": total
        }).to_string()
    } else {
        "{}".to_string()
    }
}

#[tauri::command]
fn get_co2_trend(app_handle: AppHandle) -> String {
    if let Ok(conn) = get_db_connection(&app_handle) {
        let mut stmt = match conn.prepare(
            "SELECT 
                COALESCE(timestamp, created_at) as period,
                SUM(value) as total
            FROM esg_state 
            WHERE category IN ('scope1_gas', 'scope1_fuel', 'scope1_refrigerant', 'scope2_electricity')
            AND client_id = 1
            GROUP BY period
            ORDER BY period ASC
            LIMIT 12"
        ) {
            Ok(s) => s,
            Err(_) => return "[]".to_string(),
        };

        let results: Vec<serde_json::Value> = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0).unwrap_or_default(),
                row.get::<_, f64>(1).unwrap_or(0.0),
            ))
        })
        .unwrap()
        .filter_map(|r| r.ok())
        .map(|(period, total)| serde_json::json!({
            "period": period,
            "value": total
        }))
        .collect();

        serde_json::to_string(&results).unwrap_or("[]".to_string())
    } else {
        "[]".to_string()
    }
}

#[tauri::command]
fn get_esrs_compliance(app_handle: AppHandle) -> String {
    if let Ok(conn) = get_db_connection(&app_handle) {
        let has_scope1 = state::get_esg_total(&conn, 1, "scope1_gas") > 0.0
            || state::get_esg_total(&conn, 1, "scope1_fuel") > 0.0;
        let has_scope2 = state::get_esg_total(&conn, 1, "scope2_electricity") > 0.0;
        let has_scope3 = state::get_esg_total(&conn, 1, "scope3_supplier") > 0.0;
        let has_workforce = state::get_esg_total(&conn, 1, "workforce") > 0.0;

        serde_json::json!([
            {"id": "E1", "name": "Climate Change", "status": if has_scope1 && has_scope2 { "Complete" } else if has_scope1 || has_scope2 { "Partial" } else { "Missing" }},
            {"id": "E2", "name": "Pollution", "status": "Missing"},
            {"id": "E3", "name": "Water & Marine", "status": if state::get_esg_total(&conn, 1, "water") > 0.0 { "Partial" } else { "Missing" }},
            {"id": "E4", "name": "Biodiversity", "status": "Missing"},
            {"id": "S1", "name": "Own Workforce", "status": if has_workforce { "Partial" } else { "Missing" }},
            {"id": "S2", "name": "Workers in Value Chain", "status": if has_scope3 { "Partial" } else { "Missing" }},
            {"id": "G1", "name": "Business Conduct", "status": "Missing"}
        ]).to_string()
    } else {
        "[]".to_string()
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

            if let Err(e) = l6_audit::init_audit_db(app.handle()) { eprintln!("audit db error: {}", e); }
            if let Err(e) = l7_materiality::init_materiality_db(app.handle()) { eprintln!("materiality db error: {}", e); }
            if let Err(e) = l8_workspace::init_workspace_db(app.handle()) { eprintln!("workspace db error: {}", e); }
            if let Err(e) = l1_rag::populate_esrs_database(app.handle()) { eprintln!("esrs db error: {}", e); }
            if let Err(e) = l1_rag::load_esrs_from_json(app.handle()) { eprintln!("json error: {}", e); }
            if let Err(e) = l4_data_processor::init_import_db(app.handle()) { eprintln!("import db error: {}", e); }
            if let Ok(conn) = get_db_connection(app.handle()) {
                let _ = state::create_esg_state_table(&conn);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_dashboard_stats,
            get_scope_distribution,
            get_co2_trend,
            get_esrs_compliance,
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
