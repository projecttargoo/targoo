use serde::{Deserialize, Serialize};
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LicenseConfig {
    pub trial_start_date: u64,
    pub usage_count: u32,
    pub ai_queries_used: u32,
}

#[derive(Serialize)]
pub struct LicenseStatus {
    pub status: String,
    pub days_remaining: i64,
    pub usage_count: u32,
    pub ai_queries_used: u32,
}

fn get_license_path(app_handle: &tauri::AppHandle) -> std::path::PathBuf {
    let app_dir = app_handle.path().app_data_dir().expect("failed to get app data dir");
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir).expect("failed to create app data dir");
    }
    app_dir.join("license.json")
}

#[tauri::command]
pub fn fetch_trial_license_status(app_handle: tauri::AppHandle) -> Result<String, String> {
    let path = get_license_path(&app_handle);
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
    
    let config = if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str::<LicenseConfig>(&content).unwrap_or(LicenseConfig {
            trial_start_date: now,
            usage_count: 0,
            ai_queries_used: 0,
        })
    } else {
        let new_config = LicenseConfig {
            trial_start_date: now,
            usage_count: 0,
            ai_queries_used: 0,
        };
        let content = serde_json::to_string(&new_config).map_err(|e| e.to_string())?;
        fs::write(&path, content).map_err(|e| e.to_string())?;
        new_config
    };

    let elapsed_secs = now.saturating_sub(config.trial_start_date);
    let elapsed_days = (elapsed_secs / 86400) as i64;
    let days_remaining = (14 - elapsed_days).max(0);

    let mut status = "trial_active".to_string();
    
    if elapsed_days > 14 {
        status = "trial_expired".to_string();
    } else if config.usage_count >= 5 || config.ai_queries_used >= 50 {
        status = "trial_limit_reached".to_string();
    }

    let result = LicenseStatus {
        status,
        days_remaining,
        usage_count: config.usage_count,
        ai_queries_used: config.ai_queries_used,
    };

    serde_json::to_string(&result).map_err(|e| e.to_string())
}
