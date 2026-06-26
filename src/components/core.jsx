import React, { useState, useEffect, useRef } from 'react';
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

/* Circular countdown to a lock instant. The ring only depletes over the final `windowMs`
   leading up to `to` (default 1h, matching the lock rule itself) - days/hours before that it
   stays full so it reads as "no urgency yet" instead of a confusing near-empty ring. Color
   shifts calm -> amber -> red as the lock approaches/passes, same digits as <Countdown/>. */
export function LockRing({ to, windowMs = 3600000, size = 84, label = 'LOCK', expired = 'LOCKED' }) {
  useNow(1000);
  const remaining = new Date(to).getTime() - Date.now();
  const locked = remaining <= 0;
  const frac = Math.max(0, Math.min(1, remaining / windowMs));
  const color = locked || frac <= 0.15 ? 'var(--coral)' : frac <= 0.5 ? 'var(--amber)' : 'var(--accent)';
  const r = 42, c = 2 * Math.PI * r;
  return (
    <div className="lock-ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <circle cx="50" cy="50" r={r} className="lock-ring__track" />
        <circle
          cx="50" cy="50" r={r} className="lock-ring__fill" style={{ stroke: color }}
          strokeDasharray={c} strokeDashoffset={c * (1 - frac)}
        />
      </svg>
      <div className="lock-ring__center">
        <div className="lock-ring__time" style={{ color }}>{locked ? expired : <Countdown to={to} expired={expired} />}</div>
        <div className="lock-ring__label">{label}</div>
      </div>
    </div>
  );
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

/* Topbar account row: Refresh is always its own icon (mirrors the sidebar's logout/profile
   rail on desktop, which is why this never duplicates a bare logout button — only-mobile,
   since desktop already has both in the sidebar foot). A single profile icon opens a small
   dropdown with Profile + Log out so mobile (no sidebar) keeps both reachable. */
export function AccountActions({ refreshing, onRefresh, onProfile, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div className="account-actions">
      <button className="icobtn" onClick={onRefresh} disabled={refreshing} title="Refresh data" aria-label="Refresh data">
        <Icon name="refresh" size={17} className={'ico' + (refreshing ? ' spin' : '')} />
      </button>
      <div className="account-menu only-mobile" ref={ref}>
        <button className="icobtn" onClick={() => setOpen((o) => !o)} title="Account" aria-label="Account menu" aria-haspopup="menu" aria-expanded={open}>
          <Icon name="profile" size={18} />
        </button>
        {open && (
          <div className="account-menu__panel" role="menu">
            <button className="account-menu__item" role="menuitem" onClick={() => { setOpen(false); onProfile(); }}>
              <Icon name="profile" className="ico" /><span>Profile</span>
            </button>
            <button className="account-menu__item" role="menuitem" onClick={() => { setOpen(false); onLogout(); }}>
              <Icon name="logout" className="ico" /><span>Log out</span>
            </button>
          </div>
        )}
      </div>
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
/* Wrap controls the current user can't use. The locked state must read as "fenced off" on
   sight - before the reason is even read - so it gets a real cursor change, zero hover
   affordance (pointer-events:none on the content, not just dimming) and the same diagonal-hatch
   texture already used on the player-locked Formation pitch (.locked-overlay), so a control lock
   and a pitch lock read as the same concept everywhere they appear. */
export function RoleGate({ can, reason, children, inline }) {
  if (can) return children;
  return (
    <div className={'rolegate' + (inline ? ' rolegate--inline' : ' rolegate--block')} title={reason}>
      <div className="rolegate__content locked-overlay">{children}</div>
      <span className="pill pill--locked">
        <Icon name="lock" className="ico" style={{ width: 12, height: 12 }} />
        {!inline && <span>{reason}</span>}
      </span>
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
        <Icon name="arrowR" className="ico session-card__chev" style={{ color: 'var(--chalk-faint)' }} />
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

/* ---------- skeleton loading ---------- */
export function Skeleton({ w, h = 13, r, circle, style }) {
  return <div className={'sk' + (circle ? ' sk--circle' : '')} style={{ width: w, height: circle ? w : h, borderRadius: r, ...style }} />;
}

/* Full app-shell skeleton shown while the first live fetch is in flight — mirrors the real
   sidebar/topbar/content geometry so there's no layout jump when data arrives. */
export function AppSkeleton() {
  return (
    <div className="app pitch-bg">
      <div className="sidebar">
        <div className="brand"><Skeleton w={36} circle /><Skeleton w={92} h={16} /></div>
        {[1, 2].map((i) => (
          <div key={i} className="row" style={{ gap: 12, padding: '10px 12px' }}>
            <Skeleton w={19} h={19} r={5} /><Skeleton w={i === 1 ? 70 : 90} />
          </div>
        ))}
      </div>
      <div className="app__main">
        <header className="topbar">
          <div className="stack" style={{ gap: 6 }}>
            <Skeleton w={150} h={20} />
            <Skeleton w={100} h={11} />
          </div>
          <div className="topbar__spacer" />
          <div className="row" style={{ gap: 8 }}><Skeleton w={28} h={28} circle /></div>
        </header>
        <div className="app__scroll">
          <div className="page">
            <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', marginBottom: 22 }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="surface" style={{ padding: '14px 16px' }}>
                  <Skeleton w={60} h={9} style={{ marginBottom: 10 }} /><Skeleton w={44} h={22} />
                </div>
              ))}
            </div>
            {[1, 2].map((i) => (
              <div key={i} className="card card--pad" style={{ marginBottom: 10 }}>
                <div className="row between" style={{ gap: 10 }}>
                  <div className="row" style={{ gap: 10 }}>
                    <Skeleton w={40} h={40} circle />
                    <div className="stack" style={{ gap: 6 }}><Skeleton w={140} h={14} /><Skeleton w={90} h={11} /></div>
                  </div>
                  <Skeleton w={70} h={22} r={999} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
