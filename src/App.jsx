import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { demoData } from './demoData';
import { 
  LayoutGrid, 
  BarChart2, 
  FileText, 
  Settings, 
  Search, 
  Plus, 
  MessageSquare, 
  ChevronRight, 
  User, 
  Send,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Zap,
  FileUp,
  File,
  X,
  ArrowUp,
  ArrowDown,
  Clock,
  ChevronLeft,
  Building2,
  Globe2,
  Users
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

// --- Components ---

const Card = ({ children, title, style, id }) => (
  <div id={id} className="premium-card" style={{
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    border: '1px solid #E5E5E5',
    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    transition: 'all 0.3s ease',
    ...style
  }}>
    {title && (
      <h3 style={{ 
        margin: '0 0 16px 0', 
        fontSize: '15px', 
        fontWeight: '600', 
        color: '#1D1D1F' 
      }}>
        {title}
      </h3>
    )}
    {children}
  </div>
);

const Skeleton = ({ width, height, borderRadius = '8px' }) => (
  <div className="skeleton" style={{ width, height, borderRadius, marginBottom: '8px' }} />
);

const CircularProgress = ({ value, animatedValue, size = 160, strokeWidth = 12 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (animatedValue / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#F5F5F7" strokeWidth={strokeWidth} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#007AFF" strokeWidth={strokeWidth} fill="none" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease-out' }} />
      </svg>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '42px', fontWeight: '700', color: '#1D1D1F', letterSpacing: '-1px' }}>{Math.floor(animatedValue)}</span>
        <span style={{ fontSize: '13px', fontWeight: '500', color: '#86868B', marginTop: '-4px' }}>ESG SCORE</span>
      </div>
    </div>
  );
};

const ProgressBar = ({ label, value, color, trend }) => (
  <div style={{ marginBottom: '16px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' }}>
      <span style={{ fontSize: '13px', fontWeight: '500', color: '#1D1D1F' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {trend === 'up' ? <ArrowUp size={12} color="#34C759" /> : <ArrowDown size={12} color="#FF3B30" />}
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#1D1D1F' }}>{value}%</span>
      </div>
    </div>
    <div style={{ width: '100%', height: '8px', backgroundColor: '#F5F5F7', borderRadius: '4px', overflow: 'hidden' }}>
      <div style={{ width: `${value}%`, height: '100%', backgroundColor: color, borderRadius: '4px', transition: 'width 1.5s ease-in-out' }} />
    </div>
  </div>
);

const StatusBadge = ({ status }) => {
  const colors = { green: { bg: '#E1F7E3', dot: '#34C759' }, yellow: { bg: '#FFF4D6', dot: '#FF9F0A' }, red: { bg: '#FFEBEB', dot: '#FF3B30' } };
  const c = colors[status] || colors.yellow;
  return (
    <div style={{ backgroundColor: c.bg, height: '24px', padding: '0 10px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(0,0,0,0.02)' }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: c.dot }} />
      <span style={{ fontSize: '11px', fontWeight: '600', color: '#1D1D1F', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{status}</span>
    </div>
  );
};

// --- Main App Component ---

export default function App() {
  const [activeNav, setActiveNav] = useState('dashboard');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatHistory] = useState(demoData.aiHistory);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [gapData, setGapData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportPath, setReportPath] = useState(null);
  const [license, setLicense] = useState(demoData.license);
  const [isDragActive, setIsDragActive] = useState(false);
  const [droppedFile, setDroppedFile] = useState(null);
  const [animatedScore, setAnimatedScore] = useState(0);
  const [tourStep, setTourStep] = useState(0);
  
  // Onboarding State
  const [clients, setClients] = useState([]);
  const [onboardingStep, setOnboardingStep] = useState(0); // 0: none, 1-3: steps
  const [newClient, setNewClient] = useState({ name: '', industry: 'Manufacturing', country: 'DE', employees: '51-200' });
  const [onboardingProgress, setOnboardingProgress] = useState(0);

  useEffect(() => {
    checkLicenseStatus();
    
    const savedClients = localStorage.getItem('targoo_clients');
    if (savedClients) {
      setClients(JSON.parse(savedClients));
    } else {
      // If no clients, wait for demo tour to finish then show onboarding
      if (localStorage.getItem('demo_completed') === 'true') {
        setOnboardingStep(1);
      }
    }

    if (!localStorage.getItem('demo_completed')) {
      startTour();
    }

    const target = demoData.scores.total;
    let current = 0;
    const interval = setInterval(() => {
      if (current >= target) { clearInterval(interval); }
      else { current += 1; setAnimatedScore(current); }
    }, 20);
    return () => clearInterval(interval);
  }, []);

  const startTour = () => {
    setTourStep(1);
    setTimeout(() => { setTourStep(2); setActiveNav('gap analysis'); }, 3000);
    setTimeout(() => { setTourStep(3); }, 12000);
    setTimeout(() => { setTourStep(4); }, 20000);
    setTimeout(() => { setTourStep(5); }, 28000);
    setTimeout(() => { 
      setTourStep(0); 
      localStorage.setItem('demo_completed', 'true');
      if (clients.length === 0) setOnboardingStep(1);
    }, 35000);
  };

  const skipTour = () => {
    setTourStep(0);
    localStorage.setItem('demo_completed', 'true');
    if (clients.length === 0) setOnboardingStep(1);
  };

  const checkLicenseStatus = async () => {
    try {
      const response = await invoke('get_license_state');
      setLicense(JSON.parse(response));
    } catch (e) {}
  };

  const runGapAnalysis = async () => {
    setIsLoading(true);
    try {
      const response = await invoke('gap_analysis', { input: { company_size: newClient.employees, sector: newClient.industry, country: newClient.country } });
      const parsed = JSON.parse(response);
      const topics = Object.entries(parsed.topics).map(([name, status], idx) => ({
        id: `E${idx + 1}`, name, status, action: "Analysis pending", hours: 0
      }));
      setGapData(topics);
    } catch (e) {
      setGapData(demoData.gapMatrix); // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  const handleOnboardingContinue = () => {
    if (onboardingStep === 1) {
      if (!newClient.name) return;
      setOnboardingStep(2);
    } else if (onboardingStep === 2) {
      setOnboardingStep(3);
      startOnboardingAnalysis();
    }
  };

  const startOnboardingAnalysis = () => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += 2;
      setOnboardingProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        finishOnboarding();
      }
    }, 50);
  };

  const finishOnboarding = () => {
    const client = { ...newClient, status: 'Active', lastUpdated: 'Just now' };
    const updatedClients = [client];
    setClients(updatedClients);
    localStorage.setItem('targoo_clients', JSON.stringify(updatedClients));
    runGapAnalysis();
    setTimeout(() => setOnboardingStep(0), 500);
  };

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    const userMessage = { id: Date.now(), sender: 'user', text: chatInput };
    setChatHistory(prev => [...prev, userMessage]);
    const input = chatInput; setChatInput(''); setIsAiTyping(true);
    try {
      const response = await invoke('ask_ai', { question: input });
      const parts = response.split('---');
      setChatHistory(prev => [...prev, { id: Date.now()+1, sender: 'ai', text: parts[0].trim(), citations: parts[1]?.trim() || '' }]);
    } catch (e) {
      setChatHistory(prev => [...prev, { id: Date.now()+1, sender: 'ai', text: "Error processing request." }]);
    } finally { setIsAiTyping(false); }
  };

  const s = {
    layout: { display: 'grid', gridTemplateColumns: '240px 1fr 320px', height: '100vh', width: '100vw', fontFamily: '-apple-system, sans-serif', backgroundColor: '#FFFFFF', overflow: 'hidden' },
    sidebar: { backgroundColor: '#F5F5F7', borderRight: '1px solid #E5E5E5', display: 'flex', flexDirection: 'column', padding: '20px 16px' },
    center: { backgroundColor: '#FFFFFF', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    centerContent: { flex: 1, overflowY: 'auto', padding: '32px', display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px', alignContent: 'start' },
    rightPanel: { backgroundColor: '#FFFFFF', borderLeft: '1px solid #E5E5E5', display: 'flex', flexDirection: 'column' },
    navItem: (isActive) => ({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: isActive ? '600' : '400', color: isActive ? '#1D1D1F' : '#424245', backgroundColor: isActive ? 'rgba(0,0,0,0.05)' : 'transparent', marginBottom: '4px', transition: 'all 0.2s ease' }),
    header: { height: '72px', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', background: 'linear-gradient(to bottom, #FFFFFF, #F8F8F8)', position: 'sticky', top: 0, zIndex: 10 },
    onboardingModal: { position: 'fixed', inset: 0, backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', zIndex: 10010, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    onboardingBox: { width: '480px', backgroundColor: '#FFFFFF', borderRadius: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.1)', padding: '40px', textAlign: 'center', animation: 'fadeInScale 0.5s ease-out' }
  };

  const activeClient = clients[0] || demoData.company;

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      
      {/* Onboarding Flow */}
      {onboardingStep > 0 && (
        <div style={s.onboardingModal}>
          <div style={s.onboardingBox}>
            <div style={{ width: '56px', height: '56px', background: 'linear-gradient(135deg, #1A5C3A, #2E7D32)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '28px', margin: '0 auto 24px' }}>t</div>
            
            {onboardingStep === 1 && (
              <div className="onboarding-step">
                <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#1D1D1F', marginBottom: '8px' }}>Add your first client</h2>
                <p style={{ fontSize: '15px', color: '#86868B', marginBottom: '32px' }}>Let's set up the advisor engine for your project.</p>
                
                <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="input-group">
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#1D1D1F', marginBottom: '6px' }}>Company Name</label>
                    <div style={{ position: 'relative' }}>
                      <Building2 size={16} color="#86868B" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                      <input type="text" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} placeholder="e.g. Müller GmbH" style={{ width: '100%', height: '40px', padding: '0 12px 0 40px', borderRadius: '10px', border: '1px solid #E5E5E5', fontSize: '14px', outline: 'none' }} />
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#1D1D1F', marginBottom: '6px' }}>Industry</label>
                      <select value={newClient.industry} onChange={e => setNewClient({...newClient, industry: e.target.value})} style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '10px', border: '1px solid #E5E5E5', fontSize: '14px', outline: 'none', backgroundColor: 'white' }}>
                        {['Manufacturing', 'Food', 'Energy', 'Transport', 'Agriculture', 'Other'].map(i => <option key={i}>{i}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#1D1D1F', marginBottom: '6px' }}>Country</label>
                      <select value={newClient.country} onChange={e => setNewClient({...newClient, country: e.target.value})} style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '10px', border: '1px solid #E5E5E5', fontSize: '14px', outline: 'none', backgroundColor: 'white' }}>
                        {['DE', 'AT', 'CH', 'NL', 'UK', 'US'].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#1D1D1F', marginBottom: '6px' }}>Employee Count</label>
                    <select value={newClient.employees} onChange={e => setNewClient({...newClient, employees: e.target.value})} style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '10px', border: '1px solid #E5E5E5', fontSize: '14px', outline: 'none', backgroundColor: 'white' }}>
                      {['1-50', '51-200', '201-500', '500+'].map(e => <option key={e}>{e}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {onboardingStep === 2 && (
              <div className="onboarding-step">
                <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#1D1D1F', marginBottom: '8px' }}>Upload ESG data</h2>
                <p style={{ fontSize: '15px', color: '#86868B', marginBottom: '32px' }}>Import energy, waste or social metrics to start analysis.</p>
                <div style={{ height: '160px', border: '2px dashed #E5E5E5', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9F9FB', marginBottom: '24px' }}>
                  <FileUp size={32} color="#007AFF" style={{ marginBottom: '12px' }} />
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#1D1D1F' }}>Drop Excel, CSV or PDF here</span>
                  <span style={{ fontSize: '11px', color: '#86868B', marginTop: '4px' }}>Max size: 25MB</span>
                </div>
                <button onClick={() => setOnboardingStep(3)} style={{ border: 'none', background: 'none', color: '#007AFF', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Skip for now</button>
              </div>
            )}

            {onboardingStep === 3 && (
              <div className="onboarding-step">
                <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#1D1D1F', marginBottom: '8px' }}>Running gap analysis</h2>
                <p style={{ fontSize: '15px', color: '#86868B', marginBottom: '40px' }}>Our L2 engine is mapping ESRS topics to {newClient.name}.</p>
                <div style={{ width: '100%', height: '8px', backgroundColor: '#F5F5F7', borderRadius: '4px', overflow: 'hidden', marginBottom: '12px' }}>
                  <div style={{ width: `${onboardingProgress}%`, height: '100%', backgroundColor: '#34C759', transition: 'width 0.1s linear' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '600', color: '#86868B', textTransform: 'uppercase' }}>
                  <span>{onboardingProgress}% Complete</span>
                  <span>Mapping ESRS E1-G1</span>
                </div>
              </div>
            )}

            <div style={{ marginTop: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button disabled={onboardingStep === 3} onClick={() => onboardingStep > 1 && setOnboardingStep(onboardingStep-1)} style={{ visibility: onboardingStep === 1 ? 'hidden' : 'visible', display: 'flex', alignItems: 'center', gap: '6px', border: 'none', background: 'none', color: '#86868B', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}><ChevronLeft size={18} /> Back</button>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[1,2,3].map(i => <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: onboardingStep === i ? '#007AFF' : '#E5E5E5', transition: 'all 0.3s ease' }} />)}
              </div>
              <button disabled={onboardingStep === 3} onClick={handleOnboardingContinue} style={{ backgroundColor: '#34C759', color: 'white', border: 'none', borderRadius: '12px', padding: '10px 24px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(52,199,89,0.2)' }}>{onboardingStep === 2 ? 'Start Analysis' : 'Continue'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Tour Overlays */}
      {tourStep > 0 && (
        <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 10005 }}>
          <button onClick={skipTour} style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '20px', padding: '6px 16px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', backdropFilter: 'blur(10px)' }}>Skip Tour</button>
        </div>
      )}
      {tourStep === 1 && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(5px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', animation: 'fadeInScale 0.8s ease-out' }}>
            <div style={{ width: '80px', height: '80px', background: 'linear-gradient(135deg, #1A5C3A, #2E7D32)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '40px', margin: '0 auto 24px' }}>t</div>
            <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#1D1D1F', marginBottom: '12px' }}>Welcome to targoo advisor engine</h2>
            <p style={{ fontSize: '17px', color: '#86868B' }}>Müller GmbH demo environment is ready.</p>
          </div>
        </div>
      )}

      {/* Main UI */}
      <div style={s.layout}>
        <aside style={s.sidebar}>
          <div style={{ padding: '0 12px 24px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', background: 'linear-gradient(135deg, #1A5C3A, #2E7D32)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '16px' }}>t</div>
            <span style={{ fontSize: '15px', fontWeight: '600', color: '#1D1D1F' }}>targoo</span>
          </div>
          <nav style={{ marginBottom: '32px' }}>
            {['Dashboard', 'Gap Analysis', 'Reports', 'Settings'].map((item) => {
              const key = item.toLowerCase();
              const isActive = activeNav === key;
              const Icon = key === 'dashboard' ? LayoutGrid : key.includes('gap') ? BarChart2 : key.includes('rep') ? FileText : Settings;
              return (
                <div key={item} style={{ ...s.navItem(isActive), position: 'relative', ...(key === 'gap analysis' && tourStep === 2 ? { boxShadow: '0 0 0 4px #34C759', animation: 'pulse-ring 2s infinite' } : {}) }} onClick={() => setActiveNav(key)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Icon size={18} strokeWidth={2} style={{ opacity: isActive ? 1 : 0.7 }} />
                    {item}
                  </div>
                  {key === 'gap analysis' && tourStep === 2 && <div className="tour-tooltip" style={{ left: '100%', marginLeft: '20px', width: '180px' }}>Gap Analysis in 8 seconds</div>}
                </div>
              );
            })}
          </nav>
          <div style={{ padding: '0 12px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '600', color: '#86868B', textTransform: 'uppercase' }}>Clients</span>
            <Plus size={14} color="#86868B" style={{ cursor: 'pointer' }} onClick={() => setOnboardingStep(1)} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {clients.map(client => (
              <div key={client.name} style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#FFFFFF', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', marginBottom: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} className="premium-sidebar-item">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#34C759' }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#1D1D1F' }}>{client.name}</div>
                    <div style={{ fontSize: '11px', color: '#86868B' }}>{client.industry}</div>
                  </div>
                </div>
                <ChevronRight size={14} color="#C7C7CC" />
              </div>
            ))}
            {clients.length === 0 && (
              <div onClick={() => setOnboardingStep(1)} style={{ padding: '12px', borderRadius: '12px', border: '1px dashed #C7C7CC', textAlign: 'center', cursor: 'pointer', fontSize: '12px', color: '#86868B' }}>+ Add Client</div>
            )}
          </div>
        </aside>

        <main style={s.center}>
          <header style={s.header}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#1D1D1F', margin: 0 }}>{activeClient.name}</h1>
                <span style={{ backgroundColor: '#E1F7E3', color: '#34C759', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px' }}>{activeClient.status || 'DEMO'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <Clock size={12} color="#86868B" />
                <span style={{ fontSize: '11px', color: '#86868B' }}>Last updated: {activeClient.lastUpdated || 'Today, 10:42 AM'}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {(isLoading || isGeneratingReport) && <Loader2 className="animate-spin text-blue-500" size={20} />}
              <div style={{ position: 'relative' }}>
                <Search size={16} color="#86868B" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input type="text" placeholder="Search metrics..." style={{ height: '36px', width: '280px', padding: '0 12px 0 34px', borderRadius: '10px', border: '1px solid #E5E5E5', fontSize: '13px', outline: 'none' }} />
              </div>
            </div>
          </header>

          <div style={s.centerContent}>
            {activeNav === 'dashboard' && (
              <>
                <div style={{ gridColumn: 'span 4' }}>
                  <Card title="Overall ESG Score" style={{ height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                    <CircularProgress value={demoData.scores.total} animatedValue={animatedScore} />
                  </Card>
                </div>
                <div style={{ gridColumn: 'span 8' }}>
                  <Card title="Pillar Performance">
                    <ProgressBar label="Environmental" value={demoData.scores.environmental} color="#34C759" trend="up" />
                    <ProgressBar label="Social" value={demoData.scores.social} color="#007AFF" trend="down" />
                    <ProgressBar label="Governance" value={demoData.scores.governance} color="#AF52DE" trend="up" />
                  </Card>
                </div>
              </>
            )}

            <div style={{ gridColumn: 'span 12' }}>
              <Card title="ESRS Gap Analysis Matrix" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E5E5E5', backgroundColor: '#FAFAFA' }}>
                      <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#86868B', textTransform: 'uppercase' }}>ID</th>
                      <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#86868B', textTransform: 'uppercase' }}>Topic</th>
                      <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#86868B', textTransform: 'uppercase' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gapData.length === 0 ? (
                      [1,2,3,4].map(i => <tr key={i}><td><Skeleton width="100%" height="24px" /></td></tr>)
                    ) : (
                      gapData.map(topic => (
                        <tr key={topic.id} style={{ borderBottom: '1px solid #F5F5F7' }} className="premium-row">
                          <td style={{ padding: '16px 24px', fontSize: '13px', color: '#86868B' }}>{topic.id}</td>
                          <td style={{ padding: '16px 24px', fontSize: '13px', color: '#1D1D1F', fontWeight: '500' }}>{topic.name}</td>
                          <td style={{ padding: '16px 24px' }}><StatusBadge status={topic.status} /></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </Card>
            </div>
          </div>
        </main>

        <aside style={s.rightPanel}>
          <div style={{ height: '72px', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', padding: '0 20px', background: 'linear-gradient(to bottom, #FFFFFF, #F8F8F8)' }}>
            <MessageSquare size={18} color="#1D1D1F" style={{ marginRight: '10px' }} />
            <span style={{ fontSize: '15px', fontWeight: '700', color: '#1D1D1F' }}>Advisor AI</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#FAFAFA' }}>
            {chatMessages.map(msg => (
              <div key={msg.id} style={{ alignSelf: msg.sender === 'ai' ? 'flex-start' : 'flex-end', maxWidth: '90%', backgroundColor: msg.sender === 'ai' ? '#FFFFFF' : '#007AFF', color: msg.sender === 'ai' ? '#1D1D1F' : '#FFFFFF', padding: '12px 16px', borderRadius: '16px', borderTopLeftRadius: msg.sender === 'ai' ? '4px' : '16px', border: msg.sender === 'ai' ? '1px solid #E5E5E5' : 'none', borderLeft: msg.sender === 'ai' ? '4px solid #34C759' : 'none', fontSize: '13px', lineHeight: '1.5' }}>{msg.text}</div>
            ))}
          </div>
          <div style={{ padding: '20px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E5E5E5' }}>
            <div style={{ position: 'relative' }}>
              <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendChat()} placeholder="Ask about compliance..." style={{ width: '100%', padding: '12px 40px 12px 16px', borderRadius: '24px', border: '1px solid #E5E5E5', fontSize: '13px', outline: 'none', backgroundColor: '#F5F5F7' }} />
              <button onClick={handleSendChat} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none' }}><Send size={16} color="#007AFF" /></button>
            </div>
          </div>
        </aside>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeInScale { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        @keyframes pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(52, 199, 89, 0.7); } 70% { box-shadow: 0 0 0 15px rgba(52, 199, 89, 0); } 100% { box-shadow: 0 0 0 0 rgba(52, 199, 89, 0); } }
        .animate-spin { animation: spin 1s linear infinite; }
        .tour-tooltip { position: absolute; background: #1D1D1F; color: white; padding: 12px 16px; border-radius: 12px; font-size: 13px; font-weight: 600; box-shadow: 0 10px 30px rgba(0,0,0,0.2); z-index: 10002; pointer-events: none; animation: fadeInScale 0.3s ease-out; }
        .premium-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.06) !important; }
        .premium-row:hover { background-color: #F0F7FF !important; }
        .premium-sidebar-item:hover { transform: translateX(4px); }
        .onboarding-step { animation: fadeInScale 0.4s ease-out; }
        .skeleton { background-color: #F5F5F7; animation: skeleton-loading 1.5s infinite ease-in-out; }
        @keyframes skeleton-loading { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
      `}} />
    </div>
  );
}
