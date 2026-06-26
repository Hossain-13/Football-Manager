import React, { useState, useRef } from 'react';
import { Icon } from '../components/Icon.jsx';
import { Avatar, TeamDot, Armband, StatusPill, GateBanner, Field } from '../components/core.jsx';
import { isGuestKey, keyFirst } from '../lib/dataView.js';
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
    if (all.length < 2) { ctx.alert('Mark at least 2 players IN on the IN/OUT page first.'); return; }
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
    } catch (e) { ctx.alert(e.message || 'Randomise failed'); }
    setBusy(false);
  };

  const addTeam = async () => {
    if (!teamName.trim() || busy) return;
    setBusy(true);
    try { await createTeam(s.id, teamName.trim(), TEAM_PALETTE[teams.length % TEAM_PALETTE.length]); ctx.reload(); setTeamName(''); setAddOpen(false); }
    catch (e) { ctx.alert(e.message || 'Could not add team'); }
    setBusy(false);
  };
  const removeTeam = async (teamId, name) => {
    if (busy) return;
    const ok = await ctx.confirm({ title: 'Remove team?', message: `${name} will be removed and its players return to the pool.`, confirmLabel: 'Remove', danger: true });
    if (!ok) return;
    setBusy(true);
    try { await deleteTeam(teamId); ctx.reload(); }
    catch (e) { ctx.alert(e.message || 'Could not remove team'); }
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
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>Pool = players marked IN. Drag into teams · tap the flag to set a captain (C).</p>
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
