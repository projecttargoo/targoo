use tauri::Manager;
use std::sync::Mutex;

mod l1_rag;
mod l2_gap_analysis;
mod l3_report;
mod l4_data_processor;
mod l5_prediction;
mod l6_audit;
mod license;
mod model_downloader;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Mutex::new(None::<l1_rag::GemmaEngine>))
        .setup(|app| {
            l6_audit::init_audit_db(app.handle())?;
            l1_rag::populate_esrs_database(app.handle())?;
            l1_rag::load_esrs_from_json(app.handle())?;

            // Try to initialize Gemma engine if model exists
            let app_handle = app.handle().clone();
            let app_dir = app_handle.path().app_data_dir().unwrap_or_default();
            let model_path = app_dir.join("models").join("gemma-3-1b-it-q4_k_m.gguf");

            if model_path.exists() {
                if let Ok(engine) = l1_rag::init_gemma(model_path.to_str().unwrap_or_default()) {
                    let engine_state = app_handle.state::<Mutex<Option<l1_rag::GemmaEngine>>>();
                    if let Ok(mut lock) = engine_state.lock() {
                        *lock = Some(engine);
                    };
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            license::fetch_trial_license_status,
            license::get_fingerprint,
            license::validate_license,
            l1_rag::search_esrs,
            l1_rag::ask_ai,
            l2_gap_analysis::gap_analysis,
            l3_report::generate_report,
            l4_data_processor::process_excel,
            l4_data_processor::calculate_excel_emissions,
            l4_data_processor::calculate_emissions,
            l4_data_processor::get_translations,
            l4_data_processor::import_files,
            l5_prediction::generate_predictions,
            model_downloader::check_model,
            model_downloader::download_model
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
