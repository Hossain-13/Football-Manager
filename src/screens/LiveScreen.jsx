import React, { useState } from 'react';
import { Icon } from '../components/Icon.jsx';
import { TeamDot, RoleGate, useNow } from '../components/core.jsx';
import { TimerDisplay, ScoreStepper, computeStandings } from '../components/signature.jsx';
import { DATA, keyFirst } from '../lib/dataView.js';
import { newId, buildDefaultMatches, isFinalMatch } from '../lib/format.js';

export function LiveScreen({ ctx }) {
  useNow(1000); // ticks the slot-time progress bar below (called before any early return)
  const s = ctx.session;
  const matches = ctx.matches;
  const sessionTeams = ctx.teams;
  const generateSchedule = () => ctx.setMatches(buildDefaultMatches(ctx.session.id, sessionTeams, ctx.session.slotMinutes));

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
  const teamGoals = (tid) => goals.filter((g) => g.teamId === tid);
  const addGoal = (teamId, scorerId) => {
    ctx.saveGoals?.([...goals, { id: newId('goal'), matchId: live.id, teamId, scorerId, minute: 0 }]);
    setTagFor(null);
  };

  // Lowering a team's score should also drop its most recent scorer tag, so tags and the number
  // stay in sync (previously the tag lingered after a minus). deleteGoals removes it for everyone.
  const changeScore = (team, side, val) => {
    const cur = live[side] || 0;
    const next = Math.max(0, val);
    if (next < cur) {
      const tg = teamGoals(team.id);
      if (tg.length) ctx.deleteGoals?.([tg[tg.length - 1].id]);
    }
    ctx.updateMatch(live.id, { [side]: next });
  };

  // Knockout final: once every round-robin fixture is done, the final's teams resolve to the real
  // Top 1 vs Top 2. We compute that at the moment the last fixture is finished (its 'done' status
  // isn't in state yet, so fold it in by hand) and write it onto the pre-seeded final row.
  const finish = async () => {
    const ok = await ctx.confirm({
      title: 'Full time?',
      message: `Log ${A.name} ${live.scoreA}–${live.scoreB} ${B.name} as final and move on to the next match?`,
      confirmLabel: 'Full time',
    });
    if (!ok) return;
    const idx = matches.findIndex((m) => m.id === live.id);
    ctx.updateMatch(live.id, { status: 'done' });
    const next = matches.find((m, i) => i > idx && m.status === 'scheduled')
      || matches.find((m) => m.id !== live.id && m.status === 'scheduled');
    if (!next) return;
    if (isFinalMatch(next)) {
      const played = matches.map((m) => (m.id === live.id ? { ...m, status: 'done' } : m)).filter((m) => !isFinalMatch(m));
      const table = computeStandings(played, sessionTeams, ctx.session.scoring);
      const [top1, top2] = table;
      if (top1 && top2) ctx.updateMatch(next.id, { teamA: top1.teamId, teamB: top2.teamId, scoreA: 0, scoreB: 0, status: 'live' });
      else ctx.updateMatch(next.id, { status: 'live' });
    } else {
      ctx.updateMatch(next.id, { status: 'live' });
    }
  };

  const queue = matches.filter((m) => m.status === 'scheduled').slice(0, 2);

  // Slot-time progress. The clock only starts AT kickoff: end = kickoff + slot length + 30 min
  // grace. Before kickoff the bar sits empty and just shows the full window remaining (it does NOT
  // count the wait until kickoff). Just the time left (no labels); fill shifts calm → amber → red.
  const slotStartMs = new Date(s.slotStart).getTime();
  const slotWindowMs = ((Number(s.slotMinutes) || 0) + 30) * 60000;
  const slotElapsedMs = Math.max(0, Date.now() - slotStartMs); // 0 until kickoff
  const slotLeftMs = Math.max(0, slotWindowMs - slotElapsedMs);
  const slotPct = slotWindowMs > 0 ? Math.min(100, (slotElapsedMs / slotWindowMs) * 100) : 0;
  const slotEnded = slotWindowMs > 0 && slotElapsedMs >= slotWindowMs;
  const slotLeftText = slotEnded ? 'Slot ended' : (() => {
    const tot = Math.ceil(slotLeftMs / 60000), h = Math.floor(tot / 60), m = tot % 60;
    return h > 0 ? `${h}hr ${m} mins left` : `${m} mins left`;
  })();
  const slotColor = (slotEnded || slotLeftMs < slotWindowMs * 0.15) ? 'var(--coral)'
    : slotLeftMs < slotWindowMs * 0.4 ? 'var(--amber)' : 'var(--accent)';

  const TagButton = ({ T }) => (
    <RoleGate can={canControl} reason="Captains only" inline>
      <button className="btn btn--ghost btn--sm" onClick={() => setTagFor(tagFor === T.id ? null : T.id)}><Icon name="plus" className="ico" /> Tag</button>
    </RoleGate>
  );
  const ChipList = ({ T }) => (
    <>{teamGoals(T.id).map((g) => (
      <span key={g.id} className="tag">{g.scorerId ? keyFirst(g.scorerId) : 'OG'}</span>
    ))}</>
  );
  const TagPicker = ({ T }) => (tagFor === T.id ? (
    <div className="row wrap" style={{ gap: 6, marginTop: 10, padding: 8, background: 'rgba(0,0,0,.2)', borderRadius: 10 }}>
      {(DATA.teamPlayers[T.id] || []).map((pid) => <button key={pid} className="btn btn--sm" onClick={() => addGoal(T.id, pid)}>{keyFirst(pid)}</button>)}
    </div>
  ) : null);

  return (
    <div className="page">
      <div className="row between wrap" style={{ marginBottom: 14, gap: 10 }}>
        <span className="mono muted" style={{ fontSize: 12.5 }}>{isFinalMatch(live) ? 'FINAL' : `MATCH ${live.matchNo} of ${matches.length}`}</span>
        <div className="row" style={{ gap: 8 }}>
          {canControl ? <span className="pill pill--live"><span className="dot" /> {controlLabel}</span>
            : <span className="pill"><Icon name="lock" className="ico" style={{ width: 13, height: 13 }} /> VIEW ONLY</span>}
        </div>
      </div>

      <div className="slot-progress">
        <div className="slot-progress__head">
          <span className="slot-progress__time"><Icon name="clock" className="ico" style={{ width: 13, height: 13 }} /> {slotLeftText}</span>
        </div>
        <div className="slot-progress__track"><span style={{ width: slotPct + '%', background: slotColor }} /></div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '1fr', gap: 16 }}>
        <div className="card card--pad live-hero">
          <div>
            <ScoreStepper team={A} score={live.scoreA} can={canControl} onChange={(v) => changeScore(A, 'scoreA', v)} tagSlot={<TagButton T={A} />} chipsSlot={<ChipList T={A} />} />
            <TagPicker T={A} />
          </div>
          <TimerDisplay
            match={live}
            can={canControl}
            reason={reason}
            onTimerChange={(patch) => ctx.updateMatch(live.id, patch)}
          />
          <div>
            <ScoreStepper team={B} score={live.scoreB} can={canControl} onChange={(v) => changeScore(B, 'scoreB', v)} tagSlot={<TagButton T={B} />} chipsSlot={<ChipList T={B} />} />
            <TagPicker T={B} />
          </div>
        </div>

        <div className="card card--pad row between wrap" style={{ gap: 12 }}>
          <RoleGate can={canControl} reason="Captains only" inline>
            <button className="btn btn--accent" onClick={finish}><Icon name="check" className="ico" /> Full time &amp; next</button>
          </RoleGate>
          {!canControl && <span className="row" style={{ gap: 6, color: 'var(--amber)', fontSize: 12.5 }}><Icon name="lock" className="ico" /> Admins, organizers, or captains can control</span>}
        </div>

        {/* next match queue */}
        <div className="card card--pad">
          <div className="section-title">Up next</div>
          <div className="stack" style={{ gap: 8 }}>
            {queue.map((m) => {
              const fin = isFinalMatch(m);
              const a = DATA.team(m.teamA), b = DATA.team(m.teamB);
              return (
                <div key={m.id} className="row between" style={{ padding: '10px 12px', background: 'rgba(0,0,0,.18)', borderRadius: 10 }}>
                  <span className="row" style={{ gap: 10 }}>
                    <span className="fixture__no" style={{ fontSize: 15 }}>{fin ? '🏆' : String(m.matchNo).padStart(2, '0')}</span>
                    {fin
                      ? <span style={{ fontWeight: 600 }}>Final · Top 1 vs Top 2</span>
                      : <>
                          <span className="row" style={{ gap: 6, fontWeight: 600 }}><TeamDot color={a.color} />{a.name}</span>
                          <span className="muted">vs</span>
                          <span className="row" style={{ gap: 6, fontWeight: 600 }}><TeamDot color={b.color} />{b.name}</span>
                        </>}
                  </span>
                  <span className="muted mono" style={{ fontSize: 11 }}>{fin ? 'FINAL' : 'QUEUED'}</span>
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
