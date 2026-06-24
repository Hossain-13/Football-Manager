import React, { useState, useRef } from 'react';
import { Icon } from '../components/Icon.jsx';
import { Avatar, TeamDot, Armband, StatusPill, GateBanner, RoleGate, Field } from '../components/core.jsx';
import { FormationPitch } from '../components/signature.jsx';
import { DATA, isGuestKey, keyFirst } from '../lib/dataView.js';
import { timeOfDay, buildDefaultMatches } from '../lib/format.js';
import { createTeam, deleteTeam, saveTeams, saveTeamPlayers } from '../lib/liveDb.js';

export const TEAM_PALETTE = ['#E5484D', '#3E7BFA', '#F5A623', '#9B6DFF', '#15C2A8', '#E5A0FF', '#FF8A4C', '#3DD68C'];

export function TeamsScreen({ ctx }) {
  const s = ctx.session;
  const [assign, setAssign] = ctx.assign;
  const [caps, setCaps] = ctx.captains;
  const [av] = ctx.availability;
  const teams = ctx.teams;
  const locked = ctx.locked;
  const editable = ctx.canManage && !locked;
  const [sel, setSel] = useState(null);
  const [dropCol, setDropCol] = useState(null);
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  const dragId = useRef(null);

  // Pool = everyone who marked IN (members AND guests), not yet on a team. Members are
  // keyed by profile id; guests by 'g:<name>'. Derived, not stored.
  const inIds = av
    .filter((a) => a.sessionId === s.id && a.status === 'available')
    .map((a) => a.profileId || ('g:' + (a.guestName || '')))
    .filter((k) => k !== 'g:');
  const teamBuckets = {}; teams.forEach((t) => { teamBuckets[t.id] = (assign[t.id] || []).slice(); });
  const assignedSet = new Set(Object.values(teamBuckets).flat());
  const poolIds = inIds.filter((id) => !assignedSet.has(id));
  const colData = (colId) => (colId === 'pool' ? poolIds : (teamBuckets[colId] || []));
  const teamOf = (id) => (teams.find((t) => teamBuckets[t.id].includes(id))?.id || 'pool');

  const move = (id, to) => {
    if (!editable) return;
    const from = teamOf(id);
    if (from === to) { setSel(null); return; }
    const next = {}; teams.forEach((t) => { next[t.id] = teamBuckets[t.id].slice(); });
    if (from !== 'pool') next[from] = next[from].filter((x) => x !== id);
    if (to !== 'pool') next[to] = [...(next[to] || []), id];
    setAssign({ pool: [], ...next }); // persists team_players; pool is derived
    setSel(null);
  };
  const onDrop = (to) => { if (dragId.current) move(dragId.current, to); dragId.current = null; setDropCol(null); };

  // Randomise: auto-create teams from the IN count, then evenly distribute IN players.
  const randomise = async () => {
    if (!editable || busy) return;
    const all = inIds.slice();
    if (all.length < 2) { window.alert('Mark at least 2 players IN on the Availability page first.'); return; }
    const perSide = s.playersPerSide || 5;
    const N = Math.max(2, Math.min(10, Math.round(all.length / perSide) || 2));
    setBusy(true);
    try {
      const list = teams.slice();
      for (let i = list.length; i < N; i++) {
        const t = await createTeam(s.id, 'Team ' + String.fromCharCode(65 + i), TEAM_PALETTE[i % TEAM_PALETTE.length]);
        list.push(t);
      }
      for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
      const buckets = {}; list.forEach((t) => { buckets[t.id] = []; });
      all.forEach((id, i) => buckets[list[i % N].id].push(id));
      await saveTeamPlayers(buckets);
      await saveTeams(list, {}); // reset captains; managers re-pick
      ctx.reload();
    } catch (e) { window.alert(e.message || 'Randomise failed'); }
    setBusy(false);
  };

  const addTeam = async () => {
    if (!teamName.trim() || busy) return;
    setBusy(true);
    try { await createTeam(s.id, teamName.trim(), TEAM_PALETTE[teams.length % TEAM_PALETTE.length]); ctx.reload(); setTeamName(''); setAddOpen(false); }
    catch (e) { window.alert(e.message || 'Could not add team'); }
    setBusy(false);
  };
  const removeTeam = async (teamId, name) => {
    if (busy || !window.confirm(`Remove ${name}? Its players return to the pool.`)) return;
    setBusy(true);
    try { await deleteTeam(teamId); ctx.reload(); }
    catch (e) { window.alert(e.message || 'Could not remove team'); }
    setBusy(false);
  };

  const Player = ({ id, teamId }) => {
    const cap = caps[teamId] === id;
    const guest = isGuestKey(id);
    return (
      <div className={'drag-player' + (cap ? ' is-cap' : '') + (sel && sel.id === id ? ' ' : '')}
        draggable={editable}
        onDragStart={() => { dragId.current = id; }}
        onClick={() => { if (!editable) return; setSel(sel && sel.id === id ? null : { id }); }}
        style={{ outline: sel && sel.id === id ? '2px solid var(--accent)' : 'none' }}
        title={editable ? 'Drag to a team, or tap then tap a team' : ''}>
        <Avatar id={guest ? undefined : id} name={guest ? keyFirst(id) : undefined} size={26} color={guest ? 'var(--raise)' : undefined} />
        <span className="grow row" style={{ gap: 5, fontSize: 13.5, fontWeight: 600 }}>{keyFirst(id)}{guest && <span className="tag tag--guest" style={{ fontSize: 9 }}>GUEST</span>}</span>
        {cap && <Armband />}
        {teamId !== 'pool' && editable && !guest && (
          <button className="icobtn" style={{ width: 24, height: 24, border: 'none', background: 'transparent', color: cap ? 'var(--amber)' : 'var(--chalk-faint)' }}
            title="Make captain" onClick={(e) => { e.stopPropagation(); setCaps({ ...caps, [teamId]: cap ? undefined : id }); }}>
            <Icon name="flag" className="ico" style={{ width: 15, height: 15 }} />
          </button>
        )}
      </div>
    );
  };

  const Column = ({ id, team }) => {
    const players = colData(id);
    const isPool = id === 'pool';
    return (
      <div className="team-col">
        <div className="team-col__head">
          {team ? <TeamDot color={team.color} /> : <Icon name="squad" className="ico" style={{ color: 'var(--chalk-faint)' }} />}
          <span className="team-col__name">{team ? team.name : 'Pool (IN)'}</span>
          <span className="tag" style={{ marginLeft: 'auto' }}>{players.length}</span>
          {sel && !isPool && editable && <button className="btn btn--sm" onClick={() => move(sel.id, id)}>Move here</button>}
          {!isPool && editable && <button className="icobtn" style={{ width: 22, height: 22 }} title="Remove team" onClick={() => removeTeam(id, team.name)}><Icon name="x" className="ico" style={{ width: 13, height: 13 }} /></button>}
        </div>
        <div className={'team-col__body' + (dropCol === id ? ' drop-on' : '')}
          onDragOver={(e) => { if (editable) { e.preventDefault(); setDropCol(id); } }}
          onDragLeave={() => setDropCol(null)}
          onDrop={() => onDrop(id)}>
          {players.map((pid) => <Player key={pid} id={pid} teamId={id} />)}
          {players.length === 0 && <div className="muted" style={{ fontSize: 12.5, textAlign: 'center', padding: 8 }}>{isPool ? 'No one in the pool' : 'Drop players here'}</div>}
        </div>
      </div>
    );
  };

  return (
    <div className="page">
      <div className="row between wrap" style={{ marginBottom: 16, gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 30, margin: 0 }}>Team Builder</h1>
          <p className="muted" style={{ margin: '3px 0 0', fontSize: 14 }}>Pool = players marked IN. Drag into teams · tap the flag to set a captain (C).</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {!ctx.canManage ? <span className="pill"><Icon name="lock" className="ico" style={{ width: 13, height: 13 }} /> VIEW ONLY</span> :
            locked ? <StatusPill status="locked" /> :
            <>
              <button className="btn" disabled={busy} onClick={() => setAddOpen(true)}><Icon name="plus" className="ico" /> Add team</button>
              <button className="btn btn--accent" disabled={busy} onClick={randomise}><Icon name="shuffle" className="ico" /> {busy ? 'Working...' : 'Randomise'}</button>
            </>}
        </div>
      </div>

      {!ctx.canManage && <div style={{ marginBottom: 16 }}><GateBanner reason="View only — the creator and organizers build teams and assign captains." /></div>}
      {ctx.canManage && locked && <div style={{ marginBottom: 16 }}><GateBanner locked reason="Locked — within 1h of kick-off, lineups are frozen for players." /></div>}

      <div className="builder">
        <Column id="pool" team={null} />
        <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))' }}>
          {teams.map((t) => <Column key={t.id} id={t.id} team={t} />)}
        </div>
      </div>
      {teams.length === 0 && ctx.canManage && <div className="muted" style={{ marginTop: 14, fontSize: 13 }}>No teams yet — press “Randomise” to auto-create from the IN pool, or “Add team”.</div>}

      {addOpen && (
        <div className="modal-backdrop" onClick={() => setAddOpen(false)}>
          <div className="modal-card" style={{ maxWidth: 360, textAlign: 'left' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 20, margin: '0 0 12px' }}>New team</h2>
            <Field label="Team name"><input className="input" autoFocus placeholder="e.g. Reds" value={teamName} onChange={(e) => setTeamName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTeam()} /></Field>
            <div className="row" style={{ gap: 8, marginTop: 12 }}>
              <button className="btn btn--accent grow" disabled={busy || !teamName.trim()} onClick={addTeam}>{busy ? 'Adding...' : 'Add team'}</button>
              <button className="btn btn--ghost" onClick={() => setAddOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- FORMATION BOARD ---------------- */
export function FormationScreen({ ctx }) {
  const teams = ctx.teams;
  const [assign] = ctx.assign;
  const [caps] = ctx.captains;
  const [tid, setTid] = useState(teams[0]?.id || '');
  if (!teams.length) {
    return (
      <div className="page page--narrow">
        <div className="card card--pad">
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 28, margin: '0 0 8px' }}>No teams yet</h1>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>Create teams before opening the formation board.</p>
        </div>
      </div>
    );
  }
  const me = ctx.me || DATA.currentUserId;
  const isCapOf = (t) => t && (caps[t.id] === me || t.captainId === me);
  const teamRoster = (t) => (assign[t.id] && assign[t.id].length ? assign[t.id] : (DATA.teamPlayers[t.id] || []));
  const isOnTeam = (t) => teamRoster(t).includes(me) || isCapOf(t);
  // Visibility: the CREATOR sees ALL teams; organizers / general users see ONLY their own team.
  const visibleTeams = ctx.isAdmin ? teams : teams.filter(isOnTeam);
  if (!visibleTeams.length) {
    return (
      <div className="page page--narrow">
        <div className="card card--pad">
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 26, margin: '0 0 8px' }}>Not on a team yet</h1>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>Your team's formation board appears here once an organizer assigns you to a team in Team Builder.</p>
        </div>
      </div>
    );
  }
  const activeTid = visibleTeams.some((t) => t.id === tid) ? tid : visibleTeams[0].id;
  const team = visibleTeams.find((t) => t.id === activeTid);
  const players = teamRoster(team);
  const side = ctx.side;
  // EDIT = CAPTAIN of THIS team only (creator/organizer/general user can all be a captain, never a
  // guest). Captains have full edit rights always — formation never locks, even on game day.
  const canEdit = isCapOf(team);

  return (
    <div className="page page--narrow">
      <div className="row between wrap" style={{ marginBottom: 14, gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 30, margin: 0 }}>Formation</h1>
          <p className="muted" style={{ margin: '3px 0 0', fontSize: 14 }}>Tactical board — drag tokens, pick a preset. No more MS Paint.</p>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <div className="seg" title="Players per side">
            {[5, 6, 7].map((n) => (
              <button key={n} className={side === n ? 'on' : ''} onClick={() => ctx.setSide(n)}>{n}-a-side</button>
            ))}
          </div>
          {!canEdit && <span className="pill"><Icon name="lock" className="ico" style={{ width: 13, height: 13 }} /> VIEW ONLY</span>}
        </div>
      </div>

      <div className="row wrap" style={{ gap: 8, marginBottom: 18 }}>
        {visibleTeams.map((t) => {
          const cap = isCapOf(t);
          return (
            <button key={t.id} className={'preset' + (t.id === activeTid ? ' on' : '')} onClick={() => setTid(t.id)}
              style={t.id === activeTid ? { background: t.color, color: '#fff', borderColor: 'transparent' } : {}}>
              <span className="row" style={{ gap: 7 }}><TeamDot color={t.id === activeTid ? '#fff' : t.color} /> {t.name}{cap && ' · C'}</span>
            </button>
          );
        })}
      </div>

      <div className="card card--pad">
        <FormationPitch team={team} playerIds={players} captainId={caps[activeTid] || team.captainId} side={side}
          saved={team.formation} onSave={(formation) => ctx.saveFormation(activeTid, formation)} locked={!canEdit}
          key={activeTid + '-' + side + (canEdit ? '' : '-' + JSON.stringify(team.formation || {}))} />
      </div>
    </div>
  );
}

/* ---------------- SCHEDULE ---------------- */
export const MIN_TEAMS_OK = 4; // recommended minimum number of teams; we allow >=2 with a warning.

export function ScheduleScreen({ ctx }) {
  const s = ctx.session;
  const matches = ctx.matches;
  const org = ctx.canManage;
  const sessionTeams = ctx.teams;
  const [refreshing, setRefreshing] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const dragFrom = useRef(null);
  const perMatch = matches.length ? Math.round(s.slotMinutes / matches.length) : 0;
  const slot0 = new Date(s.slotStart).getTime();
  const t = (i) => { const a = new Date(slot0 + i * perMatch * 60000); const b = new Date(slot0 + (i + 1) * perMatch * 60000); return timeOfDay(a.toISOString()) + ' – ' + timeOfDay(b.toISOString()); };

  // Refresh = pull the latest fixtures (realtime already auto-syncs; this is the manual fallback).
  const doRefresh = async () => { if (refreshing) return; setRefreshing(true); try { await ctx.reload(); } finally { setTimeout(() => setRefreshing(false), 450); } };

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

  const generate = (rebuild) => {
    if (!org) return;
    if (sessionTeams.length < 2) { window.alert('Add at least 2 teams in Team Builder first.'); return; }
    if (rebuild && !window.confirm('Rebuild fixtures from the current teams? This resets all match scores.')) return;
    ctx.setMatches(buildDefaultMatches(s.id, sessionTeams));
  };

  const TeamWarn = () => (sessionTeams.length >= 2 && sessionTeams.length < MIN_TEAMS_OK ? (
    <div className="surface" style={{ padding: '10px 14px', marginBottom: 14, borderColor: 'var(--amber)', color: 'var(--amber)', fontSize: 13 }}>
      Only {sessionTeams.length} team{sessionTeams.length === 1 ? '' : 's'} — {MIN_TEAMS_OK}+ makes for a better round-robin. You can still play with 2.
    </div>
  ) : null);

  if (!matches.length) {
    return (
      <div className="page page--narrow">
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 30, margin: 0 }}>Match Schedule</h1>
          <p className="muted" style={{ margin: '3px 0 0', fontSize: 14 }}>No fixtures yet — generate them from the teams.</p>
        </div>
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
        <div>
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 30, margin: 0 }}>Match Schedule</h1>
          <p className="muted" style={{ margin: '3px 0 0', fontSize: 14 }}>{matches.length} matches · {perMatch} min each{org ? ' · drag the grip to reorder fixtures' : ''}.</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn--ghost btn--sm" onClick={doRefresh} disabled={refreshing} title="Sync fixtures">
            <span className={refreshing ? 'spin' : ''} style={{ display: 'inline-flex' }}><Icon name="refresh" size={14} /></span>
            {refreshing ? ' Syncing…' : ' Refresh'}
          </button>
          <RoleGate can={org} reason="Organizers only" inline>
            <button className="btn btn--sm" onClick={() => generate(true)}><Icon name="shuffle" className="ico" /> Rebuild</button>
          </RoleGate>
        </div>
      </div>

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
    </div>
  );
}
