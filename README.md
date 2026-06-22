# Gridlock Control - Parking-Induced Congestion Intelligence Platform

**Gridlock Hackathon 2.0 - Round 2 (Prototype Phase)**

An AI-driven parking intelligence system that detects illegal-parking hotspots
across Bengaluru and quantifies their impact on traffic flow, enabling
targeted (instead of reactive, patrol-based) enforcement.

This directly answers the problem statement:
> *How can AI-driven parking intelligence detect illegal parking hotspots and
> quantify their impact on traffic flow to enable targeted enforcement?*

---

## What's inside

| Layer | Tech | Folder |
|---|---|---|
| ML Pipeline + REST API | Python, pandas, scikit-learn, XGBoost, FastAPI | `backend/` |
| Interactive dashboard | Next.js, TypeScript, Tailwind, Leaflet, Recharts | `frontend/` |

All analytical logic (DBSCAN spatial clustering, risk scoring, XGBoost
forecasting, patrol-budget optimization, economic loss estimation, repeat
offender analytics, hotspot evolution) is implemented fresh in
`backend/app/`, ported from a validated Colab notebook. Running
`backend/test_pipeline.py` and `backend/test_full.py` reproduces the exact
same numbers as the original analysis (246 hotspots, identical risk scores,
identical patrol allocation, etc.) - see the comments in those files.

A pre-built cache (`backend/data/cache.pkl`) is included so the API starts
instantly. If you change the dataset or scoring logic, rebuild it with
`python3 build_cache.py` (~2 minutes on the full 298K-row dataset).

---

## Quick start

### 1. Backend (FastAPI)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Only needed if data/cache.pkl is missing or you changed the data/logic:
python3 build_cache.py

uvicorn app.main:app --reload --port 8000
```

API docs (auto-generated): http://localhost:8000/docs

### 2. Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 — make sure `frontend/.env.local` points at your
backend (`NEXT_PUBLIC_API_URL=http://localhost:8000` by default).

---

## Pages

| Route | What it shows |
|---|---|
| `/` | **Home Page** - hero intro, problem-statement framing, key stats, quick links |
| `/dashboard` | **Commissioner Dashboard** - 5 headline executive stats, "Generate Enforcement Plan" button, classification chart, Digital Twin diagram, top hotspots |
| `/alerts` | **Urgent Congestion Alerts** - threshold-based Critical/High/Medium priority feed with recommended actions |
| `/map` | Live risk map - 246 hotspots, radar-style markers, filterable, searchable, toggleable metro-station layer, light/dark basemap toggle |
| `/forecast` | XGBoost feature importance, next-week forecasts, rising/falling trend table, **Live Prediction widget** |
| `/congestion` | **Congestion Simulator** - real Bureau of Public Roads (BPR) volume-delay function |
| `/patrol` | Interactive patrol-budget slider, budget-sensitivity curve, evening-hours what-if simulator, **Before/After enforcement comparison** |
| `/economic` | Annualized economic loss by hotspot, **ROI/savings calculation**, honest scope comparison |
| `/offenders` | Repeat-offender behavior patterns |
| `/evolution` | City-wide and per-hotspot trend over time |
| `/trust` | Citizen reporting quality score per hotspot |
| `/copilot` | **AI Copilot** - grounded, rule-based Q&A over validated data (not a generative LLM - zero hallucination risk, no API key needed) |
| `/investigate` | **One-Click Investigation Mode** - 5-step guided walkthrough of the full intelligence pipeline |
| `/scenarios` | **Demo Scenario Mode** - Metro Congestion, Event-Day Congestion, Commercial Overflow (explicitly labeled as an approximation - no zoning ground truth exists) |

A light/dark theme toggle (top-right of the header) is available on every page.

### Phase 2 enhancements (answers "how do we know violations = congestion?")
- **Road Capacity Loss Model**: converts violations into an estimated % of road carriageway width lost to illegal parking (Little's Law + IRC road-width standards, sensitivity-tested across 3 dwell-time assumptions)
- **PCII** (Parking Congestion Impact Index): risk_score rescaled 0-100 for clearer communication
- **Congestion Simulator**: real BPR formula shows the incremental travel-time impact attributable specifically to illegal parking
- **Before/After + ROI**: simulates the city-wide impact and economic savings of the 50-unit patrol plan
- **Location Intelligence**: proximity to 17 verified major Namma Metro stations
- **Live Prediction**: hour-by-hour risk prediction with an honest "Insufficient Data" response outside the verified 0:00-14:00 enforcement window

### Phase 3 enhancements (executive command-center layer)
- **Commissioner Dashboard** + auto-generated **Enforcement Plan**
- **Urgent Congestion Alerts** - rule-based Critical/High/Medium triage
- **AI Copilot** - grounded Q&A, no external LLM dependency
- **Demo Scenario Mode** - 3 preconfigured judge-facing views
- **One-Click Investigation Mode** - guided 5-step narrative
- **Light/Dark theme** + light/dark map basemap toggle

---

## API endpoints

All under `http://localhost:8000/api/`:

`health`, `summary`, `hotspots` (filterable by `hotspot_type`/`min_risk`),
`hotspots/{id}`, `map-data`, `forecast`, `feature-importance`,
`patrol-allocation?budget=N`, `budget-sensitivity`,
`what-if/hours?extra_hours=N&capture_pct=N`, `economic-loss`,
`repeat-offenders?limit=N`, `multi-location-offenders?limit=N`,
`evolution`, `citizen-trust`.

**Phase 2:** `road-capacity?limit=N`, `before-after`, `roi`,
`location-intelligence`, `live-prediction?hotspot_id=X&hour=N&is_weekend=bool&is_event_day=bool`,
`live-prediction/profile?hotspot_id=X`, `congestion-simulator?hotspot_id=X&vc_ratio=0.7`.

**Phase 3:** `commissioner-dashboard`, `enforcement-plan?top_n=N`,
`alerts` (optional `?priority=Critical|High|Medium`),
`copilot?question=...&hotspot_id=X` (rule-based, grounded answers),
`scenarios` (list), `scenarios/{metro_congestion|event_day|commercial_overflow}`.

---

## Design notes

The dashboard uses a dark "operations console" visual language (deep navy,
amber/coral/teal/cyan accents tied to traffic-signal semantics) with
radar-pulse animated map markers for Critical/Enforcement-Failure hotspots -
meant to feel like a live monitoring system, not a static report.

Methodological honesty was treated as a feature throughout: forecasts on
low-volume hotspots are labeled "Insufficient Data" instead of a fake
confident number; the evening-hours simulator is explicitly labeled a
projection (no enforcement data exists after 1PM); the economic-loss page
clarifies its scope against a city-wide academic estimate rather than
implying it's the same number.

---

## Deployment (Render + Vercel)

The raw dataset (105MB) and `cache.pkl` (pandas-version-specific) are
intentionally **not** committed to git - GitHub has a 100MB hard limit, and
`cache.pkl` regenerates automatically. Instead, the CSV is hosted on
Hugging Face and `build_cache.py` downloads it on first run if missing
(see `ensure_dataset()` - override the source with the `DATASET_URL` env var).

### 1. Push to GitHub
```bash
cd Gridlock_Fullstack_App
git init
git add .
git commit -m "Gridlock Hackathon 2.0 - full stack app"
git remote add origin https://github.com/<you>/gridlock-app.git
git push -u origin main
```

### 2. Backend -> Render
1. [render.com](https://render.com) -> sign in with GitHub -> **New -> Blueprint**
2. Select this repo - Render reads `render.yaml` at the repo root automatically
   (root dir `backend`, build command installs deps + downloads the dataset +
   runs `build_cache.py`, start command launches `uvicorn`).
3. First deploy takes a few minutes (pip install + ~2 min pipeline build).
4. Copy the live URL Render gives you, e.g. `https://gridlock-backend.onrender.com`.

### 3. Frontend -> Vercel
1. [vercel.com](https://vercel.com) -> sign in with GitHub -> **New Project**
2. Import the same repo. In **Root Directory**, select `frontend`.
3. Add an environment variable: `NEXT_PUBLIC_API_URL` = your Render URL from step 2.
4. Deploy. Vercel gives you a live `https://....vercel.app` URL.

### Notes
- Render's free tier spins down after inactivity - the first request after
  idling will be slow (cold start) while it reboots and reloads the cache.
- If you change `data_pipeline.py`/`forecasting.py` etc., just push to GitHub -
  Render re-runs the build (re-downloads CSV + rebuilds cache) automatically.
- To swap the dataset source, update `DATASET_URL` in `render.yaml` (or set it
  in Render's dashboard under Environment).


---

## Project structure

```
backend/
  app/
    data_pipeline.py     # cleaning, DBSCAN spatial fix, scoring, classification
    forecasting.py       # weekly panel + XGBoost model + event-aware adjustment
    patrol_optimizer.py  # nearest-station + greedy knapsack allocation
    analytics.py         # repeat offenders + hotspot evolution
    main.py               # FastAPI app and all REST endpoints
  build_cache.py         # one-time pipeline run -> data/cache.pkl
  test_pipeline.py       # validates the ported pipeline against known results
  test_full.py           # validates forecasting/patrol/analytics modules
  data/
    violations.csv       # raw dataset (298,450 rows)
    cache.pkl            # pre-built cache (delete + rebuild if data changes)

frontend/
  src/
    app/                 # one folder per page (Next.js App Router)
    components/          # Shell (nav), RiskMap (Leaflet), ui.tsx (shared primitives)
    lib/api.ts            # typed API client
```
