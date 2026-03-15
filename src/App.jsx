import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";

// ── Demo Data ──────────────────────────────────────────────────────────────
const DEMO_CLIENT = {
  name: "Hans GmbH Demo",
  industry: "Manufacturing",
  country: "DE",
  employees: 340,
  revenue: "€42M",
  year: 2024,
};

const co2Data = [
  { month: "Jan", value: 245 }, { month: "Feb", value: 238 },
  { month: "Mar", value: 252 }, { month: "Apr", value: 241 },
  { month: "May", value: 228 }, { month: "Jun", value: 219 },
  { month: "Jul", value: 215 }, { month: "Aug", value: 210 },
  { month: "Sep", value: 207 }, { month: "Oct", value: 203 },
  { month: "Nov", value: 199 }, { month: "Dec", value: 198 },
];

const gapData = [
  { id: "E1", topic: "Climate Change", status: "critical", score: 42, esrs: "ESRS E1" },
  { id: "E2", topic: "Pollution", status: "warning", score: 67, esrs: "ESRS E2" },
  { id: "E3", topic: "Water & Marine", status: "critical", score: 38, esrs: "ESRS E3" },
  { id: "E4", topic: "Biodiversity", status: "warning", score: 71, esrs: "ESRS E4" },
  { id: "E5", topic: "Resource Use", status: "good", score: 84, esrs: "ESRS E5" },
  { id: "S1", topic: "Own Workforce", status: "good", score: 88, esrs: "ESRS S1" },
  { id: "S2", topic: "Value Chain", status: "warning", score: 61, esrs: "ESRS S2" },
  { id: "G1", topic: "Business Conduct", status: "good", score: 79, esrs: "ESRS G1" },
];

const clients = [
  { id: 1, name: "Hans GmbH Demo", country: "DE", active: true },
  { id: 2, name: "Müller & Partner", country: "AT", active: false },
  { id: 3, name: "Schweizer AG", country: "CH", active: false },
];

const initialMessages = [
  {
    id: 1,
    role: "ai",
    text: "Guten Tag! I've analyzed Hans GmbH's 2024 data. CO₂ intensity dropped 12% YoY to 198t — excellent progress. However, ESRS E3 Water remains critical: documented reuse metrics are missing for the Munich site.",
    time: "now",
  },
];

const styles = {
  app: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    backgroundColor: '#f8fafc',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    overflow: 'hidden',
    color: '#1e293b'
  },
  sidebarLeft: {
    width: '240px',
    minWidth: '240px',
    backgroundColor: '#ffffff',
    borderRight: '1px solid #f1f5f9',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0
  },
  sidebarRight: {
    width: '288px',
    minWidth: '288px',
    backgroundColor: '#ffffff',
    borderLeft: '1px solid #f1f5f9',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0
  },
  main: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  contentWrapper: {
    maxWidth: '896px',
    width: '100%'
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    border: '1px solid #f1f5f9'
  },
  navItem: (active) => ({
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '4px',
    transition: 'all 150ms',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    backgroundColor: active ? '#ecfdf5' : 'transparent',
    color: active ? '#047857' : '#64748b'
  }),
  kpiRow: {
    display: 'flex',
    gap: '16px',
    marginBottom: '24px'
  },
  chartRow: {
    display: 'flex',
    gap: '16px',
    marginBottom: '24px'
  }
};

// ── SVG ESG Ring ───────────────────────────────────────────────────────────
function ESGRing({ score = 74 }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
        <circle
          cx="70" cy="70" r={r} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
          style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)" }}
        />
        <text x="70" y="66" textAnchor="middle" fontSize="28" fontWeight="700" fill="#0f172a">{score}</text>
        <text x="70" y="84" textAnchor="middle" fontSize="11" fill="#94a3b8" fontWeight="500">ESG SCORE</text>
      </svg>
      <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
        {[["E", 68, "#10b981"], ["S", 82, "#3b82f6"], ["G", 72, "#8b5cf6"]].map(([l, v, c]) => (
          <div key={l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: c, fontSize: '12px', fontWeight: 'bold' }}>{l}</span>
            <span style={{ fontSize: '12px', color: '#64748b' }}>{v}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────
function KPICard({ icon, label, value, sub, trend, color, delay = 0 }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  const trendColor = trend?.startsWith("+") ? "#059669" : "#e11d48";

  return (
    <div
      style={{
        ...styles.card,
        flex: 1,
        minWidth: 0,
        transition: 'all 500ms',
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ fontSize: '24px' }}>{icon}</div>
        {trend && <span style={{ fontSize: '12px', fontWeight: '600', color: trendColor }}>{trend}</span>}
      </div>
      <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a', marginBottom: '2px' }}>{value}</div>
      <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      {sub && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{sub}</div>}
    </div>
  );
}

// ── Status Badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    critical: { bg: "#fff1f2", text: "#e11d48", dot: "#f43f5e", label: "Critical" },
    warning: { bg: "#fffbeb", text: "#d97706", dot: "#fbbf24", label: "Review" },
    good: { bg: "#ecfdf5", text: "#047857", dot: "#10b981", label: "Compliant" },
  };
  const s = map[status];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 10px',
      borderRadius: '9999px',
      fontSize: '12px',
      fontWeight: '600',
      backgroundColor: s.bg,
      color: s.text
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: s.dot }} />
      {s.label}
    </span>
  );
}

// ── Progress Bar ───────────────────────────────────────────────────────────
function AnimatedBar({ value, color, delay = 0 }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(value), delay + 300);
    return () => clearTimeout(t);
  }, [value, delay]);

  return (
    <div style={{ height: '8px', backgroundColor: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
      <div
        style={{
          height: '100%',
          borderRadius: '9999px',
          transition: 'all 1000ms',
          width: `${width}%`,
          backgroundColor: color
        }}
      />
    </div>
  );
}

// ── Chat Message ───────────────────────────────────────────────────────────
function ChatMsg({ msg }) {
  const isAI = msg.role === "ai";
  return (
    <div style={{ display: 'flex', gap: '10px', flexDirection: isAI ? 'row' : 'row-reverse', marginBottom: '12px' }}>
      {isAI && (
        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          backgroundColor: '#ecfdf5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: '2px'
        }}>
          <span style={{ fontSize: '12px' }}>🧭</span>
        </div>
      )}
      <div
        style={{
          maxWidth: '85%',
          padding: '10px 14px',
          borderRadius: '16px',
          fontSize: '14px',
          lineHeight: '1.5',
          backgroundColor: isAI ? '#f8fafc' : '#059669',
          color: isAI ? '#334155' : '#ffffff',
          border: isAI ? '1px solid #f1f5f9' : 'none',
          borderTopLeftRadius: isAI ? '4px' : '16px',
          borderTopRightRadius: isAI ? '16px' : '4px'
        }}
      >
        {msg.text}
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [activeView, setActiveView] = useState("dashboard");
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [activeClient, setActiveClient] = useState(clients[0]);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { id: Date.now(), role: "user", text: input, time: "now" };
    setMessages((m) => [...m, userMsg]);
    setInput("");

    try {
      const response = await invoke("ask_ai", { question: input });
      setMessages((m) => [...m, { id: Date.now() + 1, role: "ai", text: response, time: "now" }]);
    } catch {
      setMessages((m) => [...m, {
        id: Date.now() + 1, role: "ai",
        text: "I'm operating in offline mode. The AI engine is loading — please wait a moment.",
        time: "now",
      }]);
    }
  };

  const navItems = [
    { id: "dashboard", icon: "🏠", label: "Dashboard" },
    { id: "gap", icon: "📊", label: "Gap Analysis" },
    { id: "reports", icon: "📄", label: "Reports" },
    { id: "settings", icon: "⚙️", label: "Settings" },
  ];

  return (
    <div style={styles.app}>

      {/* ── LEFT SIDEBAR ── */}
      <aside style={styles.sidebarLeft}>
        {/* Logo */}
        <div style={{padding: '20px 16px 16px', borderBottom: '1px solid #f1f5f9', textAlign: 'center'}}>
          <img src="/targoo-logo.png" style={{width: '100%', maxWidth: '180px', height: 'auto', display: 'block', margin: '0 auto 6px auto'}} alt="targoo" />
          <p style={{fontSize: '10px', color: '#9ca3af', textAlign: 'center', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0}}>ESG Advisor Engine</p>
        </div>

        {/* Navigation */}
        <nav style={{ padding: '16px 12px', flexShrink: 0 }}>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              style={styles.navItem(activeView === item.id)}
            >
              <span style={{ fontSize: '16px' }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Clients */}
        <div style={{ padding: '0 12px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'between', padding: '0 8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontStyle: 'normal', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Clients</span>
            <button style={{
              width: '20px',
              height: '20px',
              borderRadius: '6px',
              backgroundColor: '#f1f5f9',
              color: '#64748b',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              marginLeft: 'auto'
            }}>+</button>
          </div>
          {clients.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveClient(c)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                borderRadius: '12px',
                fontSize: '14px',
                marginBottom: '2px',
                transition: 'all 150ms',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                backgroundColor: activeClient.id === c.id ? '#f1f5f9' : 'transparent',
                color: activeClient.id === c.id ? '#1e293b' : '#64748b',
                fontWeight: activeClient.id === c.id ? '500' : 'normal'
              }}
            >
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                flexShrink: 0,
                backgroundColor: activeClient.id === c.id ? '#10b981' : '#cbd5e1'
              }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
              <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: 'auto' }}>{c.country}</span>
            </button>
          ))}
        </div>

        {/* Drag & Drop Zone */}
        <div style={{ padding: '12px', marginTop: 'auto', paddingBottom: '16px', paddingTop: '12px' }}>
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); }}
            style={{
              borderRadius: '16px',
              border: '2px dashed',
              padding: '16px',
              textAlign: 'center',
              transition: 'all 200ms',
              cursor: 'pointer',
              borderColor: isDragging ? '#34d399' : '#e2e8f0',
              backgroundColor: isDragging ? '#ecfdf5' : '#f8fafc'
            }}
          >
            <div style={{ fontSize: '24px', marginBottom: '6px', transition: 'transform 200ms', transform: isDragging ? 'scale(1.1)' : 'scale(1)' }}>📂</div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>Drop files here</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: '1.5' }}>Excel .xlsx • CSV<br />PDF • XML • SAP IDoc</div>
          </div>
        </div>
      </aside>

      {/* ── CENTER ── */}
      <main style={styles.main}>
        <div style={styles.contentWrapper}>

          {/* Header */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>{activeClient.name}</h1>
              <span style={{ padding: '4px 10px', backgroundColor: '#ecfdf5', color: '#047857', fontSize: '12px', fontWeight: '600', borderRadius: '9999px' }}>CSRD 2024</span>
            </div>
            <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>Last updated: March 2025 · {activeClient.country} · ESRS Set 1</p>
          </div>

          {/* Next Actions & Status Row */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
            {/* NEXT ACTIONS panel */}
            <div style={{ 
              flex: 1, 
              backgroundColor: '#fff7ed', 
              borderRadius: '16px', 
              padding: '20px', 
              border: '1px solid #ffedd5' 
            }}>
              <h3 style={{ fontSize: '12px', fontWeight: 'bold', color: '#9a3412', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 0, marginBottom: '12px' }}>⚠️ Next Actions</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {[
                  "ESRS E3 Water missing → Upload water consumption data",
                  "Scope 3 incomplete → Generate supplier request",
                  "3 standards critical → Open Gap Analysis"
                ].map((action, i) => (
                  <li key={i} style={{ fontSize: '13px', color: '#c2410c', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}>
                    <span style={{ fontSize: '14px' }}>⚠</span> {action}
                  </li>
                ))}
              </ul>
            </div>

            {/* CSRD COMPLIANCE STATUS card */}
            <div style={{ ...styles.card, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  borderRadius: '50%', 
                  border: '4px solid #fef3c7', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: '20px',
                  backgroundColor: '#fffbeb'
                }}>🟡</div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>In Progress</div>
                  <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>8 standards compliant · 3 critical gaps</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Deadline: Jan 2025</div>
                </div>
              </div>
            </div>
          </div>

          {/* Countdown & Data Quality Row */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center' }}>
            {/* Deadline Countdown */}
            <div style={{ flex: 1, backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>CSRD Filing Deadline</span>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#e11d48' }}>312 days remaining</span>
              </div>
              <div style={{ height: '8px', backgroundColor: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '65%', backgroundColor: '#10b981', borderRadius: '9999px' }} />
              </div>
            </div>

            {/* Data Quality */}
            <div style={{ flex: 1, backgroundColor: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-around' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>Completeness</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a' }}>82%</div>
              </div>
              <div style={{ width: '1px', backgroundColor: '#f1f5f9' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>Missing datasets</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#e11d48' }}>4</div>
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div style={styles.kpiRow}>
            <KPICard icon="📈" label="ESG Score" value="74" sub="Target: 80 by 2025" trend="+4.2%" delay={0} />
            <KPICard icon="🌿" label="Carbon Footprint" value="198t" sub="Scope 1 & 2 only" trend="-12%" delay={100} />
            <KPICard icon="⚡" label="Energy Intensity" value="12.5k" sub="kWh per ton product" trend="+2.1%" delay={200} />
            <KPICard icon="👥" label="Workforce" value="340" sub="12% growth YoY" delay={300} />
          </div>

          {/* Quick Actions Row */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            <button style={{ 
              flex: 1, 
              padding: '12px', 
              borderRadius: '12px', 
              backgroundColor: '#10b981', 
              color: 'white', 
              border: 'none', 
              fontWeight: '600', 
              fontSize: '14px', 
              cursor: 'pointer' 
            }}>Generate CSRD Report</button>
            <button style={{ 
              flex: 1, 
              padding: '12px', 
              borderRadius: '12px', 
              backgroundColor: '#3b82f6', 
              color: 'white', 
              border: 'none', 
              fontWeight: '600', 
              fontSize: '14px', 
              cursor: 'pointer' 
            }}>Run Gap Analysis</button>
            <button style={{ 
              flex: 1, 
              padding: '12px', 
              borderRadius: '12px', 
              backgroundColor: '#94a3b8', 
              color: 'white', 
              border: 'none', 
              fontWeight: '600', 
              fontSize: '14px', 
              cursor: 'pointer' 
            }}>Export Word</button>
          </div>

          {/* Charts Row */}
          <div style={styles.chartRow}>
            {/* ESG Ring */}
            <div style={{ ...styles.card, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '224px', flexShrink: 0 }}>
              <ESGRing score={74} />
              <div style={{ marginTop: '12px', width: '100%' }}>
                {[["Environmental", 68, "#10b981"], ["Social", 82, "#3b82f6"], ["Governance", 72, "#8b5cf6"]].map(([l, v, c], i) => (
                  <div key={l} style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span style={{ color: '#64748b' }}>{l}</span>
                      <span style={{ fontWeight: '600', color: '#334155' }}>{v}%</span>
                    </div>
                    <AnimatedBar value={v} color={c} delay={i * 150} />
                  </div>
                ))}
              </div>
            </div>

            {/* CO2 Chart */}
            <div style={{ ...styles.card, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontWeight: '600', color: '#0f172a', fontSize: '14px', margin: 0 }}>CO₂ Emissions Trend</h3>
                  <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Dec 2023 – Dec 2024 (Monthly)</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#059669', fontWeight: '600', backgroundColor: '#ecfdf5', padding: '4px 10px', borderRadius: '9999px' }}>
                  ↓ MIN: 198t
                </div>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={co2Data}>
                  <defs>
                    <linearGradient id="co2grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} domain={[0, 280]} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                  <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fill="url(#co2grad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ESRS Gap Matrix */}
          <div style={{ ...styles.card, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontWeight: '600', color: '#0f172a', fontSize: '14px', margin: 0 }}>ESRS Gap Analysis Matrix</h3>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>8 standards · 3 critical</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ textAlign: 'left', padding: '12px 20px', fontWeight: '600' }}>Standard</th>
                  <th style={{ textAlign: 'left', padding: '12px 20px', fontWeight: '600' }}>Topic</th>
                  <th style={{ textAlign: 'left', padding: '12px 20px', fontWeight: '600' }}>Score</th>
                  <th style={{ textAlign: 'left', padding: '12px 20px', fontWeight: '600' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {gapData.map((row, i) => (
                  <tr key={row.id} style={{ borderTop: '1px solid #f8fafc', backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(248, 250, 252, 0.3)' }}>
                    <td style={{ padding: '12px 20px', fontSize: '12px', fontStyle: 'normal', fontWeight: 'bold', color: '#94a3b8' }}>{row.esrs}</td>
                    <td style={{ padding: '12px 20px', fontSize: '14px', fontWeight: '500', color: '#334155' }}>{row.topic}</td>
                    <td style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '64px', height: '6px', backgroundColor: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              borderRadius: '9999px',
                              width: `${row.score}%`,
                              backgroundColor: row.status === "good" ? "#10b981" : row.status === "warning" ? "#f59e0b" : "#ef4444",
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>{row.score}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 20px' }}><StatusBadge status={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ── RIGHT SIDEBAR ── */}
      <aside style={styles.sidebarRight}>
        {/* Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '14px' }}>🧭</span>
            </div>
            <div>
              <div style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '14px', lineHeight: '1' }}>CSRD Compass</div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>AI-powered ESG navigator</div>
            </div>
          </div>
          <button
            onClick={() => setMessages(initialMessages)}
            style={{ fontSize: '12px', color: '#94a3b8', border: 'none', background: 'none', cursor: 'pointer' }}
          >
            Clear
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column' }}>
          {messages.map((msg) => <ChatMsg key={msg.id} msg={msg} />)}
          <div ref={chatEndRef} />
        </div>

        {/* Suggested questions */}
        <div style={{ padding: '0 16px', paddingBottom: '8px' }}>
          {["Why is ESRS E3 still red?", "Generate Scope 3 report"].map((q) => (
            <button
              key={q}
              onClick={() => setInput(q)}
              style={{
                width: '100%',
                textAlign: 'left',
                fontSize: '12px',
                color: '#047857',
                backgroundColor: '#ecfdf5',
                padding: '8px 12px',
                borderRadius: '12px',
                marginBottom: '6px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={{ padding: '0 16px', paddingBottom: '16px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#f8fafc',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '10px 12px'
          }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Ask about compliance..."
              style={{
                flex: 1,
                backgroundColor: 'transparent',
                border: 'none',
                fontSize: '14px',
                color: '#334155',
                outline: 'none'
              }}
            />
            <button
              onClick={sendMessage}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                backgroundColor: '#059669',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                cursor: 'pointer'
              }}
            >
              <span style={{ fontSize: '12px' }}>↑</span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
