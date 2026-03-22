use serde_json::{Value, Map};
use crate::l4_data_processor::ImportedRecord;
use std::path::Path;

pub fn parse_json(file_path: &str) -> Result<Vec<ImportedRecord>, String> {
    let path = Path::new(file_path);
    let file_name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
    let content = std::fs::read_to_string(file_path).map_err(|e| e.to_string())?;
    let json: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    let mut records = Vec::new();
    crawl_json(&json, &file_name, "JSON Root", &mut records);
    Ok(records)
}

fn crawl_json(value: &Value, file_name: &str, current_path: &str, records: &mut Vec<ImportedRecord>) {
    match value {
        Value::Object(map) => {
            // Check if this object looks like a data point
            if let Some(data_point) = try_extract_data_point(map, file_name, current_path) {
                records.push(data_point);
            } else {
                for (key, val) in map {
                    let new_path = if current_path == "JSON Root" { key.clone() } else { format!("{}.{}", current_path, key) };
                    crawl_json(val, file_name, &new_path, records);
                }
            }
        }
        Value::Array(arr) => {
            for (i, val) in arr.iter().enumerate() {
                let new_path = format!("{}[{}]", current_path, i);
                crawl_json(val, file_name, &new_path, records);
            }
        }
        _ => {} // Skip primitives if they are not part of a recognized object
    }
}

fn try_extract_data_point(map: &Map<String, Value>, file_name: &str, current_path: &str) -> Option<ImportedRecord> {
    let value_keywords = ["value", "amount", "mennyiség", "érték", "quantity", "val"];
    let metric_keywords = ["metric", "item", "description", "leírás", "megnevezés", "name", "id", "code"];
    let unit_keywords = ["unit", "egység", "measure", "uom"];
    let year_keywords = ["year", "év", "period", "date"];

    let mut val_str = None;
    let mut metric_str = None;
    let mut unit_str = None;
    let mut year_val = None;

    for (key, val) in map {
        let kl = key.to_lowercase();
        if value_keywords.iter().any(|&k| kl == k) {
            val_str = Some(val.to_string().replace("\"", ""));
        } else if metric_keywords.iter().any(|&k| kl == k) {
            metric_str = Some(val.to_string().replace("\"", ""));
        } else if unit_keywords.iter().any(|&k| kl == k) {
            unit_str = Some(val.to_string().replace("\"", ""));
        } else if year_keywords.iter().any(|&k| kl == k) {
            year_val = val.as_i64().map(|y| y as i32).or_else(|| {
                val.as_str().and_then(|s| s.parse::<i32>().ok())
            });
        }
    }

    if let Some(value) = val_str {
        // If metric name is missing, use the path in the JSON
        let metric = metric_str.unwrap_or_else(|| current_path.to_string());
        
        // Simple validation: check if value is numeric or contains numeric info
        if value.chars().any(|c| c.is_digit(10)) {
            return Some(ImportedRecord {
                source_file: file_name.to_string(),
                category: "JSON Crawler".to_string(),
                metric,
                value,
                unit: unit_str,
                year: year_val,
            });
        }
    }
    None
}
