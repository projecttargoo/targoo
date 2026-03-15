use calamine::{open_workbook, Reader, Xlsx, Data};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct EsrsMapping {
    pub column: String,
    pub value: String,
    pub esrs_code: String,
    pub esrs_topic: String,
    pub confidence: i32,
}

pub fn map_to_esrs_internal(file_path: &str, conn: &Connection) -> Result<Vec<EsrsMapping>, String> {
    let mut workbook: Xlsx<_> = open_workbook(file_path)
        .map_err(|e: calamine::XlsxError| e.to_string())?;
    
    let sheet_name = workbook.sheet_names()
        .first()
        .cloned()
        .ok_or("No sheets found")?;
    
    let range = workbook.worksheet_range(&sheet_name)
        .map_err(|e: calamine::XlsxError| e.to_string())?;
    
    let rows: Vec<Vec<Data>> = range.rows()
        .map(|r: &[calamine::Data]| r.to_vec())
        .collect();
    
    let mut mappings = Vec::new();
    
    if rows.is_empty() {
        return Ok(mappings);
    }
    
    let headers: Vec<String> = rows[0].iter()
        .map(|c: &Data| c.to_string())
        .collect();
    
    for header in &headers {
        let header_lower = header.to_lowercase();
        let (esrs_code, esrs_topic, confidence) = match_keyword(&header_lower);
        
        if confidence > 0 {
            mappings.push(EsrsMapping {
                column: header.clone(),
                value: String::new(),
                esrs_code,
                esrs_topic,
                confidence,
            });
        }
    }
    
    Ok(mappings)
}

fn match_keyword(keyword: &str) -> (String, String, i32) {
    if keyword.contains("energy") || keyword.contains("kwh") || keyword.contains("strom") {
        return ("ESRS E1.35".to_string(), "Energy Consumption".to_string(), 95);
    }
    if keyword.contains("co2") || keyword.contains("emission") || keyword.contains("scope") {
        return ("ESRS E1.44".to_string(), "GHG Emissions".to_string(), 95);
    }
    if keyword.contains("water") || keyword.contains("wasser") {
        return ("ESRS E3.28".to_string(), "Water Consumption".to_string(), 90);
    }
    if keyword.contains("waste") || keyword.contains("abfall") {
        return ("ESRS E5.31".to_string(), "Waste Generation".to_string(), 90);
    }
    if keyword.contains("employee") || keyword.contains("mitarbeiter") || keyword.contains("staff") {
        return ("ESRS S1.6".to_string(), "Own Workforce".to_string(), 95);
    }
    if keyword.contains("injury") || keyword.contains("accident") || keyword.contains("safety") {
        return ("ESRS S1.15".to_string(), "Health and Safety".to_string(), 90);
    }
    if keyword.contains("gender") || keyword.contains("diversity") {
        return ("ESRS S1.16".to_string(), "Gender Pay Gap".to_string(), 85);
    }
    if keyword.contains("training") || keyword.contains("schulung") {
        return ("ESRS S1.13".to_string(), "Training Hours".to_string(), 85);
    }
    if keyword.contains("corruption") || keyword.contains("compliance") {
        return ("ESRS G1.3".to_string(), "Anti-Corruption".to_string(), 90);
    }
    if keyword.contains("payment") || keyword.contains("invoice") || keyword.contains("zahlung") {
        return ("ESRS G1.6".to_string(), "Payment Practices".to_string(), 85);
    }
    (String::new(), String::new(), 0)
}

#[tauri::command]
pub async fn map_to_esrs(file_path: String) -> Result<serde_json::Value, String> {
    let mappings = map_to_esrs_internal(&file_path, &rusqlite::Connection::open_in_memory().map_err(|e| e.to_string())?)?;
    Ok(serde_json::json!({
        "mappings": mappings,
        "coverage_percent": (mappings.len() as f32 / 10.0) * 100.0
    }))
}
