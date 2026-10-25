-- Flexible plan: effort on logged activities, per-day credit overrides, one view of all performed sets.
-- Additive only.
alter table public.activity_log
  add column if not exists effort text check (effort is null or effort in ('easy','average','hard'));

-- Billy can override which plan slot a day's activity counts toward (plan_day_id null = counts toward none).
create table public.credit_override (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  kind text not null check (kind in ('cardio','strength')),
  plan_day_id uuid references public.plan_day (id) on delete cascade,
  unique (user_id, date, kind)
);
create index credit_override_user_idx on public.credit_override (user_id);
create index credit_override_plan_day_idx on public.credit_override (plan_day_id);
alter table public.credit_override enable row level security;
create policy "own credit_override: all" on public.credit_override for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Every strength set Billy did, wherever it was logged. RLS of the base tables applies (security_invoker).
create view public.performed_set with (security_invoker = true) as
  select s.user_id, s.date, pi.exercise_id, c.reps, c.load_lb, c.bw_factor, 'plan'::text as source
  from public.check_log c
  join public.session s on s.id = c.session_id
  join public.plan_item pi on pi.id::text = c.ref
  where c.kind = 'set' and c.done and c.reps is not null
  union all
  select a.user_id, a.date, a.exercise_id, x.reps, x.load_lb, x.bw_factor, 'logged'::text as source
  from public.activity_set x
  join public.activity_log a on a.id = x.activity_id
  where a.exercise_id is not null;
