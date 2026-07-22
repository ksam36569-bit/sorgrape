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
- AI assistance: deferred / defaults (kept as placeholder for Phase 5).
- Entry screen imagery: auto-selected branded vineyard photography.
- Delivery: Phase 1 first, then confirm before subsequent phases.

## Architecture
- Backend: FastAPI + Motor (async MongoDB). Single collection `projects`, each document self-contained
  (departments, objectives, measures, targets, initiatives arrays). All routes prefixed with `/api`.
- Frontend: React 19 (JSX) + Tailwind + Shadcn UI + Framer Motion. Global state via React Context
  (`ScorecardProvider`). Routes: `/` (Entry) → `/portal` → `/setup` → `/scorecard`. All persistence via
  backend REST; the frontend caches only the current-project id in LocalStorage.
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
1. Sogrape-branded entry screen with two wine-glass illustrations (identical destination).
2. Guided 4-step setup wizard (Identity, Strategy, Structure, Review).
3. Persistent left sidebar with 4 fixed perspectives + dynamic departments + flat searchable KPI index.
4. Three interchangeable scorecard views: By Perspective / By Department / By Time Period.
5. Full CRUD hierarchy: Objectives → Measures (=KPIs) → Targets, plus Initiatives (P4).
6. Weight validation warnings at every level.
7. Live formula engine + 5-band traffic-light Performance Rating (Red<70, Amber 70-89, Green ≥90).
8. Strategy Map (React Flow) — Phase 3.
9. Dashboard with radar/bar/pie/trend/gauge charts + KPI cards — Phase 2.
10. Filters (dept, perspective, owner, quarter, year, status, priority, risk) — Phase 2.
11. Reports & export (PDF/Excel/CSV/Print) — Phase 4.
12. Bulk Excel import with template, auto-mapping, preview, partial import, Update Actuals mode.
13. Multi-project persistence with JSON import/export — P1 done for MongoDB, JSON import/export in P4.
14. Dark + Light theme on brand.
15. AI Assistance placeholder (Analyze & Summarize Dashboard) — Phase 5.

## What's been implemented (Phase 1 — 2026-02-22)
- Backend REST API (`/app/backend/server.py`) with full CRUD for projects, departments, objectives,
  measures, targets, initiatives; bulk-import with cross-sheet name resolution + modes (add / update /
  replace); update-actuals endpoint; project duplicate + JSON import endpoints.
- Sogrape-branded entry screen with inline SVG wine glasses + vineyard photography backdrop.
- 4-step setup wizard capturing all required fields + department add/remove with duplicate rejection.
- Portal (project switcher) listing all saved scorecards with duplicate/delete affordances.
- Main scorecard page with persistent sidebar (4 perspectives + departments + KPI index), top bar
  overall score, three view tabs (By Perspective / By Department / By Time Period), and perspective
  KPI cards with click-to-filter.
- Full CRUD via UI for Objectives (dialog) + Measures (dialog) + Targets (inline editor with quick-add
  period pills and blur-to-save).
- Live formula engine (Achievement %, Weighted Score, Objective/Perspective/Overall scores, RAG rating)
  recomputes on every state change; sidebar + header + cards + badges all update in real time.
- Weight validation warnings (measure weights within objective, objective weights within perspective,
  perspective weights overall) surfaced as toasts and inline amber text.
- Bulk Excel import: downloadable template with example rows, drag-in file → auto-guess sheet mapping →
  manual mapping fallback → row-by-row preview with per-row Zod validation → mode selector (add /
  update / replace) → commit with stats toast.
- Update Actuals lightweight template downloadable from the same dialog.
- Dark + Light mode toggle with brand-tuned palette in both themes; sonner toasts moved to bottom-right.
- Test coverage: testing_agent_v3 iteration 1 — backend 16/16 pytest cases pass, frontend 100% of
  tested flows.

## Prioritized backlog

### P0 (Phase 2 — next)
- Recharts dashboard: radar (perspective balance), bar (departments), trend (period), gauge (overall),
  pie (weight allocation) + KPI cards row.
- Full combinable filter bar (Department, Perspective, Owner, Quarter, Year, Status, Priority, Risk).

### P1 (Phase 3)
- Strategy Map via React Flow — custom nodes, animated arrows across perspectives.
- Strategic Alignment roll-up view (Measure → Objective → Perspective → Overall).

### P1 (Phase 4)
- Initiatives module UI (CRUD + Excel import already scaffolded in backend).
- Reports & Export (PDF via html2pdf/print, Excel/CSV via SheetJS): Executive, Detailed, Perspective,
  Department, Objective, Initiative, Gap Analysis, Alignment.
- JSON project import/export UI (backend done).
- Update-Actuals quick import mode UI (backend done, template already downloadable).

### P2 (Phase 5)
- AI: Analyze & Summarize Dashboard button (Emergent LLM key + Claude Sonnet 4.5 default).
- Drag-and-drop reordering of Objectives and Measures.
- Framer Motion polish + hover micro-animations.

## Next tasks
1. Confirm Phase 1 with the user (approve or request changes).
2. Begin Phase 2: dashboard charts + filters.
