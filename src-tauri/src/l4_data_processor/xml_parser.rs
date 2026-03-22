use crate::l4_data_processor::ImportedRecord;
use quick_xml::events::Event;
use quick_xml::reader::Reader;
use std::path::Path;
use tauri::command;

pub fn parse_xml(file_path: &str) -> Result<Vec<ImportedRecord>, String> {
    let path = Path::new(file_path);
    let mut reader = Reader::from_file(path).map_err(|e| e.to_string())?;
    reader.config_mut().trim_text(true);

    let mut records = Vec::new();
    let mut buf = Vec::new();
    let mut current_tag = String::new();
    
    let keywords = vec![
        "energy", "emission", "co2", "scope", "water", "waste", "employee", "training", "injury"
    ];

    let file_name = path.file_name().unwrap_or_default().to_string_lossy().to_string();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                current_tag = String::from_utf8_lossy(e.name().as_ref()).to_lowercase();
            }
            Ok(Event::Text(e)) => {
                let tag_name = current_tag.clone();
                let value = e.unescape().map_err(|e| e.to_string())?.to_string();
                
                if !value.is_empty() {
                    // Detect XBRL tags
                    if tag_name.contains("esrs-e1") && tag_name.contains("ghgemissions") {
                        records.push(ImportedRecord {
                            source_file: file_name.clone(),
                            category: "XBRL-lite".to_string(),
                            metric: "scope1_total".to_string(), // Direct mapping for important XBRL tags
                            value,
                            unit: Some("tonne".to_string()),
                            year: None,
                        });
                    } else if keywords.iter().any(|&k| tag_name.contains(k)) {
                        // Attempt to detect unit from tag name (e.g., energy_kwh)
                        let unit = if tag_name.contains("kwh") {
                            Some("kWh".to_string())
                        } else if tag_name.contains("kg") {
                            Some("kg".to_string())
                        } else if tag_name.contains("tonne") || tag_name.contains("ton") {
                            Some("tonne".to_string())
                        } else if tag_name.contains("m3") {
                            Some("m3".to_string())
                        } else {
                            None
                        };

                        records.push(ImportedRecord {
                            source_file: file_name.clone(),
                            category: "XML Auto-Extract".to_string(),
                            metric: tag_name,
                            value,
                            unit,
                            year: None,
                        });
                    }
                }
            }
            Ok(Event::End(_)) => {
                current_tag.clear();
            }
            Ok(Event::Eof) => break,
            Err(e) => {
                // Return partial results on error instead of crashing
                eprintln!("XML Parse Error in {}: {}", file_name, e);
                break;
            }
            _ => (), // Skip other events (PI, Comment, etc.)
        }
        buf.clear();
    }

    Ok(records)
}

#[command]
pub fn import_xml(file_path: String) -> Result<Vec<ImportedRecord>, String> {
    parse_xml(&file_path)
}
