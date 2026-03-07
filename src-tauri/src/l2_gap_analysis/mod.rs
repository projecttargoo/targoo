use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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

pub fn run_gap_analysis(input: GapAnalysis) -> String {
    let mut topics = HashMap::new();
    
    // Static list of ESRS topics with mock assessment logic
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

    for (i, topic) in esrs_topics.iter().enumerate() {
        let status = match (i + input.company_size.len()) % 3 {
            0 => "green",
            1 => "yellow",
            _ => "red",
        };
        topics.insert(topic.to_string(), status.to_string());
    }

    let result = GapResult { topics };
    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

#[tauri::command]
pub fn gap_analysis(input: GapAnalysis) -> String {
    run_gap_analysis(input)
}
