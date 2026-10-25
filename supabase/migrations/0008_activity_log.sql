-- Off-plan activities: walks, runs, rides, other cardio, and strength entries (one exercise per entry, with sets).
-- Additive only.
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  kind text not null check (kind in ('walk','run','ride','other','strength')),
  label text,
  exercise_id uuid references public.exercise (id) on delete set null,
  minutes integer check (minutes is null or minutes between 1 and 1440),
  distance_mi numeric(6,2) check (distance_mi is null or distance_mi >= 0),
  note text,
  created_at timestamptz not null default now()
);
create index activity_log_user_date_idx on public.activity_log (user_id, date);
create index activity_log_exercise_idx on public.activity_log (exercise_id);

create table public.activity_set (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_id uuid not null references public.activity_log (id) on delete cascade,
  set_no integer not null check (set_no >= 1),
  reps integer not null check (reps between 1 and 1000),
  load_lb numeric(6,1),
  bw_factor numeric(4,2),
  unique (activity_id, set_no)
);
create index activity_set_user_idx on public.activity_set (user_id);

alter table public.activity_log enable row level security;
alter table public.activity_set enable row level security;

create policy "own activity_log: all" on public.activity_log for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own activity_set: all" on public.activity_set for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
