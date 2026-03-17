import React, { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, Users, FolderKanban, Database, Scale, Leaf, ClipboardList, FileText, Search, BookOpen, Settings, Send, ChevronDown } from 'lucide-react';
import logo from './assets/targoo-logo.png';

const S = {
  bg: '#f5f5f7', panel: '#ffffff', border: '#e5e7eb',
  text: '#111827', muted: '#6b7280', accent: '#007aff',
  accentBg: 'rgba(0,122,255,0.08)', green: '#34c759',
  red: '#ff3b30', amber: '#ff9500',
  shadow: '0 1px 3px rgba(0,0,0,0.06)',
  radius: '10px', font: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif'
};

const menuItems = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'clients', icon: Users, label: 'Clients' },
  { id: 'projects', icon: FolderKanban, label: 'Projects' },
  { id: 'data', icon: Database, label: 'Data Import' },
  { id: 'materiality', icon: Scale, label: 'Materiality' },
  { id: 'emissions', icon: Leaf, label: 'Emissions' },
  { id: 'esrs', icon: ClipboardList, label: 'ESRS Status' },
  { id: 'reports', icon: FileText, label: 'Reports' },
  { id: 'audit', icon: Search, label: 'Audit Trail' },
  { id: 'library', icon: BookOpen, label: 'Library' },
  { id: 'settings', icon: Settings, label: 'Settings' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([{ role: 'ai', text: 'Hello! I am your CSRD Compass. How can I help?' }]);
  const [selectedClientId, setSelectedClientId] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [modelDownloading, setModelDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const handleFileUpload = (filename) => {
    const userMsg = { role: 'user', text: `Uploading ${filename}...` };
    setChatHistory(prev => [...prev, userMsg]);
    setTimeout(() => {
      setChatHistory(prev => [...prev, { role: 'ai', text: `File ${filename} received. Processing for Hans GmbH Demo...` }]);
    }, 800);
  };
  
  const clients = [
    { id: 1, name: 'Hans GmbH Demo' },
    { id: 2, name: 'Müller & Co' },
    { id: 3, name: 'Schweizer AG' }
  ];

  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  useEffect(() => {
    if (window.__TAURI_INTERNALS__) {
      const { invoke } = window.__TAURI_INTERNALS__;
      if (invoke) {
        invoke('check_model').then(ready => setModelReady(ready)).catch(() => setModelReady(false));
      }
      const { listen } = window.__TAURI_INTERNALS__;
      if (listen) {
        listen('download_progress', (event) => {
          setDownloadProgress(Math.round(event.payload));
          if (event.payload >= 100) { setModelReady(true); setModelDownloading(false); }
        });
      }
    }
  }, []);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg = { role: 'user', text: chatInput };
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'ai', text: '⏳ Analyzing...' }]);
    try {
      if (window.__TAURI_INTERNALS__?.invoke) {
        const response = await window.__TAURI_INTERNALS__.invoke('ask_ai', { 
          question: userMsg.text, 
          clientId: 1 
        });
        setChatHistory(prev => [...prev.slice(0,-1), { role: 'ai', text: response }]);
      } else {
        setTimeout(() => {
          setChatHistory(prev => [...prev.slice(0,-1), { role: 'ai', text: `ESRS analysis for "${userMsg.text}": This requires disclosure under ESRS E1. Key metrics include Scope 1, 2, and 3 emissions with paragraph-level citations from the EU taxonomy.` }]);
        }, 800);
      }
    } catch (err) {
      setChatHistory(prev => [...prev.slice(0,-1), { role: 'ai', text: `⚠ AI Engine not ready. Please download the model first. Error: ${err}` }]);
    }
  };

  const activeItem = menuItems.find(i => i.id === activeTab);

  return (
    <div style={{
      height: '100vh', width: '100vw', display: 'flex', flexDirection: 'row',
      fontFamily: S.font, background: S.bg, overflow: 'hidden'
    }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { overflow: hidden; -webkit-font-smoothing: antialiased; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {/* SIDEBAR */}
      <aside style={{
        width: '320px', background: S.panel, borderRight: `1px solid ${S.border}`,
        display: 'flex', flexDirection: 'column'
      }}>
        <div style={{ padding: '20px 16px 12px 16px', borderBottom: '1px solid #e5e7eb' }}>
          <img src={logo} alt="Targoo" style={{ width: '140px', height: 'auto', display: 'block', marginBottom: '4px' }} /><div style={{ fontSize: '10px', fontWeight: '700', color: '#6b7280', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>Advisor Engine</div>
          <select value={selectedClientId} onChange={(e) => setSelectedClientId(Number(e.target.value))} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', color: '#111827', fontWeight: '500', fontSize: '13px', cursor: 'pointer' }}>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', padding: '0 8px', marginTop: '12px' }}>
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <NavButton 
                key={item.id} 
                item={item} 
                isActive={isActive} 
                onClick={() => setActiveTab(item.id)} 
              />
            );
          })}
        </nav>

        <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb' }}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileUpload(e.dataTransfer.files[0]?.name || 'data.xml'); }}
        >
          <div
            onClick={() => handleFileUpload('manual.xml')}
            style={{
              padding: '24px 16px',
              borderRadius: '14px',
              border: `2px dashed ${isDragging ? '#007aff' : '#c7d2fe'}`,
              background: isDragging ? 'rgba(0,122,255,0.06)' : 'linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%)',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
              transform: isDragging ? 'scale(1.03)' : 'scale(1)',
              boxShadow: isDragging ? '0 8px 24px rgba(0,122,255,0.15)' : '0 1px 4px rgba(99,102,241,0.08)'
            }}
          >
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: isDragging ? '#007aff' : 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px auto',
              boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
              transition: 'all 0.25s ease'
            }}>
              <Database size={20} color={isDragging ? 'white' : '#007aff'} strokeWidth={1.5} />
            </div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: isDragging ? '#007aff' : '#374151', marginBottom: '4px', transition: 'color 0.2s' }}>
              {isDragging ? 'Release to import' : 'Drop ESG files here'}
            </div>
            <div style={{ fontSize: '10px', color: '#6b7280', lineHeight: '1.5' }}>
              SAP · Oracle · CSV · PDF
            </div>
            <div style={{ marginTop: '12px', padding: '6px 14px', borderRadius: '20px', background: isDragging ? 'rgba(255,255,255,0.3)' : 'rgba(0,122,255,0.08)', display: 'inline-block' }}>
              <span style={{ fontSize: '10px', fontWeight: '600', color: '#007aff' }}>Browse files</span>
            </div>
          </div>
        </div>
      </aside>

      {/* CENTER */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{
          height: '52px', background: S.panel, borderBottom: `1px solid ${S.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px'
        }}>
          <div style={{ fontSize: '16px', fontWeight: 600, color: S.text }}>
            {activeItem?.label}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <input 
              placeholder="Search..." 
              style={{
                background: S.bg, border: `1px solid ${S.border}`, borderRadius: '20px',
                padding: '7px 16px', fontSize: '13px', width: '200px', outline: 'none'
              }}
            />
            <div style={{
              width: '32px', height: '32px', background: S.accent, color: 'white',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 700
            }}>
              FR
            </div>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
          <EmptyState tabId={activeTab} />
        </div>
      </main>

      {/* RIGHT PANEL */}
      <aside style={{
        width: '320px', background: S.panel, borderLeft: `1px solid ${S.border}`,
        display: 'flex', flexDirection: 'column'
      }}>
        <header style={{ padding: '20px', borderBottom: `1px solid ${S.border}` }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: S.text }}>CSRD Compass AI</div>
          <div style={{ fontSize: '12px', color: S.muted, marginTop: '2px' }}>Compliance Assistant</div>
          <div style={{ fontSize: '11px', color: S.green, marginTop: '6px' }}>● Online</div>
        </header>

        <div style={{
          flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px'
        }}>
          {!modelReady && (
            <div style={{ background: 'rgba(255,149,0,0.06)', border: '1px solid rgba(255,149,0,0.2)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#ff9500', marginBottom: '6px' }}>⚡ AI Engine Required</div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px', lineHeight: '1.5' }}>
                {modelDownloading ? `Downloading Gemma AI... ${downloadProgress}%` : 'Download the offline AI model to enable ESRS analysis.'}
              </div>
              {modelDownloading && (
                <div style={{ height: '4px', background: '#e5e7eb', borderRadius: '2px', marginBottom: '12px' }}>
                  <div style={{ height: '100%', width: `${downloadProgress}%`, background: '#ff9500', borderRadius: '2px', transition: 'width 0.3s ease' }}/>
                </div>
              )}
              {!modelDownloading && (
                <button
                  type="button"
                  onClick={async () => {
                    if (window.__TAURI_INTERNALS__?.invoke) {
                      setModelDownloading(true);
                      try { await window.__TAURI_INTERNALS__.invoke('download_model'); } catch(e) { setModelDownloading(false); }
                    }
                  }}
                  style={{ background: '#ff9500', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', width: '100%' }}
                >
                  Download AI Model (1.2 GB)
                </button>
              )}
            </div>
          )}
          {chatHistory.map((msg, i) => (
            <div key={i} style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%', padding: '12px', borderRadius: '12px', fontSize: '13px', lineHeight: 1.5,
              background: msg.role === 'user' ? S.accent : S.bg,
              color: msg.role === 'user' ? 'white' : S.text,
              border: msg.role === 'ai' ? `1px solid ${S.border}` : 'none'
            }}>
              {msg.text}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={handleSend} style={{ padding: '16px', borderTop: `1px solid ${S.border}`, position: 'relative' }}>
          <input 
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Type a message..."
            style={{
              width: '100%', background: S.bg, border: `1px solid ${S.border}`,
              borderRadius: '20px', padding: '10px 44px 10px 16px', fontSize: '13px', outline: 'none'
            }}
          />
          <button 
            type="submit"
            style={{
              position: 'absolute', right: '24px', top: '50%', transform: 'translateY(-50%)',
              width: '30px', height: '30px', background: S.accent, borderRadius: '50%',
              border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'white'
            }}
          >
            <Send size={14} />
          </button>
        </form>
      </aside>
    </div>
  );
}

function NavButton({ item, isActive, onClick }) {
  const [hover, setHover] = useState(false);
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
        padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
        fontSize: '13px', fontWeight: isActive ? 600 : 500, transition: 'all 0.15s ease',
        marginBottom: '2px',
        background: isActive ? S.accentBg : (hover ? '#f0f0f2' : 'transparent'),
        color: isActive ? S.accent : S.muted
      }}
    >
      <Icon size={16} strokeWidth={1.5} />
      {item.label}
    </button>
  );
}

function EmptyState({ tabId }) {
  const item = menuItems.find(i => i.id === tabId);
  const Icon = item?.icon || LayoutDashboard;

  switch (tabId) {
    case 'dashboard':
      return (
        <div style={{display:'flex',flexDirection:'column',gap:'20px',animation:'fadeIn 0.3s ease'}}>

          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'16px'}}>
            {[
              {label:'ESG Score',value:'74',trend:'+6%',up:true,sub:'Target: 80 by Q4',color:'#007aff',bg:'rgba(0,122,255,0.06)',detail:'↑ 4pts vs last quarter',icon:'◎'},
              {label:'Carbon (t)',value:'198',trend:'+2%',up:false,sub:'Scope 1+2 only',color:'#ff3b30',bg:'rgba(255,59,48,0.06)',detail:'↑ 4t vs last month',icon:'◉'},
              {label:'Energy MWh',value:'420',trend:'-4%',up:true,sub:'vs 438 last year',color:'#34c759',bg:'rgba(52,199,89,0.06)',detail:'↓ 18 MWh saved',icon:'◈'},
              {label:'Workforce',value:'342',trend:'0%',up:null,sub:'12% YoY growth',color:'#ff9500',bg:'rgba(255,149,0,0.06)',detail:'↑ 38 new hires',icon:'◇'},
            ].map((k,i) => {
              const KPICard = ({k}) => {
                const [hov, setHov] = React.useState(false);
                return (
                  <div
                    onMouseEnter={()=>setHov(true)}
                    onMouseLeave={()=>setHov(false)}
                    style={{
                      background: hov ? k.bg : '#fff',
                      borderRadius:'16px',
                      padding:'22px',
                      border: hov ? `1px solid ${k.color}40` : '1px solid #e5e7eb',
                      boxShadow: hov ? `0 8px 32px ${k.color}18, 0 2px 8px rgba(0,0,0,0.06)` : '0 1px 3px rgba(0,0,0,0.06)',
                      transform: hov ? 'translateY(-3px)' : 'translateY(0)',
                      transition:'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                      cursor:'default',
                      position:'relative',
                      overflow:'hidden'
                    }}>
                    <div style={{
                      position:'absolute',top:0,right:0,
                      width:'80px',height:'80px',
                      background:`radial-gradient(circle at top right, ${k.color}10, transparent 70%)`,
                      transition:'opacity 0.3s',
                      opacity: hov ? 1 : 0
                    }}/>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'14px'}}>
                      <div style={{fontSize:'11px',fontWeight:'600',color: hov ? k.color : '#9ca3af',textTransform:'uppercase',letterSpacing:'0.07em',transition:'color 0.2s'}}>{k.label}</div>
                      <span style={{fontSize:'11px',fontWeight:'700',padding:'3px 8px',borderRadius:'20px',color:k.up===true?'#34c759':k.up===false?'#ff3b30':'#9ca3af',background:k.up===true?'rgba(52,199,89,0.1)':k.up===false?'rgba(255,59,48,0.1)':'rgba(156,163,175,0.1)',transition:'all 0.2s'}}>{k.trend}</span>
                    </div>
                    <div style={{fontSize:'42px',fontWeight:'700',color: hov ? k.color : '#111827',letterSpacing:'-2px',lineHeight:1,marginBottom:'10px',transition:'color 0.25s'}}>{k.value}</div>
                    <div style={{fontSize:'11px',color: hov ? k.color+'99' : '#9ca3af',transition:'all 0.2s'}}>{hov ? k.detail : k.sub}</div>
                  </div>
                );
              };
              return <KPICard key={k.label} k={k} />;
            })}
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1.6fr 1fr',gap:'16px'}}>

            <div style={{background:'#fff',borderRadius:'16px',padding:'24px',border:'1px solid #e5e7eb',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
              <div style={{fontSize:'13px',fontWeight:'600',color:'#111827',marginBottom:'2px'}}>CO₂ Emission Trend</div>
              <div style={{fontSize:'11px',color:'#9ca3af',marginBottom:'16px'}}>Jan – Jun 2024 · tCO2e · hover for details</div>
              {(() => {
                const pts = [
                  {x:20,y:100,l:'Jan',v:'248t',m:'Jan 2024'},
                  {x:90,y:72,l:'Feb',v:'231t',m:'Feb 2024'},
                  {x:160,y:85,l:'Mar',v:'219t',m:'Mar 2024'},
                  {x:230,y:55,l:'Apr',v:'205t',m:'Apr 2024'},
                  {x:300,y:38,l:'May',v:'198t',m:'May 2024'},
                  {x:370,y:22,l:'Jun',v:'192t',m:'Jun 2024'},
                ];
                const [hov, setHov] = React.useState(null);
                const smoothD = `M20,100 C55,86 90,72 90,72 C125,79 160,85 160,85 C195,70 230,55 230,55 C265,46 300,38 300,38 C335,30 370,22 370,22`;
                const areaD = smoothD + ' L370,130 L20,130 Z';
                return (
                  <svg width="100%" height="150" viewBox="0 0 400 150" style={{overflow:'visible'}}>
                    <defs>
                      <linearGradient id="co2Grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#007aff" stopOpacity="0.12"/>
                        <stop offset="100%" stopColor="#007aff" stopOpacity="0"/>
                      </linearGradient>
                      <style>{`
                        @keyframes drawCo2 { from{stroke-dashoffset:700} to{stroke-dashoffset:0} }
                        .co2line { stroke-dasharray:700; stroke-dashoffset:700; animation: drawCo2 1.8s cubic-bezier(0.4,0,0.2,1) forwards; }
                      `}</style>
                    </defs>
                    <path d={areaD} fill="url(#co2Grad)"/>
                    <path className="co2line" d={smoothD} fill="none" stroke="#007aff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    {pts.map((p,i)=>(
                      <g key={i} style={{cursor:'pointer'}} onMouseEnter={()=>setHov(p)} onMouseLeave={()=>setHov(null)}>
                        <circle cx={p.x} cy={p.y} r="16" fill="transparent"/>
                        <circle cx={p.x} cy={p.y} r={hov===p?6:4} fill={hov===p?'#007aff':'#007aff'} stroke="#fff" strokeWidth="2" style={{transition:'r 0.15s ease'}}/>
                        <text x={p.x} y="145" textAnchor="middle" fontSize="10" fill="#9ca3af" fontFamily="-apple-system,sans-serif">{p.l}</text>
                      </g>
                    ))}
                    {hov && (
                      <g>
                        <rect x={hov.x > 320 ? hov.x-110 : hov.x-20} y={hov.y-44} width="90" height="36" rx="8" fill="#111827"/>
                        <text x={hov.x > 320 ? hov.x-65 : hov.x+25} y={hov.y-26} textAnchor="middle" fontSize="12" fontWeight="700" fill="white" fontFamily="-apple-system,sans-serif">{hov.v}</text>
                        <text x={hov.x > 320 ? hov.x-65 : hov.x+25} y={hov.y-13} textAnchor="middle" fontSize="10" fill="#9ca3af" fontFamily="-apple-system,sans-serif">{hov.m}</text>
                      </g>
                    )}
                    <line x1="20" y1="10" x2="20" y2="130" stroke="#f3f4f6" strokeWidth="1"/>
                    <text x="14" y="28" textAnchor="end" fontSize="9" fill="#d1d5db" fontFamily="-apple-system,sans-serif">250</text>
                    <text x="14" y="78" textAnchor="end" fontSize="9" fill="#d1d5db" fontFamily="-apple-system,sans-serif">210</text>
                    <text x="14" y="108" textAnchor="end" fontSize="9" fill="#d1d5db" fontFamily="-apple-system,sans-serif">190</text>
                  </svg>
                );
              })()}
            </div>

            <div style={{background:'#fff',borderRadius:'16px',padding:'24px',border:'1px solid #e5e7eb',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
              <div style={{fontSize:'13px',fontWeight:'600',color:'#111827',marginBottom:'4px'}}>Scope Distribution</div>
              <div style={{fontSize:'11px',color:'#9ca3af',marginBottom:'20px'}}>Total: 192.5 tCO2e</div>
              {(() => {
                const scopes = [
                  {label:'Scope 1',val:25,color:'#007aff',desc:'Direct: 48t'},
                  {label:'Scope 2',val:20,color:'#34c759',desc:'Energy: 39t'},
                  {label:'Scope 3',val:55,color:'#af52de',desc:'Chain: 105t'},
                ];
                const [hov, setHov] = React.useState(null);
                const total = 192;
                const r = 52;
                const cx = 100, cy = 70;
                const circ = 2 * Math.PI * r;
                let offset = 0;
                const arcs = scopes.map(s => {
                  const len = (s.val / 100) * circ;
                  const arc = { ...s, dasharray: circ, dashoffset: circ - len, rotate: (offset / circ) * 360 - 90 };
                  offset += len;
                  return arc;
                });
                return (
                  <div>
                    <svg width="100%" height="150" viewBox="0 0 200 150">
                      <defs>
                        <style>{`
                          @keyframes growArc { from{stroke-dashoffset: 327;} to{stroke-dashoffset: var(--target);} }
                        `}</style>
                      </defs>
                      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth="20"/>
                      {arcs.map((a,i)=>(
                        <circle key={i} cx={cx} cy={cy} r={r} fill="none"
                          stroke={hov===i ? a.color : a.color}
                          strokeWidth={hov===i ? 24 : 20}
                          strokeDasharray={a.dasharray}
                          strokeDashoffset={a.dashoffset}
                          strokeLinecap="butt"
                          transform={`rotate(${a.rotate} ${cx} ${cy})`}
                          style={{transition:'stroke-width 0.2s ease, opacity 0.2s ease', opacity: hov!==null && hov!==i ? 0.4 : 1, cursor:'pointer'}}
                          onMouseEnter={()=>setHov(i)}
                          onMouseLeave={()=>setHov(null)}
                        />
                      ))}
                      <text x={cx} y={cy-6} textAnchor="middle" fontSize="18" fontWeight="700" fill="#111827" fontFamily="-apple-system,sans-serif">{hov!==null ? scopes[hov].val+'%' : total+'t'}</text>
                      <text x={cx} y={cy+10} textAnchor="middle" fontSize="10" fill="#9ca3af" fontFamily="-apple-system,sans-serif">{hov!==null ? scopes[hov].desc : 'tCO2e'}</text>
                    </svg>
                    <div style={{display:'flex',justifyContent:'space-around',marginTop:'-8px'}}>
                      {scopes.map((s,i)=>(
                        <div key={i} style={{display:'flex',alignItems:'center',gap:'5px',cursor:'pointer',opacity:hov!==null&&hov!==i?0.4:1,transition:'opacity 0.2s'}}
                          onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(null)}>
                          <div style={{width:'8px',height:'8px',borderRadius:'50%',background:s.color}}/>
                          <span style={{fontSize:'11px',color:'#6b7280',fontWeight:'500'}}>{s.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>

            <div style={{background:'#fff',borderRadius:'16px',padding:'24px',border:'1px solid #e5e7eb',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
              <div style={{fontSize:'13px',fontWeight:'600',color:'#111827',marginBottom:'20px'}}>Audit Readiness</div>
              <div style={{display:'flex',alignItems:'center',gap:'24px'}}>
                <svg width="88" height="88" viewBox="0 0 88 88">
                  <circle cx="44" cy="44" r="36" stroke="#f3f4f6" strokeWidth="8" fill="none"/>
                  <circle cx="44" cy="44" r="36" stroke="#34c759" strokeWidth="8" fill="none"
                    strokeDasharray="226" strokeDashoffset="72" strokeLinecap="round" transform="rotate(-90 44 44)"/>
                  <text x="44" y="48" textAnchor="middle" fill="#111827" fontSize="15" fontWeight="700" fontFamily="-apple-system,sans-serif">68%</text>
                </svg>
                <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                  <div style={{fontSize:'12px',color:'#34c759',fontWeight:'600'}}>✓ Data Validated</div>
                  <div style={{fontSize:'12px',color:'#ff9500',fontWeight:'500'}}>⚠ ESRS E1-5 Pending</div>
                  <div style={{fontSize:'12px',color:'#ff3b30',fontWeight:'500'}}>✗ Scope 3 Missing</div>
                </div>
              </div>
            </div>

            <div style={{background:'#fff',borderRadius:'16px',padding:'24px',border:'1px solid #e5e7eb',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
              <div style={{fontSize:'13px',fontWeight:'600',color:'#111827',marginBottom:'16px'}}>Next Actions</div>
              {[
                {text:'Upload Scope 3 data',p:'High',c:'#ff3b30',b:'rgba(255,59,48,0.08)'},
                {text:'Complete ESRS E1-3',p:'High',c:'#ff3b30',b:'rgba(255,59,48,0.08)'},
                {text:'Water metrics review',p:'Medium',c:'#ff9500',b:'rgba(255,149,0,0.08)'},
              ].map((a,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0',borderBottom:i<2?'1px solid #f3f4f6':'none'}}>
                  <span style={{fontSize:'12px',color:'#374151'}}>{a.text}</span>
                  <span style={{fontSize:'10px',fontWeight:'700',color:a.c,background:a.b,padding:'2px 8px',borderRadius:'20px',whiteSpace:'nowrap',marginLeft:'8px'}}>{a.p}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{background:'#fff',borderRadius:'16px',border:'1px solid #e5e7eb',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',overflow:'hidden'}}>
            <div style={{padding:'16px 20px',borderBottom:'1px solid #e5e7eb',fontSize:'13px',fontWeight:'600',color:'#111827'}}>ESRS Compliance Overview</div>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <tbody>
                {[
                  {id:'E1',name:'Climate Change',status:'Partial',sc:'#ff9500',sb:'rgba(255,149,0,0.08)'},
                  {id:'E2',name:'Pollution',status:'Complete',sc:'#34c759',sb:'rgba(52,199,89,0.08)'},
                  {id:'E3',name:'Water & Marine',status:'Missing',sc:'#ff3b30',sb:'rgba(255,59,48,0.08)'},
                  {id:'S1',name:'Own Workforce',status:'Partial',sc:'#ff9500',sb:'rgba(255,149,0,0.08)'},
                  {id:'G1',name:'Business Conduct',status:'Complete',sc:'#34c759',sb:'rgba(52,199,89,0.08)'},
                ].map((r,i,a)=>(
                  <tr key={r.id} style={{borderBottom:i<a.length-1?'1px solid #f3f4f6':'none',transition:'background 0.15s'}}
                    onMouseEnter={e=>e.currentTarget.style.background='#f9fafb'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{padding:'12px 20px',width:'48px',fontSize:'12px',fontWeight:'700',color:'#6b7280'}}>{r.id}</td>
                    <td style={{padding:'13px 20px',fontSize:'13px',color:'#111827'}}>{r.name}</td>
                    <td style={{padding:'12px 20px',textAlign:'right'}}>
                      <span style={{fontSize:'11px',fontWeight:'600',color:r.sc,background:r.sb,padding:'3px 10px',borderRadius:'20px'}}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      );

    case 'clients':
      return (
        <div style={{display:'flex',flexDirection:'column',gap:'20px',animation:'fadeIn 0.3s ease'}}>
          <div style={{background:'#fff',borderRadius:'12px',padding:'24px',border:'1px solid #e5e7eb',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
            <div style={{fontSize:'13px',fontWeight:'600',color:'#111827',marginBottom:'16px'}}>Register New Client</div>
            <div style={{display:'flex',gap:'12px'}}>
              <input placeholder="Company name" style={{flex:1,padding:'9px 14px',borderRadius:'8px',border:'1px solid #e5e7eb',fontSize:'13px',color:'#111827',background:'#f5f5f7',outline:'none'}}/>
              <select style={{flex:1,padding:'9px 14px',borderRadius:'8px',border:'1px solid #e5e7eb',fontSize:'13px',color:'#111827',background:'#f5f5f7',outline:'none'}}>
                {['Automotive','Chemicals','Electronics','Food & Beverage','Machinery'].map(i=><option key={i}>{i}</option>)}
              </select>
              <button style={{background:'#007aff',color:'white',border:'none',padding:'9px 20px',borderRadius:'8px',fontSize:'13px',fontWeight:'600',cursor:'pointer'}}>Add Client</button>
            </div>
          </div>
          <div style={{background:'#fff',borderRadius:'12px',border:'1px solid #e5e7eb',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{borderBottom:'1px solid #e5e7eb',background:'#f9fafb'}}>
                  <th style={{padding:'12px 20px',textAlign:'left',fontSize:'11px',fontWeight:'600',color:'#6b7280'}}>CLIENT</th>
                  <th style={{padding:'12px 20px',textAlign:'left',fontSize:'11px',fontWeight:'600',color:'#6b7280'}}>INDUSTRY</th>
                  <th style={{padding:'12px 20px',textAlign:'left',fontSize:'11px',fontWeight:'600',color:'#6b7280'}}>ESG SCORE</th>
                  <th style={{padding:'12px 20px',textAlign:'right',fontSize:'11px',fontWeight:'600',color:'#6b7280'}}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {[{n:'Hans GmbH Demo',i:'Automotive',s:74},{n:'Müller & Co',i:'Chemicals',s:62},{n:'Schweizer AG',i:'Electronics',s:81}].map((c,idx)=>(
                  <tr key={idx} style={{borderBottom:'1px solid #f3f4f6',transition:'background 0.15s'}}
                    onMouseEnter={e=>e.currentTarget.style.background='#f9fafb'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{padding:'14px 20px',fontSize:'13px',fontWeight:'600',color:'#111827'}}>{c.n}</td>
                    <td style={{padding:'14px 20px',fontSize:'13px',color:'#6b7280'}}>{c.i}</td>
                    <td style={{padding:'14px 20px'}}>
                      <span style={{fontSize:'13px',fontWeight:'600',color:c.s>=75?'#34c759':c.s>=60?'#ff9500':'#ff3b30'}}>{c.s}</span>
                    </td>
                    <td style={{padding:'14px 20px',textAlign:'right'}}>
                      <button style={{background:'none',border:'none',color:'#007aff',fontSize:'13px',fontWeight:'600',cursor:'pointer'}}>View →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );

    case 'data':
      return (
        <div style={{display:'flex',flexDirection:'column',gap:'20px',animation:'fadeIn 0.3s ease'}}>
          <div style={{background:'#fff',borderRadius:'12px',padding:'48px',border:'2px dashed #e5e7eb',textAlign:'center',cursor:'pointer',transition:'all 0.2s ease'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='#007aff';e.currentTarget.style.background='rgba(0,122,255,0.02)'}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='#e5e7eb';e.currentTarget.style.background='#fff'}}>
            <Database size={40} color="#6b7280" strokeWidth={1.2} style={{marginBottom:'16px'}}/>
            <div style={{fontSize:'16px',fontWeight:'600',color:'#111827',marginBottom:'8px'}}>Drop ESG Data Files Here</div>
            <div style={{fontSize:'13px',color:'#6b7280',marginBottom:'20px'}}>SAP exports, Oracle XML, Excel, CSV, PDF supported</div>
            <button style={{background:'#007aff',color:'white',border:'none',padding:'10px 24px',borderRadius:'8px',fontSize:'13px',fontWeight:'600',cursor:'pointer'}}>Browse Files</button>
          </div>
          <div style={{background:'#fff',borderRadius:'12px',border:'1px solid #e5e7eb',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',overflow:'hidden'}}>
            <div style={{padding:'16px 20px',borderBottom:'1px solid #e5e7eb',fontSize:'13px',fontWeight:'600',color:'#111827'}}>Recent Imports</div>
            {[{n:'oracle_dump_2025.xml',s:'12.4 MB',t:'Verified'},{n:'sap_export_q1.xlsx',s:'2.4 MB',t:'Verified'},{n:'employees_2024.csv',s:'0.8 MB',t:'Verified'}].map((f,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 20px',borderBottom:i<2?'1px solid #f3f4f6':'none',transition:'background 0.15s'}}
                onMouseEnter={e=>e.currentTarget.style.background='#f9fafb'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <div>
                  <div style={{fontSize:'13px',fontWeight:'500',color:'#111827'}}>{f.n}</div>
                  <div style={{fontSize:'11px',color:'#6b7280',marginTop:'2px'}}>{f.s}</div>
                </div>
                <span style={{fontSize:'11px',fontWeight:'600',color:'#34c759',background:'rgba(52,199,89,0.08)',padding:'3px 10px',borderRadius:'20px'}}>{f.t}</span>
              </div>
            ))}
          </div>
        </div>
      );

    case 'esrs':
      return (
        <div style={{display:'flex',flexDirection:'column',gap:'20px',animation:'fadeIn 0.3s ease'}}>
          <div style={{background:'#fff',borderRadius:'12px',border:'1px solid #e5e7eb',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',overflow:'hidden'}}>
            <div style={{padding:'16px 20px',borderBottom:'1px solid #e5e7eb',fontSize:'13px',fontWeight:'600',color:'#111827'}}>ESRS Compliance Tracker</div>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{background:'#f9fafb',borderBottom:'1px solid #e5e7eb'}}>
                  <th style={{padding:'11px 20px',textAlign:'left',fontSize:'11px',fontWeight:'600',color:'#6b7280'}}>STANDARD</th>
                  <th style={{padding:'11px 20px',textAlign:'left',fontSize:'11px',fontWeight:'600',color:'#6b7280'}}>TOPIC</th>
                  <th style={{padding:'11px 20px',textAlign:'left',fontSize:'11px',fontWeight:'600',color:'#6b7280'}}>STATUS</th>
                  <th style={{padding:'11px 20px',textAlign:'right',fontSize:'11px',fontWeight:'600',color:'#6b7280'}}>GAP</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {id:'E1',t:'Climate Change',s:'Partial',g:true,sc:'#ff9500',sb:'rgba(255,149,0,0.08)'},
                  {id:'E2',t:'Pollution',s:'Complete',g:false,sc:'#34c759',sb:'rgba(52,199,89,0.08)'},
                  {id:'E3',t:'Water & Marine',s:'Missing',g:true,sc:'#ff3b30',sb:'rgba(255,59,48,0.08)'},
                  {id:'S1',t:'Own Workforce',s:'Partial',g:true,sc:'#ff9500',sb:'rgba(255,149,0,0.08)'},
                  {id:'S2',t:'Workers in Value Chain',s:'Missing',g:true,sc:'#ff3b30',sb:'rgba(255,59,48,0.08)'},
                  {id:'G1',t:'Business Conduct',s:'Complete',g:false,sc:'#34c759',sb:'rgba(52,199,89,0.08)'},
                ].map((r,i)=>(
                  <tr key={i} style={{borderBottom:'1px solid #f3f4f6',transition:'background 0.15s'}}
                    onMouseEnter={e=>e.currentTarget.style.background='#f9fafb'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{padding:'13px 20px',fontSize:'13px',fontWeight:'700',color:'#111827'}}>{r.id}</td>
                    <td style={{padding:'13px 20px',fontSize:'13px',color:'#111827'}}>{r.t}</td>
                    <td style={{padding:'13px 20px'}}><span style={{fontSize:'11px',fontWeight:'600',color:r.sc,background:r.sb,padding:'3px 10px',borderRadius:'20px'}}>{r.s}</span></td>
                    <td style={{padding:'13px 20px',textAlign:'right',fontSize:'13px',fontWeight:'600',color:r.g?'#ff3b30':'#34c759'}}>{r.g?'⚠ Yes':'✓ No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );

    case 'emissions':
      return (
        <div style={{display:'flex',flexDirection:'column',gap:'20px',animation:'fadeIn 0.3s ease'}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'16px'}}>
            {[{l:'Scope 1',v:'48.2t',d:'Direct emissions',c:'#34c759'},{l:'Scope 2',v:'39.1t',d:'Purchased energy',c:'#007aff'},{l:'Scope 3',v:'105.2t',d:'Value chain',c:'#af52de'}].map(s=>(
              <div key={s.l} style={{background:'#fff',borderRadius:'12px',padding:'24px',border:'1px solid #e5e7eb',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
                <div style={{fontSize:'12px',fontWeight:'500',color:'#6b7280',marginBottom:'8px'}}>{s.l}</div>
                <div style={{fontSize:'32px',fontWeight:'600',color:s.c,letterSpacing:'-1px',marginBottom:'4px'}}>{s.v}</div>
                <div style={{fontSize:'11px',color:'#6b7280'}}>{s.d}</div>
              </div>
            ))}
          </div>
          <div style={{background:'#fff',borderRadius:'12px',padding:'24px',border:'1px solid #e5e7eb',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
            <div style={{fontSize:'13px',fontWeight:'600',color:'#111827',marginBottom:'20px'}}>Emissions Breakdown</div>
            {[{l:'Energy',v:65,c:'#34c759'},{l:'Transport',v:45,c:'#007aff'},{l:'Supply Chain',v:80,c:'#af52de'},{l:'Waste',v:20,c:'#ff9500'}].map(b=>(
              <div key={b.l} style={{marginBottom:'16px'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}>
                  <span style={{fontSize:'13px',color:'#111827',fontWeight:'500'}}>{b.l}</span>
                  <span style={{fontSize:'12px',color:'#6b7280'}}>{b.v}t CO2e</span>
                </div>
                <div style={{height:'6px',background:'#f3f4f6',borderRadius:'3px',overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${(b.v/100)*100}%`,background:b.c,borderRadius:'3px',transition:'width 0.8s ease'}}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case 'reports':
      return (
        <div style={{display:'flex',flexDirection:'column',gap:'20px',animation:'fadeIn 0.3s ease'}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'16px'}}>
            {[{title:'CSRD Draft Report',desc:'Full ESRS disclosure draft',icon:'📄',ready:true},{title:'Management Summary',desc:'Executive overview PDF',icon:'📊',ready:true},{title:'Gap Analysis Report',desc:'Compliance gap details',icon:'🔍',ready:false}].map(r=>(
              <div key={r.title} style={{background:'#fff',borderRadius:'12px',padding:'24px',border:'1px solid #e5e7eb',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',transition:'all 0.2s ease'}}
                onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)';e.currentTarget.style.transform='translateY(-1px)'}}
                onMouseLeave={e=>{e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,0.06)';e.currentTarget.style.transform='translateY(0)'}}>
                <div style={{fontSize:'28px',marginBottom:'14px'}}>{r.icon}</div>
                <div style={{fontSize:'14px',fontWeight:'600',color:'#111827',marginBottom:'6px'}}>{r.title}</div>
                <div style={{fontSize:'12px',color:'#6b7280',marginBottom:'20px'}}>{r.desc}</div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:'11px',fontWeight:'600',color:r.ready?'#34c759':'#ff9500',background:r.ready?'rgba(52,199,89,0.08)':'rgba(255,149,0,0.08)',padding:'3px 10px',borderRadius:'20px'}}>{r.ready?'Ready':'Pending'}</span>
                  <button style={{background:r.ready?'#007aff':'#e5e7eb',color:r.ready?'white':'#6b7280',border:'none',padding:'7px 16px',borderRadius:'7px',fontSize:'12px',fontWeight:'600',cursor:r.ready?'pointer':'default'}}>Generate</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{background:'#fff',borderRadius:'12px',padding:'20px 24px',border:'1px solid #e5e7eb',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',display:'flex',alignItems:'center',gap:'12px',flexWrap:'wrap'}}>
            <span style={{fontSize:'13px',fontWeight:'500',color:'#6b7280'}}>Language:</span>
            {['German','English'].map(l=><button key={l} style={{padding:'7px 16px',borderRadius:'7px',border:'1px solid #e5e7eb',background:'#f5f5f7',color:'#111827',fontSize:'13px',fontWeight:'500',cursor:'pointer'}}>{l}</button>)}
            <span style={{fontSize:'13px',fontWeight:'500',color:'#6b7280',marginLeft:'8px'}}>Format:</span>
            {['PDF','Word .docx'].map(f=><button key={f} style={{padding:'7px 16px',borderRadius:'7px',border:'1px solid #e5e7eb',background:'#f5f5f7',color:'#111827',fontSize:'13px',fontWeight:'500',cursor:'pointer'}}>{f}</button>)}
          </div>
        </div>
      );
  }

  let title = item?.label;
  let text = "This module is currently in calibration. No data found yet.";
  let button = null;

  if (tabId === 'clients') {
    title = "No Clients Yet";
    text = "Add your first ESG client to get started.";
    button = "Add Client";
  } else if (tabId === 'data') {
    title = "Data Import";
    text = "Drop SAP, Oracle, Excel or CSV files to begin.";
    button = "Import Data";
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', gap: '16px'
    }}>
      <Icon size={48} color={S.muted} strokeWidth={1} />
      <h2 style={{ fontSize: '20px', fontWeight: 600, color: S.text, margin: 0 }}>{title}</h2>
      <p style={{ fontSize: '14px', color: S.muted, margin: 0, textAlign: 'center', maxWidth: '320px' }}>
        {text}
      </p>
      {(tabId === 'clients' || tabId === 'data') && (
        <button style={{
          background: S.accent, color: 'white', border: 'none', padding: '10px 24px',
          borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer'
        }}>
          {button}
        </button>
      )}
    </div>
  );
}
