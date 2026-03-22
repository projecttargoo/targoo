use serde::{Deserialize, Serialize};
use tauri::{command, State, AppHandle, Manager};
use std::sync::Mutex;
use std::path::PathBuf;
use llama_cpp::{LlamaModel, LlamaParams, SessionParams, standard_sampler::StandardSampler};
use crate::l6_audit::get_db_connection;
use rusqlite::Connection;

mod esrs_data;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EsrsDocument {
    pub id: i32,
    pub topic: String,
    pub standard_code: String,
    pub content: String,
    pub requirement_level: String,
    pub applicable_company_size: String,
}

#[derive(Debug, Deserialize)]
pub struct EsrsJsonRecord {
    pub topic: String,
    pub code: String,
    pub content: String,
    pub level: String,
    pub size: String,
    pub jurisdiction: String,
}

pub fn load_esrs_from_json(app_handle: &AppHandle) -> Result<(), String> {
    let conn = get_db_connection(app_handle).map_err(|e| e.to_string())?;

    let esrs_path = match app_handle.path().resource_dir() {
        Ok(p) => {
            let mut path: PathBuf = p;
            path.push("data");
            path.push("esrs");
            path
        },
        Err(_) => return Ok(()),
    };

    if !esrs_path.exists() {
        return Ok(());
    }

    let entries = std::fs::read_dir(esrs_path).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
            let json_str = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
            let records: Vec<EsrsJsonRecord> = serde_json::from_str(&json_str).map_err(|e| e.to_string())?;
            
            for record in records {
                conn.execute(
                    "INSERT OR IGNORE INTO esrs_knowledge (topic, standard_code, content, language, requirement_level, applicable_company_size) 
                     VALUES (?, ?, ?, 'en', ?, ?)",
                    [record.topic, record.code, record.content, record.level, record.size],
                ).map_err(|e| e.to_string())?;
            }
        }
    }

    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub results: Vec<EsrsDocument>,
}

pub struct GemmaEngine {
    pub model: LlamaModel,
}

pub fn init_gemma(model_path: &str) -> Result<GemmaEngine, String> {
    // Memory Efficiency: llama_cpp handles GGUF. We use default params for i3/4GB compatibility.
    let model = LlamaModel::load_from_file(model_path, LlamaParams::default())
        .map_err(|e| format!("Failed to load model: {:?}", e))?;
    Ok(GemmaEngine { model })
}

/// Summarizes esg_state totals for RAG context
fn get_client_context(conn: &Connection, client_id: i32) -> String {
    let gas = crate::state::get_esg_total(conn, client_id, "scope1_gas");
    let fuel = crate::state::get_esg_total(conn, client_id, "scope1_fuel");
    let ref_raw = crate::state::get_esg_total(conn, client_id, "scope1_refrigerant");
    let electricity = crate::state::get_esg_total(conn, client_id, "scope2_electricity");
    let scope3 = crate::state::get_esg_total(conn, client_id, "scope3_supplier");
    let workforce = crate::state::get_esg_total(conn, client_id, "workforce");

    // Convert to tCO2e for consistency in AI interpretation
    let s1_gas_co2 = (gas * 2.04) / 1000.0;
    let s1_fuel_co2 = (fuel * 2.68) / 1000.0;
    let s1_ref_co2 = (ref_raw * 2088.0) / 1000.0;
    let s2_co2 = (electricity * 0.276) / 1000.0;
    let total_carbon = s1_gas_co2 + s1_fuel_co2 + s1_ref_co2 + s2_co2 + scope3;

    format!(
        "Client Context (Current SSOT):\n- Total Carbon Footprint: {:.2} tCO2e\n- Scope 1 (Direct): {:.2} tCO2e\n- Scope 2 (Energy): {:.2} tCO2e\n- Scope 3 (Value Chain): {:.2} tCO2e\n- Total Workforce: {:.0} employees\n",
        total_carbon, (s1_gas_co2 + s1_fuel_co2 + s1_ref_co2), s2_co2, scope3, workforce
    )
}

pub fn ask_gemma(engine: &GemmaEngine, question: &str, full_context: &str) -> Result<String, String> {
    let system_prompt = "You are Targoo ESG Advisor. Answer only based on the provided ESRS knowledge and Client context. Be concise and German-auditor style. Cite specific ESRS codes (e.g., E1-1) when possible.";
    
    // Gemma 2 Prompt Template
    let prompt = format!(
        "<start_of_turn>user\n{} \n\nContext:\n{}\n\nQuestion:\n{}<end_of_turn>\n<start_of_turn>model\n",
        system_prompt, full_context, question
    );

    let mut session = engine.model.create_session(SessionParams::default())
        .map_err(|e| format!("Failed to create session: {:?}", e))?;

    session.advance_context(&prompt)
        .map_err(|e| format!("Failed to advance context: {:?}", e))?;

    let completions = session.start_completing_with(StandardSampler::default(), 1024)
        .map_err(|e| format!("Failed to start completion: {:?}", e))?
        .into_strings();

    let mut response = String::new();
    for completion in completions {
        response.push_str(&completion);
        if response.len() > 5000 { break; } 
    }

    Ok(response.trim().to_string())
}

pub fn populate_esrs_database(app_handle: &AppHandle) -> Result<(), String> {
    let conn = get_db_connection(app_handle).map_err(|e| e.to_string())?;
    
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM esrs_knowledge", [], |row| row.get(0)).unwrap_or(0);
    if count > 100 { 
        return Ok(());
    }

    let data = esrs_data::get_esrs_paragraphs();

    for (topic, code, content, level, size) in data {
        conn.execute(
            "INSERT OR IGNORE INTO esrs_knowledge (topic, standard_code, content, language, requirement_level, applicable_company_size) 
             VALUES (?, ?, ?, 'en', ?, ?)",
            [topic, code, content, level, size],
        ).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

pub fn get_search_results(app_handle: AppHandle, query: String) -> Result<Vec<EsrsDocument>, String> {
    let conn = get_db_connection(&app_handle).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT rowid, topic, standard_code, content, requirement_level, applicable_company_size FROM esrs_knowledge WHERE esrs_knowledge MATCH ? LIMIT 5")
        .map_err(|e| e.to_string())?;

    let results = stmt.query_map([query], |row| {
        Ok(EsrsDocument {
            id: row.get(0)?,
            topic: row.get(1)?,
            standard_code: row.get(2)?,
            content: row.get(3)?,
            requirement_level: row.get(4)?,
            applicable_company_size: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect::<Vec<EsrsDocument>>();

    Ok(results)
}

#[command]
pub fn search_esrs(app_handle: AppHandle, query: String) -> Result<String, String> {
    let results = get_search_results(app_handle, query)?;
    let search_result = SearchResult { results };
    serde_json::to_string(&search_result).map_err(|e| e.to_string())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnalysisResult {
    pub compliant: Vec<String>,
    pub missing: Vec<String>,
    pub warnings: Vec<String>,
    pub proactive_message: String,
}

#[command]
pub async fn analyze_imported_data(
    app_handle: AppHandle,
    client_id: i32,
    engine_state: State<'_, Mutex<Option<GemmaEngine>>>
) -> Result<AnalysisResult, String> {
    let conn = get_db_connection(&app_handle).map_err(|e| e.to_string())?;
    
    let client_context = get_client_context(&conn, client_id);

    let mut compliant = Vec::new();
    let mut missing = Vec::new();
    let warnings = Vec::new();

    // Logic-based checks for the UI
    let workforce = crate::state::get_esg_total(&conn, client_id, "workforce");
    let total_carbon = crate::state::get_esg_total(&conn, client_id, "scope1_gas") + crate::state::get_esg_total(&conn, client_id, "scope2_electricity");

    if total_carbon > 0.0 { compliant.push("ESRS E1 Greenhouse Gas data detected.".into()); }
    else { missing.push("ESRS E1: Mandatory Carbon data missing.".into()); }

    if workforce > 0.0 { compliant.push("ESRS S1 Workforce headcount detected.".into()); }
    else { missing.push("ESRS S1: Mandatory Workforce data missing.".into()); }

    let engine_lock = engine_state.lock().map_err(|e| e.to_string())?;
    let proactive_message = if let Some(engine) = engine_lock.as_ref() {
        let question = "Analyze this client's ESG standing and provide a 2-sentence auditor summary.";
        ask_gemma(engine, question, &client_context)?
    } else {
        "AI Engine offline. Basic compliance check complete.".to_string()
    };

    Ok(AnalysisResult {
        compliant,
        missing,
        warnings,
        proactive_message,
    })
}

#[command]
pub async fn ask_ai(
    app_handle: AppHandle,
    question: String,
    client_id: i32,
    engine_state: State<'_, Mutex<Option<GemmaEngine>>>
) -> Result<String, String> {
    // Step 1: Database Connections
    let conn = get_db_connection(&app_handle).map_err(|e| e.to_string())?;
    
    // Step 2: Get esg_state summary for the client (SSOT Context)
    let client_context = get_client_context(&conn, client_id);

    // Step 3: FTS5 search in esrs_knowledge for relevant paragraphs
    let esrs_results = get_search_results(app_handle, question.clone())?;
    let esrs_context = if esrs_results.is_empty() {
        "No specific ESRS regulatory text found for this query.".to_string()
    } else {
        esrs_results.iter()
            .map(|doc| format!("[{}] {}", doc.standard_code, doc.content))
            .collect::<Vec<_>>()
            .join("\n\n")
    };

    let full_context = format!(
        "{}\n\nRelevant Regulatory Requirements (ESRS):\n{}",
        client_context, esrs_context
    );

    // Step 4: AI Inference
    let engine_lock = engine_state.lock().map_err(|e| e.to_string())?;
    
    let ai_response = if let Some(engine) = engine_lock.as_ref() {
        ask_gemma(engine, &question, &full_context)?
    } else {
        return Ok(format!(
            "**AI Engine Offline.**\n\nI can still provide the context found:\n\n{}\n\n{}",
            client_context, esrs_context
        ));
    };

    Ok(format!("{}\n\n---\n*Certified response by Targoo Local Intelligence Bridge.*", ai_response))
}
