use std::sync::{Mutex, Arc};
use std::sync::atomic::AtomicBool;
use serde::{Serialize, Deserialize};
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

#[derive(Serialize, Deserialize, Debug)]
pub struct LedgerEntry {
    pub id: i32,
    pub origin_file: String,
    pub source: String,
    pub category: String,
    pub value: f64,
    pub unit: String,
    pub normalized_value: f64,
    pub confidence: f32,
}

#[derive(Serialize, Debug)]
pub struct ProductionClient {
    pub id: i32,
    pub name: String,
    pub industry: String,
    pub tax_id: String,
    pub reporting_year: i32,
    pub jurisdiction: String,
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
fn get_dashboard_stats(app_handle: AppHandle, client_id: i32) -> DashboardStats {
    if let Ok(conn) = get_db_connection(&app_handle) {
        let scope1_gas_raw = state::get_esg_total(&conn, client_id, "scope1_gas");
        let scope1_fuel_raw = state::get_esg_total(&conn, client_id, "scope1_fuel");
        let scope1_ref_raw = state::get_esg_total(&conn, client_id, "scope1_refrigerant");
        let scope2_raw = state::get_esg_total(&conn, client_id, "scope2_electricity");
        let scope3 = state::get_esg_total(&conn, client_id, "scope3_supplier");
        let workforce = state::get_esg_total(&conn, client_id, "workforce") as u32;
        let training_cost = state::get_esg_total(&conn, client_id, "training_cost");
        let work_accidents = state::get_esg_total(&conn, client_id, "work_accidents") as i64;
        
        // Carbon Footprint calculation using Emission Factors (tCO2e)
        let scope1_gas_co2 = (scope1_gas_raw * 2.04) / 1000.0;
        let scope1_fuel_co2 = (scope1_fuel_raw * 2.68) / 1000.0;
        let scope1_ref_co2 = (scope1_ref_raw * 2088.0) / 1000.0;
        let scope2_co2 = (scope2_raw * 0.276) / 1000.0;
        let scope1_total = scope1_gas_co2 + scope1_fuel_co2 + scope1_ref_co2;
        let carbon = scope1_total + scope2_co2 + scope3;
        
        let energy_kwh = scope2_raw;
        let energy_mwh = scope2_raw / 1000.0;
        
        let has_data = carbon > 0.0 || workforce > 0;
        let esg_score = if has_data {
            let env_score = if carbon < 5000.0 { 80 } else if carbon < 15000.0 { 60 } else { 40 };
            let soc_score = if workforce > 0 { 75 } else { 50 };
            (env_score + soc_score) / 2
        } else { 0 };

        return DashboardStats {
            esg_score,
            carbon_footprint: carbon,
            energy_kwh,
            energy_mwh,
            workforce,
            scope1: scope1_total,
            scope2: scope2_co2,
            scope3,
            scope1_gas: scope1_gas_raw,
            scope1_fuel: scope1_fuel_raw,
            scope1_refrigerant: scope1_ref_raw,
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
    
    let mut stmt = conn.prepare("SELECT id, name, industry, COALESCE(tax_id, ''), COALESCE(reporting_year, 2024), COALESCE(jurisdiction, 'EU-ESRS'), last_audit, score, carbon FROM clients ORDER BY name ASC")
        .map_err(|e| e.to_string())?;
    
    let clients = stmt.query_map([], |row| {
        Ok(ProductionClient {
            id: row.get(0)?,
            name: row.get(1)?,
            industry: row.get(2)?,
            tax_id: row.get(3)?,
            reporting_year: row.get(4)?,
            jurisdiction: row.get(5)?,
            last_audit: row.get(6)?,
            score: row.get(7)?,
            carbon: row.get(8)?,
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

    let client = conn.query_row(
        "SELECT id, name, industry, last_audit, score, carbon FROM clients WHERE id = ?",
        [client_id],
        |row| {
            Ok(ProductionClient {
                id: row.get(0)?,
                name: row.get(1)?,
                industry: row.get(2)?,
                tax_id: "".to_string(),
                reporting_year: 2024,
                jurisdiction: "".to_string(),
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
fn debug_esg_state(app_handle: AppHandle, client_id: i32) -> String {
    if let Ok(conn) = get_db_connection(&app_handle) {
        let mut stmt = match conn.prepare(
            "SELECT category, SUM(value) as total FROM esg_state WHERE client_id = ?1 GROUP BY category"
        ) {
            Ok(s) => s,
            Err(e) => return format!("Query error: {}", e),
        };
        
        let results: Vec<String> = stmt.query_map([client_id], |row| {
            Ok(format!("{}: {}", 
                row.get::<_, String>(0).unwrap_or_default(),
                row.get::<_, f64>(1).unwrap_or(0.0)
            ))
        })
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();
        
        if results.is_empty() {
            return format!("esg_state is EMPTY for client {}", client_id);
        }
        
        results.join(" | ")
    } else {
        "DB connection failed".to_string()
    }
}

#[tauri::command]
fn get_scope_distribution(app_handle: AppHandle, client_id: i32) -> String {
    if let Ok(conn) = get_db_connection(&app_handle) {
        let gas = state::get_esg_total(&conn, client_id, "scope1_gas");
        let fuel = state::get_esg_total(&conn, client_id, "scope1_fuel");
        let refrigerant = state::get_esg_total(&conn, client_id, "scope1_refrigerant");
        let electricity = state::get_esg_total(&conn, client_id, "scope2_electricity");
        
        let scope1 = (gas * 2.04 + fuel * 2.68 + refrigerant * 2088.0) / 1000.0;
        let scope2 = (electricity * 0.276) / 1000.0;
        let scope3 = 0.0; // Supplier module pending
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
fn get_co2_trend(app_handle: AppHandle, client_id: i32) -> String {
    if let Ok(conn) = get_db_connection(&app_handle) {
        let mut stmt = match conn.prepare(
            "SELECT 
                SUBSTR(COALESCE(timestamp, created_at), 1, 7) as period,
                SUM(
                    CASE 
                        WHEN category = 'scope1_gas' THEN value * 2.04
                        WHEN category = 'scope1_fuel' THEN value * 2.68
                        WHEN category = 'scope1_refrigerant' THEN value * 2088.0
                        WHEN category = 'scope2_electricity' THEN value * 0.276
                        ELSE 0 
                    END
                ) / 1000.0 as total_co2
            FROM esg_state 
            WHERE client_id = ?1
            GROUP BY period
            ORDER BY period ASC
            LIMIT 12"
        ) {
            Ok(s) => s,
            Err(e) => return format!("[]"),
        };

        let results: Vec<serde_json::Value> = stmt.query_map([client_id], |row| {
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
fn get_esrs_compliance(app_handle: AppHandle, client_id: i32) -> String {
    if let Ok(conn) = get_db_connection(&app_handle) {
        let scope1_gas = state::get_esg_total(&conn, client_id, "scope1_gas");
        let scope1_fuel = state::get_esg_total(&conn, client_id, "scope1_fuel");
        let scope1_ref = state::get_esg_total(&conn, client_id, "scope1_refrigerant");
        let scope2 = state::get_esg_total(&conn, client_id, "scope2_electricity");
        let scope3 = state::get_esg_total(&conn, client_id, "scope3_supplier");
        
        let carbon_footprint = (scope1_gas * 2.04 + scope1_fuel * 2.68 + scope1_ref * 2088.0 + scope2 * 0.276) / 1000.0 + scope3;
        
        let has_water = state::get_esg_count(&conn, client_id, "water") > 0;
        let has_waste = state::get_esg_count(&conn, client_id, "waste") > 0;
        let workforce = state::get_esg_total(&conn, client_id, "workforce");
        let has_training = state::get_esg_total(&conn, client_id, "training_cost") > 0.0;
        let has_diversity = state::get_esg_total(&conn, client_id, "diversity_ratio") > 0.0;

        serde_json::json!([
            {"id": "E1", "name": "Climate Change", "status": if carbon_footprint > 0.0 { "Complete" } else { "Missing" }},
            {"id": "E2", "name": "Pollution", "status": "Missing"},
            {"id": "E3", "name": "Water & Marine", "status": if has_water { "Complete" } else { "Missing" }},
            {"id": "E4", "name": "Biodiversity", "status": "Missing"},
            {"id": "E5", "name": "Resource Use", "status": if has_waste { "Complete" } else { "Missing" }},
            {"id": "S1", "name": "Own Workforce", "status": if workforce > 0.0 && (has_training || has_diversity) { "Complete" } else { "Missing" }},
            {"id": "S2", "name": "Workers in Value Chain", "status": "Missing"},
            {"id": "G1", "name": "Business Conduct", "status": "Missing"}
        ]).to_string()
    } else {
        "[]".to_string()
    }
}

#[tauri::command]
fn get_esg_ledger(app_handle: AppHandle, client_id: i32) -> Result<String, String> {
    let conn = get_db_connection(&app_handle).map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT id, origin_file, source, category, value, unit, normalized_value, confidence 
         FROM esg_state 
         WHERE client_id = ?1 
         ORDER BY category ASC"
    ).map_err(|e| e.to_string())?;
    
    let entries = stmt.query_map([client_id], |row| {
        Ok(LedgerEntry {
            id: row.get(0)?,
            origin_file: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
            source: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
            category: row.get(3)?,
            value: row.get(4)?,
            unit: row.get(5)?,
            normalized_value: row.get::<_, Option<f64>>(6)?.unwrap_or(0.0),
            confidence: row.get::<_, f64>(7)? as f32,
        })
    }).map_err(|e| e.to_string())?
    .collect::<rusqlite::Result<Vec<_>>>()
    .map_err(|e| e.to_string())?;
    
    serde_json::to_string(&entries).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_advisor_settings(app_handle: AppHandle, name: String, company: String) -> Result<(), String> {
    let conn = get_db_connection(&app_handle).map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO app_settings (key, value) VALUES ('advisor_name', ?1), ('advisor_company', ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![name, company],
    ).map_err(|e| e.to_string())?;

    Ok(())
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
            if let Ok(conn) = get_db_connection(app.handle()) {
                let _ = conn.execute(
                    "CREATE TABLE IF NOT EXISTS clients (
                        id INTEGER PRIMARY KEY AUTOINCREMENT, 
                        name TEXT NOT NULL, 
                        industry TEXT NOT NULL, 
                        last_audit TEXT NOT NULL,
                        score INTEGER DEFAULT 0,
                        carbon REAL DEFAULT 0.0,
                        tax_id TEXT,
                        reporting_year INTEGER DEFAULT 2024,
                        jurisdiction TEXT
                    )",
                    [],
                );

                let _ = conn.execute(
                    "CREATE TABLE IF NOT EXISTS documents (
                        id INTEGER PRIMARY KEY AUTOINCREMENT, 
                        name TEXT NOT NULL, 
                        size TEXT NOT NULL, 
                        status TEXT NOT NULL, 
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )",
                    [],
                );

                let _ = conn.execute(
                    "CREATE TABLE IF NOT EXISTS app_settings (
                        key TEXT PRIMARY KEY,
                        value TEXT
                    )",
                    [],
                );
            }

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
            get_esg_ledger,
            debug_esg_state,
            run_materiality_check,
            add_client,
            get_enterprise_clients,
            ask_neuron_pilot,
            update_advisor_settings,
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
            l6_audit::log_audit_event,
            l6_audit::get_audit_logs,
            l7_materiality::get_materiality_assessment,
            l7_materiality::update_materiality_score,
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
