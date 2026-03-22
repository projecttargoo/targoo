import React, { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, Users, Database, Scale, Leaf, ClipboardList, FileText, Search, Settings, Send, AlertTriangle, CheckCircle, XCircle, Loader2, UploadCloud, BarChart2, Download, User, Shield, Save } from 'lucide-react';
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
  { id: 'data', icon: Database, label: 'Data Intake' },
  { id: 'gap', icon: BarChart2, label: 'Gap Analysis' },
  { id: 'materiality', icon: Scale, label: 'Analysis' },
  { id: 'emissions', icon: Leaf, label: 'Emissions' },
  { id: 'esrs', icon: ClipboardList, label: 'Compliance' },
  { id: 'reports', icon: FileText, label: 'Reports' },
  { id: 'audit', icon: Search, label: 'Audit Trail' },
  { id: 'settings', icon: Settings, label: 'Settings' }
];

const initialClients = [
  { id: 1, name: 'Hans GmbH Demo', score: 0, status: 'risk' }
];

export default function App() {
  const [dashboardStats, setDashboardStats] = useState(null);
  const [co2Trend, setCo2Trend] = useState([]);
  const [esrsCompliance, setEsrsCompliance] = useState([]);
  const [ledgerData, setLedgerData] = useState([]);
  const [materialityData, setMaterialityData] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [clients, setClients] = useState(initialClients);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { role: 'ai', text: 'Welcome to Targoo. Drop an ERP file to begin analysis.' }
  ]);
  const [selectedClientId, setSelectedClientId] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [modelDownloading, setModelDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [currentTopic, setCurrentTopic] = useState('');
  const [analysisResults, setAnalysisResults] = useState(null);
  const [companySize, setCompanySize] = useState('large');
  const [sector, setSector] = useState('manufacturing');
  const [syncStatus, setSyncTime] = useState('Local mode');

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

  const loadAllData = async () => {
    try {
      const stats = await invoke('get_dashboard_stats', { clientId: selectedClientId });
      setDashboardStats(stats);
      
      const trend = await invoke('get_co2_trend', { clientId: selectedClientId });
      setCo2Trend(JSON.parse(trend));
      
      const compliance = await invoke('get_esrs_compliance', { clientId: selectedClientId });
      setEsrsCompliance(JSON.parse(compliance));
      
      const ledger = await invoke('get_esg_ledger', { clientId: selectedClientId });
      setLedgerData(JSON.parse(ledger));
      
      const mat = await invoke('get_materiality_assessment', { clientId: selectedClientId });
      setMaterialityData(JSON.parse(mat));

      const logs = await invoke('get_audit_logs', { client_id: selectedClientId });
      setAuditLogs(JSON.parse(logs));
    } catch (err) {
      console.error('Failed to load client data:', err);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [selectedClientId]);

  useEffect(() => {
    const loadClients = async () => {
      try {
        const list = await invoke('get_enterprise_clients');
        if (list?.length) setClients(list);
      } catch (err) {}
    };
    loadClients();
  }, []);

  const handleFileUpload = async (filename, content = []) => {
    if (!filename) return;
    setImportResults(null);
    setIsProcessing(true);
    try {
      const result = await invoke('import_files', { 
        filePaths: [filename],
        fileContent: content,
        clientId: selectedClientId
      });
      setImportResults(result);
      setSyncTime('Just now');
      await loadAllData();
      
      const analysis = await invoke('analyze_imported_data', { clientId: selectedClientId });
      const proactiveMsg = `📊 Auto-Analysis for ${filename.split(/[\\/]/).pop()}\n\n${analysis.proactive_message || 'No insights detected.'}`;
      setChatHistory(prev => [...prev, { role: 'ai', text: proactiveMsg }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'ai', text: `❌ Error: ${err}` }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;
    const question = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: question }, { role: 'ai', text: 'Thinking...' }]);
    try {
      const response = await invoke('ask_ai', { question, clientId: selectedClientId });
      setChatHistory(prev => [...prev.slice(0, -1), { role: 'ai', text: response }]);
    } catch (err) {
      setChatHistory(prev => [...prev.slice(0, -1), { role: 'ai', text: 'AI Engine Offline. Please download the model.' }]);
    }
  };

  const criticalRisks = esrsCompliance.filter(r => r.status === 'Missing').length;
  const potentialFine = criticalRisks * 1.2;
  const daysToEOY = Math.ceil((new Date(new Date().getFullYear(), 11, 31) - new Date()) / (1000 * 60 * 60 * 24));

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', fontFamily: S.font, background: S.bg, overflow: 'hidden' }}>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } body { overflow: hidden; -webkit-font-smoothing: antialiased; } ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; } @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } } @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } .nav-btn:hover { background: rgba(0,122,255,0.06) !important; color: #007aff !important; } .kpi-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,0.1) !important; }`}</style>

      {/* ── ALERT BAR ── */}
      <div style={{ background: criticalRisks > 0 ? '#fff3cd' : '#e0f2fe', borderBottom: `1px solid ${criticalRisks > 0 ? '#ffc107' : '#bae6fd'}`, padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: criticalRisks > 0 ? '#856404' : '#0369a1' }}>
            {criticalRisks > 0 ? `⚠ ${criticalRisks} critical compliance risks detected` : '✓ No critical compliance risks detected'}
          </span>
          {criticalRisks > 0 && <span style={{ fontSize: '12px', color: '#856404' }}>Potential fine: <b>€{potentialFine.toFixed(1)}M</b></span>}
          <span style={{ fontSize: '12px', color: criticalRisks > 0 ? '#856404' : '#0369a1' }}>Audit Deadline: <b>{daysToEOY} days</b></span>
        </div>
        {criticalRisks > 0 && (
          <button onClick={() => setActiveTab('esrs')} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '5px 14px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>Fix Gaps</button>
        )}
      </div>

      {/* ── TOP BAR ── */}
      <div style={{ height: '48px', background: S.panel, borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span style={{ fontSize: '13px', fontWeight: '700', color: S.text }}>{activeClient.name}</span>
          <span style={{ fontSize: '11px', fontWeight: '600', color: activeClient.score >= 75 ? S.green : S.red, background: (activeClient.score >= 75 ? S.green : S.red) + '15', padding: '3px 10px', borderRadius: '20px' }}>
            {activeClient.score >= 75 ? '● Audit Ready' : '⚠ Action Required'}
          </span>
          <span style={{ fontSize: '11px', color: S.muted }}>Sync: <b>{syncStatus}</b></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '30px', height: '30px', background: S.accent, color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700' }}>FR</div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <aside style={{ width: '240px', background: S.panel, borderRight: `1px solid ${S.border}`, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '18px 16px 12px', borderBottom: `1px solid ${S.border}` }}>
            <img src={logo} alt="Targoo" style={{ width: '130px', marginBottom: '3px' }} />
            <select value={selectedClientId} onChange={e => setSelectedClientId(Number(e.target.value))} style={{ width: '100%', marginTop: '10px', padding: '8px', borderRadius: '8px', border: `1px solid ${S.border}`, background: S.bg, fontSize: '12px', cursor: 'pointer' }}>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <nav style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {menuItems.map(item => (
              <button key={item.id} onClick={() => setActiveTab(item.id)} className="nav-btn" style={{ display: 'flex', alignItems: 'center', gap: '9px', width: '100%', padding: '8px 11px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: activeTab === item.id ? '600' : '500', background: activeTab === item.id ? S.accentBg : 'transparent', color: activeTab === item.id ? S.accent : S.muted, marginBottom: '1px', textAlign: 'left' }}>
                <item.icon size={15} /> {item.label}
              </button>
            ))}
          </nav>
          {/* Drop Hub Summary */}
          {importResults && (
            <div style={{ margin: '12px', padding: '10px', background: 'rgba(255,255,255,0.5)', border: `1px solid ${S.border}`, borderRadius: '10px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', marginBottom: '6px' }}>Last Import</div>
              <div style={{ fontSize: '9px', color: S.green }}>✔ {importResults.imported_count} records processed</div>
            </div>
          )}
        </aside>

        <main style={{ flex: 1, overflowY: 'auto', padding: '28px' }}>
          <MainContent 
            activeTab={activeTab} 
            activeClient={activeClient} 
            dashboardStats={dashboardStats} 
            co2Trend={co2Trend} 
            esrsCompliance={esrsCompliance} 
            ledgerData={ledgerData} 
            materialityData={materialityData} 
            setMaterialityData={setMaterialityData}
            selectedClientId={selectedClientId}
            auditLogs={auditLogs}
            dataState={{ isProcessing, handleFileUpload }}
            gapState={{ isAnalyzing, analysisProgress, currentTopic, analysisResults, companySize, setCompanySize, sector, setSector, runGapAnalysis: async () => {
              setIsAnalyzing(true);
              try {
                const res = await invoke('gap_analysis', { input: { company_size: companySize, sector, country: 'DE' } });
                setAnalysisResults(JSON.parse(res));
              } finally { setIsAnalyzing(false); }
            }}}
          />
        </main>

        {/* ── RIGHT PANEL AI ── */}
        <aside style={{ width: '300px', background: S.panel, borderLeft: `1px solid ${S.border}`, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '18px', borderBottom: `1px solid ${S.border}` }}>
            <div style={{ fontSize: '14px', fontWeight: '700' }}>CSRD Compass AI</div>
            <div style={{ fontSize: '11px', color: S.green, marginTop: '3px' }}>● Engine Active</div>
          </div>
          <div style={{ flex: 1, padding: '14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {chatHistory.map((msg, i) => (
              <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%', padding: '10px', borderRadius: '12px', fontSize: '12px', background: msg.role === 'user' ? S.accent : S.bg, color: msg.role === 'user' ? 'white' : S.text, border: msg.role === 'ai' ? `1px solid ${S.border}` : 'none', whiteSpace: 'pre-wrap' }}>
                {msg.text}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleSend} style={{ padding: '12px', borderTop: `1px solid ${S.border}`, position: 'relative' }}>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Ask AI Advisor..." style={{ width: '100%', background: S.bg, border: `1px solid ${S.border}`, borderRadius: '20px', padding: '9px 40px 9px 14px', fontSize: '12px', outline: 'none' }} />
            <button type="submit" style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', width: '28px', height: '28px', background: S.accent, borderRadius: '50%', border: 'none', color: 'white', cursor: 'pointer' }}><Send size={13} /></button>
          </form>
        </aside>
      </div>
    </div>
  );
}

function MainContent(props) {
  switch (props.activeTab) {
    case 'dashboard': return <DashboardView {...props} />;
    case 'clients': return <ClientsView />;
    case 'data': return <DataView {...props.dataState} />;
    case 'gap': return <GapAnalysisView {...props.gapState} />;
    case 'materiality': return <MaterialityView {...props} />;
    case 'emissions': return <EmissionsView ledgerData={props.ledgerData} />;
    case 'esrs': return <ESRSView esrsCompliance={props.esrsCompliance} />;
    case 'reports': return <ReportsView activeClient={props.activeClient} />;
    case 'audit': return <AuditTrailView logs={props.auditLogs} />;
    case 'settings': return <SettingsView />;
    default: return <div>Placeholder</div>;
  }
}

function DashboardView({ dashboardStats, co2Trend, esrsCompliance }) {
  const kpis = [
    { label: 'ESG Score', value: dashboardStats?.esg_score ?? 0, color: S.accent, unit: '' },
    { label: 'Carbon Footprint', value: dashboardStats?.carbon_footprint ?? 0, color: S.red, unit: 't' },
    { label: 'Energy Usage', value: dashboardStats?.energy_mwh ?? 0, color: S.green, unit: 'MWh' },
    { label: 'Workforce', value: dashboardStats?.workforce ?? 0, color: S.amber, unit: 'pax' }
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px' }}>
        {kpis.map((k, i) => (
          <div key={i} className="kpi-card" style={{ background: '#fff', borderRadius: '14px', padding: '20px', border: `1px solid ${S.border}`, transition: 'all 0.2s ease' }}>
            <div style={{ fontSize: '10px', fontWeight: '600', color: S.muted, textTransform: 'uppercase', marginBottom: '8px' }}>{k.label}</div>
            <div style={{ fontSize: '32px', fontWeight: '700', color: k.color }}>{k.value.toFixed(1)}<span style={{ fontSize: '14px' }}>{k.unit}</span></div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '16px' }}>
        <CO2Chart co2Trend={co2Trend} />
        <div style={{ background: '#fff', borderRadius: '14px', padding: '22px', border: `1px solid ${S.border}` }}>
          <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '16px' }}>Compliance Status</div>
          {esrsCompliance.slice(0, 5).map(c => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '12px' }}>
              <span>{c.id} {c.name}</span>
              <span style={{ fontWeight: '700', color: c.status === 'Complete' ? S.green : S.red }}>{c.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CO2Chart({ co2Trend }) {
  const maxVal = Math.max(...(co2Trend || []).map(d => d.value), 10);
  const pts = (co2Trend || []).map((d, i) => ({
    x: 20 + i * (360 / (co2Trend.length - 1 || 1)),
    y: 120 - (d.value / maxVal) * 100,
    l: d.period
  }));
  return (
    <div style={{ background: '#fff', borderRadius: '14px', padding: '22px', border: `1px solid ${S.border}` }}>
      <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '16px' }}>CO₂ Emission Trend</div>
      <svg width="100%" height="140" viewBox="0 0 400 150">
        <polyline fill="none" stroke={S.accent} strokeWidth="2.5" points={pts.map(p => `${p.x},${p.y}`).join(' ')} />
        {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill={S.accent} />)}
      </svg>
    </div>
  );
}

function DataView({ isProcessing, handleFileUpload }) {
  return (
    <div style={{ background: '#fff', borderRadius: '16px', padding: '48px', border: `2px dashed ${S.border}`, textAlign: 'center', position: 'relative' }}>
      {isProcessing && <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 className="spin" style={{ animation: 'rotate 1s linear infinite' }} /></div>}
      <UploadCloud size={48} color={S.muted} style={{ marginBottom: '16px' }} />
      <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '24px' }}>Drop ERP files to begin local ingestion</div>
      <button onClick={() => document.getElementById('file-input').click()} style={{ background: S.accent, color: 'white', border: 'none', padding: '10px 24px', borderRadius: '10px', cursor: 'pointer' }}>Select File</button>
    </div>
  );
}

function EmissionsView({ ledgerData }) {
  return (
    <div style={{ background: '#fff', borderRadius: '14px', border: `1px solid ${S.border}`, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead><tr style={{ background: S.bg, borderBottom: `1px solid ${S.border}` }}>{['Source', 'Category', 'Raw', 'Normalized', 'Match'].map(h => <th key={h} style={{ padding: '12px', textAlign: 'left' }}>{h}</th>)}</tr></thead>
        <tbody>
          {ledgerData.map((d, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${S.bg}` }}>
              <td style={{ padding: '12px' }}>{d.origin_file}</td>
              <td style={{ padding: '12px', fontWeight: '600' }}>{d.category}</td>
              <td style={{ padding: '12px' }}>{d.value} {d.unit}</td>
              <td style={{ padding: '12px', color: S.accent }}>{d.normalized_value} {d.normalized_unit}</td>
              <td style={{ padding: '12px', fontWeight: '700', color: d.confidence > 0.9 ? S.green : S.amber }}>{Math.round(d.confidence * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MaterialityView({ materialityData, selectedClientId, setMaterialityData }) {
  const handleScoreChange = async (topicId, field, val) => {
    await invoke('update_materiality_score', { clientId: selectedClientId, topicId, impactScore: field === 'impact_score' ? parseFloat(val) : 0, financialScore: field === 'financial_score' ? parseFloat(val) : 0 });
    const mat = await invoke('get_materiality_assessment', { clientId: selectedClientId });
    setMaterialityData(JSON.parse(mat));
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
      <div style={{ background: '#fff', padding: '20px', borderRadius: '14px' }}>
        {materialityData.map(t => (
          <div key={t.esrs_code} style={{ marginBottom: '15px' }}>
            <div style={{ fontSize: '12px', fontWeight: '700' }}>{t.esrs_code} {t.topic_name}</div>
            <input type="range" min="1" max="5" step="0.5" value={t.impact_score} onChange={e => handleScoreChange(t.esrs_code, 'impact_score', e.target.value)} style={{ width: '100%' }} />
          </div>
        ))}
      </div>
      <div style={{ background: '#fff', padding: '20px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="300" height="300" viewBox="0 0 300 300" style={{ border: `1px solid ${S.border}` }}>
          <line x1="150" y1="0" x2="150" y2="300" stroke={S.border} strokeDasharray="4" />
          <line x1="0" y1="150" x2="300" y2="150" stroke={S.border} strokeDasharray="4" />
          {materialityData.map(t => <circle key={t.esrs_code} cx={(t.financial_score - 1) * 60} cy={300 - (t.impact_score - 1) * 60} r="6" fill={t.is_material ? S.green : S.muted} />)}
        </svg>
      </div>
    </div>
  );
}

function ReportsView({ activeClient }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const path = await invoke('generate_report', { clientId: activeClient.id, companyName: activeClient.name, language: 'en' });
      alert('Saved to: ' + path);
    } finally { setIsGenerating(false); }
  };
  return (
    <div style={{ background: '#fff', padding: '40px', borderRadius: '16px', textAlign: 'center' }}>
      <FileText size={48} color={S.accent} style={{ marginBottom: '20px' }} />
      <h3>CSRD Regulatory Report</h3>
      <button onClick={handleGenerate} disabled={isGenerating} style={{ background: S.accent, color: 'white', border: 'none', padding: '12px 30px', borderRadius: '10px', marginTop: '20px', cursor: 'pointer' }}>
        {isGenerating ? 'Constructing...' : 'Generate Word Report'}
      </button>
    </div>
  );
}

function AuditTrailView({ logs }) {
  return (
    <div style={{ background: '#fff', borderRadius: '14px', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
        <thead style={{ background: '#111827', color: 'white' }}><tr>{['TIMESTAMP', 'ACTION', 'DETAILS'].map(h => <th key={h} style={{ padding: '12px', textAlign: 'left' }}>{h}</th>)}</tr></thead>
        <tbody>
          {(logs || []).map((l, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${S.bg}` }}>
              <td style={{ padding: '12px', fontFamily: 'monospace' }}>{l.timestamp}</td>
              <td style={{ padding: '12px', fontWeight: '700' }}>{l.action}</td>
              <td style={{ padding: '12px' }}>{l.details}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SettingsView() {
  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: `1px solid ${S.border}` }}>
        <h4>Advisor Profile</h4>
        <input style={{ width: '100%', padding: '10px', background: S.bg, border: `1px solid ${S.border}`, borderRadius: '8px', marginTop: '10px' }} placeholder="Fritz Schmidt" />
        <button style={{ background: S.accent, color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', marginTop: '15px', cursor: 'pointer' }}>Save Profile</button>
      </div>
    </div>
  );
}

function GapAnalysisView({ isAnalyzing, analysisResults, runGapAnalysis }) {
  return (
    <div style={{ background: '#fff', padding: '24px', borderRadius: '16px' }}>
      <button onClick={runGapAnalysis} disabled={isAnalyzing} style={{ background: S.accent, color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer' }}>{isAnalyzing ? 'Analyzing...' : 'Run Analysis'}</button>
      {analysisResults && <div style={{ marginTop: '20px' }}>Analysis Complete.</div>}
    </div>
  );
}

function ClientsView() { return <div>Manage Clients coming soon.</div>; }
function ESRSView({ esrsCompliance }) { return <div>Compliance Tracker for {esrsCompliance.length} topics.</div>; }
