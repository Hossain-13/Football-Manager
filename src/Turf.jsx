/* =====================================================================
   TURF — combined UI module (ported from design-export/).
   Auto-assembled from the Claude Design prototype: components + screens
   + app shell concatenated into one ES module so their original
   shared-scope cross-references keep working. window.* registrations and
   the React-global destructure were stripped; imports added below.
   See BUILD_LOG.md for the porting rationale.
   ===================================================================== */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { DB } from './lib/db.js';
import { supabase, USE_SUPABASE } from './lib/supabase.js';
import {
  createDbView,
  createSession,
  createTeam,
  deleteSession,
  deleteTeam,
  getSession,
  joinSession,
  loadAppData,
  loadDashboardStats,
  onAuthChange,
  peekSession,
  saveAvailabilityRow,
  saveExpenses,
  saveFormation,
  saveMatches,
  saveGoals,
  savePayments,
  saveProfile,
  saveSessionMembers,
  saveTeamPlayers,
  saveTeams,
  updateMatch,
  setOrganizerRole,
  signInWithGoogle,
  signOut,
  updateSession,
} from './lib/liveDb.js';

let ACTIVE_DB = DB;
const DATA = new Proxy({}, {
  get(_target, prop) {
    return ACTIVE_DB[prop];
  },
});

/* Player "keys" used in team building are either a profile id (real member) or
   'g:<name>' for a guest (no account). These helpers resolve a key to display values. */
const isGuestKey = (k) => typeof k === 'string' && k.startsWith('g:');
const keyFirst = (k) => (isGuestKey(k) ? k.slice(2) : DATA.first(k));
const keyName = (k) => (isGuestKey(k) ? k.slice(2) : DATA.name(k));

/* Simple stroked UI icons -> window.Icon  (functional line icons only) */
const Icon = ({ name, className = 'ico', size }) => {
  const s = size ? { width: size, height: size } : undefined;
  const P = {
    sessions: <><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></>,
    squad: <><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 8.5a3 3 0 0 1 0 5M17 19a5 5 0 0 0-2.5-4.3"/></>,
    teams: <><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/></>,
    formation: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h18M12 3v18"/><circle cx="12" cy="12" r="3"/></>,
    schedule: <><path d="M4 6h16M4 12h16M4 18h10"/><circle cx="19" cy="18" r="1.4"/></>,
    live: <><circle cx="12" cy="12" r="9"/><path d="M10 9l5 3-5 3z"/></>,
    standings: <><path d="M7 21V9M12 21V4M17 21v-7"/><path d="M3 21h18"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 4v4h4M12 8v4l3 2"/></>,
    expenses: <><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="16.5" cy="14" r="1.3"/></>,
    profile: <><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    minus: <><path d="M5 12h14"/></>,
    lock: <><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></>,
    unlock: <><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7-2.6"/></>,
    check: <><path d="M4 12.5l5 5 11-11"/></>,
    x: <><path d="M6 6l12 12M18 6L6 18"/></>,
    chevron: <><path d="M9 6l6 6-6 6"/></>,
    chevronDown: <><path d="M6 9l6 6 6-6"/></>,
    chevronUp: <><path d="M6 15l6-6 6 6"/></>,
    grip: <><circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/></>,
    shuffle: <><path d="M3 4h4l10 16h4M3 20h4l3-5M16 4h5v0M14 9l3-5"/><path d="M18 2l3 2-3 2M18 18l3 2-3 2"/></>,
    pause: <><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></>,
    play: <><path d="M7 4l13 8-13 8z"/></>,
    reset: <><path d="M4 4v6h6"/><path d="M4 10a8 8 0 1 1-1 6"/></>,
    refresh: <><path d="M20 11a8 8 0 1 0-.7 4"/><path d="M20 5v6h-6"/></>,
    edit: <><path d="M5 19h14M5 19l1-4 9-9 3 3-9 9z"/></>,
    pin: <><path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    whistle: <><circle cx="9" cy="14" r="5"/><path d="M14 11l7-3-1 4-6 1M9 9V6h4"/></>,
    flag: <><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></>,
    more: <><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></>,
    trophy: <><path d="M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9 19h6M10 15v4M14 15v4"/></>,
    arrowR: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    location: <><path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/></>,
    google: null,
  };
  if (name === 'google') {
    return (
      <svg className={className} style={s} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path fill="#4285F4" d="M21.6 12.2c0-.6-.1-1.2-.2-1.8H12v3.5h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.2z"/>
        <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.5l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z"/>
        <path fill="#FBBC05" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9z"/>
        <path fill="#EA4335" d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.7 9.4 6.1 12 6.1z"/>
      </svg>
    );
  }
  return (
    <svg className={className} style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name] || null}
    </svg>
  );
};
/* =====================================================================
   TURF — core presentational components + small utils  -> window.*
   ===================================================================== */

/* ---------- utils ---------- */
const pad = (n) => String(n).padStart(2, '0');
const mmss = (sec) => { sec = Math.max(0, Math.floor(sec)); return pad(Math.floor(sec / 60)) + ':' + pad(sec % 60); };
const timeOfDay = (isoStr) => new Date(isoStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const dateLabel = (isoStr) => new Date(isoStr).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
const taka = (n) => '\u09F3' + n.toLocaleString('en-IN');
const newId = (prefix = 'id') => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : prefix + Date.now());
const buildDefaultMatches = (sessionId, teams) => {
  const pairIndexes = [[0, 1], [2, 3], [0, 4], [1, 2], [3, 4], [0, 2], [1, 3], [2, 4], [0, 3], [1, 4]];
  return pairIndexes
    .filter(([a, b]) => teams[a] && teams[b])
    .map(([a, b], index) => ({
      id: newId('match'),
      sessionId,
      matchNo: index + 1,
      teamA: teams[a].id,
      teamB: teams[b].id,
      scoreA: 0,
      scoreB: 0,
      status: index === 0 ? 'live' : 'scheduled',
      durationSeconds: 900,
    }));
};

function useNow(ms = 1000) {
  const [, set] = useState(0);
  useEffect(() => { const t = setInterval(() => set((x) => x + 1), ms); return () => clearInterval(t); }, [ms]);
  return Date.now();
}

/* countdown text to a target time */
function Countdown({ to, prefix = '', expired = 'now' }) {
  useNow(1000);
  const diff = new Date(to).getTime() - Date.now();
  if (diff <= 0) return <span>{expired}</span>;
  const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
  const d = Math.floor(h / 24);
  const txt = d >= 1 ? `${d}d ${h % 24}h` : h >= 1 ? `${h}h ${pad(m)}m` : `${pad(m)}:${pad(s)}`;
  return <span>{prefix}{txt}</span>;
}

/* ---------- avatars / chips ---------- */
function Avatar({ id, name, size = 34, color }) {
  const init = id ? DATA.initials(id) : (name ? name.split(' ').map((x) => x[0]).slice(0, 2).join('') : '?');
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.4, background: color || undefined }}>
      {init.toUpperCase()}
    </div>
  );
}

function TeamDot({ color }) { return <span className="team-dot" style={{ background: color }} />; }

function Armband() { return <span className="armband" title="Captain">C</span>; }

function PlayerChip({ id, name, sub, right, captain }) {
  return (
    <div className="player-chip">
      <Avatar id={id} name={name} size={32} />
      <div className="grow">
        <div className="row" style={{ gap: 6 }}>
          <span className="player-chip__name">{id ? DATA.name(id) : name}</span>
          {captain && <Armband />}
        </div>
        {sub && <div className="player-chip__meta">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

/* ---------- pills ---------- */
function StatusPill({ status }) {
  const map = {
    live: ['pill--live', 'Live'], upcoming: ['', 'Upcoming'], done: ['pill--done', 'Full time'],
    locked: ['pill--locked', 'Locked'], scheduled: ['', 'Scheduled'],
    paid: ['pill--paid', 'Paid'], due: ['pill--due', 'Due'], out: ['pill--out', 'Out'],
  };
  const [cls, label] = map[status] || ['', status];
  return <span className={'pill ' + cls}>{(status === 'live' || cls.includes('live')) && <span className="dot" />}{label}</span>;
}

/* ---------- role gating ---------- */
/* Wrap controls. When !can, dim + block + show a lock reason chip. */
function RoleGate({ can, reason, children, inline }) {
  if (can) return children;
  return (
    <div className={'rolegate' + (inline ? ' inline' : '')} style={{ position: 'relative', display: inline ? 'inline-flex' : 'block' }}
      title={reason}>
      <div style={{ opacity: 0.45, pointerEvents: 'none', filter: 'grayscale(.3)' }}>{children}</div>
      <div className="row" style={{ gap: 6, marginTop: 6, color: 'var(--amber)', fontSize: 11.5 }}>
        <Icon name="lock" className="ico" /> <span>{reason}</span>
      </div>
    </div>
  );
}

function GateBanner({ reason, locked }) {
  return (
    <div className="gate-banner">
      <Icon name={locked ? 'lock' : 'clock'} className="ico" />
      <span>{reason}</span>
    </div>
  );
}

/* ---------- session card ---------- */
function SessionCard({ session, onOpen, count }) {
  const s = session;
  const isUpcoming = s.status === 'upcoming';
  return (
    <div className="card card--pad session-card" onClick={onOpen}>
      <div className="session-card__pitch" />
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="row" style={{ gap: 8 }}>
            <StatusPill status={s.status} />
            <span className="tag">{s.playersPerSide}-A-SIDE</span>
          </div>
          <h3 style={{ fontFamily: 'var(--f-display)', fontSize: 24, margin: '12px 0 2px', letterSpacing: '.01em' }}>{s.turfName}</h3>
          <div className="row muted" style={{ gap: 5, fontSize: 13 }}>
            <Icon name="location" className="ico" style={{ width: 14, height: 14 }} /> {s.location}
          </div>
        </div>
        <Icon name="arrowR" className="ico" style={{ color: 'var(--chalk-faint)' }} />
      </div>

      <div className="row between" style={{ alignItems: 'flex-end' }}>
        <div>
          <div className="muted mono" style={{ fontSize: 10, letterSpacing: '.1em', marginBottom: 4 }}>
            {dateLabel(s.slotStart)} · {timeOfDay(s.slotStart)}
          </div>
          <div className="cd">
            {isUpcoming
              ? <><span className="cd__val"><Countdown to={s.slotStart} /></span><span className="cd__unit">TO KICK-OFF</span></>
              : s.status === 'live'
                ? <><span className="cd__val" style={{ color: 'var(--accent)' }}>LIVE</span><span className="cd__unit">MATCHDAY</span></>
                : <><span className="cd__val">FT</span><span className="cd__unit">COMPLETED</span></>}
          </div>
        </div>
        <div className="row" style={{ gap: -8 }}>
          <div className="row" style={{ marginRight: 8 }}>
            {DATA.profiles.slice(0, 4).map((p, i) => (
              <div key={p.id} style={{ marginLeft: i ? -10 : 0 }}>
                <Avatar id={p.id} size={28} />
              </div>
            ))}
          </div>
          <span className="num" style={{ fontSize: 15 }}>{count || 24}<span className="muted" style={{ fontSize: 12 }}> in</span></span>
        </div>
      </div>
    </div>
  );
}

/* ---------- field ---------- */
function Field({ label, children }) {
  return <div className="field"><label>{label}</label>{children}</div>;
}
/* =====================================================================
   TURF — navigation (desktop sidebar + mobile bottom tab bar)
   ===================================================================== */

const NAV_SESSION = [
  { id: 'detail', label: 'Overview', icon: 'flag' },
  { id: 'availability', label: 'Availability', icon: 'squad' },
  { id: 'teams', label: 'Team Builder', icon: 'teams' },
  { id: 'formation', label: 'Formation', icon: 'formation' },
  { id: 'schedule', label: 'Schedule', icon: 'schedule' },
  { id: 'live', label: 'Live Match', icon: 'live', live: true },
  { id: 'standings', label: 'Standings', icon: 'standings' },
  { id: 'history', label: 'History', icon: 'history' },
  { id: 'expenses', label: 'Expenses', icon: 'expenses' },
];

function Sidebar({ screen, go, sessions, activeId, openSession }) {
  // which session groups are expanded; the active one auto-expands.
  const [expanded, setExpanded] = useState(() => new Set(activeId ? [activeId] : []));
  useEffect(() => { if (activeId) setExpanded((prev) => new Set(prev).add(activeId)); }, [activeId]);
  const toggle = (id) => setExpanded((prev) => {
    const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });
  const TopItem = ({ id, label, icon }) => (
    <button className={'nav-item' + (screen === id ? ' nav-item--active' : '')} onClick={() => go(id)}>
      <Icon name={icon} className="ico" /><span>{label}</span>
    </button>
  );
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand__mark">T</div>
        <div className="brand__name">TURF<small>MATCHDAY MGR</small></div>
      </div>

      <TopItem id="dashboard" label="Dashboard" icon="grid" />
      <TopItem id="sessions" label="My Sessions" icon="sessions" />

      <div className="nav-group__label">My sessions</div>
      {sessions.length === 0 && <div className="muted" style={{ fontSize: 12.5, padding: '4px 12px' }}>No sessions yet.</div>}
      {sessions.map((s) => {
        const isOpen = expanded.has(s.id);
        const isActiveSession = s.id === activeId;
        return (
          <div key={s.id} className="nav-session">
            <button
              className={'nav-item nav-session__head' + (isActiveSession ? ' is-active-session' : '')}
              onClick={() => { openSession(s.id); toggle(s.id); }}
            >
              <Icon name={isOpen ? 'chevronDown' : 'chevron'} className="ico" />
              <span className="grow" style={{ textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.turfName}</span>
              {s.status === 'live' && <span className="nav-item__badge">LIVE</span>}
            </button>
            {isOpen && NAV_SESSION.map((it) => (
              <button
                key={it.id}
                className={'nav-item' + (isActiveSession && screen === it.id ? ' nav-item--active' : '')}
                style={{ paddingLeft: 34 }}
                onClick={() => { openSession(s.id); go(it.id); }}
              >
                <Icon name={it.icon} className="ico" /><span>{it.label}</span>
                {it.live && <span className="nav-item__badge">LIVE</span>}
              </button>
            ))}
          </div>
        );
      })}

      <div className="sidebar__foot">
        <button className={'nav-item' + (screen === 'profile' ? ' nav-item--active' : '')} onClick={() => go('profile')}>
          <Avatar id={DATA.currentUserId} size={22} />
          <span style={{ fontWeight: 700, color: 'var(--chalk)' }}>{DATA.name(DATA.currentUserId)}</span>
        </button>
      </div>
    </aside>
  );
}

const TABS = [
  { id: 'dashboard', label: 'Home', icon: 'grid' },
  { id: 'sessions', label: 'Sessions', icon: 'sessions' },
  { id: 'live', label: 'Live', icon: 'live' },
  { id: 'standings', label: 'Table', icon: 'standings' },
  { id: 'more', label: 'More', icon: 'more' },
];

function BottomTabBar({ screen, go }) {
  const activeTab = TABS.some((t) => t.id === screen) ? screen : (screen === 'profile' || NAV_SESSION.some((n) => n.id === screen) ? 'more' : screen);
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <button key={t.id} className={'tab' + (activeTab === t.id ? ' on' : '')} onClick={() => go(t.id)}>
          <Icon name={t.icon} className="ico" />
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

/* "More" sheet for mobile — links to remaining screens */
function MoreScreen({ go, sessionName }) {
  // bottom tabs already cover Live + Standings; show the rest of the active session here.
  const items = [
    ...NAV_SESSION.filter((n) => !['live', 'standings'].includes(n.id)),
    { id: 'profile', label: 'Profile', icon: 'profile' },
  ];
  return (
    <div className="page">
      <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 26, margin: '4px 0 4px' }}>More</h2>
      {sessionName && <p className="muted" style={{ margin: '0 0 18px', fontSize: 13 }}>{sessionName}</p>}
      <div className="card">
        {items.map((it, i) => (
          <button key={it.id} className="nav-item" style={{ borderBottom: i < items.length - 1 ? '1px solid var(--line-soft)' : 'none', borderRadius: 0, padding: '15px 16px' }} onClick={() => go(it.id)}>
            <Icon name={it.icon} className="ico" /><span style={{ fontSize: 15 }}>{it.label}</span>
            <Icon name="chevron" className="ico" style={{ marginLeft: 'auto', color: 'var(--chalk-faint)' }} />
          </button>
        ))}
      </div>
    </div>
  );
}
/* =====================================================================
   TURF — SIGNATURE components: StandingsTable, TimerDisplay,
   ScoreStepper, FormationPitch (with player name tags)
   ===================================================================== */

/* ---------- standings computation ---------- */
function computeStandings(matches, teams, scoring) {
  const rows = {};
  teams.forEach((t) => { rows[t.id] = { teamId: t.id, teamName: t.name, color: t.color, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 }; });
  const h2h = {};
  matches.filter((m) => m.status === 'done').forEach((m) => {
    const a = rows[m.teamA], b = rows[m.teamB]; if (!a || !b) return;
    a.p++; b.p++; a.gf += m.scoreA; a.ga += m.scoreB; b.gf += m.scoreB; b.ga += m.scoreA;
    const key = (x, y) => x + '>' + y;
    if (m.scoreA > m.scoreB) { a.w++; b.l++; a.pts += scoring.win; b.pts += scoring.loss; h2h[key(m.teamA, m.teamB)] = (h2h[key(m.teamA, m.teamB)] || 0) + 1; }
    else if (m.scoreA < m.scoreB) { b.w++; a.l++; b.pts += scoring.win; a.pts += scoring.loss; h2h[key(m.teamB, m.teamA)] = (h2h[key(m.teamB, m.teamA)] || 0) + 1; }
    else { a.d++; b.d++; a.pts += scoring.draw; b.pts += scoring.draw; }
  });
  const arr = Object.values(rows);
  arr.forEach((r) => { r.gd = r.gf - r.ga; });
  arr.sort((x, y) => {
    for (const tb of ['PTS', ...scoring.tiebreakers]) {
      if (tb === 'PTS' && y.pts !== x.pts) return y.pts - x.pts;
      if (tb === 'GD' && y.gd !== x.gd) return y.gd - x.gd;
      if (tb === 'GF' && y.gf !== x.gf) return y.gf - x.gf;
      if (tb === 'H2H') { const d = (h2h[y.teamId + '>' + x.teamId] || 0) - (h2h[x.teamId + '>' + y.teamId] || 0); if (d) return d; }
    }
    if (y.pts !== x.pts) return y.pts - x.pts;
    return y.gd - x.gd;
  });
  return arr;
}

function StandingsTable({ matches, teams, scoring, qualifiers = 2 }) {
  const rows = useMemo(() => computeStandings(matches, teams, scoring), [matches, teams, scoring]);
  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <table className="standings">
        <thead>
          <tr>
            <th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.teamId} className={i < qualifiers ? 'qualify' : ''}>
              <td>
                <div className="col-team">
                  <span className="pos">{i + 1}</span>
                  <TeamDot color={r.color} />
                  <span style={{ fontWeight: 600 }}>{r.teamName}</span>
                </div>
              </td>
              <td>{r.p}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td><td>{r.gf}</td><td>{r.ga}</td>
              <td className={r.gd > 0 ? 'gd-pos' : r.gd < 0 ? 'gd-neg' : ''}>{r.gd > 0 ? '+' : ''}{r.gd}</td>
              <td className="pts">{r.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row" style={{ gap: 8, padding: '10px 14px', borderTop: '1px solid var(--line)', fontSize: 12 }}>
        <span className="team-dot" style={{ background: 'var(--accent)', width: 9, height: 9 }} />
        <span className="muted">Top {qualifiers} qualify · sorted by Pts, then {scoring.tiebreakers.join(' › ')}</span>
      </div>
    </div>
  );
}

/* ---------- TIMER ---------- */
function TimerDisplay({ match, can, reason, onTimerChange }) {
  // The clock is DERIVED from the match row so every viewer sees the same time, live-synced:
  //   elapsed = paused_accum_seconds + (started_at ? now - started_at : 0)
  // started_at set => running. Controls only patch those fields (surgical, captain-allowed).
  const dur = match.durationSeconds || 900;
  useNow(250); // re-render so the digits tick
  const banked = match.pausedAccumSeconds || 0;
  const startedMs = match.startedAt ? new Date(match.startedAt).getTime() : null;
  let elapsed = startedMs ? banked + (Date.now() - startedMs) / 1000 : banked;
  if (elapsed > dur) elapsed = dur;
  const running = !!startedMs && elapsed < dur;
  const remaining = dur - elapsed;
  const pct = Math.min(100, (elapsed / dur) * 100);

  const start = () => { if (can) onTimerChange?.({ startedAt: new Date().toISOString(), pausedAccumSeconds: Math.floor(elapsed), status: 'live' }); };
  const pause = () => { if (can) onTimerChange?.({ startedAt: null, pausedAccumSeconds: Math.floor(elapsed), status: 'live' }); };
  const reset = () => { if (can) onTimerChange?.({ startedAt: null, pausedAccumSeconds: 0, status: 'live' }); };

  return (
    <div className={'timer' + (running ? ' is-live' : '')}>
      <div className="row" style={{ justifyContent: 'center', gap: 10, marginBottom: 6 }}>
        {running ? <StatusPill status="live" /> : elapsed >= dur ? <StatusPill status="done" /> : <span className="pill">Paused</span>}
        <span className="mono muted" style={{ fontSize: 11 }}>MATCH {match.matchNo} · {Math.round(dur / 60)} MIN</span>
      </div>
      <div className="timer__digits">{mmss(remaining)}</div>
      <div className="timer__bar"><span style={{ width: pct + '%' }} /></div>
      <div className="timer__ctl">
        {!running
          ? <button className="btn btn--accent btn--lg" disabled={!can || elapsed >= dur} onClick={start}><Icon name="play" className="ico" /> {elapsed > 0 ? 'Resume' : 'Start'}</button>
          : <button className="btn btn--lg" disabled={!can} onClick={pause}><Icon name="pause" className="ico" /> Pause</button>}
        <button className="btn btn--ghost btn--lg" disabled={!can} onClick={reset}><Icon name="reset" className="ico" /> Reset</button>
      </div>
      {!can && <div className="row" style={{ justifyContent: 'center', gap: 6, marginTop: 12, color: 'var(--amber)', fontSize: 12.5 }}>
        <Icon name="lock" className="ico" /> {reason || 'Only captains can control the clock'}
      </div>}
    </div>
  );
}

/* ---------- SCORE STEPPER ---------- */
function ScoreStepper({ team, score, onChange, can, align }) {
  return (
    <div className="scorebox">
      <div className="scorebox__num" style={{ color: team.color }}>{score}</div>
      <div className="scorebox__team" style={{ justifyContent: 'center' }}>
        <TeamDot color={team.color} /> {team.name}
      </div>
      <div className="stepper" style={{ justifyContent: 'center' }}>
        <button onClick={() => can && onChange(Math.max(0, score - 1))} disabled={!can || score === 0}><Icon name="minus" className="ico" style={{ width: 20, height: 20 }} /></button>
        <button className="plus" onClick={() => can && onChange(score + 1)} disabled={!can}><Icon name="plus" className="ico" style={{ width: 20, height: 20 }} /></button>
      </div>
    </div>
  );
}

/* ---------- FORMATION presets ---------- */
const PRESETS = {
  5: {
    '2-1-1': [['GK', 50, 90], ['LB', 30, 68], ['RB', 70, 68], ['CM', 50, 46], ['ST', 50, 22]],
    '1-2-1': [['GK', 50, 90], ['CB', 50, 70], ['LM', 30, 46], ['RM', 70, 46], ['ST', 50, 22]],
    '1-1-2': [['GK', 50, 90], ['CB', 50, 70], ['CM', 50, 48], ['LF', 34, 24], ['RF', 66, 24]],
  },
  6: {
    '2-2-1': [['GK', 50, 90], ['LB', 30, 70], ['RB', 70, 70], ['LM', 32, 46], ['RM', 68, 46], ['ST', 50, 22]],
    '1-2-2': [['GK', 50, 90], ['CB', 50, 72], ['LM', 30, 48], ['RM', 70, 48], ['LF', 34, 24], ['RF', 66, 24]],
    '3-1-1': [['GK', 50, 90], ['LB', 26, 70], ['CB', 50, 73], ['RB', 74, 70], ['CM', 50, 46], ['ST', 50, 22]],
  },
  7: {
    '2-3-1': [['GK', 50, 91], ['LB', 30, 72], ['RB', 70, 72], ['LM', 24, 48], ['CM', 50, 48], ['RM', 76, 48], ['ST', 50, 22]],
    '3-2-1': [['GK', 50, 91], ['LB', 26, 72], ['CB', 50, 74], ['RB', 74, 72], ['LM', 36, 48], ['RM', 64, 48], ['ST', 50, 22]],
    '2-2-2': [['GK', 50, 91], ['LB', 30, 72], ['RB', 70, 72], ['LM', 34, 50], ['RM', 66, 50], ['LF', 34, 24], ['RF', 66, 24]],
  },
};

function PitchLines() {
  return (
    <svg className="pitch__lines" viewBox="0 0 68 105" preserveAspectRatio="none">
      <rect x="2" y="2" width="64" height="101" rx="1" />
      <line x1="2" y1="52.5" x2="66" y2="52.5" />
      <circle cx="34" cy="52.5" r="9" />
      <circle cx="34" cy="52.5" r="0.6" style={{ fill: 'rgba(242,239,230,.5)' }} />
      {/* top box */}
      <rect x="20" y="2" width="28" height="14" />
      <rect x="28" y="2" width="12" height="5" />
      <circle cx="34" cy="11" r="0.6" style={{ fill: 'rgba(242,239,230,.5)' }} />
      <path d="M26 16 A 9 9 0 0 0 42 16" />
      {/* bottom box */}
      <rect x="20" y="89" width="28" height="14" />
      <rect x="28" y="98" width="12" height="5" />
      <circle cx="34" cy="94" r="0.6" style={{ fill: 'rgba(242,239,230,.5)' }} />
      <path d="M26 89 A 9 9 0 0 1 42 89" />
    </svg>
  );
}

function FormationPitch({ team, playerIds, captainId, side = 5, saved, onSave, locked }) {
  const presetMap = PRESETS[side] || PRESETS[5];
  const presetKeys = Object.keys(presetMap);
  const slotPos = (pk, i) => { const sl = presetMap[pk]; const s = sl[i] || sl[sl.length - 1]; return { x: s[1], y: s[2], label: s[0] }; };

  // hydrate from the saved board (preset + on-pitch list + x/y), falling back to defaults.
  const initPreset = (saved?.preset && presetMap[saved.preset]) ? saved.preset
    : (team.formationPreset && presetMap[team.formationPreset]) ? team.formationPreset : presetKeys[0];
  const [activePreset, setActivePreset] = useState(initPreset);
  const slots = presetMap[activePreset];

  const savedField = Array.isArray(saved?.field) ? saved.field.filter((k) => playerIds.includes(k)) : null;
  const [field, setField] = useState(() => (savedField && savedField.length ? savedField : playerIds.slice(0, slots.length)));
  const onPitch = field.filter((id) => playerIds.includes(id)).slice(0, slots.length);
  const full = onPitch.length >= slots.length;

  const [pos, setPos] = useState(() => {
    const obj = {};
    onPitch.forEach((pid, i) => { const sv = saved?.pos?.[pid]; obj[pid] = sv ? { x: sv.x, y: sv.y, label: sv.label || slotPos(activePreset, i).label } : slotPos(activePreset, i); });
    return obj;
  });

  // persist the whole board (atomic) after any change; locked viewers never write.
  const persist = (nextField, nextPos, nextPreset) => {
    if (locked || !onSave) return;
    const fieldList = nextField.filter((id) => playerIds.includes(id));
    const posOut = {};
    fieldList.forEach((pid) => { const p = nextPos[pid]; if (p) posOut[pid] = { x: Math.round(p.x), y: Math.round(p.y), label: p.label || '' }; });
    onSave({ preset: nextPreset, field: fieldList, pos: posOut });
  };

  const addToField = (pid) => {
    if (locked || full) return;
    const nf = [...onPitch, pid];
    const np = { ...pos, [pid]: slotPos(activePreset, onPitch.length) };
    setField(nf); setPos(np); persist(nf, np, activePreset);
  };
  const removeFromField = (pid) => {
    if (locked) return;
    const nf = onPitch.filter((x) => x !== pid);
    setField(nf); persist(nf, pos, activePreset);
  };

  const pitchRef = useRef(null);
  const drag = useRef(null);

  const onDown = (pid, e) => {
    if (locked) return;
    e.preventDefault();
    drag.current = pid;
    setPos((p) => ({ ...p, [pid]: { ...p[pid], drag: true } }));
  };
  const onMove = (e) => {
    if (!drag.current || !pitchRef.current) return;
    const r = pitchRef.current.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX);
    const cy = (e.touches ? e.touches[0].clientY : e.clientY);
    let x = ((cx - r.left) / r.width) * 100;
    let y = ((cy - r.top) / r.height) * 100;
    x = Math.max(7, Math.min(93, x)); y = Math.max(5, Math.min(95, y));
    setPos((p) => ({ ...p, [drag.current]: { ...p[drag.current], x, y } }));
  };
  const onUp = () => {
    if (drag.current) {
      setPos((p) => { const np = { ...p, [drag.current]: { ...p[drag.current], drag: false } }; persist(onPitch, np, activePreset); return np; });
    }
    drag.current = null;
  };
  useEffect(() => {
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  });

  const changePreset = (pk) => {
    const np = {}; onPitch.forEach((pid, i) => { np[pid] = slotPos(pk, i); });
    setActivePreset(pk); setPos(np); persist(onPitch, np, pk);
  };

  return (
    <div>
      <div className="row between wrap" style={{ marginBottom: 14, gap: 10 }}>
        <div className="row" style={{ gap: 9 }}>
          <TeamDot color={team.color} />
          <span style={{ fontFamily: 'var(--f-display)', fontSize: 18, fontWeight: 600 }}>{team.name}</span>
          <span className="tag">{side}-A-SIDE</span>
        </div>
        <div className="preset-row">
          {presetKeys.map((pk) => (
            <button key={pk} className={'preset' + (pk === activePreset ? ' on' : '')} disabled={locked} onClick={() => changePreset(pk)}>{pk}</button>
          ))}
        </div>
      </div>

      <div className={'pitch' + (locked ? ' locked-overlay' : '')} ref={pitchRef} style={{ background: `repeating-linear-gradient(0deg, ${team.color}0a 0 8.33%, rgba(0,0,0,.05) 8.33% 16.66%), linear-gradient(180deg,#0f5640,#0c4634)` }}>
        <PitchLines />
        {onPitch.map((pid) => {
          const p = pos[pid] || { x: 50, y: 50, label: '' };
          const cap = pid === captainId;
          return (
            <div key={pid} className={'token' + (p.drag ? ' dragging' : '')} style={{ left: p.x + '%', top: p.y + '%' }}
              onPointerDown={(e) => onDown(pid, e)}>
              <div className="token__bead" style={{ background: team.color }}>
                {p.label}
                {cap && <span className="token__cap">C</span>}
              </div>
              <div className="token__name">{keyFirst(pid)}</div>
            </div>
          );
        })}
      </div>

      <div className="row" style={{ gap: 7, marginTop: 12, justifyContent: 'center', fontSize: 12 }}>
        {locked
          ? <span className="row" style={{ gap: 6, color: 'var(--amber)' }}><Icon name="lock" className="ico" /> View only — captains edit their own team; organizers edit any</span>
          : <span className="muted row" style={{ gap: 6 }}><Icon name="pin" className="ico" /> Drag tokens to reposition · use the roster below to pick who's on the field</span>}
      </div>

      {/* team roster bar (FIFA-style): pick who's on the pitch */}
      <div style={{ marginTop: 16 }}>
        <div className="section-title" style={{ fontSize: 11 }}>Team roster {!locked && '· tap Add/Remove to set the field'}</div>
        <div className="stack" style={{ gap: 6 }}>
          {playerIds.length === 0 && <div className="muted" style={{ fontSize: 13 }}>No players assigned to this team yet — assign them in Team Builder.</div>}
          {playerIds.map((pid) => {
            const on = onPitch.includes(pid);
            const label = on ? (pos[pid]?.label || 'XI') : 'SUB';
            const cap = pid === captainId;
            return (
              <div key={pid} className="row" style={{ gap: 10, padding: '7px 10px', background: 'rgba(0,0,0,.2)', borderRadius: 10, border: '1px solid var(--line-soft)', opacity: on ? 1 : 0.65 }}>
                <span className="mono" style={{ width: 32, fontSize: 10.5, letterSpacing: '.05em', color: on ? 'var(--accent)' : 'var(--chalk-faint)' }}>{label}</span>
                <Avatar id={isGuestKey(pid) ? undefined : pid} name={isGuestKey(pid) ? keyFirst(pid) : undefined} size={24} color={isGuestKey(pid) ? 'var(--raise)' : undefined} />
                <span className="grow row" style={{ gap: 6, fontSize: 13.5, fontWeight: 600 }}>{keyName(pid)} {isGuestKey(pid) && <span className="tag tag--guest" style={{ fontSize: 9 }}>GUEST</span>} {cap && <span className="pill" style={{ color: 'var(--amber)', borderColor: 'var(--amber)', fontSize: 9.5, padding: '1px 6px' }}>C</span>}</span>
                {!locked && (on
                  ? <button className="btn btn--ghost btn--sm" onClick={() => removeFromField(pid)}>Remove</button>
                  : <button className="btn btn--sm" disabled={full} onClick={() => addToField(pid)}><Icon name="plus" className="ico" /> Add</button>)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
/* =====================================================================
   TURF — screens (part 1): Auth, Sessions, Detail, Availability, Teams
   ===================================================================== */

/* ---------------- AUTH / ONBOARDING ---------------- */
const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];
function AuthScreen({ onDone, onGoogle, live = false, profile, error = '', busy = false }) {
  const [step, setStep] = useState(profile ? 'form' : 'start'); // start | form
  const [f, setF] = useState(profile?.firstName || ''); const [l, setL] = useState(profile?.lastName || '');
  const [contact, setContact] = useState(profile?.contact || '');
  const [pos1, setPos1] = useState(profile?.prefPos1 || ''); const [pos2, setPos2] = useState(profile?.prefPos2 || '');
  const [googleBusy, setGoogleBusy] = useState(false);
  const canEnter = f.trim() && contact.trim() && pos1 && pos2 && pos1 !== pos2;
  const submitProfile = () => onDone({ firstName: f.trim(), lastName: l.trim(), contact: contact.trim(), prefPos1: pos1, prefPos2: pos2 });
  const runGoogle = () => {
    if (!live) {
      setStep('form');
      return;
    }
    setGoogleBusy(true);
    Promise.resolve(onGoogle()).catch(() => setGoogleBusy(false));
  };
  const isBusy = busy || googleBusy;
  return (
    <div className="hero-auth pitch-bg">
      <div className="auth-card">
        <div className="row" style={{ justifyContent: 'center', gap: 12, marginBottom: 22 }}>
          <div className="brand__mark" style={{ width: 48, height: 48, fontSize: 28 }}>T</div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontFamily: 'var(--f-display)', fontSize: 30, fontWeight: 700, letterSpacing: '.12em', lineHeight: 1 }}>TURF</div>
            <div className="mono muted" style={{ fontSize: 10, letterSpacing: '.26em' }}>MATCHDAY MANAGER</div>
          </div>
        </div>

        {step === 'start' ? (
          <div className="card card--pad" style={{ textAlign: 'left' }}>
            <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 27, lineHeight: 1.1, margin: '4px 0 10px', textAlign: 'center' }}>Sort the squad.<br />Run the match.</h2>
            <p className="muted" style={{ textAlign: 'center', margin: '0 0 22px', fontSize: 14, lineHeight: 1.5 }}>Availability, balanced teams, live scores and the turf bill — for your crew’s pickup games.</p>
            {error && <p className="muted" style={{ color: 'var(--amber)', fontSize: 12.5, lineHeight: 1.45, margin: '0 0 12px', textAlign: 'center' }}>{error}</p>}
            <button className="gbtn" onClick={runGoogle} disabled={isBusy}>
              <Icon name="google" /> {isBusy ? 'Opening Google...' : 'Continue with Google'}
            </button>
            <div className="row" style={{ gap: 10, margin: '16px 0' }}>
              <div className="grow" style={{ height: 1, background: 'var(--line)' }} /><span className="muted mono" style={{ fontSize: 10 }}>FIRST TIME HERE</span><div className="grow" style={{ height: 1, background: 'var(--line)' }} />
            </div>
            <button className="btn btn--block" onClick={runGoogle} disabled={isBusy}>{isBusy ? 'Waiting for Google...' : 'Set up my profile'}</button>
          </div>
        ) : (
          <div className="card card--pad" style={{ textAlign: 'left' }}>
            <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 22, margin: '0 0 4px' }}>Welcome to the crew</h2>
            <p className="muted" style={{ margin: '0 0 18px', fontSize: 13.5 }}>Tell us your name and where you like to play.</p>
            <div className="stack">
              <Field label="First name"><input className="input" placeholder="John" value={f} onChange={(e) => setF(e.target.value)} /></Field>
              <Field label="Last name"><input className="input" placeholder="Doe" value={l} onChange={(e) => setL(e.target.value)} /></Field>
              <Field label="Contact (phone / handle)"><input className="input" placeholder="e.g. 01XXXXXXXXX" value={contact} onChange={(e) => setContact(e.target.value)} /></Field>
              <div className="grid-2">
                <Field label="Preferred position 1">
                  <select className="input" value={pos1} onChange={(e) => setPos1(e.target.value)}>
                    <option value="">Select…</option>
                    {POSITIONS.map((p) => <option key={p} value={p} disabled={p === pos2}>{p}</option>)}
                  </select>
                </Field>
                <Field label="Preferred position 2">
                  <select className="input" value={pos2} onChange={(e) => setPos2(e.target.value)}>
                    <option value="">Select…</option>
                    {POSITIONS.map((p) => <option key={p} value={p} disabled={p === pos1}>{p}</option>)}
                  </select>
                </Field>
              </div>
              <button className="btn btn--accent btn--block btn--lg" style={{ marginTop: 6 }} disabled={!canEnter} onClick={submitProfile}>Enter TURF <Icon name="arrowR" className="ico" /></button>
              {!profile && <button className="btn btn--ghost btn--block" onClick={() => setStep('start')}>Back</button>}
            </div>
          </div>
        )}
        <p className="muted" style={{ textAlign: 'center', fontSize: 11.5, marginTop: 16 }}>Sort the squad, run the match, split the bill — fair and simple.</p>
      </div>
    </div>
  );
}

/* ---------------- DASHBOARD ---------------- */
function memberCount(sid) { return DATA.members.filter((m) => m.sessionId === sid).length; }

const DashFlag = ({ label, tone }) => {
  const cls = tone === 'ok' ? 'pill pill--paid' : tone === 'warn' ? 'pill pill--due' : tone === 'out' ? 'pill pill--out' : 'pill';
  return <span className={cls} style={{ fontSize: 10.5 }}>{label}</span>;
};

function DashboardScreen({ ctx }) {
  const me = ctx.me || DATA.currentUserId;
  const myName = DATA.first(me);
  const sessions = DATA.sessions;
  const stats = ctx.dashStats;
  const ongoing = sessions.filter((s) => s.status === 'live');
  const upcoming = sessions.filter((s) => s.status === 'upcoming');
  const recent = sessions.filter((s) => s.status === 'done').slice(0, 2);
  const open = (s) => { ctx.openSession(s.id); ctx.go(s.status === 'done' ? 'history' : 'detail'); };
  const iManage = (s) => s.createdBy === me || DATA.members.some((m) => m.sessionId === s.id && m.profileId === me && m.role === 'organizer');

  // per-session flags (Remember: it's a dashboard — quick status at a glance)
  const flagsFor = (s) => {
    const out = [];
    const mark = (stats?.myMarks || {})[s.id];
    const teams = (stats?.teamsBySession || {})[s.id];
    if (s.status !== 'done') {
      out.push(mark === 'available' ? { label: "You're IN", tone: 'ok' }
        : mark === 'out' ? { label: 'You marked OUT', tone: 'out' }
        : { label: 'Not marked', tone: 'warn' });
      out.push(teams?.count ? { label: `${teams.count} teams`, tone: 'ok' } : { label: 'No teams yet', tone: 'warn' });
      if (iManage(s) && teams?.count) {
        out.push(teams.withCaptain === teams.count
          ? { label: 'Captains set', tone: 'ok' }
          : { label: `${teams.withCaptain}/${teams.count} captains`, tone: 'warn' });
      }
    }
    return out;
  };

  const Row = ({ s }) => (
    <div className="card card--pad" style={{ cursor: 'pointer', marginBottom: 10 }} onClick={() => open(s)}>
      <div className="row between" style={{ gap: 10 }}>
        <div className="row" style={{ gap: 10, minWidth: 0 }}>
          <StatusPill status={s.status} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.turfName}</div>
            <div className="muted mono" style={{ fontSize: 10.5 }}>{dateLabel(s.slotStart)} · {timeOfDay(s.slotStart)} · {memberCount(s.id)} in</div>
          </div>
        </div>
        {iManage(s) && <span className="tag tag--org">{s.createdBy === me ? 'CREATOR' : 'ORGANIZER'}</span>}
      </div>
      <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
        {flagsFor(s).map((f, i) => <DashFlag key={i} label={f.label} tone={f.tone} />)}
      </div>
    </div>
  );

  const Group = ({ title, items, empty }) => (
    <div style={{ marginBottom: 22 }}>
      <div className="section-title">{title}</div>
      {items.length === 0 ? <div className="muted" style={{ fontSize: 13 }}>{empty}</div> : items.map((s) => <Row key={s.id} s={s} />)}
    </div>
  );

  const Stat = ({ k, v, c }) => (
    <div className="surface" style={{ padding: '14px 16px' }}>
      <div className="muted mono" style={{ fontSize: 10, letterSpacing: '.1em' }}>{k}</div>
      <div className="num" style={{ fontSize: 24, marginTop: 2, color: c }}>{v}</div>
    </div>
  );

  return (
    <div className="page">
      <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 30, margin: 0, letterSpacing: '.01em' }}>
        {myName && myName !== '—' ? `Hi, ${myName}` : 'Dashboard'}
      </h1>
      <p className="muted" style={{ margin: '3px 0 18px', fontSize: 14 }}>Your matchday activity at a glance.</p>

      <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', marginBottom: 22 }}>
        <Stat k="SESSIONS" v={sessions.length} />
        <Stat k="SPENT" v={stats ? taka(stats.totalSpent) : '—'} />
        <Stat k="OUTSTANDING" v={stats ? taka(stats.outstanding) : '—'} c={stats && stats.outstanding > 0 ? 'var(--amber)' : 'var(--accent)'} />
        <Stat k="GOALS LOGGED" v={stats ? stats.goalCount : '—'} />
      </div>

      {sessions.length === 0 && (
        <div className="card card--pad" style={{ marginBottom: 20 }}>
          <div className="section-title" style={{ margin: 0 }}>No sessions yet</div>
          <p className="muted" style={{ fontSize: 13.5 }}>Create a session or join one with a code.</p>
          <button className="btn btn--accent" onClick={() => ctx.go('sessions')}><Icon name="sessions" className="ico" /> Go to My Sessions</button>
        </div>
      )}

      <Group title="Ongoing" items={ongoing} empty="No live match right now." />
      <Group title="Upcoming" items={upcoming} empty="Nothing scheduled yet." />
      <Group title="Recent" items={recent} empty="No past sessions yet." />
    </div>
  );
}

/* ---------------- SESSIONS LIST (+ Join by code + Add session) ---------------- */
function AddSessionModal({ ctx, onClose }) {
  const localNow = () => { const d = new Date(Date.now() + 24 * 3600 * 1000); d.setMinutes(0); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  const [f, setF] = useState({ turfName: '', location: '', slotLocal: localNow(), slotMinutes: 90, playersPerSide: 5, totalFee: 0 });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const submit = () => {
    if (!f.turfName.trim()) { setErr('Turf name is required.'); return; }
    setBusy(true); setErr('');
    createSession({
      turfName: f.turfName.trim(), location: f.location.trim(),
      slotStart: new Date(f.slotLocal).toISOString(),
      slotMinutes: Number(f.slotMinutes) || 90, playersPerSide: Number(f.playersPerSide) || 5,
      totalFee: Number(f.totalFee) || 0,
      scoring: { win: 3, draw: 1, loss: 0, tiebreakers: ['GD', 'GF', 'H2H'] },
      createdBy: ctx.me,
    }).then((s) => { ctx.reload(); ctx.openSession(s.id); ctx.go('detail'); onClose(); })
      .catch((e) => { setErr(e.message || 'Could not create session.'); setBusy(false); });
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 460, textAlign: 'left' }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 22, margin: '0 0 14px' }}>New session</h2>
        <div className="stack">
          <Field label="Turf name"><input className="input" placeholder="e.g. Touchline Turf" value={f.turfName} onChange={(e) => set('turfName', e.target.value)} /></Field>
          <Field label="Location"><input className="input" placeholder="Area, city" value={f.location} onChange={(e) => set('location', e.target.value)} /></Field>
          <div className="grid-2">
            <Field label="Kick-off"><input className="input" type="datetime-local" value={f.slotLocal} onChange={(e) => set('slotLocal', e.target.value)} /></Field>
            <Field label="Slot length (min)"><input className="input" type="number" value={f.slotMinutes} onChange={(e) => set('slotMinutes', e.target.value)} /></Field>
            <Field label="Players per side"><input className="input" type="number" value={f.playersPerSide} onChange={(e) => set('playersPerSide', e.target.value)} /></Field>
            <Field label="Total fee (BDT)"><input className="input" type="number" value={f.totalFee} onChange={(e) => set('totalFee', e.target.value)} /></Field>
          </div>
          {err && <p className="muted" style={{ color: 'var(--amber)', fontSize: 12.5, margin: 0 }}>{err}</p>}
          <div className="row" style={{ gap: 8, marginTop: 4 }}>
            <button className="btn btn--accent grow" disabled={busy} onClick={submit}>{busy ? 'Creating...' : 'Create session'}</button>
            <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          </div>
          <p className="muted" style={{ fontSize: 11.5, margin: 0 }}>You'll be the creator and get a share code for others to join.</p>
        </div>
      </div>
    </div>
  );
}

function JoinConfirmModal({ peek, busy, onCancel, onConfirm }) {
  const feePer = peek.totalFee ? Math.round(peek.totalFee / ((peek.memberCount || 0) + 1)) : 0;
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-card" style={{ maxWidth: 400, textAlign: 'left' }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 22, margin: '0 0 4px' }}>{peek.turfName}</h2>
        <p className="muted" style={{ fontSize: 13, margin: '0 0 14px' }}>{peek.location || 'Confirm to join this matchday.'}</p>
        <div className="stack" style={{ gap: 8 }}>
          <div className="kv"><span className="kv__k">Creator</span><span className="kv__v">{peek.creatorName || '—'}</span></div>
          <div className="kv"><span className="kv__k">Kick-off</span><span className="kv__v">{dateLabel(peek.slotStart)} · {timeOfDay(peek.slotStart)}</span></div>
          <div className="kv"><span className="kv__k">Slot</span><span className="kv__v">{peek.slotMinutes} min</span></div>
          <div className="kv"><span className="kv__k">Fee / person</span><span className="kv__v num">{feePer ? taka(feePer) : '—'}</span></div>
        </div>
        {peek.clash && (
          <div className="gate-banner" style={{ marginTop: 12 }}><Icon name="clock" className="ico" /> <span>This overlaps another session you're in — joining is blocked.</span></div>
        )}
        {peek.alreadyMember && <p className="muted" style={{ color: 'var(--accent)', fontSize: 12.5, marginTop: 10 }}>You're already in this session.</p>}
        <div className="row" style={{ gap: 8, marginTop: 16 }}>
          <button className="btn btn--accent grow" disabled={busy || peek.clash} onClick={onConfirm}>{busy ? 'Joining...' : peek.alreadyMember ? 'Open' : 'Join session'}</button>
          <button className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function SessionsScreen({ ctx }) {
  const upcoming = DATA.sessions.filter((s) => s.status !== 'done');
  const past = DATA.sessions.filter((s) => s.status === 'done');
  const [addOpen, setAddOpen] = useState(false);
  const [code, setCode] = useState('');
  const [peek, setPeek] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const live = USE_SUPABASE && Boolean(ctx.me);

  const doPeek = () => {
    if (!code.trim()) return;
    setBusy(true); setErr('');
    peekSession(code.trim())
      .then((p) => { setPeek(p); setBusy(false); })
      .catch((e) => { setErr(e.message === 'INVALID_CODE' ? 'No session found for that code.' : (e.message || 'Could not look up code.')); setBusy(false); });
  };
  const doJoin = () => {
    setBusy(true); setErr('');
    joinSession(code.trim())
      .then((s) => { setPeek(null); setCode(''); ctx.reload(); ctx.openSession(s.id); ctx.go('detail'); })
      .catch((e) => { setErr(e.message === 'TIME_CLASH' ? 'Time clash — you already have a session then.' : (e.message || 'Could not join.')); setBusy(false); });
  };

  return (
    <div className="page">
      <div className="row between wrap" style={{ marginBottom: 18, gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 30, margin: 0, letterSpacing: '.01em' }}>My Sessions</h1>
          <p className="muted" style={{ margin: '3px 0 0', fontSize: 14 }}>Matchdays you've created or joined.</p>
        </div>
        <button className="btn btn--accent" disabled={!live} onClick={() => setAddOpen(true)}><Icon name="plus" className="ico" /> New session</button>
      </div>

      {/* Join by code */}
      <div className="card card--pad" style={{ marginBottom: 22 }}>
        <div className="section-title">Join a session</div>
        <div className="row wrap" style={{ gap: 8 }}>
          <input className="input grow" placeholder="Enter share code, e.g. TURF-9F4KQ" value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && doPeek()} style={{ minWidth: 180 }} />
          <button className="btn" disabled={!live || busy || !code.trim()} onClick={doPeek}><Icon name="arrowR" className="ico" /> Look up</button>
        </div>
        {err && <p className="muted" style={{ color: 'var(--amber)', fontSize: 12.5, margin: '10px 0 0' }}>{err}</p>}
        {!live && <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>Sign in (Supabase mode) to join or create sessions.</p>}
      </div>

      <div className="section-title">Upcoming &amp; live</div>
      <div className="grid-auto" style={{ marginBottom: 28 }}>
        {upcoming.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Nothing upcoming.</div>}
        {upcoming.map((s) => <SessionCard key={s.id} session={s} count={memberCount(s.id)} onOpen={() => { ctx.openSession(s.id); ctx.go('detail'); }} />)}
      </div>

      <div className="section-title">Past</div>
      <div className="grid-auto">
        {past.length === 0 && <div className="muted" style={{ fontSize: 13 }}>No past sessions.</div>}
        {past.map((s) => <SessionCard key={s.id} session={s} count={memberCount(s.id)} onOpen={() => { ctx.openSession(s.id); ctx.go('history'); }} />)}
      </div>

      {addOpen && <AddSessionModal ctx={ctx} onClose={() => setAddOpen(false)} />}
      {peek && <JoinConfirmModal peek={peek} busy={busy} onCancel={() => setPeek(null)} onConfirm={doJoin} />}
    </div>
  );
}

/* ---------------- SESSION DETAIL / EDIT ---------------- */
function TiebreakChips({ order, setOrder, disabled }) {
  const labels = { GD: 'Goal Difference', GF: 'Goals For', H2H: 'Head-to-Head' };
  const move = (i, dir) => {
    const j = i + dir; if (j < 0 || j >= order.length) return;
    const next = order.slice(); [next[i], next[j]] = [next[j], next[i]]; setOrder(next);
  };
  return (
    <div className="row wrap" style={{ gap: 8 }}>
      {order.map((k, i) => (
        <div key={k} className="row" style={{ gap: 6, padding: '7px 8px 7px 12px', background: 'rgba(0,0,0,.25)', border: '1px solid var(--line)', borderRadius: 999 }}>
          <span className="num muted" style={{ fontSize: 12 }}>{i + 1}</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{labels[k]}</span>
          <div className="row" style={{ gap: 2 }}>
            <button className="icobtn" style={{ width: 24, height: 24 }} disabled={disabled || i === 0} onClick={() => move(i, -1)}><Icon name="chevron" className="ico" style={{ width: 13, height: 13, transform: 'rotate(180deg)' }} /></button>
            <button className="icobtn" style={{ width: 24, height: 24 }} disabled={disabled || i === order.length - 1} onClick={() => move(i, 1)}><Icon name="chevron" className="ico" style={{ width: 13, height: 13 }} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailScreen({ ctx }) {
  const s = ctx.session;
  const org = ctx.canManage;
  // organizer selection now lives on the Availability page (creator-only).
  const canDelete = ctx.isAdmin && (new Date(s.slotStart).getTime() - Date.now() > 24 * 3600 * 1000);
  const [confirmDel, setConfirmDel] = useState(false);
  const [delBusy, setDelBusy] = useState(false);
  const doDelete = () => {
    setDelBusy(true);
    deleteSession(s.id).then(() => { ctx.reload(); ctx.go('sessions'); })
      .catch((e) => { setDelBusy(false); setConfirmDel(false); window.alert(e.message || 'Delete failed (locked within 24h of kick-off).'); });
  };

  const [tb, setTb] = useState(s.scoring.tiebreakers);
  const [pts, setPts] = useState({ win: s.scoring.win, draw: s.scoring.draw, loss: s.scoring.loss });
  const toLocal = (iso) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  const [bf, setBf] = useState({ turfName: s.turfName, location: s.location, slotLocal: toLocal(s.slotStart), slotMinutes: s.slotMinutes, playersPerSide: s.playersPerSide, totalFee: s.totalFee });
  const setB = (k, v) => setBf((p) => ({ ...p, [k]: v }));
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');
  const saveSettings = () => {
    setSavingSettings(true); setSettingsMsg('');
    updateSession(s.id, {
      turfName: bf.turfName.trim(), location: bf.location.trim(),
      slotStart: new Date(bf.slotLocal).toISOString(),
      slotMinutes: Number(bf.slotMinutes) || 90, playersPerSide: Number(bf.playersPerSide) || 5,
      totalFee: Number(bf.totalFee) || 0,
      scoring: { win: pts.win, draw: pts.draw, loss: pts.loss, tiebreakers: tb },
    }).then(() => { ctx.reload(); setSavingSettings(false); setSettingsMsg('Saved'); setTimeout(() => setSettingsMsg(''), 1800); })
      .catch((e) => { setSavingSettings(false); setSettingsMsg(e.message || 'Save failed'); });
  };
  const liveCount = ctx.matches.filter((m) => m.status === 'live').length;
  const doneCount = ctx.matches.filter((m) => m.status === 'done').length;
  const perMatch = ctx.matches.length ? Math.round(s.slotMinutes / ctx.matches.length) : 0;

  const Stat = ({ k, v, sub }) => (
    <div className="surface" style={{ padding: '14px 16px' }}>
      <div className="muted mono" style={{ fontSize: 10, letterSpacing: '.1em' }}>{k}</div>
      <div className="num" style={{ fontSize: 26, marginTop: 2 }}>{v}</div>
      {sub && <div className="muted" style={{ fontSize: 11.5 }}>{sub}</div>}
    </div>
  );
  const PtStep = ({ label, val, on }) => (
    <div className="surface" style={{ padding: 12, textAlign: 'center' }}>
      <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</div>
      <div className="row" style={{ justifyContent: 'center', gap: 10, marginTop: 6 }}>
        <button className="icobtn" disabled={!org || val === 0} onClick={() => on(val - 1)} style={{ width: 30, height: 30 }}><Icon name="minus" className="ico" style={{ width: 15, height: 15 }} /></button>
        <span className="num" style={{ fontSize: 26, minWidth: 22 }}>{val}</span>
        <button className="icobtn" disabled={!org} onClick={() => on(val + 1)} style={{ width: 30, height: 30 }}><Icon name="plus" className="ico" style={{ width: 15, height: 15 }} /></button>
      </div>
    </div>
  );

  return (
    <div className="page page--narrow">
      <div className="row between" style={{ marginBottom: 8 }}>
        <div className="row" style={{ gap: 10 }}><StatusPill status={s.status} /><span className="tag">{s.playersPerSide}-A-SIDE</span>{ctx.locked && <StatusPill status="locked" />}</div>
        <button className="btn btn--ghost btn--sm" onClick={() => ctx.go('sessions')}>All sessions</button>
      </div>
      <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 32, margin: '6px 0 2px' }}>{s.turfName}</h1>
      <div className="row muted" style={{ gap: 6, fontSize: 14, marginBottom: 14 }}><Icon name="location" className="ico" style={{ width: 15, height: 15 }} />{s.location}</div>

      <div className="row between wrap" style={{ gap: 10, marginBottom: 20 }}>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <span className="muted mono" style={{ fontSize: 10, letterSpacing: '.12em' }}>SHARE CODE</span>
          <span className="tag" style={{ fontFamily: 'var(--f-mono)', letterSpacing: '.06em', fontSize: 12.5 }}>{s.joinCode || '—'}</span>
          {s.joinCode && navigator.clipboard && <button className="btn btn--ghost btn--sm" onClick={() => navigator.clipboard.writeText(s.joinCode)}>Copy</button>}
        </div>
        {ctx.isAdmin && (
          <button className="btn btn--ghost btn--sm" disabled={!canDelete} onClick={() => setConfirmDel(true)}
            title={canDelete ? 'Delete this session' : 'Locked: cannot delete within 24h of kick-off'}>
            <Icon name="x" className="ico" /> Delete session
          </button>
        )}
      </div>

      <div className="grid-3" style={{ marginBottom: 22 }}>
        <Stat k="KICK-OFF" v={timeOfDay(s.slotStart)} sub={dateLabel(s.slotStart)} />
        <Stat k="SLOT" v={s.slotMinutes + ' min'} sub={`${ctx.matches.length} matches · ${perMatch} min each`} />
        <Stat k="PROGRESS" v={`${doneCount}/${ctx.matches.length}`} sub={liveCount ? 'Match in play' : 'Matches done'} />
      </div>

      {ctx.isAdmin ? <GateBanner reason="You’re the creator — manage this session; choose organizers on the Availability page." /> :
        org && <GateBanner reason="You’re an organizer — matchday controls are editable." />}

      <div className="card card--pad" style={{ marginTop: 16 }}>
        <div className="section-title">Booking details</div>
        <div className="grid-2">
          <Field label="Turf name"><input className="input" value={bf.turfName} disabled={!org} onChange={(e) => setB('turfName', e.target.value)} /></Field>
          <Field label="Location"><input className="input" value={bf.location} disabled={!org} onChange={(e) => setB('location', e.target.value)} /></Field>
          <Field label="Slot start"><input className="input" type="datetime-local" value={bf.slotLocal} disabled={!org} onChange={(e) => setB('slotLocal', e.target.value)} /></Field>
          <Field label="Slot length (min)"><input className="input" type="number" value={bf.slotMinutes} disabled={!org} onChange={(e) => setB('slotMinutes', e.target.value)} /></Field>
          <Field label="Players per side"><input className="input" type="number" value={bf.playersPerSide} disabled={!org} onChange={(e) => setB('playersPerSide', e.target.value)} /></Field>
          <Field label="Total fee (BDT)"><input className="input" type="number" value={bf.totalFee} disabled={!org} onChange={(e) => setB('totalFee', e.target.value)} /></Field>
        </div>
      </div>

      <div className="card card--pad" style={{ marginTop: 16 }}>
        <div className="section-title">Scoring rules</div>
        <div className="grid-3" style={{ marginBottom: 18 }}>
          <PtStep label="Win" val={pts.win} on={(v) => org && setPts({ ...pts, win: Math.max(0, v) })} />
          <PtStep label="Draw" val={pts.draw} on={(v) => org && setPts({ ...pts, draw: Math.max(0, v) })} />
          <PtStep label="Loss" val={pts.loss} on={(v) => org && setPts({ ...pts, loss: Math.max(0, v) })} />
        </div>
        <div className="field"><label>Tiebreaker order</label>
          <TiebreakChips order={tb} setOrder={setTb} disabled={!org} />
        </div>
      </div>

      <RoleGate can={org} reason="Only the creator or organizers can edit this session">
        <div className="row" style={{ gap: 12, marginTop: 18, alignItems: 'center' }}>
          <button className="btn btn--accent btn--lg" disabled={savingSettings} onClick={saveSettings}>
            <Icon name="check" className="ico" /> {savingSettings ? 'Saving...' : 'Save changes'}
          </button>
          {settingsMsg && <span className="pill pill--paid">{settingsMsg}</span>}
        </div>
      </RoleGate>

      {confirmDel && (
        <div className="modal-backdrop" onClick={() => !delBusy && setConfirmDel(false)}>
          <div className="modal-card" style={{ maxWidth: 380, textAlign: 'left' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 21, margin: '0 0 6px' }}>Delete this session?</h2>
            <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.5, margin: '0 0 18px' }}>
              <b style={{ color: 'var(--chalk)' }}>{s.turfName}</b> and everything in it (teams, matches, expenses) will be removed for <b style={{ color: 'var(--chalk)' }}>all joined players</b>. This can't be undone.
            </p>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn grow" style={{ background: 'var(--red, #E5484D)', color: '#fff', borderColor: 'transparent' }} disabled={delBusy} onClick={doDelete}>
                {delBusy ? 'Deleting...' : 'Delete session'}
              </button>
              <button className="btn btn--ghost" disabled={delBusy} onClick={() => setConfirmDel(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- AVAILABILITY POOL (+ creator's organizer picker) ---------------- */
function AvailabilityScreen({ ctx }) {
  const s = ctx.session;
  if (!s) return null;
  const org = ctx.canManage;           // creator or organizer
  const isCreator = ctx.isAdmin;
  const me = ctx.me || DATA.currentUserId;
  const [av, setAv] = ctx.availability;
  const [members, setMembers] = ctx.members;
  const [guestName, setGuestName] = useState('');
  const [adding, setAdding] = useState(false);
  const [orgMsg, setOrgMsg] = useState('');

  const sessionAv = av.filter((a) => a.sessionId === s.id);
  const lockAt = new Date(s.slotStart).getTime() - 60 * 60 * 1000; // 1 hour before
  const myEntry = sessionAv.find((a) => a.profileId === me);
  const mine = myEntry?.status || null;
  const inList = sessionAv.filter((a) => a.status === 'available');
  const outList = sessionAv.filter((a) => a.status === 'out');

  // Each handler updates local state optimistically AND persists ONLY the changed row.
  const setRowStatus = (row, status) => {
    if (!org) return;
    setAv(av.map((a) => (a.id === row.id ? { ...a, status } : a)));
    ctx.saveAvailRow({ ...row, status });
  };
  const setMyStatus = (status) => {
    if (ctx.locked) return; // players are locked from 1h before; managers (ctx.locked=false) bypass
    if (myEntry) setAv(av.map((a) => (a.sessionId === s.id && a.profileId === me ? { ...a, status } : a)));
    else setAv([...av, { id: newId('av'), sessionId: s.id, profileId: me, status, addedBy: me }]);
    ctx.saveAvailRow({ profileId: me, status, addedBy: me });
  };
  const addGuest = () => {
    if (!guestName.trim()) return;
    const name = guestName.trim();
    setAv([...av, { id: newId('av'), sessionId: s.id, guestName: name, status: 'available', addedBy: me }]);
    setGuestName('');
    ctx.saveAvailRow({ guestName: name, status: 'available', addedBy: me });
  };
  const addExisting = (pid) => {
    if (sessionAv.some((a) => a.profileId === pid)) return;
    setAv([...av, { id: newId('av'), sessionId: s.id, profileId: pid, status: 'available', addedBy: me }]);
    ctx.saveAvailRow({ profileId: pid, status: 'available', addedBy: me });
  };

  // creator-only organizer picker, from this session's joined members (excluding creator), max 2
  const sessionMembers = members.filter((m) => m.sessionId === s.id);
  const organizerIds = sessionMembers.filter((m) => m.role === 'organizer' && m.profileId !== s.createdBy).map((m) => m.profileId);
  const memberProfiles = sessionMembers.filter((m) => m.profileId && m.profileId !== s.createdBy).map((m) => DATA.profile(m.profileId)).filter(Boolean);
  const toggleOrganizer = (pid) => {
    const sel = organizerIds.includes(pid);
    if (!sel && organizerIds.length >= 2) return;
    setMembers(members.map((m) => (m.sessionId === s.id && m.profileId === pid ? { ...m, role: sel ? 'player' : 'organizer' } : m)));
    setOrgMsg(sel ? 'Organizer removed' : 'Organizer added'); setTimeout(() => setOrgMsg(''), 1500);
  };
  // joined members not yet in the availability pool (organizer can add them)
  const notInPool = sessionMembers.filter((m) => m.profileId && m.profileId !== me && !sessionAv.some((a) => a.profileId === m.profileId)).map((m) => DATA.profile(m.profileId)).filter(Boolean);

  const Row = ({ a }) => {
    const isGuest = !a.profileId;
    return (
      <div className="surface" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div className="row" style={{ gap: 10 }}>
          <Avatar id={a.profileId} name={a.guestName} size={30} color={isGuest ? 'var(--raise)' : undefined} />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="row wrap" style={{ gap: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{a.profileId ? DATA.name(a.profileId) : a.guestName}</span>
              {isGuest && <span className="tag tag--guest">GUEST</span>}
              {a.profileId === me && <span className="tag">YOU</span>}
            </div>
          </div>
          <span className={'pill ' + (a.status === 'available' ? 'pill--paid' : 'pill--out')} style={{ fontSize: 10.5 }}>{a.status === 'available' ? 'IN' : 'OUT'}</span>
        </div>
        {org && (
          <div className="av-toggle" style={{ alignSelf: 'flex-start' }}>
            {['available', 'out'].map((k) => (
              <button key={k} className={a.status === k ? 'on ' + k : ''} onClick={() => setRowStatus(a, k)}>{k === 'available' ? 'In' : 'Out'}</button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page">
      <div className="row between wrap" style={{ marginBottom: 18, gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 30, margin: 0 }}>Availability</h1>
          <p className="muted" style={{ margin: '3px 0 0', fontSize: 14 }}>{s.turfName} · {dateLabel(s.slotStart)} · {timeOfDay(s.slotStart)}</p>
        </div>
        <div className="card card--pad" style={{ padding: '10px 16px', textAlign: 'center' }}>
          <div className="muted mono" style={{ fontSize: 9.5, letterSpacing: '.1em' }}>TEAMS LOCK IN</div>
          <div className="num" style={{ fontSize: 24, color: 'var(--amber)' }}><Countdown to={new Date(lockAt).toISOString()} expired="LOCKED" /></div>
          <div className="muted" style={{ fontSize: 10.5 }}>1h before kick-off (players)</div>
        </div>
      </div>

      {/* my status */}
      <div className="card card--pad" style={{ marginBottom: 18 }}>
        <div className="row between wrap" style={{ gap: 12 }}>
          <div className="row" style={{ gap: 12 }}>
            <Avatar id={me} size={42} />
            <div><div style={{ fontWeight: 700, fontSize: 16 }}>{DATA.name(me)} <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>(you)</span></div><div className="muted" style={{ fontSize: 12.5 }}>{ctx.locked ? 'Locked — within 1h of kick-off' : 'Are you playing this match?'}</div></div>
          </div>
          <div className="av-toggle" style={{ transform: 'scale(1.05)' }}>
            {['available', 'out'].map((k) => (
              <button key={k} className={mine === k ? 'on ' + k : ''} onClick={() => setMyStatus(k)} disabled={ctx.locked}>{k === 'available' ? "I'm in" : 'Out'}</button>
            ))}
          </div>
        </div>
      </div>

      {/* creator-only: choose up to two organizers from the joined players */}
      {isCreator && (
        <div className="card card--pad" style={{ marginBottom: 18 }}>
          <div className="row between wrap" style={{ gap: 10, marginBottom: 10 }}>
            <div><div className="section-title" style={{ margin: 0 }}>Session organizers</div><p className="muted" style={{ margin: 0, fontSize: 12.5 }}>Pick up to two from the joined players. Saves instantly.</p></div>
            <div className="row" style={{ gap: 8 }}>{orgMsg && <span className="pill pill--paid" style={{ fontSize: 10.5 }}>{orgMsg}</span>}<span className="pill">{organizerIds.length}/2</span></div>
          </div>
          {memberProfiles.length === 0 ? <div className="muted" style={{ fontSize: 13 }}>No one has joined yet — share the code.</div> : (
            <div className="row wrap" style={{ gap: 8 }}>
              {memberProfiles.map((p) => {
                const sel = organizerIds.includes(p.id);
                const disabled = !sel && organizerIds.length >= 2;
                return (
                  <button key={p.id} className="surface" disabled={disabled} onClick={() => toggleOrganizer(p.id)}
                    style={{ padding: '8px 12px', borderColor: sel ? 'var(--sky)' : 'var(--line)', opacity: disabled ? 0.45 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
                    <span className="row" style={{ gap: 8 }}><Avatar id={p.id} size={24} /> <span style={{ fontWeight: 600, fontSize: 13.5 }}>{DATA.first(p.id)}</span>{sel && <span className="pill" style={{ color: 'var(--sky)', borderColor: 'var(--sky)', fontSize: 10 }}>ORG</span>}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="row between" style={{ marginBottom: 12 }}>
        <div className="row" style={{ gap: 8 }}>
          <span className="pill pill--paid">{inList.length} IN</span>
          <span className="pill pill--out">{outList.length} OUT</span>
        </div>
        <RoleGate can={org} reason="Organizers only" inline>
          <button className="btn btn--sm" onClick={() => setAdding(!adding)}><Icon name="plus" className="ico" /> Add player</button>
        </RoleGate>
      </div>

      {adding && org && (
        <div className="card card--pad" style={{ marginBottom: 16 }}>
          <div className="section-title">Add to pool</div>
          {notInPool.length > 0 && (
            <div className="row wrap" style={{ gap: 8, marginBottom: 14 }}>
              {notInPool.map((p) => <button key={p.id} className="btn btn--sm" onClick={() => addExisting(p.id)}><Icon name="plus" className="ico" /> {p.firstName}</button>)}
            </div>
          )}
          <div className="row" style={{ gap: 8 }}>
            <input className="input grow" placeholder="One-off guest name…" value={guestName} onChange={(e) => setGuestName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addGuest()} />
            <button className="btn btn--accent" onClick={addGuest}>Add guest</button>
          </div>
        </div>
      )}

      <div className="grid-2">
        {[['available', 'In', inList], ['out', 'Out', outList]].map(([k, lbl, list]) => (
          <div key={k}>
            <div className="section-title" style={{ fontSize: 12 }}>{lbl} · {list.length}</div>
            <div className="stack" style={{ gap: 8 }}>
              {list.map((a) => <Row key={a.id} a={a} />)}
              {list.length === 0 && <div className="muted" style={{ fontSize: 13, padding: '8px 2px' }}>—</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
/* =====================================================================
   TURF — screens (part 2): Team Builder, Formation, Schedule
   ===================================================================== */

/* ---------------- TEAM BUILDER ---------------- */
const TEAM_PALETTE = ['#E5484D', '#3E7BFA', '#F5A623', '#9B6DFF', '#15C2A8', '#E5A0FF', '#FF8A4C', '#3DD68C'];

function TeamsScreen({ ctx }) {
  const s = ctx.session;
  const [assign, setAssign] = ctx.assign;
  const [caps, setCaps] = ctx.captains;
  const [av] = ctx.availability;
  const teams = ctx.teams;
  const locked = ctx.locked;
  const editable = ctx.canManage && !locked;
  const [sel, setSel] = useState(null);
  const [dropCol, setDropCol] = useState(null);
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  const dragId = useRef(null);

  // Pool = everyone who marked IN (members AND guests), not yet on a team. Members are
  // keyed by profile id; guests by 'g:<name>'. Derived, not stored.
  const inIds = av
    .filter((a) => a.sessionId === s.id && a.status === 'available')
    .map((a) => a.profileId || ('g:' + (a.guestName || '')))
    .filter((k) => k !== 'g:');
  const teamBuckets = {}; teams.forEach((t) => { teamBuckets[t.id] = (assign[t.id] || []).slice(); });
  const assignedSet = new Set(Object.values(teamBuckets).flat());
  const poolIds = inIds.filter((id) => !assignedSet.has(id));
  const colData = (colId) => (colId === 'pool' ? poolIds : (teamBuckets[colId] || []));
  const teamOf = (id) => (teams.find((t) => teamBuckets[t.id].includes(id))?.id || 'pool');

  const move = (id, to) => {
    if (!editable) return;
    const from = teamOf(id);
    if (from === to) { setSel(null); return; }
    const next = {}; teams.forEach((t) => { next[t.id] = teamBuckets[t.id].slice(); });
    if (from !== 'pool') next[from] = next[from].filter((x) => x !== id);
    if (to !== 'pool') next[to] = [...(next[to] || []), id];
    setAssign({ pool: [], ...next }); // persists team_players; pool is derived
    setSel(null);
  };
  const onDrop = (to) => { if (dragId.current) move(dragId.current, to); dragId.current = null; setDropCol(null); };

  // Randomise: auto-create teams from the IN count, then evenly distribute IN players.
  const randomise = async () => {
    if (!editable || busy) return;
    const all = inIds.slice();
    if (all.length < 2) { window.alert('Mark at least 2 players IN on the Availability page first.'); return; }
    const perSide = s.playersPerSide || 5;
    const N = Math.max(2, Math.min(10, Math.round(all.length / perSide) || 2));
    setBusy(true);
    try {
      const list = teams.slice();
      for (let i = list.length; i < N; i++) {
        const t = await createTeam(s.id, 'Team ' + String.fromCharCode(65 + i), TEAM_PALETTE[i % TEAM_PALETTE.length]);
        list.push(t);
      }
      for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
      const buckets = {}; list.forEach((t) => { buckets[t.id] = []; });
      all.forEach((id, i) => buckets[list[i % N].id].push(id));
      await saveTeamPlayers(buckets);
      await saveTeams(list, {}); // reset captains; managers re-pick
      ctx.reload();
    } catch (e) { window.alert(e.message || 'Randomise failed'); }
    setBusy(false);
  };

  const addTeam = async () => {
    if (!teamName.trim() || busy) return;
    setBusy(true);
    try { await createTeam(s.id, teamName.trim(), TEAM_PALETTE[teams.length % TEAM_PALETTE.length]); ctx.reload(); setTeamName(''); setAddOpen(false); }
    catch (e) { window.alert(e.message || 'Could not add team'); }
    setBusy(false);
  };
  const removeTeam = async (teamId, name) => {
    if (busy || !window.confirm(`Remove ${name}? Its players return to the pool.`)) return;
    setBusy(true);
    try { await deleteTeam(teamId); ctx.reload(); }
    catch (e) { window.alert(e.message || 'Could not remove team'); }
    setBusy(false);
  };

  const Player = ({ id, teamId }) => {
    const cap = caps[teamId] === id;
    const guest = isGuestKey(id);
    return (
      <div className={'drag-player' + (cap ? ' is-cap' : '') + (sel && sel.id === id ? ' ' : '')}
        draggable={editable}
        onDragStart={() => { dragId.current = id; }}
        onClick={() => { if (!editable) return; setSel(sel && sel.id === id ? null : { id }); }}
        style={{ outline: sel && sel.id === id ? '2px solid var(--accent)' : 'none' }}
        title={editable ? 'Drag to a team, or tap then tap a team' : ''}>
        <Avatar id={guest ? undefined : id} name={guest ? keyFirst(id) : undefined} size={26} color={guest ? 'var(--raise)' : undefined} />
        <span className="grow row" style={{ gap: 5, fontSize: 13.5, fontWeight: 600 }}>{keyFirst(id)}{guest && <span className="tag tag--guest" style={{ fontSize: 9 }}>GUEST</span>}</span>
        {cap && <Armband />}
        {teamId !== 'pool' && editable && !guest && (
          <button className="icobtn" style={{ width: 24, height: 24, border: 'none', background: 'transparent', color: cap ? 'var(--amber)' : 'var(--chalk-faint)' }}
            title="Make captain" onClick={(e) => { e.stopPropagation(); setCaps({ ...caps, [teamId]: cap ? undefined : id }); }}>
            <Icon name="flag" className="ico" style={{ width: 15, height: 15 }} />
          </button>
        )}
      </div>
    );
  };

  const Column = ({ id, team }) => {
    const players = colData(id);
    const isPool = id === 'pool';
    return (
      <div className="team-col">
        <div className="team-col__head">
          {team ? <TeamDot color={team.color} /> : <Icon name="squad" className="ico" style={{ color: 'var(--chalk-faint)' }} />}
          <span className="team-col__name">{team ? team.name : 'Pool (IN)'}</span>
          <span className="tag" style={{ marginLeft: 'auto' }}>{players.length}</span>
          {sel && !isPool && editable && <button className="btn btn--sm" onClick={() => move(sel.id, id)}>Move here</button>}
          {!isPool && editable && <button className="icobtn" style={{ width: 22, height: 22 }} title="Remove team" onClick={() => removeTeam(id, team.name)}><Icon name="x" className="ico" style={{ width: 13, height: 13 }} /></button>}
        </div>
        <div className={'team-col__body' + (dropCol === id ? ' drop-on' : '')}
          onDragOver={(e) => { if (editable) { e.preventDefault(); setDropCol(id); } }}
          onDragLeave={() => setDropCol(null)}
          onDrop={() => onDrop(id)}>
          {players.map((pid) => <Player key={pid} id={pid} teamId={id} />)}
          {players.length === 0 && <div className="muted" style={{ fontSize: 12.5, textAlign: 'center', padding: 8 }}>{isPool ? 'No one in the pool' : 'Drop players here'}</div>}
        </div>
      </div>
    );
  };

  return (
    <div className="page">
      <div className="row between wrap" style={{ marginBottom: 16, gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 30, margin: 0 }}>Team Builder</h1>
          <p className="muted" style={{ margin: '3px 0 0', fontSize: 14 }}>Pool = players marked IN. Drag into teams · tap the flag to set a captain (C).</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {!ctx.canManage ? <span className="pill"><Icon name="lock" className="ico" style={{ width: 13, height: 13 }} /> VIEW ONLY</span> :
            locked ? <StatusPill status="locked" /> :
            <>
              <button className="btn" disabled={busy} onClick={() => setAddOpen(true)}><Icon name="plus" className="ico" /> Add team</button>
              <button className="btn btn--accent" disabled={busy} onClick={randomise}><Icon name="shuffle" className="ico" /> {busy ? 'Working...' : 'Randomise'}</button>
            </>}
        </div>
      </div>

      {!ctx.canManage && <div style={{ marginBottom: 16 }}><GateBanner reason="View only — the creator and organizers build teams and assign captains." /></div>}
      {ctx.canManage && locked && <div style={{ marginBottom: 16 }}><GateBanner locked reason="Locked — within 1h of kick-off, lineups are frozen for players." /></div>}

      <div className="builder">
        <Column id="pool" team={null} />
        <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))' }}>
          {teams.map((t) => <Column key={t.id} id={t.id} team={t} />)}
        </div>
      </div>
      {teams.length === 0 && ctx.canManage && <div className="muted" style={{ marginTop: 14, fontSize: 13 }}>No teams yet — press “Randomise” to auto-create from the IN pool, or “Add team”.</div>}

      {addOpen && (
        <div className="modal-backdrop" onClick={() => setAddOpen(false)}>
          <div className="modal-card" style={{ maxWidth: 360, textAlign: 'left' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 20, margin: '0 0 12px' }}>New team</h2>
            <Field label="Team name"><input className="input" autoFocus placeholder="e.g. Reds" value={teamName} onChange={(e) => setTeamName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTeam()} /></Field>
            <div className="row" style={{ gap: 8, marginTop: 12 }}>
              <button className="btn btn--accent grow" disabled={busy || !teamName.trim()} onClick={addTeam}>{busy ? 'Adding...' : 'Add team'}</button>
              <button className="btn btn--ghost" onClick={() => setAddOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- FORMATION BOARD ---------------- */
function FormationScreen({ ctx }) {
  const teams = ctx.teams;
  const [assign] = ctx.assign;
  const [caps] = ctx.captains;
  const [tid, setTid] = useState(teams[0]?.id || '');
  if (!teams.length) {
    return (
      <div className="page page--narrow">
        <div className="card card--pad">
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 28, margin: '0 0 8px' }}>No teams yet</h1>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>Create teams before opening the formation board.</p>
        </div>
      </div>
    );
  }
  const me = ctx.me || DATA.currentUserId;
  const isCapOf = (t) => t && (caps[t.id] === me || t.captainId === me);
  const teamRoster = (t) => (assign[t.id] && assign[t.id].length ? assign[t.id] : (DATA.teamPlayers[t.id] || []));
  const isOnTeam = (t) => teamRoster(t).includes(me) || isCapOf(t);
  // Visibility: the CREATOR sees ALL teams; organizers / general users see ONLY their own team.
  const visibleTeams = ctx.isAdmin ? teams : teams.filter(isOnTeam);
  if (!visibleTeams.length) {
    return (
      <div className="page page--narrow">
        <div className="card card--pad">
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 26, margin: '0 0 8px' }}>Not on a team yet</h1>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>Your team's formation board appears here once an organizer assigns you to a team in Team Builder.</p>
        </div>
      </div>
    );
  }
  const activeTid = visibleTeams.some((t) => t.id === tid) ? tid : visibleTeams[0].id;
  const team = visibleTeams.find((t) => t.id === activeTid);
  const players = teamRoster(team);
  const side = ctx.side;
  // EDIT = CAPTAIN of THIS team only (creator/organizer/general user can all be a captain, never a
  // guest). Captains have full edit rights always — formation never locks, even on game day.
  const canEdit = isCapOf(team);

  return (
    <div className="page page--narrow">
      <div className="row between wrap" style={{ marginBottom: 14, gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 30, margin: 0 }}>Formation</h1>
          <p className="muted" style={{ margin: '3px 0 0', fontSize: 14 }}>Tactical board — drag tokens, pick a preset. No more MS Paint.</p>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <div className="seg" title="Players per side">
            {[5, 6, 7].map((n) => (
              <button key={n} className={side === n ? 'on' : ''} onClick={() => ctx.setSide(n)}>{n}-a-side</button>
            ))}
          </div>
          {!canEdit && <span className="pill"><Icon name="lock" className="ico" style={{ width: 13, height: 13 }} /> VIEW ONLY</span>}
        </div>
      </div>

      <div className="row wrap" style={{ gap: 8, marginBottom: 18 }}>
        {visibleTeams.map((t) => {
          const cap = isCapOf(t);
          return (
            <button key={t.id} className={'preset' + (t.id === activeTid ? ' on' : '')} onClick={() => setTid(t.id)}
              style={t.id === activeTid ? { background: t.color, color: '#fff', borderColor: 'transparent' } : {}}>
              <span className="row" style={{ gap: 7 }}><TeamDot color={t.id === activeTid ? '#fff' : t.color} /> {t.name}{cap && ' · C'}</span>
            </button>
          );
        })}
      </div>

      <div className="card card--pad">
        <FormationPitch team={team} playerIds={players} captainId={caps[activeTid] || team.captainId} side={side}
          saved={team.formation} onSave={(formation) => ctx.saveFormation(activeTid, formation)} locked={!canEdit}
          key={activeTid + '-' + side + (canEdit ? '' : '-' + JSON.stringify(team.formation || {}))} />
      </div>
    </div>
  );
}

/* ---------------- SCHEDULE ---------------- */
const MIN_TEAMS_OK = 4; // recommended minimum number of teams; we allow >=2 with a warning.

function ScheduleScreen({ ctx }) {
  const s = ctx.session;
  const matches = ctx.matches;
  const org = ctx.canManage;
  const sessionTeams = ctx.teams;
  const [refreshing, setRefreshing] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const dragFrom = useRef(null);
  const perMatch = matches.length ? Math.round(s.slotMinutes / matches.length) : 0;
  const slot0 = new Date(s.slotStart).getTime();
  const t = (i) => { const a = new Date(slot0 + i * perMatch * 60000); const b = new Date(slot0 + (i + 1) * perMatch * 60000); return timeOfDay(a.toISOString()) + ' – ' + timeOfDay(b.toISOString()); };

  // Refresh = pull the latest fixtures (realtime already auto-syncs; this is the manual fallback).
  const doRefresh = async () => { if (refreshing) return; setRefreshing(true); try { await ctx.reload(); } finally { setTimeout(() => setRefreshing(false), 450); } };

  // Drag-to-reorder: hold a fixture's grip and drop it on another. Only SCHEDULED matches move
  // (never a live/finished one); renumbering re-derives the kickoff times.
  const reorderTo = (from, to) => {
    if (!org || from == null || to == null || from === to) return;
    if (matches[from]?.status !== 'scheduled' || matches[to]?.status !== 'scheduled') return;
    const next = [...matches];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    ctx.setMatches(next.map((m, k) => ({ ...m, matchNo: k + 1 })));
  };
  const rowAt = (x, y) => { const el = document.elementFromPoint(x, y); const r = el && el.closest('[data-fx]'); return r ? r.getAttribute('data-fx') : null; };
  const startDrag = (e, idx, id) => {
    if (!org || matches[idx].status !== 'scheduled') return;
    e.preventDefault();
    dragFrom.current = idx; setDragId(id);
    const onMove = (ev) => setOverId(rowAt(ev.clientX, ev.clientY));
    const onUp = (ev) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const toId = rowAt(ev.clientX, ev.clientY);
      if (toId) reorderTo(dragFrom.current, matches.findIndex((m) => m.id === toId));
      dragFrom.current = null; setDragId(null); setOverId(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const generate = (rebuild) => {
    if (!org) return;
    if (sessionTeams.length < 2) { window.alert('Add at least 2 teams in Team Builder first.'); return; }
    if (rebuild && !window.confirm('Rebuild fixtures from the current teams? This resets all match scores.')) return;
    ctx.setMatches(buildDefaultMatches(s.id, sessionTeams));
  };

  const TeamWarn = () => (sessionTeams.length >= 2 && sessionTeams.length < MIN_TEAMS_OK ? (
    <div className="surface" style={{ padding: '10px 14px', marginBottom: 14, borderColor: 'var(--amber)', color: 'var(--amber)', fontSize: 13 }}>
      Only {sessionTeams.length} team{sessionTeams.length === 1 ? '' : 's'} — {MIN_TEAMS_OK}+ makes for a better round-robin. You can still play with 2.
    </div>
  ) : null);

  if (!matches.length) {
    return (
      <div className="page page--narrow">
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 30, margin: 0 }}>Match Schedule</h1>
          <p className="muted" style={{ margin: '3px 0 0', fontSize: 14 }}>No fixtures yet — generate them from the teams.</p>
        </div>
        <div className="card card--pad">
          <TeamWarn />
          <RoleGate can={org && sessionTeams.length >= 2} reason="Organizers can generate the schedule (need at least 2 teams)">
            <button className="btn btn--accent btn--block" onClick={() => generate(false)}><Icon name="plus" className="ico" /> Generate schedule</button>
          </RoleGate>
        </div>
      </div>
    );
  }

  return (
    <div className="page page--narrow">
      <div className="row between wrap" style={{ marginBottom: 16, gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 30, margin: 0 }}>Match Schedule</h1>
          <p className="muted" style={{ margin: '3px 0 0', fontSize: 14 }}>{matches.length} matches · {perMatch} min each{org ? ' · drag the grip to reorder fixtures' : ''}.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn--ghost btn--sm" onClick={doRefresh} disabled={refreshing} title="Sync fixtures">
            <span className={refreshing ? 'spin' : ''} style={{ display: 'inline-flex' }}><Icon name="refresh" size={14} /></span>
            {refreshing ? ' Syncing…' : ' Refresh'}
          </button>
          <RoleGate can={org} reason="Organizers only" inline>
            <button className="btn btn--sm" onClick={() => generate(true)}><Icon name="shuffle" className="ico" /> Rebuild</button>
          </RoleGate>
        </div>
      </div>

      <TeamWarn />

      <div className="card">
        {matches.map((m, i) => {
          const A = DATA.team(m.teamA), B = DATA.team(m.teamB);
          const draggable = org && m.status === 'scheduled';
          const isDragging = dragId === m.id;
          const isOver = overId === m.id && dragId && dragId !== m.id && m.status === 'scheduled';
          return (
            <div key={m.id} data-fx={m.id}
              className={'fixture' + (m.status === 'live' ? ' is-live' : '')}
              style={{ opacity: isDragging ? 0.4 : 1, boxShadow: isOver ? 'inset 0 2px 0 var(--accent)' : undefined, transition: 'opacity .1s' }}>
              <div className="row" style={{ gap: 8 }}>
                {draggable
                  ? <button className="icobtn" title="Drag to reorder" onPointerDown={(e) => startDrag(e, i, m.id)}
                      style={{ width: 24, height: 28, cursor: 'grab', touchAction: 'none', color: 'var(--chalk-faint)' }}>
                      <Icon name="grip" size={16} />
                    </button>
                  : <span style={{ width: 24, display: 'inline-block' }} />}
                <div className="fixture__no">{String(m.matchNo).padStart(2, '0')}</div>
              </div>
              <div>
                <div className="fixture__teams">
                  <span className="row" style={{ gap: 6 }}><TeamDot color={A.color} /> {A.name}</span>
                  <span className="muted" style={{ fontSize: 13 }}>vs</span>
                  <span className="row" style={{ gap: 6 }}><TeamDot color={B.color} /> {B.name}</span>
                </div>
                <div className="fixture__time">{t(i)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {m.status === 'done' && <div className="fixture__score">{m.scoreA}–{m.scoreB}</div>}
                {m.status === 'live' && <StatusPill status="live" />}
                {m.status === 'scheduled' && <span className="muted mono" style={{ fontSize: 11 }}>UPCOMING</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
/* =====================================================================
   TURF — screens (part 3): Live, Standings, History, Expenses, Profile
   ===================================================================== */

/* ---------------- LIVE MATCH (hero) ---------------- */
function LiveScreen({ ctx }) {
  const matches = ctx.matches;
  const sessionTeams = ctx.teams;
  const generateSchedule = () => ctx.setMatches(buildDefaultMatches(ctx.session.id, sessionTeams));

  if (!matches.length) {
    return (
      <div className="page page--narrow">
        <div className="card card--pad" style={{ textAlign: 'left' }}>
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 28, margin: '0 0 8px' }}>No live match yet</h1>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>This session has teams but no schedule. Generate fixtures before opening the live clock.</p>
          <RoleGate can={ctx.canManage && sessionTeams.length >= 2} reason="Admin or organizers can generate matches">
            <button className="btn btn--accent btn--block" onClick={generateSchedule}><Icon name="plus" className="ico" /> Generate schedule</button>
          </RoleGate>
        </div>
      </div>
    );
  }

  const live = matches.find((m) => m.status === 'live') || matches.find((m) => m.status === 'scheduled') || matches[0];
  const A = DATA.team(live.teamA), B = DATA.team(live.teamB);
  if (!A || !B) {
    return (
      <div className="page page--narrow">
        <div className="card card--pad">
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 28, margin: '0 0 8px' }}>Match teams missing</h1>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>This schedule points to teams that are not loaded for the current session.</p>
        </div>
      </div>
    );
  }
  const [caps] = ctx.captains;
  const canControl = ctx.canManage || ctx.isCaptain;
  const controlLabel = ctx.canManage ? (ctx.isAdmin ? 'ADMIN MODE' : 'ORGANIZER MODE') : 'CAPTAIN MODE';
  const reason = 'Only admins, organizers, or match captains can score';
  // Goals are DERIVED from live data so scorer tags sync to all viewers via realtime (no stale
  // local copy). saveGoals upserts; the new goal gets a real UUID so the insert is valid.
  const goals = DATA.goals.filter((g) => g.matchId === live.id);
  const [tagFor, setTagFor] = useState(null);

  const setScore = (side, val) => ctx.updateMatch(live.id, { [side]: Math.max(0, val) });
  const addGoal = (teamId, scorerId) => {
    ctx.saveGoals?.([...goals, { id: newId('goal'), matchId: live.id, teamId, scorerId, minute: 0 }]);
    setTagFor(null);
  };
  const finish = () => {
    const idx = matches.findIndex((m) => m.id === live.id);
    ctx.updateMatch(live.id, { status: 'done' });
    const nx = matches.find((m, i) => i > idx && m.status === 'scheduled');
    if (nx) ctx.updateMatch(nx.id, { status: 'live' });
  };

  const queue = matches.filter((m) => m.status === 'scheduled').slice(0, 4);
  const teamGoals = (tid) => goals.filter((g) => g.teamId === tid);

  return (
    <div className="page">
      <div className="row between wrap" style={{ marginBottom: 14, gap: 10 }}>
        <div className="row" style={{ gap: 10 }}>
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 30, margin: 0 }}>Live Match</h1>
          <span className="mono muted" style={{ fontSize: 12, alignSelf: 'center' }}>MATCH {live.matchNo} of {matches.length}</span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {canControl ? <span className="pill pill--live"><span className="dot" /> {controlLabel}</span>
            : <span className="pill"><Icon name="lock" className="ico" style={{ width: 13, height: 13 }} /> VIEW ONLY</span>}
        </div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '1fr', gap: 16 }}>
        <TimerDisplay
          match={live}
          can={canControl}
          reason={reason}
          onTimerChange={(patch) => ctx.updateMatch(live.id, patch)}
        />

        <div className="card card--pad">
          <div className="scoreboard">
            <ScoreStepper team={A} score={live.scoreA} can={canControl} onChange={(v) => setScore('scoreA', v)} />
            <div className="vs">VS</div>
            <ScoreStepper team={B} score={live.scoreB} can={canControl} onChange={(v) => setScore('scoreB', v)} />
          </div>

          {/* goal scorer tags */}
          <hr className="divline" />
          <div className="grid-2">
            {[A, B].map((T) => (
              <div key={T.id}>
                <div className="row between" style={{ marginBottom: 8 }}>
                  <span className="row" style={{ gap: 6, fontFamily: 'var(--f-display)', fontWeight: 600 }}><TeamDot color={T.color} /> {T.name} scorers</span>
                  {canControl && <button className="btn btn--sm btn--ghost" onClick={() => setTagFor(tagFor === T.id ? null : T.id)}><Icon name="plus" className="ico" /> Tag</button>}
                </div>
                <div className="row wrap" style={{ gap: 6 }}>
                  {teamGoals(T.id).map((g) => (
                    <span key={g.id} className="tag" style={{ background: T.color + '22', color: '#fff', fontSize: 11 }}>⚽ {g.scorerId ? keyFirst(g.scorerId) : 'OG'}</span>
                  ))}
                  {teamGoals(T.id).length === 0 && <span className="muted" style={{ fontSize: 12 }}>No scorers tagged</span>}
                </div>
                {tagFor === T.id && (
                  <div className="row wrap" style={{ gap: 6, marginTop: 8, padding: 8, background: 'rgba(0,0,0,.2)', borderRadius: 10 }}>
                    {(DATA.teamPlayers[T.id] || []).map((pid) => <button key={pid} className="btn btn--sm" onClick={() => addGoal(T.id, pid)}>{keyFirst(pid)}</button>)}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="row between" style={{ marginTop: 18 }}>
            <RoleGate can={canControl} reason="Captains only" inline>
              <button className="btn btn--accent" onClick={finish}><Icon name="check" className="ico" /> Full time &amp; next</button>
            </RoleGate>
            <span className="muted" style={{ fontSize: 12.5 }}>{!canControl && <span className="row" style={{ gap: 6, color: 'var(--amber)' }}><Icon name="lock" className="ico" /> Admins, organizers, or captains can control</span>}</span>
          </div>
        </div>

        {/* next match queue */}
        <div className="card card--pad">
          <div className="section-title">Up next</div>
          <div className="stack" style={{ gap: 8 }}>
            {queue.map((m) => {
              const a = DATA.team(m.teamA), b = DATA.team(m.teamB);
              return (
                <div key={m.id} className="row between" style={{ padding: '10px 12px', background: 'rgba(0,0,0,.18)', borderRadius: 10 }}>
                  <span className="row" style={{ gap: 10 }}>
                    <span className="fixture__no" style={{ fontSize: 15 }}>{String(m.matchNo).padStart(2, '0')}</span>
                    <span className="row" style={{ gap: 6, fontWeight: 600 }}><TeamDot color={a.color} />{a.name}</span>
                    <span className="muted">vs</span>
                    <span className="row" style={{ gap: 6, fontWeight: 600 }}><TeamDot color={b.color} />{b.name}</span>
                  </span>
                  <span className="muted mono" style={{ fontSize: 11 }}>QUEUED</span>
                </div>
              );
            })}
            {queue.length === 0 && <div className="muted">All matches played 🏁</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- STANDINGS ---------------- */
function StandingsScreen({ ctx }) {
  return (
    <div className="page page--narrow">
      <div className="row between wrap" style={{ marginBottom: 16, gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 30, margin: 0 }}>Standings</h1>
          <p className="muted" style={{ margin: '3px 0 0', fontSize: 14 }}>Auto-sorted live as results come in.</p>
        </div>
        <span className="pill pill--live"><span className="dot" /> UPDATING LIVE</span>
      </div>
      <StandingsTable matches={ctx.matches} teams={DATA.teams} scoring={ctx.session.scoring} qualifiers={2} />
    </div>
  );
}

/* ---------------- MATCH HISTORY ---------------- */
function HistoryScreen({ ctx }) {
  const done = ctx.matches.filter((m) => m.status === 'done');
  return (
    <div className="page page--narrow">
      <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 30, margin: '0 0 4px' }}>Match History</h1>
      <p className="muted" style={{ margin: '0 0 18px', fontSize: 14 }}>{ctx.session.turfName} · {dateLabel(ctx.session.slotStart)}</p>

      <div className="card">
        {done.length === 0 && <div className="card--pad muted" style={{ padding: 18 }}>No completed matches yet.</div>}
        {done.map((m) => {
          const A = DATA.team(m.teamA), B = DATA.team(m.teamB);
          const gs = DATA.goals.filter((g) => g.matchId === m.id);
          const aWin = m.scoreA > m.scoreB, draw = m.scoreA === m.scoreB;
          return (
            <div key={m.id} style={{ padding: '14px 16px', borderBottom: '1px solid var(--line-soft)' }}>
              <div className="row between">
                <span className="mono muted" style={{ fontSize: 11 }}>MATCH {String(m.matchNo).padStart(2, '0')}</span>
                <StatusPill status="done" />
              </div>
              <div className="row between" style={{ marginTop: 8, gap: 10 }}>
                <span className="row" style={{ gap: 8, fontFamily: 'var(--f-display)', fontSize: 18, whiteSpace: 'nowrap', fontWeight: aWin || draw ? 600 : 400, opacity: !aWin && !draw ? 0.7 : 1 }}><TeamDot color={A.color} /> {A.name}</span>
                <span className="num" style={{ fontSize: 22, whiteSpace: 'nowrap' }}>{m.scoreA} – {m.scoreB}</span>
                <span className="row" style={{ gap: 8, fontFamily: 'var(--f-display)', fontSize: 18, whiteSpace: 'nowrap', fontWeight: !aWin || draw ? 600 : 400, opacity: aWin && !draw ? 0.7 : 1, justifyContent: 'flex-end' }}>{B.name} <TeamDot color={B.color} /></span>
              </div>
              {gs.length > 0 && (
                <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
                  {gs.map((g) => <span key={g.id} className="tag" style={{ background: DATA.team(g.teamId).color + '22', color: '#fff' }}>⚽ {g.scorerId ? keyFirst(g.scorerId) : 'OG'} {g.minute ? g.minute + "'" : ''}</span>)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- EXPENSES & PAYMENTS ---------------- */
function ExpensesScreen({ ctx }) {
  const s = ctx.session;
  const org = ctx.canManage;
  const [pay, setPay] = ctx.payments;
  const [exp, setExp] = ctx.expenses;
  const [assign] = ctx.assign;
  const sessionExpenses = exp.filter((e) => e.sessionId === s.id);
  const extraTotal = sessionExpenses.reduce((a, e) => a + e.amount, 0);
  const baseFee = Number(s.totalFee) || 0;
  const total = baseFee + extraTotal; // turf booking fee + extra expenses = the pot to split
  // contributors = everyone assigned to a team — members AND guests (guests are full players).
  const contributorKeys = useMemo(() => {
    const ids = Object.entries(assign)
      .filter(([teamId]) => teamId !== 'pool')
      .flatMap(([, players]) => players);
    return [...new Set(ids)].filter((k) => (isGuestKey(k) ? true : DATA.profile(k)));
  }, [assign]);
  const head = contributorKeys.length;
  const per = head ? Math.round(total / head) : 0;
  const sessionPayments = pay.filter((p) => p.sessionId === s.id);
  const payByKey = new Map(sessionPayments.map((p) => [p.key || p.profileId || ('g:' + (p.guestName || '')), p]));
  // amountPaid is the REAL amount a player handed over (may exceed their per-head share to
  // cover someone who didn't pay). Outstanding nets all payments against the total pot.
  const contributors = contributorKeys.map((key) => {
    const existing = payByKey.get(key);
    const guest = isGuestKey(key);
    return {
      sessionId: s.id, key,
      profileId: guest ? undefined : key,
      guestName: guest ? key.slice(2) : undefined,
      amountDue: per,
      amountPaid: existing ? existing.amountPaid : 0,
      method: existing?.method || 'cash',
      confirmedBy: existing?.confirmedBy,
    };
  });
  const collected = contributors.reduce((a, p) => a + p.amountPaid, 0);
  const outstanding = Math.max(0, total - collected);
  const paidCount = contributors.filter((p) => per > 0 && p.amountPaid >= per).length;
  const progress = total > 0 ? Math.min(100, (collected / total) * 100) : 0;

  const [editKey, setEditKey] = useState(null);
  const [editVal, setEditVal] = useState('');

  const keyOf = (p) => p.key || p.profileId || ('g:' + (p.guestName || ''));
  const updatePayment = (key, patch) => {
    if (!org) return;
    const guest = isGuestKey(key);
    const identity = { key, profileId: guest ? undefined : key, guestName: guest ? key.slice(2) : undefined };
    setPay((prev) => {
      const idx = prev.findIndex((p) => p.sessionId === s.id && keyOf(p) === key);
      const current = idx >= 0 ? prev[idx] : { sessionId: s.id, ...identity, amountPaid: 0, method: 'cash' };
      const nextPayment = { ...current, ...identity, ...patch, amountDue: per };
      if (idx < 0) return [...prev, nextPayment];
      return prev.map((p, i) => (i === idx ? nextPayment : p));
    });
  };
  // mark fully paid / clear (toggle on the per-head share)
  const togglePaid = (key) => {
    const row = contributors.find((p) => p.key === key);
    if (!row || per <= 0) return;
    const settled = row.amountPaid >= per;
    updatePayment(key, { amountPaid: settled ? 0 : per, confirmedBy: settled ? undefined : s.createdBy });
  };
  // set the exact amount a player gave (Add money) — can be more than their share
  const setPaidAmount = (key, amt) => {
    const v = Math.max(0, Math.round(Number(amt) || 0));
    updatePayment(key, { amountPaid: v, confirmedBy: v > 0 ? s.createdBy : undefined });
  };
  const openEdit = (p) => { setEditKey(p.key); setEditVal(p.amountPaid ? String(p.amountPaid) : ''); };
  const saveEdit = () => { if (editKey != null) setPaidAmount(editKey, editVal); setEditKey(null); setEditVal(''); };
  const setMethod = (key, method) => updatePayment(key, { method });

  const Stat = ({ k, v, c }) => (
    <div className="surface" style={{ padding: '14px 16px' }}>
      <div className="muted mono" style={{ fontSize: 10, letterSpacing: '.1em' }}>{k}</div>
      <div className="num" style={{ fontSize: 26, marginTop: 2, color: c }}>{v}</div>
    </div>
  );

  return (
    <div className="page page--narrow">
      <div className="row between wrap" style={{ marginBottom: 16, gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 30, margin: 0 }}>Expenses</h1>
          <p className="muted" style={{ margin: '3px 0 0', fontSize: 14 }}>Turf bill, split between {head} assigned team players.</p>
        </div>
        {!org && <span className="pill"><Icon name="lock" className="ico" style={{ width: 13, height: 13 }} /> ORGANIZER CONTROLS</span>}
      </div>

      <div className="grid-3" style={{ marginBottom: 18 }}>
        <Stat k="TOTAL POT" v={taka(total)} />
        <Stat k="COLLECTED" v={taka(collected)} c="var(--accent)" />
        <Stat k="OUTSTANDING" v={taka(outstanding)} c={outstanding > 0 ? 'var(--amber)' : 'var(--accent)'} />
      </div>

      <div className="card card--pad" style={{ marginBottom: 16 }}>
        <div className="row between">
          <div className="section-title" style={{ margin: 0 }}>Per player</div>
          <span className="num" style={{ fontSize: 20 }}>{taka(per)} <span className="muted" style={{ fontSize: 12 }}>each</span></span>
        </div>
        <div style={{ height: 8, background: 'rgba(255,255,255,.08)', borderRadius: 8, overflow: 'hidden', margin: '12px 0 4px' }}>
          <div style={{ width: progress + '%', height: '100%', background: 'var(--accent)' }} />
        </div>
        <div className="muted" style={{ fontSize: 12 }}>{paidCount}/{head} paid · only players assigned to teams contribute</div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        {contributors.map((p) => {
          const guest = isGuestKey(p.key);
          const fully = per > 0 && p.amountPaid >= per;
          const partial = p.amountPaid > 0 && p.amountPaid < per;
          const extra = p.amountPaid - per; // > 0 means this player covered others' shares
          const editing = editKey === p.key;
          return (
            <div key={p.key} style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="row between wrap" style={{ gap: 10 }}>
                <div className="row" style={{ gap: 10, minWidth: 0 }}>
                  <Avatar id={guest ? undefined : p.key} name={guest ? keyName(p.key) : undefined} size={30} color={guest ? 'var(--raise)' : undefined} />
                  <div style={{ minWidth: 0 }}>
                    <span className="row" style={{ gap: 5, fontWeight: 600, fontSize: 14 }}>{keyName(p.key)} {guest && <span className="tag tag--guest" style={{ fontSize: 9 }}>GUEST</span>}</span>
                    <div className="muted" style={{ fontSize: 11.5 }}>
                      Paid <span style={{ color: p.amountPaid > 0 ? 'var(--accent)' : 'inherit', fontWeight: 600 }}>{taka(p.amountPaid)}</span> of {taka(per)}
                      {extra > 0 && <span style={{ color: 'var(--accent)' }}> · +{taka(extra)} covers others</span>}
                    </div>
                  </div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <div className="seg seg--ghost" style={{ opacity: org ? 1 : 0.6 }}>
                    {['bkash', 'cash'].map((mth) => (
                      <button key={mth} className={p.method === mth ? 'on' : ''} onClick={() => setMethod(p.key, mth)} disabled={!org} style={{ fontSize: 10.5, padding: '4px 8px' }}>{mth === 'bkash' ? 'bKash' : 'Cash'}</button>
                    ))}
                  </div>
                  {org && <button className="btn btn--ghost btn--sm" onClick={() => (editing ? setEditKey(null) : openEdit(p))} title="Enter the exact amount this player gave"><Icon name="plus" className="ico" style={{ width: 13, height: 13 }} /> Money</button>}
                  <button className={'pill ' + (fully ? 'pill--paid' : 'pill--due')} onClick={() => togglePaid(p.key)} style={{ cursor: org && per > 0 ? 'pointer' : 'default', minWidth: 78, justifyContent: 'center' }} disabled={!org || per <= 0}>
                    {fully ? <><Icon name="check" className="ico" style={{ width: 12, height: 12 }} /> PAID</> : partial ? 'PARTIAL' : 'DUE'}
                  </button>
                </div>
              </div>
              {editing && org && (
                <div className="row wrap" style={{ gap: 8 }}>
                  <input className="input" type="number" inputMode="numeric" value={editVal} autoFocus
                    placeholder={'Amount given (e.g. ' + (per * 2) + ' to cover one more)'}
                    onChange={(e) => setEditVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); }}
                    style={{ maxWidth: 240 }} />
                  <button className="btn btn--accent btn--sm" onClick={saveEdit}>Save</button>
                  <button className="btn btn--ghost btn--sm" onClick={() => { setEditKey(null); setEditVal(''); }}>Cancel</button>
                </div>
              )}
            </div>
          );
        })}
        {contributors.length === 0 && <div className="card--pad muted" style={{ padding: 18 }}>No team players selected yet.</div>}
      </div>

      <div className="card card--pad">
        <div className="section-title">Extra expenses</div>
        <div className="stack" style={{ gap: 0 }}>
          <div className="kv">
            <span className="kv__k">Turf booking fee <span className="muted mono" style={{ fontSize: 11 }}>· base</span></span>
            <span className="kv__v num">{taka(baseFee)}</span>
          </div>
          {sessionExpenses.map((e) => (
            <div key={e.id} className="kv">
              <span className="kv__k">{e.label} <span className="muted mono" style={{ fontSize: 11 }}>· by {DATA.first(e.createdBy)}</span></span>
              <span className="kv__v num">{taka(e.amount)}</span>
            </div>
          ))}
          <div className="kv" style={{ borderTop: '1px solid var(--line)', marginTop: 6, paddingTop: 12 }}>
            <span style={{ fontFamily: 'var(--f-display)', letterSpacing: '.08em' }}>RUNNING TOTAL</span>
            <span className="num" style={{ fontSize: 20 }}>{taka(total)}</span>
          </div>
        </div>
        <RoleGate can={org} reason="Only the organizer can add expenses" >
          <button className="btn btn--sm" style={{ marginTop: 14 }} onClick={() => setExp([...exp, { id: newId('expense'), sessionId: s.id, label: 'New expense', amount: 200, createdBy: s.createdBy }])}><Icon name="plus" className="ico" /> Add expense</button>
        </RoleGate>
      </div>
    </div>
  );
}

/* ---------------- PROFILE ---------------- */
function ProfileScreen({ ctx }) {
  const id = DATA.currentUserId;
  const badges = [];
  if (ctx.role === 'admin') badges.push(['Admin', 'var(--accent)']);
  if (ctx.role === 'organizer') badges.push(['Organizer', 'var(--sky)']);
  if (ctx.isCaptain) badges.push(['Captain', 'var(--amber)']);
  badges.push(['Player', 'var(--accent)']);
  const mySessions = DATA.sessions;

  return (
    <div className="page page--narrow">
      <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 30, margin: '0 0 18px' }}>Profile</h1>

      <div className="card card--pad" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 16 }}>
          <Avatar id={id} size={68} />
          <div className="grow">
            <div style={{ fontFamily: 'var(--f-display)', fontSize: 26, fontWeight: 700 }}>{DATA.name(id)}</div>
            <div className="row wrap" style={{ gap: 7, marginTop: 8 }}>
              {badges.map(([b, c]) => (
                <span key={b} className="pill" style={{ color: c, borderColor: c + '66', background: c + '18' }}>{b}</span>
              ))}
            </div>
          </div>
          <button className="icobtn"><Icon name="settings" className="ico" /></button>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 16 }}>
        {[['MATCHES', 41], ['GOALS', 17], ['SESSIONS', 12]].map(([k, v]) => (
          <div key={k} className="surface" style={{ padding: '16px', textAlign: 'center' }}>
            <div className="num" style={{ fontSize: 30 }}>{v}</div>
            <div className="muted mono" style={{ fontSize: 10, letterSpacing: '.1em' }}>{k}</div>
          </div>
        ))}
      </div>

      <div className="card card--pad">
        <div className="section-title">My sessions</div>
        <div className="stack" style={{ gap: 0 }}>
          {mySessions.map((s) => (
            <div key={s.id} className="kv" style={{ cursor: 'pointer' }} onClick={() => { ctx.openSession(s.id); ctx.go('detail'); }}>
              <span className="row" style={{ gap: 10 }}><StatusPill status={s.status} /><span className="kv__k" style={{ color: 'var(--chalk)' }}>{s.turfName}</span></span>
              <span className="muted" style={{ fontSize: 12.5 }}>{dateLabel(s.slotStart)}</span>
            </div>
          ))}
        </div>
      </div>

      {ctx.logout && (
        <button className="btn btn--ghost btn--block" style={{ marginTop: 16 }} onClick={ctx.logout}>
          <Icon name="x" className="ico" /> Log out
        </button>
      )}

      <p className="muted" style={{ fontSize: 12.5, marginTop: 18, textAlign: 'center' }}>Your permissions come from the current session roster and captain picks.</p>
    </div>
  );
}
/* =====================================================================
   TURF — App shell, routing, role, lock state, and status badges
   ===================================================================== */
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
  ACTIVE_DB = dbView;

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
    ACTIVE_DB = nextDb;
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
      <SpeedInsights />
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
