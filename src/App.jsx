import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { demoData } from './demoData';
import targooLogo from './assets/targoo-logo.png';
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
  Download,
  Compass,
  TrendingUp,
  Leaf,
  AlertTriangle,
  Trash2,
  PlusCircle
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine,
  AreaChart,
  Area
} from 'recharts';

// --- Styled Components / Helpers ---

const Card = ({ children, className = "", delay = 0 }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all duration-500 transform ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'} ${className}`}>
      {children}
    </div>
  );
};

const KPICard = ({ title, value, sub, icon: Icon, color, trend, delay }) => (
  <Card className="flex flex-col h-full" delay={delay}>
    <div className="flex justify-between items-start mb-2">
      <div className={`p-2 rounded-lg ${color} bg-opacity-10 text-${color.split('-')[1]}-600`}>
        <Icon size={20} />
      </div>
      {trend && (
        <div className="flex items-center text-xs font-semibold text-emerald-600">
          <TrendingUp size={14} className="mr-1" />
          {trend}
        </div>
      )}
    </div>
    <div className="text-2xl font-bold text-gray-900">{value}</div>
    <div className="text-xs font-medium text-gray-400 mt-1 uppercase tracking-wider">{title}</div>
    <div className="text-[10px] text-gray-500 mt-2">{sub}</div>
  </Card>
);

const ESGRing = ({ scores }) => {
  const [hovered, setHovered] = useState(null);
  const size = 180;
  const center = size / 2;
  const radius = 70;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;
  
  const segments = [
    { label: 'Environmental', value: scores.environmental, color: '#10b981', key: 'E' },
    { label: 'Social', value: scores.social, color: '#3b82f6', key: 'S' },
    { label: 'Governance', value: scores.governance, color: '#8b5cf6', key: 'G' }
  ];

  return (
    <div className="relative flex flex-col items-center justify-center py-4">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#f3f4f6" strokeWidth={strokeWidth} />
        {segments.map((s, i) => {
          const offset = circumference - (s.value / 100) * circumference;
          return (
            <circle 
              key={s.key}
              cx={center} cy={center} r={radius} fill="none" 
              stroke={s.color} strokeWidth={strokeWidth} strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-1000 ease-out cursor-pointer hover:opacity-80"
              onMouseEnter={() => setHovered(s)}
              onMouseLeave={() => setHovered(null)}
              style={{ filter: hovered && hovered.key !== s.key ? 'grayscale(0.5) opacity(0.3)' : 'none' }}
            />
          );
        })}
      </svg>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
        <div className="text-3xl font-extrabold text-gray-900">{scores.total}</div>
        <div className="text-[10px] font-bold text-gray-400 uppercase">ESG SCORE</div>
      </div>
      {hovered && (
        <div className="absolute -bottom-2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded shadow-lg animate-in fade-in zoom-in duration-200">
          {hovered.label}: {hovered.value}%
        </div>
      )}
    </div>
  );
};

const CustomProgressBar = ({ label, value, color, delay }) => {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setWidth(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-semibold text-gray-700">{label}</span>
        <span className="text-xs font-bold text-gray-900">{value}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} rounded-full transition-all duration-1000 ease-out`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
};

// --- Main App Component ---

export default function App() {
  const [modelStatus, setModelStatus] = useState('checking');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [activeNav, setActiveNav] = useState('dashboard');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatHistory] = useState([]);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [clients, setClients] = useState([]);
  const [activeClient, setActiveClient] = useState(null);
  const [gapData, setGapData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [license, setLicense] = useState(demoData.license);
  const chatEndRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      const status = await invoke('check_model');
      setModelStatus(status);
      if (status === 'not_found') startModelDownload();
    };
    init();

    const unlistenProgress = listen('download_progress', (event) => {
      setDownloadProgress(event.payload);
      if (event.payload >= 100) setTimeout(() => setModelStatus('ready'), 1500);
    });

    const savedClients = localStorage.getItem('targoo_clients');
    if (savedClients) {
      const parsed = JSON.parse(savedClients);
      setClients(parsed);
      setActiveClient(parsed[0]);
    } else {
      setClients([demoData.company]);
      setActiveClient(demoData.company);
    }

    // Proactive greeting
    setTimeout(() => {
      setChatHistory([demoData.aiHistory[0]]);
    }, 1000);

    return () => {
      unlistenProgress.then(f => f());
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const startModelDownload = async () => {
    setModelStatus('downloading');
    try { await invoke('download_model'); }
    catch (e) { setModelStatus('not_found'); }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    const userMessage = { id: Date.now(), sender: 'user', text: chatInput };
    setChatHistory(prev => [...prev, userMessage]);
    setChatInput('');
    setIsAiTyping(true);
    try {
      const response = await invoke('ask_ai', { question: chatInput });
      const parts = response.split('---');
      setChatHistory(prev => [...prev, { 
        id: Date.now() + 1, 
        sender: 'ai', 
        text: parts[0].trim(), 
        citations: parts[1]?.trim() || '' 
      }]);
    } catch (e) {
      setChatHistory(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: "Engine offline. Please check model status." }]);
    } finally {
      setIsAiTyping(false);
    }
  };

  const runGapAnalysis = async () => {
    setIsLoading(true);
    try {
      const response = await invoke('gap_analysis', { input: { 
        company_size: activeClient?.employees || '150', 
        sector: activeClient?.sector || 'Manufacturing', 
        country: 'DE' 
      } });
      const parsed = JSON.parse(response);
      const topics = Object.entries(parsed.topics).map(([name, status], idx) => ({ 
        id: `E${idx + 1}`, name, status, action: "Analysis pending" 
      }));
      setGapData(topics);
    } catch (e) {
      setGapData(demoData.gapMatrix);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => setChatHistory([demoData.aiHistory[0]]);

  if (modelStatus === 'checking') {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-white">
        <div className="w-16 h-16 relative">
          <div className="absolute inset-0 border-4 border-emerald-100 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <div className="mt-4 text-emerald-800 font-medium tracking-tight">Initializing Targoo Engine...</div>
      </div>
    );
  }

  if (modelStatus === 'not_found' || modelStatus === 'downloading') {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-gray-50 font-sans">
        <div className="w-20 h-20 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-200 mb-8 transform hover:scale-105 transition-transform duration-500">
          <span className="text-white text-5xl font-black">t</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Setting up CSRD Core</h2>
        <p className="text-gray-500 mb-8 max-w-xs text-center">Downloading local ESG knowledge base (Gemma 3 1B). No cloud data leak.</p>
        <div className="w-64">
          <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-emerald-500 transition-all duration-300 ease-out" style={{ width: `${downloadProgress}%` }} />
          </div>
          <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            <span>{Math.floor(downloadProgress)}% COMPLETE</span>
            <span>PROCEEDING...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-gray-50 text-gray-900 font-sans overflow-hidden">
      
      {/* LEFT SIDEBAR */}
      <aside className="w-[260px] min-w-[260px] bg-white border-r border-gray-100 flex flex-col z-20">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-1">
            <img src="/src/assets/targoo-logo.png" style={{height: '36px', width: 'auto'}} alt="Targoo" />
            <span className="text-lg font-black tracking-tighter">targoo</span>
          </div>
          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] ml-1">ESG Advisor</div>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
            { id: 'gap-analysis', label: 'Gap Analysis', icon: BarChart2 },
            { id: 'reports', label: 'Reports', icon: FileText },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveNav(item.id);
                if (item.id === 'gap-analysis') runGapAnalysis();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                activeNav === item.id 
                  ? 'bg-emerald-50 text-emerald-700 font-semibold shadow-sm' 
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon size={18} className={activeNav === item.id ? 'text-emerald-600' : 'text-gray-400 group-hover:text-gray-600'} />
              <span className="text-sm">{item.label}</span>
            </button>
          ))}

          <div className="pt-8 pb-2 px-3 flex justify-between items-center">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Clients</span>
            <button className="text-emerald-600 hover:bg-emerald-50 p-1 rounded-md transition-colors">
              <PlusCircle size={16} />
            </button>
          </div>
          
          <div className="space-y-1">
            {clients.map(client => (
              <button 
                key={client.name}
                onClick={() => setActiveClient(client)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                  activeClient?.name === client.name 
                    ? 'bg-gray-50 text-gray-900 font-medium' 
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${client.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                  {client.name}
                </div>
                <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </nav>

        {/* Drag & Drop Zone */}
        <div className="p-4 mt-auto">
          <div className="group relative border-2 border-dashed border-gray-200 rounded-xl p-6 transition-all duration-300 hover:border-emerald-400 hover:bg-emerald-50 hover:bg-opacity-30 cursor-pointer overflow-hidden animate-pulse hover:animate-none">
            <div className="flex flex-col items-center text-center">
              <FileUp className="text-gray-400 group-hover:text-emerald-500 group-hover:animate-bounce mb-2 transition-colors" size={24} />
              <div className="text-xs font-bold text-gray-600 mb-1">Drop files here</div>
              <div className="text-[9px] text-gray-400 leading-tight">
                Excel .xlsx • CSV • PDF<br/>XML • SAP IDoc
              </div>
            </div>
            {/* Pulse Ring */}
            <div className="absolute inset-0 bg-emerald-400 opacity-0 group-hover:animate-ping rounded-xl pointer-events-none" />
          </div>
        </div>
      </aside>

      {/* CENTER CONTENT */}
      <main className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden">
        <header className="h-16 px-8 flex items-center justify-between border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-none">{activeClient?.name || "Hans GmbH Demo"}</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">CSRD Reporting 2024</p>
          </div>
          <div className="flex items-center gap-4">
            {isLoading && <Loader2 className="animate-spin text-emerald-600" size={18} />}
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs">PH</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 scroll-smooth">
          {activeNav === 'dashboard' && (
            <div className="max-w-6xl mx-auto space-y-6">
              
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard 
                  title="ESG Score" value="74" trend="+4.2%" 
                  sub="Target: 80 by 2025" icon={TrendingUp} color="bg-emerald-500" delay={0} 
                />
                <KPICard 
                  title="Carbon Footprint" value="198t" trend="-12%" 
                  sub="Scope 1 & 2 only" icon={Leaf} color="bg-blue-500" delay={100} 
                />
                <KPICard 
                  title="Energy Intensity" value="12.5k" trend="+2.1%" 
                  sub="kWh per ton product" icon={Zap} color="bg-yellow-500" delay={200} 
                />
                <KPICard 
                  title="Workforce" value="340" 
                  sub="12% growth YoY" icon={Users} color="bg-purple-500" delay={300} 
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Main Chart */}
                <Card className="lg:col-span-8 p-6" delay={400}>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">CO2 Emissions Trend</h3>
                      <p className="text-xs text-gray-500">Dec 2023 - Dec 2024 (Monthly)</p>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 rounded text-[10px] font-bold text-gray-600">
                        <Leaf size={10} className="text-emerald-500" /> MIN: 198t
                      </div>
                      <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 rounded text-[10px] font-bold text-gray-600">
                        <AlertTriangle size={10} className="text-amber-500" /> MAX: 245t
                      </div>
                    </div>
                  </div>
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={demoData.co2Trend}>
                        <defs>
                          <linearGradient id="colorCo2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis 
                          dataKey="month" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fontSize: 10, fontWeight: 600, fill: '#9ca3af'}} 
                          dy={10}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fontSize: 10, fontWeight: 600, fill: '#9ca3af'}} 
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '10px' }}
                          itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                        />
                        <Area type="monotone" dataKey="co2" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCo2)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                {/* ESG Ring Card */}
                <Card className="lg:col-span-4 p-6 flex flex-col items-center justify-between" delay={500}>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2 self-start">Pillar Analysis</h3>
                  <ESGRing scores={demoData.scores} />
                  <div className="w-full mt-4 space-y-2">
                    <CustomProgressBar label="Environmental" value={demoData.scores.environmental} color="bg-emerald-500" delay={600} />
                    <CustomProgressBar label="Social" value={demoData.scores.social} color="bg-blue-500" delay={700} />
                    <CustomProgressBar label="Governance" value={demoData.scores.governance} color="bg-purple-500" delay={800} />
                  </div>
                </Card>
              </div>

              {/* Bottom Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6" delay={600}>
                  <div className="flex items-center gap-2 mb-4">
                    <ShieldCheck className="text-emerald-600" size={18} />
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Compliance Status</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-[10px]">CSRD</div>
                        <div>
                          <div className="text-xs font-bold">ESRS Data Completeness</div>
                          <div className="text-[10px] text-gray-500">8 of 10 material topics mapped</div>
                        </div>
                      </div>
                      <div className="text-xs font-bold text-emerald-600">80%</div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-[10px]">L1-6</div>
                        <div>
                          <div className="text-xs font-bold">Engine Processing Status</div>
                          <div className="text-[10px] text-gray-500">Real-time inference ready</div>
                        </div>
                      </div>
                      <CheckCircle2 size={16} className="text-emerald-500" />
                    </div>
                  </div>
                </Card>

                <Card className="p-6" delay={700}>
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="text-amber-500" size={18} />
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Upcoming Tasks</h3>
                  </div>
                  <div className="space-y-3">
                    {[
                      { t: "E3 Water Disclosure Verification", d: "Due in 3 days", p: "High" },
                      { t: "G1 Governance Audit Review", d: "Due in 1 week", p: "Medium" }
                    ].map((task, i) => (
                      <div key={i} className="flex items-start gap-3 pb-3 border-b border-gray-50 last:border-0">
                        <div className={`mt-1 w-1.5 h-1.5 rounded-full ${task.p === 'High' ? 'bg-red-500' : 'bg-amber-500'}`} />
                        <div>
                          <div className="text-xs font-semibold">{task.t}</div>
                          <div className="text-[10px] text-gray-400 font-medium">{task.d}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

            </div>
          )}

          {activeNav === 'gap-analysis' && (
            <div className="max-w-6xl mx-auto">
              <Card className="p-0 overflow-hidden" delay={0}>
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">ESRS Gap Analysis Matrix</h3>
                  <button onClick={runGapAnalysis} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors">
                    <Zap size={14} fill="white" /> Reroute Analysis
                  </button>
                </div>
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Standard ID</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Topic / Disclosure Requirement</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Compliance Status</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Action Required</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(gapData.length > 0 ? gapData : demoData.gapMatrix).map((row, i) => (
                      <tr key={row.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="px-6 py-4 text-xs font-bold text-gray-900">{row.id}</td>
                        <td className="px-6 py-4">
                          <div className="text-xs font-medium text-gray-800">{row.name}</div>
                          <div className="text-[10px] text-gray-400">CSRD / ESRS 1.2 Compliance</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            row.status === 'green' ? 'bg-emerald-100 text-emerald-700' : 
                            row.status === 'red' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            <div className={`w-1 h-1 rounded-full ${
                              row.status === 'green' ? 'bg-emerald-500' : 
                              row.status === 'red' ? 'bg-red-500' : 'bg-amber-500'
                            }`} />
                            {row.status}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-[10px] font-bold text-emerald-600 hover:underline">VIEW REMEDIES</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}
        </div>
      </main>

      {/* RIGHT SIDEBAR (AI COMPASS) */}
      <aside className="w-[300px] min-w-[300px] bg-white border-l border-gray-100 flex flex-col z-20">
        <header className="p-6 border-b border-gray-100 bg-white">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Compass className="text-emerald-600" size={18} />
              <span className="text-sm font-bold text-gray-900 tracking-tight">CSRD Compass</span>
            </div>
            <button onClick={clearChat} className="text-gray-400 hover:text-red-500 transition-colors" title="Clear Chat">
              <Trash2 size={14} />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 font-medium leading-tight">Your AI-powered ESG navigator</p>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-200">
          {chatMessages.map((msg, i) => (
            <div 
              key={msg.id} 
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className={`max-w-[90%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed shadow-sm ${
                msg.sender === 'user' 
                  ? 'bg-emerald-600 text-white rounded-tr-none' 
                  : 'bg-white border border-gray-100 text-gray-800 rounded-tl-none'
              }`}>
                {msg.text}
              </div>
              {msg.citations && (
                <div className="mt-1 flex gap-1 flex-wrap">
                  {msg.citations.split(',').map((c, idx) => (
                    <span key={idx} className="px-1.5 py-0.5 bg-gray-100 rounded text-[9px] font-bold text-gray-500 uppercase tracking-tighter">
                      {c.trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {isAiTyping && (
            <div className="flex gap-1.5 p-2 animate-pulse">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 bg-white border-t border-gray-100">
          <div className="relative">
            <input 
              type="text" 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              placeholder="Ask about compliance..."
              className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-600 transition-all placeholder:text-gray-400 pr-10"
            />
            <button 
              onClick={handleSendChat}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </aside>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeInScale { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #f3f4f6; border-radius: 20px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #e5e7eb; }
      `}} />
    </div>
  );
}
