-- OKRs and Key Results.
--
-- Kept separate from objectives/measures on purpose: an objective is a standing
-- part of the scorecard, weighted and rolled up into a perspective score, while
-- an OKR is a time-boxed commitment scored on its own progress. Sharing a table
-- would have forced weights and perspectives onto rows that have neither.

create table if not exists public.okrs (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  title       text not null,
  description text not null default '',
  owner       text not null default '',
  -- Explicit ordering: the list is user-reorderable, and created_at cannot
  -- express "move this one up".
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.key_results (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  okr_id        uuid not null references public.okrs(id)     on delete cascade,
  description   text not null,
  owner         text not null default '',
  due_date      text not null default '',
  unit          text not null default '',
  baseline      numeric not null default 0,
  current_value numeric not null default 0,
  target        numeric not null default 0,
  -- null means "derive it from progress and pace"; a value here is a manual
  -- override set by the user. See lib/okr.js.
  status_override text check (status_override in ('green','amber','red')),
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists okrs_project_idx        on public.okrs(project_id);
create index if not exists key_results_project_idx on public.key_results(project_id);
create index if not exists key_results_okr_idx     on public.key_results(okr_id);

-- Same updated_at behaviour as every other child table.
drop trigger if exists okrs_touch_project on public.okrs;
create trigger okrs_touch_project
  after insert or update or delete on public.okrs
  for each row execute function public.touch_project();

drop trigger if exists key_results_touch_project on public.key_results;
create trigger key_results_touch_project
  after insert or update or delete on public.key_results
  for each row execute function public.touch_project();

-- Same permissive placeholder policies as the rest of the schema, pending auth.
alter table public.okrs        enable row level security;
alter table public.key_results enable row level security;

do $$
declare t text;
begin
  foreach t in array array['okrs','key_results']
  loop
    execute format('drop policy if exists %I_anon_all on public.%I', t, t);
    execute format(
      'create policy %I_anon_all on public.%I
         for all to anon, authenticated using (true) with check (true)', t, t);
  end loop;
end $$;
