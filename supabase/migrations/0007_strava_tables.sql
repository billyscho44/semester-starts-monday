-- Strava link (tokens, server-only) and synced activities.
create table public.strava_link (
  user_id uuid primary key references auth.users (id) on delete cascade,
  athlete_id bigint not null unique,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text,
  last_sync_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.strava_link enable row level security;
-- No policies on purpose: only the server (service role) reads or writes tokens.

create table public.strava_activity (
  id bigint primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid references public.session (id) on delete set null,
  started_at timestamptz not null,
  local_date date not null,
  name text,
  sport_type text,
  trainer boolean,
  device_name text,
  elapsed_s integer,
  moving_s integer,
  distance_m numeric,
  avg_hr numeric,
  max_hr numeric,
  avg_watts numeric,
  device_watts boolean,
  kilojoules numeric,
  zone_seconds jsonb,
  perceived_exertion numeric,
  raw jsonb,
  synced_at timestamptz not null default now()
);
create index strava_activity_user_date_idx on public.strava_activity (user_id, local_date);
create index strava_activity_session_idx on public.strava_activity (session_id);
alter table public.strava_activity enable row level security;
create policy "own strava_activity: read" on public.strava_activity for select to authenticated
  using ((select auth.uid()) = user_id);
