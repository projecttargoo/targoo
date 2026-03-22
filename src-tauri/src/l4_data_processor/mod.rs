use calamine::{open_workbook, Reader, Xlsx, Data};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{command, AppHandle, Manager};
use crate::l6_audit::get_db_connection;
use crate::normalize;
use crate::state;

pub mod esrs_mapper;
pub mod pdf_parser;
pub mod xml_parser;
pub mod excel_cleaner;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImportedRecord {
    pub source_file: String,
    pub category: String,
    pub metric: String,
    pub value: String,
    pub unit: Option<String>,
    pub year: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportResult {
    pub imported_count: i32,
    pub errors: Vec<String>,
    pub categories_found: Vec<String>,
}

pub fn init_import_db(app_handle: &AppHandle) -> Result<(), String> {
    let conn = get_db_connection(app_handle).map_err(|e| e.to_string())?;
    
    // Debug: Print DB path
    let app_dir = app_handle.path().app_data_dir().unwrap_or_default();
    let db_path = app_dir.join("targoo.db");
    println!("Data Processor DB Path: {:?}", db_path);

    conn.execute(
        "CREATE TABLE IF NOT EXISTS imported_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_file TEXT,
            category TEXT,
            metric TEXT,
            value TEXT,
            unit TEXT,
            year INTEGER,
            import_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

fn detect_columns(headers: &[String]) -> (Option<usize>, Option<usize>, Option<usize>, Option<usize>, Option<usize>) {
    let mut cat_idx = None;
    let mut metric_idx = None;
    let mut val_idx = None;
    let mut unit_idx = None;
    let mut year_idx = None;

    let cat_keywords = ["category", "kategória", "type", "típus", "scope"];
    let metric_keywords = ["metric", "item", "description", "leírás", "megnevezés", "energy", "emission", "waste", "water", "employee", "co2"];
    let val_keywords = ["value", "amount", "mennyiség", "érték", "quantity"];
    let unit_keywords = ["unit", "egység", "measure"];
    let year_keywords = ["year", "év", "period", "időszak"];

    for (i, h) in headers.iter().enumerate() {
        let hl = h.to_lowercase();
        if cat_idx.is_none() && cat_keywords.iter().any(|&k| hl.contains(k)) { cat_idx = Some(i); }
        if metric_idx.is_none() && metric_keywords.iter().any(|&k| hl.contains(k)) { metric_idx = Some(i); }
        if val_idx.is_none() && val_keywords.iter().any(|&k| hl.contains(k)) { val_idx = Some(i); }
        if unit_idx.is_none() && unit_keywords.iter().any(|&k| hl.contains(k)) { unit_idx = Some(i); }
        if year_idx.is_none() && year_keywords.iter().any(|&k| hl.contains(k)) { year_idx = Some(i); }
    }

    (cat_idx, metric_idx, val_idx, unit_idx, year_idx)
}

fn parse_excel(file_path: &str, errors: &mut Vec<String>) -> Vec<ImportedRecord> {
    let mut records = Vec::new();
    let file_name = std::path::Path::new(file_path).file_name().and_then(|s| s.to_str()).unwrap_or(file_path).to_string();

    let mut workbook: Xlsx<_> = match open_workbook(file_path) {
        Ok(w) => w,
        Err(e) => {
            errors.push(format!("Failed to open {}: {}", file_name, e));
            return records;
        }
    };

    for sheet_name in workbook.sheet_names().to_owned() {
        if let Ok(range) = workbook.worksheet_range(&sheet_name) {
            let mut rows = range.rows();
            if let Some(first_row) = rows.next() {
                let headers: Vec<String> = first_row.iter().map(|c| c.to_string()).collect();
                
                // Identify metadata columns
                let mut cat_idx = None;
                let mut year_idx = None;
                let mut unit_idx = None;
                
                let cat_keywords = ["category", "kategória", "type", "típus", "scope", "site", "helyszín", "company", "cég"];
                let year_keywords = ["year", "év", "period", "időszak", "date", "dátum"];
                let unit_keywords = ["unit", "egység", "measure"];

                for (i, h) in headers.iter().enumerate() {
                    let hl = h.to_lowercase();
                    if cat_idx.is_none() && cat_keywords.iter().any(|&k| hl.contains(k)) { cat_idx = Some(i); }
                    if year_idx.is_none() && year_keywords.iter().any(|&k| hl.contains(k)) { year_idx = Some(i); }
                    if unit_idx.is_none() && unit_keywords.iter().any(|&k| hl.contains(k)) { unit_idx = Some(i); }
                }

                for row in rows {
                    let category = cat_idx.and_then(|idx| row.get(idx).map(|c| c.to_string())).unwrap_or_else(|| "Uncategorized".to_string());
                    let year = year_idx.and_then(|idx| row.get(idx).and_then(|c| {
                        match c {
                            Data::Int(i) => Some(*i as i32),
                            Data::Float(f) => Some(*f as i32),
                            Data::String(s) => s.parse::<i32>().ok(),
                            _ => None
                        }
                    }));
                    let row_unit = unit_idx.and_then(|idx| row.get(idx).map(|c| c.to_string()));

                    // Iterate ALL columns to find numeric data
                    for (col_idx, cell) in row.iter().enumerate() {
                        // Skip metadata columns to avoid treating metadata as metrics
                        if Some(col_idx) == cat_idx || Some(col_idx) == year_idx || Some(col_idx) == unit_idx {
                            continue;
                        }

                        let is_numeric = matches!(cell, Data::Int(_) | Data::Float(_));
                        
                        if is_numeric {
                            let value_str = cell.to_string();
                            if value_str.is_empty() || value_str == "0" { continue; }

                            let metric = headers.get(col_idx).cloned().unwrap_or_else(|| format!("Column {}", col_idx));
                            
                            records.push(ImportedRecord {
                                source_file: file_name.clone(),
                                category: category.clone(),
                                metric,
                                value: value_str,
                                unit: row_unit.clone(),
                                year,
                            });
                        }
                    }
                }
            }
        }
    }
    records
}

fn parse_csv(file_path: &str, errors: &mut Vec<String>) -> Vec<ImportedRecord> {
    let mut records = Vec::new();
    let file_name = std::path::Path::new(file_path).file_name().and_then(|s| s.to_str()).unwrap_or(file_path).to_string();

    let mut rdr = match csv::Reader::from_path(file_path) {
        Ok(r) => r,
        Err(e) => {
            errors.push(format!("Failed to open {}: {}", file_name, e));
            return records;
        }
    };

    let headers: Vec<String> = match rdr.headers() {
        Ok(h) => h.iter().map(|s| s.to_string()).collect(),
        Err(e) => {
            errors.push(format!("Failed to read headers for {}: {}", file_name, e));
            return records;
        }
    };

    let (cat_idx, metric_idx, val_idx, unit_idx, year_idx) = detect_columns(&headers);
    if val_idx.is_none() {
        errors.push(format!("{}: Could not detect value column", file_name));
        return records;
    }

    for (row_idx, result) in rdr.records().enumerate() {
        let record = match result {
            Ok(r) => r,
            Err(e) => {
                errors.push(format!("{}: Error at row {}: {}", file_name, row_idx + 2, e));
                continue;
            }
        };

        let value = record.get(val_idx.unwrap()).unwrap_or_default().to_string();
        if value.is_empty() { continue; }

        let metric = metric_idx.and_then(|idx| record.get(idx)).unwrap_or("Unknown").to_string();
        let category = cat_idx.and_then(|idx| record.get(idx)).unwrap_or("Uncategorized").to_string();
        let unit = unit_idx.and_then(|idx| record.get(idx)).map(|s| s.to_string());
        let year = year_idx.and_then(|idx| record.get(idx).and_then(|s| s.parse::<i32>().ok()));

        records.push(ImportedRecord {
            source_file: file_name.clone(),
            category,
            metric,
            value,
            unit,
            year,
        });
    }

    records
}

#[command]
pub fn import_files(app_handle: AppHandle, file_paths: Vec<String>, file_content: Vec<u8>, client_id: i32) -> Result<ImportResult, String> {
    let _ = init_import_db(&app_handle);
    let conn = get_db_connection(&app_handle).map_err(|e| e.to_string())?;

    let _ = state::clear_esg_state_for_client(&conn, client_id);

    let mut all_records = Vec::new();
    let mut errors = Vec::new();

    // If content is provided (native HTML file input), save to a temp file and process
    if !file_content.is_empty() && !file_paths.is_empty() {
        let filename = &file_paths[0];
        let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
        let temp_dir = app_dir.join("temp_imports");
        std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
        let temp_path = temp_dir.join(filename);
        std::fs::write(&temp_path, &file_content).map_err(|e| e.to_string())?;
        
        let path_str = temp_path.to_str().ok_or("Invalid temp path")?;
        let path_lower = path_str.to_lowercase();
        
        if path_lower.ends_with(".xlsx") || path_lower.ends_with(".xls") {
            all_records.extend(parse_excel(path_str, &mut errors));
        } else if path_lower.ends_with(".csv") {
            all_records.extend(parse_csv(path_str, &mut errors));
        } else {
            errors.push(format!("Unsupported file type via buffer: {}", filename));
        }
        
        // Clean up temp file
        let _ = std::fs::remove_file(temp_path);
    } else {
        // Original logic for paths (useful for Tauri native picker if used)
        for path in file_paths {
            let path_lower = path.to_lowercase();
            if path_lower.ends_with(".xlsx") || path_lower.ends_with(".xls") {
                all_records.extend(parse_excel(&path, &mut errors));
            } else if path_lower.ends_with(".csv") {
                all_records.extend(parse_csv(&path, &mut errors));
            } else {
                errors.push(format!("Unsupported file type: {}", path));
            }
        }
    }

    let mut imported_count = 0;
    let mut categories_found = std::collections::HashSet::new();

    for rec in &all_records {
        categories_found.insert(rec.category.clone());
        let res = conn.execute(
            "INSERT INTO imported_data (source_file, category, metric, value, unit, year) VALUES (?, ?, ?, ?, ?, ?)",
            rusqlite::params![rec.source_file, rec.category, rec.metric, rec.value, rec.unit, rec.year],
        );
        match res {
            Ok(_) => imported_count += 1,
            Err(e) => errors.push(format!("DB Error: {}", e)),
        }
    }

    // NORMALIZE AND UPSERT TO ESG_STATE
    println!("Normalizing {} records to esg_state", all_records.len());
    for rec in &all_records {
        // Clean value string: replace comma with dot and remove spaces
        let cleaned_val = rec.value.replace(",", ".").replace(" ", "").replace("\u{a0}", "");
        
        if let Ok(value) = cleaned_val.parse::<f64>() {
            let unit = rec.unit.clone().unwrap_or_default();
            let timestamp = rec.year.map(|y| format!("{}-01-01", y));
            
            let normalized = normalize::map_to_normalized(
                &rec.metric,
                value,
                &unit,
                &rec.source_file,
                timestamp,
            );
            
            // Fix logic: Fritz needs all data. We save even unclassified metrics to esg_state.
            if let Ok(_) = state::upsert_esg_state(&conn, &normalized, client_id) {
                if normalized.category != "unknown" {
                    println!("SUCCESS: category={} value={} metric='{}'", normalized.category, normalized.value, rec.metric);
                } else {
                    println!("WARNING: Unclassified metric saved for client {}: metric='{}'", client_id, rec.metric);
                }
            }
        } else {
            println!("ERROR: Could not parse value '{}' for metric '{}'", rec.value, rec.metric);
        }
    }

    Ok(ImportResult {
        imported_count,
        errors,
        categories_found: categories_found.into_iter().collect(),
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessedData {
    pub row_count: usize,
    pub categorizations: HashMap<String, Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct EmissionTotals {
    pub scope1: f64,
    pub scope2: f64,
    pub scope3: f64,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct EmissionBreakdown {
    pub category: String,
    pub subcategory: String,
    pub emissions: f64,
    pub unit: String,
    pub quantity: f64,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct DetailedEmissionTotals {
    pub scope1: f64,
    pub scope2: f64,
    pub scope3: f64,
    pub breakdown: Vec<EmissionBreakdown>,
}

#[command]
pub fn calculate_emissions(app_handle: AppHandle, file_path: String) -> Result<DetailedEmissionTotals, String> {
    let mut excel: Xlsx<_> = open_workbook(file_path).map_err(|e| format!("Failed to open Excel file: {}", e))?;
    let sheet_name = excel.sheet_names().get(0).ok_or("No sheets found in Excel file")?.clone();
    let range = excel.worksheet_range(&sheet_name).map_err(|e| format!("Failed to read worksheet: {}", e))?;

    let conn = get_db_connection(&app_handle).map_err(|e| e.to_string())?;

    // Load emission factors with subcategories
    let mut stmt = conn.prepare("SELECT category, subcategory, factor_kg_co2e, unit, scope FROM emission_factors").map_err(|e| e.to_string())?;
    let factors_rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?, // category
            row.get::<_, String>(1)?, // subcategory
            row.get::<_, f64>(2)?,    // factor
            row.get::<_, String>(3)?, // unit
            row.get::<_, i32>(4)?     // scope
        ))
    }).map_err(|e| e.to_string())?;

    let mut factors = Vec::new();
    for row in factors_rows {
        factors.push(row.map_err(|e| e.to_string())?);
    }

    // Load unit conversions
    let mut stmt = conn.prepare("SELECT from_unit, to_unit, multiplier FROM unit_conversions").map_err(|e| e.to_string())?;
    let conversions: Vec<(String, String, f64)> = stmt.query_map([], |row| {
        Ok((row.get(0)?, row.get(1)?, row.get(2)?))
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    let mut result = DetailedEmissionTotals::default();

    // Map keywords to subcategories (simplified matching)
    let keyword_map = vec![
        (vec!["electricity", "strom", "áram"], "EU grid"),
        (vec!["natural gas", "erdgas", "gáz"], "Natural gas"),
        (vec!["diesel"], "Diesel"),
        (vec!["petrol", "benzin"], "Petrol"),
        (vec!["flight", "flug", "repülő", "short haul"], "Flight economy short haul"),
        (vec!["flight", "flug", "repülő", "long haul"], "Flight economy long haul"),
        (vec!["freight", "lkw", "teherautó"], "Road freight"),
        (vec!["district heating", "fernwärme", "távhő"], "District heating"),
        (vec!["water", "wasser", "víz"], "Water supply"),
        (vec!["waste", "abfall", "hulladék", "landfill"], "Waste landfill"),
    ];

    let mut col_indices = (None, None, None); 
    if let Some(first_row) = range.rows().next() {
        for (idx, cell) in first_row.iter().enumerate() {
            let header = cell.to_string().to_lowercase();
            if header.contains("description") || header.contains("category") || header.contains("item") || header.contains("megnevezés") {
                col_indices.0 = Some(idx);
            } else if header.contains("value") || header.contains("amount") || header.contains("mennyiség") || header.contains("érték") {
                col_indices.1 = Some(idx);
            } else if header.contains("unit") || header.contains("egység") {
                col_indices.2 = Some(idx);
            }
        }
    }

    let cat_idx = col_indices.0.unwrap_or(0);
    let val_idx = col_indices.1.unwrap_or(1);
    let unit_idx = col_indices.2.unwrap_or(2);

    for row in range.rows().skip(1) {
        let cat_str = row.get(cat_idx).unwrap_or(&Data::Empty).to_string().to_lowercase();
        let val = match row.get(val_idx).unwrap_or(&Data::Empty) {
            Data::Float(f) => *f,
            Data::Int(i) => *i as f64,
            Data::String(s) => s.parse::<f64>().unwrap_or(0.0),
            _ => 0.0,
        };
        let unit_str = row.get(unit_idx).unwrap_or(&Data::Empty).to_string();

        if val == 0.0 { continue; }

        for (kws, subcat_name) in &keyword_map {
            if kws.iter().any(|&kw| cat_str.contains(kw)) {
                if let Some(f_data) = factors.iter().find(|(_, sub, _, _, _)| sub == subcat_name) {
                    let (category, subcategory, factor, target_unit, scope) = f_data;
                    
                    let mut multiplier = 1.0;
                    if &unit_str != target_unit {
                        if let Some(conv) = conversions.iter().find(|(f, t, _)| f == &unit_str && t == target_unit) {
                            multiplier = conv.2;
                        }
                    }

                    let emissions = val * multiplier * factor;
                    
                    result.breakdown.push(EmissionBreakdown {
                        category: category.clone(),
                        subcategory: subcategory.clone(),
                        emissions,
                        unit: unit_str.clone(),
                        quantity: val,
                    });

                    match scope {
                        1 => result.scope1 += emissions,
                        2 => result.scope2 += emissions,
                        3 => result.scope3 += emissions,
                        _ => {}
                    }
                    break;
                }
            }
        }
    }

    Ok(result)
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

#[derive(Debug, Serialize, Deserialize)]
pub struct FileSummary {
    pub filename: String,
    pub row_count: usize,
    pub detected_scope: String,
}

#[command]
pub fn process_data_file(_app_handle: AppHandle, file_path: String) -> Result<FileSummary, String> {
    let filename = std::path::Path::new(&file_path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown_file")
        .to_string();

    let path_lower = file_path.to_lowercase();
    let mut row_count = 0;
    let mut detected_scope = "Uncategorized".to_string();

    if path_lower.ends_with(".xlsx") || path_lower.ends_with(".xls") {
        let mut excel: Xlsx<_> = open_workbook(&file_path).map_err(|e| format!("Failed to open Excel file: {}", e))?;
        if let Some(sheet_name) = excel.sheet_names().get(0).cloned() {
            if let Ok(range) = excel.worksheet_range(&sheet_name) {
                row_count = range.rows().count().saturating_sub(1);
                
                // Detection logic
                if let Some(first_row) = range.rows().next() {
                    let header_str = first_row.iter().map(|c| c.to_string().to_lowercase()).collect::<Vec<_>>().join(" ");
                    if header_str.contains("scope 1") || header_str.contains("direct") { detected_scope = "Scope 1".into(); }
                    else if header_str.contains("scope 2") || header_str.contains("electricity") { detected_scope = "Scope 2".into(); }
                    else if header_str.contains("scope 3") || header_str.contains("purchased") { detected_scope = "Scope 3".into(); }
                }
            }
        }
    } else if path_lower.ends_with(".csv") {
        let mut rdr = csv::Reader::from_path(&file_path).map_err(|e| format!("Failed to open CSV: {}", e))?;
        let headers = rdr.headers().map_err(|e| format!("Failed to read CSV headers: {}", e))?;
        let header_str = headers.iter().collect::<Vec<_>>().join(" ").to_lowercase();
        
        if header_str.contains("scope 1") || header_str.contains("direct") { detected_scope = "Scope 1".into(); }
        else if header_str.contains("scope 2") || header_str.contains("electricity") { detected_scope = "Scope 2".into(); }
        else if header_str.contains("scope 3") || header_str.contains("purchased") { detected_scope = "Scope 3".into(); }
        
        row_count = rdr.records().count();
    } else {
        return Err("Unsupported file format".into());
    }

    Ok(FileSummary {
        filename,
        row_count,
        detected_scope,
    })
}

#[command]
pub fn calculate_excel_emissions(app_handle: AppHandle, file_path: String) -> Result<EmissionTotals, String> {
    let mut excel: Xlsx<_> = open_workbook(file_path).map_err(|e| format!("Failed to open Excel file: {}", e))?;
    let sheet_name = excel.sheet_names().get(0).ok_or("No sheets found in Excel file")?.clone();
    let range = excel.worksheet_range(&sheet_name).map_err(|e| format!("Failed to read worksheet: {}", e))?;

    let conn = get_db_connection(&app_handle).map_err(|e| e.to_string())?;

    // Load emission factors
    let mut stmt = conn.prepare("SELECT category, factor, unit, scope FROM emission_factors").map_err(|e| e.to_string())?;
    let factors: HashMap<String, (f64, String, i32)> = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, (row.get::<_, f64>(1)?, row.get::<_, String>(2)?, row.get::<_, i32>(3)?)))
    }).map_err(|e| e.to_string())?
    .collect::<Result<HashMap<_, _>, _>>().map_err(|e| e.to_string())?;

    // Load unit conversions
    let mut stmt = conn.prepare("SELECT from_unit, to_unit, multiplier FROM unit_conversions").map_err(|e| e.to_string())?;
    let conversions: Vec<(String, String, f64)> = stmt.query_map([], |row| {
        Ok((row.get(0)?, row.get(1)?, row.get(2)?))
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    let mut totals = EmissionTotals::default();

    // Map keywords to db categories
    let keyword_to_category = vec![
        (vec!["strom", "electricity", "áram"], "electricity_eu"),
        (vec!["erdgas", "gas", "gáz"], "natural_gas"),
        (vec!["diesel"], "diesel"),
    ];

    // Simple heuristic: find columns for category/description, value, unit
    let mut col_indices = (None, None, None); // (cat_idx, val_idx, unit_idx)
    
    if let Some(first_row) = range.rows().next() {
        for (idx, cell) in first_row.iter().enumerate() {
            let header = cell.to_string().to_lowercase();
            if header.contains("description") || header.contains("category") || header.contains("item") || header.contains("megnevezés") {
                col_indices.0 = Some(idx);
            } else if header.contains("value") || header.contains("amount") || header.contains("mennyiség") || header.contains("érték") {
                col_indices.1 = Some(idx);
            } else if header.contains("unit") || header.contains("egység") {
                col_indices.2 = Some(idx);
            }
        }
    }

    // If we can't find columns by header, we'll try to guess from rows or just use 0, 1, 2 if available
    let cat_idx = col_indices.0.unwrap_or(0);
    let val_idx = col_indices.1.unwrap_or(1);
    let unit_idx = col_indices.2.unwrap_or(2);

    for row in range.rows().skip(1) {
        let cat_str = row.get(cat_idx).unwrap_or(&Data::Empty).to_string().to_lowercase();
        let val = match row.get(val_idx).unwrap_or(&Data::Empty) {
            Data::Float(f) => *f,
            Data::Int(i) => *i as f64,
            Data::String(s) => s.parse::<f64>().unwrap_or(0.0),
            _ => 0.0,
        };
        let unit_str = row.get(unit_idx).unwrap_or(&Data::Empty).to_string();

        if val == 0.0 { continue; }

        for (kws, db_cat) in &keyword_to_category {
            if kws.iter().any(|&kw| cat_str.contains(kw)) {
                if let Some((factor, target_unit, scope)) = factors.get(*db_cat) {
                    let mut multiplier = 1.0;
                    if &unit_str != target_unit {
                        if let Some(conv) = conversions.iter().find(|(f, t, _)| f == &unit_str && t == target_unit) {
                            multiplier = conv.2;
                        }
                    }

                    let emissions = val * multiplier * factor;
                    match scope {
                        1 => totals.scope1 += emissions,
                        2 => totals.scope2 += emissions,
                        3 => totals.scope3 += emissions,
                        _ => {}
                    }
                }
                break;
            }
        }
    }

    Ok(totals)
}

#[command]
pub fn get_translations(app_handle: AppHandle, lang: &str) -> Result<HashMap<String, String>, String> {
    let conn = get_db_connection(&app_handle).map_err(|e| e.to_string())?;
    
    let column = match lang.to_lowercase().as_str() {
        "hu" => "hu",
        "de" => "de",
        "en" => "en",
        _ => "en",
    };

    let query = format!("SELECT key_name, {} FROM translations", column);
    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    }).map_err(|e| e.to_string())?;

    let mut map = HashMap::new();
    for row in rows {
        let (key, val) = row.map_err(|e| e.to_string())?;
        map.insert(key, val);
    }

    Ok(map)
}
