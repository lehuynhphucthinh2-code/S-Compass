-- Optional connection check. The app does NOT need seed data: the demo
-- fixtures (shifts, stop cards, model) are bundled in src/data/.
-- Running this inserts one row you can see in Table Editor -> demo_sessions.
insert into public.demo_sessions (id, state)
values ('connection-check', '{"version": 0, "note": "Seed row to confirm the tables exist. Safe to delete."}'::jsonb)
on conflict (id) do nothing;
