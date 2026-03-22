use serde::{Deserialize, Serialize};
use tauri::{command, State, AppHandle, Manager};
use std::sync::Mutex;
use std::path::PathBuf;
use llama_cpp::{LlamaModel, LlamaParams, SessionParams, standard_sampler::StandardSampler};
use crate::l6_audit::get_db_connection;

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

    // Fix: NEVER use current_dir() in production. Use resource_dir() or skip.
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
    let model = LlamaModel::load_from_file(model_path, LlamaParams::default())
        .map_err(|e| format!("Failed to load model: {:?}", e))?;
    Ok(GemmaEngine { model })
}

pub fn ask_gemma(engine: &GemmaEngine, question: &str, esrs_context: &str) -> Result<String, String> {
    let system_prompt = "You are a Junior ESG Engineer specialized in ESRS and CSRD compliance. Always cite paragraph numbers like ESRS E1.47. Never hallucinate - only answer from provided context. Be concise and professional.";
    
    let prompt = format!(
        "<start_of_turn>user\n{} \n\nContext:\n{}\n\nQuestion:\n{}<end_of_turn>\n<start_of_turn>model\n",
        system_prompt, esrs_context, question
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
        if response.len() > 5000 { break; } // Safety limit
    }

    Ok(response)
}

pub fn populate_esrs_database(app_handle: &AppHandle) -> Result<(), String> {
    let conn = get_db_connection(app_handle).map_err(|e| e.to_string())?;
    
    // Check if already populated (using a simple count)
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
        .prepare("SELECT rowid, topic, standard_code, content, requirement_level, applicable_company_size FROM esrs_knowledge WHERE esrs_knowledge MATCH ? LIMIT 10")
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
    let results = match get_search_results(app_handle, query) {
        Ok(res) => res,
        Err(e) => return Err(e),
    };
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
    
    // SSOT Data Context: Query the esg_state for the current client_id
    let gas_raw = crate::state::get_esg_total(&conn, client_id, "scope1_gas");
    let fuel_raw = crate::state::get_esg_total(&conn, client_id, "scope1_fuel");
    let ref_raw = crate::state::get_esg_total(&conn, client_id, "scope1_refrigerant");
    let elec_raw = crate::state::get_esg_total(&conn, client_id, "scope2_electricity");
    let scope3 = crate::state::get_esg_total(&conn, client_id, "scope3_supplier");
    let workforce = crate::state::get_esg_total(&conn, client_id, "workforce");
    let training_cost = crate::state::get_esg_total(&conn, client_id, "training_cost");

    // Carbon Footprint calculation using Emission Factors (tCO2e)
    let gas_co2 = (gas_raw * 2.04) / 1000.0;
    let fuel_co2 = (fuel_raw * 2.68) / 1000.0;
    let ref_co2 = (ref_raw * 2088.0) / 1000.0;
    let scope2_co2 = (elec_raw * 0.276) / 1000.0;
    
    let total_carbon = gas_co2 + fuel_co2 + ref_co2 + scope2_co2 + scope3;

    let mut compliant = Vec::new();
    let mut missing = Vec::new();
    let warnings = Vec::new();
    let mut insights = Vec::new();

    // ESRS Compliance Checks
    if total_carbon > 0.0 {
        compliant.push("Scope 1 & 2 emissions data found - ESRS E1.44 compliant".to_string());
    } else {
        missing.push("Missing mandatory greenhouse gas emissions data (ESRS E1.44)".to_string());
    }

    if workforce > 0.0 {
        compliant.push("Workforce headcount data found - ESRS S1.1 compliant".to_string());
    } else {
        missing.push("Missing mandatory workforce data (ESRS S1.1)".to_string());
    }

    // Rule-Based Insights
    if total_carbon > 0.0 && gas_co2 > (total_carbon * 0.5) {
        insights.push("High dependency on fossil heating detected. (Ref: ESRS E1.44)".to_string());
    }

    if workforce > 100.0 && training_cost == 0.0 {
        insights.push("Missing mandatory S1 Development data for large workforce. (Ref: ESRS S1.13)".to_string());
    }

    let summary_context = format!(
        "ESG Profile for Client {}:\n- Total Carbon: {:.2} tCO2e\n- Scope 1 Gas: {:.2} tCO2e\n- Workforce: {:.0}\n- Training Cost: {:.2} EUR\n\nRule-based Insights:\n{}",
        client_id, total_carbon, gas_co2, workforce, training_cost, insights.join("\n")
    );

    let engine_lock = engine_state.lock().map_err(|e| e.to_string())?;
    let proactive_message = if let Some(engine) = engine_lock.as_ref() {
        let question = "Analyze these ESG metrics and insights. Provide a professional executive summary citing relevant ESRS paragraphs.";
        ask_gemma(engine, question, &summary_context)?
    } else {
        format!(
            "**Rule-based Advisory Notice**\n\n{}\n\n*Note: AI Engine is offline. These results are generated via rule-based heuristics.*",
            summary_context
        )
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
    let conn = get_db_connection(&app_handle).map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT category, SUM(COALESCE(normalized_value, value)), COALESCE(normalized_unit, unit) 
         FROM esg_state 
         WHERE client_id = ?1 
         GROUP BY category"
    ).map_err(|e| e.to_string())?;
    
    let imported_rows = stmt.query_map([client_id], |row| {
        Ok(format!("{}: {} {}", 
            row.get::<_, String>(0)?, 
            row.get::<_, f64>(1)?, 
            row.get::<_, String>(2)?))
    }).map_err(|e| e.to_string())?;
    
    let mut imported_context = String::new();
    for row in imported_rows {
        imported_context.push_str(&row.map_err(|e| e.to_string())?);
        imported_context.push('\n');
    }

    if imported_context.is_empty() {
        imported_context = "No client data found in esg_state.".to_string();
    }

    let results = match get_search_results(app_handle, question.clone()) {
        Ok(res) => res,
        Err(e) => return Err(e),
    };
    
    let esrs_context = if results.is_empty() {
        "No specific ESRS paragraph found.".to_string()
    } else {
        results.iter()
            .map(|doc| format!("[{}] {}", doc.standard_code, doc.content))
            .collect::<Vec<_>>()
            .join("\n\n")
    };

    let full_context = format!(
        "Imported Company Data:\n{}\n\nRelevant ESRS Knowledge:\n{}",
        imported_context, esrs_context
    );

    let engine_lock = engine_state.lock().map_err(|e| e.to_string())?;
    
    if engine_lock.as_ref().is_none() {
        return Ok(format!(
            "**AI Engine Offline.**\n\n*Rule-based ESRS Results:*\n{}\n\n*Current Client Data:*\n{}",
            esrs_context, imported_context
        ));
    }

    let engine = engine_lock.as_ref().unwrap();
    let ai_response = ask_gemma(engine, &question, &full_context)?;

    let mut final_response = ai_response;
    final_response.push_str("\n\n---\n*Note: This response is generated by Gemma 3 ESG Engine using local RAG and esg_state context.*");

    Ok(final_response)
}
