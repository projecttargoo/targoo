use docx_rs::*;
use serde::Deserialize;
use std::fs::File;
use chrono::Local;
use tauri::command;

#[derive(Debug, Deserialize)]
pub struct GapAnalysisResult {
    pub topics: std::collections::HashMap<String, String>,
}

#[command]
pub fn generate_report(company_name: String, gap_analysis_json: String, language: String) -> Result<String, String> {
    let gap_results: GapAnalysisResult = serde_json::from_str(&gap_analysis_json)
        .map_err(|e| format!("Failed to parse gap analysis results: {}", e))?;

    let is_de = language.to_lowercase() == "de";
    let date = Local::now().format("%Y-%m-%d").to_string();
    
    // Prepare Desktop path
    let desktop_dir = dirs::desktop_dir().ok_or("Could not find Desktop directory")?;
    let file_name = format!("{}_ESG_Report_{}.docx", company_name.replace(" ", "_"), date);
    let path = desktop_dir.join(&file_name);

    let mut docx = Docx::new();

    // Title
    let title = if is_de { "ESG-GAP-ANALYSEBERICHT" } else { "ESG GAP ANALYSIS REPORT" };
    docx = docx.add_paragraph(
        Paragraph::new()
            .add_run(Run::new().add_text(title).size(32).bold())
            .align(AlignmentType::Center)
    );

    // Company Info
    let company_label = if is_de { "Unternehmen:" } else { "Company:" };
    docx = docx.add_paragraph(
        Paragraph::new().add_run(Run::new().add_text(format!("{} {}", company_label, company_name)).size(24).bold())
    );
    docx = docx.add_paragraph(
        Paragraph::new().add_run(Run::new().add_text(format!("Date: {}", date)).size(20))
    );

    // Executive Summary
    let exec_summary_title = if is_de { "Management-Zusammenfassung" } else { "Executive Summary" };
    docx = docx.add_paragraph(Paragraph::new().add_run(Run::new().add_text(exec_summary_title).size(24).bold()));
    let exec_text = if is_de {
        "Dieser Bericht fasst die Ergebnisse der ESG-Gap-Analyse gemäß den ESRS-Standards zusammen. Er identifiziert kritische Bereiche und bietet einen strategischen Fahrplan für die ESG-Compliance."
    } else {
        "This report summarizes the ESG gap analysis findings based on ESRS standards. It identifies critical areas and provides a strategic roadmap for ESG compliance."
    };
    docx = docx.add_paragraph(Paragraph::new().add_run(Run::new().add_text(exec_text)));

    // Gap Analysis Table
    let table_title = if is_de { "ESRS Gap-Analyse Ergebnisse" } else { "ESRS Gap Analysis Results" };
    docx = docx.add_paragraph(Paragraph::new().add_run(Run::new().add_text(table_title).size(24).bold()));

    let mut table = Table::new(vec![]);
    // Header row
    let header_row = TableRow::new(vec![
        TableCell::new().add_paragraph(Paragraph::new().add_run(Run::new().add_text("ESRS Topic").bold())),
        TableCell::new().add_paragraph(Paragraph::new().add_run(Run::new().add_text("Status").bold())),
    ]);
    table = table.add_row(header_row);

    // Data rows
    for (topic, status) in gap_results.topics.iter() {
        let row = TableRow::new(vec![
            TableCell::new().add_paragraph(Paragraph::new().add_run(Run::new().add_text(topic))),
            TableCell::new().add_paragraph(Paragraph::new().add_run(Run::new().add_text(status.to_uppercase()))),
        ]);
        table = table.add_row(row);
    }
    docx = docx.add_table(table);

    // 30/60/90 Action Plan
    let plan_title = if is_de { "30/60/90 Tage Aktionsplan" } else { "30/60/90 Day Action Plan" };
    docx = docx.add_paragraph(Paragraph::new().add_run(Run::new().add_text(plan_title).size(24).bold()));

    let periods = if is_de { vec!["30 Tage", "60 Tage", "90 Tage"] } else { vec!["30 Days", "60 Days", "90 Days"] };
    let plan_items = if is_de {
        vec![
            "Sofortige Datenerfassung für rote ESRS-Themen einleiten.",
            "Interne ESG-Governance-Strukturen etablieren und Verantwortliche ernennen.",
            "Finalisierung des ersten ESRS-konformen Entwurfs und Stakeholder-Konsultation."
        ]
    } else {
        vec![
            "Initiate immediate data collection for RED ESRS topics.",
            "Establish internal ESG governance structures and appoint owners.",
            "Finalize first ESRS-compliant draft and conduct stakeholder consultation."
        ]
    };

    for (i, period) in periods.iter().enumerate() {
        docx = docx.add_paragraph(Paragraph::new().add_run(Run::new().add_text(format!("{}: {}", period, plan_items[i])).bold()));
    }

    // Save File
    let file = File::create(&path).map_err(|e| format!("Failed to create file: {}", e))?;
    docx.build().pack(file).map_err(|e| format!("Failed to build docx: {}", e))?;

    Ok(path.to_string_lossy().to_string())
}
