use crate::l4_data_processor::ImportedRecord;
use crate::l6_audit::get_db_connection;
use rusqlite::params;
use std::collections::HashSet;
use tauri::{command, AppHandle};

pub fn clean_excel_data(records: Vec<ImportedRecord>) -> Vec<ImportedRecord> {
    let mut cleaned_records = Vec::new();
    let mut seen = HashSet::new();

    for mut record in records {
        // 1. Normalize Metric/Category (CO2 variations)
        let metric_lower = record.metric.to_lowercase();
        if metric_lower.contains("co2") || metric_lower.contains("co₂") || 
           metric_lower.contains("carbon dioxide") || metric_lower.contains("kohlendioxid") {
            record.metric = "CO2".to_string();
        }

        // 2. Normalize Units
        if let Some(ref mut unit) = record.unit {
            let u_lower = unit.to_lowercase();
            
            // Energy
            if u_lower == "kwh" || u_lower == "kilowatt hour" { *unit = "kWh".to_string(); }
            else if u_lower == "mwh" || u_lower == "megawatt hour" { *unit = "MWh".to_string(); }
            else if u_lower == "gj" || u_lower == "gigajoule" { *unit = "GJ".to_string(); }
            
            // Water
            else if u_lower == "m3" || u_lower == "cubic meter" || u_lower == "kubikmeter" { *unit = "m³".to_string(); }
            else if u_lower == "liter" || u_lower == "l" { *unit = "L".to_string(); }
            
            // Waste
            else if u_lower == "ton" || u_lower == "tonne" || u_lower == "t" { *unit = "t".to_string(); }
            else if u_lower == "kg" || u_lower == "kilogram" { *unit = "kg".to_string(); }
            
            // Employee terms
            else if u_lower == "fte" || u_lower == "full time equivalent" { *unit = "FTE".to_string(); }
            else if u_lower == "headcount" || u_lower == "hc" { *unit = "headcount".to_string(); }
        }

        // 3. Fix Numeric Values
        // Remove spaces, replace comma decimals, remove currency symbols
        record.value = record.value
            .replace(' ', "")
            .replace(',', ".")
            .replace('€', "")
            .replace('$', "")
            .replace('£', "");

        // 4. Remove Duplicates based on category + metric + year
        let key = format!("{}-{}-{:?}", record.category, record.metric, record.year);
        if !seen.contains(&key) {
            seen.insert(key);
            cleaned_records.push(record);
        }
    }

    cleaned_records
}

#[command]
pub fn clean_imported_data(app_handle: AppHandle) -> Result<usize, String> {
    let conn = get_db_connection(&app_handle).map_err(|e| e.to_string())?;

    // 1. Read all records
    let mut stmt = conn.prepare("SELECT source_file, category, metric, value, unit, year FROM imported_data")
        .map_err(|e| e.to_string())?;
    
    let records_iter = stmt.query_map([], |row| {
        Ok(ImportedRecord {
            source_file: row.get(0)?,
            category: row.get(1)?,
            metric: row.get(2)?,
            value: row.get(3)?,
            unit: row.get(4)?,
            year: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut records = Vec::new();
    for record in records_iter {
        records.push(record.map_err(|e| e.to_string())?);
    }

    let initial_count = records.len();
    let cleaned_records = clean_excel_data(records);
    let cleaned_count = cleaned_records.len();

    // 2. Clear table and update with cleaned values
    conn.execute("DELETE FROM imported_data", []).map_err(|e| e.to_string())?;

    for record in cleaned_records {
        conn.execute(
            "INSERT INTO imported_data (source_file, category, metric, value, unit, year) VALUES (?, ?, ?, ?, ?, ?)",
            params![record.source_file, record.category, record.metric, record.value, record.unit, record.year],
        ).map_err(|e| e.to_string())?;
    }

    Ok(cleaned_count)
}
