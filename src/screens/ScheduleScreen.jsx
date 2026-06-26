import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../components/Icon.jsx';
import { TeamDot, StatusPill, RoleGate } from '../components/core.jsx';
import { StandingsTable, computeStandings } from '../components/signature.jsx';
import { DATA } from '../lib/dataView.js';
import { timeOfDay, buildDefaultMatches, shuffleMatches, isFinalMatch, expectedPairKeys, matchPairKey, matchStarted } from '../lib/format.js';

export const MIN_TEAMS_OK = 4; // recommended minimum number of teams; we allow >=2 with a warning.

/* Fixtures + table now live on one page (a single nav destination was two empty-most-of-the-time
   screens). The `defaultTab` prop is which one a given nav entry opens to; an effect re-syncs
   the toggle when that prop changes so the Schedule vs Standings nav items (sidebar + More sheet)
   each land on their own tab even though they share this component instance. */
export function ScheduleScreen({ ctx, defaultTab = 'fixtures' }) {
  const s = ctx.session;
  const matches = ctx.matches;
  const org = ctx.canManage;
  const sessionTeams = ctx.teams;
  const [tab, setTab] = useState(defaultTab);
  useEffect(() => { setTab(defaultTab); }, [defaultTab]);
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const dragFrom = useRef(null);
  // The knockout final isn't a draggable fixture — only the round-robin matches reorder, and the
  // final stays pinned at the end (its sentinel match number is preserved).
  const rrMatches = matches.filter((m) => !isFinalMatch(m));
  const finalMatch = matches.find(isFinalMatch);
  const rrComplete = rrMatches.length > 0 && rrMatches.every((m) => m.status === 'done');
  // Live standings used both for the Table tab and to show who'd contest the final.
  const finalTable = finalMatch ? computeStandings(rrMatches, sessionTeams, s.scoring) : [];

  // Kickoff times are derived from each match's OWN stored duration, accumulated from the slot
  // start — so they stay correct even if a captain overrides one match's length in the live timer.
  const slot0 = new Date(s.slotStart).getTime();
  const ordered = [...rrMatches, ...(finalMatch ? [finalMatch] : [])];
  const t = (idx) => {
    let startMs = slot0;
    for (let k = 0; k < idx; k++) startMs += ((ordered[k]?.durationSeconds) || 900) * 1000;
    const endMs = startMs + ((ordered[idx]?.durationSeconds) || 900) * 1000;
    return timeOfDay(new Date(startMs).toISOString()) + ' – ' + timeOfDay(new Date(endMs).toISOString());
  };
  const matchMins = Math.round(((matches[0]?.durationSeconds) || 900) / 60);

  // Drag-to-reorder: hold a fixture's grip and drop it on another. Only SCHEDULED matches move
  // (never a live/finished one); renumbering re-derives the kickoff times. Indices are into the
  // round-robin list shown below; the final is reattached afterwards unchanged.
  const reorderTo = (from, to) => {
    if (!org || from == null || to == null || from === to) return;
    if (rrMatches[from]?.status !== 'scheduled' || rrMatches[to]?.status !== 'scheduled') return;
    const next = [...rrMatches];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    ctx.setMatches([...next.map((m, k) => ({ ...m, matchNo: k + 1 })), ...(finalMatch ? [finalMatch] : [])]);
  };
  const rowAt = (x, y) => { const el = document.elementFromPoint(x, y); const r = el && el.closest('[data-fx]'); return r ? r.getAttribute('data-fx') : null; };
  const startDrag = (e, idx, id) => {
    if (!org || rrMatches[idx].status !== 'scheduled') return;
    e.preventDefault();
    dragFrom.current = idx; setDragId(id);
    const onMove = (ev) => setOverId(rowAt(ev.clientX, ev.clientY));
    const onUp = (ev) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const toId = rowAt(ev.clientX, ev.clientY);
      if (toId) reorderTo(dragFrom.current, rrMatches.findIndex((m) => m.id === toId));
      dragFrom.current = null; setDragId(null); setOverId(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Does the current schedule already cover exactly the current teams (every pair once, no extras)?
  // If not (first time, a team was added/removed, or stale/duplicate rows), "Generate" rebuilds
  // from Team Builder. If it already matches, "Generate" just reshuffles the play order.
  const expected = expectedPairKeys(sessionTeams);
  const actual = rrMatches.map(matchPairKey);
  const scheduleMatchesTeams = matches.length > 0
    && rrMatches.length === expected.length
    && expected.every((k) => actual.includes(k));

  // One button. Builds a proper round-robin (+ final for 3+ teams) sized to the slot; pressed again
  // once the schedule already fits the teams, it ONLY reshuffles the play order — nothing else.
  const onGenerate = async () => {
    if (!org) return;
    if (sessionTeams.length < 2) { ctx.alert('Add at least 2 teams in Team Builder first.'); return; }
    if (!scheduleMatchesTeams) {
      if (matches.length) {
        const ok = await ctx.confirm({ title: 'Generate a fresh schedule?', message: 'Builds a new round-robin from your current teams (each team plays each once) plus a final. This replaces the existing fixtures and resets scores.', confirmLabel: 'Generate', danger: true });
        if (!ok) return;
      }
      ctx.setMatches(buildDefaultMatches(s.id, sessionTeams, s.slotMinutes));
    } else {
      ctx.setMatches(shuffleMatches(matches));
    }
  };

  const TeamWarn = () => (sessionTeams.length >= 2 && sessionTeams.length < MIN_TEAMS_OK ? (
    <div className="surface" style={{ padding: '10px 14px', marginBottom: 14, borderColor: 'var(--amber)', color: 'var(--amber)', fontSize: 13 }}>
      Only {sessionTeams.length} team{sessionTeams.length === 1 ? '' : 's'} — {MIN_TEAMS_OK}+ makes for a better round-robin. You can still play with 2.
    </div>
  ) : null);

  const TabToggle = () => (
    <div className="seg" role="tablist" aria-label="Schedule or standings">
      <button type="button" role="tab" aria-selected={tab === 'fixtures'} className={tab === 'fixtures' ? 'on' : ''} onClick={() => setTab('fixtures')}>Fixtures</button>
      <button type="button" role="tab" aria-selected={tab === 'table'} className={tab === 'table' ? 'on' : ''} onClick={() => setTab('table')}>Table</button>
    </div>
  );

  if (!matches.length) {
    return (
      <div className="page page--narrow">
        <p className="muted" style={{ margin: '4px 0 16px', fontSize: 14 }}>No fixtures yet — generate them from the teams.</p>
        <div className="card card--pad">
          <TeamWarn />
          <RoleGate can={org && sessionTeams.length >= 2} reason="Organizers can generate the schedule (need at least 2 teams)">
            <button className="btn btn--accent btn--block" onClick={onGenerate}><Icon name="plus" className="ico" /> Generate schedule</button>
          </RoleGate>
        </div>
      </div>
    );
  }

  return (
    <div className="page page--narrow">
      <div className="row between wrap" style={{ marginBottom: 16, gap: 12 }}>
        <TabToggle />
        {tab === 'fixtures' ? (
          <RoleGate can={org} reason="Organizers only" inline>
            <button className="btn btn--sm" onClick={onGenerate}>
              <Icon name="shuffle" className="ico" /> {scheduleMatchesTeams ? 'Shuffle order' : 'Generate schedule'}
            </button>
          </RoleGate>
        ) : (
          matches.some(matchStarted) && <span className="pill pill--live"><span className="dot" /> UPDATING LIVE</span>
        )}
      </div>

      <div key={tab} className="tab-pane">
        {tab === 'fixtures' ? (
          <>
            <p className="muted" style={{ margin: '0 0 16px', fontSize: 14 }}>{matches.length} matches · {matchMins} min each{org ? ' · drag the grip to reorder fixtures' : ''}.</p>
            <TeamWarn />
            <div className="card">
              {rrMatches.map((m, i) => {
                const A = DATA.team(m.teamA), B = DATA.team(m.teamB);
                const draggable = org && m.status === 'scheduled';
                const isDragging = dragId === m.id;
                const isOver = overId === m.id && dragId && dragId !== m.id && m.status === 'scheduled';
                const started = matchStarted(m); // LIVE look only once the clock has actually run
                return (
                  <div key={m.id} data-fx={m.id}
                    className={'fixture' + (started ? ' is-live' : '')}
                    style={{ opacity: isDragging ? 0.4 : 1, boxShadow: isOver ? 'inset 0 2px 0 var(--accent)' : undefined, transition: 'opacity .1s' }}>
                    <div className="row" style={{ gap: 8 }}>
                      {draggable
                        ? <button className="icobtn" title="Drag to reorder" onPointerDown={(e) => startDrag(e, i, m.id)}
                            style={{ width: 24, height: 28, cursor: 'grab', touchAction: 'none', color: 'var(--chalk-faint)' }}>
                            <Icon name="grip" size={16} />
                          </button>
                        : <span style={{ width: 24, display: 'inline-block' }} />}
                      <div className="fixture__no">{String(m.matchNo).padStart(2, '0')}</div>
                    </div>
                    <div>
                      <div className="fixture__teams">
                        <span className="row" style={{ gap: 6 }}><TeamDot color={A.color} /> {A.name}</span>
                        <span className="muted" style={{ fontSize: 13 }}>vs</span>
                        <span className="row" style={{ gap: 6 }}><TeamDot color={B.color} /> {B.name}</span>
                      </div>
                      <div className="fixture__time">{t(i)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {m.status === 'done' && <div className="fixture__score">{m.scoreA}–{m.scoreB}</div>}
                      {started && <StatusPill status="live" />}
                      {m.status === 'live' && !started && <span className="muted mono" style={{ fontSize: 11 }}>UP NEXT</span>}
                      {m.status === 'scheduled' && <span className="muted mono" style={{ fontSize: 11 }}>UPCOMING</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {finalMatch && (() => {
              const resolved = finalMatch.status !== 'scheduled';
              // Reveal the real contenders ONLY once every round-robin match is played and the
              // table is final. Before that, no live-standings peeking — just placeholders.
              const reveal = resolved || rrComplete;
              const fa = reveal ? (resolved ? DATA.team(finalMatch.teamA) : finalTable[0]) : null;
              const fb = reveal ? (resolved ? DATA.team(finalMatch.teamB) : finalTable[1]) : null;
              const nameOf = (x) => (!x ? null : (x.name || x.teamName));
              return (
                <div className="card card--pad final-card" style={{ marginTop: 14 }}>
                  <div className="row between wrap" style={{ gap: 10 }}>
                    <span className="final-card__badge">🏆 FINAL</span>
                    {finalMatch.status === 'done' ? <span className="fixture__score">{finalMatch.scoreA}–{finalMatch.scoreB}</span>
                      : finalMatch.status === 'live' ? <StatusPill status="live" />
                      : <span className="muted mono" style={{ fontSize: 11 }}>{rrComplete ? 'READY' : 'AWAITING RESULTS'}</span>}
                  </div>
                  <div className="fixture__teams" style={{ marginTop: 10 }}>
                    <span className="row" style={{ gap: 6 }}>{fa ? <><TeamDot color={fa.color} /> {nameOf(fa)}</> : 'Top 1'}</span>
                    <span className="muted" style={{ fontSize: 13 }}>vs</span>
                    <span className="row" style={{ gap: 6 }}>{fb ? <><TeamDot color={fb.color} /> {nameOf(fb)}</> : 'Top 2'}</span>
                  </div>
                  <div className="fixture__time" style={{ marginTop: 4 }}>{t(rrMatches.length)}</div>
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
                    {reveal ? 'Top 2 of the table face off for the title.' : 'Decided once every match is played.'}
                  </div>
                </div>
              );
            })()}
          </>
        ) : (
          <>
            <p className="muted" style={{ margin: '0 0 16px', fontSize: 14 }}>Auto-sorted live as results come in.</p>
            <StandingsTable matches={rrMatches} teams={sessionTeams} scoring={ctx.session.scoring} qualifiers={2} />
          </>
        )}
      </div>
    </div>
  );
}
