import React, { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, Users, Database, Scale, Leaf, ClipboardList, FileText, Search, Settings, Send, AlertTriangle, CheckCircle, XCircle, Loader2, UploadCloud, BarChart2, Download, User, Shield, Save, Building2, ArrowRight } from 'lucide-react';
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
  { id: 'materiality', icon: Scale, label: 'Materiality Assessment' },
  { id: 'emissions', icon: Leaf, label: 'Emissions Ledger' },
  { id: 'esrs', icon: ClipboardList, label: 'ESRS Tracker' },
  { id: 'reports', icon: FileText, label: 'CSRD Reports' },
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
          if (e.payload >= 100) { setModelReady(true); }
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
        if (list?.length) {
          setClients(list.map(c => ({
            ...c,
            status: c.score >= 75 ? 'ready' : (c.score > 0 ? 'partial' : 'risk')
          })));
        }
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
      setChatHistory(prev => [...prev.slice(0, -1), { role: 'ai', text: 'AI Engine Offline.' }]);
    }
  };

  const handleSelectClient = (clientId) => {
    setSelectedClientId(clientId);
    setActiveTab('dashboard');
  };

  const criticalRisks = esrsCompliance.filter(r => r.status === 'Missing').length;
  const potentialFine = criticalRisks * 1.2;
  const daysToEOY = Math.ceil((new Date(new Date().getFullYear(), 11, 31) - new Date()) / (1000 * 60 * 60 * 24));

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', fontFamily: S.font, background: S.bg, overflow: 'hidden' }}>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } body { overflow: hidden; -webkit-font-smoothing: antialiased; } ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; } @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } } @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } .nav-btn:hover { background: rgba(0,122,255,0.06) !important; color: #007aff !important; } .kpi-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,0.1) !important; }`}</style>

      {/* ALERT BAR */}
      <div style={{ background: criticalRisks > 0 ? '#fff3cd' : '#e0f2fe', borderBottom: `1px solid ${criticalRisks > 0 ? '#ffc107' : '#bae6fd'}`, padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: criticalRisks > 0 ? '#856404' : '#0369a1' }}>
            {criticalRisks > 0 ? `⚠ ${criticalRisks} critical compliance risks detected` : '✓ No critical compliance risks detected'}
          </span>
          {criticalRisks > 0 && <span style={{ fontSize: '12px', color: '#856404' }}>Potential fine: <b>€{potentialFine.toFixed(1)}M</b></span>}
          <span style={{ fontSize: '12px', color: criticalRisks > 0 ? '#856404' : '#0369a1' }}>Audit Deadline: <b>{daysToEOY} days</b></span>
        </div>
        {criticalRisks > 0 && <button onClick={() => setActiveTab('esrs')} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '5px 14px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>Fix Gaps</button>}
      </div>

      {/* TOP BAR */}
      <div style={{ height: '48px', background: S.panel, borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span style={{ fontSize: '13px', fontWeight: '700', color: S.text }}>
            {activeClient.name} <span style={{ color: S.muted, fontWeight: '500', marginLeft: '4px' }}>· {activeClient.reporting_year || 2024} · {activeClient.jurisdiction || 'EU-ESRS'}</span>
          </span>
          <span style={{ fontSize: '11px', fontWeight: '600', color: activeClient.score >= 75 ? S.green : S.red, background: (activeClient.score >= 75 ? S.green : S.red) + '15', padding: '3px 10px', borderRadius: '20px' }}>
            {activeClient.score >= 75 ? '● Audit Ready' : '⚠ Action Required'}
          </span>
          <span style={{ fontSize: '11px', color: S.muted }}>Sync: <b>{syncStatus}</b></span>
        </div>
        <div style={{ width: '30px', height: '30px', background: S.accent, color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700' }}>FR</div>
      </div>

      {/* BODY */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <aside style={{ width: '240px', background: S.panel, borderRight: `1px solid ${S.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '18px 16px 12px', borderBottom: `1px solid ${S.border}` }}>
            <img src={logo} alt="Targoo" style={{ width: '130px', marginBottom: '3px' }} />
            <select value={selectedClientId} onChange={e => setSelectedClientId(Number(e.target.value))} style={{ width: '100%', marginTop: '10px', padding: '8px', borderRadius: '8px', border: `1px solid ${S.border}`, background: S.bg, fontSize: '12px', cursor: 'pointer' }}>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <nav style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {menuItems.map(item => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button key={item.id} onClick={() => setActiveTab(item.id)} className="nav-btn" style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '9px', 
                  width: '100%', 
                  padding: '8px 11px', 
                  borderRadius: '4px', 
                  border: 'none', 
                  cursor: 'pointer', 
                  fontSize: '12px', 
                  fontWeight: isActive ? '600' : '500', 
                  background: isActive ? S.accentBg : 'transparent', 
                  color: isActive ? S.accent : S.muted, 
                  marginBottom: '1px', 
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}>
                  <Icon size={15} /> 
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.id === 'esrs' && criticalRisks > 0 && (
                    <span style={{ 
                      background: S.red, 
                      color: 'white', 
                      borderRadius: '10px', 
                      padding: '1px 6px', 
                      fontSize: '10px', 
                      fontWeight: '700' 
                    }}>
                      {criticalRisks}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        <main style={{ flex: 1, overflowY: 'auto', padding: '28px' }}>
          <MainContent 
            activeTab={activeTab} 
            setActiveTab={setActiveTab}
            setChatHistory={setChatHistory}
            activeClient={activeClient} 
            dashboardStats={dashboardStats} 
            co2Trend={co2Trend} 
            esrsCompliance={esrsCompliance} 
            ledgerData={ledgerData} 
            materialityData={materialityData} 
            setMaterialityData={setMaterialityData}
            selectedClientId={selectedClientId}
            clients={clients}
            setClients={setClients}
            handleSelectClient={handleSelectClient}
            auditLogs={auditLogs}
            dataState={{ isProcessing, handleFileUpload }}
            gapState={{ isAnalyzing, analysisProgress, currentTopic, analysisResults, companySize, setCompanySize, sector, setSector, runGapAnalysis: async () => {
              setIsAnalyzing(true);
              try {
                const res = await invoke('gap_analysis', { input: { client_id: selectedClientId, company_size: companySize, sector, country: 'DE' } });
                setAnalysisResults(JSON.parse(res));
              } finally { setIsAnalyzing(false); }
            }}}
          />
        </main>

        <aside style={{ width: '300px', background: S.panel, borderLeft: `1px solid ${S.border}`, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '18px', borderBottom: `1px solid ${S.border}` }}><div style={{ fontSize: '14px', fontWeight: '700' }}>CSRD Compass AI</div></div>
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
    case 'clients': return <ClientsView clients={props.clients} setClients={props.setClients} selectedClientId={props.selectedClientId} onSelect={props.handleSelectClient} />;
    case 'data': return <DataView {...props.dataState} />;
    case 'gap': return <GapAnalysisView {...props.gapState} setActiveTab={props.setActiveTab} setChatHistory={props.setChatHistory} />;
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
      <input id="file-input" type="file" style={{ display: 'none' }} onChange={e => {
        if (e.target.files?.[0]) handleFileUpload(e.target.files[0].name);
      }} />
    </div>
  );
}

// ── GAP ANALYSIS VIEW ──
function GapAnalysisView({ isAnalyzing, analysisProgress, currentTopic, analysisResults, runGapAnalysis, setActiveTab, setChatHistory }) {
  const topics = analysisResults?.topics ? Object.entries(analysisResults.topics) : [];
  
  const calculateCompliance = () => {
    if (topics.length === 0) return 0;
    const scores = topics.reduce((acc, [_, status]) => {
      if (status === 'green') return acc + 100;
      if (status === 'yellow') return acc + 50;
      return acc;
    }, 0);
    return Math.round(scores / topics.length);
  };

  const health = calculateCompliance();

  const handleFixNow = (topicName) => {
    setActiveTab('data');
    setChatHistory(prev => [...prev, { 
      role: 'ai', 
      text: `💡 **Targoo Advisor Logic**: I've detected a gap in **${topicName}**. Please upload relevant ERP exports or documents in the Data Intake section to satisfy this ESRS requirement.` 
    }]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: '700', color: S.text }}>Gap Analysis</h2>
          <p style={{ fontSize: '13px', color: S.muted }}>Regulatory alignment check against mandatory ESRS disclosures.</p>
        </div>
        {!isAnalyzing && (
          <button onClick={runGapAnalysis} style={{ background: S.accent, color: 'white', border: 'none', padding: '10px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,122,255,0.2)' }}>
            Run Deep Audit
          </button>
        )}
      </div>

      {isAnalyzing && (
        <div style={{ background: '#fff', padding: '32px', borderRadius: '16px', border: `1px solid ${S.border}`, textAlign: 'center' }}>
          <Loader2 className="spin" size={32} color={S.accent} style={{ animation: 'rotate 1s linear infinite', marginBottom: '16px', margin: '0 auto 16px' }} />
          <div style={{ fontSize: '15px', fontWeight: '700', marginBottom: '8px' }}>Analyzing Evidence: {currentTopic}</div>
          <div style={{ width: '100%', height: '8px', background: S.bg, borderRadius: '4px', overflow: 'hidden', maxWidth: '400px', margin: '0 auto' }}>
            <div style={{ width: `${analysisProgress}%`, height: '100%', background: S.accent, transition: 'width 0.3s ease' }} />
          </div>
        </div>
      )}

      {analysisResults && (
        <>
          {/* Summary Health Card */}
          <div style={{ background: S.panel, borderRadius: '16px', padding: '24px', border: `1px solid ${S.border}`, boxShadow: S.shadow, display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', border: `6px solid ${health > 70 ? S.green : health > 40 ? S.amber : S.red}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '800', color: health > 70 ? S.green : health > 40 ? S.amber : S.red }}>
              {health}%
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: S.text }}>Compliance Health: {health}%</div>
              <p style={{ fontSize: '13px', color: S.muted, marginTop: '4px' }}>
                Based on current SSOT evidence, you have covered {health}% of mandatory regulatory requirements.
              </p>
            </div>
          </div>

          {/* Detailed Results Table */}
          <div style={{ background: '#fff', borderRadius: '16px', border: `1px solid ${S.border}`, boxShadow: S.shadow, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#111827', color: 'white' }}>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '11px', fontWeight: '600', width: '50%', letterSpacing: '0.05em' }}>REGULATORY STANDARD</th>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '11px', fontWeight: '600', width: '25%', letterSpacing: '0.05em' }}>STATUS</th>
                  <th style={{ padding: '14px 20px', textAlign: 'right', fontSize: '11px', fontWeight: '600', width: '25%', letterSpacing: '0.05em' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {topics.map(([name, status], idx) => {
                  const Icon = status === 'green' ? CheckCircle : status === 'yellow' ? AlertTriangle : XCircle;
                  const color = status === 'green' ? S.green : status === 'yellow' ? S.amber : S.red;
                  const bg = status === 'green' ? 'rgba(52, 199, 89, 0.08)' : status === 'yellow' ? 'rgba(255, 149, 0, 0.08)' : 'rgba(255, 59, 48, 0.08)';
                  const label = status === 'green' ? 'ALIGNED' : status === 'yellow' ? 'PARTIAL' : 'MISSING';
                  
                  return (
                    <tr key={idx} style={{ borderBottom: idx < topics.length - 1 ? `1px solid ${S.border}` : 'none' }}>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: '700', color: S.text, background: S.bg, padding: '4px 8px', borderRadius: '6px' }}>
                            {name.split(':')[0]}
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: '500', color: S.text }}>{name.split(':')[1]}</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color, background: bg, padding: '6px 12px', borderRadius: '20px', width: 'fit-content' }}>
                          <Icon size={14} />
                          <span style={{ fontSize: '10px', fontWeight: '800' }}>{label}</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        {status !== 'green' && (
                          <button 
                            onClick={() => handleFixNow(name)}
                            style={{ background: 'transparent', color: S.accent, border: `1px solid ${S.accent}`, padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}
                            onMouseEnter={e => e.currentTarget.style.background = S.accentBg}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            Fix Now
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── MATERIALITY VIEW ──
function MaterialityView({ materialityData, selectedClientId, setMaterialityData }) {
  const [activeTopic, setActiveTopic] = useState(null);

  const handleScoreChange = async (topicId, field, val) => {
    const score = parseFloat(val);
    setActiveTopic(topicId);
    
    // 1. Optimistic Update for instant UI feedback
    const updatedLocal = materialityData.map(t => {
      if (t.esrs_code === topicId) {
        const updated = { ...t, [field]: score };
        // Auto-set status logic (> 3.0)
        updated.is_material = updated.impact_score > 3.0 || updated.financial_score > 3.0;
        return updated;
      }
      return t;
    });
    setMaterialityData(updatedLocal);

    // 2. Persist to Backend
    try {
      const topic = updatedLocal.find(t => t.esrs_code === topicId);
      await invoke('update_materiality_score', { 
        clientId: selectedClientId, 
        topicId, 
        impactScore: topic.impact_score, 
        financialScore: topic.financial_score 
      });
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  const materialCount = materialityData.filter(t => t.is_material).length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '32px', animation: 'fadeIn 0.3s ease', height: '100%', maxHeight: 'calc(100vh - 180px)' }}>
      <style>{`
        .apple-slider {
          -webkit-appearance: none;
          width: 100%;
          height: 4px;
          background: #e5e7eb;
          border-radius: 2px;
          outline: none;
        }
        .apple-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #007aff;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          transition: transform 0.1s ease;
        }
        .apple-slider::-webkit-slider-thumb:active {
          transform: scale(1.2);
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.8); opacity: 0.5; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        .active-dot-ring {
          animation: pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        }
      `}</style>

      {/* LEFT: SLIDERS */}
      <div style={{ background: '#fff', borderRadius: '20px', padding: '24px', border: `1px solid ${S.border}`, boxShadow: S.shadow, overflowY: 'auto' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: S.text, marginBottom: '6px', letterSpacing: '-0.02em' }}>Double Materiality</h2>
        <p style={{ fontSize: '13px', color: S.muted, marginBottom: '24px' }}>Move sliders to update matrix in real-time.</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {materialityData.map(t => (
            <div key={t.esrs_code} onMouseEnter={() => setActiveTopic(t.esrs_code)} onMouseLeave={() => setActiveTopic(null)} style={{ padding: '14px', borderRadius: '14px', background: t.is_material ? S.accentBg : S.bg, border: `1px solid ${t.is_material ? S.accent + '20' : 'transparent'}`, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: S.text }}>
                  <span style={{ color: S.accent, marginRight: '6px' }}>{t.esrs_code}</span> {t.topic_name}
                </div>
                {t.is_material && <span style={{ fontSize: '9px', fontWeight: '800', padding: '2px 8px', borderRadius: '10px', background: S.accent, color: 'white' }}>MATERIAL</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', fontWeight: '600', color: S.muted }}>Impact</span>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: S.text }}>{t.impact_score.toFixed(1)}</span>
                  </div>
                  <input type="range" min="1" max="5" step="0.1" value={t.impact_score} onChange={e => handleScoreChange(t.esrs_code, 'impact_score', e.target.value)} className="apple-slider" />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', fontWeight: '600', color: S.muted }}>Financial</span>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: S.text }}>{t.financial_score.toFixed(1)}</span>
                  </div>
                  <input type="range" min="1" max="5" step="0.1" value={t.financial_score} onChange={e => handleScoreChange(t.esrs_code, 'financial_score', e.target.value)} className="apple-slider" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT: INTERACTIVE MATRIX */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ background: '#fff', borderRadius: '24px', padding: '40px', border: `1px solid ${S.border}`, boxShadow: S.shadowMd, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
          
          <div style={{ position: 'relative', width: '400px', height: '400px' }}>
            {/* Quadrant Backgrounds */}
            <div style={{ position: 'absolute', top: 0, right: 0, width: '50%', height: '50%', background: S.accentBg, borderRadius: '0 12px 0 0', opacity: 0.5 }} />
            <div style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '10px', fontWeight: '800', color: S.accent, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Material Focus</div>

            {/* Axes */}
            <div style={{ position: 'absolute', bottom: '-35px', width: '100%', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: S.muted }}>Financial Materiality →</div>
            <div style={{ position: 'absolute', left: '-140px', top: '200px', transform: 'rotate(-90deg)', width: '400px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: S.muted }}>Impact Materiality →</div>

            <svg width="400" height="400" viewBox="0 0 400 400" style={{ overflow: 'visible' }}>
              {/* Grid Lines */}
              {[1, 2, 3, 4, 5].map(v => (
                <React.Fragment key={v}>
                  <line x1={(v-1)*100} y1="0" x2={(v-1)*100} y2="400" stroke={S.border} strokeWidth="1" strokeDasharray={v === 3 ? "0" : "4,4"} />
                  <line x1="0" y1={(v-1)*100} x2="400" y2={(v-1)*100} stroke={S.border} strokeWidth="1" strokeDasharray={v === 3 ? "0" : "4,4"} />
                </React.Fragment>
              ))}
              <line x1="400" y1="0" x2="400" y2="400" stroke={S.border} />
              <line x1="0" y1="0" x2="400" y2="0" stroke={S.border} />

              {/* Threshold Lines (3.0 score) */}
              <line x1="200" y1="0" x2="200" y2="400" stroke={S.border} strokeWidth="2" />
              <line x1="0" y1="200" x2="400" y2="200" stroke={S.border} strokeWidth="2" />

              {/* Live Dots */}
              {materialityData.map(t => {
                const x = (t.financial_score - 1) * 100;
                const y = 400 - ((t.impact_score - 1) * 100);
                const isActive = activeTopic === t.esrs_code;
                
                return (
                  <g key={t.esrs_code} style={{ transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }} onMouseEnter={() => setActiveTopic(t.esrs_code)} onMouseLeave={() => setActiveTopic(null)}>
                    {isActive && <circle cx={x} cy={y} r="15" fill={S.accent} className="active-dot-ring" />}
                    <circle 
                      cx={x} cy={y} r={isActive ? "7" : "5"} 
                      fill={t.is_material ? S.accent : '#9ca3af'} 
                      stroke="white" strokeWidth="2" 
                      style={{ cursor: 'pointer', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} 
                    />
                    <text x={x + 10} y={y + 4} fontSize="11" fontWeight="800" fill={isActive ? S.accent : S.text} style={{ pointerEvents: 'none', transition: 'all 0.2s' }}>
                      {t.esrs_code}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* SUMMARY CARD */}
        <div style={{ background: S.panel, borderRadius: '18px', padding: '20px', border: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: S.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '20px', fontWeight: '800' }}>
            {materialCount}
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: S.text }}>Material Topics Identified</div>
            <div style={{ fontSize: '12px', color: S.muted }}>{materialCount} topics are above the 3.0 threshold and require reporting.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmissionsView({ ledgerData }) {
  const [filter, setFilter] = useState('');
  
  const filteredData = (ledgerData || []).filter(item => 
    item.category?.toLowerCase().includes(filter.toLowerCase()) || 
    item.origin_file?.toLowerCase().includes(filter.toLowerCase()) ||
    item.source?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.3s ease', height: '100%' }}>
      {/* HEADER & ACTION BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: S.text, letterSpacing: '-0.02em' }}>ESG Transparency Ledger</h2>
          <p style={{ fontSize: '13px', color: S.muted, marginTop: '4px' }}>The single source of truth for all ingested sustainability data points.</p>
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: S.muted }} />
          <input 
            type="text" 
            placeholder="Filter by category or file..." 
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{ 
              padding: '10px 12px 10px 34px', 
              borderRadius: '10px', 
              border: `1px solid ${S.border}`, 
              fontSize: '13px', 
              width: '280px', 
              outline: 'none',
              background: S.panel,
              transition: 'border-color 0.2s'
            }} 
            onFocus={e => e.target.style.borderColor = S.accent}
            onBlur={e => e.target.style.borderColor = S.border}
          />
        </div>
      </div>

      {/* THE LEDGER GRID */}
      <div style={{ 
        background: S.panel, 
        borderRadius: '20px', 
        border: `1px solid ${S.border}`, 
        boxShadow: S.shadowMd, 
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${S.border}`, background: '#fafafa' }}>
                <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '700', color: S.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Source File</th>
                <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '700', color: S.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Original Label</th>
                <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '700', color: S.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ESG Category</th>
                <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '700', color: S.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Raw Value</th>
                <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '700', color: S.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Normalized</th>
                <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '700', color: S.muted, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Match %</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: '13px' }}>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '60px', textAlign: 'center', color: S.muted }}>
                    No matching records found in the transparency grid.
                  </td>
                </tr>
              ) : (
                filteredData.map((d, i) => {
                  const confidencePercent = Math.round(d.confidence * 100);
                  const statusColor = d.confidence >= 0.9 ? S.green : (d.confidence >= 0.8 ? S.amber : S.red);
                  
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${S.border}`, transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,122,255,0.02)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <FileText size={16} color={S.accent} />
                          <span style={{ fontWeight: '600', color: S.text }}>{d.origin_file}</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px', color: S.muted, fontStyle: 'italic' }}>
                        {d.source || '—'}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{ 
                          padding: '4px 10px', 
                          borderRadius: '8px', 
                          background: S.accentBg, 
                          color: S.accent, 
                          fontSize: '11px', 
                          fontWeight: '700',
                          textTransform: 'uppercase'
                        }}>
                          {d.category.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', fontFamily: '"SF Mono", "Roboto Mono", monospace', color: S.text }}>
                        {d.value.toLocaleString(undefined, { minimumFractionDigits: 1 })} <span style={{ color: S.muted, fontSize: '11px' }}>{d.unit}</span>
                      </td>
                      <td style={{ padding: '16px 20px', fontWeight: '700', fontFamily: '"SF Mono", "Roboto Mono", monospace', color: S.accent }}>
                        {d.normalized_value.toLocaleString(undefined, { minimumFractionDigits: 3 })} <span style={{ fontSize: '10px', fontWeight: '500' }}>tCO₂e</span>
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <span style={{ 
                          padding: '4px 10px', 
                          borderRadius: '20px', 
                          background: statusColor + '15', 
                          color: statusColor, 
                          fontSize: '11px', 
                          fontWeight: '800',
                          border: `1px solid ${statusColor}30`
                        }}>
                          {confidencePercent}%
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FOOTER STATS */}
      <div style={{ display: 'flex', gap: '24px', fontSize: '12px', color: S.muted, padding: '0 8px' }}>
        <span>Total Records: <b>{filteredData.length}</b></span>
        <span>Avg. Confidence: <b>{filteredData.length > 0 ? Math.round(filteredData.reduce((acc, curr) => acc + curr.confidence, 0) / filteredData.length * 100) : 0}%</b></span>
      </div>
    </div>
  );
}

function ClientsView({ clients, selectedClientId, onSelect }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
      {clients.map(c => (
        <div key={c.id} style={{ background: '#fff', padding: '20px', borderRadius: '16px', border: c.id === selectedClientId ? `2px solid ${S.accent}` : `1px solid ${S.border}` }}>
          <div style={{ fontWeight: '700' }}>{c.name}</div>
          <div style={{ fontSize: '12px', color: S.muted }}>{c.industry} · {c.jurisdiction}</div>
          <button onClick={() => onSelect(c.id)} style={{ marginTop: '15px', width: '100%', padding: '10px', background: S.bg, border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Switch workspace</button>
        </div>
      ))}
    </div>
  );
}

function ReportsView({ activeClient, ledgerData }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [step, setStep] = useState(0);
  const [lastReportPath, setLastReportPath] = useState(null);
  const [lang, setLang] = useState('en');

  const steps = [
    "Fetching SSOT data...",
    "Normalizing physics...",
    "Assembling Word structures...",
    "Finalizing document on Desktop..."
  ];

  const handleGenerate = async () => {
    setIsGenerating(true);
    setStep(0);
    setLastReportPath(null);

    // Simulate progress for UI delight
    const timer = setInterval(() => {
      setStep(s => (s < 3 ? s + 1 : s));
    }, 800);

    try {
      const path = await invoke('generate_report', { clientId: activeClient.id });
      clearInterval(timer);
      setStep(3);
      setLastReportPath(path);
    } catch (err) {
      alert('Generation failed: ' + err);
      clearInterval(timer);
    } finally {
      setIsGenerating(false);
    }
  };

  const openFolder = async () => {
    if (!lastReportPath) return;
    try {
      // Use the opener plugin if available via invoke or global
      await invoke('plugin:opener|open_path', { path: lastReportPath, component: 'folder' });
    } catch (e) {
      console.error("Could not open folder automatically.");
    }
  };

  const hasData = (ledgerData || []).length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '40px', padding: '60px 20px', animation: 'fadeIn 0.4s ease' }}>
      <style>{`
        .segment-btn { padding: 6px 16px; border-radius: 7px; border: none; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .progress-bar { height: 4px; background: #e5e7eb; border-radius: 2px; overflow: hidden; margin-top: 12px; }
        .progress-fill { height: 100%; background: #007aff; transition: width 0.5s ease; }
      `}</style>

      {/* Language Selector */}
      <div style={{ background: '#e5e7eb', padding: '3px', borderRadius: '9px', display: 'flex', gap: '2px' }}>
        <button onClick={() => setLang('en')} className="segment-btn" style={{ background: lang === 'en' ? 'white' : 'transparent', color: lang === 'en' ? S.text : S.muted, boxShadow: lang === 'en' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none' }}>English</button>
        <button onClick={() => setLang('de')} className="segment-btn" style={{ background: lang === 'de' ? 'white' : 'transparent', color: lang === 'de' ? S.text : S.muted, boxShadow: lang === 'de' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none' }}>Deutsch</button>
      </div>

      <div style={{ background: '#fff', padding: '48px', borderRadius: '32px', border: `1px solid ${S.border}`, boxShadow: S.shadowMd, width: '100%', maxWidth: '520px', textAlign: 'center' }}>
        <div style={{ width: '90px', height: '90px', background: S.accentBg, borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: S.accent }}>
          <FileText size={44} />
        </div>
        
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: hasData ? S.green + '15' : S.muted + '15', padding: '4px 12px', borderRadius: '20px', marginBottom: '16px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: hasData ? S.green : S.muted }} />
          <span style={{ fontSize: '11px', fontWeight: '800', color: hasData ? S.green : S.muted }}>{hasData ? 'READY TO GENERATE' : 'DATA MISSING'}</span>
        </div>

        <h2 style={{ fontSize: '26px', fontWeight: '800', color: S.text, letterSpacing: '-0.03em', marginBottom: '8px' }}>Official CSRD Disclosure Report 2024</h2>
        <p style={{ fontSize: '14px', color: S.muted, marginBottom: '32px', lineHeight: '1.5' }}>
          This will compile your Materiality Matrix, Emissions Ledger, and Compliance Gap Analysis into a professional audit-proof document.
        </p>

        {isGenerating ? (
          <div style={{ textAlign: 'left', background: S.bg, padding: '20px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Loader2 className="spin" size={16} color={S.accent} style={{ animation: 'rotate 1s linear infinite' }} />
              <span style={{ fontSize: '13px', fontWeight: '600' }}>{steps[step]}</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${((step + 1) / 4) * 100}%` }} />
            </div>
          </div>
        ) : lastReportPath ? (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={{ background: S.green + '10', padding: '20px', borderRadius: '16px', border: `1px solid ${S.green}20`, marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', justifyContent: 'center' }}>
                <CheckCircle size={20} color={S.green} />
                <span style={{ fontSize: '15px', fontWeight: '700', color: S.green }}>Report Successfully Built</span>
              </div>
              <div style={{ fontSize: '12px', color: S.muted, wordBreak: 'break-all' }}>{lastReportPath.split(/[\\/]/).pop()}</div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handleGenerate} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: `1px solid ${S.border}`, background: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Generate Again</button>
              <button onClick={openFolder} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: S.accent, color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><UploadCloud size={16} /> Open Folder</button>
            </div>
          </div>
        ) : (
          <button 
            onClick={handleGenerate} 
            disabled={!hasData}
            style={{ 
              width: '100%',
              background: hasData ? S.accent : S.muted, 
              color: 'white', 
              border: 'none', 
              padding: '16px', 
              borderRadius: '14px', 
              fontSize: '16px', 
              fontWeight: '700', 
              cursor: hasData ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              transition: 'all 0.2s',
              boxShadow: hasData ? '0 8px 20px rgba(0,122,255,0.25)' : 'none'
            }}
            onMouseEnter={e => hasData && (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={e => hasData && (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <Download size={20} /> Generate Word Document (.docx)
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: S.muted, fontSize: '12px' }}>
        <Shield size={14} />
        <span>Targoo Official Audit-Proof Documentation Protocol v1.2</span>
      </div>
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
    <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '18px', fontWeight: '700' }}>Settings</h2>
      <div style={{ marginTop: '20px' }}><label style={{ fontSize: '12px', color: S.muted }}>Advisor Name</label><input style={{ width: '100%', padding: '10px', background: S.bg, border: `1px solid ${S.border}`, borderRadius: '8px' }} defaultValue="Fritz Schmidt" /></div>
      <button style={{ marginTop: '20px', background: S.accent, color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px' }}>Save Profile</button>
    </div>
  );
}

function ESRSView() { return <div>ESRS Compliance Tracker Coming Soon</div>; }
function PlaceholderView({ tabId }) { return <div>{tabId} Module</div>; }
