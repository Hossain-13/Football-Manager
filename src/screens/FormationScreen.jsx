import React, { useState } from 'react';
import { Icon } from '../components/Icon.jsx';
import { TeamDot } from '../components/core.jsx';
import { FormationPitch } from '../components/signature.jsx';
import { DATA } from '../lib/dataView.js';

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
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>Tactical board — drag tokens, pick a preset.</p>
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
