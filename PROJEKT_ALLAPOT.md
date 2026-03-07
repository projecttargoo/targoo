# Targoo ESG Advisor — Projekt Állapot
## Dátum: 2026. március 7.

## Elvégzett munkák:

### Alap infrastruktúra
- Tauri 2.0 + Rust projekt inicializálva
- React + JavaScript frontend (Vite + Tailwind CSS 3)
- GitHub Actions automatikus Windows .exe build (minden push után)
- SQLite + rusqlite adatbázis beállítva

### Backend Engine rétegek (src-tauri/src/)
- L1 RAG: SQLite FTS5 alapú ESRS dokumentum keresés (sqlite-vss helyett, Windows kompatibilis)
- L2 Gap Analysis: GapAnalysis struct, run_gap_analysis függvény, 10+ ESRS topic, piros/sárga/zöld státusz
- L3 Report Generator: docx-rs alapú .docx riport generálás DE/EN nyelven
- L4 Data Processor: calamine Excel parser, automatikus ESG kategorizálás (Scope1/2/3, Energy, Water, Waste, HR)
- L5 Prediction Engine: 12 hónapos ESG score előrejelzés, CO2 trend, compliance alertek, ROI kalkulátor
- L6 Audit Index: SQLite AES-256 audit_log tábla, timestampelt akciók

### Frontend (src/)
- macOS stílusú fehér, prémium UI
- 3 panel layout: bal sidebar, közép dashboard, jobb AI chat
- SVG ESG score ring, E/S/G progress bar-ok
- Recharts CO2 trend vonalgrafikon
- ESRS Gap Matrix táblázat színes badge-ekkel
- Tauri invoke kapcsolat a Rust backenddel
- Generate Report gomb L3 backenddel összekötve

### Trial rendszer
- 14 napos trial, kártya nélkül
- Max 5 riport, max 50 AI kérdés
- Value calculator modal lejáratkor
- check_license Tauri command

### Következő lépések
- Gemma 3 1B Q4 AI modell integráció (offline LLM)
- Drag & drop fájl import UI
- Hardware fingerprint licensz védelem
- Supabase licensz validáció
- Stripe fizetési integráció
- Landing page DE + EN
- Müller GmbH demo adatok feltöltése
