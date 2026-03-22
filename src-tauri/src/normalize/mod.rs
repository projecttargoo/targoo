use serde::{Deserialize, Serialize};

pub fn detect_file_type(path: &str) -> &'static str {
    let p = path.to_lowercase();
    if p.ends_with(".xlsx") || p.ends_with(".xls") { return "excel"; }
    if p.ends_with(".csv") { return "csv"; }
    if p.ends_with(".pdf") { return "pdf"; }
    if p.ends_with(".xml") || p.ends_with(".xbrl") { return "xml"; }
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
    if u.contains("t") || u.contains("tonne") || u.contains("tonna") || u.contains("ton") { return "tonne".into(); }
    if u.contains("%") || u.contains("percent") { return "percent".into(); }
    if u.contains("fő") || u.contains("person") || u.contains("people") || u.contains("headcount") { return "headcount".into(); }
    u
}

/// Swiss Watch Precision: Internal SSOT standardization
pub fn normalize_value(value: f64, unit: &str) -> (f64, String) {
    let u = normalize_unit(unit);
    
    if u == "mwh" {
        return (value * 1000.0, "kwh".to_string());
    }
    if u == "tonne" {
        return (value * 1000.0, "kg".to_string());
    }
    
    (value, u)
}

pub fn classify(column: &str, unit: &str) -> (String, f32) {
    let col = column.to_lowercase();
    let u = normalize_unit(unit);

    // WEIGHTED DICTIONARY ENGINE
    let mut scores = std::collections::HashMap::new();

    // Scope 2 - Electricity
    let s2_keywords = ["strom", "electricity", "áram", "energy consumption", "electric power", "villamos", "energia"];
    for kw in s2_keywords {
        if col.contains(kw) { *scores.entry("scope2_electricity").or_insert(0.0) += 0.5; }
    }
    if u == "kwh" || u == "mwh" { *scores.entry("scope2_electricity").or_insert(0.0) += 0.4; }

    // Scope 1 - Gas
    let gas_keywords = ["gas", "erdgas", "gáz", "natural gas", "heizgas", "földgáz", "foldgaz"];
    for kw in gas_keywords {
        if col.contains(kw) { *scores.entry("scope1_gas").or_insert(0.0) += 0.5; }
    }
    if u == "m3" { *scores.entry("scope1_gas").or_insert(0.0) += 0.4; }

    // Scope 1 - Fuel
    let fuel_keywords = ["diesel", "fuel", "benzin", "fleet", "üzemanyag", "flotta", "petrol"];
    for kw in fuel_keywords {
        if col.contains(kw) { *scores.entry("scope1_fuel").or_insert(0.0) += 0.5; }
    }
    if u == "liter" { *scores.entry("scope1_fuel").or_insert(0.0) += 0.4; }

    // Scope 1 - Refrigerant
    let ref_keywords = ["refrigerant", "hűtő", "hutokozeg", "kaelte", "coolant", "töltés", "klíma"];
    for kw in ref_keywords {
        if col.contains(kw) { *scores.entry("scope1_refrigerant").or_insert(0.0) += 0.5; }
    }
    if u == "kg" && !scores.contains_key("scope1_fuel") { *scores.entry("scope1_refrigerant").or_insert(0.0) += 0.3; }

    // Water
    let water_keywords = ["water", "wasser", "víz", "m3 water", "vízfogyasztás"];
    for kw in water_keywords {
        if col.contains(kw) { *scores.entry("water").or_insert(0.0) += 0.5; }
    }

    // Workforce (Headcount)
    let work_keywords = ["headcount", "mitarbeiter", "létszám", "employees total", "full-time", "letszam", "worker"];
    for kw in work_keywords {
        if col.contains(kw) { *scores.entry("workforce").or_insert(0.0) += 0.5; }
    }
    if u == "headcount" { *scores.entry("workforce").or_insert(0.0) += 0.4; }

    // Diversity / Gender (Precision check)
    let div_keywords = ["female", "gender", "diversity", "női", "noi", "ratio", "százalék"];
    for kw in div_keywords {
        if col.contains(kw) { *scores.entry("diversity_ratio").or_insert(0.0) += 0.6; } // Higher weight for precision
    }
    if u == "percent" { *scores.entry("diversity_ratio").or_insert(0.0) += 0.4; }

    // Training
    let train_keywords = ["training", "képzés", "schulung", "oktatás"];
    for kw in train_keywords {
        if col.contains(kw) { *scores.entry("training_cost").or_insert(0.0) += 0.5; }
    }

    // Find highest score
    let mut best_cat = "unknown".to_string();
    let mut max_score = 0.0;

    for (cat, score) in scores {
        if score > max_score {
            max_score = score;
            best_cat = cat.to_string();
        }
    }

    // Adjust confidence
    let confidence = (max_score as f32).min(0.99);

    if best_cat == "unknown" {
        eprintln!("[NORMALIZE] Unknown category for column='{}' unit='{}'", column, unit);
        return ("unknown".into(), 0.10);
    }

    (best_cat, confidence)
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
    if col.contains("%") || col.contains("százalék") { return "percent".into(); }
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
    let (norm_value, norm_unit) = normalize_value(value, &effective_unit);

    NormalizedRow {
        category,
        value,
        unit: effective_unit,
        normalized_value: Some(norm_value),
        normalized_unit: Some(norm_unit),
        confidence,
        source: column.to_string(),
        origin_file: origin_file.to_string(),
        timestamp,
    }
}
