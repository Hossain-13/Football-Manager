import React, { useState, useEffect, useRef } from 'react';
import { DB } from './lib/db.js';
import { supabase, USE_SUPABASE } from './lib/supabase.js';
import {
  createDbView,
  getSession,
  loadAppData,
  loadDashboardStats,
  onAuthChange,
  saveAvailabilityRow,
  saveExpenses,
  saveFormation,
  saveGoals,
  saveMatches,
  savePayments,
  saveProfile,
  saveSessionMembers,
  saveTeamPlayers,
  saveTeams,
  signInWithGoogle,
  signOut,
  updateMatch,
} from './lib/liveDb.js';
import { DATA, setActiveDb } from './lib/dataView.js';
import { Icon } from './components/Icon.jsx';
import { StatusPill } from './components/core.jsx';
import { Sidebar, BottomTabBar, MoreScreen, NAV_SESSION } from './components/nav.jsx';
import { AuthScreen, DashboardScreen, SessionsScreen, DetailScreen, AvailabilityScreen } from './screens/screens1.jsx';
import { TeamsScreen, FormationScreen, ScheduleScreen } from './screens/screens2.jsx';
import { LiveScreen, StandingsScreen, HistoryScreen, ExpensesScreen, ProfileScreen } from './screens/screens3.jsx';

function buildAssign(db, keepMockPool = false) {
  const a = { pool: [] };
  db.teams.forEach((t) => {
    a[t.id] = (db.teamPlayers[t.id] || []).slice();
  });
  if (keepMockPool) {
    ['tB', 'tC', 'tD'].forEach((tid) => { const p = a[tid]?.pop(); if (p) a.pool.push(p); });
  }
  return a;
}

function App() {
  const [entered, setEntered] = useState(!USE_SUPABASE);
  const [authSession, setAuthSession] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [liveLoading, setLiveLoading] = useState(USE_SUPABASE);
  const [liveError, setLiveError] = useState('');
  const [screen, setScreen] = useState('dashboard');
  const [activeId, setActiveId] = useState('s1');
  const [side, setSide] = useState(5);
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  const dbView = USE_SUPABASE && liveData && authSession ? createDbView(liveData, authSession.user.id) : DB;
  setActiveDb(dbView);

  // mutable app state; live mode hydrates this from Supabase after auth.
  const [matches, setMatchesState] = useState(() => DATA.matches.map((m) => ({ ...m })));
  const [assignValue, setAssignState] = useState(() => buildAssign(DATA, true));
  const [captainsValue, setCaptainsState] = useState(() => { const c = {}; DATA.teams.forEach((t) => (c[t.id] = t.captainId)); return c; });
  const [availabilityValue, setAvailabilityState] = useState(() => DATA.availability.filter((x) => x.sessionId === 's2').map((x) => ({ ...x })));
  const [paymentsValue, setPaymentsState] = useState(() => DATA.payments.map((p) => ({ ...p })));
  const [expensesValue, setExpensesState] = useState(() => DATA.expenses.map((e) => ({ ...e })));
  const [membersValue, setMembersState] = useState(() => DATA.members.map((m) => ({ ...m })));
  const [hydratedLiveData, setHydratedLiveData] = useState(null);

  const session = DATA.sessions.find((s) => s.id === activeId) || DATA.sessions[0];
  const upcoming = DATA.sessions.find((s) => s.status === 'upcoming') || session;

  const refreshLiveData = async (userId, options = {}) => {
    if (!options.silent) setLiveLoading(true);
    setLiveError('');
    try {
      // load summary + only the active session's heavy detail (lazy per-session)
      const target = options.target ?? activeIdRef.current;
      const data = await loadAppData(userId, target);
      setLiveData(data);
    } catch (error) {
      setLiveError(error.message || 'Could not load Supabase data.');
    } finally {
      if (!options.silent) setLiveLoading(false);
    }
  };

  // Open a session and load ITS detail (the heavy tables) on demand.
  const openSession = (id) => {
    // Already on this session? Just navigate — do NOT refetch (a reload here would race
    // and overwrite a player's just-made, not-yet-committed availability mark).
    if (id === activeIdRef.current) return;
    setActiveId(id);
    if (USE_SUPABASE && authSession) refreshLiveData(authSession.user.id, { silent: true, target: id });
  };

  const startGoogleSignIn = () => {
    setLiveError('');
    setLiveLoading(true);
    return signInWithGoogle().catch((error) => {
      setLiveLoading(false);
      throw error;
    });
  };

  const logout = () => { signOut().catch(() => {}); };
  const reload = () => { if (USE_SUPABASE && authSession) refreshLiveData(authSession.user.id, { silent: true }); };
  const [refreshing, setRefreshing] = useState(false);
  const doRefresh = async () => {
    if (!USE_SUPABASE || !authSession || refreshing) return;
    setRefreshing(true);
    try { await refreshLiveData(authSession.user.id, { silent: true }); }
    finally { setTimeout(() => setRefreshing(false), 450); } // keep the spinner visible briefly
  };

  // Cross-session aggregates for the Dashboard (loaded when the dashboard is shown).
  const [dashStats, setDashStats] = useState(null);
  useEffect(() => {
    if (!USE_SUPABASE || !authSession || screen !== 'dashboard') return;
    loadDashboardStats(authSession.user.id).then(setDashStats).catch(() => {});
  }, [screen, authSession, liveData]);

  // Get started (first time) / Welcome back (returning) modal over a blurred dashboard.
  const [welcome, setWelcome] = useState(null); // null | 'started' | 'back'
  const welcomeInit = useRef(false);
  const dismissWelcome = () => {
    if (authSession) { try { localStorage.setItem('turf_welcomed_' + authSession.user.id, '1'); } catch (e) {} }
    setWelcome(null);
  };
  useEffect(() => {
    if (!USE_SUPABASE || !authSession || welcomeInit.current) return;
    const p = DATA.profile(authSession.user.id);
    const onboarded = p && p.firstName && p.contact && p.prefPos1 && p.prefPos2;
    if (!onboarded) return; // wait until the profile is complete + loaded
    welcomeInit.current = true;
    let seen = false;
    try { seen = !!localStorage.getItem('turf_welcomed_' + authSession.user.id); } catch (e) {}
    setWelcome(seen ? 'back' : 'started');
  }, [authSession, liveData]);

  // Browser Back restores the previous in-app screen (set by go()'s pushState).
  useEffect(() => {
    const onPop = (e) => {
      const st = e.state;
      if (st && st.turf) {
        if (st.activeId) setActiveId(st.activeId);
        setScreen(st.screen || 'dashboard');
      } else {
        setScreen('dashboard');
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (!USE_SUPABASE) return undefined;
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const callbackError = search.get('error_description') || hash.get('error_description') || search.get('error') || hash.get('error');
    if (callbackError) {
      setLiveError(callbackError.replace(/\+/g, ' '));
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    let disposed = false;
    // supabase-js (PKCE + detectSessionInUrl) consumes the ?code= callback on init,
    // so we just read the resulting session - no manual token parsing.
    getSession()
      .then((sessionData) => {
        if (disposed) return;
        // tidy the URL after the OAuth round-trip (?code=... / #access_token=...)
        if (window.location.search.includes('code=') || window.location.hash.includes('access_token')) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        setAuthSession(sessionData);
        if (sessionData) refreshLiveData(sessionData.user.id);
        else setLiveLoading(false);
      })
      .catch((error) => {
        if (!disposed) {
          setLiveError(error.message || 'Could not read Supabase auth session.');
          setLiveLoading(false);
        }
      });
    const { data } = onAuthChange((sessionData) => {
      setAuthSession(sessionData);
      if (sessionData) refreshLiveData(sessionData.user.id);
      else {
        setLiveData(null);
        setEntered(false);
        setLiveLoading(false);
      }
    });
    return () => {
      disposed = true;
      data?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!USE_SUPABASE || !liveData || liveData === hydratedLiveData) return;
    const nextDb = authSession ? createDbView(liveData, authSession.user.id) : DB;
    setActiveDb(nextDb);
    setMatchesState(nextDb.matches.map((m) => ({ ...m })));
    setAssignState(buildAssign(nextDb));
    setCaptainsState(() => { const c = {}; nextDb.teams.forEach((t) => (c[t.id] = t.captainId)); return c; });
    setAvailabilityState(nextDb.availability.map((x) => ({ ...x })));
    setPaymentsState(nextDb.payments.map((p) => ({ ...p })));
    setExpensesState(nextDb.expenses.map((e) => ({ ...e })));
    setMembersState(nextDb.members.map((m) => ({ ...m })));
    if (nextDb.sessions.length && !nextDb.sessions.some((s) => s.id === activeId)) {
      setActiveId(nextDb.sessions[0].id);
    }
    setHydratedLiveData(liveData);
  }, [liveData, authSession, hydratedLiveData, activeId]);

  // Keep a ref to the freshest refresh fn so the realtime channel can subscribe ONCE per auth
  // session (re-subscribing on every liveData change dropped events mid-resubscribe).
  const refreshRef = useRef(() => {});
  refreshRef.current = () => { if (authSession) refreshLiveData(authSession.user.id, { silent: true }); };

  useEffect(() => {
    if (!USE_SUPABASE || !authSession) return undefined;
    let timer = null;
    const bump = () => { clearTimeout(timer); timer = setTimeout(() => refreshRef.current(), 200); };
    const channel = supabase
      .channel('turf-live-refresh')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'availability' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_players' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_members' }, bump)
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [authSession]);

  // Roles & lock are derived from real data for the signed-in user - never toggled.
  const me = DATA.currentUserId;
  const sessionMember = session && membersValue.find((m) => m.sessionId === session.id && m.profileId === me);
  const isAdmin = Boolean(session && (session.createdBy === me || sessionMember?.role === 'admin'));
  const role = isAdmin ? 'admin' : sessionMember?.role === 'organizer' ? 'organizer' : 'player';
  const canManage = role === 'admin' || role === 'organizer';
  // Captain of any team in this session may run the live clock + scores.
  const isCaptain = session ? DATA.teams.some((t) => t.sessionId === session.id && t.captainId === me) : false;
  // The 2-hour team-management lock applies to PLAYERS ONLY; organizers always bypass it.
  const within2h = session ? Date.now() >= new Date(session.slotStart).getTime() - 2 * 3600 * 1000 : false;
  const locked = !canManage && within2h;

  const persist = USE_SUPABASE && Boolean(authSession && liveData);
  const persistError = (error) => setLiveError(error.message || 'Supabase write failed.');

  const setMatches = (next) => setMatchesState((prev) => {
    const value = typeof next === 'function' ? next(prev) : next;
    if (persist) saveMatches(value).catch(persistError);
    return value;
  });
  // Surgical single-match write for LIVE control (score/clock/status). Optimistic locally;
  // persists via a plain UPDATE so a captain (not just managers) is allowed by RLS.
  const updateMatchLocal = (matchId, patch) => {
    setMatchesState((prev) => prev.map((m) => (m.id === matchId ? { ...m, ...patch } : m)));
    if (persist) updateMatch(matchId, patch).catch(persistError);
  };
  const setAssign = (next) => setAssignState((prev) => {
    const value = typeof next === 'function' ? next(prev) : next;
    if (persist) saveTeamPlayers(value).catch(persistError);
    return value;
  });
  const setCaptains = (next) => setCaptainsState((prev) => {
    const value = typeof next === 'function' ? next(prev) : next;
    if (persist) saveTeams(DATA.teams, value).catch(persistError);
    return value;
  });
  // Local-only state update. Persistence is SURGICAL (one changed row) via saveAvailRow below,
  // so a player never re-writes the whole pool (which RLS rejected -> marks vanished) and a
  // manager never clobbers everyone else from a stale local copy.
  const setAvailability = (next) => setAvailabilityState((prev) => (typeof next === 'function' ? next(prev) : next));
  const saveAvailRow = (row) => {
    if (persist && session?.id) saveAvailabilityRow(session.id, row).catch(persistError);
  };
  const setPayments = (next) => setPaymentsState((prev) => {
    const value = typeof next === 'function' ? next(prev) : next;
    if (persist) savePayments(value).catch(persistError);
    return value;
  });
  const setExpenses = (next) => setExpensesState((prev) => {
    const value = typeof next === 'function' ? next(prev) : next;
    if (persist) saveExpenses(value).catch(persistError);
    return value;
  });
  const setMembers = (next) => setMembersState((prev) => {
    const value = typeof next === 'function' ? next(prev) : next;
    if (persist && session?.id) saveSessionMembers(session.id, value).catch(persistError);
    return value;
  });

  const go = (s) => {
    setScreen(s);
    // push an in-app history entry so the browser Back button navigates screens
    // (instead of jumping out to the Google auth page).
    try { window.history.pushState({ turf: true, screen: s, activeId: activeIdRef.current }, ''); } catch (e) {}
    const sc = document.querySelector('.app__scroll'); if (sc) sc.scrollTop = 0;
  };
  const sessionMatches = session ? matches.filter((m) => m.sessionId === session.id) : [];
  const setSessionMatches = (next) => {
    const value = typeof next === 'function' ? next(sessionMatches) : next;
    setMatches([...matches.filter((m) => m.sessionId !== session.id), ...value]);
  };
  const sessionTeams = session ? DATA.teams.filter((t) => t.sessionId === session.id) : [];

  const ctx = {
    role, isAdmin, canManage, isCaptain, locked,
    go, openSession, session, upcoming, side, setSide,
    teams: sessionTeams,
    matches: sessionMatches, setMatches: setSessionMatches, updateMatch: updateMatchLocal,
    assign: [assignValue, setAssign],
    captains: [captainsValue, setCaptains],
    members: [membersValue, setMembers],
    availability: [availabilityValue, setAvailability],
    saveAvailRow,
    payments: [paymentsValue, setPayments],
    expenses: [expensesValue, setExpenses],
    saveGoals: (goals) => persist && saveGoals(goals).catch(persistError),
    saveFormation: (teamId, formation) => persist && saveFormation(teamId, formation).catch(persistError),
    logout, reload, dashStats, me,
  };

  if (USE_SUPABASE && liveLoading) {
    return <div className="hero-auth pitch-bg"><div className="auth-card"><div className="card card--pad">Loading TURF...</div></div></div>;
  }

  if (USE_SUPABASE && !authSession) {
    return <AuthScreen live error={liveError} busy={liveLoading} onGoogle={startGoogleSignIn} onDone={() => {}} />;
  }

  const myProfile = USE_SUPABASE && authSession ? DATA.profile(authSession.user.id) : null;
  const needsOnboarding = USE_SUPABASE && authSession && (!myProfile?.firstName || !myProfile?.contact || !myProfile?.prefPos1 || !myProfile?.prefPos2);
  if (needsOnboarding) {
    return (
      <AuthScreen
        live
        profile={myProfile || {}}
        error={liveError}
        busy={liveLoading}
        onGoogle={startGoogleSignIn}
        onDone={(profile) => saveProfile(authSession.user.id, profile)
          .then(() => refreshLiveData(authSession.user.id))
          .then(() => setEntered(true))
          .catch(persistError)}
      />
    );
  }

  if (!USE_SUPABASE && !entered) return <AuthScreen onDone={() => setEntered(true)} />;

  // NOTE: no more forced "create first session" page. A user with zero sessions lands on the
  // Dashboard (which has its own empty state) + the Get-started modal. Creating/joining lives
  // on My Sessions (Steps 7-8).
  const titles = {
    dashboard: ['Dashboard', 'Your activity'],
    sessions: ['My Sessions', 'Join or create a matchday'],
    detail: [session?.turfName || 'Session', 'Session overview'],
    availability: ['Availability', 'Who’s in for the next game'],
    teams: ['Team Builder', 'Split the squad'],
    formation: ['Formation', 'Tactical board'],
    schedule: ['Schedule', 'Fixture list'],
    live: ['Live Match', 'Matchday control'],
    standings: ['Standings', 'League table'],
    history: ['History', 'Past results'],
    expenses: ['Expenses', 'Turf bill & payments'],
    profile: ['Profile', 'You'],
    more: ['More', ''],
  };
  const [tt, ts] = titles[screen] || ['TURF', ''];

  const screens = {
    dashboard: <DashboardScreen ctx={ctx} />,
    sessions: <SessionsScreen ctx={ctx} />,
    detail: <DetailScreen ctx={ctx} key={session?.id} />,
    availability: <AvailabilityScreen ctx={ctx} />,
    teams: <TeamsScreen ctx={ctx} />,
    formation: <FormationScreen ctx={ctx} />,
    schedule: <ScheduleScreen ctx={ctx} />,
    live: <LiveScreen ctx={ctx} />,
    standings: <StandingsScreen ctx={ctx} />,
    history: <HistoryScreen ctx={ctx} />,
    expenses: <ExpensesScreen ctx={ctx} />,
    profile: <ProfileScreen ctx={ctx} />,
    more: <MoreScreen go={go} sessionName={session?.turfName} />,
  };

  return (
    <div className="app pitch-bg">
      <Sidebar screen={screen} go={go} sessions={DATA.sessions} activeId={activeId} openSession={openSession} />
      <div className="app__main">
        <header className="topbar">
          <div>
            <div className="topbar__title">{tt}</div>
            {ts && <div className="topbar__sub">{ts}</div>}
          </div>
          <div className="topbar__spacer" />
          {/* Role badges reflect the signed-in user's real permissions for this session. */}
          <div className="row" style={{ gap: 6 }}>
            {role === 'admin' && <span className="pill" style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>Creator</span>}
            {role === 'organizer' && <span className="pill" style={{ color: 'var(--sky)', borderColor: 'var(--sky)' }}>Organizer</span>}
            {isCaptain && <span className="pill" style={{ color: 'var(--amber)', borderColor: 'var(--amber)' }}>Captain</span>}
            {locked && <StatusPill status="locked" />}
            {USE_SUPABASE && authSession && (
              <button className="btn btn--ghost btn--sm" onClick={doRefresh} disabled={refreshing} title="Refresh data from server">
                <span className={refreshing ? 'spin' : ''} style={{ display: 'inline-flex' }}><Icon name="refresh" size={14} /></span>
                {refreshing ? ' Refreshing…' : ' Refresh'}
              </button>
            )}
            {USE_SUPABASE && authSession && (
              <button className="btn btn--ghost btn--sm" onClick={logout} title="Log out">Log out</button>
            )}
          </div>
        </header>
        <div className="app__scroll">
          {NAV_SESSION.some((n) => n.id === screen) && !session ? (
            <div className="page page--narrow">
              <div className="card card--pad" style={{ textAlign: 'center' }}>
                <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 22, margin: '0 0 6px' }}>No session selected</h2>
                <p className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>Create or join a matchday first — its pages open here once you have one.</p>
                <button className="btn btn--accent" onClick={() => go('sessions')}><Icon name="sessions" className="ico" /> Go to My Sessions</button>
              </div>
            </div>
          ) : screens[screen]}
        </div>
        <BottomTabBar screen={screen} go={go} />
      </div>

      {welcome && (
        <div className="modal-backdrop" onClick={dismissWelcome}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="brand__mark" style={{ width: 46, height: 46, fontSize: 26, margin: '0 auto 12px' }}>T</div>
            <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 24, margin: '0 0 6px' }}>
              {welcome === 'started' ? 'Get started' : 'Welcome back'}
            </h2>
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.5, margin: '0 0 18px' }}>
              {welcome === 'started'
                ? "You're all set. Create a session or join one with a code, then sort teams and run the match."
                : 'Good to see you again. Jump back into your matchdays.'}
            </p>
            <button className="btn btn--accent btn--block" onClick={dismissWelcome}>
              {welcome === 'started' ? "Let's go" : 'Continue'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


export default App;
