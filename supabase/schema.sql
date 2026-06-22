-- =====================================================================
-- TURF — database schema (Postgres / Supabase)
-- Run this FIRST in the Supabase SQL editor, then run policies.sql.
-- Safe to re-run: fresh installs get created; existing installs get migrated.
-- v2: Creator/Organizer/Player model, join codes, 1h player lock, In/Out only.
-- =====================================================================

-- ---------- profiles (1:1 with auth.users) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  first_name  text not null default '',
  last_name   text not null default '',
  pref_pos_1  text,
  pref_pos_2  text,
  contact     text,                       -- phone / handle (from temp-profile screen)
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- short shareable join code generator, e.g. 'TURF-9F4KQ'
create or replace function public.gen_join_code()
returns text language sql volatile as $$
  select 'TURF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
$$;

-- ---------- sessions (a turf booking / matchday) ----------
create table if not exists public.sessions (
  id               uuid primary key default gen_random_uuid(),
  turf_name        text not null,
  location         text not null default '',
  slot_start       timestamptz not null,
  slot_minutes     int  not null default 90,
  players_per_side int  not null default 5,
  total_fee        numeric not null default 0,
  scoring          jsonb not null default '{"win":3,"draw":1,"loss":0,"tiebreakers":["GD","GF","H2H"]}',
  status           text not null default 'upcoming',   -- upcoming | live | done
  join_code        text,                                -- set NOT NULL + UNIQUE in migration below
  created_by       uuid not null references public.profiles (id),
  created_at       timestamptz not null default now()
);
create index if not exists idx_sessions_created_by on public.sessions (created_by);

-- ---------- session_members (per-session roles: organizer | player) ----------
-- Creator is NOT a stored role; creator power derives from sessions.created_by.
create table if not exists public.session_members (
  session_id uuid not null references public.sessions (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role       text not null default 'player',
  joined_at  timestamptz not null default now(),
  primary key (session_id, profile_id)
);

-- ---------- availability (pool: self-marked In/Out + organizer-added guests) ----------
create table if not exists public.availability (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete cascade,
  guest_name text,
  status     text not null default 'available',        -- available | out
  added_by   uuid not null references public.profiles (id),
  added_at   timestamptz not null default now(),
  check (profile_id is not null or guest_name is not null)
);
create index if not exists idx_avail_session on public.availability (session_id);
create unique index if not exists uq_avail_member
  on public.availability (session_id, profile_id) where profile_id is not null;

-- ---------- teams ----------
create table if not exists public.teams (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references public.sessions (id) on delete cascade,
  name             text not null,
  color            text not null default '#15C2A8',
  captain_id       uuid references public.profiles (id),
  formation_preset text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_teams_session on public.teams (session_id);

-- ---------- team_players (assignment + formation x/y) ----------
create table if not exists public.team_players (
  team_id    uuid not null references public.teams (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  x          numeric not null default 50,
  y          numeric not null default 50,
  role_label text,
  primary key (team_id, profile_id)
);

-- ---------- matches ----------
create table if not exists public.matches (
  id                   uuid primary key default gen_random_uuid(),
  session_id           uuid not null references public.sessions (id) on delete cascade,
  match_no             int  not null,
  team_a               uuid not null references public.teams (id) on delete cascade,
  team_b               uuid not null references public.teams (id) on delete cascade,
  score_a              int  not null default 0,
  score_b              int  not null default 0,
  status               text not null default 'scheduled', -- scheduled | live | done
  started_at           timestamptz,
  paused_accum_seconds int  not null default 0,
  duration_seconds     int  not null default 900
);
create index if not exists idx_matches_session on public.matches (session_id);

-- ---------- goals ----------
create table if not exists public.goals (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches (id) on delete cascade,
  team_id    uuid not null references public.teams (id) on delete cascade,
  scorer_id  uuid references public.profiles (id),
  minute     int not null default 0
);
create index if not exists idx_goals_match on public.goals (match_id);

-- ---------- expenses (organizer/creator-only writes) ----------
create table if not exists public.expenses (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  label      text not null,
  amount     numeric not null default 0,
  created_by uuid not null references public.profiles (id)
);
create index if not exists idx_expenses_session on public.expenses (session_id);

-- ---------- payments (organizer/creator-only writes — anti-tamper) ----------
create table if not exists public.payments (
  session_id   uuid not null references public.sessions (id) on delete cascade,
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  amount_due   numeric not null default 0,
  amount_paid  numeric not null default 0,
  method       text not null default 'cash',            -- bkash | cash
  confirmed_by uuid references public.profiles (id),
  primary key (session_id, profile_id)
);

-- =====================================================================
-- MIGRATIONS (idempotent — bring an already-created DB up to v2)
-- =====================================================================

-- profiles.contact (for installs created before v2)
alter table public.profiles add column if not exists contact text;

-- sessions.join_code: add, backfill, enforce NOT NULL + UNIQUE + default
alter table public.sessions add column if not exists join_code text;
update public.sessions set join_code = public.gen_join_code() where join_code is null;
alter table public.sessions alter column join_code set default public.gen_join_code();
alter table public.sessions alter column join_code set not null;
create unique index if not exists uq_sessions_join_code on public.sessions (join_code);

-- teams.formation: the whole tactical board for a team (who's on the pitch + x/y + preset),
-- persisted as one atomic jsonb blob so reposition/bench changes are saved and seen by everyone.
alter table public.teams add column if not exists formation jsonb;

-- session_members: joined_at + role restricted to organizer/player (migrate old 'admin')
alter table public.session_members add column if not exists joined_at timestamptz not null default now();
update public.session_members set role = 'organizer' where role = 'admin';
alter table public.session_members drop constraint if exists session_members_role_chk;
alter table public.session_members add constraint session_members_role_chk check (role in ('organizer','player'));

-- availability: drop "maybe" (undecided -> out), enforce In/Out
update public.availability set status = 'out' where status = 'maybe';
alter table public.availability drop constraint if exists availability_status_chk;
alter table public.availability add constraint availability_status_chk check (status in ('available','out'));

-- availability: make the member unique index FULL (was partial) so a single member row can be
-- upserted surgically via onConflict (session_id, profile_id). Guests have NULL profile_id,
-- which is distinct under a unique index, so multiple guests per session are still allowed.
drop index if exists public.uq_avail_member;
create unique index if not exists uq_avail_member on public.availability (session_id, profile_id);

-- team_players: allow GUEST assignments (guests have no profile). Switch PK to a surrogate
-- id, make profile_id nullable, add guest_name. Re-run safe.
alter table public.team_players add column if not exists id uuid default gen_random_uuid();
alter table public.team_players add column if not exists guest_name text;
update public.team_players set id = gen_random_uuid() where id is null;
-- drop the old (session_id/team_id, profile_id) PK FIRST — a column in a PK is implicitly
-- NOT NULL, so we cannot drop NOT NULL on profile_id until the PK is gone.
do $$
declare pk text;
begin
  select conname into pk from pg_constraint
   where conrelid = 'public.team_players'::regclass and contype = 'p';
  if pk is not null and pk <> 'team_players_pkey_id' then
    execute 'alter table public.team_players drop constraint ' || quote_ident(pk);
  end if;
end $$;
alter table public.team_players alter column profile_id drop not null;
do $$ begin
  alter table public.team_players add constraint team_players_pkey_id primary key (id);
exception when others then null; end $$;
create unique index if not exists uq_tp_member on public.team_players (team_id, profile_id) where profile_id is not null;
alter table public.team_players drop constraint if exists tp_guest_chk;
alter table public.team_players add constraint tp_guest_chk check (profile_id is not null or guest_name is not null);

-- goals: allow a GUEST scorer (name only)
alter table public.goals add column if not exists scorer_guest_name text;

-- payments: allow GUEST payers. Surrogate id PK, nullable profile_id, guest_name.
alter table public.payments add column if not exists id uuid default gen_random_uuid();
alter table public.payments add column if not exists guest_name text;
update public.payments set id = gen_random_uuid() where id is null;
-- drop the old (session_id, profile_id) PK FIRST — profile_id is implicitly NOT NULL while
-- it is part of the PK, so dropping NOT NULL must come after the PK is removed.
do $$
declare pk text;
begin
  select conname into pk from pg_constraint
   where conrelid = 'public.payments'::regclass and contype = 'p';
  if pk is not null and pk <> 'payments_pkey_id' then
    execute 'alter table public.payments drop constraint ' || quote_ident(pk);
  end if;
end $$;
alter table public.payments alter column profile_id drop not null;
do $$ begin
  alter table public.payments add constraint payments_pkey_id primary key (id);
exception when others then null; end $$;
-- full unique indexes (nulls don't conflict) so on_conflict works for members AND guests
create unique index if not exists uq_pay_member on public.payments (session_id, profile_id);
create unique index if not exists uq_pay_guest on public.payments (session_id, guest_name);
alter table public.payments drop constraint if exists pay_guest_chk;
alter table public.payments add constraint pay_guest_chk check (profile_id is not null or guest_name is not null);

-- =====================================================================
-- Triggers
-- =====================================================================

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (new.id,
          coalesce(new.raw_user_meta_data ->> 'first_name', split_part(coalesce(new.raw_user_meta_data ->> 'full_name', ''), ' ', 1)),
          coalesce(new.raw_user_meta_data ->> 'last_name', ''))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- When a session is created, add the creator as an organizer member so they
-- appear in member/availability lists. Full creator power comes from created_by.
create or replace function public.handle_new_session()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.session_members (session_id, profile_id, role)
  values (new.id, new.created_by, 'organizer')
  on conflict (session_id, profile_id) do nothing;
  return new;
end; $$;

drop trigger if exists on_session_created on public.sessions;
create trigger on_session_created
  after insert on public.sessions
  for each row execute function public.handle_new_session();

-- Ensure every existing session's creator is a member (re-run safe).
insert into public.session_members (session_id, profile_id, role)
select id, created_by, 'organizer' from public.sessions
on conflict (session_id, profile_id) do nothing;

-- =====================================================================
-- join_session RPC — the only way a non-member joins (RLS-safe, SECURITY DEFINER)
--   * validates the code           -> raises 'INVALID_CODE'
--   * blocks overlapping bookings   -> raises 'TIME_CLASH'
--   * else inserts membership as 'player' and returns the session row
-- =====================================================================
create or replace function public.join_session(p_code text)
returns public.sessions
language plpgsql security definer set search_path = public as $$
declare
  s public.sessions;
  clashes int;
begin
  select * into s from public.sessions where join_code = upper(trim(p_code));
  if s.id is null then
    raise exception 'INVALID_CODE' using errcode = 'P0001';
  end if;

  -- already a member? idempotent success
  if exists (select 1 from public.session_members
             where session_id = s.id and profile_id = auth.uid()) then
    return s;
  end if;

  -- time clash: does the new slot overlap any session the caller is already in?
  select count(*) into clashes
  from public.sessions o
  join public.session_members m on m.session_id = o.id and m.profile_id = auth.uid()
  where o.id <> s.id
    and tstzrange(o.slot_start, o.slot_start + make_interval(mins => o.slot_minutes))
     && tstzrange(s.slot_start, s.slot_start + make_interval(mins => s.slot_minutes));
  if clashes > 0 then
    raise exception 'TIME_CLASH' using errcode = 'P0001';
  end if;

  insert into public.session_members (session_id, profile_id, role)
  values (s.id, auth.uid(), 'player')
  on conflict (session_id, profile_id) do nothing;

  return s;
end; $$;

grant execute on function public.join_session(text) to authenticated;

-- =====================================================================
-- peek_session RPC — preview a session by code WITHOUT joining (for the
-- confirmation popup). Returns creator/slot/fee + whether it clashes.
-- =====================================================================
create or replace function public.peek_session(p_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s public.sessions;
  creator public.profiles;
  cnt int;
  clashes int;
begin
  select * into s from public.sessions where join_code = upper(trim(p_code));
  if s.id is null then
    raise exception 'INVALID_CODE' using errcode = 'P0001';
  end if;
  select * into creator from public.profiles where id = s.created_by;
  select count(*) into cnt from public.session_members where session_id = s.id;
  select count(*) into clashes
  from public.sessions o
  join public.session_members m on m.session_id = o.id and m.profile_id = auth.uid()
  where o.id <> s.id
    and tstzrange(o.slot_start, o.slot_start + make_interval(mins => o.slot_minutes))
     && tstzrange(s.slot_start, s.slot_start + make_interval(mins => s.slot_minutes));
  return jsonb_build_object(
    'id', s.id,
    'turfName', s.turf_name,
    'location', s.location,
    'slotStart', s.slot_start,
    'slotMinutes', s.slot_minutes,
    'totalFee', s.total_fee,
    'creatorName', nullif(trim(coalesce(creator.first_name, '') || ' ' || coalesce(creator.last_name, '')), ''),
    'memberCount', cnt,
    'alreadyMember', exists (select 1 from public.session_members where session_id = s.id and profile_id = auth.uid()),
    'clash', clashes > 0
  );
end; $$;

grant execute on function public.peek_session(text) to authenticated;
