import React, { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, Users, FolderKanban, Database, Scale, Leaf, ClipboardList, FileText, Search, BookOpen, Settings, Send, AlertTriangle, CheckCircle, XCircle, TrendingUp, TrendingDown, Zap, RefreshCw, Download, Bell, LayoutList, Play, StopCircle, Loader2, UploadCloud, BarChart2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import logo from './assets/targoo.png';

const S = {
bg: '#f5f5f7',
panel: '#ffffff',
border: '#e5e7eb',
text: '#111827',
muted: '#6b7280',
accent: '#007aff',
accentBg: 'rgba(0,122,255,0.08)',
green: '#34c759',
red: '#ff3b30',
amber: '#ff9500',
shadow: '0 1px 3px rgba(0,0,0,0.06)',
shadowMd: '0 4px 16px rgba(0,0,0,0.08)',
radius: '12px',
font: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif'
};

const menuItems = [
{ id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
{ id: 'clients', icon: Users, label: 'Clients' },
{ id: 'projects', icon: FolderKanban, label: 'Engagements' },
{ id: 'data', icon: Database, label: 'Data Intake' },
{ id: 'gap', icon: BarChart2, label: 'Gap Analysis' },
{ id: 'materiality', icon: Scale, label: 'Analysis' },
{ id: 'emissions', icon: Leaf, label: 'Emissions' },
{ id: 'esrs', icon: ClipboardList, label: 'Compliance' },
{ id: 'reports', icon: FileText, label: 'Reports' },
{ id: 'audit', icon: Search, label: 'Audit Trail' },
{ id: 'library', icon: BookOpen, label: 'Library' },
{ id: 'settings', icon: Settings, label: 'Settings' }
];

const initialClients = [
{ id: 1, name: 'Hans GmbH Demo', score: 74, status: 'partial' },
{ id: 2, name: 'Müller & Co', score: 62, status: 'risk' },
{ id: 3, name: 'Schweizer AG', score: 81, status: 'ready' }
];

export default function App() {
const [dashboardStats, setDashboardStats] = useState(null);
const [co2Trend, setCo2Trend] = useState([]);
const [esrsCompliance, setEsrsCompliance] = useState([]);
const [ledgerData, setLedgerData] = useState([]);
const [materialityData, setMaterialityData] = useState([]);
const [clients, setClients] = useState(initialClients);
const [activeTab, setActiveTab] = useState('dashboard');
const [chatInput, setChatInput] = useState('');
const [chatHistory, setChatHistory] = useState([
{ role: 'ai', text: '⚠ CSRD Risk Detected: Hans GmbH is missing ESRS E1-3 data. Audit deadline in 298 days. Shall I walk you through the 3-step fix?' }
]);
const [selectedClientId, setSelectedClientId] = useState(1);
const [isDragging, setIsDragging] = useState(false);
const [modelReady, setModelReady] = useState(false);
const [modelDownloading, setModelDownloading] = useState(false);
const [downloadProgress, setDownloadProgress] = useState(0);
const [dataImported, setDataImported] = useState(false);
const [importResults, setImportResults] = useState(null);
const [incompleteReports] = useState(3);
const [complianceRisks] = useState(2);

// Gap Analysis State
const [isAnalyzing, setIsAnalyzing] = useState(false);
const [analysisProgress, setAnalysisProgress] = useState(0);
const [currentTopic, setCurrentTopic] = useState('');
const [analysisResults, setAnalysisResults] = useState(null);
const [companySize, setCompanySize] = useState('large');
const [sector, setSector] = useState('manufacturing');

// Data Intake State
const [isProcessing, setIsProcessing] = useState(false);
const [processedSummary, setProcessedSummary] = useState(null);

const chatEndRef = useRef(null);

const activeClient = clients.find(c => c.id === selectedClientId) || clients[0];

useEffect(() => {
chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [chatHistory]);

useEffect(() => {
if (window.__TAURI__) {
const { listen } = window.__TAURI__;
invoke('check_model').then(r => setModelReady(r)).catch(() => {});
if (listen) {
listen('download_progress', (e) => {
setDownloadProgress(Math.round(e.payload));
if (e.payload >= 100) { setModelReady(true); setModelDownloading(false); }
});

listen('gap_progress', (e) => {
setAnalysisProgress(e.payload.progress);
setCurrentTopic(e.payload.current_topic);
});
}
}
}, []);

// Refresh dashboard data when selectedClientId changes
useEffect(() => {
  const loadStats = async () => {
    try {
      const stats = await invoke('get_dashboard_stats', { clientId: selectedClientId });
      setDashboardStats(stats);
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
      setDashboardStats(null);
    }
    try {
      const trend = await invoke('get_co2_trend', { clientId: selectedClientId });
      const trendData = JSON.parse(trend);
      setCo2Trend(trendData.length > 0 ? trendData : []);
    } catch(e) { setCo2Trend([]); }
    try {
      const compliance = await invoke('get_esrs_compliance', { clientId: selectedClientId });
      setEsrsCompliance(JSON.parse(compliance));
    } catch(e) { setEsrsCompliance([]); }
    try {
      const ledger = await invoke('get_esg_ledger', { clientId: selectedClientId });
      setLedgerData(JSON.parse(ledger));
    } catch(e) { setLedgerData([]); }
    try {
      const mat = await invoke('get_materiality_assessment', { clientId: selectedClientId });
      setMaterialityData(JSON.parse(mat));
    } catch(e) { setMaterialityData([]); }
  };
  loadStats();
}, [selectedClientId]);

// Initial load of clients
useEffect(() => {
  const loadClients = async () => {
    try {
      const clientList = await invoke('get_enterprise_clients');
      if (clientList && clientList.length > 0) {
        setClients(clientList.map(c => ({
          id: c.id,
          name: c.name,
          score: c.score || 0,
          status: c.score >= 75 ? 'ready' : (c.score > 0 ? 'partial' : 'risk')
        })));
      }
    } catch (err) {
      console.log('Using demo clients:', err);
    }
  };
  loadClients();
}, []);

const runGapAnalysis = async () => {
setIsAnalyzing(true);
setAnalysisProgress(0);
setAnalysisResults(null);
try {
  const resultStr = await invoke('gap_analysis', {
    input: { company_size: companySize, sector, country: 'DE' }
  });
  setAnalysisResults(JSON.parse(resultStr));
} catch (err) {
console.error(err);
} finally {
setIsAnalyzing(false);
setCurrentTopic('');
}
};

const cancelGapAnalysis = async () => {
  await invoke('cancel_gap_analysis');
  setIsAnalyzing(false);
};

const handleFileUpload = async (filename, content = []) => {
if (!filename) return;
console.log('Uploading file:', filename);
setImportResults(null);
setIsProcessing(true);
setProcessedSummary(null);
setChatHistory(prev => [...prev, { role: 'user', text: `Uploading ${filename}...` }]);
try {
  const result = await invoke('import_files', { 
    filePaths: [filename],
    fileContent: content,
    clientId: selectedClientId
  });
  // result is already parsed by Tauri bridge
  setImportResults({
    recognized: result.categories_found || [],
    warnings: result.errors || [],
    records: result.imported_count || 0,
    mapping_summary: result.mapping_summary || []
  });
  setChatHistory(prev => [...prev, {
    role: 'ai',
    text: `Processed ${result.imported_count || 0} records from ${filename}`
  }]);
  // Also update the UI summary
  setProcessedSummary({
    filename: filename.split(/[\\/]/).pop(),
    row_count: result.imported_count,
    detected_scope: (result.categories_found || []).join(', ') || 'Uncategorized'
  });
  setDataImported(true);

  // Refresh all dashboard data after successful import for the current client
  const stats = await invoke('get_dashboard_stats', { clientId: selectedClientId });
  setDashboardStats(stats);
  
  try {
    const trend = await invoke('get_co2_trend', { clientId: selectedClientId });
    const trendData = JSON.parse(trend);
    setCo2Trend(trendData.length > 0 ? trendData : []);
  } catch(e) { setCo2Trend([]); }
  
  try {
    const compliance = await invoke('get_esrs_compliance', { clientId: selectedClientId });
    setEsrsCompliance(JSON.parse(compliance));
  } catch(e) { setEsrsCompliance([]); }
  try {
    const ledger = await invoke('get_esg_ledger', { clientId: selectedClientId });
    setLedgerData(JSON.parse(ledger));
  } catch(e) { setLedgerData([]); }

  // Automatically call analyze_imported_data after successful import

  try {
    const analysis = await invoke('analyze_imported_data', { clientId: selectedClientId });
    const proactiveMsg = `📊 Auto-Analysis for ${filename.split(/[\\/]/).pop()}\n\n${analysis.proactive_message || 'No specific insights detected.'}`;
    setChatHistory(prev => [...prev, { role: 'ai', text: proactiveMsg }]);
  } catch (err) {
    console.log('Analysis error:', err);
  }
} catch (err) {
setImportResults({
recognized: [],
warnings: ['Import failed: ' + err],
records: 0
});
setChatHistory(prev => [...prev, { role: 'ai', text: `❌ Error processing file: ${err}` }]);
} finally {
setIsProcessing(false);
}
};

const handleBrowseFiles = () => {
  document.getElementById('file-input').click();
};

const handleSend = async (e) => {
  if (e) e.preventDefault();
  if (!chatInput.trim()) return;
  const userMsg = { role: 'user', text: chatInput };
  setChatHistory(prev => [...prev, userMsg, { role: 'ai', text: 'Analyzing...' }]);
  const question = chatInput;
  setChatInput('');
  try {
    const response = await invoke('ask_ai', { 
      question: question 
    });
    setChatHistory(prev => [...prev.slice(0, -1), { role: 'ai', text: response }]);
  } catch (err) {
    setChatHistory(prev => [...prev.slice(0, -1), { 
      role: 'ai', 
      text: 'AI engine is loading. Please download the Gemma model first.' 
    }]);
  }
};

const statusColor = { ready: S.green, partial: S.amber, risk: S.red };
const statusLabel = { ready: '● Audit Ready', partial: '◐ In Progress', risk: '⚠ Action Required' };

return (
<div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', fontFamily: S.font, background: S.bg, overflow: 'hidden' }}>
<style>{`* { box-sizing: border-box; margin: 0; padding: 0; } body { overflow: hidden; -webkit-font-smoothing: antialiased; } ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; } @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } } @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } } @keyframes drawLine { from { stroke-dashoffset: 700; } to { stroke-dashoffset: 0; } } .nav-btn:hover { background: rgba(0,122,255,0.06) !important; color: #007aff !important; transform: translateX(2px); } .kpi-card:hover { transform: translateY(-3px) scale(1.01); box-shadow: 0 12px 32px rgba(0,0,0,0.10) !important; } .action-btn:hover { opacity: 0.88; transform: scale(0.98); } .row-hover:hover { background: #f9fafb !important; }`}</style>

  {/* Hidden native file input */}
  <input 
    type="file" 
    id="file-input"
    multiple
    accept=".xlsx,.xls,.csv,.pdf,.xml"
    style={{display: 'none'}}
    onChange={async (e) => {
      const files = Array.from(e.target.files);
      for (const file of files) {
        await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = async (event) => {
            const content = Array.from(new Uint8Array(event.target.result));
            await handleFileUpload(file.name, content);
            resolve();
          };
          reader.readAsArrayBuffer(file);
        });
      }
      e.target.value = ''; // Reset input
    }}
  />

  {/* ── ALERT BAR ── */}
  {(() => {
    const missingCount = esrsCompliance.filter(i => i.status === 'Missing').length;
    const hasRisks = missingCount > 0;
    return (
      <div style={{ background: hasRisks ? '#fff3cd' : '#e0f2fe', borderBottom: `1px solid ${hasRisks ? '#ffc107' : '#bae6fd'}`, padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, transition: 'all 0.3s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: hasRisks ? '#856404' : '#0369a1' }}>
            {hasRisks ? `⚠ ${missingCount} critical compliance risks detected` : '✓ No critical compliance risks detected'}
          </span>
          {hasRisks && <span style={{ fontSize: '12px', color: '#856404' }}>Potential fine: <b>€{(missingCount * 1.2).toFixed(1)}M</b></span>}
          <span style={{ fontSize: '12px', color: hasRisks ? '#856404' : '#0369a1' }}>Audit Deadline: <b>298 days</b></span>
        </div>
        {hasRisks && (
          <button className="action-btn" onClick={() => setActiveTab('esrs')} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '5px 14px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.15s' }}>
            Fix All Compliance Gaps
          </button>
        )}
      </div>
    );
  })()}

  {/* ── TOP BAR ── */}
  <div style={{ height: '48px', background: S.panel, borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0, zIndex: 10 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
      <span style={{ fontSize: '13px', fontWeight: '700', color: S.text }}>{activeClient.name}</span>
      <span style={{ fontSize: '11px', fontWeight: '600', color: statusColor[activeClient.status], background: statusColor[activeClient.status] + '18', padding: '3px 10px', borderRadius: '20px' }}>
        {statusLabel[activeClient.status]}
      </span>
      <span style={{ fontSize: '11px', color: S.muted }}>Last sync: <b>2 min ago</b></span>
      {incompleteReports > 0 && (
        <span style={{ fontSize: '11px', color: S.amber, background: S.amber + '15', padding: '3px 10px', borderRadius: '20px', fontWeight: '600' }}>
          ⏳ {incompleteReports} incomplete reports
        </span>
      )}
      {complianceRisks > 0 && (
        <span style={{ fontSize: '11px', color: S.red, background: S.red + '12', padding: '3px 10px', borderRadius: '20px', fontWeight: '600' }}>
          ⚠ {complianceRisks} compliance risks
        </span>
      )}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <button className="action-btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: S.accent, color: 'white', border: 'none', padding: '7px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s ease' }}>
        <Download size={13} /> Export Report
      </button>
      <div style={{ width: '30px', height: '30px', background: S.accent, color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700' }}>FR</div>
    </div>
  </div>

  {/* ── BODY ── */}
  <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

    {/* ── SIDEBAR ── */}
    <aside style={{ width: '240px', background: S.panel, borderRight: `1px solid ${S.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: '18px 16px 12px', borderBottom: `1px solid ${S.border}` }}>
        <img src={logo} alt="Targoo" style={{ width: '130px', height: 'auto', display: 'block', marginBottom: '3px' }} />
        <div style={{ fontSize: '9px', fontWeight: '700', color: '#9ca3af', letterSpacing: '0.12em', textTransform: 'uppercase' }}>ESG Advisor Engine</div>
        <select value={selectedClientId} onChange={e => setSelectedClientId(Number(e.target.value))} style={{ width: '100%', marginTop: '10px', padding: '8px 10px', borderRadius: '8px', border: `1px solid ${S.border}`, background: S.bg, color: S.text, fontWeight: '500', fontSize: '12px', cursor: 'pointer' }}>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {menuItems.map(item => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          return (
            <button key={item.id} className="nav-btn" onClick={() => setActiveTab(item.id)} style={{ display: 'flex', alignItems: 'center', gap: '9px', width: '100%', padding: '8px 11px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: isActive ? '600' : '500', marginBottom: '1px', background: isActive ? S.accentBg : 'transparent', color: isActive ? S.accent : S.muted, transition: 'all 0.15s ease', textAlign: 'left' }}>
              <Icon size={15} strokeWidth={isActive ? 2 : 1.5} />
              {item.label}
              {item.id === 'esrs' && complianceRisks > 0 && (
                <span style={{ marginLeft: 'auto', background: S.red, color: 'white', borderRadius: '10px', padding: '1px 6px', fontSize: '10px', fontWeight: '700' }}>{complianceRisks}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* DROP HUB */}
      <div style={{ padding: '12px', borderTop: `1px solid ${S.border}` }}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => { e.preventDefault(); setIsDragging(false); handleFileUpload(e.dataTransfer.files[0]?.name || 'data.xlsx'); }}>
        <div onClick={handleBrowseFiles} style={{ padding: '16px 12px', borderRadius: '12px', border: `2px dashed ${isDragging ? S.accent : '#c7d2fe'}`, background: isDragging ? 'rgba(0,122,255,0.06)' : 'linear-gradient(135deg,#f0f4ff,#e8f0fe)', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s ease', transform: isDragging ? 'scale(1.02)' : 'scale(1)' }}>
          <Database size={18} color={isDragging ? S.accent : '#6366f1'} style={{ marginBottom: '6px' }} />
          <div style={{ fontSize: '11px', fontWeight: '700', color: isDragging ? S.accent : '#374151', marginBottom: '3px' }}>{isDragging ? 'Release to import' : 'Drop ESG files'}</div>
          <div style={{ fontSize: '9px', color: S.muted }}>SAP · Oracle · CSV · PDF · XML</div>
          <button className="action-btn" onClick={(e) => { e.stopPropagation(); handleBrowseFiles(); }} style={{ marginTop: '10px', width: '100%', background: S.accent, color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Browse Files</button>
        </div>
        {(isProcessing || processedSummary || importResults) && (
          <div style={{ marginTop: '10px', padding: '10px', borderRadius: '10px', background: isProcessing ? S.bg : 'rgba(255,255,255,0.5)', border: `1px solid ${isProcessing ? S.border : '#e5e7eb'}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            {isProcessing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', color: S.muted, padding: '4px 0' }}>
                <Loader2 size={12} className="spin" style={{ animation: 'rotate 1s linear infinite' }} />
                <span>Processing ERP file...</span>
              </div>
            ) : importResults?.mapping_summary ? (
              <div style={{ animation: 'fadeIn 0.3s ease' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: S.text, marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Confidence Report</span>
                  <span style={{ color: S.green }}>{importResults.records} records</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #eee' }}>
                      <th style={{ textAlign: 'left', padding: '4px 2px', color: S.muted, fontWeight: '600' }}>Metric</th>
                      <th style={{ textAlign: 'left', padding: '4px 2px', color: S.muted, fontWeight: '600' }}>Value</th>
                      <th style={{ textAlign: 'right', padding: '4px 2px', color: S.muted, fontWeight: '600' }}>Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResults.mapping_summary.map((m, i) => (
                      <tr key={i} style={{ borderBottom: i < importResults.mapping_summary.length - 1 ? '1px solid #f9f9f9' : 'none' }}>
                        <td style={{ padding: '5px 2px', fontWeight: '600', color: '#374151', textTransform: 'capitalize' }}>{m.label.replace('scope', 'S').replace('_', ' ')}</td>
                        <td style={{ padding: '5px 2px', color: S.text }}>{m.value.toLocaleString()} <span style={{ color: S.muted, fontSize: '8px' }}>{m.unit}</span></td>
                        <td style={{ padding: '5px 2px', textAlign: 'right', fontWeight: '700', color: m.confidence > 0.9 ? S.green : m.confidence > 0.7 ? S.amber : S.red }}>
                          <span style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', background: m.confidence > 0.9 ? S.green : m.confidence > 0.7 ? S.amber : S.red, marginRight: '4px', verticalAlign: 'middle' }}></span>
                          {Math.round(m.confidence * 100)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : importResults ? (
              <>
                {importResults.recognized.map((r, i) => <div key={i} style={{ fontSize: '10px', color: '#16a34a', fontWeight: '600', marginBottom: '2px' }}>✔ {r}</div>)}
                {importResults.warnings.map((w, i) => <div key={i} style={{ fontSize: '10px', color: S.amber, fontWeight: '600', marginBottom: '2px' }}>⚠ {w}</div>)}
                <div style={{ fontSize: '9px', color: S.muted, marginTop: '4px' }}>{importResults.records} records processed</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: '600', marginBottom: '2px' }}>✔ {processedSummary.filename}</div>
                <div style={{ fontSize: '9px', color: S.muted }}>{processedSummary.row_count} rows · {processedSummary.detected_scope}</div>
              </>
            )}
          </div>
        )}
      </div>
    </aside>

    {/* ── MAIN ── */}
    <main style={{ flex: 1, overflowY: 'auto', padding: '28px' }}>
      <MainContent 
        activeTab={activeTab} 
        activeClient={activeClient} 
        gapState={{ isAnalyzing, analysisProgress, currentTopic, analysisResults, companySize, setCompanySize, sector, setSector, runGapAnalysis, cancelGapAnalysis }}
        dataState={{ isProcessing, processedSummary, handleFileUpload, handleBrowseFiles }}
        dashboardStats={dashboardStats}
        co2Trend={co2Trend}
        esrsCompliance={esrsCompliance}
        ledgerData={ledgerData}
        materialityData={materialityData}
        setMaterialityData={setMaterialityData}
        selectedClientId={selectedClientId}
      />
    </main>

    {/* ── RIGHT PANEL ── */}
    <aside style={{ width: '300px', background: S.panel, borderLeft: `1px solid ${S.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: '18px 18px 14px', borderBottom: `1px solid ${S.border}` }}>
        <div style={{ fontSize: '14px', fontWeight: '700', color: S.text }}>CSRD Compass AI</div>
        <div style={{ fontSize: '11px', color: S.green, marginTop: '3px', fontWeight: '600' }}>● Compliance Engine Active</div>
      </div>

      {!modelReady && (
        <div style={{ margin: '12px', padding: '14px', background: 'rgba(255,149,0,0.06)', border: '1px solid rgba(255,149,0,0.2)', borderRadius: '10px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: S.amber, marginBottom: '6px' }}>⚡ AI Engine Required</div>
          <div style={{ fontSize: '11px', color: S.muted, marginBottom: '10px', lineHeight: '1.5' }}>
            {modelDownloading ? `Downloading Gemma AI... ${downloadProgress}%` : 'Download the offline AI model for full ESRS analysis.'}
          </div>
          {modelDownloading && <div style={{ height: '4px', background: '#e5e7eb', borderRadius: '2px', marginBottom: '10px' }}><div style={{ height: '100%', width: `${downloadProgress}%`, background: S.amber, borderRadius: '2px', transition: 'width 0.3s' }} /></div>}
          {!modelDownloading && (
            <button type="button" onClick={async () => { setModelDownloading(true); try { await invoke('download_model'); } catch { setModelDownloading(false); } }} style={{ width: '100%', padding: '8px', background: S.amber, color: 'white', border: 'none', borderRadius: '7px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
              Download AI Model (1.2 GB)
            </button>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div style={{ padding: '12px 14px', borderBottom: `1px solid ${S.border}` }}>
        <div style={{ fontSize: '10px', fontWeight: '700', color: S.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Quick Actions</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {[
            { label: '📄 Generate CSRD Report', action: 'Generate the full CSRD compliance report' },
            { label: '🔍 Run Gap Analysis', action: 'Run a complete ESRS gap analysis' },
            { label: '📦 Request Supplier Data', action: 'Generate Scope 3 supplier questionnaire' },
            { label: '💡 Explain ESG Score', action: 'Explain the current ESG score drivers and how to improve' },
            { label: '🔍 Debug ESG State', action: 'debug' }
          ].map((qa, i) => (
            <button key={i} className="action-btn" onClick={async () => { 
              if (qa.action === 'debug') {
                const result = await invoke('debug_esg_state', { clientId: selectedClientId });
                setChatHistory(prev => [...prev, { role: 'ai', text: `ESG State (Client ${selectedClientId}): ` + result }]);
              } else {
                setChatInput(qa.action); 
              }
            }} style={{ textAlign: 'left', padding: '7px 10px', borderRadius: '8px', border: `1px solid ${S.border}`, background: S.bg, color: S.text, fontSize: '11px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.15s ease' }}>
              {qa.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, padding: '14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {chatHistory.map((msg, i) => {
          const isHighRisk = msg.role === 'ai' && (msg.text.includes('High Risk') || msg.text.includes('dependency'));
          return (
            <div key={i} style={{ 
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', 
              maxWidth: '88%', 
              padding: '10px 12px', 
              borderRadius: '12px', 
              fontSize: '12px', 
              lineHeight: '1.5', 
              background: msg.role === 'user' ? S.accent : S.bg, 
              color: msg.role === 'user' ? 'white' : S.text, 
              border: isHighRisk ? `1px solid ${S.red}40` : (msg.role === 'ai' ? `1px solid ${S.border}` : 'none'),
              boxShadow: isHighRisk ? `0 0 12px ${S.red}10` : 'none',
              animation: 'fadeIn 0.2s ease',
              whiteSpace: 'pre-wrap'
            }}>
              {msg.text}
              {msg.role === 'ai' && msg.text.includes('Fix') && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                  <button className="action-btn" onClick={() => setChatInput('Show me step by step how to fix this')} style={{ padding: '5px 10px', background: S.accent, color: 'white', border: 'none', borderRadius: '6px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}>Fix now</button>
                  <button className="action-btn" onClick={() => setChatInput('Show details about this compliance issue')} style={{ padding: '5px 10px', background: 'transparent', color: S.accent, border: `1px solid ${S.accent}`, borderRadius: '6px', fontSize: '10px', fontWeight: '600', cursor: 'pointer' }}>Details</button>
                </div>
              )}
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      <form onSubmit={handleSend} style={{ padding: '12px', borderTop: `1px solid ${S.border}`, position: 'relative' }}>
        <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Ask about compliance..." style={{ width: '100%', background: S.bg, border: `1px solid ${S.border}`, borderRadius: '20px', padding: '9px 40px 9px 14px', fontSize: '12px', outline: 'none' }} />
        <button type="submit" style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', width: '28px', height: '28px', background: S.accent, borderRadius: '50%', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}>
          <Send size={13} />
        </button>
      </form>
    </aside>
  </div>
</div>

);
}

// ── NAV BUTTON ──
function NavButton({ item, isActive, onClick, badge }) {
const Icon = item.icon;
return (
<button className="nav-btn" onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '9px', width: '100%', padding: '8px 11px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: isActive ? '600' : '500', marginBottom: '1px', background: isActive ? 'rgba(0,122,255,0.08)' : 'transparent', color: isActive ? '#007aff' : '#6b7280', transition: 'all 0.15s ease', textAlign: 'left' }}>
<Icon size={15} strokeWidth={isActive ? 2 : 1.5} />
{item.label}
{badge && <span style={{ marginLeft: 'auto', background: '#ff3b30', color: 'white', borderRadius: '10px', padding: '1px 6px', fontSize: '10px', fontWeight: '700' }}>{badge}</span>}
</button>
);
}

// ── MAIN CONTENT ──
function MainContent({ activeTab, activeClient, gapState, dataState, dashboardStats, co2Trend, esrsCompliance, ledgerData, materialityData, setMaterialityData, selectedClientId }) {
switch (activeTab) {
case 'dashboard': return <DashboardView client={activeClient} dashboardStats={dashboardStats} co2Trend={co2Trend} esrsCompliance={esrsCompliance} />;
case 'clients': return <ClientsView />;
case 'data': return <DataView {...dataState} />;
case 'gap': return <GapAnalysisView {...gapState} />;
case 'materiality': return <MaterialityView materialityData={materialityData} setMaterialityData={setMaterialityData} selectedClientId={selectedClientId} />;
case 'emissions': return <EmissionsView ledgerData={ledgerData} />;
case 'esrs': return <ESRSView />;
case 'reports': return <ReportsView activeClient={activeClient} />;
case 'audit': return <AuditTrailView selectedClientId={activeClient.id} />;
default: return <PlaceholderView tabId={activeTab} />;
}
}
function MaterialityView({ materialityData, setMaterialityData, selectedClientId }) {
  const [hovered, setHovered] = useState(null);

  const handleScoreChange = async (topic_id, field, value) => {
    const updated = materialityData.map(t => {
      if (t.esrs_code === topic_id) {
        const newTopic = { ...t, [field]: parseFloat(value) };
        newTopic.is_material = newTopic.impact_score > 3.0 || newTopic.financial_score > 3.0;
        return newTopic;
      }
      return t;
    });
    setMaterialityData(updated);

    const topic = updated.find(t => t.esrs_code === topic_id);
    try {
      await invoke('update_materiality_score', {
        clientId: selectedClientId,
        topicId: topic_id,
        impactScore: topic.impact_score,
        financialScore: topic.financial_score
      });
    } catch (err) {
      console.error('Failed to update materiality score:', err);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', animation: 'fadeIn 0.3s ease', height: '100%' }}>
      {/* LEFT: SLIDERS */}
      <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', border: `1px solid ${S.border}`, boxShadow: S.shadow, overflowY: 'auto' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '700', color: S.text, marginBottom: '8px' }}>Double Materiality Wizard</h2>
        <p style={{ fontSize: '12px', color: S.muted, marginBottom: '24px' }}>Assess topics based on ESRS impact and financial importance.</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {materialityData.map(t => (
            <div key={t.esrs_code} style={{ padding: '16px', borderRadius: '12px', background: t.is_material ? 'rgba(52,199,89,0.04)' : S.bg, border: `1px solid ${t.is_material ? S.green + '30' : S.border}`, transition: 'all 0.2s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: S.text }}>{t.esrs_code} {t.topic_name}</div>
                <span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '20px', background: t.is_material ? S.green : S.muted, color: 'white' }}>
                  {t.is_material ? 'MATERIAL' : 'NOT MATERIAL'}
                </span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '600', color: S.muted, display: 'block', marginBottom: '6px' }}>Impact Materiality: {t.impact_score}</label>
                  <input type="range" min="1" max="5" step="0.5" value={t.impact_score} onChange={(e) => handleScoreChange(t.esrs_code, 'impact_score', e.target.value)} style={{ width: '100%', accentColor: S.accent, cursor: 'pointer' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '600', color: S.muted, display: 'block', marginBottom: '6px' }}>Financial Materiality: {t.financial_score}</label>
                  <input type="range" min="1" max="5" step="0.5" value={t.financial_score} onChange={(e) => handleScoreChange(t.esrs_code, 'financial_score', e.target.value)} style={{ width: '100%', accentColor: S.accent, cursor: 'pointer' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT: MATRIX */}
      <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', border: `1px solid ${S.border}`, boxShadow: S.shadow, display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '700', color: S.text, marginBottom: '24px', textAlign: 'center' }}>Materiality Matrix (CSRD)</h2>
        
        <div style={{ flex: 1, position: 'relative', margin: '20px' }}>
          <svg width="100%" height="100%" viewBox="0 0 400 400" style={{ overflow: 'visible' }}>
            {/* Background Quadrants */}
            <rect x="0" y="0" width="200" height="200" fill="#f9fafb" />
            <rect x="200" y="0" width="200" height="200" fill="rgba(52,199,89,0.05)" />
            <rect x="0" y="200" width="200" height="200" fill="#f9fafb" />
            <rect x="200" y="200" width="200" height="200" fill="rgba(52,199,89,0.05)" />
            
            {/* Axes */}
            <line x1="0" y1="400" x2="400" y2="400" stroke={S.border} strokeWidth="2" />
            <line x1="0" y1="0" x2="0" y2="400" stroke={S.border} strokeWidth="2" />
            
            {/* Quadrant Lines (at score 3.0) */}
            <line x1="200" y1="0" x2="200" y2="400" stroke={S.border} strokeDasharray="4" />
            <line x1="0" y1="200" x2="400" y2="200" stroke={S.border} strokeDasharray="4" />

            {/* Labels */}
            <text x="200" y="430" textAnchor="middle" fontSize="12" fill={S.muted} fontWeight="600">Financial Materiality (Risk/Opp)</text>
            <text x="-200" y="-30" transform="rotate(-90)" textAnchor="middle" fontSize="12" fill={S.muted} fontWeight="600">Impact Materiality (People/Env)</text>
            
            {/* Dots */}
            {materialityData.map(t => {
              const x = (t.financial_score - 1) * 100;
              const y = 400 - (t.impact_score - 1) * 100;
              return (
                <g key={t.esrs_code} style={{ transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }} onMouseEnter={() => setHovered(t)} onMouseLeave={() => setHovered(null)}>
                  <circle cx={x} cy={y} r={hovered?.esrs_code === t.esrs_code ? "10" : "7"} fill={t.is_material ? S.green : S.muted} stroke="white" strokeWidth="2" style={{ cursor: 'pointer', transition: 'r 0.2s ease' }} />
                  {(hovered?.esrs_code === t.esrs_code || t.is_material) && (
                    <text x={x + 12} y={y + 4} fontSize="10" fontWeight="700" fill={S.text}>{t.esrs_code}</text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <div style={{ marginTop: '24px', padding: '16px', background: S.bg, borderRadius: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: S.text, marginBottom: '4px' }}>AI Strategic Advisory</div>
          <div style={{ fontSize: '12px', color: S.muted, lineHeight: '1.5' }}>
            {materialityData.filter(t => t.is_material).length > 0 
              ? `You have identified ${materialityData.filter(t => t.is_material).length} material topics. These will be prioritized in your CSRD report disclosures according to ESRS 1 General Requirements.`
              : "Use the sliders to evaluate the double materiality of ESRS topics."}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AUDIT TRAIL VIEW ──
function AuditTrailView({ selectedClientId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      setLoading(true);
      try {
        const result = await invoke('get_audit_logs', { client_id: selectedClientId });
        setLogs(JSON.parse(result));
      } catch (err) {
        console.error('Failed to fetch audit logs:', err);
      } finally {
        setLoading(false);
      }
    };
    loadLogs();
  }, [selectedClientId]);

  const getBadgeStyle = (action) => {
    const a = action.toLowerCase();
    if (a.includes('import')) return { color: S.accent, bg: S.accent + '15', label: 'IMPORT' };
    if (a.includes('report')) return { color: S.green, bg: S.green + '15', label: 'REPORT' };
    return { color: S.muted, bg: '#f3f4f6', label: 'SYSTEM' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.3s ease', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: S.text }}>Certified Audit Trail</h2>
          <p style={{ fontSize: '12px', color: S.muted }}>Immutable ledger of all regulatory actions and data modifications.</p>
        </div>
        <button className="action-btn" style={{ background: S.panel, border: `1px solid ${S.border}`, padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', color: S.text, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Download size={14} /> Export to CSV
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: '14px', border: `1px solid ${S.border}`, boxShadow: S.shadow, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
              <tr style={{ background: '#111827', color: 'white' }}>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: '600', width: '22%', letterSpacing: '0.05em' }}>TIMESTAMP (UTC)</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: '600', width: '15%', letterSpacing: '0.05em' }}>ACTION</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: '600', width: '12%', letterSpacing: '0.05em' }}>ACTOR</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: '600', width: '51%', letterSpacing: '0.05em' }}>DETAILS</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: '12px' }}>
              {loading ? (
                <tr>
                  <td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: S.muted }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <Loader2 size={24} className="spin" style={{ animation: 'rotate 1s linear infinite' }} />
                      Verifying ledger integrity...
                    </div>
                  </td>
                </tr>
              ) : logs.length > 0 ? logs.map((log, i) => {
                const badge = getBadgeStyle(log.action);
                return (
                  <tr key={log.id} className="row-hover" style={{ borderBottom: i < logs.length - 1 ? '1px solid #f3f4f6' : 'none', transition: 'background 0.15s' }}>
                    <td style={{ padding: '14px 20px', fontFamily: 'monospace', color: S.muted, fontSize: '11px' }}>
                      {log.timestamp.replace('T', ' ').replace('Z', '')}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ fontSize: '10px', fontWeight: '800', color: badge.color, background: badge.bg, padding: '3px 8px', borderRadius: '4px' }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', fontWeight: '600', color: S.text }}>
                      {log.action.includes('Report') ? 'User' : 'AI Engine'}
                    </td>
                    <td style={{ padding: '14px 20px', color: '#374151', fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.4' }}>
                      {log.details}
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: S.muted }}>No audit events recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ padding: '12px 16px', background: 'rgba(52,199,89,0.05)', border: `1px solid ${S.green}20`, borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <CheckCircle size={14} color={S.green} />
        <span style={{ fontSize: '11px', color: '#166534', fontWeight: '600' }}>Ledger Verified: All events are hashed and cryptographically linked to the SSOT.</span>
      </div>
    </div>
  );
}

// ── DASHBOARD ──
function DashboardView({ client, dashboardStats, co2Trend, esrsCompliance }) {
const kpis = [
  { label: 'ESG Score', value: dashboardStats?.esg_score ?? 0, trend: '', up: true, risk: 'Medium', next: 'Add ESRS data', color: '#007aff', unit: '' },
  { label: 'Carbon tCO2e', value: dashboardStats?.carbon_footprint ?? 0, trend: '', up: false, risk: 'High', next: 'Upload metrics', color: '#ff3b30', unit: 't' },
  { label: 'Energy MWh', value: dashboardStats?.energy_mwh ?? 0, trend: '', up: true, risk: 'Low', next: 'Audit utilities', color: '#34c759', unit: '' },
  { label: 'Workforce', value: dashboardStats?.workforce ?? 0, trend: '', up: null, risk: 'Low', next: 'Import HR data', color: '#ff9500', unit: '' }
];

return (
<div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.3s ease' }}>

  {/* KPI CARDS */}
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px' }}>
    {kpis.map((k, i) => (
      <KPICard key={i} k={k} />
    ))}
  </div>

  {/* CHARTS ROW */}
  <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '16px' }}>
    <CO2Chart co2Trend={co2Trend} />
    <ScopeDonut dashboardStats={dashboardStats} />
  </div>

  {/* BOTTOM ROW */}
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
    <AuditReadiness esrsCompliance={esrsCompliance} />
    <NextActions esrsCompliance={esrsCompliance} />
  </div>

  {/* ESRS TABLE */}
  <ESRSComplianceTable esrsCompliance={esrsCompliance} />
</div>

);
}

function KPICard({ k }) {
const [hov, setHov] = useState(false);
const displayValue = typeof k.value === 'number' ? k.value.toFixed(1) : k.value;

return (
<div className="kpi-card" onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
style={{ background: hov ? k.color + '0a' : '#fff', borderRadius: '14px', padding: '20px', border: hov ? `1px solid ${k.color}30` : '1px solid #e5e7eb', boxShadow: hov ? `0 8px 24px ${k.color}18` : '0 1px 3px rgba(0,0,0,0.06)', transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)', cursor: 'default', position: 'relative', overflow: 'hidden' }}>
<div style={{ fontSize: '10px', fontWeight: '600', color: hov ? k.color : '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px', transition: 'color 0.2s' }}>{k.label}</div>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
<div style={{ fontSize: '36px', fontWeight: '700', color: hov ? k.color : '#111827', letterSpacing: '-2px', lineHeight: 1, transition: 'color 0.25s' }}>{displayValue}<span style={{ fontSize: '14px', fontWeight: '500' }}>{k.unit}</span></div>
<span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 7px', borderRadius: '20px', color: k.up === true ? '#34c759' : k.up === false ? '#ff3b30' : '#9ca3af', background: k.up === true ? 'rgba(52,199,89,0.1)' : k.up === false ? 'rgba(255,59,48,0.1)' : 'rgba(156,163,175,0.1)' }}>{k.trend || '0%'}</span>
</div>
<div style={{ fontSize: '10px', color: hov ? k.color + 'aa' : '#9ca3af', transition: 'all 0.2s' }}>
{hov ? `→ ${k.next}` : `Risk: ${k.risk}`}
</div>
</div>
);
}

function CO2Chart({ co2Trend }) {
  const maxVal = Math.max(...(co2Trend || []).map(d => d.value), 10);
  const pts = co2Trend && co2Trend.length > 0 
    ? co2Trend.map((d, i) => ({
        x: 20 + i * (360 / (co2Trend.length - 1 || 1)),
        y: 120 - (d.value / maxVal) * 100,
        l: d.period || '',
        v: d.value.toFixed(1) + 't'
      }))
    : [
        {x:20,y:100,l:'Jan',v:'0t'},{x:90,y:72,l:'Feb',v:'0t'},
        {x:160,y:85,l:'Mar',v:'0t'},{x:230,y:55,l:'Apr',v:'0t'},
        {x:300,y:38,l:'May',v:'0t'},{x:370,y:22,l:'Jun',v:'0t'}
      ];
  
  const [hov, setHov] = useState(null);
  
  // Create smooth path
  const pathD = pts.length > 1 
    ? `M${pts.map(p => `${p.x},${p.y}`).join(' L')}`
    : `M${pts[0].x},${pts[0].y} L${pts[0].x + 1},${pts[0].y}`;
    
  const areaD = `${pathD} L${pts[pts.length-1].x},130 L${pts[0].x},130 Z`;

  return (
    <div style={{ background: '#fff', borderRadius: '14px', padding: '22px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', animation: 'fadeIn 0.4s ease' }}>
      <div style={{ fontSize: '13px', fontWeight: '600', color: '#111827', marginBottom: '2px' }}>CO₂ Emission Trend</div>
      <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '16px' }}>{co2Trend.length > 0 ? 'Aggregated Monthly Data' : 'No Historical Data'} · tCO2e</div>
      <svg width="100%" height="140" viewBox="0 0 400 150" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#007aff" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#007aff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#g1)" style={{ transition: 'd 0.3s' }} />
        <path d={pathD} fill="none" stroke="#007aff" strokeWidth="2.5" strokeLinecap="round"
          style={{ strokeDasharray: 1000, strokeDashoffset: 1000, animation: 'drawLine 2s ease-out forwards' }} />
        {pts.map((p, i) => (
          <g key={i} style={{ cursor: 'pointer' }} onMouseEnter={() => setHov(p)} onMouseLeave={() => setHov(null)}>
            <circle cx={p.x} cy={p.y} r="14" fill="transparent" />
            <circle cx={p.x} cy={p.y} r={hov === p ? 6 : 4} fill="#007aff" stroke="#fff" strokeWidth="2" style={{ transition: 'all 0.2s' }} />
            <text x={p.x} y="148" textAnchor="middle" fontSize="9" fontWeight="600" fill="#9ca3af" fontFamily="-apple-system,sans-serif">
              {p.l.split('-').pop()}
            </text>
          </g>
        ))}
        {hov && (
          <g style={{ animation: 'fadeIn 0.15s ease' }}>
            <rect x={hov.x - 40} y={hov.y - 44} width="80" height="34" rx="8" fill="#111827" />
            <text x={hov.x} y={hov.y - 24} textAnchor="middle" fontSize="12" fontWeight="700" fill="white" fontFamily="-apple-system,sans-serif">{hov.v}</text>
            <text x={hov.x} y={hov.y - 14} textAnchor="middle" fontSize="8" fill="#9ca3af" fontFamily="-apple-system,sans-serif">{hov.l}</text>
          </g>
        )}
      </svg>
    </div>
  );
}

function ScopeDonut({ dashboardStats }) {
const total = (dashboardStats?.scope1 ?? 0) + (dashboardStats?.scope2 ?? 0) + (dashboardStats?.scope3 ?? 0);
const scopes = [
  { label: 'Scope 1', val: total > 0 ? Math.round((dashboardStats?.scope1 ?? 0) / total * 100) : 33, color: '#007aff', desc: `Direct: ${(dashboardStats?.scope1 ?? 0).toFixed(1)}t` },
  { label: 'Scope 2', val: total > 0 ? Math.round((dashboardStats?.scope2 ?? 0) / total * 100) : 33, color: '#34c759', desc: `Energy: ${(dashboardStats?.scope2 ?? 0).toFixed(1)}t` },
  { label: 'Scope 3', val: total > 0 ? Math.round((dashboardStats?.scope3 ?? 0) / total * 100) : 34, color: '#af52de', desc: `Chain: ${(dashboardStats?.scope3 ?? 0).toFixed(1)}t` },
];
const totalLabel = total > 0 ? `${total.toFixed(1)}t` : '0t';

const [hov, setHov] = useState(null);
const r = 52, cx = 100, cy = 75, circ = 2 * Math.PI * r;
let offset = 0;
const arcs = scopes.map(s => {
const len = (s.val / 100) * circ;
const arc = { ...s, dasharray: circ, dashoffset: circ - len, rotate: (offset / circ) * 360 - 90 };
offset += len;
return arc;
});

return (
<div style={{ background: '#fff', borderRadius: '14px', padding: '22px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
<div style={{ fontSize: '13px', fontWeight: '600', color: '#111827', marginBottom: '2px' }}>Scope Distribution</div>
<div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '8px' }}>Total: {totalLabel} tCO2e</div>
<svg width="100%" height="158" viewBox="0 0 200 158">
<circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth="20" />
{arcs.map((a, i) => (
<circle key={i} cx={cx} cy={cy} r={r} fill="none"
stroke={a.color} strokeWidth={hov === i ? 25 : 20}
strokeDasharray={a.dasharray} strokeDashoffset={a.dashoffset}
strokeLinecap="butt" transform={`rotate(${a.rotate} ${cx} ${cy})`}
style={{ transition: 'stroke-width 0.2s, opacity 0.2s', opacity: hov !== null && hov !== i ? 0.35 : 1, cursor: 'pointer' }}
onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)} />
))}
<text x={cx} y={cy - 6} textAnchor="middle" fontSize="18" fontWeight="700" fill="#111827" fontFamily="-apple-system,sans-serif">
{hov !== null ? scopes[hov].val + '%' : totalLabel}
</text>
<text x={cx} y={cy + 10} textAnchor="middle" fontSize="10" fill="#9ca3af" fontFamily="-apple-system,sans-serif">
{hov !== null ? scopes[hov].desc : 'tCO2e'}
</text>
</svg>
<div style={{ display: 'flex', justifyContent: 'space-around' }}>
{scopes.map((s, i) => (
<div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', opacity: hov !== null && hov !== i ? 0.35 : 1, transition: 'opacity 0.2s' }}
onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
<div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color }} />
<span style={{ fontSize: '11px', color: '#6b7280', fontWeight: '500' }}>{s.label}</span>
</div>
))}
</div>
</div>
);
}

function AuditReadiness({ esrsCompliance = [] }) {
  const total = esrsCompliance.length || 1;
  const complete = esrsCompliance.filter(i => i.status === 'Complete').length;
  const partial = esrsCompliance.filter(i => i.status === 'Partial').length;
  const percentage = Math.round(((complete + (0.5 * partial)) / total) * 100);
  
  const circ = 201; // 2 * PI * 32
  const offset = circ - (percentage / 100) * circ;

  const topGaps = esrsCompliance
    .filter(i => i.status !== 'Complete')
    .slice(0, 3);

  return (
    <div style={{ background: '#fff', borderRadius: '14px', padding: '22px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: '13px', fontWeight: '600', color: '#111827', marginBottom: '18px' }}>Audit Readiness</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="32" stroke="#f3f4f6" strokeWidth="7" fill="none" />
          <circle cx="40" cy="40" r="32" stroke="#34c759" strokeWidth="7" fill="none"
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 40 40)" 
            style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
          <text x="40" y="44" textAnchor="middle" fill="#111827" fontSize="14" fontWeight="700" fontFamily="-apple-system,sans-serif">{percentage}%</text>
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {topGaps.length > 0 ? topGaps.map(g => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: g.status === 'Partial' ? '#ff9500' : '#ff3b30', fontWeight: '500' }}>
              {g.status === 'Partial' ? <AlertTriangle size={14} /> : <XCircle size={14} />}
              {g.id} {g.status}
            </div>
          )) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: S.green, fontWeight: '600' }}>
              <CheckCircle size={14} /> All standards mapped
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NextActions({ esrsCompliance = [] }) {
  const actions = esrsCompliance
    .filter(i => i.status !== 'Complete')
    .map(i => ({
      text: i.status === 'Missing' ? `Collect data for ${i.id} ${i.name}` : `Complete disclosures for ${i.id}`,
      p: i.status === 'Missing' ? 'High' : 'Medium',
      c: i.status === 'Missing' ? '#ff3b30' : '#ff9500',
      b: i.status === 'Missing' ? 'rgba(255,59,48,0.08)' : 'rgba(255,149,0,0.08)'
    }))
    .slice(0, 4);

  return (
    <div style={{ background: '#fff', borderRadius: '14px', padding: '22px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: '13px', fontWeight: '600', color: '#111827', marginBottom: '14px' }}>Next Actions</div>
      {actions.length > 0 ? actions.map((a, i) => (
        <div key={i} className="row-hover" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: i < actions.length - 1 ? '1px solid #f3f4f6' : 'none', transition: 'background 0.15s' }}>
          <span style={{ fontSize: '12px', color: '#374151' }}>{a.text}</span>
          <span style={{ fontSize: '10px', fontWeight: '700', color: a.c, background: a.b, padding: '2px 8px', borderRadius: '20px', whiteSpace: 'nowrap', marginLeft: '8px' }}>{a.p}</span>
        </div>
      )) : (
        <div style={{ fontSize: '12px', color: S.muted, padding: '10px 0' }}>No pending actions. You are audit ready!</div>
      )}
    </div>
  );
}

function ESRSComplianceTable({ esrsCompliance }) {
  const rows = esrsCompliance && esrsCompliance.length > 0 ? esrsCompliance.map(r => ({
    id: r.id,
    name: r.name,
    status: r.status,
    sc: r.status === 'Complete' ? '#34c759' : r.status === 'Partial' ? '#ff9500' : '#ff3b30',
    sb: r.status === 'Complete' ? 'rgba(52,199,89,0.08)' : r.status === 'Partial' ? 'rgba(255,149,0,0.08)' : 'rgba(255,59,48,0.08)'
  })) : [
    {id:'E1',name:'Climate Change',status:'Missing',sc:'#ff3b30',sb:'rgba(255,59,48,0.08)'},
    {id:'E2',name:'Pollution',status:'Missing',sc:'#ff3b30',sb:'rgba(255,59,48,0.08)'},
    {id:'E3',name:'Water & Marine',status:'Missing',sc:'#ff3b30',sb:'rgba(255,59,48,0.08)'},
    {id:'S1',name:'Own Workforce',status:'Missing',sc:'#ff3b30',sb:'rgba(255,59,48,0.08)'},
    {id:'G1',name:'Business Conduct',status:'Missing',sc:'#ff3b30',sb:'rgba(255,59,48,0.08)'}
  ];
return (
<div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
<div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', fontSize: '13px', fontWeight: '600', color: '#111827' }}>ESRS Compliance Overview</div>
<table style={{ width: '100%', borderCollapse: 'collapse' }}>
<tbody>
{rows.map((r, i) => (
<tr key={r.id} className="row-hover" style={{ borderBottom: i < rows.length - 1 ? '1px solid #f3f4f6' : 'none', transition: 'background 0.15s' }}>
<td style={{ padding: '11px 20px', width: '48px', fontSize: '12px', fontWeight: '700', color: '#6b7280' }}>{r.id}</td>
<td style={{ padding: '11px 20px', fontSize: '13px', color: '#111827' }}>{r.name}</td>
<td style={{ padding: '11px 20px', textAlign: 'right' }}>
<span style={{ fontSize: '11px', fontWeight: '600', color: r.sc, background: r.sb, padding: '3px 10px', borderRadius: '20px' }}>{r.status}</span>
</td>
</tr>
))}
</tbody>
</table>
</div>
);
}

// ── GAP ANALYSIS VIEW ──
function GapAnalysisView({ isAnalyzing, analysisProgress, currentTopic, analysisResults, companySize, setCompanySize, sector, setSector, runGapAnalysis, cancelGapAnalysis }) {
const badgeStyle = (status) => ({
fontSize: '11px',
fontWeight: '700',
padding: '3px 10px',
borderRadius: '20px',
textTransform: 'capitalize',
color: status === 'green' ? S.green : status === 'yellow' ? S.amber : S.red,
background: (status === 'green' ? S.green : status === 'yellow' ? S.amber : S.red) + '15'
});

return (
<div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.3s ease' }}>
<div style={{ background: '#fff', borderRadius: '16px', padding: '24px', border: `1px solid ${S.border}`, boxShadow: S.shadow }}>
<div style={{ fontSize: '18px', fontWeight: '700', color: S.text, marginBottom: '20px' }}>CSRD Gap Analysis Configuration</div>
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 200px', gap: '16px', alignItems: 'flex-end' }}>
<div>
<label style={{ fontSize: '12px', fontWeight: '600', color: S.muted, display: 'block', marginBottom: '8px' }}>Company Size</label>
<select value={companySize} onChange={e => setCompanySize(e.target.value)} disabled={isAnalyzing} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: `1px solid ${S.border}`, background: S.bg, fontSize: '14px', cursor: isAnalyzing ? 'not-allowed' : 'pointer', outline: 'none' }}>
{['small', 'medium', 'large'].map(s => <option key={s} value={s}>{s}</option>)}
</select>
</div>
<div>
<label style={{ fontSize: '12px', fontWeight: '600', color: S.muted, display: 'block', marginBottom: '8px' }}>Industry Sector</label>
<select value={sector} onChange={e => setSector(e.target.value)} disabled={isAnalyzing} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: `1px solid ${S.border}`, background: S.bg, fontSize: '14px', cursor: isAnalyzing ? 'not-allowed' : 'pointer', outline: 'none' }}>
{['automotive', 'chemicals', 'electronics', 'food & beverage', 'machinery', 'textiles', 'finance', 'manufacturing'].map(s => <option key={s} value={s}>{s}</option>)}
</select>
</div>
{!isAnalyzing ? (
<button className="action-btn" onClick={runGapAnalysis} style={{ height: '42px', background: S.accent, color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
<Play size={16} /> Run Gap Analysis
</button>
) : (
<button className="action-btn" onClick={cancelGapAnalysis} style={{ height: '42px', background: S.red, color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
<StopCircle size={16} /> Cancel
</button>
)}
</div>
</div>

{isAnalyzing && (
<div style={{ background: '#fff', borderRadius: '16px', padding: '24px', border: `1px solid ${S.border}`, boxShadow: S.shadow }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
<div style={{ fontSize: '14px', fontWeight: '700', color: S.text }}>Processing ESRS Standards...</div>
<div style={{ fontSize: '14px', fontWeight: '700', color: S.accent }}>{Math.round(analysisProgress)}%</div>
</div>
<div style={{ height: '8px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden', marginBottom: '16px' }}>
<div style={{ height: '100%', width: `${analysisProgress}%`, background: S.accent, transition: 'width 0.4s cubic-bezier(0.1, 0.7, 1.0, 0.1)' }} />
</div>
<div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: S.muted }}>
<Loader2 size={16} className="spin" style={{ animation: 'rotate 1s linear infinite' }} />
<style>{`@keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
<span>Currently analyzing: <b>{currentTopic || 'Initializing...'}</b></span>
</div>
</div>
)}

{analysisResults && (
<div style={{ background: '#fff', borderRadius: '16px', border: `1px solid ${S.border}`, boxShadow: S.shadow, overflow: 'hidden', animation: 'fadeIn 0.4s ease' }}>
<div style={{ padding: '20px 24px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
<div style={{ fontSize: '16px', fontWeight: '700', color: S.text }}>Gap Analysis Results</div>
<button style={{ background: S.bg, border: `1px solid ${S.border}`, padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Download Detailed Report</button>
</div>
<table style={{ width: '100%', borderCollapse: 'collapse' }}>
<thead>
<tr style={{ background: '#f9fafb', borderBottom: `1px solid ${S.border}` }}>
<th style={{ padding: '14px 24px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: S.muted }}>ESRS TOPIC</th>
<th style={{ padding: '14px 24px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: S.muted }}>COMPLIANCE STATUS</th>
</tr>
</thead>
<tbody>
{Object.entries(analysisResults.topics).map(([topic, status], i) => (
<tr key={i} className="row-hover" style={{ borderBottom: i < Object.keys(analysisResults.topics).length - 1 ? `1px solid ${S.border}` : 'none', transition: 'background 0.15s' }}>
<td style={{ padding: '16px 24px', fontSize: '14px', color: S.text, fontWeight: '500' }}>{topic}</td>
<td style={{ padding: '16px 24px', textAlign: 'right' }}>
<span style={badgeStyle(status)}>{status}</span>
</td>
</tr>
))}
</tbody>
</table>
</div>
)}
</div>
);
}

// ── CLIENTS VIEW ──
function ClientsView() {
const [realClients, setRealClients] = useState([]);

const handleAddClient = async () => {
  const nameInput = document.getElementById('client-name');
  const industryInput = document.getElementById('client-industry');
  if (!nameInput?.value) return;
  try {
    await invoke('create_client', {
      name: nameInput.value,
      industry: industryInput?.value || 'Other',
      country: 'DE'
    });
    nameInput.value = '';
    window.location.reload();
  } catch (err) {
    console.error('Failed to add client:', err);
  }
};

useEffect(() => {
  const loadClients = async () => {
    try {
      const list = await invoke('get_enterprise_clients');
      if (list?.length) setRealClients(list);
    } catch (err) {}
  };
  loadClients();
}, []);

const displayClients = realClients.length > 0 ? realClients.map(c => ({
  n: c.name,
  i: c.industry,
  s: c.score || 0,
  st: c.score >= 75 ? 'Audit Ready' : (c.score > 0 ? 'In Progress' : 'Action Required'),
  sc: c.score >= 75 ? S.green : (c.score > 0 ? S.amber : S.red)
})) : [
  { n: 'Hans GmbH Demo', i: 'Automotive', s: 0, st: 'Action Required', sc: '#ff3b30' },
  { n: 'Müller & Co', i: 'Chemicals', s: 0, st: 'Action Required', sc: '#ff3b30' },
  { n: 'Schweizer AG', i: 'Electronics', s: 0, st: 'Action Required', sc: '#ff3b30' }
];

return (
<div style={{ display: 'flex', flexDirection: 'column', gap: '18px', animation: 'fadeIn 0.3s ease' }}>
<div style={{ background: '#fff', borderRadius: '14px', padding: '22px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
<div style={{ fontSize: '13px', fontWeight: '600', color: '#111827', marginBottom: '14px' }}>Register New Client</div>
<div style={{ display: 'flex', gap: '10px' }}>
<input id="client-name" placeholder="Company name" style={{ flex: 1, padding: '9px 13px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', background: '#f5f5f7', outline: 'none' }} />
<select id="client-industry" style={{ flex: 1, padding: '9px 13px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', background: '#f5f5f7', outline: 'none' }}>
{['Automotive', 'Chemicals', 'Electronics', 'Food & Beverage', 'Machinery'].map(i => <option key={i}>{i}</option>)}
</select>
<button className="action-btn" onClick={handleAddClient} style={{ background: '#007aff', color: 'white', border: 'none', padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s' }}>Add Client</button>
</div>
</div>
<div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
<table style={{ width: '100%', borderCollapse: 'collapse' }}>
<thead>
<tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
{['CLIENT', 'INDUSTRY', 'ESG SCORE', 'STATUS', 'ACTION'].map((h, i) => (
<th key={h} style={{ padding: '11px 20px', textAlign: i === 4 ? 'right' : 'left', fontSize: '11px', fontWeight: '600', color: '#6b7280' }}>{h}</th>
))}
</tr>
</thead>
<tbody>
{displayClients.map((c, idx) => (
<tr key={idx} className="row-hover" style={{ borderBottom: '1px solid #f3f4f6', transition: 'background 0.15s' }}>
<td style={{ padding: '13px 20px', fontSize: '13px', fontWeight: '600', color: '#111827' }}>{c.n}</td>
<td style={{ padding: '13px 20px', fontSize: '13px', color: '#6b7280' }}>{c.i}</td>
<td style={{ padding: '13px 20px', fontSize: '13px', fontWeight: '600', color: c.s >= 75 ? '#34c759' : c.s >= 60 ? '#ff9500' : '#ff3b30' }}>{c.s}</td>
<td style={{ padding: '13px 20px' }}><span style={{ fontSize: '11px', fontWeight: '600', color: c.sc, background: c.sc + '15', padding: '3px 9px', borderRadius: '20px' }}>{c.st}</span></td>
<td style={{ padding: '13px 20px', textAlign: 'right' }}><button style={{ background: 'none', border: 'none', color: '#007aff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>View →</button></td>
</tr>
))}
</tbody>
</table>
</div>
</div>
);
}

// ── DATA VIEW ──
function DataView({ isProcessing, processedSummary, handleFileUpload, handleBrowseFiles }) {
const [isHov, setIsHov] = useState(false);
return (
<div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.3s ease' }}>
<div style={{ background: '#fff', borderRadius: '16px', padding: '48px', border: `2px dashed ${isHov ? S.accent : S.border}`, textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative', overflow: 'hidden' }}
onMouseEnter={() => setIsHov(true)}
onMouseLeave={() => setIsHov(false)}
onClick={() => !isProcessing && handleBrowseFiles()}>
{isProcessing && (
<div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.8)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
<Loader2 size={32} className="spin" color={S.accent} style={{ animation: 'rotate 1s linear infinite' }} />
<div style={{ fontSize: '14px', fontWeight: '700', color: S.text }}>Processing ESG Data Stream...</div>
</div>
)}
<UploadCloud size={48} color={isHov ? S.accent : S.muted} strokeWidth={1.2} style={{ marginBottom: '16px' }} />
<div style={{ fontSize: '16px', fontWeight: '700', color: S.text, marginBottom: '6px' }}>{isProcessing ? 'Processing...' : 'Ingest Corporate ESG Data'}</div>
<div style={{ fontSize: '14px', color: S.muted, marginBottom: '24px' }}>Secure local ingestion of ERP exports, Excel, CSV, or XML files.</div>
<button className="action-btn" onClick={(e) => { e.stopPropagation(); handleBrowseFiles(); }} style={{ background: S.accent, color: 'white', border: 'none', padding: '10px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s' }}>Select ERP File</button>
</div>

{processedSummary && (
<div style={{ background: '#fff', borderRadius: '16px', border: `1px solid ${S.border}`, boxShadow: S.shadow, overflow: 'hidden', animation: 'fadeIn 0.4s ease' }}>
<div style={{ padding: '16px 20px', borderBottom: `1px solid ${S.border}`, background: '#f0fdf4', display: 'flex', alignItems: 'center', gap: '10px' }}>
<CheckCircle size={18} color={S.green} />
<div style={{ fontSize: '14px', fontWeight: '700', color: '#166534' }}>Ingestion Complete: {processedSummary.filename}</div>
</div>
<div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
<div>
<div style={{ fontSize: '11px', fontWeight: '600', color: S.muted, textTransform: 'uppercase', marginBottom: '4px' }}>Records Found</div>
<div style={{ fontSize: '20px', fontWeight: '700', color: S.text }}>{processedSummary.row_count}</div>
</div>
<div>
<div style={{ fontSize: '11px', fontWeight: '600', color: S.muted, textTransform: 'uppercase', marginBottom: '4px' }}>Detected Scope</div>
<div style={{ fontSize: '20px', fontWeight: '700', color: S.accent }}>{processedSummary.detected_scope}</div>
</div>
<div>
<div style={{ fontSize: '11px', fontWeight: '600', color: S.muted, textTransform: 'uppercase', marginBottom: '4px' }}>Compliance Status</div>
<div style={{ fontSize: '20px', fontWeight: '700', color: S.green }}>Verified</div>
</div>
</div>
</div>
)}

<div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
<div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', fontSize: '13px', fontWeight: '600', color: '#111827' }}>Recent Imports</div>
{[
{ n: 'oracle_dump_2025.xml', s: '12.4 MB', t: 'Verified', r: ['SAP data recognized', 'Emissions mapped to ESRS E1'] },
{ n: 'sap_export_q1.xlsx', s: '2.4 MB', t: 'Verified', r: ['847 records processed'] },
{ n: 'employees_2024.csv', s: '0.8 MB', t: 'Verified', r: ['Workforce data mapped to ESRS S1'] }
].map((f, i) => (
<div key={i} className="row-hover" style={{ padding: '13px 20px', borderBottom: i < 2 ? '1px solid #f3f4f6' : 'none', transition: 'background 0.15s' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
<div>
<div style={{ fontSize: '13px', fontWeight: '500', color: '#111827', marginBottom: '4px' }}>{f.n} <span style={{ fontSize: '11px', color: '#9ca3af' }}>{f.s}</span></div>
{f.r.map((r, j) => <div key={j} style={{ fontSize: '11px', color: '#34c759', fontWeight: '500' }}>✔ {r}</div>)}
</div>
<span style={{ fontSize: '11px', fontWeight: '600', color: '#34c759', background: 'rgba(52,199,89,0.08)', padding: '3px 10px', borderRadius: '20px' }}>{f.t}</span>
</div>
</div>
))}
</div>
</div>
);
}

// ── EMISSIONS VIEW ──
function EmissionsView({ ledgerData = [] }) {
  const [filter, setFilter] = useState('');
  
  const filteredData = ledgerData.filter(d => 
    d.category?.toLowerCase().includes(filter.toLowerCase()) || 
    d.origin_file?.toLowerCase().includes(filter.toLowerCase()) ||
    d.source?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: S.text }}>ESG Data Ledger</h2>
          <p style={{ fontSize: '12px', color: S.muted }}>Full audit trail of all imported and normalized ESG metrics.</p>
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: S.muted }} />
          <input 
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter by category or file..." 
            style={{ padding: '8px 12px 8px 34px', borderRadius: '8px', border: `1px solid ${S.border}`, background: S.panel, fontSize: '12px', width: '260px', outline: 'none' }} 
          />
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6b7280', width: '20%' }}>SOURCE FILE</th>
              <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6b7280', width: '15%' }}>CATEGORY</th>
              <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6b7280', width: '25%' }}>ORIGINAL (RAW)</th>
              <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6b7280', width: '25%' }}>NORMALIZED (SSOT)</th>
              <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: '11px', fontWeight: '600', color: '#6b7280', width: '15%' }}>CONFIDENCE</th>
            </tr>
          </thead>
          <tbody style={{ fontSize: '12px' }}>
            {filteredData.length > 0 ? filteredData.map((d, i) => (
              <tr key={i} className="row-hover" style={{ borderBottom: i < filteredData.length - 1 ? '1px solid #f3f4f6' : 'none', transition: 'background 0.15s' }}>
                <td style={{ padding: '12px 20px', color: S.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.origin_file}>{d.origin_file}</td>
                <td style={{ padding: '12px 20px' }}>
                  <span style={{ fontWeight: '600', color: S.text, textTransform: 'capitalize' }}>{d.category.replace('_', ' ')}</span>
                </td>
                <td style={{ padding: '12px 20px' }}>
                  <div style={{ fontSize: '11px', color: S.muted, marginBottom: '2px' }}>{d.source}</div>
                  <div style={{ fontFamily: 'monospace', fontWeight: '600' }}>{d.value.toLocaleString()} <span style={{ fontSize: '10px', fontWeight: '400' }}>{d.unit}</span></div>
                </td>
                <td style={{ padding: '12px 20px' }}>
                  {d.normalized_value ? (
                    <div style={{ fontFamily: 'monospace', fontWeight: '700', color: S.accent }}>
                      {d.normalized_value.toLocaleString()} <span style={{ fontSize: '10px', fontWeight: '400' }}>{d.normalized_unit}</span>
                    </div>
                  ) : <span style={{ color: S.muted }}>—</span>}
                </td>
                <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: '700', 
                    color: d.confidence > 0.9 ? S.green : d.confidence > 0.7 ? S.amber : S.red,
                    background: (d.confidence > 0.9 ? S.green : d.confidence > 0.7 ? S.amber : S.red) + '10',
                    padding: '3px 8px',
                    borderRadius: '6px'
                  }}>
                    {Math.round(d.confidence * 100)}%
                  </span>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: S.muted }}>No data records found for this client.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── ESRS VIEW ──
function ESRSView() {
return (
<div style={{ display: 'flex', flexDirection: 'column', gap: '18px', animation: 'fadeIn 0.3s ease' }}>
<div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
<div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', fontSize: '13px', fontWeight: '600', color: '#111827' }}>ESRS Compliance Tracker</div>
<table style={{ width: '100%', borderCollapse: 'collapse' }}>
<thead>
<tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
{['STANDARD', 'TOPIC', 'STATUS', 'GAP'].map(h => (
<th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6b7280' }}>{h}</th>
))}
</tr>
</thead>
<tbody>
{[
{ id: 'E1', t: 'Climate Change', s: 'Missing', g: true, sc: '#ff3b30', sb: 'rgba(255,59,48,0.08)' },
{ id: 'E2', t: 'Pollution', s: 'Missing', g: true, sc: '#ff3b30', sb: 'rgba(255,59,48,0.08)' },
{ id: 'E3', t: 'Water & Marine', s: 'Missing', g: true, sc: '#ff3b30', sb: 'rgba(255,59,48,0.08)' },
{ id: 'E4', t: 'Biodiversity', s: 'Missing', g: true, sc: '#ff3b30', sb: 'rgba(255,59,48,0.08)' },
{ id: 'S1', t: 'Own Workforce', s: 'Missing', g: true, sc: '#ff3b30', sb: 'rgba(255,59,48,0.08)' },
{ id: 'S2', t: 'Workers in Value Chain', s: 'Missing', g: true, sc: '#ff3b30', sb: 'rgba(255,59,48,0.08)' },
{ id: 'G1', t: 'Business Conduct', s: 'Missing', g: true, sc: '#ff3b30', sb: 'rgba(255,59,48,0.08)' }
].map((r, i) => (
<tr key={i} className="row-hover" style={{ borderBottom: '1px solid #f3f4f6', transition: 'background 0.15s' }}>
<td style={{ padding: '12px 20px', fontSize: '13px', fontWeight: '700', color: '#111827' }}>{r.id}</td>
<td style={{ padding: '12px 20px', fontSize: '13px', color: '#111827' }}>{r.t}</td>
<td style={{ padding: '12px 20px' }}><span style={{ fontSize: '11px', fontWeight: '600', color: r.sc, background: r.sb, padding: '3px 10px', borderRadius: '20px' }}>{r.s}</span></td>
<td style={{ padding: '12px 20px', fontSize: '13px', fontWeight: '600', color: r.g ? '#ff3b30' : '#34c759' }}>{r.g ? '⚠ Yes' : '✓ No'}</td>
</tr>
))}
</tbody>
</table>
</div>
</div>
);
}

// ── REPORTS VIEW ──
function ReportsView({ activeClient }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastReportPath, setLastReportPath] = useState(null);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    setLastReportPath(null);
    try {
      const filePath = await invoke('generate_report', {
        clientId: activeClient.id,
        companyName: activeClient.name,
        language: 'English'
      });
      setLastReportPath(filePath);
    } catch (err) {
      alert('Report generation failed: ' + err);
    } finally {
      setIsGenerating(false);
    }
  };

  const reports = [
    { id: 'csrd', title: 'CSRD Draft Report', desc: 'Full ESRS disclosure · Audit-ready · Branded', icon: FileText, ready: true },
    { id: 'exec', title: 'Management Summary', desc: 'Executive overview · PDF · Signed', icon: BarChart2, ready: true },
    { id: 'gap', title: 'Gap Analysis Report', desc: 'Compliance gap details · Action plan', icon: Search, ready: false }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.3s ease' }}>
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: '700', color: S.text }}>Reporting Engine</h2>
        <p style={{ fontSize: '12px', color: S.muted }}>Generate regulatory-grade disclosures directly from SSOT data.</p>
      </div>

      {lastReportPath && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '14px 18px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ background: S.green, color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={12} strokeWidth={3} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#166534' }}>Report Generated Successfully</div>
            <div style={{ fontSize: '11px', color: '#166534', opacity: 0.8 }}>Saved to: <span style={{ fontFamily: 'monospace' }}>{lastReportPath}</span></div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px' }}>
        {reports.map(r => (
          <div key={r.id} style={{ background: '#fff', borderRadius: '14px', padding: '24px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', transition: 'all 0.2s ease', opacity: r.ready ? 1 : 0.6 }}>
            <div style={{ width: '44px', height: '44px', background: r.ready ? S.accentBg : '#f3f4f6', color: r.ready ? S.accent : S.muted, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <r.icon size={22} />
            </div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#111827', marginBottom: '6px' }}>{r.title}</div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '20px', lineHeight: '1.5' }}>{r.desc}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: r.ready ? S.green : S.amber, background: (r.ready ? S.green : S.amber) + '10', padding: '3px 10px', borderRadius: '20px' }}>
                {r.ready ? 'Ready' : 'Pending'}
              </span>
              <button 
                className="action-btn" 
                onClick={r.ready ? handleGenerateReport : undefined} 
                disabled={!r.ready || isGenerating}
                style={{ background: r.ready ? S.accent : '#e5e7eb', color: r.ready ? 'white' : '#6b7280', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: r.ready && !isGenerating ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.15s' }}
              >
                {isGenerating && r.id === 'csrd' ? (
                  <>
                    <Loader2 size={14} className="spin" style={{ animation: 'rotate 1s linear infinite' }} />
                    Constructing...
                  </>
                ) : (
                  <>Generate</>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: '14px', padding: '20px 24px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: '#6b7280' }}>Document Settings:</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['English', 'Deutsch'].map(l => (
            <button key={l} style={{ padding: '6px 12px', borderRadius: '6px', border: `1px solid ${l === 'English' ? S.accent : S.border}`, background: l === 'English' ? S.accentBg : S.bg, color: l === 'English' ? S.accent : S.text, fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
        <div style={{ height: '20px', width: '1px', background: S.border }}></div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['.docx', '.pdf'].map(f => (
            <button key={f} style={{ padding: '6px 12px', borderRadius: '6px', border: `1px solid ${f === '.docx' ? S.accent : S.border}`, background: f === '.docx' ? S.accentBg : S.bg, color: f === '.docx' ? S.accent : S.text, fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>{f}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── PLACEHOLDER ──
function PlaceholderView({ tabId }) {
const item = menuItems.find(i => i.id === tabId);
const Icon = item?.icon || LayoutDashboard;
return (
<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '14px', animation: 'fadeIn 0.3s ease' }}>
<Icon size={44} color="#d1d5db" strokeWidth={1} />
<h2 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', margin: 0 }}>{item?.label}</h2>
<p style={{ fontSize: '13px', color: '#6b7280', margin: 0, textAlign: 'center', maxWidth: '280px', lineHeight: '1.5' }}>
This module is being calibrated for your workspace.
</p>
<span style={{ fontSize: '11px', color: '#9ca3af', background: '#f3f4f6', padding: '4px 12px', borderRadius: '20px' }}>Coming soon</span>
</div>
);
}
