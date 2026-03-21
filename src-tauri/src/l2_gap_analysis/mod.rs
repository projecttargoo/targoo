use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{command, AppHandle, Emitter, State};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Instant, Duration};
use std::thread::sleep;

#[derive(Debug, Serialize, Deserialize)]
pub struct GapAnalysis {
    pub company_size: String,
    pub sector: String,
    pub country: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GapResult {
    pub topics: HashMap<String, String>,
}

#[derive(Clone, Serialize)]
pub struct ProgressPayload {
    pub progress: f64,
    pub current_topic: String,
}

pub struct GapAnalysisState {
    pub is_running: Arc<AtomicBool>,
}

#[command]
pub fn gap_analysis(
    app_handle: AppHandle,
    input: GapAnalysis,
    state: State<'_, GapAnalysisState>,
) -> Result<String, String> {
    // Set running state to true
    state.is_running.store(true, Ordering::SeqCst);
    
    let mut topics = HashMap::new();
    let esrs_topics = vec![
        "ESRS E1: Climate change",
        "ESRS E2: Pollution",
        "ESRS E3: Water and marine resources",
        "ESRS E4: Biodiversity and ecosystems",
        "ESRS E5: Resource use and circular economy",
        "ESRS S1: Own workforce",
        "ESRS S2: Workers in the value chain",
        "ESRS S3: Affected communities",
        "ESRS S4: Consumers and end-users",
        "ESRS G1: Business conduct",
    ];

    let total_topics = esrs_topics.len();
    let start_time = Instant::now();
    let timeout = Duration::from_secs(30);

    for (i, topic) in esrs_topics.iter().enumerate() {
        // 1. Check for cancellation
        if !state.is_running.load(Ordering::SeqCst) {
            return Err("Gap analysis was cancelled".to_string());
        }

        // 2. Check for timeout
        if start_time.elapsed() > timeout {
            break; // Return partial results if we time out
        }

        // 3. Simulated heavy processing (2 seconds per topic as requested)
        sleep(Duration::from_secs(2));

        // 4. Update progress
        let progress = ((i + 1) as f64 / total_topics as f64) * 100.0;
        app_handle.emit("gap_progress", ProgressPayload {
            progress,
            current_topic: topic.to_string(),
        }).map_err(|e| e.to_string())?;

        let status = match (i + input.company_size.len()) % 3 {
            0 => "green",
            1 => "yellow",
            _ => "red",
        };
        topics.insert(topic.to_string(), status.to_string());
    }

    // Set running state back to false
    state.is_running.store(false, Ordering::SeqCst);

    let result = GapResult { topics };
    serde_json::to_string(&result).map_err(|e| e.to_string())
}

#[command]
pub fn cancel_gap_analysis(state: State<'_, GapAnalysisState>) -> Result<(), String> {
    state.is_running.store(false, Ordering::SeqCst);
    Ok(())
}
