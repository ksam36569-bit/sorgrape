# Sogrape Balanced Scorecard Builder — PRD

## Original problem statement
Build a production-ready, fully interactive Balanced Scorecard web application for Sogrape — an
enterprise-grade SaaS-quality experience (Power BI / Monday.com / Linear / Notion feel) reskinned in
Sogrape's heritage wine brand. Single performance-tracking dashboard where strategic objectives,
measures/KPIs, targets and initiatives — organised across the four Balanced Scorecard perspectives,
departments and time periods — roll up live into one calculated picture of company performance.

## User choices (captured from ask_human)
- Stack: React + JSX (JavaScript, not TypeScript), Tailwind, Shadcn UI, Framer Motion, Recharts, React Flow, SheetJS.
- Persistence: MongoDB backend (multi-user shared state) instead of pure LocalStorage.
- AI assistance: OpenAI primary with Anthropic fallback, streaming SSE.
- Entry screen imagery: auto-selected branded vineyard photography.
- Delivery: Phase 1 first (approved), then all Phases 2-5 in one iteration.

## Architecture
- Backend: FastAPI + Motor (async MongoDB). Single collection `projects`, each document self-contained
  (departments, objectives, measures, targets, initiatives, strategy_edges arrays). All routes
  prefixed with `/api`. SSE streaming endpoint for AI summary via `emergentintegrations.llm.chat`.
- Frontend: React 19 (JSX) + Tailwind + Shadcn UI + Framer Motion + Recharts + React Flow + SheetJS
  + jsPDF/html2canvas. Global state via React Context (`ScorecardProvider`). Routes: `/` (Entry) →
  `/portal` → `/setup` → `/scorecard`. Six top-level sections inside scorecard: Scorecard, Dashboard,
  Strategy Map, Alignment, Initiatives, Reports.
- Design system: Sogrape Heritage palette — bordeaux #721B29, warm brown/terracotta, cream, muted
  gold. Playfair Display serif for headings + Manrope for body. Light + Dark modes on brand.
- Formula engine: pure functions in `/app/frontend/src/lib/calculations.js` recompute Achievement %,
  Weighted Score, Objective / Perspective / Overall scores, and Performance Rating live on every
  render.

## Personas
- **Strategy Office**: designs the scorecard, sets weights and targets, tracks organisational health.
- **Business Unit Owner / Department Head**: owns objectives, updates actuals per period.
- **Executive / Board**: monitors overall performance rating, perspective + department roll-ups.

## Core requirements (static)
1. Sogrape-branded entry screen with two wine-glass illustrations (identical destination). ✅
2. Guided 4-step setup wizard (Identity, Strategy, Structure, Review). ✅
3. Persistent left sidebar with 4 fixed perspectives + dynamic departments + flat searchable KPI index. ✅
4. Three interchangeable scorecard views: By Perspective / By Department / By Time Period. ✅
5. Full CRUD hierarchy: Objectives → Measures (=KPIs) → Targets, plus Initiatives. ✅
6. Weight validation warnings at every level. ✅
7. Live formula engine + 5-band traffic-light Performance Rating. ✅
8. Strategy Map (React Flow) with drag-to-connect, standard-chain suggestion, edge persistence. ✅
9. Dashboard with Recharts (radar, gauge, pie, bar, trend) + KPI cards. ✅
10. Combinable filter bar (perspective, department, owner, quarter, year, status, priority, risk). ✅
11. Reports & export (PDF via jsPDF+html2canvas, Excel/CSV via SheetJS, native Print). ✅
12. Bulk Excel import with template, auto-mapping, preview, partial import, Update Actuals mode. ✅
13. Multi-project persistence with JSON import/export UI. ✅
14. Dark + Light theme on brand. ✅
15. AI Assistance — "Analyze & Summarize Dashboard" via Claude Sonnet 4.5 streaming SSE. ✅

## What's been implemented

### Phase 1 (2026-02-22)
Backend REST API (projects/departments/objectives/measures/targets/initiatives + bulk-import + update-
actuals). Entry screen, setup wizard, portal, main scorecard with sidebar + 3 views (Perspective/
Department/Period). Full CRUD via UI + live formula engine + RAG rating. Bulk Excel import. Multi-
project + Light/Dark theme.
Iteration 1 testing: backend 16/16, frontend 100% ✅

### Phase 2-5 (2026-02-22)
- **Dashboard** — Recharts radar + radial gauge + pie + bar + line charts, plus 4 KPI stat cards.
- **FilterBar** — combinable filters (perspective, department, owner, quarter, year, status, priority,
  risk) with clear-all; live re-aggregation across every section.
- **Strategy Map** — React Flow with custom objective nodes laid out by perspective row (L&G bottom
  → Financial top). Drag from handles to connect. Edges persist to MongoDB via strategy_edges API.
  Click-edge-to-delete. "Suggest standard chain" one-click bulk-connects the classic Kaplan-Norton
  flow.
- **Alignment view** — hierarchical roll-up Perspective → Objective → Measure → linked initiatives
  with contribution % at every level.
- **Initiatives** — full CRUD dialog with progress slider, linked-measure multi-select. Cards with
  risk badge, budget, timeline, linked measure chips. Filter + search.
- **Reports** — PDF (jsPDF+html2canvas from #report-print-area), Excel (SheetJS multi-sheet:
  Overview/Scorecard/Initiatives), CSV, native Print (@media print CSS), JSON backup export &
  import UI, Update-Actuals quick-mode upload.
- **AI Analyze** — header button opens dialog that streams Claude Sonnet 4.5 executive briefing via
  SSE. Regenerate + Copy buttons. (Rewritten 2026-07-22 to call the OpenAI and Anthropic
  SDKs directly — see Deployment below.)
Iteration 2 testing: backend 10/10 new + 16/16 regression, frontend 100% ✅

## Backlog

### P2 (nice-to-have, deferred)
- Drag-and-drop reordering of Objectives and Measures inside a perspective.
- Framer Motion micro-animations polish (hover shimmer on cards, staggered chart mount).
- Perspective-weight settings drawer (currently mutable via API only).
- Read-only shareable "Board view" link for executive review (see next enhancement).
- AI in-context suggestions when a Measure goes red (contextual, not just dashboard-wide).

## Next tasks
1. Confirm Phase 2-5 with user.
2. Pick up any P2 items the user prioritises.

## Deployment (2026-07-22)

Migrated off the Emergent platform so the project builds and deploys anywhere.

- `emergentintegrations` (private, not on PyPI) replaced with the official `openai` and
  `anthropic` SDKs. OpenAI is tried first, Anthropic is the fallback; if the primary fails
  before emitting any text the other is used, and a mid-stream failure surfaces an error
  rather than retrying and duplicating output. Model names are env-overridable.
- `@emergentbase/visual-edits` removed. It is served from assets.emergent.sh, which returns
  403 to any other CI, so it broke installs everywhere else.
- Standardised on npm. `resolutions` was a yarn-only field that npm silently ignored, which
  produced a broken ajv/ajv-keywords tree; it is now `overrides` with a committed
  package-lock.json. `.npmrc` pins legacy-peer-deps for the react-day-picker/date-fns conflict.
- Vercel: `vercel.json` builds the CRA app and serves `backend/server.py` through
  `api/index.py`. Frontend and API are same-origin, so `REACT_APP_BACKEND_URL` is left empty.
- Requires a hosted MongoDB (Atlas). Serverless functions cannot reach a local database.
