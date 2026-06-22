-- =====================================================================
-- TURF — Row Level Security policies. Run AFTER schema.sql. Safe to re-run.
-- This is the authoritative security layer; the UI only mirrors it.
--
-- Roles (per session):
--   creator   — sessions.created_by. Full control. Picks the <=2 organizers. Bypasses locks.
--   organizer — <=2 members chosen by the creator. Manages teams/schedule/expenses/etc. Bypasses locks.
--   player    — reads everything in their sessions; may only set their OWN availability (In/Out).
--   captain   — a team's captain; may run the live clock + scores (so can organizers/creator).
--   lock      — 1 hour before kickoff, PLAYERS ONLY; creator/organizers never locked.
-- =====================================================================

-- ---------- helper functions (SECURITY DEFINER avoids RLS recursion) ----------
create or replace function public.is_member(p_session uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.session_members
                 where session_id = p_session and profile_id = auth.uid());
$$;

create or replace function public.is_creator(p_session uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.sessions
                 where id = p_session and created_by = auth.uid());
$$;

create or replace function public.is_organizer(p_session uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.session_members
                 where session_id = p_session and profile_id = auth.uid() and role = 'organizer');
$$;

-- creator OR organizer = "can manage this session"
create or replace function public.can_manage_session(p_session uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select public.is_creator(p_session) or public.is_organizer(p_session);
$$;

-- captain of ANY team in the session (gameplay scoring rights)
create or replace function public.is_session_captain(p_session uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.teams
                 where session_id = p_session and captain_id = auth.uid());
$$;

-- team management lock: 1 HOUR before kickoff. Gates PLAYERS ONLY.
create or replace function public.is_team_locked(p_session uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select now() >= slot_start - interval '1 hour'
                   from public.sessions where id = p_session), false);
$$;

create or replace function public.match_session(p_match uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select session_id from public.matches where id = p_match;
$$;

-- do I share at least one session with this other profile? (privacy for profiles/contacts)
create or replace function public.shares_session(p_other uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.session_members a
    join public.session_members b on a.session_id = b.session_id
    where a.profile_id = auth.uid() and b.profile_id = p_other
  );
$$;

-- save_formation RPC — lets a team's CAPTAIN (who may be a general user, not a manager) OR a
-- manager persist that team's formation board. A direct teams UPDATE is manager-only under RLS,
-- so captains route through this SECURITY DEFINER function, which only touches formation columns.
create or replace function public.save_formation(p_team uuid, p_formation jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare sess uuid;
begin
  select session_id into sess from public.teams where id = p_team;
  if sess is null then raise exception 'NO_TEAM' using errcode = 'P0001'; end if;
  if not (public.can_manage_session(sess)
          or exists (select 1 from public.teams where id = p_team and captain_id = auth.uid())) then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;
  update public.teams
     set formation = p_formation,
         formation_preset = nullif(p_formation ->> 'preset', '')
   where id = p_team;
end; $$;
grant execute on function public.save_formation(uuid, jsonb) to authenticated;

-- =====================================================================
-- Enable RLS on every table
-- =====================================================================
alter table public.profiles        enable row level security;
alter table public.sessions        enable row level security;
alter table public.session_members enable row level security;
alter table public.availability    enable row level security;
alter table public.teams           enable row level security;
alter table public.team_players    enable row level security;
alter table public.matches         enable row level security;
alter table public.goals           enable row level security;
alter table public.expenses        enable row level security;
alter table public.payments        enable row level security;

-- Make this file safe to re-run.
drop policy if exists profiles_read on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
drop policy if exists sessions_read on public.sessions;
drop policy if exists sessions_insert on public.sessions;
drop policy if exists sessions_update on public.sessions;
drop policy if exists sessions_delete on public.sessions;
drop policy if exists members_read on public.session_members;
drop policy if exists members_insert on public.session_members;
drop policy if exists members_update on public.session_members;
drop policy if exists members_delete on public.session_members;
drop policy if exists avail_read on public.availability;
drop policy if exists avail_insert on public.availability;
drop policy if exists avail_update on public.availability;
drop policy if exists avail_delete on public.availability;
drop policy if exists teams_read on public.teams;
drop policy if exists teams_write on public.teams;
drop policy if exists tp_read on public.team_players;
drop policy if exists tp_write on public.team_players;
drop policy if exists matches_read on public.matches;
drop policy if exists matches_insert on public.matches;
drop policy if exists matches_delete on public.matches;
drop policy if exists matches_update on public.matches;
drop policy if exists goals_read on public.goals;
drop policy if exists goals_write on public.goals;
drop policy if exists expenses_read on public.expenses;
drop policy if exists expenses_write on public.expenses;
drop policy if exists payments_read on public.payments;
drop policy if exists payments_write on public.payments;

-- ---------- profiles (privacy: self + people you share a session with) ----------
create policy profiles_read   on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_session(id));
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------- sessions ----------
create policy sessions_read   on public.sessions for select to authenticated using (is_member(id) or created_by = auth.uid());
create policy sessions_insert on public.sessions for insert to authenticated with check (created_by = auth.uid());
create policy sessions_update on public.sessions for update to authenticated using (can_manage_session(id)) with check (can_manage_session(id));
-- creator may delete their session, but NOT within 24h of kickoff (cascades to joined users)
create policy sessions_delete on public.sessions for delete to authenticated
  using (is_creator(id) and slot_start - now() > interval '24 hours');

-- ---------- session_members (creator manages roles; join happens via join_session RPC) ----------
create policy members_read   on public.session_members for select to authenticated using (is_member(session_id));
create policy members_insert on public.session_members for insert to authenticated with check (is_creator(session_id));
create policy members_update on public.session_members for update to authenticated using (is_creator(session_id)) with check (is_creator(session_id));
create policy members_delete on public.session_members for delete to authenticated using (is_creator(session_id));

-- ---------- availability (self In/Out before lock; managers add guests + bypass lock) ----------
create policy avail_read on public.availability for select to authenticated using (is_member(session_id));
create policy avail_insert on public.availability for insert to authenticated
  with check (
    can_manage_session(session_id)
    or (profile_id = auth.uid() and added_by = auth.uid() and not is_team_locked(session_id))
  );
create policy avail_update on public.availability for update to authenticated
  using (can_manage_session(session_id) or (profile_id = auth.uid() and not is_team_locked(session_id)))
  with check (can_manage_session(session_id) or (profile_id = auth.uid() and not is_team_locked(session_id)));
create policy avail_delete on public.availability for delete to authenticated
  using (can_manage_session(session_id) or (profile_id = auth.uid() and not is_team_locked(session_id)));

-- ---------- teams + team_players (managers only; players are view-only) ----------
create policy teams_read  on public.teams for select to authenticated using (is_member(session_id));
create policy teams_write on public.teams for all to authenticated
  using (can_manage_session(session_id)) with check (can_manage_session(session_id));

create policy tp_read  on public.team_players for select to authenticated
  using (is_member((select session_id from public.teams t where t.id = team_id)));
create policy tp_write on public.team_players for all to authenticated
  using (can_manage_session((select session_id from public.teams t where t.id = team_id)))
  with check (can_manage_session((select session_id from public.teams t where t.id = team_id)));

-- ---------- matches: schedule by managers; live score/timer by captain OR managers ----------
create policy matches_read   on public.matches for select to authenticated using (is_member(session_id));
create policy matches_insert on public.matches for insert to authenticated with check (can_manage_session(session_id));
create policy matches_delete on public.matches for delete to authenticated using (can_manage_session(session_id));
create policy matches_update on public.matches for update to authenticated
  using (is_session_captain(session_id) or can_manage_session(session_id))
  with check (is_session_captain(session_id) or can_manage_session(session_id));

-- ---------- goals (same rights as live scoring) ----------
create policy goals_read  on public.goals for select to authenticated using (is_member(match_session(match_id)));
create policy goals_write on public.goals for all to authenticated
  using (is_session_captain(match_session(match_id)) or can_manage_session(match_session(match_id)))
  with check (is_session_captain(match_session(match_id)) or can_manage_session(match_session(match_id)));

-- ---------- expenses (managers only) ----------
create policy expenses_read  on public.expenses for select to authenticated using (is_member(session_id));
create policy expenses_write on public.expenses for all to authenticated
  using (can_manage_session(session_id)) with check (can_manage_session(session_id));

-- ---------- payments (managers only — anti-tamper) ----------
create policy payments_read  on public.payments for select to authenticated using (is_member(session_id));
create policy payments_write on public.payments for all to authenticated
  using (can_manage_session(session_id)) with check (can_manage_session(session_id));

-- Old v1 helper no longer used (creator replaces admin).
drop function if exists public.is_admin(uuid);

-- =====================================================================
-- Realtime: broadcast live changes to all viewers
-- =====================================================================
do $$ begin
  alter publication supabase_realtime add table public.matches;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.goals;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.availability;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.payments;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.teams;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.team_players;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.session_members;
exception when duplicate_object then null; end $$;
