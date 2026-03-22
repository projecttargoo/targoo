use serde::{Deserialize, Serialize};

pub fn detect_file_type(path: &str) -> &'static str {
    let p = path.to_lowercase();
    if p.ends_with(".xlsx") || p.ends_with(".xls") { return "excel"; }
    if p.ends_with(".csv") { return "csv"; }
    if p.ends_with(".pdf") { return "pdf"; }
    if p.ends_with(".xml") { return "xml"; }
    if p.ends_with(".txt") { return "txt"; }
    if p.ends_with(".json") { return "json"; }
    "unknown"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NormalizedRow {
    pub category: String,
    pub value: f64,
    pub unit: String,
    pub normalized_value: Option<f64>,
    pub normalized_unit: Option<String>,
    pub confidence: f32,
    pub source: String,
    pub origin_file: String,
    pub timestamp: Option<String>,
}

pub fn normalize_unit(unit: &str) -> String {
    let u = unit.to_lowercase().replace(" ", "");
    if u.contains("kwh") { return "kwh".into(); }
    if u.contains("mwh") { return "mwh".into(); }
    if u.contains("m3") || u.contains("m³") || u.contains("m^3") || u.contains("nm3") { return "m3".into(); }
    if u == "l" || u.contains("liter") { return "liter".into(); }
    if u.contains("kg") { return "kg".into(); }
    if u.contains("t") || u.contains("tonne") || u.contains("tonna") { return "tonne".into(); }
    if u.contains("%") || u.contains("percent") { return "percent".into(); }
    if u.contains("fő") || u.contains("person") || u.contains("people") || u.contains("headcount") { return "headcount".into(); }
    u
}

pub fn classify(column: &str, unit: &str) -> (String, f32) {
    let col = column.to_lowercase();
    let u = normalize_unit(unit);

    // SCOPE 2 - Electricity
    if col.contains("electric") || col.contains("strom") || col.contains("áram") || col.contains("villamos") || col.contains("electricity") || col.contains("energia") {
        return ("scope2_electricity".into(), 0.95);
    }
    // SCOPE 1 - Gas
    if col.contains("natural gas") || col.contains("erdgas") || col.contains("gáz") || col.contains("földgáz") || col.contains("foldgaz") || col.contains("gas") {
        return ("scope1_gas".into(), 0.95);
    }
    // SCOPE 1 - Diesel/Fuel
    if col.contains("diesel") || col.contains("fuel") || col.contains("benzin") || col.contains("petrol") || col.contains("flotta") || col.contains("üzemanyag") {
        return ("scope1_fuel".into(), 0.95);
    }
    // SCOPE 1 - Refrigerant
    if col.contains("refrigerant") || col.contains("hűtő") || col.contains("hutokozeg") || col.contains("kaelte") || col.contains("coolant") || col.contains("töltés") || col.contains("klíma") {
        return ("scope1_refrigerant".into(), 0.95);
    }
    // WATER
    if col.contains("water") || col.contains("víz") || col.contains("wasser") || col.contains("vízfogyasztás") || col.contains("viz") {
        return ("water".into(), 0.90);
    }
    // WASTE
    if col.contains("waste") || col.contains("hulladék") || col.contains("abfall") || col.contains("recycl") || col.contains("szemét") {
        return ("waste".into(), 0.90);
    }
    // WORKFORCE
    if col.contains("headcount") || col.contains("employee") || col.contains("workforce") || col.contains("létszám") || col.contains("letszam") || col.contains("mitarbeiter") || col.contains("worker") {
        return ("workforce".into(), 0.95);
    }
    // TRAINING
    if col.contains("training") || col.contains("képzés") || col.contains("schulung") {
        return ("training_cost".into(), 0.90);
    }
    // ACCIDENTS
    if col.contains("accident") || col.contains("baleset") || col.contains("unfall") || col.contains("injury") {
        return ("work_accidents".into(), 0.90);
    }
    // GENDER / DIVERSITY
    if col.contains("female") || col.contains("gender") || col.contains("diversity") || col.contains("női") || col.contains("noi") {
        return ("diversity_ratio".into(), 0.90);
    }

    // UNIT FALLBACK
    if u == "kwh" || u == "mwh" { return ("scope2_electricity".into(), 0.70); }
    if u == "m3" { return ("scope1_gas".into(), 0.60); }
    if u == "liter" { return ("scope1_fuel".into(), 0.60); }
    if u == "kg" { return ("scope1_refrigerant".into(), 0.50); }
    if u == "headcount" { return ("workforce".into(), 0.70); }
    if u == "percent" { return ("diversity_ratio".into(), 0.40); }

    // UNKNOWN - log it
    eprintln!("[NORMALIZE] Unknown category for column='{}' unit='{}'", column, unit);
    ("unknown".into(), 0.10)
}

pub fn extract_unit_from_column(column: &str) -> String {
    let col = column.to_lowercase();
    if col.contains("kwh") { return "kwh".into(); }
    if col.contains("mwh") { return "mwh".into(); }
    if col.contains("m3") || col.contains("m³") { return "m3".into(); }
    if col.contains("liter") || col.contains("(l)") { return "liter".into(); }
    if col.contains("(kg)") || col.contains("kg)") { return "kg".into(); }
    if col.contains("eur") { return "eur".into(); }
    if col.contains("fő") || col.contains("person") || col.contains("headcount") { return "headcount".into(); }
    "".into()
}

pub fn map_to_normalized(
    column: &str,
    value: f64,
    unit: &str,
    origin_file: &str,
    timestamp: Option<String>,
) -> NormalizedRow {
    let effective_unit = if unit.is_empty() {
        extract_unit_from_column(column)
    } else {
        unit.to_string()
    };
    let (category, confidence) = classify(column, &effective_unit);
    let normalized_unit = Some(normalize_unit(&effective_unit));

    NormalizedRow {
        category,
        value,
        unit: effective_unit,
        normalized_value: None,
        normalized_unit,
        confidence,
        source: column.to_string(),
        origin_file: origin_file.to_string(),
        timestamp,
    }
}
