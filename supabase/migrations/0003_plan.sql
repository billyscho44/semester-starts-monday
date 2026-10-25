-- Plan tables. The Block 1 seed is inserted by the app on first load (src/lib/seed-plan.ts).
create table public.exercise (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null check (type in ('cardio','strength','flexibility','balance')),
  movement_pattern text,
  unit text not null default 'reps' check (unit in ('reps','seconds','minutes')),
  unique (user_id, name)
);

create table public.plan_day (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_no integer not null check (week_no between 1 and 4),
  day_no integer not null check (day_no between 1 and 7),
  session_kind text not null check (session_kind in ('strength','cardio','recovery')),
  title text not null,
  minutes_est integer not null,
  steps jsonb not null,
  unique (user_id, week_no, day_no)
);

create table public.plan_item (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_day_id uuid not null references public.plan_day (id) on delete cascade,
  exercise_id uuid not null references public.exercise (id),
  round_no integer not null,
  ord integer not null,
  sets integer not null,
  rep_min integer,
  rep_max integer,
  hold_min_s integer,
  hold_max_s integer,
  per_side boolean not null default false,
  load_text text not null default ''
);
create index plan_item_plan_day_idx on public.plan_item (plan_day_id);
create index plan_item_exercise_idx on public.plan_item (exercise_id);
create index plan_item_user_idx on public.plan_item (user_id);

alter table public.exercise enable row level security;
alter table public.plan_day enable row level security;
alter table public.plan_item enable row level security;

create policy "own exercise: read" on public.exercise for select to authenticated using ((select auth.uid()) = user_id);
create policy "own exercise: insert" on public.exercise for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own plan_day: read" on public.plan_day for select to authenticated using ((select auth.uid()) = user_id);
create policy "own plan_day: insert" on public.plan_day for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own plan_item: read" on public.plan_item for select to authenticated using ((select auth.uid()) = user_id);
create policy "own plan_item: insert" on public.plan_item for insert to authenticated with check ((select auth.uid()) = user_id);
