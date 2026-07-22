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

## Architecture change (2026-07-22)

Migrated off the Emergent platform, then off the server entirely.

**Persistence is now local.** Scorecards live in the browser's IndexedDB
(`lib/store.js`); `lib/api.js` keeps the same 27 method signatures it had when it
spoke to a REST backend, so no consuming component changed. Consequences:

- No database, no accounts, no keys in the client, nothing world-writable.
- A scorecard belongs to the browser that created it. The multi-user shared
  state Phase 1 chose MongoDB for is gone; Reports -> Export/Import JSON is how
  a scorecard moves between people and machines.
- Clearing site data deletes scorecards. Export is the backup.

**Emergent removal.** `emergentintegrations` (private, not on PyPI) and
`@emergentbase/visual-edits` (403s from assets.emergent.sh) both broke builds
anywhere else. Also removed a PostHog session recorder that was streaming user
sessions to ap.emergent.sh, and a `.gitconfig` hardcoding the commit author.

**Server-side code** is one dependency-free Vercel function, `api/ai-summary.js`,
which exists only so the model provider key never reaches the browser. The client
posts the scorecard snapshot; the function streams the briefing back over SSE with
OpenAI primary and Anthropic fallback.

**Build.** Standardised on npm — `resolutions` was a yarn-only field npm silently
ignored, which produced a broken ajv tree. Now `overrides` with a committed
package-lock.json.

### Backlog
- Route-level code splitting: the main bundle is ~707 kB gzipped because
  recharts, reactflow, xlsx and jspdf are all eagerly imported.
- Supabase (or any hosted Postgres) if shared multi-user state is wanted back.
  The schema for it is in git history at commit 6c8b239.

## RAG model (2026-07-22)

The source workbook is authoritative for status, and it defines RAG per measure
as green/amber thresholds read against the raw reported value — not as a band on
achievement percentage. Those two rules disagreed on 7 of 24 measures.

- `measureRating()` prefers explicit thresholds, falling back to percentage
  banding when a measure has none, so scorecards built in the app are unaffected.
- `objectiveRating()` / `perspectiveRating()` take the worst status among their
  children. A weighted average let a strong measure mask a failing one: Optimise
  Supply Chain scored 91.5% and showed green while a measure under it was amber.
  Weights still drive the numeric score; they no longer decide the colour.
- Measures carry a `direction`. Where lower is better (Net Debt/EBITDA, lead
  time) the achievement ratio inverts — 4.2 against a 3.5 target is 83%, not 120%.

`frontend/src/lib/__tests__/rag.fixture.mjs` pins all 24 statuses, the
per-perspective counts, and the rollup invariant to the workbook.

**Weights are placeholders.** The workbook specifies none, so objectives are
weighted evenly within a perspective and measures evenly within an objective.
They affect the numeric scores only, never a status colour. Replace them when
the real weights exist.
