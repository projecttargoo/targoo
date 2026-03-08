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
  MoreHorizontal,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Zap,
  FileUp,
  File,
  X,
  Target,
  ArrowUp,
  ArrowDown,
  Clock
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
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#F5F5F7"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#007AFF"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
        />
      </svg>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
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
  const colors = {
    green: { bg: '#E1F7E3', dot: '#34C759' },
    yellow: { bg: '#FFF4D6', dot: '#FF9F0A' },
    red: { bg: '#FFEBEB', dot: '#FF3B30' },
  };
  const c = colors[status] || colors.yellow;
  return (
    <div style={{
      backgroundColor: c.bg,
      height: '24px',
      padding: '0 10px',
      borderRadius: '12px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      border: '1px solid rgba(0,0,0,0.02)'
    }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: c.dot }} />
      <span style={{ fontSize: '11px', fontWeight: '600', color: '#1D1D1F', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {status}
      </span>
    </div>
  );
};

// --- Main App Component ---

export default function App() {
  const [activeNav, setActiveNav] = useState('dashboard');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatHistory] = useState(demoData.aiHistory);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [gapData, setGapData] = useState(demoData.gapMatrix);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportPath, setReportPath] = useState(null);
  const [license, setLicense] = useState(demoData.license);
  const [isDragActive, setIsDragActive] = useState(false);
  const [droppedFile, setDroppedFile] = useState(null);
  const [animatedScore, setAnimatedScore] = useState(0);
  
  // Demo Tour State
  const [tourStep, setTourStep] = useState(0); // 0: none, 1-5: active

  // Initial load
  useEffect(() => {
    checkLicenseStatus();
    if (activeNav === 'gap analysis') {
      runGapAnalysis();
    }
    
    // Check if tour is needed
    if (!localStorage.getItem('demo_completed')) {
      startTour();
    }

    // Animate score on load
    const target = demoData.scores.total;
    let current = 0;
    const interval = setInterval(() => {
      if (current >= target) {
        setAnimatedScore(target);
        clearInterval(interval);
      } else {
        current += 1;
        setAnimatedScore(current);
      }
    }, 20);
    return () => clearInterval(interval);
  }, [activeNav]);

  const startTour = () => {
    setTourStep(1);
    
    setTimeout(() => {
      setTourStep(2);
      setActiveNav('gap analysis');
    }, 3000);

    setTimeout(() => {
      setTourStep(3);
    }, 12000);

    setTimeout(() => {
      setTourStep(4);
    }, 20000);

    setTimeout(() => {
      setTourStep(5);
    }, 28000);

    setTimeout(() => {
      setTourStep(0);
      localStorage.setItem('demo_completed', 'true');
    }, 35000);
  };

  const skipTour = () => {
    setTourStep(0);
    localStorage.setItem('demo_completed', 'true');
  };

  const checkLicenseStatus = async () => {
    try {
      const response = await invoke('get_license_state');
      const parsed = JSON.parse(response);
      setLicense(parsed);
    } catch (error) {
      console.error("License check failed:", error);
    }
  };

  const runGapAnalysis = async () => {
    setIsLoading(true);
    try {
      const response = await invoke('gap_analysis', { 
        input: { 
          company_size: "Large", 
          sector: "Manufacturing", 
          country: "Germany" 
        } 
      });
      const parsed = JSON.parse(response);
      const topics = Object.entries(parsed.topics).map(([name, status], idx) => ({
        id: `E${idx + 1}`,
        name,
        status,
        action: "Analysis pending",
        hours: 0
      }));
      setGapData(topics);
    } catch (error) {
      console.error("Gap analysis failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    setReportPath(null);
    try {
      const topicsMap = {};
      gapData.forEach(item => {
        topicsMap[item.name] = item.status;
      });

      const path = await invoke('generate_report', {
        companyName: demoData.company.name,
        gapAnalysisJson: JSON.stringify({ topics: topicsMap }),
        language: "en"
      });
      setReportPath(path);
      checkLicenseStatus(); 
      setTimeout(() => setReportPath(null), 10000);
    } catch (error) {
      console.error("Report generation failed:", error);
      alert("Failed to generate report: " + error);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      text: chatInput
    };

    setChatHistory(prev => [...prev, userMessage]);
    const currentInput = chatInput;
    setChatInput('');
    setIsAiTyping(true);

    try {
      const response = await invoke('ask_ai', { question: currentInput });
      
      const parts = response.split('---');
      const mainText = parts[0].trim();
      const citations = parts.length > 1 ? parts[1].trim() : '';

      const aiMessage = {
        id: Date.now() + 1,
        sender: 'ai',
        text: mainText,
        citations: citations
      };

      setChatHistory(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error("AI request failed:", error);
      const errorMessage = {
        id: Date.now() + 1,
        sender: 'ai',
        text: "I'm sorry, I encountered an error while processing your request. Please try again."
      };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsAiTyping(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = () => {
    setIsDragActive(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragActive(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      setDroppedFile({ name: file.name, size: (file.size / 1024).toFixed(1) + ' KB' });
      
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.csv')) {
        try {
          const placeholderPath = `C:\\Users\\User\\Downloads\\${file.name}`;
          const response = await invoke('process_excel', { filePath: placeholderPath });
          const parsed = JSON.parse(response);
          
          const aiMessage = {
            id: Date.now(),
            sender: 'ai',
            text: `I've processed **${file.name}**. I found **${parsed.row_count} rows** of data. ESG categorization: ${Object.keys(parsed.categorizations).join(', ')}. How should we proceed?`
          };
          setChatHistory([...chatMessages, aiMessage]);
        } catch (err) {
          const aiMessage = {
            id: Date.now(),
            sender: 'ai',
            text: `I saw you dropped **${file.name}**. (Note: In this browser-based preview, I can't access the full system path, but the L4 Data Processor is ready to categorize your ESG columns!)`
          };
          setChatHistory([...chatMessages, aiMessage]);
        }
      } else {
        const aiMessage = {
          id: Date.now(),
          sender: 'ai',
          text: `I've received **${file.name}**. I'll keep this in context for our session.`
        };
        setChatHistory([...chatMessages, aiMessage]);
      }
    }
  };

  // Styles object for structural layout
  const s = {
    layout: {
      display: 'grid',
      gridTemplateColumns: '240px 1fr 320px',
      height: '100vh',
      width: '100vw',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      backgroundColor: '#FFFFFF',
      overflow: 'hidden',
      transition: 'all 0.3s ease',
    },
    sidebar: {
      backgroundColor: '#F5F5F7',
      borderRight: '1px solid #E5E5E5',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 16px',
      transition: 'all 0.3s ease',
    },
    center: {
      backgroundColor: '#FFFFFF',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transition: 'all 0.3s ease',
    },
    centerContent: {
      flex: 1,
      overflowY: 'auto',
      padding: '32px',
      display: 'grid',
      gridTemplateColumns: 'repeat(12, 1fr)',
      gap: '24px',
      alignContent: 'start',
    },
    rightPanel: {
      backgroundColor: '#FFFFFF',
      borderLeft: '1px solid #E5E5E5',
      display: 'flex',
      flexDirection: 'column',
      transition: 'all 0.3s ease',
    },
    navItem: (isActive) => ({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 12px',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: isActive ? '600' : '400',
      color: isActive ? '#1D1D1F' : '#424245',
      backgroundColor: isActive ? 'rgba(0,0,0,0.05)' : 'transparent',
      marginBottom: '4px',
      transition: 'all 0.2s ease',
    }),
    header: {
      height: '72px',
      borderBottom: '1px solid #E5E5E5',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
      background: 'linear-gradient(to bottom, #FFFFFF, #F8F8F8)',
      backdropFilter: 'blur(20px)',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }
  };

  const isTrialEnded = license.status === 'trial_expired' || license.status === 'trial_limit_reached';

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      
      {/* Demo Tour Elements */}
      {tourStep > 0 && (
        <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 10005 }}>
          <button 
            onClick={skipTour}
            style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '20px', padding: '6px 16px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', backdropFilter: 'blur(10px)' }}
          >
            Skip Tour
          </button>
        </div>
      )}

      {tourStep === 1 && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(5px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.5s ease' }}>
          <div style={{ textAlign: 'center', animation: 'fadeInScale 0.8s ease-out' }}>
            <div style={{ width: '80px', height: '80px', background: 'linear-gradient(135deg, #1A5C3A, #2E7D32)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '40px', margin: '0 auto 24px', boxShadow: '0 10px 30px rgba(46,125,50,0.3)' }}>t</div>
            <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#1D1D1F', marginBottom: '12px', letterSpacing: '-1px' }}>Welcome to targoo advisor engine</h2>
            <p style={{ fontSize: '17px', color: '#86868B' }}>Müller GmbH demo environment is ready.</p>
          </div>
        </div>
      )}

      {tourStep === 5 && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.2)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#FFFFFF', padding: '40px', borderRadius: '32px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', textAlign: 'center', maxWidth: '400px', animation: 'fadeInScale 0.5s ease-out' }}>
            <div style={{ width: '56px', height: '56px', backgroundColor: '#E1F7E3', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <Zap size={28} color="#34C759" fill="#34C759" />
            </div>
            <h3 style={{ fontSize: '24px', fontWeight: '700', color: '#1D1D1F', marginBottom: '12px' }}>Value Saved Today</h3>
            <div style={{ fontSize: '48px', fontWeight: '800', color: '#34C759', marginBottom: '8px' }}>€660.00</div>
            <p style={{ fontSize: '15px', color: '#86868B', lineHeight: '1.4' }}>5.5 hours of senior advisor time saved through automation.</p>
          </div>
        </div>
      )}

      {/* License Modal */}
      {isTrialEnded && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
          <div style={{ maxWidth: '500px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '64px', height: '64px', background: 'linear-gradient(135deg, #007AFF, #00C7BE)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '32px', marginBottom: '32px', boxShadow: '0 10px 30px rgba(0,122,255,0.2)' }}>t</div>
            <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#1D1D1F', marginBottom: '12px', letterSpacing: '-1px' }}>Your trial has ended</h2>
            <p style={{ fontSize: '17px', color: '#86868B', marginBottom: '40px', lineHeight: '1.5' }}>
              You've successfully audited {demoData.company.name}. To continue using the engine and unlock deep predictions, please upgrade to a full plan.
            </p>
            <div style={{ width: '100%', backgroundColor: '#F5F5F7', padding: '24px', borderRadius: '24px', marginBottom: '40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', textAlign: 'left' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#86868B', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Reports Generated</div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#1D1D1F' }}>{license.usage_count} / 5</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#86868B', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Hours Saved</div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#34C759' }}>~42 hrs</div>
              </div>
              <div style={{ gridColumn: 'span 2', borderTop: '1px solid #E5E5E5', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '13px', color: '#1D1D1F', fontWeight: '600' }}>€399 / month</span>
                <span style={{ fontSize: '18px', fontWeight: '800', color: '#007AFF' }}>ROI 1790%</span>
              </div>
            </div>
            <a href="https://targoo.com/subscribe" target="_blank" rel="noreferrer" style={{ width: '100%', height: '56px', backgroundColor: '#34C759', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px', fontSize: '17px', fontWeight: '700', textDecoration: 'none', marginBottom: '20px', boxShadow: '0 4px 15px rgba(52,199,89,0.3)' }}>
              Subscribe Now <Zap size={18} fill="white" style={{ marginLeft: '10px' }} />
            </a>
          </div>
        </div>
      )}

      {/* Main Layout */}
      <div style={s.layout}>
        <aside style={s.sidebar}>
          <div style={{ padding: '0 12px 24px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', background: 'linear-gradient(135deg, #1A5C3A, #2E7D32)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '16px' }}>t</div>
            <span style={{ fontSize: '15px', fontWeight: '600', color: '#1D1D1F', letterSpacing: '-0.3px' }}>targoo</span>
          </div>
          <nav style={{ marginBottom: '32px' }}>
            {['Dashboard', 'Gap Analysis', 'Reports', 'Settings'].map((item) => {
              const key = item.toLowerCase();
              const isActive = activeNav === key;
              const Icon = key === 'dashboard' ? LayoutGrid : key.includes('gap') ? BarChart2 : key.includes('rep') ? FileText : Settings;
              const isGapAnalysis = key === 'gap analysis';
              const isReport = key === 'reports';
              
              return (
                <div 
                  key={item} 
                  style={{
                    ...s.navItem(isActive),
                    position: 'relative',
                    ...(isGapAnalysis && tourStep === 2 ? { boxShadow: '0 0 0 4px #34C759', animation: 'pulse-ring 2s infinite' } : {})
                  }}
                  onClick={() => setActiveNav(key)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Icon size={18} strokeWidth={2} style={{ opacity: isActive ? 1 : 0.7 }} />
                    {item}
                  </div>
                  {isGapAnalysis && <span style={{ fontSize: '10px', color: '#86868B', fontWeight: '500', opacity: 0.6 }}>⌘G</span>}
                  {isReport && <span style={{ fontSize: '10px', color: '#86868B', fontWeight: '500', opacity: 0.6 }}>⌘R</span>}
                  
                  {isGapAnalysis && tourStep === 2 && (
                    <div className="tour-tooltip" style={{ left: '100%', marginLeft: '20px', width: '180px' }}>
                      Gap Analysis in 8 seconds
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
          <div style={{ padding: '0 12px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '600', color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Clients</span>
            <Plus size={14} color="#86868B" style={{ cursor: 'pointer' }} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {[demoData.company, { name: "Audit Log Inc.", sector: "Tech", status: "Inactive" }].map(client => (
              <div key={client.name} style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#FFFFFF', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', marginBottom: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'transform 0.2s ease' }} className="premium-sidebar-item">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: client.status === 'Active' ? '#34C759' : '#8E8E93' }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#1D1D1F' }}>{client.name}</div>
                    <div style={{ fontSize: '11px', color: '#86868B' }}>{client.sector}</div>
                  </div>
                </div>
                <ChevronRight size={14} color="#C7C7CC" />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 'auto', padding: '16px 12px 0', borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#E5E5EA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={16} color="#86868B" />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: '#1D1D1F' }}>Advisor Admin</div>
              <div style={{ fontSize: '11px', color: '#86868B' }}>Pro Plan</div>
            </div>
          </div>
        </aside>

        <main style={s.center}>
          {license.status === 'trial_active' && (
            <div style={{ height: '32px', backgroundColor: '#007AFF', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', gap: '8px' }}>
              <ShieldCheck size={14} />
              TRIAL MODE: {license.days_remaining} DAYS REMAINING
              <a href="https://targoo.com/subscribe" target="_blank" rel="noreferrer" style={{ color: 'white', textDecoration: 'underline', marginLeft: '12px' }}>Upgrade to Pro</a>
            </div>
          )}
          <header style={s.header}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#1D1D1F', margin: 0, letterSpacing: '-0.5px' }}>{demoData.company.name}</h1>
                  <span style={{ backgroundColor: '#E1F7E3', color: '#34C759', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>{demoData.company.status}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  <Clock size={12} color="#86868B" />
                  <span style={{ fontSize: '11px', color: '#86868B', fontWeight: '500' }}>Last updated: Today, 10:42 AM</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {(isLoading || isGeneratingReport) && <Loader2 className="animate-spin text-blue-500" size={20} />}
              <div style={{ position: 'relative' }}>
                <Search size={16} color="#86868B" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input type="text" placeholder="Search metrics..." style={{ height: '36px', width: '280px', padding: '0 12px 0 34px', borderRadius: '10px', border: '1px solid #E5E5E5', backgroundColor: '#FFFFFF', fontSize: '13px', outline: 'none', color: '#1D1D1F', transition: 'border-color 0.2s' }} className="premium-search" />
              </div>
            </div>
          </header>

          <div style={s.centerContent}>
            {reportPath && (
              <div style={{ gridColumn: 'span 12', backgroundColor: '#E1F7E3', color: '#1D1D1F', padding: '12px 20px', borderRadius: '12px', border: '1px solid #34C759', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', animation: 'fadeInScale 0.4s ease-out' }}>
                <CheckCircle2 size={20} color="#34C759" />
                <div style={{ fontSize: '13px' }}>
                  <strong>Report Generated!</strong> Saved to: <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{reportPath}</span>
                </div>
              </div>
            )}

            {activeNav === 'dashboard' && (
              <>
                <div style={{ gridColumn: 'span 4' }}>
                  <Card title="Overall ESG Score" style={{ height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                    <CircularProgress value={demoData.scores.total} animatedValue={animatedScore} />
                    <div style={{ marginTop: '24px', textAlign: 'center' }}>
                      <div style={{ fontSize: '13px', color: '#34C759', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <ArrowUp size={14} /> {demoData.scores.trend}
                      </div>
                    </div>
                  </Card>
                </div>
                <div style={{ gridColumn: 'span 8' }}>
                  <Card title="Pillar Performance">
                    <div style={{ padding: '8px 0' }}>
                      <ProgressBar label="Environmental" value={demoData.scores.environmental} color="#34C759" trend="up" />
                      <ProgressBar label="Social" value={demoData.scores.social} color="#007AFF" trend="down" />
                      <ProgressBar label="Governance" value={demoData.scores.governance} color="#AF52DE" trend="up" />
                    </div>
                  </Card>
                </div>
              </>
            )}

            {(activeNav === 'dashboard' || activeNav === 'gap analysis') && (
              <div style={{ gridColumn: 'span 12' }}>
                <Card title={activeNav === 'gap analysis' ? "Full ESRS Gap Analysis" : "ESRS Gap Analysis Matrix"} style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 24px', borderBottom: '1px solid #F5F5F7', display: 'flex', justifyContent: 'flex-end' }}>
                    <button 
                      onClick={handleGenerateReport}
                      disabled={isGeneratingReport || gapData.length === 0}
                      style={{ 
                        backgroundColor: '#007AFF', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                        position: 'relative',
                        transition: 'all 0.2s ease',
                        ...(tourStep === 3 ? { boxShadow: '0 0 0 4px #007AFF', animation: 'pulse-ring-blue 2s infinite' } : {})
                      }}
                      className="premium-button"
                    >
                      {isGeneratingReport ? <Loader2 className="animate-spin" size={14} /> : <FileText size={14} />}
                      Generate ESRS Report
                      {tourStep === 3 && (
                        <div className="tour-tooltip" style={{ bottom: '100%', right: '0', marginBottom: '20px', width: '220px' }}>
                          Professional ESRS Report in 45 seconds
                        </div>
                      )}
                    </button>
                  </div>
                  {isLoading ? (
                    <div style={{ padding: '24px' }}>
                      <Skeleton width="100%" height="40px" />
                      <Skeleton width="100%" height="40px" />
                      <Skeleton width="100%" height="40px" />
                      <Skeleton width="100%" height="40px" />
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #E5E5E5', backgroundColor: '#FAFAFA' }}>
                          <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ID</th>
                          <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Topic</th>
                          <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(gapData || []).map((topic, i) => (
                          <tr key={topic.id} style={{ borderBottom: '1px solid #F5F5F7', transition: 'background-color 0.2s' }} className="premium-row">
                            <td style={{ padding: '16px 24px', fontSize: '13px', color: '#86868B', fontFamily: 'SF Mono, monospace' }}>{topic.id}</td>
                            <td style={{ padding: '16px 24px', fontSize: '13px', color: '#1D1D1F', fontWeight: '500' }}>{topic.name}</td>
                            <td style={{ padding: '16px 24px' }}><StatusBadge status={topic.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Card>
              </div>
            )}
          </div>
        </main>

        <aside style={{ ...s.rightPanel, position: 'relative', ...(tourStep === 4 ? { boxShadow: '-10px 0 30px rgba(0,122,255,0.1)', zIndex: 10001 } : {}) }}>
          {tourStep === 4 && (
            <div className="tour-tooltip" style={{ top: '80px', right: '100%', marginRight: '20px', width: '240px' }}>
              Ask anything - cited ESRS paragraphs
            </div>
          )}
          <div style={{ height: '72px', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', padding: '0 20px', background: 'linear-gradient(to bottom, #FFFFFF, #F8F8F8)' }}>
            <MessageSquare size={18} color="#1D1D1F" style={{ marginRight: '10px' }} />
            <span style={{ fontSize: '15px', fontWeight: '700', color: '#1D1D1F' }}>Advisor AI</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#FAFAFA' }}>
            {chatMessages.map(msg => (
              <div key={msg.id} style={{ alignSelf: msg.sender === 'ai' ? 'flex-start' : 'flex-end', maxWidth: '90%', backgroundColor: msg.sender === 'ai' ? '#FFFFFF' : '#007AFF', color: msg.sender === 'ai' ? '#1D1D1F' : '#FFFFFF', padding: '12px 16px', borderRadius: '16px', borderTopLeftRadius: msg.sender === 'ai' ? '4px' : '16px', boxShadow: msg.sender === 'ai' ? '0 2px 8px rgba(0,0,0,0.04)' : 'none', border: msg.sender === 'ai' ? '1px solid #E5E5E5' : 'none', borderLeft: msg.sender === 'ai' ? '4px solid #34C759' : 'none', fontSize: '13px', lineHeight: '1.5', whiteSpace: 'pre-wrap', animation: 'fadeInScale 0.3s ease-out' }}>
                {msg.text}
                {msg.sender === 'ai' && msg.citations && (
                  <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #F5F5F7', fontSize: '11px', color: '#86868B', fontStyle: 'italic' }}>{msg.citations}</div>
                )}
              </div>
            ))}
            {isAiTyping && (
              <div style={{ alignSelf: 'flex-start', backgroundColor: '#FFFFFF', padding: '12px 16px', borderRadius: '16px', borderTopLeftRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #E5E5E5', display: 'flex', gap: '4px' }}>
                <div className="typing-dot"></div>
                <div className="typing-dot" style={{ animationDelay: '0.2s' }}></div>
                <div className="typing-dot" style={{ animationDelay: '0.4s' }}></div>
              </div>
            )}
          </div>
          <div style={{ padding: '20px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E5E5E5' }}>
            <div style={{ position: 'relative' }}>
              <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendChat()} placeholder="Ask about compliance..." style={{ width: '100%', padding: '12px 40px 12px 16px', borderRadius: '24px', border: '1px solid #E5E5E5', fontSize: '13px', outline: 'none', backgroundColor: '#F5F5F7' }} className="premium-search" />
              <button onClick={handleSendChat} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer' }}><Send size={16} color="#007AFF" /></button>
            </div>
          </div>
        </aside>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes fadeInScale { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        @keyframes pulse-ring { 
          0% { box-shadow: 0 0 0 0 rgba(52, 199, 89, 0.7); } 
          70% { box-shadow: 0 0 0 15px rgba(52, 199, 89, 0); } 
          100% { box-shadow: 0 0 0 0 rgba(52, 199, 89, 0); } 
        }
        @keyframes pulse-ring-blue { 
          0% { box-shadow: 0 0 0 0 rgba(0, 122, 255, 0.7); } 
          70% { box-shadow: 0 0 0 15px rgba(0, 122, 255, 0); } 
          100% { box-shadow: 0 0 0 0 rgba(0, 122, 255, 0); } 
        }
        @keyframes skeleton-loading {
          0% { background-color: #F5F5F7; }
          50% { background-color: #E5E5EA; }
          100% { background-color: #F5F5F7; }
        }
        .animate-spin { animation: spin 1s linear infinite; }
        .typing-dot { width: 6px; height: 6px; background-color: #86868B; border-radius: 50%; animation: bounce 1s infinite ease-in-out; }
        .tour-tooltip {
          position: absolute;
          background: #1D1D1F;
          color: white;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
          z-index: 10002;
          pointer-events: none;
          animation: fadeInScale 0.3s ease-out;
        }
        .premium-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.06) !important;
        }
        .premium-row:hover {
          background-color: #F0F7FF !important;
        }
        .premium-sidebar-item:hover {
          transform: translateX(4px);
          background-color: #FDFDFD !important;
        }
        .premium-button:hover {
          filter: brightness(1.1);
          transform: translateY(-1px);
        }
        .premium-button:active {
          transform: translateY(0);
        }
        .premium-search:focus {
          border-color: #007AFF !important;
          background-color: #FFFFFF !important;
        }
        .skeleton {
          animation: skeleton-loading 1.5s infinite ease-in-out;
        }
      `}} />
    </div>
  );
}
