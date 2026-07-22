# Sogrape Balanced Scorecard — working notes

Read this before changing anything. It exists so the next person can work by
describing what they want, without needing to run commands anywhere.

## How a change reaches the live site

Push to `main`. That is the whole release.

Vercel watches the repo. On every push it installs, applies any new database
migrations, builds, and deploys. Schema, data and app move together — there is
no separate database step to remember.

    push to main  ->  Vercel installs
                  ->  node scripts/migrate.mjs   (applies pending SQL)
                  ->  frontend build
                  ->  live at https://sorgrape.vercel.app

Nobody needs to open the Supabase dashboard or run a CLI.

## Changing the database

Add a new numbered file in `supabase/migrations/`, e.g. `0006_add_thing.sql`.
Never edit a migration that has already shipped — write a new one. Applied files
are recorded in `schema_migrations`, so a re-run does nothing and editing an old
one simply will not take effect.

Migrations run in filename order, each in its own transaction, behind an advisory
lock so two builds cannot collide. A failing migration rolls back and fails the
build rather than deploying an app against a half-changed schema.

## Environment variables (set in Vercel, not in the repo)

| Name | Used by | Notes |
|---|---|---|
| `REACT_APP_SUPABASE_URL` | browser | `https://<ref>.supabase.co` |
| `REACT_APP_SUPABASE_ANON_KEY` | browser | publishable key; safe to expose |
| `SUPABASE_DB_URL` | build | Postgres connection string, for migrations |
| `OPENAI_API_KEY` | `/api/ai-summary` | primary AI provider |
| `ANTHROPIC_API_KEY` | `/api/ai-summary` | fallback, optional |

`REACT_APP_*` variables are compiled into the JavaScript bundle and are public.
**Never give a secret or service-role key a `REACT_APP_` prefix.** `SUPABASE_DB_URL`
and the AI keys have no prefix precisely so they stay on the server.

CRA reads these at build time, so changing one requires a redeploy, not a restart.

## Layout

    api/ai-summary.js      the only server code: streams the AI briefing so the
                           provider key never reaches the browser
    frontend/src/lib/      api.js is the single data-access seam; every component
                           goes through it. calculations.js and okr.js hold the
                           scoring rules and are pure functions
    supabase/migrations/   schema and seed data, applied automatically
    scripts/migrate.mjs    the migration runner

## Rules worth knowing before you change scoring

**RAG status comes from thresholds, not percentages.** A measure with
`green_threshold`/`amber_threshold` is judged on its raw value, because that is
how the source workbook defines it. Falling back to banding achievement
percentage disagrees on 7 of the 24 measures. `frontend/src/lib/__tests__/rag.fixture.mjs`
pins all 24 to the workbook and will fail if someone reverts this.

**A parent is never healthier than its worst child.** Objective and perspective
status take the worst status beneath them. A weighted average once showed an
objective green while a measure under it was amber, which is the one thing a
status light must never do.

**OKR progress is distance from baseline**, `(current - baseline) / (target - baseline)`,
not `current / target`. Sitting on the baseline reads 0%, not 94%. It also handles
targets that go down without special-casing.

## Tests

No framework; each file runs directly with `node`.

    node frontend/src/lib/__tests__/rag.fixture.mjs      # 24 RAG statuses vs the workbook
    node frontend/src/lib/__tests__/api.supabase.mjs     # 37 data-layer tests
    node frontend/src/lib/__tests__/okr.logic.mjs        # 19 OKR scoring tests
    node scripts/__tests__/migrate.test.mjs              # 15 migration-runner tests

The data-layer and migration tests run against in-memory fakes that emulate the
real foreign-key cascades, so they need no database.

## Known gaps

- **No authentication.** RLS is on but every policy is `using (true)`, so anyone
  with the publishable key — which ships in the bundle — can read and write every
  row. This is the first thing to fix before the data matters.
- Weights are evenly split placeholders; the workbook specifies none. They affect
  numeric scores only, never a status colour.
- The achievement trend needs two reporting periods; the workbook has one.
- Departments exist but no objectives are assigned to them yet.
