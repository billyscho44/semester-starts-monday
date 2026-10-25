-- Foundation: single-user lock, settings table, row-level security.

-- 1. Only one email address may ever create an account.
create or replace function public.block_other_signups()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(new.email) <> 'billyscho44@gmail.com' then
    raise exception 'Sign-ups are closed.';
  end if;
  return new;
end;
$$;

drop trigger if exists block_other_signups on auth.users;
create trigger block_other_signups
  before insert on auth.users
  for each row execute function public.block_other_signups();

-- 2. Per-user settings.
create table public.settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  max_hr integer not null default 166 check (max_hr between 120 and 230),
  resting_hr integer not null default 53 check (resting_hr between 30 and 120),
  zone_method text not null default 'reserve' check (zone_method in ('reserve', 'max')),
  variety_mode text not null default 'block' check (variety_mode in ('off', 'block', 'weekly')),
  timezone text not null default 'America/New_York',
  quiet_start time not null default '22:00',
  quiet_end time not null default '06:30',
  plan_start_date date not null default date '2026-10-25',
  push_subscription jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

create policy "own settings: read"
  on public.settings for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "own settings: insert"
  on public.settings for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "own settings: update"
  on public.settings for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 3. Create the settings row automatically when the account is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.settings (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
