-- Sogrape Balanced Scorecard — initial schema
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
-- Ported from the previous MongoDB single-document model. Two things the document
-- model did by hand are now the database's job:
--   * ON DELETE CASCADE replaces the manual cleanup in delete_objective /
--     delete_measure / delete_department.
--   * The touch_project() trigger replaces the _touch() call every write made.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- projects

create table if not exists public.projects (
  id                      uuid primary key default gen_random_uuid(),
  company_name            text        not null,
  industry                text        not null default '',
  fiscal_year             text        not null default '',
  business_unit           text        not null default '',
  vision                  text        not null default '',
  mission                 text        not null default '',
  strategic_themes        text        not null default '',
  prepared_by             text        not null default '',
  prepared_date           text        not null default '',
  perspective_weights     jsonb       not null default
                            '{"financial":25,"customer":25,"internal":25,"learning":25}'::jsonb,
  performance_thresholds  jsonb       not null default
                            '{"red_max":70,"amber_max":90}'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ------------------------------------------------------------ departments

create table if not exists public.departments (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------- objectives

-- The four Balanced Scorecard perspectives are fixed, so they stay a constrained
-- text key rather than a lookup table — it keeps the client payload identical to
-- the old document shape.
create table if not exists public.objectives (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id)    on delete cascade,
  -- Deleting a department unassigns its objectives instead of deleting them,
  -- matching the old delete_department behaviour.
  department_id  uuid          references public.departments(id) on delete set null,
  perspective_id text not null default 'financial'
                 check (perspective_id in ('financial','customer','internal','learning')),
  name           text not null,
  description    text not null default '',
  priority       text not null default 'Medium',
  owner          text not null default '',
  timeline       text not null default '',
  status         text not null default 'On Track',
  color          text not null default '#721B29',
  weight         numeric not null default 0,
  created_at     timestamptz not null default now()
);

-- --------------------------------------------------------------- measures

create table if not exists public.measures (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id)   on delete cascade,
  objective_id   uuid          references public.objectives(id) on delete cascade,
  name           text not null,
  description    text not null default '',
  unit           text not null default '%',
  weight         numeric not null default 0,
  baseline       numeric not null default 0,
  stretch_target numeric not null default 0,
  time_period    text not null default 'Annual',
  owner          text not null default '',
  data_source    text not null default '',
  comments       text not null default '',
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------- targets

create table if not exists public.targets (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  measure_id   uuid not null references public.measures(id) on delete cascade,
  period       text not null default '',
  target_value numeric not null default 0,
  actual_value numeric not null default 0,
  created_at   timestamptz not null default now(),
  -- Bulk import and the update-actuals flow both match on (measure, period);
  -- this makes those upserts atomic instead of read-then-write.
  unique (measure_id, period)
);

-- ------------------------------------------------------------ initiatives

create table if not exists public.initiatives (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  name            text not null,
  description     text not null default '',
  budget          numeric not null default 0,
  owner           text not null default '',
  start_date      text not null default '',
  end_date        text not null default '',
  progress        numeric not null default 0,
  status          text not null default 'Planned',
  risk_level      text not null default 'Low',
  expected_impact text not null default '',
  dependencies    text not null default '',
  -- Deliberately an array, not a join table: the UI always reads and writes the
  -- whole set at once, and this keeps the client payload flat.
  measure_ids     uuid[] not null default '{}',
  created_at      timestamptz not null default now()
);

-- --------------------------------------------------------- strategy_edges

create table if not exists public.strategy_edges (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id)   on delete cascade,
  source     uuid not null references public.objectives(id) on delete cascade,
  target     uuid not null references public.objectives(id) on delete cascade,
  label      text not null default '',
  created_at timestamptz not null default now(),
  unique (project_id, source, target)
);

-- ---------------------------------------------------------------- indexes

create index if not exists departments_project_idx    on public.departments(project_id);
create index if not exists objectives_project_idx     on public.objectives(project_id);
create index if not exists objectives_department_idx  on public.objectives(department_id);
create index if not exists measures_project_idx       on public.measures(project_id);
create index if not exists measures_objective_idx     on public.measures(objective_id);
create index if not exists targets_project_idx        on public.targets(project_id);
create index if not exists targets_measure_idx        on public.targets(measure_id);
create index if not exists initiatives_project_idx    on public.initiatives(project_id);
create index if not exists strategy_edges_project_idx on public.strategy_edges(project_id);

-- --------------------------------------------------------------- triggers

create or replace function public.touch_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid := coalesce(new.project_id, old.project_id);
begin
  update public.projects set updated_at = now() where id = pid;
  return coalesce(new, old);
end;
$$;

create or replace function public.touch_self()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists projects_touch_self on public.projects;
create trigger projects_touch_self
  before update on public.projects
  for each row execute function public.touch_self();

do $$
declare t text;
begin
  foreach t in array array['departments','objectives','measures','targets','initiatives','strategy_edges']
  loop
    execute format('drop trigger if exists %I_touch_project on public.%I', t, t);
    execute format(
      'create trigger %I_touch_project after insert or update or delete on public.%I
         for each row execute function public.touch_project()', t, t);
  end loop;
end $$;

-- ------------------------------------------------------------------- RLS
--
-- WARNING — READ THIS BEFORE GOING LIVE.
--
-- The app has no authentication yet, so these policies allow anyone holding the
-- anon key to read and write every scorecard. The anon key ships inside the
-- browser bundle, so in practice that means anyone with the site URL.
--
-- This is a deliberate placeholder. When Supabase Auth is added, replace each
-- `using (true) with check (true)` below with an owner check, e.g.:
--
--     using (auth.uid() = owner_id)
--
-- and add an `owner_id uuid references auth.users(id)` column to projects.

alter table public.projects       enable row level security;
alter table public.departments    enable row level security;
alter table public.objectives     enable row level security;
alter table public.measures       enable row level security;
alter table public.targets        enable row level security;
alter table public.initiatives    enable row level security;
alter table public.strategy_edges enable row level security;

do $$
declare t text;
begin
  foreach t in array array['projects','departments','objectives','measures',
                           'targets','initiatives','strategy_edges']
  loop
    execute format('drop policy if exists %I_anon_all on public.%I', t, t);
    execute format(
      'create policy %I_anon_all on public.%I
         for all to anon, authenticated using (true) with check (true)', t, t);
  end loop;
end $$;
