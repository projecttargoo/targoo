import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
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
  CheckCircle2
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

// --- Data ---
const co2Data = [
  { month: 'Jan', co2: 450 },
  { month: 'Feb', co2: 420 },
  { month: 'Mar', co2: 440 },
  { month: 'Apr', co2: 390 },
  { month: 'May', co2: 360 },
  { month: 'Jun', co2: 340 },
  { month: 'Jul', co2: 320 },
];

const clients = [
  { name: "Müller GmbH", industry: "Manufacturing", active: true },
  { name: "Schmidt Logistik", industry: "Transportation", active: false },
  { name: "Weber Solar", industry: "Energy", active: false },
  { name: "Bauer Agrar", industry: "Agriculture", active: false },
];

const messages = [
  { id: 1, sender: 'ai', text: "I've analyzed the Q3 data for Müller GmbH. The water usage intensity (E3) exceeds the sector benchmark by 15%." },
  { id: 2, sender: 'user', text: "What's the main driver?" },
  { id: 3, sender: 'ai', text: "The primary driver is the new cooling process at the Hamburg facility. It accounts for 60% of the total increase." },
];

// --- Components ---

const Card = ({ children, title, style }) => (
  <div style={{
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    border: '1px solid #E5E5E5',
    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
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

const CircularProgress = ({ value, size = 160, strokeWidth = 12 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

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
          style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
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
        <span style={{ fontSize: '42px', fontWeight: '700', color: '#1D1D1F', letterSpacing: '-1px' }}>{value}</span>
        <span style={{ fontSize: '13px', fontWeight: '500', color: '#86868B', marginTop: '-4px' }}>ESG SCORE</span>
      </div>
    </div>
  );
};

const ProgressBar = ({ label, value, color }) => (
  <div style={{ marginBottom: '16px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
      <span style={{ fontSize: '13px', fontWeight: '500', color: '#1D1D1F' }}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: '600', color: '#86868B' }}>{value}%</span>
    </div>
    <div style={{ width: '100%', height: '6px', backgroundColor: '#F5F5F7', borderRadius: '3px', overflow: 'hidden' }}>
      <div style={{ width: `${value}%`, height: '100%', backgroundColor: color, borderRadius: '3px' }} />
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
  const [gapData, setGapData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportPath, setReportPath] = useState(null);

  // Initial load
  useEffect(() => {
    if (activeNav === 'gap analysis' || (activeNav === 'dashboard' && gapData.length === 0)) {
      runGapAnalysis();
    }
  }, [activeNav]);

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
        status
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
      // Re-format gapData back to the expected HashMap format for the backend
      const topicsMap = {};
      gapData.forEach(item => {
        topicsMap[item.name] = item.status;
      });

      const path = await invoke('generate_report', {
        companyName: "Müller GmbH",
        gapAnalysisJson: JSON.stringify({ topics: topicsMap }),
        language: "en"
      });
      setReportPath(path);
      setTimeout(() => setReportPath(null), 10000); // Clear message after 10s
    } catch (error) {
      console.error("Report generation failed:", error);
      alert("Failed to generate report: " + error);
    } finally {
      setIsGeneratingReport(false);
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
    },
    sidebar: {
      backgroundColor: '#F5F5F7',
      borderRight: '1px solid #E5E5E5',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 16px',
    },
    center: {
      backgroundColor: '#FFFFFF',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
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
    },
    navItem: (isActive) => ({
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '8px 12px',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: isActive ? '600' : '400',
      color: isActive ? '#1D1D1F' : '#424245',
      backgroundColor: isActive ? 'rgba(0,0,0,0.05)' : 'transparent',
      marginBottom: '4px',
      transition: 'all 0.15s ease',
    }),
    header: {
      height: '64px',
      borderBottom: '1px solid #E5E5E5',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
      backgroundColor: 'rgba(255,255,255,0.8)',
      backdropFilter: 'blur(20px)',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }
  };

  return (
    <div style={s.layout}>
      {/* --- Sidebar --- */}
      <aside style={s.sidebar}>
        {/* Logo Area */}
        <div style={{ padding: '0 12px 24px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '28px', height: '28px', background: 'linear-gradient(135deg, #007AFF, #00C7BE)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '16px' }}>t</div>
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#1D1D1F', letterSpacing: '-0.3px' }}>targoo</span>
        </div>

        {/* Navigation */}
        <nav style={{ marginBottom: '32px' }}>
          {['Dashboard', 'Gap Analysis', 'Reports', 'Settings'].map((item) => {
            const key = item.toLowerCase();
            const isActive = activeNav === key;
            const Icon = key === 'dashboard' ? LayoutGrid : key.includes('gap') ? BarChart2 : key.includes('rep') ? FileText : Settings;
            return (
              <div 
                key={item} 
                style={s.navItem(isActive)}
                onClick={() => setActiveNav(key)}
              >
                <Icon size={18} strokeWidth={2} style={{ opacity: isActive ? 1 : 0.7 }} />
                {item}
              </div>
            );
          })}
        </nav>

        {/* Clients List */}
        <div style={{ padding: '0 12px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Clients</span>
          <Plus size={14} color="#86868B" style={{ cursor: 'pointer' }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {clients.map(client => (
            <div key={client.name} style={{
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: client.active ? '#FFFFFF' : 'transparent',
              boxShadow: client.active ? '0 1px 4px rgba(0,0,0,0.05)' : 'none',
              marginBottom: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: client.active ? '600' : '400', color: '#1D1D1F' }}>{client.name}</div>
                <div style={{ fontSize: '11px', color: '#86868B' }}>{client.industry}</div>
              </div>
              {client.active && <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#007AFF' }} />}
            </div>
          ))}
        </div>

        {/* User Profile */}
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

      {/* --- Center Content --- */}
      <main style={s.center}>
        {/* Header */}
        <header style={s.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#1D1D1F', margin: 0 }}>Müller GmbH</h1>
            <span style={{ backgroundColor: '#E1F7E3', color: '#34C759', fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '6px' }}>ACTIVE</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {(isLoading || isGeneratingReport) && <Loader2 className="animate-spin text-blue-500" size={20} />}
            <div style={{ position: 'relative' }}>
              <Search size={16} color="#86868B" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                placeholder="Search metrics..." 
                style={{ 
                  height: '32px', 
                  width: '240px', 
                  padding: '0 12px 0 34px', 
                  borderRadius: '8px', 
                  border: '1px solid #E5E5E5', 
                  backgroundColor: '#FFFFFF', 
                  fontSize: '13px', 
                  outline: 'none',
                  color: '#1D1D1F'
                }} 
              />
            </div>
          </div>
        </header>

        {/* Scrollable Dashboard Area */}
        <div style={s.centerContent}>
          
          {reportPath && (
            <div style={{ gridColumn: 'span 12', backgroundColor: '#E1F7E3', color: '#1D1D1F', padding: '12px 20px', borderRadius: '12px', border: '1px solid #34C759', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <CheckCircle2 size={20} color="#34C759" />
              <div style={{ fontSize: '13px' }}>
                <strong>Report Generated!</strong> Saved to: <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{reportPath}</span>
              </div>
            </div>
          )}

          {activeNav === 'dashboard' && (
            <>
              {/* ESG Score Card */}
              <div style={{ gridColumn: 'span 4' }}>
                <Card title="Overall ESG Score" style={{ height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                  <CircularProgress value={78} />
                  <div style={{ marginTop: '24px', textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', color: '#34C759', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      ▲ 4.2% <span style={{ color: '#86868B', fontWeight: '400' }}>vs last year</span>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Pillars Card */}
              <div style={{ gridColumn: 'span 8' }}>
                <Card title="Pillar Performance">
                  <div style={{ padding: '8px 0' }}>
                    <ProgressBar label="Environmental" value={68} color="#34C759" />
                    <ProgressBar label="Social" value={82} color="#007AFF" />
                    <ProgressBar label="Governance" value={74} color="#AF52DE" />
                  </div>
                  <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #F5F5F7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: '600', color: '#86868B', textTransform: 'uppercase' }}>Focus Area</div>
                      <div style={{ fontSize: '13px', color: '#1D1D1F', fontWeight: '500' }}>E3 Water Resources</div>
                    </div>
                    <button style={{ border: 'none', background: 'none', color: '#007AFF', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>View Details</button>
                  </div>
                </Card>
              </div>

              {/* CO2 Chart Card */}
              <div style={{ gridColumn: 'span 12' }}>
                <Card title="CO2 Intensity Trend (kg/unit)">
                  <div style={{ height: '240px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={co2Data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F5F5F7" />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#86868B'}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#86868B'}} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="co2" 
                          stroke="#007AFF" 
                          strokeWidth={3} 
                          dot={{ r: 4, fill: '#FFFFFF', stroke: '#007AFF', strokeWidth: 2 }} 
                          activeDot={{ r: 6 }} 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            </>
          )}

          {/* Gap Matrix Table Card */}
          {(activeNav === 'dashboard' || activeNav === 'gap analysis') && (
            <div style={{ gridColumn: 'span 12' }}>
              <Card title={activeNav === 'gap analysis' ? "Full ESRS Gap Analysis" : "ESRS Gap Analysis Matrix"} style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #F5F5F7', display: 'flex', justifyContent: 'flex-end' }}>
                  <button 
                    onClick={handleGenerateReport}
                    disabled={isGeneratingReport || gapData.length === 0}
                    style={{ 
                      backgroundColor: '#007AFF', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '8px', 
                      padding: '8px 16px', 
                      fontSize: '12px', 
                      fontWeight: '600', 
                      cursor: (isGeneratingReport || gapData.length === 0) ? 'not-allowed' : 'pointer',
                      opacity: (isGeneratingReport || gapData.length === 0) ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {isGeneratingReport ? <Loader2 className="animate-spin" size={14} /> : <FileText size={14} />}
                    Generate ESRS Report (.docx)
                  </button>
                </div>
                {isLoading && gapData.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center' }}>
                    <Loader2 className="animate-spin mx-auto text-blue-500 mb-2" size={24} />
                    <span style={{ fontSize: '13px', color: '#86868B' }}>Running deep engine analysis...</span>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '-1px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #E5E5E5', backgroundColor: '#FAFAFA' }}>
                        <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#86868B', textTransform: 'uppercase' }}>ID</th>
                        <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#86868B', textTransform: 'uppercase' }}>Topic</th>
                        <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#86868B', textTransform: 'uppercase' }}>Status</th>
                        <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '11px', fontWeight: '600', color: '#86868B', textTransform: 'uppercase' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(gapData || []).map((topic, i) => (
                        <tr key={topic.id} style={{ borderBottom: i !== gapData.length -1 ? '1px solid #F5F5F7' : 'none' }}>
                          <td style={{ padding: '16px 24px', fontSize: '13px', color: '#86868B', fontFamily: 'monospace' }}>{topic.id}</td>
                          <td style={{ padding: '16px 24px', fontSize: '13px', color: '#1D1D1F', fontWeight: '500' }}>{topic.name}</td>
                          <td style={{ padding: '16px 24px' }}>
                            <StatusBadge status={topic.status} />
                          </td>
                          <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                            <MoreHorizontal size={16} color="#86868B" style={{ cursor: 'pointer' }} />
                          </td>
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

      {/* --- Right AI Panel --- */}
      <aside style={s.rightPanel}>
        <div style={{ height: '64px', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', padding: '0 20px' }}>
          <MessageSquare size={18} color="#1D1D1F" style={{ marginRight: '10px' }} />
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#1D1D1F' }}>Advisor AI</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#FAFAFA' }}>
          {messages.map(msg => {
            const isAi = msg.sender === 'ai';
            return (
              <div key={msg.id} style={{
                alignSelf: isAi ? 'flex-start' : 'flex-end',
                maxWidth: '85%',
                backgroundColor: isAi ? '#FFFFFF' : '#007AFF',
                color: isAi ? '#1D1D1F' : '#FFFFFF',
                padding: '12px 16px',
                borderRadius: '16px',
                borderTopLeftRadius: isAi ? '4px' : '16px',
                borderBottomRightRadius: isAi ? '16px' : '4px',
                boxShadow: isAi ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
                border: isAi ? '1px solid #E5E5E5' : 'none',
                fontSize: '13px',
                lineHeight: '1.5',
              }}>
                {msg.text}
              </div>
            );
          })}
        </div>

        <div style={{ padding: '20px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E5E5E5' }}>
          <div style={{ position: 'relative' }}>
            <input 
              type="text" 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask about compliance..."
              style={{
                width: '100%',
                padding: '12px 40px 12px 16px',
                borderRadius: '24px',
                border: '1px solid #E5E5E5',
                fontSize: '13px',
                outline: 'none',
                backgroundColor: '#F5F5F7'
              }}
            />
            <button style={{ 
              position: 'absolute', 
              right: '8px', 
              top: '50%', 
              transform: 'translateY(-50%)', 
              border: 'none', 
              background: 'none', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Send size={16} color="#007AFF" />
            </button>
          </div>
          <div style={{ textAlign: 'center', marginTop: '12px' }}>
             <span style={{ fontSize: '10px', color: '#86868B', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Powered by DeepSeek-R1</span>
          </div>
        </div>
      </aside>
      
      {/* Global CSS for animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}} />
    </div>
  );
}
