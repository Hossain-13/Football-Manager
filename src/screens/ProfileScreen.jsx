import React from 'react';
import { Icon } from '../components/Icon.jsx';
import { Avatar, StatusPill } from '../components/core.jsx';
import { DATA } from '../lib/dataView.js';
import { dateLabel } from '../lib/format.js';

export function ProfileScreen({ ctx }) {
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
