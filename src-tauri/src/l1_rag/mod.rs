use serde::{Deserialize, Serialize};
use rusqlite::Connection;
use tauri::command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EsrsDocument {
    pub id: i32,
    pub topic: String,
    pub paragraph_number: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub results: Vec<EsrsDocument>,
}

pub fn get_search_results(query: String) -> Result<Vec<EsrsDocument>, String> {
    let conn = Connection::open_in_memory().map_err(|e| e.to_string())?;
    
    conn.execute("CREATE VIRTUAL TABLE esrs_fts USING fts5(topic, paragraph_number, content)", [])
        .map_err(|e| e.to_string())?;

    let mock_data = vec![
        // ESRS E1 - Climate Change
        ("ESRS E1: Climate change", "E1-1 Para 16", "The undertaking shall disclose its transition plan for climate change mitigation, including its ambition to ensure that its business model and strategy are compatible with the transition to a sustainable economy."),
        ("ESRS E1: Climate change", "E1-4 Para 34", "The undertaking shall disclose the climate-related targets it has set, including GHG emission reduction targets for 2030 and 2050."),
        ("ESRS E1: Climate change", "E1-5 Para 40", "The undertaking shall provide information on its energy consumption and mix, including total energy consumption from non-renewable sources and renewable sources in MWh."),
        ("ESRS E1: Climate change", "E1-6 Para 44", "The undertaking shall disclose its gross Scope 1, 2, 3 and total GHG emissions in metric tonnes of CO2 equivalent."),
        ("ESRS E1: Climate change", "AR 41", "Energy consumption includes all fuel and electricity consumed by the undertaking in its own operations and by assets it owns or controls."),
        ("ESRS E1: Climate change", "DR 5", "The undertaking shall report greenhouse gas emissions in accordance with the GHG Protocol Corporate Standard."),

        // ESRS E3 - Water and Marine Resources
        ("ESRS E3: Water and marine resources", "E3-1 Para 11", "The undertaking shall disclose its policies that address the management of its material impacts, risks and opportunities related to water and marine resources."),
        ("ESRS E3: Water and marine resources", "E3-4 Para 28", "The undertaking shall disclose its total water consumption in m3 from its own operations, including areas at water stress."),
        ("ESRS E3: Water and marine resources", "DR 1", "The undertaking shall disclose total water consumption, including water recycled and reused."),
        ("ESRS E3: Water and marine resources", "E3-2 Para 17", "The undertaking shall disclose its actions and resources related to water and marine resources, including infrastructure investments."),

        // ESRS S1 - Own Workforce
        ("ESRS S1: Own workforce", "S1-1 Para 17", "The undertaking shall disclose its policies for own workers, including respect for human rights and fundamental freedoms."),
        ("ESRS S1: Own workforce", "S1-6 Para 47", "The undertaking shall disclose the total number of employees by head count, and breakdowns by gender and by country."),
        ("ESRS S1: Own workforce", "S1-10 Para 67", "The undertaking shall disclose the percentage of its own workers who are covered by collective bargaining agreements."),
        ("ESRS S1: Own workforce", "S1-14 Para 87", "The undertaking shall disclose the percentage of employees with disabilities, where applicable."),
        ("ESRS S1: Own workforce", "S1-3 Para 31", "The undertaking shall disclose the channels for own workers to raise concerns and the processes to remediate negative impacts."),
        ("ESRS S1: Own workforce", "DR 10", "Coverage of collective bargaining is a key indicator of social dialogue and worker representation."),

        // ESRS G1 - Business Conduct
        ("ESRS G1: Business conduct", "G1-1 Para 10", "The undertaking shall provide information about its strategy and approach to corporate culture and business conduct, including anti-corruption."),
        ("ESRS G1: Business conduct", "G1-3 Para 18", "The undertaking shall disclose its policies and procedures to prevent and detect corruption and bribery."),
        ("ESRS G1: Business conduct", "G1-4 Para 24", "The undertaking shall disclose confirmed incidents of corruption or bribery during the reporting period."),
        ("ESRS G1: Business conduct", "G1-5 Para 27", "The undertaking shall disclose its political influence and lobbying activities, including total monetary value of financial or in-kind political contributions."),
        ("ESRS G1: Business conduct", "DR 4", "Training on anti-corruption policies is essential for ensuring a culture of integrity across the organization."),
        ("ESRS G1: Business conduct", "Para 33", "The undertaking shall disclose its payment practices, especially regarding late payments to small and medium-sized enterprises (SMEs)."),
    ];

    for (topic, para, content) in mock_data {
        conn.execute(
            "INSERT INTO esrs_fts (topic, paragraph_number, content) VALUES (?, ?, ?)",
            [topic, para, content],
        ).map_err(|e| e.to_string())?;
    }

    let mut stmt = conn
        .prepare("SELECT rowid, topic, paragraph_number, content FROM esrs_fts WHERE esrs_fts MATCH ? LIMIT 5")
        .map_err(|e| e.to_string())?;

    let results = stmt.query_map([query], |row| {
        Ok(EsrsDocument {
            id: row.get(0)?,
            topic: row.get(1)?,
            paragraph_number: row.get(2)?,
            content: row.get(3)?,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect::<Vec<EsrsDocument>>();

    Ok(results)
}

#[command]
pub fn search_esrs(query: String) -> Result<String, String> {
    let results = get_search_results(query)?;
    let search_result = SearchResult { results };
    serde_json::to_string(&search_result).map_err(|e| e.to_string())
}

#[command]
pub fn ask_ai(question: String) -> Result<String, String> {
    let results = get_search_results(question.clone())?;
    
    if results.is_empty() {
        return Ok("I'm sorry, I couldn't find any relevant ESRS disclosure requirements for your question in the database. Please try to use keywords like 'climate', 'water', 'emissions', or 'workforce'.".to_string());
    }

    let mut response = format!("Based on the ESRS documentation, here is the information regarding \"{}\":\n\n", question);
    
    for doc in results {
        response.push_str(&format!("### {} ({})\n{}\n\n", doc.topic, doc.paragraph_number, doc.content));
    }

    response.push_str("---\n*Note: This response is generated based on the official European Sustainability Reporting Standards (ESRS).*");

    Ok(response)
}
