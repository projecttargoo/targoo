use serde::{Deserialize, Serialize};
use tauri::{command, AppHandle, State};
use crate::l6_audit::get_db_connection;
use rusqlite::{params, Result};
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Client {
    pub id: i32,
    pub name: String,
    pub industry: String,
    pub country: String,
    pub tax_id: String,
    pub reporting_year: i32,
    pub jurisdiction: String,
    pub employee_count: i32,
    pub revenue: f64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Project {
    pub id: i32,
    pub client_id: i32,
    pub name: String,
    pub reporting_year: i32,
    pub status: String,
    pub created_at: String,
}

pub struct WorkspaceState {
    pub active_project_id: Mutex<Option<i32>>,
}

pub fn init_workspace_db(app_handle: &AppHandle) -> Result<()> {
    let conn = get_db_connection(app_handle).map_err(|e| e)?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            industry TEXT,
            country TEXT,
            tax_id TEXT,
            reporting_year INTEGER DEFAULT 2024,
            jurisdiction TEXT,
            employee_count INTEGER,
            revenue REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // Migrations: Add new columns if they don't exist
    let _ = conn.execute("ALTER TABLE clients ADD COLUMN tax_id TEXT", []);
    let _ = conn.execute("ALTER TABLE clients ADD COLUMN reporting_year INTEGER DEFAULT 2024", []);
    let _ = conn.execute("ALTER TABLE clients ADD COLUMN jurisdiction TEXT", []);

    conn.execute(
        "CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            reporting_year INTEGER,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES clients (id)
        )",
        [],
    )?;

    Ok(())
}

#[command]
pub fn create_client(
    app_handle: AppHandle,
    name: String,
    industry: String,
    country: String,
    tax_id: String,
    reporting_year: i32,
    jurisdiction: String,
    employee_count: i32,
    revenue: f64,
) -> Result<i64, String> {
    let conn = get_db_connection(&app_handle).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO clients (name, industry, country, tax_id, reporting_year, jurisdiction, employee_count, revenue) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        params![name, industry, country, tax_id, reporting_year, jurisdiction, employee_count, revenue],
    ).map_err(|e| e.to_string())?;
    
    Ok(conn.last_insert_rowid())
}

#[command]
pub fn get_clients(app_handle: AppHandle) -> Result<Vec<Client>, String> {
    let conn = get_db_connection(&app_handle).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, name, industry, country, tax_id, reporting_year, jurisdiction, employee_count, revenue, created_at FROM clients")
        .map_err(|e| e.to_string())?;
    
    let clients = stmt.query_map([], |row| {
        Ok(Client {
            id: row.get(0)?,
            name: row.get(1)?,
            industry: row.get(2)?,
            country: row.get(3)?,
            tax_id: row.get(4).unwrap_or_default(),
            reporting_year: row.get(5).unwrap_or(2024),
            jurisdiction: row.get(6).unwrap_or_default(),
            employee_count: row.get(7).unwrap_or(0),
            revenue: row.get(8).unwrap_or(0.0),
            created_at: row.get(9)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    Ok(clients)
}

#[command]
pub fn create_project(
    app_handle: AppHandle,
    client_id: i32,
    name: String,
    reporting_year: i32,
) -> Result<i64, String> {
    let conn = get_db_connection(&app_handle).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO projects (client_id, name, reporting_year) VALUES (?, ?, ?)",
        params![client_id, name, reporting_year],
    ).map_err(|e| e.to_string())?;
    
    Ok(conn.last_insert_rowid())
}

#[command]
pub fn get_projects(app_handle: AppHandle, client_id: i32) -> Result<Vec<Project>, String> {
    let conn = get_db_connection(&app_handle).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, client_id, name, reporting_year, status, created_at FROM projects WHERE client_id = ?")
        .map_err(|e| e.to_string())?;
    
    let projects = stmt.query_map([client_id], |row| {
        Ok(Project {
            id: row.get(0)?,
            client_id: row.get(1)?,
            name: row.get(2)?,
            reporting_year: row.get(3)?,
            status: row.get(4)?,
            created_at: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    Ok(projects)
}

#[command]
pub fn set_active_project(
    project_id: i32,
    state: State<WorkspaceState>,
) -> Result<(), String> {
    let mut active_id = state.active_project_id.lock().map_err(|e| e.to_string())?;
    *active_id = Some(project_id);
    Ok(())
}
