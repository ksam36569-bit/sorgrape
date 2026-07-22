# Sogrape Balanced Scorecard — project context

Read this first, in every session. It carries the decisions, the current state,
and the traps, so you do not have to rediscover them.

---

## 1. What this is

A Balanced Scorecard web app for Sogrape (Portuguese wine group). One picture of
strategy: objectives, measures/KPIs, targets and initiatives across the four
scorecard perspectives, plus OKRs.

| | |
|---|---|
| Live | https://sorgrape.vercel.app |
| Repo | https://github.com/ksam36569-bit/sorgrape (branch `main`) |
| Database | Supabase project ref `eppsdriqegmyybpnmdrl` (Postgres 17, ap-southeast-1) |
| The scorecard row | `projects.id = af56d9a2-6f5b-437c-a003-c25fbff0fc3b` |

The user is not a developer. Do not ask them to run commands, fix builds, or
read stack traces. They describe what they want; you do the rest.

---

## 2. Architecture

React SPA talking straight to Supabase. **There is no application server.**

    browser (React + supabase-js)  ->  Supabase Postgres
                                   ->  /api/ai-summary  (the only server code)

`api/ai-summary.js` is one dependency-free Vercel function. It exists solely so
the OpenAI key never reaches the browser: the client posts a scorecard snapshot,
the function streams a briefing back over SSE.

It used to be FastAPI + MongoDB on the Emergent platform. That is all gone.

### The single seam

`frontend/src/lib/api.js` is the only place that touches the database. Every
component goes through it. It has been re-pointed at MongoDB, then Supabase,
then IndexedDB, then Supabase again — and **no consuming component changed**,
because the method signatures never did. Keep it that way.

---

## 3. How a change reaches production

Push to `main`. That is the whole release.

    push  ->  Vercel installs
          ->  node scripts/migrate.mjs   (applies pending SQL)
          ->  frontend build
          ->  live

Vercel auto-deploys from GitHub. A build takes roughly 60–90 seconds.

### Database changes

**Two ways, both fine:**

1. **Supabase MCP connector** (if connected — check your tool list for
   `mcp__*__apply_migration`). Applies immediately. Use `apply_migration` for
   DDL, `execute_sql` for queries, `get_advisors` after schema changes.
2. **A migration file** in `supabase/migrations/`, applied on next deploy.

If you use the connector for something structural, **also write the migration
file**, or the repo stops describing the database.

Never edit a shipped migration — write a new numbered one. Applied files are
recorded in `public.schema_migrations`; editing an old one simply will not run.

Migrations apply in filename order, each in its own transaction, behind an
advisory lock. A failure rolls back and fails the build rather than deploying an
app against a half-changed schema.

---

## 4. Environment variables (set in Vercel, never in the repo)

| Name | Used by | Notes |
|---|---|---|
| `REACT_APP_SUPABASE_URL` | browser | `https://eppsdriqegmyybpnmdrl.supabase.co` |
| `REACT_APP_SUPABASE_ANON_KEY` | browser | publishable key; public by design |
| `SUPABASE_DB_URL` | build | **not set yet** — deploy-time migrations skip without it |
| `OPENAI_API_KEY` | `/api/ai-summary` | set and working |
| `ANTHROPIC_API_KEY` | `/api/ai-summary` | optional fallback |

`REACT_APP_*` is compiled into the JavaScript bundle and is **public**. Never
give a secret or service-role key that prefix. CRA reads these at build time, so
a change needs a redeploy, not a restart.

For `SUPABASE_DB_URL` use the **Session** pooler string, not Transaction —
transaction mode cannot run the DDL and advisory locks migrations need.

---

## 5. Rules that must not be casually reverted

Each of these was a real bug. Tests pin them.

**RAG status comes from thresholds, not percentages.** A measure with
`green_threshold`/`amber_threshold` is judged on its raw reported value, because
that is how the source workbook defines it. Banding achievement percentage
instead disagrees on **7 of 24 measures** — e.g. 8% against a 20% target is
"red" by percentage but "amber" by the workbook's own threshold.

**A parent is never healthier than its worst child.** Objective and perspective
status take the worst status beneath them. A weighted average once showed an
objective **green while a measure under it was amber** — a status light must
never hide a problem. Weights drive numeric scores only, never a colour.

**Measures have a direction.** Where lower is better (Net Debt/EBITDA, lead
time) the achievement ratio inverts. 4.2 against a 3.5 target is 83%, not 120%.

**OKR progress is distance from baseline**, `(current - baseline) / (target - baseline)`,
not `current / target`. Sitting on the baseline reads 0%, not 94%. Falling
targets work without special-casing.

**OKR status compares progress against elapsed time.** 20% done is fine in
February and alarming in December. A manual override wins; the reason is printed
under every bar.

---

## 6. Tests

No framework. Each file runs directly with `node`, from the repo root.

    node frontend/src/lib/__tests__/rag.fixture.mjs     # 24 RAG statuses vs the workbook
    node frontend/src/lib/__tests__/api.supabase.mjs    # 37 data-layer tests
    node frontend/src/lib/__tests__/okr.logic.mjs       # 19 OKR scoring tests
    node scripts/__tests__/migrate.test.mjs             # 15 migration-runner tests

Data-layer and migration tests run against in-memory fakes that emulate the real
FK cascades and unique indexes, so they need no database.

`rag.fixture.mjs` parses the SQL seed that actually ships, not a copy — an
earlier version loaded a JSON file that had been deleted, so the test was
silently dead for several commits.

Build check: `cd frontend && CI=false npx craco build`.

---

## 7. Data provenance — what is real and what is not

From the workbook (authoritative): 12 objectives, 24 measures with baselines,
targets, thresholds and direction, 24 initiative descriptions, and all 24 RAG
statuses.

**Derived or invented — say so if it comes up:**

- **Weights** are evenly split. The workbook specifies none. They affect numeric
  scores only, never a status colour.
- **Initiative risk** (4 High / 18 Medium / 2 Low) is mapped from the RAG of the
  measure each initiative serves.
- **Departments** (6) are standard Sogrape functions; the workbook has no
  department column. **No objectives are assigned to any of them**, so the
  Department view and its dashboard chart are empty until someone assigns them.
- **Strategy map** (14 edges) is a Kaplan-Norton chain written by hand, adjacent
  perspectives only, bar one documented cross-level link.
- **OKR baselines** come from the user's brief; where none was given, baseline is
  0 and the target is the stated uplift.

Two dashboard panels are empty for honest reasons: department scores (nothing
assigned) and achievement trend (the workbook has one period, FY25, and a trend
needs two). Do not fabricate history to fill them.

---

## 8. Security — read before the data matters

**There is no authentication.** RLS is enabled but every policy is
`USING (true)`, and the publishable key ships in the browser bundle. Anyone with
the site URL can read and delete every row from the console. Supabase's own
linter flags all nine tables.

The user has repeatedly deferred login. It is the single biggest gap. If asked
to add it: Supabase Auth, then replace the policies with
`using (auth.role() = 'authenticated')` — shared team access, not per-user
ownership, or the seeded scorecard ends up orphaned with no owner.

**Credential hygiene:** the user has pasted an OpenAI key, two GitHub PATs, a
Vercel token, a Supabase DB password, a `sb_secret_` key and a service-role JWT
into chat. Tell them to rotate anything sensitive; do not ask for secrets you
cannot use.

---

## 9. Sandbox limits — do not waste a session rediscovering these

**Blocked at the network layer** (403 at the proxy, DNS does not resolve):
`api.vercel.com`, `supabase.com`, `api.supabase.com`, `db.*.supabase.co`,
`api.github.com`, `api.openai.com`.

Consequences: the Vercel CLI cannot work. The Supabase CLI installs and runs but
reports *"Connection blocked by network allowlist"*. No token fixes this — the
block is below authentication. **Do not ask the user for tokens to work around
it.**

**Works:** git over HTTPS to github.com (push/pull fine), the npm registry, PyPI.

**The Supabase MCP connector bypasses all of this** — it runs as a hosted
service, not in the sandbox. It is the correct way to touch the database.

**Other limits:** commands time out at 45s and background processes are killed
between calls, so a CRA build sometimes needs two attempts (webpack's cache
carries over). **The sandbox can restart and wipe `/tmp` without warning —
commit and push early; a full session of uncommitted work has been lost this
way.**

---

## 10. Outstanding work

**Needs a decision from the user:**
- **Logo** — they asked for a change but never said to what. Ask before building.
- **Login / RLS** — deferred, but the data is currently public.
- **`SUPABASE_DB_URL`** in Vercel, so deploy-time migrations actually run.

**Built but never started:**
- **Excel/CSV analysis engine** — the largest item from the original brief:
  upload any spreadsheet, profile columns and types, find missing values,
  duplicates, outliers, correlations and trends, auto-select charts, and explain
  findings in plain language. A profiler was drafted twice and lost to sandbox
  restarts both times. Start fresh, commit early.

**Smaller:**
- Assign objectives to departments so those panels populate.
- A second reporting period so the achievement trend can plot.
- Initiative progress is all 0 — the workbook has initiative text but no
  progress figures.

---

## 11. Working style that has been landing well

- Verify rather than assert. The Supabase connector and the Chrome tools both
  let you check the live thing; several real bugs were found that way and would
  not have surfaced from reading code.
- State what you changed and what you deliberately did not. When something is
  derived rather than measured, say so.
- Push working increments. Do not hold a large uncommitted tree.
- Correct the user's premise when it is wrong — "push to Vercel so data appears
  everywhere" was a misunderstanding worth naming, not working around.
