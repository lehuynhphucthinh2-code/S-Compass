-- S-Compass prototype: optional Supabase persistence (Stage 2)
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

create table if not exists public.demo_sessions (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.interaction_events (
  id text primary key,
  session_id text not null,
  at timestamptz not null,
  tester text,
  persona text,
  role text,
  type text not null,
  summary text,
  input text,
  output text,
  compute_ms numeric,
  inserted_at timestamptz not null default now()
);

create index if not exists interaction_events_session_idx on public.interaction_events (session_id, at);

-- Row Level Security. This is DEMO-GRADE access: anyone who has the public
-- anon key (it ships inside the website) can read and write these two tables.
-- Store no personal data here, and delete the project after the competition.
alter table public.demo_sessions enable row level security;
alter table public.interaction_events enable row level security;

drop policy if exists "demo sessions readable" on public.demo_sessions;
drop policy if exists "demo sessions insertable" on public.demo_sessions;
drop policy if exists "demo sessions updatable" on public.demo_sessions;
create policy "demo sessions readable" on public.demo_sessions for select to anon using (true);
create policy "demo sessions insertable" on public.demo_sessions for insert to anon with check (true);
create policy "demo sessions updatable" on public.demo_sessions for update to anon using (true) with check (true);

drop policy if exists "events readable" on public.interaction_events;
drop policy if exists "events insertable" on public.interaction_events;
create policy "events readable" on public.interaction_events for select to anon using (true);
create policy "events insertable" on public.interaction_events for insert to anon with check (true);
