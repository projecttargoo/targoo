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

  const handleSend = (e) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = { role: 'user', text: chatInput };
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput('');

    setTimeout(() => {
      setChatHistory(prev => [...prev, { role: 'ai', text: 'Analyzing your ESG data...' }]);
    }, 600);
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
          <img src={logo} alt="Targoo" style={{ height: '32px', objectFit: 'contain', display: 'block', marginBottom: '12px' }} />
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

        <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb' }}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileUpload(e.dataTransfer.files[0]?.name || 'data.xml'); }}
        >
          <div style={{ padding: '14px', borderRadius: '10px', border: `2px dashed ${isDragging ? '#007aff' : '#e5e7eb'}`, backgroundColor: isDragging ? 'rgba(0,122,255,0.04)' : '#f9fafb', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s ease' }}
            onClick={() => handleFileUpload('manual.xml')}
          >
            <Database size={18} color={isDragging ? '#007aff' : '#6b7280'} strokeWidth={1.5} style={{ marginBottom: '6px' }} />
            <div style={{ fontSize: '11px', fontWeight: '600', color: isDragging ? '#007aff' : '#6b7280' }}>Drop files here</div>
            <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>SAP • Oracle • CSV • PDF</div>
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
        <div style={{display:'flex',flexDirection:'column',gap:'24px',animation:'fadeIn 0.3s ease'}}>

          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'16px'}}>
            {[
              {label:'ESG Score',value:'74',trend:'+6%',up:true,sub:'Target: 80 by Q4'},
              {label:'Carbon (t)',value:'198',trend:'+2%',up:false,sub:'Scope 1+2 only'},
              {label:'Energy MWh',value:'420',trend:'-4%',up:true,sub:'vs 438 last year'},
              {label:'Workforce',value:'342',trend:'0%',up:null,sub:'12% YoY growth'},
            ].map(k=>(
              <div key={k.label} style={{background:'#fff',borderRadius:'12px',padding:'20px',border:'1px solid #e5e7eb',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',transition:'all 0.2s ease',cursor:'default'}}
                onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)';e.currentTarget.style.transform='translateY(-1px)'}}
                onMouseLeave={e=>{e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,0.06)';e.currentTarget.style.transform='translateY(0)'}}>
                <div style={{fontSize:'11px',fontWeight:'500',color:'#6b7280',marginBottom:'10px',textTransform:'uppercase',letterSpacing:'0.05em'}}>{k.label}</div>
                <div style={{fontSize:'36px',fontWeight:'600',color:'#111827',letterSpacing:'-1.5px',lineHeight:1,marginBottom:'12px'}}>{k.value}</div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:'11px',color:'#6b7280'}}>{k.sub}</span>
                  <span style={{fontSize:'11px',fontWeight:'600',padding:'2px 8px',borderRadius:'20px',color:k.up===true?'#34c759':k.up===false?'#ff3b30':'#6b7280',background:k.up===true?'rgba(52,199,89,0.1)':k.up===false?'rgba(255,59,48,0.1)':'rgba(107,114,128,0.1)'}}>{k.trend}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
            <div style={{background:'#fff',borderRadius:'12px',padding:'24px',border:'1px solid #e5e7eb',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
              <div style={{fontSize:'13px',fontWeight:'600',color:'#111827',marginBottom:'20px'}}>Audit Readiness</div>
              <div style={{display:'flex',alignItems:'center',gap:'24px'}}>
                <svg width="88" height="88" viewBox="0 0 88 88">
                  <circle cx="44" cy="44" r="36" stroke="#e5e7eb" strokeWidth="7" fill="none"/>
                  <circle cx="44" cy="44" r="36" stroke="#34c759" strokeWidth="7" fill="none"
                    strokeDasharray="226" strokeDashoffset="72"
                    strokeLinecap="round" transform="rotate(-90 44 44)"/>
                  <text x="44" y="49" textAnchor="middle" fill="#111827" fontSize="16" fontWeight="700" fontFamily="-apple-system,sans-serif">68%</text>
                </svg>
                <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                  <div style={{fontSize:'13px',color:'#34c759',fontWeight:'600'}}>✓ Data Validated</div>
                  <div style={{fontSize:'13px',color:'#ff9500',fontWeight:'500'}}>⚠ ESRS E1-5 Pending</div>
                  <div style={{fontSize:'13px',color:'#ff3b30',fontWeight:'500'}}>✗ Scope 3 Missing</div>
                </div>
              </div>
            </div>

            <div style={{background:'#fff',borderRadius:'12px',padding:'24px',border:'2px dashed #e5e7eb',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'10px',cursor:'pointer',transition:'all 0.2s ease'}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='#007aff';e.currentTarget.style.background='rgba(0,122,255,0.02)'}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='#e5e7eb';e.currentTarget.style.background='#fff'}}>
              <Database size={32} color="#6b7280" strokeWidth={1.2}/>
              <div style={{fontSize:'14px',fontWeight:'600',color:'#111827'}}>Drop SAP / Excel Exports</div>
              <div style={{fontSize:'12px',color:'#6b7280'}}>Automatic ESRS mapping active</div>
              <div style={{display:'flex',gap:'6px',marginTop:'4px'}}>
                {['SAP','Oracle','CSV','PDF'].map(t=>(
                  <span key={t} style={{fontSize:'10px',fontWeight:'600',color:'#6b7280',background:'#f5f5f7',border:'1px solid #e5e7eb',padding:'2px 8px',borderRadius:'4px'}}>{t}</span>
                ))}
              </div>
            </div>
          </div>

          <div style={{background:'#fff',borderRadius:'12px',border:'1px solid #e5e7eb',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',overflow:'hidden'}}>
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
                    <td style={{padding:'13px 20px',width:'48px',fontSize:'12px',fontWeight:'700',color:'#6b7280'}}>{r.id}</td>
                    <td style={{padding:'13px 20px',fontSize:'13px',color:'#111827'}}>{r.name}</td>
                    <td style={{padding:'13px 20px',textAlign:'right'}}>
                      <span style={{fontSize:'11px',fontWeight:'600',color:r.sc,background:r.sb,padding:'3px 10px',borderRadius:'20px'}}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{background:'#fff',borderRadius:'12px',border:'1px solid #e5e7eb',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',overflow:'hidden'}}>
            <div style={{padding:'16px 20px',borderBottom:'1px solid #e5e7eb',fontSize:'13px',fontWeight:'600',color:'#111827'}}>Next Actions</div>
            {[
              {text:'Upload Scope 3 supplier data',p:'High',sc:'#ff3b30',sb:'rgba(255,59,48,0.08)'},
              {text:'Complete ESRS E1-3 disclosure',p:'High',sc:'#ff3b30',sb:'rgba(255,59,48,0.08)'},
              {text:'Review water consumption metrics',p:'Medium',sc:'#ff9500',sb:'rgba(255,149,0,0.08)'},
              {text:'Schedule audit preparation call',p:'Low',sc:'#34c759',sb:'rgba(52,199,89,0.08)'},
            ].map((a,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 20px',borderBottom:i<3?'1px solid #f3f4f6':'none',transition:'background 0.15s'}}
                onMouseEnter={e=>e.currentTarget.style.background='#f9fafb'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <span style={{fontSize:'13px',color:'#111827'}}>{a.text}</span>
                <span style={{fontSize:'11px',fontWeight:'600',color:a.sc,background:a.sb,padding:'3px 10px',borderRadius:'20px',whiteSpace:'nowrap',marginLeft:'16px'}}>{a.p}</span>
              </div>
            ))}
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
