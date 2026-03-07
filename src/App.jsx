import React, { useState } from 'react';

export default function App() {
  const [activeClient, setActiveClient] = useState('Müller GmbH');
  const [score, setScore] = useState(78);
  const [chatInput, setChatInput] = useState("");

  const clients = [
    { name: 'Müller GmbH', score: 78 },
    { name: 'Banen GmbH', score: 62 },
    { name: 'Karken GmbH', score: 85 }
  ];

  return (
    <div className="flex h-screen w-full bg-[#f5f5f7]/50 text-[#1d1d1f] overflow-hidden select-none font-sans">
      
      {/* SIDEBAR */}
      <nav className="w-80 bg-white/70 backdrop-blur-3xl border-r border-[#d2d2d7]/30 flex flex-col p-8 shrink-0 shadow-[20px_0_40px_rgba(0,0,0,0.01)] z-20">
        
        {/* LOGO - Vibrant & Modern */}
        <div className="flex items-center gap-5 mb-14 text-left group">
          <div className="w-14 h-14 bg-[#1d1d1f] rounded-[1.4rem] flex items-center justify-center relative shadow-2xl transition-all duration-700 group-hover:rotate-[10deg] group-hover:scale-110">
            <svg viewBox="0 0 100 100" className="w-9 h-9">
              <defs>
                <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#007AFF" />
                  <stop offset="50%" stopColor="#34C759" />
                  <stop offset="100%" stopColor="#FFD60A" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <rect x="30" y="30" width="40" height="40" rx="6" fill="none" stroke="url(#logoGrad)" strokeWidth="4" filter="url(#glow)" />
              <rect x="44" y="44" width="12" height="12" rx="3" fill="url(#logoGrad)" />
              <path d="M 20 40 C 10 60, 20 90, 50 90 C 85 90, 95 60, 85 35" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
              <circle cx="85" cy="35" r="5" fill="#34C759" className="animate-pulse" />
            </svg>
          </div>
          <div className="flex flex-col">
            <h1 className="text-3xl font-[900] tracking-tighter leading-none lowercase">targoo</h1>
            <p className="text-[10px] font-black text-[#86868b] uppercase tracking-[0.25em] mt-1 opacity-60">advisor engine</p>
          </div>
        </div>

        {/* CLIENT LIST */}
        <div className="flex-1 flex flex-col gap-12">
          <div className="space-y-5">
            <h3 className="text-[11px] font-black text-[#86868b] uppercase tracking-[0.2em] px-2">Ügyfelek</h3>
            <div className="flex flex-col gap-2">
              {clients.map((c) => (
                <button 
                  key={c.name}
                  onClick={() => { setActiveClient(c.name); setScore(c.score); }}
                  className={`w-full text-left px-5 py-4 rounded-[1.2rem] text-[15px] font-bold transition-all duration-500 ${
                    activeClient === c.name 
                    ? 'bg-[#1d1d1f] text-white shadow-2xl scale-[1.02]' 
                    : 'text-[#424245] hover:bg-white hover:shadow-lg'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* DROPZONE */}
          <div className="space-y-5">
            <h3 className="text-[11px] font-black text-[#86868b] uppercase tracking-[0.2em] px-2">Adatok</h3>
            <div className="aspect-[4/3] border-2 border-dashed border-[#d2d2d7] rounded-[2.5rem] flex flex-col items-center justify-center text-[#86868b] gap-4 p-6 bg-white/30 hover:bg-white hover:border-black hover:shadow-2xl transition-all duration-700 group cursor-pointer">
              <div className="w-12 h-12 rounded-2xl bg-white shadow-xl flex items-center justify-center group-hover:scale-125 transition-transform duration-500">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
              </div>
              <p className="text-[10px] text-center font-black uppercase tracking-widest leading-tight opacity-40">dokumentumok</p>
            </div>
          </div>
        </div>
      </nav>

      {/* DASHBOARD AREA */}
      <main className="flex-1 flex flex-col overflow-y-auto relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-100/20 rounded-full blur-[120px] -z-10"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-green-100/20 rounded-full blur-[100px] -z-10"></div>

        <div className="p-12 space-y-10">
          
          {/* MAIN SCORE CARD */}
          <section className="bg-white/60 backdrop-blur-2xl rounded-[3.5rem] p-14 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.05)] border border-white/40 flex flex-col items-center">
            <div className="w-full flex justify-between items-start mb-12 text-left">
              <div>
                <h2 className="text-3xl font-[900] tracking-tighter lowercase">esg pontszám</h2>
                <div className="flex items-center gap-2 mt-2">
                   <div className="w-2 h-2 rounded-full bg-green-500"></div>
                   <p className="text-sm font-bold text-[#86868b] tracking-tight">Audit kész: {activeClient}</p>
                </div>
              </div>
              <div className="px-6 py-2 bg-black text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">2026. MÁRC. 06.</div>
            </div>
            
            <div className="flex flex-row items-center justify-center gap-24 w-full">
              <div className="relative w-80 h-80">
                <svg className="w-full h-full -rotate-90">
                  <circle cx="160" cy="160" r="140" stroke="#f5f5f7" strokeWidth="20" fill="transparent" />
                  <circle 
                    cx="160" cy="160" r="140" 
                    stroke="black" strokeWidth="20" 
                    fill="transparent" 
                    strokeDasharray={879} 
                    strokeDashoffset={879 * (1 - score/100)} 
                    className="transition-all duration-1000 ease-in-out" 
                    strokeLinecap="round" 
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="flex items-baseline"><span className="text-[10rem] font-[900] tracking-tighter leading-none">{score}</span><span className="text-4xl font-bold text-[#d2d2d7] ml-2">/100</span></div>
                </div>
              </div>
              
              <div className="flex flex-col gap-8 text-left shrink-0">
                 {['Környezet (E)', 'Társadalom (S)', 'Vezetés (G)'].map((label, idx) => (
                   <div key={label} className="flex items-center gap-5 group cursor-help transition-all hover:translate-x-2">
                      <div className={`w-5 h-5 rounded-full shadow-lg ${idx === 0 ? 'bg-black' : idx === 1 ? 'bg-[#d2d2d7]' : 'bg-[#ff3b30] opacity-40'}`}></div>
                      <span className="text-xs font-black text-[#86868b] uppercase tracking-[0.25em] italic">{label}</span>
                   </div>
                 ))}
              </div>
            </div>
          </section>

          {/* GAP ANALYSIS */}
          <section className="grid grid-cols-2 gap-8">
             <div className="bg-white/40 backdrop-blur-xl rounded-[3rem] p-12 border border-white/20 shadow-xl flex flex-col justify-center text-left hover:bg-white transition-all duration-500 group">
               <span className="text-[11px] font-black text-red-500 uppercase tracking-widest mb-3 italic">Hiányzó adatok:</span>
               <h3 className="text-3xl text-[#1d1d1f] font-[900] leading-tight italic tracking-tighter group-hover:translate-x-2 transition-transform">ESRS E1-4<br/>Célkitűzések</h3>
             </div>
             <div className="bg-white/40 backdrop-blur-xl rounded-[3rem] p-12 border border-white/20 shadow-xl flex flex-col justify-center text-left hover:bg-white transition-all duration-500 group">
               <span className="text-[11px] font-black text-green-500 uppercase tracking-widest mb-3 italic">Ellenőrizve:</span>
               <h3 className="text-3xl text-[#1d1d1f] font-[900] leading-tight italic tracking-tighter group-hover:translate-x-2 transition-transform">Scope 1 & 2<br/>Kibocsátás</h3>
             </div>
          </section>
        </div>
      </main>

      {/* CHAT PANEL */}
      <aside className="w-[420px] bg-white/80 backdrop-blur-3xl border-l border-[#d2d2d7]/30 flex flex-col shrink-0 shadow-[-20px_0_60px_rgba(0,0,0,0.02)] z-20">
        <div className="p-10 border-b border-[#f5f5f7] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(34,197,94,0.6)]"></div>
            <h2 className="font-[900] text-sm uppercase tracking-[0.3em] lowercase tracking-tighter">targoo ai</h2>
          </div>
          <div className="flex gap-5 text-[#d2d2d7] font-bold">
            <span className="hover:text-black cursor-pointer transition-colors text-xl">···</span>
            <span className="hover:text-red-500 cursor-pointer transition-colors text-xl">✕</span>
          </div>
        </div>
        
        <div className="flex-1 p-10 overflow-y-auto space-y-10 flex flex-col bg-[#fbfbfd]/30">
           <div className="flex gap-5">
              <div className="w-12 h-12 rounded-[1rem] bg-black flex-shrink-0 flex items-center justify-center shadow-2xl">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="w-6 h-6"><path d="M12 2L2 7l10 5 10-5-10-5z"/></svg>
              </div>
              <div className="bg-white border border-[#f5f5f7] rounded-[1.8rem] rounded-tl-none p-7 text-[15px] text-[#424245] shadow-[0_10px_30px_rgba(0,0,0,0.02)] leading-relaxed text-left font-bold italic tracking-tight">
                Szia! Elemeztem a(z) {activeClient} adatait. A környezeti célok (E1-4) még hiányoznak a teljességhez. Segítsek összeállítani a javaslatot?
              </div>
           </div>
        </div>

        {/* INTERACTIVE INPUT */}
        <div className="p-10 bg-white border-t border-[#f5f5f7]">
          <div className="relative group">
            <input 
              type="text" 
              autoFocus
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="üzenet a targoo-nak..." 
              className="w-full bg-[#f5f5f7] border-3 border-transparent rounded-[1.5rem] py-6 pl-8 pr-20 text-[15px] font-bold outline-none focus:bg-white focus:border-black transition-all duration-500 placeholder:text-[#86868b] italic shadow-inner"
            />
            <button className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black text-white rounded-[1.1rem] flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-2xl">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
