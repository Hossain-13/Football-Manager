import React, { useState, useEffect } from 'react';
import { Icon } from './Icon.jsx';
import { Avatar } from './core.jsx';
import { DATA } from '../lib/dataView.js';

export const NAV_SESSION = [
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

export function Sidebar({ screen, go, sessions, activeId, openSession }) {
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

export const TABS = [
  { id: 'dashboard', label: 'Home', icon: 'grid' },
  { id: 'sessions', label: 'Sessions', icon: 'sessions' },
  { id: 'live', label: 'Live', icon: 'live' },
  { id: 'standings', label: 'Table', icon: 'standings' },
  { id: 'more', label: 'More', icon: 'more' },
];

export function BottomTabBar({ screen, go }) {
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
export function MoreScreen({ go, sessionName }) {
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
