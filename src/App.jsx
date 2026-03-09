import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
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
  Users,
  CreditCard,
  Palette,
  Languages,
  FileCog,
  Database,
  Info,
  Lock,
  Download
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
      <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '600', color: '#1D1D1F' }}>{title}</h3>
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
  const [modelStatus, setModelStatus] = useState('checking'); // checking, not_found, downloading, ready
  const [downloadProgress, setDownloadProgress] = useState(0);
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
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [newClient, setNewClient] = useState({ name: '', industry: 'Manufacturing', country: 'DE', employees: '51-200' });
  const [onboardingProgress, setOnboardingProgress] = useState(0);

  // Settings State
  const [activeSettingsTab, setActiveSettingsTab] = useState('account');

  useEffect(() => {
    const init = async () => {
      const status = await invoke('check_model');
      setModelStatus(status);
      
      if (status === 'not_found') {
        startModelDownload();
      }
    };

    init();

    const unlisten = listen('download_progress', (event) => {
      setDownloadProgress(event.payload);
      if (event.payload >= 100) {
        setTimeout(() => setModelStatus('ready'), 2000);
      }
    });

    checkLicenseStatus();
    const savedClients = localStorage.getItem('targoo_clients');
    if (savedClients) { setClients(JSON.parse(savedClients)); }
    else if (localStorage.getItem('demo_completed') === 'true') { setOnboardingStep(1); }
    if (!localStorage.getItem('demo_completed')) { startTour(); }
    const target = demoData.scores.total;
    let current = 0;
    const interval = setInterval(() => {
      if (current >= target) { clearInterval(interval); }
      else { current += 1; setAnimatedScore(current); }
    }, 20);

    return () => {
      clearInterval(interval);
      unlisten.then(f => f());
    };
  }, []);

  const startModelDownload = async () => {
    setModelStatus('downloading');
    try {
      await invoke('download_model');
    } catch (e) {
      console.error("Download failed", e);
      setModelStatus('not_found');
    }
  };

  const startTour = () => {
    setTourStep(1);
    setTimeout(() => { setTourStep(2); setActiveNav('gap analysis'); }, 3000);
    setTimeout(() => { setTourStep(3); }, 12000);
    setTimeout(() => { setTourStep(4); }, 20000);
    setTimeout(() => { setTourStep(5); }, 28000);
    setTimeout(() => { setTourStep(0); localStorage.setItem('demo_completed', 'true'); if (clients.length === 0) setOnboardingStep(1); }, 35000);
  };

  const skipTour = () => { setTourStep(0); localStorage.setItem('demo_completed', 'true'); if (clients.length === 0) setOnboardingStep(1); };

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
      const topics = Object.entries(parsed.topics).map(([name, status], idx) => ({ id: `E${idx + 1}`, name, status, action: "Analysis pending", hours: 0 }));
      setGapData(topics);
    } catch (e) { setGapData(demoData.gapMatrix); }
    finally { setIsLoading(false); }
  };

  const handleOnboardingContinue = () => {
    if (onboardingStep === 1) { if (!newClient.name) return; setOnboardingStep(2); }
    else if (onboardingStep === 2) { setOnboardingStep(3); startOnboardingAnalysis(); }
  };

  const startOnboardingAnalysis = () => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += 2; setOnboardingProgress(progress);
      if (progress >= 100) { clearInterval(interval); finishOnboarding(); }
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
    } catch (e) { setChatHistory(prev => [...prev, { id: Date.now()+1, sender: 'ai', text: "Error processing request." }]); }
    finally { setIsAiTyping(false); }
  };

  const s = {
    layout: { display: 'grid', gridTemplateColumns: '240px 1fr 320px', height: '100vh', width: '100vw', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif', backgroundColor: '#FFFFFF', overflow: 'hidden' },
    sidebar: { backgroundColor: '#F5F5F7', borderRight: '1px solid #E5E5E5', display: 'flex', flexDirection: 'column', padding: '20px 16px' },
    center: { backgroundColor: '#FFFFFF', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    centerContent: { flex: 1, overflowY: 'auto', padding: '32px', display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px', alignContent: 'start' },
    rightPanel: { backgroundColor: '#FFFFFF', borderLeft: '1px solid #E5E5E5', display: 'flex', flexDirection: 'column' },
    navItem: (isActive) => ({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: isActive ? '600' : '400', color: isActive ? '#1D1D1F' : '#424245', backgroundColor: isActive ? 'rgba(0,0,0,0.05)' : 'transparent', marginBottom: '4px', transition: 'all 0.2s ease' }),
    header: { height: '72px', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', background: 'linear-gradient(to bottom, #FFFFFF, #F8F8F8)', position: 'sticky', top: 0, zIndex: 10 },
    settingsPanel: { display: 'flex', height: '100%', overflow: 'hidden' },
    settingsSidebar: { width: '220px', borderRight: '1px solid #E5E5E5', padding: '20px 12px', backgroundColor: '#FDFDFD' },
    settingsContent: { flex: 1, padding: '40px 60px', overflowY: 'auto' },
    settingsGroup: { marginBottom: '32px' },
    settingsLabel: { display: 'block', fontSize: '12px', fontWeight: '700', color: '#1D1D1F', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' },
    settingsRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #F5F5F7' }
  };

  const activeClient = clients[0] || demoData.company;

  if (modelStatus === 'checking') {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
        <Loader2 className="animate-spin" size={32} color="#007AFF" />
      </div>
    );
  }

  if (modelStatus === 'not_found' || modelStatus === 'downloading') {
    const isDone = downloadProgress >= 100;
    return (
      <div style={{ 
        width: '100vw', 
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        backgroundColor: '#FFFFFF',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif'
      }}>
        <div style={{ 
          width: '100px', 
          height: '100px', 
          background: 'linear-gradient(135deg, #1A5C3A, #2E7D32)', 
          borderRadius: '24px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          color: 'white', 
          fontWeight: '800', 
          fontSize: '48px', 
          marginBottom: '40px',
          boxShadow: '0 20px 40px rgba(46,125,50,0.15)'
        }}>t</div>
        
        <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#1D1D1F', marginBottom: '8px' }}>
          {isDone ? 'AI Engine Ready' : 'Setting up AI Engine'}
          {isDone && <CheckCircle2 size={24} color="#34C759" style={{ marginLeft: '12px', display: 'inline-block', verticalAlign: 'middle' }} />}
        </h2>
        
        <p style={{ fontSize: '17px', color: '#86868B', marginBottom: '48px' }}>
          {isDone ? 'Starting your ESG advisor workspace...' : 'Downloading Gemma 3 1B ESG Model (800MB)'}
        </p>

        {!isDone && (
          <div style={{ width: '320px' }}>
            <div style={{ width: '100%', height: '6px', backgroundColor: '#F5F5F7', borderRadius: '3px', overflow: 'hidden', marginBottom: '16px' }}>
              <div style={{ 
                width: `${downloadProgress}%`, 
                height: '100%', 
                backgroundColor: '#007AFF', 
                borderRadius: '3px', 
                transition: 'width 0.3s ease-out' 
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#1D1D1F' }}>{Math.floor(downloadProgress)}% complete</span>
              <span style={{ fontSize: '13px', color: '#86868B' }}>
                {downloadProgress > 0 ? `${Math.ceil((100 - downloadProgress) * 0.5)}s remaining` : 'Calculating...'}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#AEAEB2', textAlign: 'center', marginTop: '32px' }}>This only happens once</p>
          </div>
        )}
      </div>
    );
  }

  const renderSettings = () => (
    <div style={s.settingsPanel}>
      <aside style={s.settingsSidebar}>
        {[
          { id: 'account', label: 'Account & License', icon: CreditCard },
          { id: 'branding', label: 'Branding', icon: Palette },
          { id: 'language', label: 'Language', icon: Languages },
          { id: 'reports', label: 'Report Settings', icon: FileCog },
          { id: 'privacy', label: 'Data & Privacy', icon: Database },
          { id: 'about', label: 'About', icon: Info }
        ].map(item => (
          <div 
            key={item.id} 
            onClick={() => setActiveSettingsTab(item.id)}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', marginBottom: '4px',
              backgroundColor: activeSettingsTab === item.id ? '#007AFF' : 'transparent',
              color: activeSettingsTab === item.id ? 'white' : '#1D1D1F',
              fontWeight: activeSettingsTab === item.id ? '600' : '400',
              transition: 'all 0.2s'
            }}
          >
            <item.icon size={16} />
            {item.label}
          </div>
        ))}
      </aside>
      
      <div style={s.settingsContent}>
        {activeSettingsTab === 'account' && (
          <div className="onboarding-step">
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>Account & License</h2>
            <p style={{ color: '#86868B', marginBottom: '32px' }}>Manage your subscription and advisor engine limits.</p>
            
            <Card style={{ marginBottom: '24px', background: 'linear-gradient(135deg, #F5F5F7, #FFFFFF)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#007AFF', textTransform: 'uppercase', marginBottom: '4px' }}>Current Plan</div>
                  <div style={{ fontSize: '20px', fontWeight: '700' }}>Trial Version</div>
                </div>
                <StatusBadge status="yellow" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#86868B' }}>Time remaining</div>
                  <div style={{ fontSize: '16px', fontWeight: '600' }}>{license.days_remaining} Days</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#86868B' }}>Reports generated</div>
                  <div style={{ fontSize: '16px', fontWeight: '600' }}>{license.usage_count} / 5</div>
                </div>
              </div>
            </Card>
            
            <button style={{ width: '100%', height: '56px', backgroundColor: '#34C759', color: 'white', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: '0 4px 15px rgba(52,199,89,0.3)' }}>
              Upgrade to Pro — €399 / mo <Zap size={18} fill="white" />
            </button>
          </div>
        )}

        {activeSettingsTab === 'branding' && (
          <div className="onboarding-step">
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>Branding</h2>
            <div style={{ position: 'relative', opacity: 0.6, pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                <div style={{ backgroundColor: '#1D1D1F', color: 'white', padding: '12px 20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
                  <Lock size={16} /> Pro Feature Only
                </div>
              </div>
              <p style={{ color: '#86868B', marginBottom: '32px' }}>Customize report headers and company logos.</p>
              <div style={s.settingsGroup}>
                <label style={s.settingsLabel}>Company Logo</label>
                <div style={{ width: '80px', height: '80px', border: '2px dashed #E5E5E5', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Palette size={24} color="#86868B" />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSettingsTab === 'language' && (
          <div className="onboarding-step">
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>Language</h2>
            <p style={{ color: '#86868B', marginBottom: '32px' }}>Set your preferred UI and report language.</p>
            <div style={s.settingsGroup}>
              <label style={s.settingsLabel}>App Interface</label>
              <select style={{ width: '100%', height: '44px', padding: '0 12px', borderRadius: '10px', border: '1px solid #E5E5E5', outline: 'none', backgroundColor: 'white' }}>
                <option>English</option>
                <option>Deutsch</option>
                <option>Français</option>
              </select>
            </div>
          </div>
        )}

        {activeSettingsTab === 'reports' && (
          <div className="onboarding-step">
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>Report Settings</h2>
            <p style={{ color: '#86868B', marginBottom: '32px' }}>Configure how your ESRS reports are generated.</p>
            <div style={s.settingsGroup}>
              <label style={s.settingsLabel}>Default Report Language</label>
              <select style={{ width: '100%', height: '44px', padding: '0 12px', borderRadius: '10px', border: '1px solid #E5E5E5', outline: 'none', backgroundColor: 'white' }}>
                <option>English</option>
                <option>Deutsch</option>
              </select>
            </div>
            <div style={s.settingsRow}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600' }}>Include Executive Summary</div>
                <div style={{ fontSize: '12px', color: '#86868B' }}>Add a high-level overview for management.</div>
              </div>
              <input type="checkbox" defaultChecked style={{ width: '20px', height: '20px', accentColor: '#007AFF' }} />
            </div>
            <div style={s.settingsRow}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600' }}>Detailed Methodology</div>
                <div style={{ fontSize: '12px', color: '#86868B' }}>Show L1-L6 engine process details.</div>
              </div>
              <input type="checkbox" style={{ width: '20px', height: '20px', accentColor: '#007AFF' }} />
            </div>
          </div>
        )}

        {activeSettingsTab === 'privacy' && (
          <div className="onboarding-step">
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>Data & Privacy</h2>
            <p style={{ color: '#86868B', marginBottom: '32px' }}>Your data security is our highest priority.</p>
            <Card style={{ backgroundColor: '#F9F9FB', border: 'none', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                <ShieldCheck size={24} color="#34C759" />
                <div style={{ fontSize: '15px', fontWeight: '600' }}>Local-First Architecture</div>
              </div>
              <p style={{ fontSize: '13px', color: '#424245', lineHeight: '1.5' }}>All ESG metrics, client data, and audit logs are stored exclusively on this machine. No data is sent to the cloud for processing.</p>
            </Card>
            <div style={s.settingsRow}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600' }}>Export Audit Log</div>
                <div style={{ fontSize: '12px', color: '#86868B' }}>Download CSV of all session activities.</div>
              </div>
              <button style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E5E5', background: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                <Download size={14} /> Export
              </button>
            </div>
          </div>
        )}

        {activeSettingsTab === 'about' && (
          <div className="onboarding-step" style={{ textAlign: 'center', paddingTop: '40px' }}>
            <div style={{ width: '100px', height: '100px', background: 'linear-gradient(135deg, #1A5C3A, #2E7D32)', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '48px', margin: '0 auto 24px', boxShadow: '0 15px 40px rgba(46,125,50,0.2)' }}>t</div>
            <h2 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '4px' }}>targoo advisor engine</h2>
            <div style={{ fontSize: '14px', color: '#86868B', marginBottom: '40px' }}>Version 0.1.0 (Alpha Build)</div>
            <div style={{ maxWidth: '400px', margin: '0 auto', fontSize: '12px', color: '#86868B', lineHeight: '1.6' }}>
              Designed for professional sustainability advisors. ESRS & CSRD compliance engine powered by SQLite FTS5 and local RAG technology.
              <br/><br/>
              © 2026 targoo GmbH. All rights reserved.
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      
      {/* Onboarding & Tour Overlays */}
      {onboardingStep > 0 && (
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'white', width: '480px', borderRadius: '24px', padding: '40px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
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
              </div>
            )}
            <div style={{ marginTop: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button disabled={onboardingStep === 3} onClick={() => onboardingStep > 1 && setOnboardingStep(onboardingStep-1)} style={{ visibility: onboardingStep === 1 ? 'hidden' : 'visible', display: 'flex', alignItems: 'center', gap: '6px', border: 'none', background: 'none', color: '#86868B', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}><ChevronLeft size={18} /> Back</button>
              <div style={{ display: 'flex', gap: '8px' }}>{[1,2,3].map(i => <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: onboardingStep === i ? '#007AFF' : '#E5E5E5' }} />)}</div>
              <button disabled={onboardingStep === 3} onClick={handleOnboardingContinue} style={{ backgroundColor: '#34C759', color: 'white', border: 'none', borderRadius: '12px', padding: '10px 24px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>{onboardingStep === 2 ? 'Start Analysis' : 'Continue'}</button>
            </div>
          </div>
        </div>
      )}

      <div style={s.layout}>
        <aside style={s.sidebar}>
          <div style={{ padding: '0 12px 24px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', background: 'linear-gradient(135deg, #1A5C3A, #2E7D32)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '16px' }}>t</div>
            <span style={{ fontSize: '15px', fontWeight: '600', color: '#1D1D1F' }}>targoo</span>
          </div>
          <nav style={{ marginBottom: '32px' }}>
            {['Dashboard', 'Gap Analysis', 'Reports', 'Settings'].map((item) => {
              const key = item.toLowerCase();
              const Icon = key === 'dashboard' ? LayoutGrid : key.includes('gap') ? BarChart2 : key.includes('rep') ? FileText : Settings;
              return (
                <div key={item} style={s.navItem(activeNav === key)} onClick={() => setActiveNav(key)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Icon size={18} strokeWidth={2} style={{ opacity: activeNav === key ? 1 : 0.7 }} />
                    {item}
                  </div>
                </div>
              );
            })}
          </nav>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {clients.map(client => (
              <div key={client.name} style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#FFFFFF', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', marginBottom: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#34C759' }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600' }}>{client.name}</div>
                    <div style={{ fontSize: '11px', color: '#86868B' }}>{client.industry}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main style={s.center}>
          <header style={s.header}>
            <h1 style={{ fontSize: '20px', fontWeight: '700' }}>{activeNav === 'settings' ? 'Settings' : activeClient.name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {(isLoading || isGeneratingReport) && <Loader2 className="animate-spin text-blue-500" size={20} />}
            </div>
          </header>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {activeNav === 'settings' ? renderSettings() : (
              <div style={s.centerContent}>
                {activeNav === 'dashboard' && (
                  <>
                    <div style={{ gridColumn: 'span 4' }}><Card title="Overall ESG Score"><CircularProgress value={demoData.scores.total} animatedValue={animatedScore} /></Card></div>
                    <div style={{ gridColumn: 'span 8' }}><Card title="Pillar Performance"><ProgressBar label="Environmental" value={demoData.scores.environmental} color="#34C759" trend="up" /><ProgressBar label="Social" value={demoData.scores.social} color="#007AFF" trend="down" /><ProgressBar label="Governance" value={demoData.scores.governance} color="#AF52DE" trend="up" /></Card></div>
                  </>
                )}
                <div style={{ gridColumn: 'span 12' }}>
                  <Card title="ESRS Gap Analysis Matrix" style={{ padding: 0, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr style={{ borderBottom: '1px solid #E5E5E5', backgroundColor: '#FAFAFA' }}><th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#86868B', textTransform: 'uppercase' }}>ID</th><th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#86868B', textTransform: 'uppercase' }}>Topic</th><th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#86868B', textTransform: 'uppercase' }}>Status</th></tr></thead>
                      <tbody>{gapData.map(topic => (<tr key={topic.id} style={{ borderBottom: '1px solid #F5F5F7' }}><td style={{ padding: '16px 24px', fontSize: '13px', color: '#86868B' }}>{topic.id}</td><td style={{ padding: '16px 24px', fontSize: '13px', color: '#1D1D1F', fontWeight: '500' }}>{topic.name}</td><td style={{ padding: '16px 24px' }}><StatusBadge status={topic.status} /></td></tr>))}</tbody>
                    </table>
                  </Card>
                </div>
              </div>
            )}
          </div>
        </main>

        <aside style={s.rightPanel}>
          <div style={{ height: '72px', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', padding: '0 20px', background: 'linear-gradient(to bottom, #FFFFFF, #F8F8F8)' }}><MessageSquare size={18} style={{ marginRight: '10px' }} /><span style={{ fontSize: '15px', fontWeight: '700' }}>Advisor AI</span></div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#FAFAFA' }}>
            {chatMessages.map(msg => (<div key={msg.id} style={{ alignSelf: msg.sender === 'ai' ? 'flex-start' : 'flex-end', maxWidth: '90%', backgroundColor: msg.sender === 'ai' ? '#FFFFFF' : '#007AFF', color: msg.sender === 'ai' ? '#1D1D1F' : '#FFFFFF', padding: '12px 16px', borderRadius: '16px', borderTopLeftRadius: msg.sender === 'ai' ? '4px' : '16px', border: msg.sender === 'ai' ? '1px solid #E5E5E5' : 'none', borderLeft: msg.sender === 'ai' ? '4px solid #34C759' : 'none', fontSize: '13px', lineHeight: '1.5' }}>{msg.text}</div>))}
          </div>
          <div style={{ padding: '20px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E5E5E5' }}><div style={{ position: 'relative' }}><input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendChat()} placeholder="Ask about compliance..." style={{ width: '100%', padding: '12px 40px 12px 16px', borderRadius: '24px', border: '1px solid #E5E5E5', fontSize: '13px', outline: 'none', backgroundColor: '#F5F5F7' }} /><button onClick={handleSendChat} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none' }}><Send size={16} color="#007AFF" /></button></div></div>
        </aside>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeInScale { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        .animate-spin { animation: spin 1s linear infinite; }
        .onboarding-step { animation: fadeInScale 0.4s ease-out; }
        .skeleton { background-color: #F5F5F7; animation: skeleton-loading 1.5s infinite ease-in-out; }
        @keyframes skeleton-loading { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
      `}} />
    </div>
  );
}
