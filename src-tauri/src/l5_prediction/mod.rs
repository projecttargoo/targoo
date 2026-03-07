use serde::{Deserialize, Serialize};
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct PredictionResult {
    pub e_forecast: Vec<f64>,
    pub s_forecast: Vec<f64>,
    pub g_forecast: Vec<f64>,
    pub co2_reduction_trend: f64,
    pub compliance_deadline_alerts: Vec<String>,
    pub roi_estimate: f64,
}

#[command]
pub fn generate_predictions(current_e: f64, current_s: f64, current_g: f64) -> String {
    let mut e_forecast = Vec::new();
    let mut s_forecast = Vec::new();
    let mut g_forecast = Vec::new();

    // Simple linear projection with a growth factor
    for i in 1..=12 {
        let month_factor = i as f64 * 0.5;
        e_forecast.push((current_e + month_factor).min(100.0));
        s_forecast.push((current_s + month_factor * 0.3).min(100.0));
        g_forecast.push((current_g + month_factor * 0.2).min(100.0));
    }

    let co2_reduction_trend = 12.5; // Fixed estimated reduction based on 12 months
    let roi_estimate = 18.4; // Estimated ROI for green initiatives

    let compliance_deadline_alerts = vec![
        "ESRS E1: Climate Change - Q3 2026".to_string(),
        "ESRS S1: Own Workforce - Q4 2026".to_string(),
        "CSRD Phase 2 Audit - Jan 2027".to_string(),
    ];

    let result = PredictionResult {
        e_forecast,
        s_forecast,
        g_forecast,
        co2_reduction_trend,
        compliance_deadline_alerts,
        roi_estimate,
    };

    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}
