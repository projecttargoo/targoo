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

// ── SVG ESG Ring ───────────────────────────────────────────────────────────
function ESGRing({ score = 74 }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center justify-center">
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
      <div className="flex gap-4 mt-1">
        {[["E", 68, "#10b981"], ["S", 82, "#3b82f6"], ["G", 72, "#8b5cf6"]].map(([l, v, c]) => (
          <div key={l} className="flex flex-col items-center gap-1">
            <span style={{ color: c }} className="text-xs font-bold">{l}</span>
            <span className="text-xs text-slate-500">{v}%</span>
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

  const trendColor = trend?.startsWith("+") ? "text-emerald-600" : "text-rose-500";

  return (
    <div
      className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex-1 min-w-0 transition-all duration-500"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="text-2xl">{icon}</div>
        {trend && <span className={`text-xs font-semibold ${trendColor}`}>{trend}</span>}
      </div>
      <div className="text-2xl font-bold text-slate-900 mb-0.5">{value}</div>
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Status Badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    critical: { bg: "bg-rose-50", text: "text-rose-600", dot: "bg-rose-500", label: "Critical" },
    warning: { bg: "bg-amber-50", text: "text-amber-600", dot: "bg-amber-400", label: "Review" },
    good: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "Compliant" },
  };
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
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
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-1000"
        style={{ width: `${width}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ── Chat Message ───────────────────────────────────────────────────────────
function ChatMsg({ msg }) {
  const isAI = msg.role === "ai";
  return (
    <div className={`flex gap-2.5 ${isAI ? "" : "flex-row-reverse"} mb-3`}>
      {isAI && (
        <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-xs">🧭</span>
        </div>
      )}
      <div
        className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isAI
            ? "bg-slate-50 text-slate-700 rounded-tl-sm border border-slate-100"
            : "bg-emerald-600 text-white rounded-tr-sm"
        }`}
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
    { id: "dashboard", icon: "⬛", label: "Dashboard" },
    { id: "gap", icon: "📊", label: "Gap Analysis" },
    { id: "reports", icon: "📄", label: "Reports" },
    { id: "settings", icon: "⚙️", label: "Settings" },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── LEFT SIDEBAR ── */}
      <aside className="w-60 bg-white border-r border-slate-100 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-sm">T</span>
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm leading-none">targoo</div>
              <div className="text-xs text-slate-400 mt-0.5">ESG Advisor</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-4 flex-shrink-0">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium mb-1 transition-all duration-150 text-left ${
                activeView === item.id
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Clients */}
        <div className="px-3 flex-shrink-0">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Clients</span>
            <button className="w-5 h-5 rounded-md bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-600 flex items-center justify-center text-xs transition-colors">+</button>
          </div>
          {clients.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveClient(c)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm mb-0.5 transition-all duration-150 text-left ${
                activeClient.id === c.id
                  ? "bg-slate-100 text-slate-800 font-medium"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${activeClient.id === c.id ? "bg-emerald-500" : "bg-slate-300"}`} />
              <span className="truncate">{c.name}</span>
              <span className="text-xs text-slate-400 ml-auto">{c.country}</span>
            </button>
          ))}
        </div>

        {/* Drag & Drop Zone */}
        <div className="px-3 mt-auto pb-4 pt-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); }}
            className={`rounded-2xl border-2 border-dashed p-4 text-center transition-all duration-200 cursor-pointer ${
              isDragging
                ? "border-emerald-400 bg-emerald-50"
                : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100"
            }`}
          >
            <div className={`text-2xl mb-1.5 transition-transform duration-200 ${isDragging ? "scale-110" : ""}`}>📂</div>
            <div className="text-xs font-semibold text-slate-600 mb-1">Drop files here</div>
            <div className="text-xs text-slate-400 leading-relaxed">Excel .xlsx • CSV<br />PDF • XML • SAP IDoc</div>
          </div>
        </div>
      </aside>

      {/* ── CENTER ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-4xl">

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-slate-900">{activeClient.name}</h1>
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full">CSRD 2024</span>
            </div>
            <p className="text-sm text-slate-500">Last updated: March 2025 · {activeClient.country} · ESRS Set 1</p>
          </div>

          {/* KPI Cards */}
          <div className="flex gap-4 mb-6">
            <KPICard icon="📈" label="ESG Score" value="74" sub="Target: 80 by 2025" trend="+4.2%" delay={0} />
            <KPICard icon="🌿" label="Carbon Footprint" value="198t" sub="Scope 1 & 2 only" trend="-12%" delay={100} />
            <KPICard icon="⚡" label="Energy Intensity" value="12.5k" sub="kWh per ton product" trend="+2.1%" delay={200} />
            <KPICard icon="👥" label="Workforce" value="340" sub="12% growth YoY" delay={300} />
          </div>

          {/* Charts Row */}
          <div className="flex gap-4 mb-6">
            {/* ESG Ring */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col items-center justify-center w-56 flex-shrink-0">
              <ESGRing score={74} />
              <div className="mt-3 w-full space-y-2">
                {[["Environmental", 68, "#10b981"], ["Social", 82, "#3b82f6"], ["Governance", 72, "#8b5cf6"]].map(([l, v, c], i) => (
                  <div key={l}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">{l}</span>
                      <span className="font-semibold text-slate-700">{v}%</span>
                    </div>
                    <AnimatedBar value={v} color={c} delay={i * 150} />
                  </div>
                ))}
              </div>
            </div>

            {/* CO2 Chart */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex-1">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">CO₂ Emissions Trend</h3>
                  <p className="text-xs text-slate-400">Dec 2023 – Dec 2024 (Monthly)</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full">
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
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 text-sm">ESRS Gap Analysis Matrix</h3>
              <span className="text-xs text-slate-400">8 standards · 3 critical</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-xs text-slate-400 uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-semibold">Standard</th>
                  <th className="text-left px-5 py-3 font-semibold">Topic</th>
                  <th className="text-left px-5 py-3 font-semibold">Score</th>
                  <th className="text-left px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {gapData.map((row, i) => (
                  <tr key={row.id} className={`border-t border-slate-50 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? "" : "bg-slate-50/30"}`}>
                    <td className="px-5 py-3 text-xs font-bold text-slate-400">{row.esrs}</td>
                    <td className="px-5 py-3 text-sm font-medium text-slate-700">{row.topic}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${row.score}%`,
                              backgroundColor: row.status === "good" ? "#10b981" : row.status === "warning" ? "#f59e0b" : "#ef4444",
                            }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">{row.score}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ── RIGHT SIDEBAR ── */}
      <aside className="w-72 bg-white border-l border-slate-100 flex flex-col flex-shrink-0">
        {/* Header */}
        <div className="px-4 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center">
              <span className="text-sm">🧭</span>
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm leading-none">CSRD Compass</div>
              <div className="text-xs text-slate-400 mt-0.5">AI-powered ESG navigator</div>
            </div>
          </div>
          <button
            onClick={() => setMessages(initialMessages)}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Clear
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {messages.map((msg) => <ChatMsg key={msg.id} msg={msg} />)}
          <div ref={chatEndRef} />
        </div>

        {/* Suggested questions */}
        <div className="px-4 pb-2">
          {["Why is ESRS E3 still red?", "Generate Scope 3 report"].map((q) => (
            <button
              key={q}
              onClick={() => setInput(q)}
              className="w-full text-left text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-xl mb-1.5 transition-colors font-medium"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl border border-slate-200 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100 transition-all px-3 py-2.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Ask about compliance..."
              className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none"
            />
            <button
              onClick={sendMessage}
              className="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center text-white transition-colors flex-shrink-0"
            >
              <span className="text-xs">↑</span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
