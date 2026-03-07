use serde::{Deserialize, Serialize};
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;
use sha2::{Sha256, Digest};
use whoami;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LicenseConfig {
    pub trial_start_date: u64,
    pub usage_count: u32,
    pub ai_queries_used: u32,
    pub fingerprint: Option<String>,
}

#[derive(Serialize)]
pub struct LicenseStatus {
    pub status: String,
    pub days_remaining: i64,
    pub usage_count: u32,
    pub ai_queries_used: u32,
    pub fingerprint: String,
}

fn get_license_path(app_handle: &tauri::AppHandle) -> std::path::PathBuf {
    let app_dir = app_handle.path().app_data_dir().expect("failed to get app data dir");
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir).expect("failed to create app data dir");
    }
    app_dir.join("license.json")
}

pub fn generate_hardware_fingerprint(app_handle: &tauri::AppHandle) -> String {
    let hostname = whoami::fallible::hostname().unwrap_or_else(|_| "unknown_host".to_string());
    let username = whoami::username();
    let app_dir = app_handle.path().app_data_dir().expect("failed to get app dir");
    let app_dir_str = app_dir.to_string_lossy();

    let mut hasher = Sha256::new();
    hasher.update(hostname.as_bytes());
    hasher.update(username.as_bytes());
    hasher.update(app_dir_str.as_bytes());
    
    let result = hasher.finalize();
    format!("{:x}", result)
}

#[tauri::command]
pub fn get_fingerprint(app_handle: tauri::AppHandle) -> String {
    generate_hardware_fingerprint(&app_handle)
}

#[tauri::command]
pub fn fetch_trial_license_status(app_handle: tauri::AppHandle) -> Result<String, String> {
    let path = get_license_path(&app_handle);
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
    let current_fingerprint = generate_hardware_fingerprint(&app_handle);
    
    let mut config = if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str::<LicenseConfig>(&content).unwrap_or(LicenseConfig {
            trial_start_date: now,
            usage_count: 0,
            ai_queries_used: 0,
            fingerprint: Some(current_fingerprint.clone()),
        })
    } else {
        LicenseConfig {
            trial_start_date: now,
            usage_count: 0,
            ai_queries_used: 0,
            fingerprint: Some(current_fingerprint.clone()),
        }
    };

    // If fingerprint is missing or doesn't match, we update it (first run or migration)
    if config.fingerprint.is_none() {
        config.fingerprint = Some(current_fingerprint.clone());
        let content = serde_json::to_string(&config).map_err(|e| e.to_string())?;
        fs::write(&path, content).map_err(|e| e.to_string())?;
    }

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
        fingerprint: current_fingerprint,
    };

    serde_json::to_string(&result).map_err(|e| e.to_string())
}
