import React from 'react';
import { Icon } from '../components/Icon.jsx';
import { Avatar, StatusPill } from '../components/core.jsx';
import { DATA } from '../lib/dataView.js';
import { dateLabel } from '../lib/format.js';

export function ProfileScreen({ ctx }) {
  const id = DATA.currentUserId;
  const me = (DATA.profiles || []).find((p) => p.id === id);
  const badges = [];
  if (ctx.role === 'admin') badges.push(['Admin', 'var(--accent)']);
  if (ctx.role === 'organizer') badges.push(['Organizer', 'var(--sky)']);
  if (ctx.isCaptain) badges.push(['Captain', 'var(--amber)']);
  badges.push(['Player', 'var(--accent)']);
  const prefs = [me?.prefPos1, me?.prefPos2].filter(Boolean);
  // Was every session in the app, not just this player's own - DATA.sessions is global.
  const myMemberships = new Set((DATA.members || []).filter((m) => m.profileId === id).map((m) => m.sessionId));
  const mySessions = DATA.sessions.filter((s) => myMemberships.has(s.id));
  const stats = ctx.careerStats;

  return (
    <div className="page page--narrow">
      <div className="card card--pad" style={{ marginBottom: 16, marginTop: 4 }}>
        <div className="profile-head">
          <Avatar id={id} size={72} />
          <div className="grow">
            <div style={{ fontFamily: 'var(--f-display)', fontSize: 26, fontWeight: 700 }}>{DATA.name(id)}</div>
            <div className="row wrap" style={{ gap: 7, marginTop: 8 }}>
              {badges.map(([b, c]) => (
                <span key={b} className="pill" style={{ color: c, borderColor: c + '66', background: c + '18' }}>{b}</span>
              ))}
            </div>
            {(prefs.length > 0 || me?.contact) && (
              <div className="profile-head__prefs">
                {prefs.map((p) => (
                  <span key={p} className="profile-pref"><Icon name="formation" className="ico" style={{ width: 13, height: 13 }} /> {p}</span>
                ))}
                {me?.contact && <span className="profile-pref">{me.contact}</span>}
              </div>
            )}
          </div>
          <button className="icobtn" title="Settings" aria-label="Settings"><Icon name="settings" className="ico" /></button>
        </div>

      </div>

      <div className="section-title">Career stats</div>
      <div className="grid-3" style={{ marginBottom: 22 }}>
        {[['schedule', 'MATCHES', stats ? stats.matches : '—'], ['trophy', 'GOALS', stats ? stats.goals : '—'], ['sessions', 'SESSIONS', mySessions.length]].map(([icon, k, v]) => (
          <div key={k} className="surface dash-stat dash-stat--tile">
            <div className="icon-badge"><Icon name={icon} className="ico" /></div>
            <div>
              <div className="num" style={{ fontSize: 26 }}>{v}</div>
              <div className="muted mono" style={{ fontSize: 10, letterSpacing: '.1em', marginTop: 2 }}>{k}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card card--pad">
        <div className="section-title">My sessions</div>
        <div className="stack" style={{ gap: 0 }}>
          {mySessions.map((s) => (
            <div key={s.id} className="profile-list-row" onClick={() => { ctx.openSession(s.id); ctx.go('detail'); }}>
              <span className="row" style={{ gap: 10, minWidth: 0 }}>
                <StatusPill status={s.status} />
                <span style={{ color: 'var(--chalk)', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.turfName}</span>
              </span>
              <span className="row" style={{ gap: 8, flex: 'none' }}>
                <span className="muted" style={{ fontSize: 12.5 }}>{dateLabel(s.slotStart)}</span>
                <Icon name="arrowR" className="ico" style={{ width: 15, height: 15 }} />
              </span>
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
