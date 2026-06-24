import React, { useState } from 'react';
import { Icon } from '../components/Icon.jsx';
import { TeamDot, RoleGate } from '../components/core.jsx';
import { TimerDisplay, ScoreStepper } from '../components/signature.jsx';
import { DATA, keyFirst } from '../lib/dataView.js';
import { newId, buildDefaultMatches } from '../lib/format.js';

export function LiveScreen({ ctx }) {
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
