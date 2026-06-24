import React from 'react';
import { StatusPill, TeamDot } from '../components/core.jsx';
import { DATA, keyFirst } from '../lib/dataView.js';
import { dateLabel } from '../lib/format.js';

export function HistoryScreen({ ctx }) {
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
