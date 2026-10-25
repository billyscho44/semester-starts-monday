-- Logging: sessions, check-offs, per-exercise ratings, post-workout feedback, weight.
create table public.session (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  plan_day_id uuid references public.plan_day (id) on delete set null,
  status text not null default 'planned' check (status in ('planned','done','partial','minimum','skipped')),
  miss_reason text,
  zwift_workout text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);
create index session_plan_day_idx on public.session (plan_day_id);

create table public.check_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null references public.session (id) on delete cascade,
  kind text not null check (kind in ('step','set')),
  ref text not null,
  set_no integer not null default 0,
  done boolean not null default true,
  reps integer,
  load_lb numeric(6,1),
  unique (session_id, kind, ref, set_no)
);
create index check_log_user_idx on public.check_log (user_id);

create table public.exercise_result (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null references public.session (id) on delete cascade,
  plan_item_id uuid not null references public.plan_item (id) on delete cascade,
  rating text not null check (rating in ('easy','average','hard')),
  completed_all boolean not null default true,
  unique (session_id, plan_item_id)
);
create index exercise_result_user_idx on public.exercise_result (user_id);
create index exercise_result_item_idx on public.exercise_result (plan_item_id);

create table public.session_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null unique references public.session (id) on delete cascade,
  overall text check (overall in ('easy','average','hard')),
  completion text check (completion in ('yes','most','partial')),
  energy_before text check (energy_before in ('low','ok','good')),
  pain_flag boolean not null default false,
  pain_area text,
  note text
);
create index session_feedback_user_idx on public.session_feedback (user_id);

create table public.weight_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  weight_lb numeric(5,1) not null check (weight_lb between 50 and 500),
  unique (user_id, date)
);

alter table public.session enable row level security;
alter table public.check_log enable row level security;
alter table public.exercise_result enable row level security;
alter table public.session_feedback enable row level security;
alter table public.weight_log enable row level security;

create policy "own session: all" on public.session for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own check_log: all" on public.check_log for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own exercise_result: all" on public.exercise_result for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own session_feedback: all" on public.session_feedback for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own weight_log: all" on public.weight_log for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
