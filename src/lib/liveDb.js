import { supabase } from './supabase.js';
import { DB as MOCK_DB } from './db.js';
import { firstLetter } from './format.js';

const asNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const profileName = (p) => `${p?.firstName || ''}${p?.lastName ? ` ${p.lastName}` : ''}`.trim();

const byId = (items) => new Map(items.map((item) => [item.id, item]));

export function createDbView(data, currentUserId) {
  const profiles = data.profiles || [];
  const teams = data.teams || [];
  const profileMap = byId(profiles);
  const teamMap = byId(teams);

  return {
    ...MOCK_DB,
    ...data,
    currentUserId,
    profile: (id) => profileMap.get(id),
    team: (id) => teamMap.get(id),
    initials: (id) => {
      const p = profileMap.get(id);
      if (!p) return '?';
      return (firstLetter(p.firstName) + (p.lastName ? firstLetter(p.lastName) : firstLetter(p.firstName.slice(1)))).toUpperCase();
    },
    name: (id) => profileName(profileMap.get(id)) || '—',
    first: (id) => profileMap.get(id)?.firstName || '—',
  };
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // Return to the SAME host the user is on (localhost, LAN IP on a phone, or the
      // deployed domain). A hardcoded localhost broke mobile/LAN login. That origin must
      // be in Supabase Auth -> Redirect URLs.
      redirectTo: window.location.origin,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function joinSession(code) {
  const { data, error } = await supabase.rpc('join_session', { p_code: code });
  if (error) {
    // surface friendly reasons from the RPC's raised exceptions
    const msg = error.message || '';
    if (msg.includes('INVALID_CODE')) throw new Error('INVALID_CODE');
    if (msg.includes('TIME_CLASH')) throw new Error('TIME_CLASH');
    throw error;
  }
  return mapSession(Array.isArray(data) ? data[0] : data);
}

// Preview a session by code WITHOUT joining (for the confirmation popup + clash check).
export async function peekSession(code) {
  const { data, error } = await supabase.rpc('peek_session', { p_code: code });
  if (error) {
    if ((error.message || '').includes('INVALID_CODE')) throw new Error('INVALID_CODE');
    throw error;
  }
  return data; // jsonb { id, turfName, slotStart, slotMinutes, totalFee, creatorName, memberCount, alreadyMember, clash }
}

export async function createSession(input) {
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      turf_name: input.turfName,
      location: input.location || '',
      slot_start: input.slotStart,
      slot_minutes: input.slotMinutes,
      players_per_side: input.playersPerSide,
      total_fee: input.totalFee,
      scoring: input.scoring,
      status: 'upcoming',
      created_by: input.createdBy,
    })
    .select()
    .single();
  if (error) throw error;
  return mapSession(data);
}

export async function deleteSession(sessionId) {
  // RLS also blocks this within 24h of slot; surface that as a friendly error.
  const { error } = await supabase.from('sessions').delete().eq('id', sessionId);
  if (error) throw error;
}

// Light cross-session aggregates for the Dashboard (RLS scopes everything to my sessions).
export async function loadDashboardStats(userId) {
  const [expRes, payRes, goalsRes, availRes, teamsRes] = await Promise.all([
    supabase.from('expenses').select('amount'),
    supabase.from('payments').select('amount_due, amount_paid'),
    supabase.from('goals').select('id'),
    supabase.from('availability').select('session_id, status').eq('profile_id', userId),
    supabase.from('teams').select('session_id, captain_id'),
  ]);
  for (const r of [expRes, payRes, goalsRes, availRes, teamsRes]) { if (r.error) throw r.error; }
  const totalSpent = (expRes.data || []).reduce((a, e) => a + asNumber(e.amount), 0);
  const due = (payRes.data || []).reduce((a, p) => a + asNumber(p.amount_due), 0);
  const paid = (payRes.data || []).reduce((a, p) => a + asNumber(p.amount_paid), 0);
  const myMarks = {};
  (availRes.data || []).forEach((r) => { myMarks[r.session_id] = r.status; });
  const teamsBySession = {};
  (teamsRes.data || []).forEach((t) => {
    if (!teamsBySession[t.session_id]) teamsBySession[t.session_id] = { count: 0, withCaptain: 0 };
    teamsBySession[t.session_id].count += 1;
    if (t.captain_id) teamsBySession[t.session_id].withCaptain += 1;
  });
  return { totalSpent, outstanding: due - paid, totalPaid: paid, goalCount: (goalsRes.data || []).length, myMarks, teamsBySession };
}

export async function saveProfile(userId, profile) {
  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      first_name: profile.firstName,
      last_name: profile.lastName || '',
      contact: profile.contact || '',
      pref_pos_1: profile.prefPos1,
      pref_pos_2: profile.prefPos2,
    }, { onConflict: 'id' });
  if (error) throw error;
}

// --- LIGHT summary: profiles + my sessions + memberships. Powers Dashboard + My Sessions
// + the nav. Cheap; no per-session heavy tables. RLS already limits sessions to mine.
export async function loadSummary(userId) {
  const [profilesRes, membersRes, sessionsRes] = await Promise.all([
    supabase.from('profiles').select('*').order('first_name'),
    supabase.from('session_members').select('*'),
    supabase.from('sessions').select('*').order('slot_start', { ascending: false }),
  ]);
  for (const res of [profilesRes, membersRes, sessionsRes]) {
    if (res.error) throw res.error;
  }
  return {
    profiles: (profilesRes.data || []).map(mapProfile),
    members: (membersRes.data || []).map((m) => ({ sessionId: m.session_id, profileId: m.profile_id, role: m.role })),
    sessions: (sessionsRes.data || []).map(mapSession),
    currentUserId: userId,
  };
}

// Real Profile-page "Career stats" — sessions count comes from session_members (already loaded
// in loadSummary), but matches/goals span every session the player has ever been part of, which
// loadSessionDetail intentionally never fetches (it's scoped to one active session for cost
// reasons). These two small targeted queries are the only way to get an honest cross-session
// total instead of the page showing made-up numbers.
export async function loadCareerStats(profileId) {
  if (!profileId) return { matches: 0, goals: 0 };
  const { count: goals, error: goalsErr } = await supabase
    .from('goals').select('id', { count: 'exact', head: true }).eq('scorer_id', profileId);
  if (goalsErr) throw goalsErr;

  const { data: tpRows, error: tpErr } = await supabase
    .from('team_players').select('team_id').eq('profile_id', profileId);
  if (tpErr) throw tpErr;
  const teamIds = [...new Set((tpRows || []).map((r) => r.team_id))];

  let matches = 0;
  if (teamIds.length) {
    const orFilter = teamIds.map((id) => `team_a.eq.${id},team_b.eq.${id}`).join(',');
    const { count, error: mErr } = await supabase
      .from('matches').select('id', { count: 'exact', head: true }).eq('status', 'done').or(orFilter);
    if (mErr) throw mErr;
    matches = count || 0;
  }
  return { matches, goals: goals || 0 };
}

function emptyDetail() {
  return {
    detailFor: null,
    availability: [], teams: [], teamPlayers: {}, teamPlayerRows: [],
    matches: [], goals: [], expenses: [], payments: [],
  };
}

// --- HEAVY detail for ONE session only (the active/open one). Keeps the live session
// fully resident so Standings/History recompute from memory with no extra round-trips.
export async function loadSessionDetail(sessionId) {
  if (!sessionId) return emptyDetail();
  const [availabilityRes, teamsRes, matchesRes, expensesRes, paymentsRes] = await Promise.all([
    supabase.from('availability').select('*').eq('session_id', sessionId),
    supabase.from('teams').select('*').eq('session_id', sessionId).order('created_at'),
    supabase.from('matches').select('*').eq('session_id', sessionId).order('match_no'),
    supabase.from('expenses').select('*').eq('session_id', sessionId),
    supabase.from('payments').select('*').eq('session_id', sessionId),
  ]);
  for (const res of [availabilityRes, teamsRes, matchesRes, expensesRes, paymentsRes]) {
    if (res.error) throw res.error;
  }

  const teams = (teamsRes.data || []).map(mapTeam);
  const teamIds = teams.map((t) => t.id);
  const matchIds = (matchesRes.data || []).map((m) => m.id);

  const [teamPlayersRes, goalsRes] = await Promise.all([
    teamIds.length ? supabase.from('team_players').select('*').in('team_id', teamIds).order('y') : { data: [], error: null },
    matchIds.length ? supabase.from('goals').select('*').in('match_id', matchIds) : { data: [], error: null },
  ]);
  if (teamPlayersRes.error) throw teamPlayersRes.error;
  if (goalsRes.error) throw goalsRes.error;

  const teamPlayers = {};
  teams.forEach((team) => { teamPlayers[team.id] = []; });
  (teamPlayersRes.data || []).forEach((row) => {
    if (!teamPlayers[row.team_id]) teamPlayers[row.team_id] = [];
    // token: real members are their profile id; guests are 'g:'+name
    teamPlayers[row.team_id].push(row.profile_id || ('g:' + (row.guest_name || '')));
  });

  return {
    detailFor: sessionId,
    availability: (availabilityRes.data || []).map(mapAvailability),
    teams,
    teamPlayers,
    teamPlayerRows: teamPlayersRes.data || [],
    matches: (matchesRes.data || []).map(mapMatch),
    goals: (goalsRes.data || []).map(mapGoal),
    expenses: (expensesRes.data || []).map(mapExpense),
    payments: (paymentsRes.data || []).map(mapPayment),
  };
}

// Compose summary + the active session's detail into the shape the app hydrates from.
export async function loadAppData(userId, activeSessionId) {
  const summary = await loadSummary(userId);
  const targetId = activeSessionId && summary.sessions.some((s) => s.id === activeSessionId)
    ? activeSessionId
    : (summary.sessions[0]?.id || null);
  const detail = await loadSessionDetail(targetId);
  return {
    ...summary,
    ...detail,
    scoring: summary.sessions.find((s) => s.id === targetId)?.scoring || MOCK_DB.scoring,
  };
}

export async function createStarterSession(userId) {
  const slotStart = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: session, error } = await supabase
    .from('sessions')
    .insert({
      turf_name: 'Touchline Turf',
      location: 'Set location',
      slot_start: slotStart,
      slot_minutes: 150,
      players_per_side: 5,
      total_fee: 0,
      status: 'upcoming',
      created_by: userId,
    })
    .select()
    .single();
  if (error) throw error;

  const colors = ['#E5484D', '#3E7BFA', '#F5A623', '#9B6DFF', '#15C2A8'];
  const teamRows = colors.map((color, i) => ({
    session_id: session.id,
    name: `Team ${String.fromCharCode(65 + i)}`,
    color,
    formation_preset: i % 2 ? '2-1-1' : '1-2-1',
  }));
  const { data: teams, error: teamError } = await supabase.from('teams').insert(teamRows).select().order('created_at');
  if (teamError) throw teamError;

  const pairIndexes = [[0, 1], [2, 3], [0, 4], [1, 2], [3, 4], [0, 2], [1, 3], [2, 4], [0, 3], [1, 4]];
  const matchRows = pairIndexes
    .filter(([a, b]) => teams[a] && teams[b])
    .map(([a, b], index) => ({
      session_id: session.id,
      match_no: index + 1,
      team_a: teams[a].id,
      team_b: teams[b].id,
      status: index === 0 ? 'live' : 'scheduled',
      duration_seconds: 900,
    }));
  if (matchRows.length) {
    const { error: matchError } = await supabase.from('matches').insert(matchRows);
    if (matchError) throw matchError;
  }

  return session.id;
}

// Upsert roles ONLY for the rows passed in. Never deletes — so a stale/partial member
// list (e.g. the creator hasn't refreshed since a player joined) can't wipe other members.
// Role changes happen via setOrganizerRole(); this is used to persist the desired roles.
export async function saveSessionMembers(sessionId, members) {
  const rows = members
    .filter((m) => m.sessionId === sessionId && m.profileId)
    .map((m) => ({ session_id: sessionId, profile_id: m.profileId, role: m.role }));
  if (!rows.length) return;
  const { error } = await supabase.from('session_members').upsert(rows);
  if (error) throw error;
}

// Surgical, safe role change for a single member (organizer <-> player).
export async function setOrganizerRole(sessionId, profileId, makeOrganizer) {
  const { error } = await supabase
    .from('session_members')
    .update({ role: makeOrganizer ? 'organizer' : 'player' })
    .eq('session_id', sessionId)
    .eq('profile_id', profileId);
  if (error) throw error;
}

export async function updateSession(sessionId, patch) {
  const { error } = await supabase
    .from('sessions')
    .update({
      turf_name: patch.turfName,
      location: patch.location,
      slot_start: patch.slotStart,
      slot_minutes: patch.slotMinutes,
      players_per_side: patch.playersPerSide,
      total_fee: patch.totalFee,
      scoring: patch.scoring,
    })
    .eq('id', sessionId);
  if (error) throw error;
}

// Persist ONE availability row surgically. This is the fix for the "marks vanish / clobber
// everyone" bug: never re-write the whole pool (a player may only write their OWN row under
// RLS, so a batch upsert of everyone's rows was rejected and nothing saved).
//   * member  -> upsert on (session_id, profile_id): re-marking updates in place, and a player
//               only ever touches their own row, so no one else's status is touched.
//   * guest   -> update by id when we already have a real row; otherwise insert a fresh one
//               (only creator/organizer can add guests, per RLS).
export async function saveAvailabilityRow(sessionId, row) {
  if (row.profileId) {
    const { error } = await supabase.from('availability').upsert(
      { session_id: sessionId, profile_id: row.profileId, status: row.status, added_by: row.addedBy },
      { onConflict: 'session_id,profile_id' },
    );
    if (error) throw error;
    return;
  }
  if (isUuid(row.id)) {
    const { error } = await supabase.from('availability').update({ status: row.status }).eq('id', row.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('availability').insert({
    session_id: sessionId, guest_name: row.guestName, status: row.status, added_by: row.addedBy,
  });
  if (error) throw error;
}

export async function createTeam(sessionId, name, color) {
  const { data, error } = await supabase
    .from('teams')
    .insert({ session_id: sessionId, name, color })
    .select()
    .single();
  if (error) throw error;
  return mapTeam(data);
}

export async function deleteTeam(teamId) {
  const { error } = await supabase.from('teams').delete().eq('id', teamId);
  if (error) throw error;
}

export async function saveTeams(teams, captains) {
  const payload = teams.map((team) => ({
    id: team.id,
    session_id: team.sessionId,
    name: team.name,
    color: team.color,
    captain_id: captains[team.id] || null,
    formation_preset: team.formationPreset || null,
  }));
  const { error } = await supabase.from('teams').upsert(payload);
  if (error) throw error;
}

// Persist a team's whole formation board (preset + who's on the pitch + x/y) as one atomic
// write, via an RPC so a CAPTAIN (who may be a general user, not a manager) is allowed to save
// it — a direct teams UPDATE is blocked by RLS for non-managers. Realtime on `teams` then
// propagates the new board to every viewer.
export async function saveFormation(teamId, formation) {
  const { error } = await supabase.rpc('save_formation', { p_team: teamId, p_formation: formation });
  if (error) throw error;
}

export async function saveTeamPlayers(assign) {
  const teamIds = Object.keys(assign).filter((teamId) => teamId !== 'pool');
  for (const teamId of teamIds) {
    const { error: deleteError } = await supabase.from('team_players').delete().eq('team_id', teamId);
    if (deleteError) throw deleteError;
    const rows = (assign[teamId] || []).map((key, index) => (
      typeof key === 'string' && key.startsWith('g:')
        ? { team_id: teamId, guest_name: key.slice(2), x: 50, y: 15 + index * 12 }
        : { team_id: teamId, profile_id: key, x: 50, y: 15 + index * 12 }
    ));
    if (rows.length) {
      const { error } = await supabase.from('team_players').insert(rows);
      if (error) throw error;
    }
  }
}

// Surgical single-match update for LIVE control (score, clock, status). Uses a plain UPDATE
// (not upsert) so it only hits the matches_update policy — which allows a CAPTAIN, not just
// managers. An upsert would trip the managers-only INSERT policy and silently reject the write.
export async function updateMatch(matchId, patch) {
  const row = {};
  if (patch.scoreA != null) row.score_a = patch.scoreA;
  if (patch.scoreB != null) row.score_b = patch.scoreB;
  if ('status' in patch) row.status = patch.status;
  if ('startedAt' in patch) row.started_at = patch.startedAt || null;
  if ('pausedAccumSeconds' in patch) row.paused_accum_seconds = patch.pausedAccumSeconds || 0;
  if ('matchNo' in patch) row.match_no = patch.matchNo;
  if (!Object.keys(row).length) return;
  const { error } = await supabase.from('matches').update(row).eq('id', matchId);
  if (error) throw error;
}

export async function saveMatches(matches) {
  const payload = matches.map((m) => ({
    id: m.id,
    session_id: m.sessionId,
    match_no: m.matchNo,
    team_a: m.teamA,
    team_b: m.teamB,
    score_a: m.scoreA,
    score_b: m.scoreB,
    status: m.status,
    started_at: m.startedAt || null,
    paused_accum_seconds: m.pausedAccumSeconds || 0,
    duration_seconds: m.durationSeconds || 900,
  }));
  const { error } = await supabase.from('matches').upsert(payload);
  if (error) throw error;
  // Remove rows for the written session(s) that are no longer in the set. Without this, a
  // rebuild/regenerate that produced new row ids left the OLD rows behind in the DB, so the
  // schedule accumulated duplicate fixtures on every rebuild. The payload always holds the
  // complete set for the sessions it touches, so anything not listed is genuinely stale.
  const bySession = {};
  matches.forEach((m) => { (bySession[m.sessionId] = bySession[m.sessionId] || []).push(m.id); });
  for (const [sid, ids] of Object.entries(bySession)) {
    let q = supabase.from('matches').delete().eq('session_id', sid);
    if (ids.length) q = q.not('id', 'in', `(${ids.join(',')})`);
    const { error: delError } = await q;
    if (delError) throw delError;
  }
}

export async function deleteGoals(ids) {
  if (!ids || !ids.length) return;
  const { error } = await supabase.from('goals').delete().in('id', ids);
  if (error) throw error;
}

export async function saveGoals(goals) {
  const payload = goals.map((g) => {
    const key = g.scorerId ? String(g.scorerId) : null;
    const guest = key && key.startsWith('g:');
    return {
      id: g.id,
      match_id: g.matchId,
      team_id: g.teamId,
      scorer_id: guest ? null : (key || null),
      scorer_guest_name: guest ? key.slice(2) : null,
      minute: g.minute || 0,
    };
  });
  const { error } = await supabase.from('goals').upsert(payload);
  if (error) throw error;
}

export async function saveExpenses(expenses) {
  const payload = expenses.map((e) => ({
    id: isUuid(e.id) ? e.id : undefined,
    session_id: e.sessionId,
    label: e.label,
    amount: e.amount,
    created_by: e.createdBy,
  }));
  const { error } = await supabase.from('expenses').upsert(payload);
  if (error) throw error;
}

export async function savePayments(payments) {
  // members and guests upsert against different unique keys (session+profile / session+guest)
  const members = []; const guests = [];
  payments.forEach((p) => {
    const key = p.key || p.profileId || (p.guestName ? 'g:' + p.guestName : null);
    if (!key) return;
    const base = { session_id: p.sessionId, amount_due: p.amountDue, amount_paid: p.amountPaid, method: p.method, confirmed_by: p.confirmedBy || null };
    if (String(key).startsWith('g:')) guests.push({ ...base, guest_name: key.slice(2) });
    else members.push({ ...base, profile_id: key });
  });
  if (members.length) {
    const { error } = await supabase.from('payments').upsert(members, { onConflict: 'session_id,profile_id' });
    if (error) throw error;
  }
  if (guests.length) {
    const { error } = await supabase.from('payments').upsert(guests, { onConflict: 'session_id,guest_name' });
    if (error) throw error;
  }
}

// Surgical single-row writes — mirror saveAvailabilityRow's pattern below. The bulk
// saveExpenses/savePayments above re-upload this client's ENTIRE local snapshot on every edit;
// if another client's edit landed since this one last loaded, that bulk write silently
// overwrites it with stale data (the same class of bug fixed for Availability/Formation — see
// BUILD_LOG.md). ExpensesScreen now calls these for single add/edit actions instead.
export async function saveExpenseRow(e) {
  const { error } = await supabase.from('expenses').upsert({
    id: isUuid(e.id) ? e.id : undefined,
    session_id: e.sessionId,
    label: e.label,
    amount: e.amount,
    created_by: e.createdBy,
  });
  if (error) throw error;
}
export async function savePaymentRow(p) {
  const key = p.key || p.profileId || (p.guestName ? 'g:' + p.guestName : null);
  if (!key) return;
  const base = { session_id: p.sessionId, amount_due: p.amountDue, amount_paid: p.amountPaid, method: p.method, confirmed_by: p.confirmedBy || null };
  const row = String(key).startsWith('g:') ? { ...base, guest_name: key.slice(2) } : { ...base, profile_id: key };
  const onConflict = String(key).startsWith('g:') ? 'session_id,guest_name' : 'session_id,profile_id';
  const { error } = await supabase.from('payments').upsert(row, { onConflict });
  if (error) throw error;
}

function mapProfile(row) {
  return {
    id: row.id,
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    contact: row.contact || '',
    prefPos1: row.pref_pos_1 || '',
    prefPos2: row.pref_pos_2 || '',
    avatarUrl: row.avatar_url || undefined,
  };
}

function mapSession(row) {
  return {
    id: row.id,
    turfName: row.turf_name,
    location: row.location || '',
    slotStart: row.slot_start,
    slotMinutes: row.slot_minutes,
    playersPerSide: row.players_per_side,
    totalFee: asNumber(row.total_fee),
    scoring: row.scoring || MOCK_DB.scoring,
    createdBy: row.created_by,
    status: row.status,
    joinCode: row.join_code,
  };
}

function mapAvailability(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    profileId: row.profile_id || undefined,
    guestName: row.guest_name || undefined,
    status: row.status,
    addedBy: row.added_by,
  };
}

function mapTeam(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    name: row.name,
    color: row.color,
    captainId: row.captain_id || undefined,
    formationPreset: row.formation_preset || undefined,
    formation: row.formation || undefined,
  };
}

function mapMatch(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    matchNo: row.match_no,
    teamA: row.team_a,
    teamB: row.team_b,
    scoreA: row.score_a,
    scoreB: row.score_b,
    status: row.status,
    startedAt: row.started_at || undefined,
    pausedAccumSeconds: row.paused_accum_seconds,
    durationSeconds: row.duration_seconds,
  };
}

function mapGoal(row) {
  return {
    id: row.id,
    matchId: row.match_id,
    teamId: row.team_id,
    // scorer "key": a profile id, or 'g:<name>' for a guest scorer
    scorerId: row.scorer_id || (row.scorer_guest_name ? 'g:' + row.scorer_guest_name : undefined),
    minute: row.minute,
  };
}

function mapExpense(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    label: row.label,
    amount: asNumber(row.amount),
    createdBy: row.created_by,
  };
}

function mapPayment(row) {
  return {
    sessionId: row.session_id,
    profileId: row.profile_id || undefined,
    guestName: row.guest_name || undefined,
    key: row.profile_id || ('g:' + (row.guest_name || '')),
    amountDue: asNumber(row.amount_due),
    amountPaid: asNumber(row.amount_paid),
    method: row.method,
    confirmedBy: row.confirmed_by || undefined,
  };
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
}
