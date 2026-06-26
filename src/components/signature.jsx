import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Icon } from './Icon.jsx';
import { TeamDot, Avatar, StatusPill, useNow } from './core.jsx';
import { DATA, isGuestKey, keyFirst, keyName } from '../lib/dataView.js';
import { mmss, pad } from '../lib/format.js';

// Initials for the formation token bead — identical to the Profile/Avatar abbreviation: members
// use DATA.initials(id); guests fall back to first letters of their name (same as <Avatar/>).
const initialsOf = (k) => {
  if (isGuestKey(k)) {
    const n = k.slice(2);
    return (n.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('') || '?').toUpperCase();
  }
  return DATA.initials(k);
};

export function computeStandings(matches, teams, scoring) {
  const rows = {};
  teams.forEach((t) => { rows[t.id] = { teamId: t.id, teamName: t.name, color: t.color, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 }; });
  const h2h = {};
  matches.filter((m) => m.status === 'done').forEach((m) => {
    const a = rows[m.teamA], b = rows[m.teamB]; if (!a || !b) return;
    a.p++; b.p++; a.gf += m.scoreA; a.ga += m.scoreB; b.gf += m.scoreB; b.ga += m.scoreA;
    const key = (x, y) => x + '>' + y;
    if (m.scoreA > m.scoreB) { a.w++; b.l++; a.pts += scoring.win; b.pts += scoring.loss; h2h[key(m.teamA, m.teamB)] = (h2h[key(m.teamA, m.teamB)] || 0) + 1; }
    else if (m.scoreA < m.scoreB) { b.w++; a.l++; b.pts += scoring.win; a.pts += scoring.loss; h2h[key(m.teamB, m.teamA)] = (h2h[key(m.teamB, m.teamA)] || 0) + 1; }
    else { a.d++; b.d++; a.pts += scoring.draw; b.pts += scoring.draw; }
  });
  const arr = Object.values(rows);
  arr.forEach((r) => { r.gd = r.gf - r.ga; });
  arr.sort((x, y) => {
    for (const tb of ['PTS', ...scoring.tiebreakers]) {
      if (tb === 'PTS' && y.pts !== x.pts) return y.pts - x.pts;
      if (tb === 'GD' && y.gd !== x.gd) return y.gd - x.gd;
      if (tb === 'GF' && y.gf !== x.gf) return y.gf - x.gf;
      if (tb === 'H2H') { const d = (h2h[y.teamId + '>' + x.teamId] || 0) - (h2h[x.teamId + '>' + y.teamId] || 0); if (d) return d; }
    }
    if (y.pts !== x.pts) return y.pts - x.pts;
    return y.gd - x.gd;
  });
  return arr;
}

export function StandingsTable({ matches, teams, scoring, qualifiers = 2 }) {
  const rows = useMemo(() => computeStandings(matches, teams, scoring), [matches, teams, scoring]);
  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <table className="standings">
        <thead>
          <tr>
            <th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.teamId} className={i < qualifiers ? 'qualify' : ''}>
              <td>
                <div className="col-team">
                  <span className="pos">{i + 1}</span>
                  <TeamDot color={r.color} />
                  <span style={{ fontWeight: 600 }}>{r.teamName}</span>
                </div>
              </td>
              <td>{r.p}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td><td>{r.gf}</td><td>{r.ga}</td>
              <td className={r.gd > 0 ? 'gd-pos' : r.gd < 0 ? 'gd-neg' : ''}>{r.gd > 0 ? '+' : ''}{r.gd}</td>
              <td className="pts">{r.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row" style={{ gap: 8, padding: '10px 14px', borderTop: '1px solid var(--line)', fontSize: 12 }}>
        <span className="team-dot" style={{ background: 'var(--accent)', width: 9, height: 9 }} />
        <span className="muted">Top {qualifiers} qualify · sorted by Pts, then {scoring.tiebreakers.join(' › ')}</span>
      </div>
    </div>
  );
}

/* ---------- TIMER (linear digits + bar, Start/Reset side by side) ---------- */
export function TimerDisplay({ match, can, reason, onTimerChange }) {
  // The clock is DERIVED from the match row so every viewer sees the same time, live-synced:
  //   elapsed = paused_accum_seconds + (started_at ? now - started_at : 0)
  // started_at set => running. Controls only patch those fields (surgical, captain-allowed).
  const dur = match.durationSeconds || 900;
  useNow(250); // re-render so the digits tick
  const banked = match.pausedAccumSeconds || 0;
  const startedMs = match.startedAt ? new Date(match.startedAt).getTime() : null;
  let elapsed = startedMs ? banked + (Date.now() - startedMs) / 1000 : banked;
  if (elapsed > dur) elapsed = dur;
  const running = !!startedMs && elapsed < dur;
  const done = elapsed >= dur;
  const remaining = dur - elapsed;
  const pct = Math.min(100, (elapsed / dur) * 100);
  // Same calm -> amber -> red color language as the Availability lock ring: the closer to full
  // time, the more urgency the bar fill carries.
  const fillColor = done ? 'var(--coral)' : pct >= 85 ? 'var(--coral)' : pct >= 60 ? 'var(--amber)' : 'var(--accent)';

  const start = () => { if (can) onTimerChange?.({ startedAt: new Date().toISOString(), pausedAccumSeconds: Math.floor(elapsed), status: 'live' }); };
  const pause = () => { if (can) onTimerChange?.({ startedAt: null, pausedAccumSeconds: Math.floor(elapsed), status: 'live' }); };
  const reset = () => { if (can) onTimerChange?.({ startedAt: null, pausedAccumSeconds: 0, status: 'live' }); };

  // Manual match length: tap the minutes or seconds (only before the clock has started) and type
  // the value you want. Sets durationSeconds + resets the clock to that length. No magic, just input.
  const [edit, setEdit] = useState(null); // 'min' | 'sec' | null
  const [draft, setDraft] = useState('');
  const editable = can && elapsed < 1 && !running && !done;
  const beginEdit = (which) => { if (!editable) return; setDraft(String(which === 'min' ? Math.floor(dur / 60) : dur % 60)); setEdit(which); };
  const commitEdit = () => {
    if (edit) {
      let mins = Math.floor(dur / 60), secs = dur % 60;
      const v = Math.max(0, parseInt(draft, 10) || 0);
      if (edit === 'min') mins = Math.min(180, v); else secs = Math.min(59, v);
      const newDur = Math.max(10, mins * 60 + secs);
      onTimerChange?.({ durationSeconds: newDur, startedAt: null, pausedAccumSeconds: 0, status: 'live' });
    }
    setEdit(null);
  };
  const editInput = (which) => (
    <input className="timer-lin__edit" type="number" inputMode="numeric" autoFocus value={draft}
      onChange={(e) => setDraft(e.target.value)} onBlur={commitEdit}
      onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEdit(null); }} />
  );

  return (
    <div className="timer-lin">
      <div className="timer-lin__meta">
        {running ? <StatusPill status="live" /> : done ? <StatusPill status="done" /> : <span className="pill">Paused</span>}
        <span className="mono muted" style={{ fontSize: 11 }}>MATCH {match.matchNo} · {Math.round(dur / 60)} MIN</span>
      </div>
      <div className="timer-lin__digits">
        {edit === 'min' ? editInput('min')
          : <span className={editable ? 'timer-lin__part' : ''} onClick={() => beginEdit('min')}>{pad(Math.floor(remaining / 60))}</span>}
        <span className="timer-lin__colon">:</span>
        {edit === 'sec' ? editInput('sec')
          : <span className={editable ? 'timer-lin__part' : ''} onClick={() => beginEdit('sec')}>{pad(Math.floor(remaining % 60))}</span>}
      </div>
      {editable && edit === null && <div className="muted" style={{ fontSize: 11, marginTop: -4 }}>Tap the time to set the match length.</div>}
      <div className="timer-lin__bar"><span style={{ width: pct + '%', background: fillColor }} /></div>
      <div className="timer-lin__ctl">
        <button className="btn btn--accent" disabled={!can || done} onClick={running ? pause : start}>
          <Icon name={running ? 'pause' : 'play'} className="ico" /> {running ? 'Pause' : elapsed > 0 ? 'Resume' : 'Start'}
        </button>
        <button className="btn btn--ghost" disabled={!can} onClick={reset}><Icon name="reset" className="ico" /> Reset</button>
      </div>
      {!can && <div className="row" style={{ justifyContent: 'center', gap: 6, marginTop: 10, color: 'var(--amber)', fontSize: 12.5 }}>
        <Icon name="lock" className="ico" /> {reason || 'Only captains can control the clock'}
      </div>}
    </div>
  );
}

/* ---------- SCORE STEPPER ---------- */
/* tagSlot/chipsSlot are optional - LiveScreen flanks the score digit with a "+ Tag" button on
   one side and the scored players' chips on the other, on the same row as the number. */
export function ScoreStepper({ team, score, onChange, can, tagSlot, chipsSlot }) {
  return (
    <div className="scorebox">
      <div className="scorebox__row">
        <div className="scorebox__tag">{tagSlot}</div>
        <div className="scorebox__num" style={{ color: team.color }}>{score}</div>
        <div className="scorebox__chips">{chipsSlot}</div>
      </div>
      <div className="scorebox__team" style={{ justifyContent: 'center' }}>
        <TeamDot color={team.color} /> {team.name}
      </div>
      <div className="stepper" style={{ justifyContent: 'center' }}>
        <button onClick={() => can && onChange(Math.max(0, score - 1))} disabled={!can || score === 0}><Icon name="minus" className="ico" style={{ width: 20, height: 20 }} /></button>
        <button className="plus" onClick={() => can && onChange(score + 1)} disabled={!can}><Icon name="plus" className="ico" style={{ width: 20, height: 20 }} /></button>
      </div>
    </div>
  );
}

/* ---------- FORMATION presets ---------- */
export const PRESETS = {
  5: {
    '2-1-1': [['GK', 50, 90], ['LB', 30, 68], ['RB', 70, 68], ['CM', 50, 46], ['ST', 50, 22]],
    '1-2-1': [['GK', 50, 90], ['CB', 50, 70], ['LM', 30, 46], ['RM', 70, 46], ['ST', 50, 22]],
    '1-1-2': [['GK', 50, 90], ['CB', 50, 70], ['CM', 50, 48], ['LF', 34, 24], ['RF', 66, 24]],
  },
  6: {
    '2-2-1': [['GK', 50, 90], ['LB', 30, 70], ['RB', 70, 70], ['LM', 32, 46], ['RM', 68, 46], ['ST', 50, 22]],
    '1-2-2': [['GK', 50, 90], ['CB', 50, 72], ['LM', 30, 48], ['RM', 70, 48], ['LF', 34, 24], ['RF', 66, 24]],
    '3-1-1': [['GK', 50, 90], ['LB', 26, 70], ['CB', 50, 73], ['RB', 74, 70], ['CM', 50, 46], ['ST', 50, 22]],
  },
  7: {
    '2-3-1': [['GK', 50, 91], ['LB', 30, 72], ['RB', 70, 72], ['LM', 24, 48], ['CM', 50, 48], ['RM', 76, 48], ['ST', 50, 22]],
    '3-2-1': [['GK', 50, 91], ['LB', 26, 72], ['CB', 50, 74], ['RB', 74, 72], ['LM', 36, 48], ['RM', 64, 48], ['ST', 50, 22]],
    '2-2-2': [['GK', 50, 91], ['LB', 30, 72], ['RB', 70, 72], ['LM', 34, 50], ['RM', 66, 50], ['LF', 34, 24], ['RF', 66, 24]],
  },
};

export function PitchLines() {
  return (
    <svg className="pitch__lines" viewBox="0 0 68 105" preserveAspectRatio="none">
      <rect x="2" y="2" width="64" height="101" rx="1" />
      <line x1="2" y1="52.5" x2="66" y2="52.5" />
      <circle cx="34" cy="52.5" r="9" />
      <circle cx="34" cy="52.5" r="0.6" style={{ fill: 'rgba(242,239,230,.5)' }} />
      {/* top box */}
      <rect x="20" y="2" width="28" height="14" />
      <rect x="28" y="2" width="12" height="5" />
      <circle cx="34" cy="11" r="0.6" style={{ fill: 'rgba(242,239,230,.5)' }} />
      <path d="M26 16 A 9 9 0 0 0 42 16" />
      {/* bottom box */}
      <rect x="20" y="89" width="28" height="14" />
      <rect x="28" y="98" width="12" height="5" />
      <circle cx="34" cy="94" r="0.6" style={{ fill: 'rgba(242,239,230,.5)' }} />
      <path d="M26 89 A 9 9 0 0 1 42 89" />
    </svg>
  );
}

export function FormationPitch({ team, playerIds, captainId, side = 5, saved, onSave, locked }) {
  const presetMap = PRESETS[side] || PRESETS[5];
  const presetKeys = Object.keys(presetMap);
  const slotPos = (pk, i) => { const sl = presetMap[pk]; const s = sl[i] || sl[sl.length - 1]; return { x: s[1], y: s[2], label: s[0] }; };

  // hydrate from the saved board (preset + on-pitch list + x/y), falling back to defaults.
  const initPreset = (saved?.preset && presetMap[saved.preset]) ? saved.preset
    : (team.formationPreset && presetMap[team.formationPreset]) ? team.formationPreset : presetKeys[0];
  const [activePreset, setActivePreset] = useState(initPreset);
  const slots = presetMap[activePreset];

  const savedField = Array.isArray(saved?.field) ? saved.field.filter((k) => playerIds.includes(k)) : null;
  const [field, setField] = useState(() => (savedField && savedField.length ? savedField : playerIds.slice(0, slots.length)));
  const onPitch = field.filter((id) => playerIds.includes(id)).slice(0, slots.length);
  const full = onPitch.length >= slots.length;

  const [pos, setPos] = useState(() => {
    const obj = {};
    onPitch.forEach((pid, i) => { const sv = saved?.pos?.[pid]; obj[pid] = sv ? { x: sv.x, y: sv.y, label: sv.label || slotPos(activePreset, i).label } : slotPos(activePreset, i); });
    return obj;
  });

  // persist the whole board (atomic) after any change; locked viewers never write.
  const persist = (nextField, nextPos, nextPreset) => {
    if (locked || !onSave) return;
    const fieldList = nextField.filter((id) => playerIds.includes(id));
    const posOut = {};
    fieldList.forEach((pid) => { const p = nextPos[pid]; if (p) posOut[pid] = { x: Math.round(p.x), y: Math.round(p.y), label: p.label || '' }; });
    onSave({ preset: nextPreset, field: fieldList, pos: posOut });
  };

  const addToField = (pid) => {
    if (locked || full) return;
    const nf = [...onPitch, pid];
    const np = { ...pos, [pid]: slotPos(activePreset, onPitch.length) };
    setField(nf); setPos(np); persist(nf, np, activePreset);
  };
  const removeFromField = (pid) => {
    if (locked) return;
    const nf = onPitch.filter((x) => x !== pid);
    setField(nf); persist(nf, pos, activePreset);
  };

  const pitchRef = useRef(null);
  const drag = useRef(null);

  const onDown = (pid, e) => {
    if (locked) return;
    e.preventDefault();
    drag.current = pid;
    setPos((p) => ({ ...p, [pid]: { ...p[pid], drag: true } }));
  };
  const onMove = (e) => {
    if (!drag.current || !pitchRef.current) return;
    const r = pitchRef.current.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX);
    const cy = (e.touches ? e.touches[0].clientY : e.clientY);
    let x = ((cx - r.left) / r.width) * 100;
    let y = ((cy - r.top) / r.height) * 100;
    x = Math.max(7, Math.min(93, x)); y = Math.max(5, Math.min(95, y));
    setPos((p) => ({ ...p, [drag.current]: { ...p[drag.current], x, y } }));
  };
  const onUp = () => {
    if (drag.current) {
      setPos((p) => { const np = { ...p, [drag.current]: { ...p[drag.current], drag: false } }; persist(onPitch, np, activePreset); return np; });
    }
    drag.current = null;
  };
  useEffect(() => {
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  });

  const changePreset = (pk) => {
    const np = {}; onPitch.forEach((pid, i) => { np[pid] = slotPos(pk, i); });
    setActivePreset(pk); setPos(np); persist(onPitch, np, pk);
  };

  return (
    <div>
      <div className="row between wrap" style={{ marginBottom: 14, gap: 10 }}>
        <div className="row" style={{ gap: 9 }}>
          <TeamDot color={team.color} />
          <span style={{ fontFamily: 'var(--f-display)', fontSize: 18, fontWeight: 600 }}>{team.name}</span>
          <span className="tag">{side}-A-SIDE</span>
        </div>
        <div className="preset-row">
          {presetKeys.map((pk) => (
            <button key={pk} className={'preset' + (pk === activePreset ? ' on' : '')} disabled={locked} onClick={() => changePreset(pk)}>{pk}</button>
          ))}
        </div>
      </div>

      <div className={'pitch' + (locked ? ' locked-overlay' : '')} ref={pitchRef} style={{ background: `repeating-linear-gradient(0deg, ${team.color}0a 0 8.33%, rgba(0,0,0,.05) 8.33% 16.66%), linear-gradient(180deg,#0f5640,#0c4634)` }}>
        <PitchLines />
        {onPitch.map((pid) => {
          const p = pos[pid] || { x: 50, y: 50, label: '' };
          const cap = pid === captainId;
          return (
            <div key={pid} className={'token' + (p.drag ? ' dragging' : '')} style={{ left: p.x + '%', top: p.y + '%' }}
              onPointerDown={(e) => onDown(pid, e)}>
              <div className="token__bead" style={{ background: team.color }}>
                {initialsOf(pid)}
                {cap && <span className="token__cap">C</span>}
              </div>
              <div className="token__name">{keyFirst(pid)}</div>
            </div>
          );
        })}
      </div>

      <div className="row" style={{ gap: 7, marginTop: 12, justifyContent: 'center', fontSize: 12 }}>
        {locked
          ? <span className="row" style={{ gap: 6, color: 'var(--amber)' }}><Icon name="lock" className="ico" /> View only — captains edit their own team; organizers edit any</span>
          : <span className="muted row" style={{ gap: 6 }}><Icon name="pin" className="ico" /> Drag tokens to reposition · use the roster below to pick who's on the field</span>}
      </div>

      {/* team roster bar (FIFA-style): pick who's on the pitch */}
      <div style={{ marginTop: 16 }}>
        <div className="section-title" style={{ fontSize: 11 }}>Team roster {!locked && '· tap Add/Remove to set the field'}</div>
        <div className="stack" style={{ gap: 6 }}>
          {playerIds.length === 0 && <div className="muted" style={{ fontSize: 13 }}>No players assigned to this team yet — assign them in Team Builder.</div>}
          {playerIds.map((pid) => {
            const on = onPitch.includes(pid);
            const label = on ? (pos[pid]?.label || 'XI') : 'SUB';
            const cap = pid === captainId;
            return (
              <div key={pid} className="row" style={{ gap: 10, padding: '7px 10px', background: 'rgba(0,0,0,.2)', borderRadius: 10, border: '1px solid var(--line-soft)', opacity: on ? 1 : 0.65 }}>
                <span className="mono" style={{ width: 32, fontSize: 10.5, letterSpacing: '.05em', color: on ? 'var(--accent)' : 'var(--chalk-faint)' }}>{label}</span>
                <Avatar id={isGuestKey(pid) ? undefined : pid} name={isGuestKey(pid) ? keyFirst(pid) : undefined} size={24} color={isGuestKey(pid) ? 'var(--raise)' : undefined} />
                <span className="grow row" style={{ gap: 6, fontSize: 13.5, fontWeight: 600 }}>{keyName(pid)} {isGuestKey(pid) && <span className="tag tag--guest" style={{ fontSize: 9 }}>GUEST</span>} {cap && <span className="pill" style={{ color: 'var(--amber)', borderColor: 'var(--amber)', fontSize: 9.5, padding: '1px 6px' }}>C</span>}</span>
                {!locked && (on
                  ? <button className="btn btn--ghost btn--sm" onClick={() => removeFromField(pid)}>Remove</button>
                  : <button className="btn btn--sm" disabled={full} onClick={() => addToField(pid)}><Icon name="plus" className="ico" /> Add</button>)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
