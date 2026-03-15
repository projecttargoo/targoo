use crate::l4_data_processor::ImportedRecord;
use regex::Regex;
use std::path::Path;
use tauri::command;

pub fn parse_pdf(file_path: &str) -> Result<Vec<ImportedRecord>, String> {
    let path = Path::new(file_path);
    let text = pdf_extract::extract_text(path).map_err(|e| e.to_string())?;

    let mut records = Vec::new();
    let keywords = vec![
        "energy", "emission", "co2", "scope", "water", "waste", "employee", "injury", "training"
    ];

    let file_name = path.file_name().unwrap_or_default().to_string_lossy().to_string();

    for keyword in keywords {
        // Look for keyword followed by a number, potentially with a colon or equals sign
        let pattern = format!(r"(?i){}\s*[:=-]?\s*(\d+(?:[\.,]\d+)?)", keyword);
        let re = Regex::new(&pattern).map_err(|e| e.to_string())?;
        
        for cap in re.captures_iter(&text) {
            records.push(ImportedRecord {
                source_file: file_name.clone(),
                category: "PDF Auto-Extract".to_string(),
                metric: keyword.to_string(),
                value: cap[1].replace(',', "."),
                unit: None,
                year: None,
            });
        }
    }

    Ok(records)
}

#[command]
pub fn import_pdf(file_path: String) -> Result<Vec<ImportedRecord>, String> {
    parse_pdf(&file_path)
}
