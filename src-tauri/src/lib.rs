mod l1_rag;
mod l2_gap_analysis;
mod l3_report;
mod l4_data_processor;
mod l5_prediction;
mod l6_audit;
mod license;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            license::fetch_trial_license_status,
            license::get_fingerprint,
            l1_rag::search_esrs,
            l1_rag::ask_ai,
            l2_gap_analysis::gap_analysis,
            l3_report::generate_report,
            l4_data_processor::process_excel,
            l5_prediction::generate_predictions
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
