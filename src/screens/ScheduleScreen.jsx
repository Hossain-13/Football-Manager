import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../components/Icon.jsx';
import { TeamDot, StatusPill, RoleGate } from '../components/core.jsx';
import { StandingsTable } from '../components/signature.jsx';
import { DATA } from '../lib/dataView.js';
import { timeOfDay, buildDefaultMatches } from '../lib/format.js';

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
  const perMatch = matches.length ? Math.round(s.slotMinutes / matches.length) : 0;
  const slot0 = new Date(s.slotStart).getTime();
  const t = (i) => { const a = new Date(slot0 + i * perMatch * 60000); const b = new Date(slot0 + (i + 1) * perMatch * 60000); return timeOfDay(a.toISOString()) + ' – ' + timeOfDay(b.toISOString()); };

  // Drag-to-reorder: hold a fixture's grip and drop it on another. Only SCHEDULED matches move
  // (never a live/finished one); renumbering re-derives the kickoff times.
  const reorderTo = (from, to) => {
    if (!org || from == null || to == null || from === to) return;
    if (matches[from]?.status !== 'scheduled' || matches[to]?.status !== 'scheduled') return;
    const next = [...matches];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    ctx.setMatches(next.map((m, k) => ({ ...m, matchNo: k + 1 })));
  };
  const rowAt = (x, y) => { const el = document.elementFromPoint(x, y); const r = el && el.closest('[data-fx]'); return r ? r.getAttribute('data-fx') : null; };
  const startDrag = (e, idx, id) => {
    if (!org || matches[idx].status !== 'scheduled') return;
    e.preventDefault();
    dragFrom.current = idx; setDragId(id);
    const onMove = (ev) => setOverId(rowAt(ev.clientX, ev.clientY));
    const onUp = (ev) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const toId = rowAt(ev.clientX, ev.clientY);
      if (toId) reorderTo(dragFrom.current, matches.findIndex((m) => m.id === toId));
      dragFrom.current = null; setDragId(null); setOverId(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const generate = async (rebuild) => {
    if (!org) return;
    if (sessionTeams.length < 2) { ctx.alert('Add at least 2 teams in Team Builder first.'); return; }
    if (rebuild) {
      const ok = await ctx.confirm({ title: 'Rebuild fixtures?', message: 'This regenerates the schedule from the current teams and resets all match scores.', confirmLabel: 'Rebuild', danger: true });
      if (!ok) return;
    }
    ctx.setMatches(buildDefaultMatches(s.id, sessionTeams));
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
            <button className="btn btn--accent btn--block" onClick={() => generate(false)}><Icon name="plus" className="ico" /> Generate schedule</button>
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
            <button className="btn btn--sm" onClick={() => generate(true)}><Icon name="shuffle" className="ico" /> Rebuild</button>
          </RoleGate>
        ) : (
          <span className="pill pill--live"><span className="dot" /> UPDATING LIVE</span>
        )}
      </div>

      <div key={tab} className="tab-pane">
        {tab === 'fixtures' ? (
          <>
            <p className="muted" style={{ margin: '0 0 16px', fontSize: 14 }}>{matches.length} matches · {perMatch} min each{org ? ' · drag the grip to reorder fixtures' : ''}.</p>
            <TeamWarn />
            <div className="card">
              {matches.map((m, i) => {
                const A = DATA.team(m.teamA), B = DATA.team(m.teamB);
                const draggable = org && m.status === 'scheduled';
                const isDragging = dragId === m.id;
                const isOver = overId === m.id && dragId && dragId !== m.id && m.status === 'scheduled';
                return (
                  <div key={m.id} data-fx={m.id}
                    className={'fixture' + (m.status === 'live' ? ' is-live' : '')}
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
                      {m.status === 'live' && <StatusPill status="live" />}
                      {m.status === 'scheduled' && <span className="muted mono" style={{ fontSize: 11 }}>UPCOMING</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <p className="muted" style={{ margin: '0 0 16px', fontSize: 14 }}>Auto-sorted live as results come in.</p>
            <StandingsTable matches={ctx.matches} teams={DATA.teams} scoring={ctx.session.scoring} qualifiers={2} />
          </>
        )}
      </div>
    </div>
  );
}
