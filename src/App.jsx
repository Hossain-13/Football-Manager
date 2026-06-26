import React, { useState, useEffect, useRef } from 'react';
import { DB } from './lib/db.js';
import { supabase, USE_SUPABASE } from './lib/supabase.js';
import {
  createDbView,
  getSession,
  loadAppData,
  loadCareerStats,
  loadDashboardStats,
  onAuthChange,
  saveAvailabilityRow,
  saveExpenseRow,
  saveFormation,
  saveGoals,
  saveMatches,
  savePaymentRow,
  saveProfile,
  saveSessionMembers,
  saveTeamPlayers,
  saveTeams,
  signInWithGoogle,
  signOut,
  updateMatch,
} from './lib/liveDb.js';
import { DATA, setActiveDb } from './lib/dataView.js';
import { dateLabel, timeOfDay } from './lib/format.js';
import { Icon } from './components/Icon.jsx';
import { StatusPill, AccountActions, AppSkeleton } from './components/core.jsx';
import { DialogProvider, useDialog } from './components/dialog.jsx';
import { Sidebar, BottomTabBar, MoreScreen, NAV_SESSION } from './components/nav.jsx';
import { AuthScreen } from './screens/AuthScreen.jsx';
import { DashboardScreen } from './screens/DashboardScreen.jsx';
import { SessionsScreen } from './screens/SessionsScreen.jsx';
import { DetailScreen } from './screens/DetailScreen.jsx';
import { AvailabilityScreen } from './screens/AvailabilityScreen.jsx';
import { TeamsScreen } from './screens/TeamsScreen.jsx';
import { FormationScreen } from './screens/FormationScreen.jsx';
import { ScheduleScreen } from './screens/ScheduleScreen.jsx';
import { LiveScreen } from './screens/LiveScreen.jsx';
import { HistoryScreen } from './screens/HistoryScreen.jsx';
import { ExpensesScreen } from './screens/ExpensesScreen.jsx';
import { ProfileScreen } from './screens/ProfileScreen.jsx';

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
  return (
    <DialogProvider>
      <AppShell />
    </DialogProvider>
  );
}

// Restores the screen/session a user was on across a hard refresh. sessionStorage (not
// localStorage) so this clears with the tab/browser session, never sticks around stale.
const NAV_STATE_KEY = 'turf_nav_state';
function readNavState() {
  try { return JSON.parse(sessionStorage.getItem(NAV_STATE_KEY) || 'null'); } catch (e) { return null; }
}
function writeNavState(screen, activeId) {
  try { sessionStorage.setItem(NAV_STATE_KEY, JSON.stringify({ screen, activeId })); } catch (e) {}
}

function AppShell() {
  const { confirm, alert } = useDialog();
  const [entered, setEntered] = useState(!USE_SUPABASE);
  const [authSession, setAuthSession] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [liveLoading, setLiveLoading] = useState(USE_SUPABASE);
  const [liveError, setLiveError] = useState('');
  const restoredNav = useRef(readNavState());
  const [screen, setScreen] = useState(restoredNav.current?.screen || 'dashboard');
  const [activeId, setActiveId] = useState(restoredNav.current?.activeId || 's1');
  const [side, setSide] = useState(5);
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const screenRef = useRef(screen);
  screenRef.current = screen;

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
      return true;
    } catch (error) {
      setLiveError(error.message || 'Could not load Supabase data.');
      // A "silent" refresh (manual Refresh button, session switch) skips the full-page loading
      // skeleton on purpose, but a failure must still surface SOMETHING - previously it just
      // vanished, so a real error (network drop, RLS reject) looked identical to "nothing
      // happened" / the button doing nothing at all.
      if (options.silent) alert({ title: 'Refresh failed', message: error.message || 'Could not load the latest data. Check your connection and try again.', danger: true });
      return false;
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
    writeNavState(screenRef.current, id);
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

  // Same idea for the Profile page's "Career stats" - was hardcoded placeholder numbers before.
  const [careerStats, setCareerStats] = useState(null);
  useEffect(() => {
    if (!USE_SUPABASE || !authSession || screen !== 'profile') return;
    loadCareerStats(authSession.user.id).then(setCareerStats).catch(() => {});
  }, [screen, authSession, liveData]);

  // Get started (first time) / Welcome back (returning) modal over a blurred dashboard.
  const [welcome, setWelcome] = useState(null); // null | 'started' | 'back'
  const [welcomeClosing, setWelcomeClosing] = useState(false);
  const welcomeInit = useRef(false);
  const dismissWelcome = () => {
    if (authSession) { try { localStorage.setItem('turf_welcomed_' + authSession.user.id, '1'); } catch (e) {} }
    setWelcomeClosing(true);
    setTimeout(() => { setWelcome(null); setWelcomeClosing(false); }, 180);
  };
  useEffect(() => {
    if (!USE_SUPABASE || !authSession || welcomeInit.current) return;
    // Session-scoped (not the permanent turf_welcomed_<uid> flag below): a hard refresh
    // mid-session must not re-show this modal for a user who already dismissed it a moment
    // ago. sessionStorage clears with the tab, so a genuinely new session still sees it once.
    const sessionKey = 'turf_welcome_session_' + authSession.user.id;
    let shownThisSession = false;
    try { shownThisSession = !!sessionStorage.getItem(sessionKey); } catch (e) {}
    if (shownThisSession) { welcomeInit.current = true; return; }
    const p = DATA.profile(authSession.user.id);
    const onboarded = p && p.firstName && p.contact && p.prefPos1 && p.prefPos2;
    if (!onboarded) return; // wait until the profile is complete + loaded
    welcomeInit.current = true;
    let seen = false;
    try { seen = !!localStorage.getItem('turf_welcomed_' + authSession.user.id); } catch (e) {}
    try { sessionStorage.setItem(sessionKey, '1'); } catch (e) {}
    setWelcome(seen ? 'back' : 'started');
  }, [authSession, liveData]);

  // Browser Back restores the previous in-app screen (set by go()'s pushState).
  useEffect(() => {
    const onPop = (e) => {
      const st = e.state;
      if (st && st.turf) {
        if (st.activeId) setActiveId(st.activeId);
        setScreen(st.screen || 'dashboard');
        writeNavState(st.screen || 'dashboard', st.activeId || activeIdRef.current);
      } else {
        setScreen('dashboard');
        writeNavState('dashboard', activeIdRef.current);
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
  // Local-only; persistence is SURGICAL (one row) via savePaymentRow/saveExpenseRow below, so one
  // client's stale snapshot never overwrites another client's concurrent edit on refresh/reload.
  const setPayments = (next) => setPaymentsState((prev) => (typeof next === 'function' ? next(prev) : next));
  const setExpenses = (next) => setExpensesState((prev) => (typeof next === 'function' ? next(prev) : next));
  const savePaymentRowCtx = (row) => { if (persist) savePaymentRow(row).catch(persistError); };
  const saveExpenseRowCtx = (row) => { if (persist) saveExpenseRow(row).catch(persistError); };
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
    writeNavState(s, activeIdRef.current);
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
    savePaymentRow: savePaymentRowCtx,
    saveExpenseRow: saveExpenseRowCtx,
    saveGoals: (goals) => persist && saveGoals(goals).catch(persistError),
    saveFormation: (teamId, formation) => persist && saveFormation(teamId, formation).catch(persistError),
    logout, reload, dashStats, careerStats, me,
    confirm, alert,
  };

  if (USE_SUPABASE && liveLoading) {
    return <AppSkeleton />;
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
  // Session-scoped pages show the actual matchday (name + kickoff) as the subtitle instead of a
  // generic tagline that just repeated what the screen's own heading already said.
  const sessCtx = session ? `${session.turfName} · ${dateLabel(session.slotStart)} · ${timeOfDay(session.slotStart)}` : '';
  const titles = {
    dashboard: ['Dashboard', 'Your activity'],
    sessions: ['My Sessions', 'Join or create a matchday'],
    detail: [session?.turfName || 'Session', session ? `${dateLabel(session.slotStart)} · ${timeOfDay(session.slotStart)}` : ''],
    availability: ['IN/OUT', sessCtx],
    teams: ['Team Builder', sessCtx],
    formation: ['Formation', sessCtx],
    schedule: ['Schedule', sessCtx],
    live: ['Live Match', sessCtx],
    standings: ['Standings', sessCtx],
    history: ['History', sessCtx],
    expenses: ['Expenses', sessCtx],
    profile: ['Profile', 'You'],
    more: ['More', session?.turfName || ''],
  };
  const [tt, ts] = titles[screen] || ['TURF', ''];

  const screens = {
    dashboard: <DashboardScreen ctx={ctx} />,
    sessions: <SessionsScreen ctx={ctx} />,
    detail: <DetailScreen ctx={ctx} key={session?.id} />,
    availability: <AvailabilityScreen ctx={ctx} />,
    teams: <TeamsScreen ctx={ctx} />,
    formation: <FormationScreen ctx={ctx} />,
    schedule: <ScheduleScreen ctx={ctx} defaultTab="fixtures" />,
    live: <LiveScreen ctx={ctx} />,
    standings: <ScheduleScreen ctx={ctx} defaultTab="table" />,
    history: <HistoryScreen ctx={ctx} />,
    expenses: <ExpensesScreen ctx={ctx} />,
    profile: <ProfileScreen ctx={ctx} />,
    more: <MoreScreen go={go} />,
  };

  return (
    <div className="app pitch-bg">
      <Sidebar screen={screen} go={go} sessions={DATA.sessions} activeId={activeId} openSession={openSession} onLogout={logout} />
      <div className="app__main">
        <header className="topbar">
          <div>
            <div className="topbar__title">{tt}</div>
            {ts && <div className="topbar__sub">{ts}</div>}
          </div>
          <div className="topbar__spacer" />
          <div className="row" style={{ gap: 8 }}>
            {locked && <StatusPill status="locked" />}
            {USE_SUPABASE && authSession && (
              <AccountActions refreshing={refreshing} onRefresh={doRefresh} onProfile={() => go('profile')} onLogout={logout} />
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
        <div className={'modal-backdrop' + (welcomeClosing ? ' is-closing' : '')} onClick={dismissWelcome}>
          <div className={'modal-card' + (welcomeClosing ? ' is-closing' : '')} onClick={(e) => e.stopPropagation()}>
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
