use calamine::{open_workbook, Reader, Xlsx};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessedData {
    pub row_count: usize,
    pub categorizations: HashMap<String, Vec<String>>,
}

#[command]
pub fn process_excel(file_path: String) -> Result<String, String> {
    let mut excel: Xlsx<_> = open_workbook(file_path).map_err(|e| format!("Failed to open Excel file: {}", e))?;
    let sheet_name = excel.sheet_names().get(0).ok_or("No sheets found in Excel file")?.clone();
    let range = excel.worksheet_range(&sheet_name).map_err(|e| format!("Failed to read worksheet: {}", e))?;

    let mut row_count = 0;
    let mut categorizations: HashMap<String, Vec<String>> = HashMap::new();
    
    // ESG Categories and their potential keywords
    let categories = vec![
        ("Scope1", vec!["direct", "fuel", "gas", "scope 1", "heating"]),
        ("Scope2", vec!["indirect", "electricity", "scope 2", "power"]),
        ("Scope3", vec!["supply", "logistics", "scope 3", "travel", "purchased"]),
        ("Energy", vec!["kwh", "mwh", "energy", "joule"]),
        ("Water", vec!["m3", "water", "liter", "consumption"]),
        ("Waste", vec!["waste", "recycling", "landfill", "disposal", "kg", "ton"]),
        ("HR", vec!["employee", "worker", "diversity", "gender", "turnover", "workforce"]),
    ];

    if let Some(first_row) = range.rows().next() {
        row_count = range.rows().count().saturating_sub(1); // Exclude header

        for (_idx, cell) in first_row.iter().enumerate() {
            let header = cell.to_string().to_lowercase();
            
            for (category, keywords) in &categories {
                if keywords.iter().any(|&kw| header.contains(kw)) {
                    categorizations.entry(category.to_string()).or_default().push(header.clone());
                }
            }
        }
    }

    let result = ProcessedData {
        row_count,
        categorizations,
    };

    serde_json::to_string(&result).map_err(|e| format!("Failed to serialize result: {}", e))
}
