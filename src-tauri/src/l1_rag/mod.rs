use serde::{Deserialize, Serialize};
use tauri::{command, State, AppHandle};
use std::sync::Mutex;
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

    let base_path = std::env::current_dir().map_err(|e| e.to_string())?;
    let esrs_path = if base_path.ends_with("src-tauri") {
        base_path.join("data").join("esrs")
    } else {
        base_path.join("src-tauri").join("data").join("esrs")
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

#[command]
pub async fn ask_ai(
    app_handle: AppHandle,
    question: String,
    engine_state: State<'_, Mutex<Option<GemmaEngine>>>
) -> Result<String, String> {
    let results = match get_search_results(app_handle, question.clone()) {
        Ok(res) => res,
        Err(e) => return Err(e),
    };
    
    let context = if results.is_empty() {
        "No specific ESRS paragraph found. Answer based on general ESRS knowledge if possible.".to_string()
    } else {
        results.iter()
            .map(|doc| format!("[{}] {}", doc.standard_code, doc.content))
            .collect::<Vec<_>>()
            .join("\n\n")
    };

    let engine_lock = engine_state.lock().map_err(|e| e.to_string())?;
    let engine = engine_lock.as_ref().ok_or("AI Engine not initialized. Please wait for model download.")?;

    let ai_response = ask_gemma(engine, &question, &context)?;

    let mut final_response = ai_response;
    final_response.push_str("\n\n---\n*Note: This response is generated by Gemma 3 ESG Engine using local RAG.*");

    Ok(final_response)
}
