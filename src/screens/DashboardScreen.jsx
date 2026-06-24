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
