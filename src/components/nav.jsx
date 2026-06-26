import React, { useState, useEffect } from 'react';
import { Icon } from './Icon.jsx';
import { Avatar } from './core.jsx';
import { DATA } from '../lib/dataView.js';

export const NAV_SESSION = [
  { id: 'detail', label: 'Overview', icon: 'flag' },
  { id: 'availability', label: 'IN/OUT', icon: 'squad' },
  { id: 'teams', label: 'Team Builder', icon: 'teams' },
  { id: 'formation', label: 'Formation', icon: 'formation' },
  { id: 'schedule', label: 'Schedule', icon: 'schedule' },
  { id: 'live', label: 'Live Match', icon: 'live', live: true },
  { id: 'standings', label: 'Standings', icon: 'standings' },
  { id: 'history', label: 'History', icon: 'history' },
  { id: 'expenses', label: 'Expenses', icon: 'expenses' },
];

export function Sidebar({ screen, go, sessions, activeId, openSession, onLogout }) {
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
        <button className="nav-item" onClick={onLogout}>
          <Icon name="logout" className="ico" /><span>Log out</span>
        </button>
        <button className={'nav-item' + (screen === 'profile' ? ' nav-item--active' : '')} onClick={() => go('profile')}>
          <Avatar id={DATA.currentUserId} size={22} /><span>Profile</span>
        </button>
      </div>
    </aside>
  );
}

/* core matchday destinations live in the floating bar; Live sits raised in the centre. */
export const TABS = [
  { id: 'dashboard', label: 'Home', icon: 'grid' },
  { id: 'sessions', label: 'Sessions', icon: 'sessions' },
  { id: 'availability', label: 'IN/OUT', icon: 'squad' },
  { id: 'live', label: 'Live', icon: 'live', center: true },
  { id: 'schedule', label: 'Schedule', icon: 'schedule' },
  { id: 'expenses', label: 'Expenses', icon: 'expenses' },
  { id: 'more', label: 'More', icon: 'moreGrid' },
];

export function BottomTabBar({ screen, go }) {
  const activeTab = TABS.some((t) => t.id === screen) ? screen
    : (screen === 'profile' || NAV_SESSION.some((n) => n.id === screen) ? 'more' : null);
  return (
    <nav className="tabbar">
      {TABS.map((t) => {
        const on = activeTab === t.id;
        return (
          <button
            key={t.id} className={'tab' + (t.center ? ' tab--center' : '') + (on ? ' on' : '')}
            onClick={() => go(t.id)} aria-current={on ? 'page' : undefined}
          >
            <span className={t.center ? 'tab__fab' : 'tab__mark'}><Icon name={t.icon} className="ico" /></span>
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* "More" sheet for mobile — secondary screens not already in the floating bar, grouped. */
const MORE_GROUPS = [
  { label: 'Matchday', items: NAV_SESSION.filter((n) => !['availability', 'schedule', 'live', 'expenses'].includes(n.id)) },
  { label: 'Account', items: [{ id: 'profile', label: 'Profile', icon: 'profile' }] },
];
export function MoreScreen({ go }) {
  // bottom tabs already cover Live + Standings; everything else for the active session lives here.
  return (
    <div className="page">
      {MORE_GROUPS.map((group) => (
        <div key={group.label} style={{ marginBottom: 20 }}>
          <div className="nav-group__label" style={{ padding: '0 2px 8px' }}>{group.label}</div>
          <div className="card">
            {group.items.map((it, i) => (
              <button key={it.id} className="nav-item" style={{ borderBottom: i < group.items.length - 1 ? '1px solid var(--line-soft)' : 'none', borderRadius: 0, padding: '15px 16px' }} onClick={() => go(it.id)}>
                <Icon name={it.icon} className="ico" /><span style={{ fontSize: 15 }}>{it.label}</span>
                {it.live && <span className="nav-item__badge">LIVE</span>}
                <Icon name="chevron" className="ico" style={{ marginLeft: 'auto', color: 'var(--chalk-faint)' }} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
