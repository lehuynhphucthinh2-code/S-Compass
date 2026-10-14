-- Evidence for your proposal: run in Supabase SQL Editor after test sessions.

-- 1) Events per tester and persona
select tester, persona, count(*) as events
from public.interaction_events
group by tester, persona
order by events desc;

-- 2) Funnel: how often each action happened
select type, count(*) from public.interaction_events group by type order by 2 desc;

-- 3) Average planner run time (ms)
select avg(compute_ms) as avg_ms, count(*) as plans
from public.interaction_events where type = 'plan_generated';

-- 4) Delete everything after the competition
-- truncate public.interaction_events; truncate public.demo_sessions;
