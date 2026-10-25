-- Progression engine: per-item targets that proposals update, and the proposals themselves.
alter table public.plan_item
  add column target_reps integer,
  add column target_load_lb numeric(6,1),
  add column target_hold_s integer;

create policy "own plan_item: update" on public.plan_item for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table public.proposal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null references public.session (id) on delete cascade,
  exercise_id uuid not null references public.exercise (id) on delete cascade,
  kind text not null check (kind in ('reps','load','hold','variation','tempo','back_off','repeat')),
  summary text not null,
  reason text not null,
  new_target_reps integer,
  new_target_load_lb numeric(6,1),
  new_target_hold_s integer,
  new_load_text text,
  new_bw_factor numeric(3,2),
  status text not null default 'pending' check (status in ('pending','accepted','edited','dismissed')),
  created_at timestamptz not null default now()
);
create index proposal_user_idx on public.proposal (user_id);
create index proposal_session_idx on public.proposal (session_id);
create index proposal_exercise_idx on public.proposal (exercise_id);
alter table public.proposal enable row level security;
create policy "own proposal: all" on public.proposal for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
