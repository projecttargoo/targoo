import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  LayoutDashboard, Users, FolderKanban, Database, Scale, 
  Leaf, ClipboardList, FileText, Search, Library, Settings, RefreshCcw, Plus, Building2, CheckCircle2, XCircle, ChevronDown, UploadCloud, Database as DbIcon, Send, Droplets, Recycle, Users2, GraduationCap
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Label 
} from 'recharts';

const theme = {
  bgApp: '#f8fafc', bgPanel: '#ffffff', bgActive: '#f1f5f9',
  textMain: '#0f172a', textMuted: '#64748b', primary: '#007AFF', // Apple Blue
  secondary: '#E9E9EB', // Apple Gray
  border: '#e2e8f0', shadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  chartGreen: '#34C759', chartBlue: '#007AFF', chartAmber: '#FF9500', chartPurple: '#AF52DE', chartRed: '#FF3B30'
};

const manufacturingTypes = ["Food & Beverage", "Automotive", "Electronics", "Textiles", "Chemicals", "Machinery", "Other"];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const [clients, setClients] = useState([
    { id: 1, name: "Hans GmbH", industry: "Automotive", score: 78, carbon: 192.5 },
    { id: 2, name: "Müller & Co", industry: "Chemicals", score: 62, carbon: 410.2 }
  ]);
  const [selectedClientId, setSelectedClientId] = useState(1);
  const [newClient, setNewClient] = useState({ name: '', industry: manufacturingTypes[0] });
  const [documents, setDocuments] = useState([
    { id: 1, name: 'oracle_dump_2025.xml', size: '12.4 MB', status: 'Verified' },
    { id: 2, name: 'sap_export_q1.xlsx', size: '2.4 MB', status: 'Verified' }
  ]);
  const [materialityData, setMaterialityData] = useState([]);

  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { role: 'pilot', text: 'Hello Fritz! neuronpilot is ready. Check out the expanded Mekk Elek Kft metrics.' }
  ]);
  const chatEndRef = useRef(null);

  const activeClient = clients.find(c => c.id === selectedClientId) || clients[0];

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (activeTab === 'materiality' && materialityData.length === 0) runMateriality();
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeTab, chatHistory]);

  const fetchClients = async () => {
    if (!window.__TAURI_INTERNALS__) return;
    try {
      const data = await invoke('get_enterprise_clients');
      if (data && data.length > 0) setClients(data);
    } catch (err) { console.error(err); }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg = { role: 'user', text: chatInput };
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput('');
    
    setTimeout(async () => {
      try {
        if (window.__TAURI_INTERNALS__) {
          const response = await invoke('ask_neuron_pilot', { input: userMsg.text, clientId: activeClient.id });
          setChatHistory(prev => [...prev, { role: 'pilot', text: response }]);
        } else {
          setChatHistory(prev => [...prev, { role: 'pilot', text: `Consulting neuronpilot brain for ${activeClient.name}...` }]);
        }
      } catch (err) {
        setChatHistory(prev => [...prev, { role: 'pilot', text: `Error: ${err}` }]);
      }
    }, 800);
  };

  const handleFileUpload = (fileName) => {
    setIsProcessing(true);
    setTimeout(async () => {
      try {
        if (window.__TAURI_INTERNALS__) {
          const result = await invoke('process_data_file', { filePath: fileName, clientId: activeClient.id });
          setClients(prev => prev.map(c => c.id === activeClient.id ? { ...c, score: result.esg_score, carbon: result.carbon_footprint } : c));
        }
        setDocuments(prev => [{ id: Date.now(), name: fileName, size: '8.5 MB', status: 'Verified' }, ...prev]);
      } catch (err) {
        console.error(err);
      } finally {
        setIsProcessing(false);
      }
    }, 1500);
  };

  const handleAddClient = async (e) => {
    e.preventDefault();
    if (!newClient.name) return;
    try {
      if (window.__TAURI_INTERNALS__) {
        await invoke('add_client', { name: newClient.name, industry: newClient.industry });
        fetchClients();
      } else {
        const clientObj = { id: Date.now(), name: newClient.name, industry: newClient.industry, score: 45, carbon: 120.0 };
        setClients(prev => [...prev, clientObj]);
      }
      setNewClient({ name: '', industry: manufacturingTypes[0] });
    } catch (err) {
      console.error(err);
    }
  };

  const runMateriality = async () => {
    setIsProcessing(true);
    setTimeout(() => {
      setMaterialityData([
        { topic_id: 'E1', name: 'Climate Change', score: 90, material: true },
        { topic_id: 'E2', name: 'Pollution', score: 40, material: false },
        { topic_id: 'S1', name: 'Own Workforce', score: 75, material: true }
      ]);
      setIsProcessing(false);
    }, 500);
  };

  const kpis = [
    { label: 'ESG Score', value: activeClient.score || 0, color: theme.chartGreen, icon: Scale },
    { label: 'Carbon (t)', value: (activeClient.carbon || 0).toFixed(1), color: theme.chartBlue, icon: Leaf },
    { label: 'Water Usage', value: '1,240 m³', color: theme.chartAmber, icon: Droplets },
    { label: 'Recycling', value: '64%', color: theme.chartPurple, icon: Recycle },
    { label: 'Workforce', value: '342', color: theme.textMain, icon: Users2 },
    { label: 'Gender Pay Gap', value: '4.2%', color: theme.chartRed, icon: Scale },
    { label: 'Training', value: '28h/yr', color: theme.chartBlue, icon: GraduationCap },
    { label: 'Audit Progress', value: '85%', color: theme.chartGreen, icon: ClipboardList }
  ];

  const renderContent = () => {
    switch(activeTab) {
      case 'dashboard':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              {kpis.map(kpi => (
                <div key={kpi.label} style={{ backgroundColor: theme.bgPanel, padding: '20px', borderRadius: '20px', border: `1px solid ${theme.border}`, boxShadow: theme.shadow }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ color: theme.textMuted, fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kpi.label}</div>
                      <kpi.icon size={14} color={theme.textMuted} />
                   </div>
                   <div style={{ fontSize: '28px', fontWeight: '800', color: kpi.color }}>{kpi.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.4fr', gap: '24px', height: '350px' }}>
              <div style={{ backgroundColor: theme.bgPanel, padding: '25px', borderRadius: '28px', border: `1px solid ${theme.border}`, boxShadow: theme.shadow }}>
                <div style={{ marginBottom: '15px', fontWeight: '700', fontSize: '14px' }}>Emission Trend</div>
                <ResponsiveContainer width="100%" height="90%">
                  <AreaChart data={[{m:'Jan', v:100}, {m:'Feb', v:120}, {m:'Mar', v:activeClient.carbon || 150}]}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="m" axisLine={false} tickLine={false} tick={{fontSize: 11}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11}} />
                    <Tooltip /><Area type="monotone" dataKey="v" stroke={theme.primary} fillOpacity={0.1} fill={theme.primary} strokeWidth={4} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div style={{ backgroundColor: theme.bgPanel, padding: '25px', borderRadius: '28px', border: `1px solid ${theme.border}`, boxShadow: theme.shadow }}>
                <div style={{ marginBottom: '15px', fontWeight: '700', fontSize: '14px' }}>Scope Distribution</div>
                <ResponsiveContainer width="100%" height="90%">
                  <PieChart>
                    <Pie data={[{n:'S1', v:25}, {n:'S2', v:20}, {n:'S3', v:55}]} innerRadius={65} outerRadius={85} dataKey="v" stroke="none" label={({n, v}) => `${n}: ${v}%`}>
                      <Cell fill={theme.chartGreen} /><Cell fill={theme.chartBlue} /><Cell fill={theme.chartPurple} />
                      <Label content={({ viewBox: { cx, cy } }) => (
                        <g>
                          <text x={cx} y={cy - 5} textAnchor="middle" verticalAnchor="middle" style={{ fontSize: '20px', fontWeight: '800', fill: theme.textMain }}>{(activeClient.carbon || 0).toFixed(0)}</text>
                          <text x={cx} y={cy + 15} textAnchor="middle" verticalAnchor="middle" style={{ fontSize: '10px', fontWeight: '700', fill: theme.textMuted }}>tCO2e</text>
                        </g>
                      )} />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div style={{ backgroundColor: theme.bgPanel, borderRadius: '24px', border: `1px solid ${theme.border}`, overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: `1px solid ${theme.border}`, fontWeight: '700' }}>Evidence Vault</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {documents.map(doc => (
                    <tr key={doc.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                      <td style={{ padding: '14px 24px', fontSize: '14px' }}><b>{doc.name}</b></td>
                      <td style={{ padding: '14px 24px', textAlign: 'right' }}><span style={{ color: theme.chartGreen, fontSize: '11px', fontWeight: '800' }}>{doc.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'clients':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div style={{ backgroundColor: theme.bgPanel, padding: '32px', borderRadius: '24px', border: `1px solid ${theme.border}`, boxShadow: theme.shadow }}>
              <h3 style={{ margin: '0 0 20px 0', fontWeight: '700' }}>Register New Client</h3>
              <form onSubmit={handleAddClient} style={{ display: 'flex', gap: '24px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}><label style={{ display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '8px' }}>COMPANY NAME</label><input value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} placeholder="Hans GmbH" style={{ width: '100%', padding: '12px', borderRadius: '12px', border: `1px solid ${theme.border}`, outline: 'none' }} /></div>
                <div style={{ flex: 1 }}><label style={{ display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '8px' }}>TYPE</label><select value={newClient.industry} onChange={e => setNewClient({...newClient, industry: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: `1px solid ${theme.border}`, outline: 'none', backgroundColor: 'white' }}>{manufacturingTypes.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <button type="submit" style={{ backgroundColor: theme.primary, color: 'white', padding: '12px 24px', borderRadius: '12px', border: 'none', fontWeight: '600', cursor: 'pointer' }}>Add Client</button>
              </form>
            </div>
            <div style={{ backgroundColor: theme.bgPanel, borderRadius: '24px', border: `1px solid ${theme.border}`, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#f8fafc' }}>
                  <tr><th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px' }}>CLIENT</th><th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '12px' }}>INDUSTRY</th><th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '12px' }}>ACTION</th></tr>
                </thead>
                <tbody>
                  {clients.map(c => (
                    <tr key={c.id} style={{ borderBottom: `1px solid ${theme.border}`, backgroundColor: selectedClientId === c.id ? theme.bgActive : 'transparent' }}>
                      <td style={{ padding: '16px 24px', fontWeight: '600' }}>{c.name}</td>
                      <td style={{ padding: '16px 24px' }}>{c.industry}</td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}><button onClick={() => { setSelectedClientId(c.id); setActiveTab('dashboard'); }} style={{ color: theme.primary, background: 'none', border: 'none', fontWeight: '700', cursor: 'pointer' }}>Select</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'materiality':
        return (
          <div style={{ backgroundColor: theme.bgPanel, borderRadius: '24px', border: `1px solid ${theme.border}`, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#f8fafc' }}>
                <tr><th style={{ padding: '16px 24px', textAlign: 'left' }}>ESRS TOPIC</th><th style={{ padding: '16px 24px', textAlign: 'left' }}>SCORE</th><th style={{ padding: '16px 24px', textAlign: 'left' }}>STATUS</th></tr>
              </thead>
              <tbody>
                {materialityData.map((t, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <td style={{ padding: '16px 24px' }}><b>{t.topic_id}</b> {t.name}</td>
                    <td style={{ padding: '16px 24px' }}>{t.score}/100</td>
                    <td style={{ padding: '16px 24px' }}><span style={{ color: t.material ? theme.chartGreen : theme.textMuted, fontWeight: '800' }}>{t.material ? 'MATERIAL' : 'NOT MATERIAL'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      default:
        return <div style={{ padding: '100px', textAlign: 'center' }}>Module Locked.</div>;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: theme.bgApp, color: theme.textMain, fontFamily: '"Inter", sans-serif', overflow: 'hidden' }}>
      <div style={{ width: '280px', backgroundColor: theme.bgPanel, borderRight: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '32px 24px 12px 24px' }}><img src="/src/assets/targoo-logo.png" alt="targoo" style={{ width: '180px', height: 'auto' }} /></div>
        <div style={{ padding: '10px 24px 12px 24px' }}><select value={selectedClientId} onChange={(e) => setSelectedClientId(Number(e.target.value))} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${theme.border}`, backgroundColor: theme.bgActive, fontWeight: '600', outline: 'none' }}>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div style={{ display: 'flex', flexDirection: 'column', padding: '0 12px', flex: 1, overflowY: 'auto' }}>
          {menuItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', backgroundColor: activeTab === item.id ? theme.bgActive : 'transparent', color: activeTab === item.id ? theme.primary : theme.textMuted, border: 'none', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: activeTab === item.id ? '600' : '500', transition: 'all 0.2s ease', marginBottom: '1px' }}>
              <item.icon size={16} /><span>{item.label}</span>
            </button>
          ))}
        </div>
        <div onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileUpload(e.dataTransfer.files[0]?.name || 'data.xml'); }} style={{ margin: '10px 16px 20px 16px', padding: '16px', borderRadius: '20px', border: `2px dashed ${isDragging ? theme.primary : theme.border}`, backgroundColor: isDragging ? '#f0fdf4' : '#f8fafc', textAlign: 'center' }}>
          <DbIcon size={20} color={theme.textMuted} style={{ marginBottom: '8px', margin: '0 auto' }} /><div style={{ fontSize: '11px', fontWeight: '800', marginBottom: '4px' }}>Enterprise Data Ingestion</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px', marginBottom: '10px' }}>{['SAP', 'ORACLE', 'XML', 'CSV'].map(t => <div key={t} style={{ fontSize: '7px', fontWeight: '900', color: theme.textMuted, backgroundColor: theme.bgActive, padding: '2px 4px', borderRadius: '4px' }}>{t}</div>)}</div>
          <button onClick={() => handleFileUpload('manual.xml')} style={{ width: '100%', padding: '8px', fontSize: '10px', fontWeight: '700', backgroundColor: 'white', border: `1px solid ${theme.border}`, borderRadius: '10px', cursor: 'pointer' }}>Ingest File</button>
        </div>
      </div>
      <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div><h1 style={{ fontSize: '32px', fontWeight: '800', margin: 0 }}>{activeClient.name}</h1><p style={{ color: theme.textMuted }}>{activeTab.toUpperCase()}</p></div>
          {isProcessing && <div style={{ color: theme.chartGreen, fontSize: '13px', fontWeight: '600' }}><RefreshCcw size={14} style={{ animation: 'spin 2s linear infinite' }} /> neuronpilot...</div>}
        </div>
        {renderContent()}
      </div>
      <div style={{ width: '360px', backgroundColor: theme.bgPanel, borderLeft: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '30px 24px', borderBottom: `1px solid ${theme.border}` }}><div style={{ fontWeight: '800', fontSize: '18px', color: theme.textMain }}>CSRD Compass</div><div style={{ color: theme.chartGreen, fontSize: '12px', marginTop: '4px', fontWeight: '600' }}>● neuronpilot active</div></div>
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {chatHistory.map((msg, i) => (
            <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', backgroundColor: msg.role === 'user' ? theme.primary : theme.secondary, color: msg.role === 'user' ? 'white' : theme.textMain, padding: '8px 16px', borderRadius: '20px', maxWidth: '85%', fontSize: '14px', borderBottomRightRadius: msg.role === 'user' ? '4px' : '20px', borderBottomLeftRadius: msg.role === 'pilot' ? '4px' : '20px' }}>{msg.text}</div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <div style={{ padding: '20px', borderTop: `1px solid ${theme.border}`, backgroundColor: '#fff' }}>
          <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: theme.bgActive, padding: '4px 8px 4px 16px', borderRadius: '24px' }}>
            <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Ask neuronpilot..." style={{ flex: 1, border: 'none', background: 'none', padding: '8px 0', fontSize: '14px', outline: 'none', color: theme.textMain }} />
            <button type="submit" style={{ border: 'none', backgroundColor: theme.primary, color: 'white', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Send size={16} /></button>
          </form>
        </div>
      </div>
      <style>{` @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } `}</style>
    </div>
  );
}
