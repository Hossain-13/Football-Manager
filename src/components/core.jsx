import React, { useState, useEffect } from 'react';
import { Icon } from './Icon.jsx';
import { DATA } from '../lib/dataView.js';
import { pad, dateLabel, timeOfDay } from '../lib/format.js';

export function useNow(ms = 1000) {
  const [, set] = useState(0);
  useEffect(() => { const t = setInterval(() => set((x) => x + 1), ms); return () => clearInterval(t); }, [ms]);
  return Date.now();
}

/* countdown text to a target time */
export function Countdown({ to, prefix = '', expired = 'now' }) {
  useNow(1000);
  const diff = new Date(to).getTime() - Date.now();
  if (diff <= 0) return <span>{expired}</span>;
  const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
  const d = Math.floor(h / 24);
  const txt = d >= 1 ? `${d}d ${h % 24}h` : h >= 1 ? `${h}h ${pad(m)}m` : `${pad(m)}:${pad(s)}`;
  return <span>{prefix}{txt}</span>;
}

/* ---------- avatars / chips ---------- */
export function Avatar({ id, name, size = 34, color }) {
  const init = id ? DATA.initials(id) : (name ? name.split(' ').map((x) => x[0]).slice(0, 2).join('') : '?');
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.4, background: color || undefined }}>
      {init.toUpperCase()}
    </div>
  );
}

export function TeamDot({ color }) { return <span className="team-dot" style={{ background: color }} />; }

export function Armband() { return <span className="armband" title="Captain">C</span>; }

export function PlayerChip({ id, name, sub, right, captain }) {
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
export function StatusPill({ status }) {
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
export function RoleGate({ can, reason, children, inline }) {
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

export function GateBanner({ reason, locked }) {
  return (
    <div className="gate-banner">
      <Icon name={locked ? 'lock' : 'clock'} className="ico" />
      <span>{reason}</span>
    </div>
  );
}

/* ---------- session card ---------- */
export function SessionCard({ session, onOpen, count }) {
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
export function Field({ label, children }) {
  return <div className="field"><label>{label}</label>{children}</div>;
}
