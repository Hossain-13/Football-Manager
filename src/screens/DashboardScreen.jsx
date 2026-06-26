import React from 'react';
import { Icon } from '../components/Icon.jsx';
import { StatusPill } from '../components/core.jsx';
import { DATA, memberCount } from '../lib/dataView.js';
import { dateLabel, timeOfDay, taka } from '../lib/format.js';

export const DashFlag = ({ label, tone }) => {
  const cls = tone === 'ok' ? 'pill pill--paid' : tone === 'warn' ? 'pill pill--due' : tone === 'out' ? 'pill pill--out' : 'pill';
  return <span className={cls} style={{ fontSize: 10.5 }}>{label}</span>;
};

export function DashboardScreen({ ctx }) {
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

  const Tile = ({ s, i }) => (
    <div className="card card--pad dash-tile dash-row" style={{ '--i': i }} onClick={() => open(s)}>
      <div className="dash-tile__top">
        <div className="row" style={{ gap: 8 }}>
          <StatusPill status={s.status} />
          {iManage(s) && <span className="tag tag--org">{s.createdBy === me ? 'CREATOR' : 'ORGANIZER'}</span>}
        </div>
        <Icon name="arrowR" className="ico" style={{ color: 'var(--chalk-faint)', flex: 'none' }} />
      </div>
      <div>
        <div className="dash-tile__title">{s.turfName}</div>
        <div className="dash-tile__meta">{dateLabel(s.slotStart)} · {timeOfDay(s.slotStart)} · {memberCount(s.id)} in</div>
      </div>
      <div className="dash-tile__flags">
        {flagsFor(s).map((f, i2) => <DashFlag key={i2} label={f.label} tone={f.tone} />)}
      </div>
    </div>
  );

  const Group = ({ title, items, empty }) => (
    <div style={{ marginBottom: 24 }}>
      <div className="section-title">{title}</div>
      {items.length === 0
        ? <div className="muted" style={{ fontSize: 13 }}>{empty}</div>
        : <div className="dash-grid">{items.map((s, i) => <Tile key={s.id} s={s} i={i} />)}</div>}
    </div>
  );

  const Stat = ({ icon, k, v, c }) => (
    <div className="surface dash-stat" style={c ? { '--accent-stat': c } : undefined}>
      <div className="icon-badge"><Icon name={icon} className="ico" /></div>
      <div>
        <div className="muted mono" style={{ fontSize: 10, letterSpacing: '.1em' }}>{k}</div>
        <div className="num" style={{ fontSize: 23, marginTop: 1, color: c }}>{v}</div>
      </div>
    </div>
  );

  return (
    <div className="page">
      <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 30, margin: '0 0 18px', letterSpacing: '.01em' }}>
        {myName && myName !== '—' ? `Hi, ${myName}` : 'Dashboard'}
      </h1>

      {ongoing.map((s, i) => (
        <div key={s.id} className="card dash-hero dash-row" style={{ '--i': i, marginBottom: 16 }} onClick={() => open(s)}>
          <div className="row between wrap" style={{ gap: 12 }}>
            <div className="row" style={{ gap: 12 }}>
              <span className="pill pill--live"><span className="dot" /> LIVE NOW</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{s.turfName}</div>
                <div className="muted mono" style={{ fontSize: 11 }}>{dateLabel(s.slotStart)} · {timeOfDay(s.slotStart)} · {memberCount(s.id)} in</div>
              </div>
            </div>
            <button className="btn btn--accent btn--sm" onClick={(e) => { e.stopPropagation(); ctx.openSession(s.id); ctx.go('live'); }}>
              <Icon name="live" className="ico" /> Open Live
            </button>
          </div>
          <div className="row wrap" style={{ gap: 6, marginTop: 12 }}>
            {flagsFor(s).map((f, i2) => <DashFlag key={i2} label={f.label} tone={f.tone} />)}
          </div>
        </div>
      ))}

      <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', marginBottom: 22 }}>
        <Stat icon="sessions" k="SESSIONS" v={sessions.length} />
        <Stat icon="expenses" k="SPENT" v={stats ? taka(stats.totalSpent) : '—'} />
        <Stat icon="clock" k="OUTSTANDING" v={stats ? taka(stats.outstanding) : '—'} c={stats && stats.outstanding > 0 ? 'var(--amber)' : 'var(--accent)'} />
        <Stat icon="trophy" k="GOALS LOGGED" v={stats ? stats.goalCount : '—'} />
      </div>

      {sessions.length === 0 ? (
        <div className="card card--pad" style={{ marginBottom: 20 }}>
          <div className="section-title" style={{ margin: 0 }}>No sessions yet</div>
          <p className="muted" style={{ fontSize: 13.5 }}>Create a session or join one with a code.</p>
          <button className="btn btn--accent" onClick={() => ctx.go('sessions')}><Icon name="sessions" className="ico" /> Go to My Sessions</button>
        </div>
      ) : (
        <>
          <Group title="Upcoming" items={upcoming} empty="Nothing scheduled yet." />
          <Group title="Recent" items={recent} empty="No past sessions yet." />
        </>
      )}
    </div>
  );
}
