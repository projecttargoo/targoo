pub mod l1_rag;
pub mod l2_gap_analysis;
pub mod l3_report;
pub mod l4_data_processor;
pub mod l5_prediction;
pub mod l6_audit;

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
            l2_gap_analysis::gap_analysis
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
