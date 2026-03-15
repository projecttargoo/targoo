use tauri::{AppHandle, Manager, Runtime, Emitter};
use std::fs;
use std::io::Write;
use sha2::{Sha256, Digest};
use futures_util::StreamExt;
use reqwest::Client;

const MODEL_URL: &str = "https://github.com/projecttargoo/models/releases/download/v1.0.0/gemma-3-1b-it-q4_k_m.gguf";
const MODEL_FILENAME: &str = "gemma-3-1b-it-q4_k_m.gguf";
// Placeholder SHA256 - should be updated with actual hash
const MODEL_SHA256: &str = "4e68e4c7d8a6... (placeholder)";

#[tauri::command]
pub async fn check_model<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let model_path = app_dir.join("models").join(MODEL_FILENAME);

    if model_path.exists() {
        Ok("ready".to_string())
    } else {
        Ok("not_found".to_string())
    }
}

#[tauri::command]
pub async fn download_model<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let models_dir = app_dir.join("models");
    
    if !models_dir.exists() {
        fs::create_dir_all(&models_dir).map_err(|e| e.to_string())?;
    }
    
    let model_path = models_dir.join(MODEL_FILENAME);
    let client = Client::new();
    let response = client.get(MODEL_URL).send().await.map_err(|e| e.to_string())?;
    
    let total_size = response.content_length().ok_or("Failed to get content length")?;
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();
    let mut file = fs::File::create(&model_path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        hasher.update(&chunk);
        
        downloaded += chunk.len() as u64;
        let progress = (downloaded as f64 / total_size as f64) * 100.0;
        app.emit("download_progress", progress).map_err(|e| e.to_string())?;
    }

    // Hash verification (simplified for placeholder)
    let hash_result = format!("{:x}", hasher.finalize());
    println!("Downloaded hash: {}", hash_result);
    
    // Initialize the AI Engine after download
    if let Ok(engine) = crate::l1_rag::init_gemma(model_path.to_str().unwrap_or_default()) {
        let engine_state = app.state::<std::sync::Mutex<Option<crate::l1_rag::GemmaEngine>>>();
        if let Ok(mut lock) = engine_state.lock() {
            *lock = Some(engine);
        };
    }

    Ok("ready".to_string())
}
