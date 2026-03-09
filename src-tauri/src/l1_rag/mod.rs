use serde::{Deserialize, Serialize};
use rusqlite::Connection;
use tauri::{command, State};
use std::sync::Mutex;
use llama_cpp::{LlamaModel, LlamaParams, SessionParams, standard_sampler::StandardSampler};

#[derive(Debug, Serialize, Deserialize, Clone)]
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

pub fn get_search_results(query: String) -> Result<Vec<EsrsDocument>, String> {
    let conn = Connection::open_in_memory().map_err(|e| e.to_string())?;
    
    conn.execute("CREATE VIRTUAL TABLE esrs_fts USING fts5(topic, paragraph_number, content)", [])
        .map_err(|e| e.to_string())?;

    let mock_data = vec![
        ("ESRS E1: Climate change", "E1-1 Para 16", "The undertaking shall disclose its transition plan for climate change mitigation, including its ambition to ensure that its business model and strategy are compatible with the transition to a sustainable economy."),
        ("ESRS E1: Climate change", "E1-4 Para 34", "The undertaking shall disclose the climate-related targets it has set, including GHG emission reduction targets for 2030 and 2050."),
        ("ESRS E1: Climate change", "E1-5 Para 40", "The undertaking shall provide information on its energy consumption and mix, including total energy consumption from non-renewable sources and renewable sources in MWh."),
        ("ESRS E1: Climate change", "E1-6 Para 44", "The undertaking shall disclose its gross Scope 1, 2, 3 and total GHG emissions in metric tonnes of CO2 equivalent."),
    ];

    for (topic, para, content) in mock_data {
        conn.execute(
            "INSERT INTO esrs_fts (topic, paragraph_number, content) VALUES (?, ?, ?)",
            [topic, para, content],
        ).map_err(|e| e.to_string())?;
    }

    let mut stmt = conn
        .prepare("SELECT rowid, topic, paragraph_number, content FROM esrs_fts WHERE esrs_fts MATCH ? LIMIT 5")
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

    Ok(results)
}

#[command]
pub fn search_esrs(query: String) -> Result<String, String> {
    let results = get_search_results(query)?;
    let search_result = SearchResult { results };
    serde_json::to_string(&search_result).map_err(|e| e.to_string())
}

#[command]
pub async fn ask_ai(
    question: String,
    engine_state: State<'_, Mutex<Option<GemmaEngine>>>
) -> Result<String, String> {
    let results = get_search_results(question.clone())?;
    
    let context = if results.is_empty() {
        "No specific ESRS paragraph found. Answer based on general ESRS knowledge if possible.".to_string()
    } else {
        results.iter()
            .map(|doc| format!("[{}] {}", doc.paragraph_number, doc.content))
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
