use docx_rs::*;
use serde::{Deserialize, Serialize};
use std::fs::File;
use chrono::Local;
use tauri::{command, AppHandle, State};
use std::sync::Mutex;
use crate::l1_rag::{GemmaEngine};
use crate::l6_audit::get_db_connection;
use crate::state;

#[derive(Debug, Serialize, Deserialize)]
pub struct EsrsReportRow {
    pub id: String,
    pub name: String,
    pub status: String,
    pub missing_items: String,
    pub reference: String,
}

#[command]
pub fn generate_report(
    app_handle: AppHandle,
    client_id: i32,
) -> Result<String, String> {
    // 1. Fetch Real SSOT Data from DB (Synchronous)
    let conn = get_db_connection(&app_handle).map_err(|e| e.to_string())?;
    
    // Fetch Client info
    let (company_name, tax_id, jurisdiction, reporting_year, industry): (String, String, String, i32, String) = conn.query_row(
        "SELECT name, COALESCE(tax_id, ''), COALESCE(jurisdiction, 'EU-ESRS'), COALESCE(reporting_year, 2024), industry FROM clients WHERE id = ?1",
        [client_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?))
    ).map_err(|e| e.to_string())?;

    // Aggregate Carbon totals
    let scope1_gas = state::get_esg_total(&conn, client_id, "scope1_gas");
    let scope1_fuel = state::get_esg_total(&conn, client_id, "scope1_fuel");
    let scope1_ref = state::get_esg_total(&conn, client_id, "scope1_refrigerant");
    let scope2 = state::get_esg_total(&conn, client_id, "scope2_electricity");
    let scope3 = state::get_esg_total(&conn, client_id, "scope3_supplier");
    
    let s1_gas_co2 = (scope1_gas * 2.04) / 1000.0;
    let s1_fuel_co2 = (scope1_fuel * 2.68) / 1000.0;
    let s1_ref_co2 = (scope1_ref * 2088.0) / 1000.0;
    let s2_co2 = (scope2 * 0.276) / 1000.0;
    
    let scope1_total = s1_gas_co2 + s1_fuel_co2 + s1_ref_co2;
    let total_carbon = scope1_total + s2_co2 + scope3;
    
    let workforce = state::get_esg_total(&conn, client_id, "workforce");

    // Fetch Compliance Logic (Simulated here for speed, matching frontend logic)
    let has_water = state::get_esg_total(&conn, client_id, "water") > 0.0;
    let has_waste = state::get_esg_total(&conn, client_id, "waste") > 0.0;
    
    let standards = vec![
        ("ESRS E1", "Climate Change", total_carbon > 0.0),
        ("ESRS E2", "Pollution", false),
        ("ESRS E3", "Water & Marine", has_water),
        ("ESRS E4", "Biodiversity", false),
        ("ESRS E5", "Resource Use", has_waste),
        ("ESRS S1", "Own Workforce", workforce > 0.0),
        ("ESRS G1", "Business Conduct", false),
    ];

    let compliant_count = standards.iter().filter(|s| s.2).count();
    let audit_readiness = (compliant_count as f64 / standards.len() as f64) * 100.0;

    let date = Local::now().format("%Y-%m-%d").to_string();

    // 2. Prepare Document
    let mut docx = Docx::new();

    // --- COVER PAGE ---
    docx = docx
        .add_paragraph(Paragraph::new().add_run(Run::new().add_break(BreakType::Page))) // Placeholder for spacing
        .add_paragraph(
            Paragraph::new()
                .add_run(Run::new().add_text(company_name.clone()).size(64).bold())
                .align(AlignmentType::Center)
        )
        .add_paragraph(
            Paragraph::new()
                .add_run(Run::new().add_text(format!("Tax ID: {} | Jurisdiction: {}", tax_id, jurisdiction)).size(24))
                .align(AlignmentType::Center)
        )
        .add_paragraph(
            Paragraph::new()
                .add_run(Run::new().add_text(format!("CSRD Official Sustainability Report {}", reporting_year)).size(36).bold())
                .align(AlignmentType::Center)
        )
        .add_paragraph(
            Paragraph::new()
                .add_run(Run::new().add_text("Prepared by Targoo ESG Engine").size(24).italic())
                .align(AlignmentType::Center)
        )
        .add_paragraph(
            Paragraph::new()
                .add_run(Run::new().add_text(format!("Generation Date: {}", date)).size(20))
                .align(AlignmentType::Center)
        )
        .add_paragraph(Paragraph::new().add_run(Run::new().add_break(BreakType::Page)));

    // --- SECTION 1: EXECUTIVE SUMMARY ---
    docx = docx.add_paragraph(Paragraph::new().add_run(Run::new().add_text("SECTION 1: EXECUTIVE SUMMARY").size(32).bold()));
    
    let summary_text = format!(
        "This official disclosure report provides a comprehensive overview of the sustainability performance for {}. Total recorded carbon footprint for the reporting period is {:.2} tCO2e. The organization's current Audit Readiness is {:.1}%.",
        company_name, total_carbon, audit_readiness
    );
    docx = docx.add_paragraph(Paragraph::new().add_run(Run::new().add_text(summary_text).size(22)));

    // --- SECTION 2: THE DATA LEDGER (TRANSPARENCY) ---
    docx = docx.add_paragraph(Paragraph::new().add_run(Run::new().add_break(BreakType::Page)));
    docx = docx.add_paragraph(Paragraph::new().add_run(Run::new().add_text("SECTION 2: DATA ORIGIN & LINEAGE (AUDIT PROOF)").size(32).bold()));
    docx = docx.add_paragraph(Paragraph::new().add_run(Run::new().add_text("The following table represents the primary data sources used for normalization.").size(20)));

    let mut ledger_table = Table::new(vec![]);
    ledger_table = ledger_table.add_row(TableRow::new(vec![
        TableCell::new().add_paragraph(Paragraph::new().add_run(Run::new().add_text("Source File").bold())),
        TableCell::new().add_paragraph(Paragraph::new().add_run(Run::new().add_text("Original Label").bold())),
        TableCell::new().add_paragraph(Paragraph::new().add_run(Run::new().add_text("Confidence").bold())),
    ]));

    let mut stmt = conn.prepare("SELECT origin_file, source, confidence FROM esg_state WHERE client_id = ?1 LIMIT 15").map_err(|e| e.to_string())?;
    let ledger_rows = stmt.query_map([client_id], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, f64>(2)?))
    }).map_err(|e| e.to_string())?;

    for row in ledger_rows {
        let (file, label, conf) = row.map_err(|e| e.to_string())?;
        ledger_table = ledger_table.add_row(TableRow::new(vec![
            TableCell::new().add_paragraph(Paragraph::new().add_run(Run::new().add_text(file))),
            TableCell::new().add_paragraph(Paragraph::new().add_run(Run::new().add_text(label))),
            TableCell::new().add_paragraph(Paragraph::new().add_run(Run::new().add_text(format!("{:.0}%", conf * 100.0)))),
        ]));
    }
    docx = docx.add_table(ledger_table);

    // --- SECTION 3: ESRS GAP TABLE ---
    docx = docx.add_paragraph(Paragraph::new().add_run(Run::new().add_break(BreakType::Page)));
    docx = docx.add_paragraph(Paragraph::new().add_run(Run::new().add_text("SECTION 3: ESRS COMPLIANCE MATRIX").size(32).bold()));

    let mut gap_table = Table::new(vec![]);
    gap_table = gap_table.add_row(TableRow::new(vec![
        TableCell::new().add_paragraph(Paragraph::new().add_run(Run::new().add_text("ESRS Standard").bold())),
        TableCell::new().add_paragraph(Paragraph::new().add_run(Run::new().add_text("Status").bold())),
    ]));

    for (id, name, is_comp) in standards {
        let status = if is_comp { "COMPLIANT" } else { "GAP DETECTED" };
        gap_table = gap_table.add_row(TableRow::new(vec![
            TableCell::new().add_paragraph(Paragraph::new().add_run(Run::new().add_text(format!("{}: {}", id, name)))),
            TableCell::new().add_paragraph(Paragraph::new().add_run(Run::new().add_text(status))),
        ]));
    }
    docx = docx.add_table(gap_table);

    // 3. Save Document to Desktop
    let desktop_dir = dirs::desktop_dir().ok_or("Could not find Desktop directory")?;
    let file_name = format!("{}_CSRD_Report_{}.docx", company_name.replace(" ", "_"), reporting_year);
    let path = desktop_dir.join(&file_name);

    let file = File::create(&path).map_err(|e| format!("Failed to create file: {}", e))?;
    docx.build().pack(file).map_err(|e| format!("Failed to build docx: {}", e))?;

    // Log to Audit Trail
    let _ = crate::l6_audit::log_audit_event(
        app_handle,
        client_id,
        "Report Generation".to_string(),
        format!("Official CSRD Document generated: {}", file_name)
    );

    Ok(path.to_string_lossy().to_string())
}
