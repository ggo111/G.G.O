-- =============================================================================
-- G G O — Ink-Forge  |  Supabase Schema (Production)
-- Run this in Supabase SQL Editor (new project)
-- =============================================================================

-- Enable required extensions
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Profiles (one row per player)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique not null,
  nickname      text not null,
  avatar_id     text not null default 'fox',
  xp            integer not null default 0 check (xp >= 0),
  level         integer not null default 1 check (level >= 1),
  mmr           integer not null default 1000,
  trophies      integer not null default 0 check (trophies >= 0),
  ranked_wins   integer not null default 0 check (ranked_wins >= 0),
  ranked_losses integer not null default 0 check (ranked_losses >= 0),
  coins         integer not null default 200 check (coins >= 0),
  gems          integer not null default 10 check (gems >= 0),
  total_wins    integer not null default 0,
  total_matches integer not null default 0,
  win_streak    integer not null default 0,
  best_streak   integer not null default 0,
  inventory     jsonb not null default '{}'::jsonb,
  equipped      jsonb not null default '{}'::jsonb,
  campaign      jsonb not null default '{}'::jsonb,
  missions      jsonb not null default '[]'::jsonb,
  achievements  jsonb not null default '[]'::jsonb,
  settings      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists profiles_trophies_idx on public.profiles (trophies desc);
create index if not exists profiles_username_idx on public.profiles (username);

-- -----------------------------------------------------------------------------
-- Username claim registry (fast unique check)
-- -----------------------------------------------------------------------------
create table if not exists public.usernames (
  username   text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  claimed_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Matchmaking queue (ephemeral)
-- -----------------------------------------------------------------------------
create table if not exists public.match_queue (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  nickname   text not null,
  mmr        integer not null default 1000,
  avatar_id  text not null default 'fox',
  created_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists match_queue_created_idx on public.match_queue (created_at);

-- -----------------------------------------------------------------------------
-- Rooms (private + quick match)
-- -----------------------------------------------------------------------------
create table if not exists public.rooms (
  id              text primary key,                 -- short invite code or uuid
  host_id         uuid not null references auth.users(id),
  status          text not null default 'lobby'     -- lobby | playing | finished
                  check (status in ('lobby','playing','in_match','finished','closed')),
  max_players     integer not null default 2,
  battle_format   text not null default '1v1',
  arena_id        text not null default 'forge_arena',
  round_duration  integer not null default 60,
  players         jsonb not null default '[]'::jsonb,
  config          jsonb not null default '{}'::jsonb,
  signaling       jsonb not null default '{}'::jsonb, -- offer/answer/ice (legacy fallback)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists rooms_status_idx on public.rooms (status);

-- -----------------------------------------------------------------------------
-- Leaderboard view (simple)
-- -----------------------------------------------------------------------------
create or replace view public.leaderboard as
select
  id,
  username,
  nickname,
  avatar_id as avatar,
  trophies,
  ranked_wins as wins,
  ranked_losses as losses,
  updated_at
from public.profiles
order by trophies desc, ranked_wins desc
limit 100;

-- -----------------------------------------------------------------------------
-- RPC: claim_username (atomic)
-- -----------------------------------------------------------------------------
create or replace function public.claim_username(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_clean text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  v_clean := lower(regexp_replace(trim(p_username), '[^a-zA-Z0-9_]', '', 'g'));
  if length(v_clean) < 2 or length(v_clean) > 20 then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  -- already claimed by this user?
  if exists (select 1 from usernames where user_id = v_uid) then
    return jsonb_build_object('ok', true, 'username', (select username from usernames where user_id = v_uid));
  end if;

  -- taken by someone else?
  if exists (select 1 from usernames where username = v_clean) then
    return jsonb_build_object('ok', false, 'error', 'taken');
  end if;

  insert into usernames (username, user_id) values (v_clean, v_uid);
  return jsonb_build_object('ok', true, 'username', v_clean);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'taken');
end;
$$;

-- -----------------------------------------------------------------------------
-- updated_at trigger
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists rooms_updated_at on public.rooms;
create trigger rooms_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.usernames enable row level security;
alter table public.match_queue enable row level security;
alter table public.rooms enable row level security;

-- Profiles
create policy "Profiles are viewable by authenticated"
  on public.profiles for select to authenticated using (true);

create policy "Users can insert own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Usernames
create policy "Usernames readable by authenticated"
  on public.usernames for select to authenticated using (true);

create policy "Users can claim username"
  on public.usernames for insert to authenticated
  with check (auth.uid() = user_id);

-- Match queue
create policy "Queue readable by authenticated"
  on public.match_queue for select to authenticated using (true);

create policy "Users manage own queue row"
  on public.match_queue for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Rooms
create policy "Rooms readable by authenticated"
  on public.rooms for select to authenticated using (true);

create policy "Authenticated can create rooms"
  on public.rooms for insert to authenticated
  with check (auth.uid() = host_id);

create policy "Authenticated can update rooms"
  on public.rooms for update to authenticated
  using (true)
  with check (true);

-- Enable Realtime for these tables
-- (In Supabase Dashboard → Database → Replication → enable for profiles, match_queue, rooms)

-- Grant usage
grant usage on schema public to anon, authenticated;
grant select on public.leaderboard to authenticated;
grant execute on function public.claim_username(text) to authenticated;
