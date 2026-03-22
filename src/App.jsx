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

useEffect(() => {
  const loadStats = async () => {
    try {
      const stats = await invoke('get_dashboard_stats');
      setDashboardStats(stats);
    } catch (err) {
      console.log('Using demo data:', err);
    }
  };
  loadStats();
  
  const loadClients = async () => {
    try {
      const clientList = await invoke('get_clients');
      if (clientList && clientList.length > 0) {
        setClients(clientList.map(c => ({
          id: c.id,
          name: c.name,
          score: 74,
          status: 'partial'
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
    fileContent: content
  });
  // result is already parsed by Tauri bridge
  setImportResults({
    recognized: result.categories_found || [],
    warnings: result.errors || [],
    records: result.imported_count || 0
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

  // Refresh dashboard stats after successful import
  const stats = await invoke('get_dashboard_stats');
  console.log("New Dashboard Stats:", stats);
  setDashboardStats(stats);

  // Automatically call analyze_imported_data after successful import
  try {
    const analysis = await invoke('analyze_imported_data');
    const parsed = JSON.parse(analysis);
    const proactiveMsg = parsed.proactive_message || 
      `Analysis complete. Found ${parsed.missing?.length || 0} compliance gaps.`;
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
  <div style={{ background: '#fff3cd', borderBottom: '1px solid #ffc107', padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <span style={{ fontSize: '12px', fontWeight: '700', color: '#856404' }}>⚠ 2 critical compliance risks detected</span>
      <span style={{ fontSize: '12px', color: '#856404' }}>Potential fine: <b>€2.4M</b></span>
      <span style={{ fontSize: '12px', color: '#856404' }}>Deadline: <b>298 days</b></span>
    </div>
    <button className="action-btn" onClick={() => {}} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '5px 14px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.15s' }}>
      Fix All Compliance Gaps
    </button>
  </div>

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
          <div style={{ marginTop: '8px', padding: '10px', borderRadius: '8px', background: isProcessing ? S.bg : '#f0fdf4', border: `1px solid ${isProcessing ? S.border : '#bbf7d0'}` }}>
            {isProcessing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', color: S.muted }}>
                <Loader2 size={12} className="spin" style={{ animation: 'rotate 1s linear infinite' }} />
                <span>Processing ERP file...</span>
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
            { label: '📄 Generate CSRD Report', action: 'Generate the full CSRD compliance report for Hans GmbH' },
            { label: '🔍 Run Gap Analysis', action: 'Run a complete ESRS gap analysis' },
            { label: '📦 Request Supplier Data', action: 'Generate Scope 3 supplier questionnaire' },
            { label: '💡 Explain ESG Score', action: 'Explain the current ESG score drivers and how to improve' },
            { label: '🔍 Debug ESG State', action: 'debug' }
          ].map((qa, i) => (
            <button key={i} className="action-btn" onClick={async () => { 
              if (qa.action === 'debug') {
                const result = await invoke('debug_esg_state');
                setChatHistory(prev => [...prev, { role: 'ai', text: 'ESG State: ' + result }]);
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
        {chatHistory.map((msg, i) => (
          <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%', padding: '10px 12px', borderRadius: '12px', fontSize: '12px', lineHeight: '1.5', background: msg.role === 'user' ? S.accent : S.bg, color: msg.role === 'user' ? 'white' : S.text, border: msg.role === 'ai' ? `1px solid ${S.border}` : 'none', animation: 'fadeIn 0.2s ease' }}>
            {msg.text}
            {msg.role === 'ai' && msg.text.includes('Fix') && (
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                <button className="action-btn" onClick={() => setChatInput('Show me step by step how to fix this')} style={{ padding: '5px 10px', background: S.accent, color: 'white', border: 'none', borderRadius: '6px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}>Fix now</button>
                <button className="action-btn" onClick={() => setChatInput('Show details about this compliance issue')} style={{ padding: '5px 10px', background: 'transparent', color: S.accent, border: `1px solid ${S.accent}`, borderRadius: '6px', fontSize: '10px', fontWeight: '600', cursor: 'pointer' }}>Details</button>
              </div>
            )}
          </div>
        ))}
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
function MainContent({ activeTab, activeClient, gapState, dataState, dashboardStats }) {
switch (activeTab) {
case 'dashboard': return <DashboardView client={activeClient} dashboardStats={dashboardStats} />;
case 'clients': return <ClientsView />;
case 'data': return <DataView {...dataState} />;
case 'gap': return <GapAnalysisView {...gapState} />;
case 'emissions': return <EmissionsView />;
case 'esrs': return <ESRSView />;
case 'reports': return <ReportsView />;
default: return <PlaceholderView tabId={activeTab} />;
}
}

// ── DASHBOARD ──
function DashboardView({ client, dashboardStats }) {
const kpis = [
{ label: 'ESG Score', value: dashboardStats?.esg_score ?? 74, trend: '+6', up: true, risk: 'Medium', next: 'Reduce Scope 2', color: '#007aff', unit: '' },
{ label: 'Carbon tCO2e', value: dashboardStats?.carbon_footprint ?? 198, trend: '+2%', up: false, risk: 'High', next: 'Upload Scope 3', color: '#ff3b30', unit: 't' },
{ label: 'Energy MWh', value: dashboardStats?.energy_intensity ?? 420, trend: '-4%', up: true, risk: 'Low', next: 'Maintain target', color: '#34c759', unit: '' },
{ label: 'Workforce', value: dashboardStats?.workforce ?? 342, trend: '0%', up: null, risk: 'Low', next: 'Update HR data', color: '#ff9500', unit: '' }
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
    <CO2Chart />
    <ScopeDonut />
  </div>

  {/* BOTTOM ROW */}
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
    <AuditReadiness />
    <NextActions />
  </div>

  {/* ESRS TABLE */}
  <ESRSComplianceTable />
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
<span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 7px', borderRadius: '20px', color: k.up === true ? '#34c759' : k.up === false ? '#ff3b30' : '#9ca3af', background: k.up === true ? 'rgba(52,199,89,0.1)' : k.up === false ? 'rgba(255,59,48,0.1)' : 'rgba(156,163,175,0.1)' }}>{k.trend}</span>
</div>
<div style={{ fontSize: '10px', color: hov ? k.color + 'aa' : '#9ca3af', transition: 'all 0.2s' }}>
{hov ? `→ ${k.next}` : `Risk: ${k.risk}`}
</div>
</div>
);
}

function CO2Chart() {
const pts = [
{ x: 20, y: 100, l: 'Jan', v: '248t' }, { x: 90, y: 72, l: 'Feb', v: '231t' },
{ x: 160, y: 85, l: 'Mar', v: '219t' }, { x: 230, y: 55, l: 'Apr', v: '205t' },
{ x: 300, y: 38, l: 'May', v: '198t' }, { x: 370, y: 22, l: 'Jun', v: '192t' }
];
const [hov, setHov] = useState(null);
const smooth = 'M20,100 C55,86 90,72 90,72 C125,79 160,85 160,85 C195,70 230,55 230,55 C265,46 300,38 300,38 C335,30 370,22 370,22';
const area = smooth + ' L370,130 L20,130 Z';

return (
<div style={{ background: '#fff', borderRadius: '14px', padding: '22px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
<div style={{ fontSize: '13px', fontWeight: '600', color: '#111827', marginBottom: '2px' }}>CO₂ Emission Trend</div>
<div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '16px' }}>Jan–Jun 2024 · tCO2e</div>
<svg width="100%" height="140" viewBox="0 0 400 150" style={{ overflow: 'visible' }}>
<defs>
<linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stopColor="#007aff" stopOpacity="0.12" />
<stop offset="100%" stopColor="#007aff" stopOpacity="0" />
</linearGradient>
</defs>
<path d={area} fill="url(#g1)" />
<path d={smooth} fill="none" stroke="#007aff" strokeWidth="2.5" strokeLinecap="round"
style={{ strokeDasharray: 700, strokeDashoffset: 700, animation: 'drawLine 1.8s cubic-bezier(0.4,0,0.2,1) forwards' }} />
{pts.map((p, i) => (
<g key={i} style={{ cursor: 'pointer' }} onMouseEnter={() => setHov(p)} onMouseLeave={() => setHov(null)}>
<circle cx={p.x} cy={p.y} r="14" fill="transparent" />
<circle cx={p.x} cy={p.y} r={hov === p ? 6 : 4} fill="#007aff" stroke="#fff" strokeWidth="2" style={{ transition: 'r 0.15s' }} />
<text x={p.x} y="148" textAnchor="middle" fontSize="10" fill="#9ca3af" fontFamily="-apple-system,sans-serif">{p.l}</text>
</g>
))}
{hov && (
<g>
<rect x={hov.x > 320 ? hov.x - 105 : hov.x - 15} y={hov.y - 44} width="82" height="34" rx="7" fill="#111827" />
<text x={hov.x > 320 ? hov.x - 64 : hov.x + 26} y={hov.y - 24} textAnchor="middle" fontSize="13" fontWeight="700" fill="white" fontFamily="-apple-system,sans-serif">{hov.v}</text>
</g>
)}
</svg>
</div>
);
}

function ScopeDonut() {
const scopes = [
{ label: 'Scope 1', val: 25, color: '#007aff', desc: 'Direct: 48t' },
{ label: 'Scope 2', val: 20, color: '#34c759', desc: 'Energy: 39t' },
{ label: 'Scope 3', val: 55, color: '#af52de', desc: 'Chain: 105t' }
];
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
<div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '8px' }}>Total: 192.5 tCO2e</div>
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
{hov !== null ? scopes[hov].val + '%' : '192t'}
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

function AuditReadiness() {
return (
<div style={{ background: '#fff', borderRadius: '14px', padding: '22px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
<div style={{ fontSize: '13px', fontWeight: '600', color: '#111827', marginBottom: '18px' }}>Audit Readiness</div>
<div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
<svg width="80" height="80" viewBox="0 0 80 80">
<circle cx="40" cy="40" r="32" stroke="#f3f4f6" strokeWidth="7" fill="none" />
<circle cx="40" cy="40" r="32" stroke="#34c759" strokeWidth="7" fill="none"
strokeDasharray="201" strokeDashoffset="64" strokeLinecap="round" transform="rotate(-90 40 40)" />
<text x="40" y="44" textAnchor="middle" fill="#111827" fontSize="14" fontWeight="700" fontFamily="-apple-system,sans-serif">68%</text>
</svg>
<div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
<div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#34c759', fontWeight: '600' }}>
<CheckCircle size={14} /> Data Validated
</div>
<div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#ff9500', fontWeight: '500' }}>
<AlertTriangle size={14} /> ESRS E1-5 Pending
</div>
<div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#ff3b30', fontWeight: '500' }}>
<XCircle size={14} /> Scope 3 Missing
</div>
</div>
</div>
</div>
);
}

function NextActions() {
return (
<div style={{ background: '#fff', borderRadius: '14px', padding: '22px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
<div style={{ fontSize: '13px', fontWeight: '600', color: '#111827', marginBottom: '14px' }}>Next Actions</div>
{[
{ text: 'Upload Scope 3 supplier data', p: 'High', c: '#ff3b30', b: 'rgba(255,59,48,0.08)' },
{ text: 'Complete ESRS E1–E3 disclosures', p: 'High', c: '#ff3b30', b: 'rgba(255,59,48,0.08)' },
{ text: 'Review water metrics (ESRS E3)', p: 'Medium', c: '#ff9500', b: 'rgba(255,149,0,0.08)' }
].map((a, i) => (
<div key={i} className="row-hover" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: i < 2 ? '1px solid #f3f4f6' : 'none', transition: 'background 0.15s' }}>
<span style={{ fontSize: '12px', color: '#374151' }}>{a.text}</span>
<span style={{ fontSize: '10px', fontWeight: '700', color: a.c, background: a.b, padding: '2px 8px', borderRadius: '20px', whiteSpace: 'nowrap', marginLeft: '8px' }}>{a.p}</span>
</div>
))}
</div>
);
}

function ESRSComplianceTable() {
const rows = [
{ id: 'E1', name: 'Climate Change', status: 'Partial', sc: '#ff9500', sb: 'rgba(255,149,0,0.08)' },
{ id: 'E2', name: 'Pollution', status: 'Complete', sc: '#34c759', sb: 'rgba(52,199,89,0.08)' },
{ id: 'E3', name: 'Water & Marine', status: 'Missing', sc: '#ff3b30', sb: 'rgba(255,59,48,0.08)' },
{ id: 'S1', name: 'Own Workforce', status: 'Partial', sc: '#ff9500', sb: 'rgba(255,149,0,0.08)' },
{ id: 'G1', name: 'Business Conduct', status: 'Complete', sc: '#34c759', sb: 'rgba(52,199,89,0.08)' }
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
      const list = await invoke('get_clients');
      if (list?.length) setRealClients(list);
    } catch (err) {}
  };
  loadClients();
}, []);

const displayClients = realClients.length > 0 ? realClients.map(c => ({
  n: c.name,
  i: c.industry,
  s: 74,
  st: 'In Progress',
  sc: '#ff9500'
})) : [
  { n: 'Hans GmbH Demo', i: 'Automotive', s: 74, st: 'In Progress', sc: '#ff9500' },
  { n: 'Müller & Co', i: 'Chemicals', s: 62, st: 'Action Required', sc: '#ff3b30' },
  { n: 'Schweizer AG', i: 'Electronics', s: 81, st: 'Audit Ready', sc: '#34c759' }
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
function EmissionsView() {
return (
<div style={{ display: 'flex', flexDirection: 'column', gap: '18px', animation: 'fadeIn 0.3s ease' }}>
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px' }}>
{[
{ l: 'Scope 1', v: '48.2t', d: 'Direct emissions', c: '#34c759' },
{ l: 'Scope 2', v: '39.1t', d: 'Purchased energy', c: '#007aff' },
{ l: 'Scope 3', v: '105.2t', d: 'Value chain', c: '#af52de' }
].map(s => (
<div key={s.l} style={{ background: '#fff', borderRadius: '14px', padding: '22px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
<div style={{ fontSize: '11px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>{s.l}</div>
<div style={{ fontSize: '32px', fontWeight: '700', color: s.c, letterSpacing: '-1px', marginBottom: '4px' }}>{s.v}</div>
<div style={{ fontSize: '12px', color: '#6b7280' }}>{s.d}</div>
</div>
))}
</div>
<div style={{ background: '#fff', borderRadius: '14px', padding: '22px', border: '1px solid #e5e7eb' }}>
<div style={{ fontSize: '13px', fontWeight: '600', color: '#111827', marginBottom: '18px' }}>Emissions Breakdown</div>
{[
{ l: 'Energy', v: 65, c: '#34c759' }, { l: 'Transport', v: 45, c: '#007aff' },
{ l: 'Supply Chain', v: 80, c: '#af52de' }, { l: 'Waste', v: 20, c: '#ff9500' }
].map(b => (
<div key={b.l} style={{ marginBottom: '14px' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
<span style={{ fontSize: '13px', color: '#111827', fontWeight: '500' }}>{b.l}</span>
<span style={{ fontSize: '12px', color: '#6b7280' }}>{b.v}t CO2e</span>
</div>
<div style={{ height: '6px', background: '#f3f4f6', borderRadius: '3px', overflow: 'hidden' }}>
<div style={{ height: '100%', width: `${b.v}%`, background: b.c, borderRadius: '3px', transition: 'width 0.8s ease' }} />
</div>
</div>
))}
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
{ id: 'E1', t: 'Climate Change', s: 'Partial', g: true, sc: '#ff9500', sb: 'rgba(255,149,0,0.08)' },
{ id: 'E2', t: 'Pollution', s: 'Complete', g: false, sc: '#34c759', sb: 'rgba(52,199,89,0.08)' },
{ id: 'E3', t: 'Water & Marine', s: 'Missing', g: true, sc: '#ff3b30', sb: 'rgba(255,59,48,0.08)' },
{ id: 'E4', t: 'Biodiversity', s: 'Missing', g: true, sc: '#ff3b30', sb: 'rgba(255,59,48,0.08)' },
{ id: 'S1', t: 'Own Workforce', s: 'Partial', g: true, sc: '#ff9500', sb: 'rgba(255,149,0,0.08)' },
{ id: 'S2', t: 'Workers in Value Chain', s: 'Missing', g: true, sc: '#ff3b30', sb: 'rgba(255,59,48,0.08)' },
{ id: 'G1', t: 'Business Conduct', s: 'Complete', g: false, sc: '#34c759', sb: 'rgba(52,199,89,0.08)' }
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
function ReportsView() {
const handleGenerateReport = async () => {
  try {
    const filePath = await invoke('generate_report');
    alert('Report generated: ' + filePath);
  } catch (err) {
    alert('Report generation failed: ' + err);
  }
};

return (
<div style={{ display: 'flex', flexDirection: 'column', gap: '18px', animation: 'fadeIn 0.3s ease' }}>
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px' }}>
{[
{ title: 'CSRD Draft Report', desc: 'Full ESRS disclosure · Audit-ready · Branded', icon: '📄', ready: true },
{ title: 'Management Summary', desc: 'Executive overview · PDF · Signed', icon: '📊', ready: true },
{ title: 'Gap Analysis Report', desc: 'Compliance gap details · Action plan', icon: '🔍', ready: false }
].map(r => (
<div key={r.title} style={{ background: '#fff', borderRadius: '14px', padding: '22px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', transition: 'all 0.2s ease' }}
onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
<div style={{ fontSize: '28px', marginBottom: '12px' }}>{r.icon}</div>
<div style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '5px' }}>{r.title}</div>
<div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '18px', lineHeight: '1.5' }}>{r.desc}</div>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
<span style={{ fontSize: '11px', fontWeight: '600', color: r.ready ? '#34c759' : '#ff9500', background: r.ready ? 'rgba(52,199,89,0.08)' : 'rgba(255,149,0,0.08)', padding: '3px 10px', borderRadius: '20px' }}>{r.ready ? 'Ready' : 'Pending'}</span>
<button className="action-btn" onClick={r.ready ? handleGenerateReport : undefined} style={{ background: r.ready ? '#007aff' : '#e5e7eb', color: r.ready ? 'white' : '#6b7280', border: 'none', padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', cursor: r.ready ? 'pointer' : 'default', transition: 'all 0.15s' }}>Generate</button>
</div>
</div>
))}
</div>
<div style={{ background: '#fff', borderRadius: '14px', padding: '18px 22px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
<span style={{ fontSize: '13px', fontWeight: '500', color: '#6b7280' }}>Language:</span>
{['Deutsch', 'English', 'Français'].map(l => (
<button key={l} className="action-btn" style={{ padding: '6px 14px', borderRadius: '7px', border: '1px solid #e5e7eb', background: '#f5f5f7', color: '#111827', fontSize: '12px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.15s' }}>{l}</button>
))}
<span style={{ fontSize: '13px', fontWeight: '500', color: '#6b7280', marginLeft: '8px' }}>Format:</span>
{['PDF', 'Word .docx'].map(f => (
<button key={f} className="action-btn" style={{ padding: '6px 14px', borderRadius: '7px', border: '1px solid #e5e7eb', background: '#f5f5f7', color: '#111827', fontSize: '12px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.15s' }}>{f}</button>
))}
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
