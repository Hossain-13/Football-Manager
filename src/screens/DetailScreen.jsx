import React, { useState } from 'react';
import { Icon } from '../components/Icon.jsx';
import { StatusPill, GateBanner, RoleGate, Field } from '../components/core.jsx';
import { dateLabel, timeOfDay } from '../lib/format.js';
import { updateSession, deleteSession } from '../lib/liveDb.js';

export function TiebreakChips({ order, setOrder, disabled }) {
  const labels = { GD: 'Goal Difference', GF: 'Goals For', H2H: 'Head-to-Head' };
  const move = (i, dir) => {
    const j = i + dir; if (j < 0 || j >= order.length) return;
    const next = order.slice(); [next[i], next[j]] = [next[j], next[i]]; setOrder(next);
  };
  return (
    <div className="row wrap" style={{ gap: 8 }}>
      {order.map((k, i) => (
        <div key={k} className="row" style={{ gap: 6, padding: '7px 8px 7px 12px', background: 'rgba(0,0,0,.25)', border: '1px solid var(--line)', borderRadius: 999 }}>
          <span className="num muted" style={{ fontSize: 12 }}>{i + 1}</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{labels[k]}</span>
          <div className="row" style={{ gap: 2 }}>
            <button className="icobtn" style={{ width: 24, height: 24 }} disabled={disabled || i === 0} onClick={() => move(i, -1)}><Icon name="chevron" className="ico" style={{ width: 13, height: 13, transform: 'rotate(180deg)' }} /></button>
            <button className="icobtn" style={{ width: 24, height: 24 }} disabled={disabled || i === order.length - 1} onClick={() => move(i, 1)}><Icon name="chevron" className="ico" style={{ width: 13, height: 13 }} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DetailScreen({ ctx }) {
  const s = ctx.session;
  const org = ctx.canManage;
  // organizer selection now lives on the Availability page (creator-only).
  const canDelete = ctx.isAdmin && (new Date(s.slotStart).getTime() - Date.now() > 24 * 3600 * 1000);
  const [confirmDel, setConfirmDel] = useState(false);
  const [delBusy, setDelBusy] = useState(false);
  const doDelete = () => {
    setDelBusy(true);
    deleteSession(s.id).then(() => { ctx.reload(); ctx.go('sessions'); })
      .catch((e) => { setDelBusy(false); setConfirmDel(false); window.alert(e.message || 'Delete failed (locked within 24h of kick-off).'); });
  };

  const [tb, setTb] = useState(s.scoring.tiebreakers);
  const [pts, setPts] = useState({ win: s.scoring.win, draw: s.scoring.draw, loss: s.scoring.loss });
  const toLocal = (iso) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  const [bf, setBf] = useState({ turfName: s.turfName, location: s.location, slotLocal: toLocal(s.slotStart), slotMinutes: s.slotMinutes, playersPerSide: s.playersPerSide, totalFee: s.totalFee });
  const setB = (k, v) => setBf((p) => ({ ...p, [k]: v }));
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');
  const saveSettings = () => {
    setSavingSettings(true); setSettingsMsg('');
    updateSession(s.id, {
      turfName: bf.turfName.trim(), location: bf.location.trim(),
      slotStart: new Date(bf.slotLocal).toISOString(),
      slotMinutes: Number(bf.slotMinutes) || 90, playersPerSide: Number(bf.playersPerSide) || 5,
      totalFee: Number(bf.totalFee) || 0,
      scoring: { win: pts.win, draw: pts.draw, loss: pts.loss, tiebreakers: tb },
    }).then(() => { ctx.reload(); setSavingSettings(false); setSettingsMsg('Saved'); setTimeout(() => setSettingsMsg(''), 1800); })
      .catch((e) => { setSavingSettings(false); setSettingsMsg(e.message || 'Save failed'); });
  };
  const liveCount = ctx.matches.filter((m) => m.status === 'live').length;
  const doneCount = ctx.matches.filter((m) => m.status === 'done').length;
  const perMatch = ctx.matches.length ? Math.round(s.slotMinutes / ctx.matches.length) : 0;

  const Stat = ({ k, v, sub }) => (
    <div className="surface" style={{ padding: '14px 16px' }}>
      <div className="muted mono" style={{ fontSize: 10, letterSpacing: '.1em' }}>{k}</div>
      <div className="num" style={{ fontSize: 26, marginTop: 2 }}>{v}</div>
      {sub && <div className="muted" style={{ fontSize: 11.5 }}>{sub}</div>}
    </div>
  );
  const PtStep = ({ label, val, on }) => (
    <div className="surface" style={{ padding: 12, textAlign: 'center' }}>
      <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</div>
      <div className="row" style={{ justifyContent: 'center', gap: 10, marginTop: 6 }}>
        <button className="icobtn" disabled={!org || val === 0} onClick={() => on(val - 1)} style={{ width: 30, height: 30 }}><Icon name="minus" className="ico" style={{ width: 15, height: 15 }} /></button>
        <span className="num" style={{ fontSize: 26, minWidth: 22 }}>{val}</span>
        <button className="icobtn" disabled={!org} onClick={() => on(val + 1)} style={{ width: 30, height: 30 }}><Icon name="plus" className="ico" style={{ width: 15, height: 15 }} /></button>
      </div>
    </div>
  );

  return (
    <div className="page page--narrow">
      <div className="row between" style={{ marginBottom: 8 }}>
        <div className="row" style={{ gap: 10 }}><StatusPill status={s.status} /><span className="tag">{s.playersPerSide}-A-SIDE</span>{ctx.locked && <StatusPill status="locked" />}</div>
        <button className="btn btn--ghost btn--sm" onClick={() => ctx.go('sessions')}>All sessions</button>
      </div>
      <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 32, margin: '6px 0 2px' }}>{s.turfName}</h1>
      <div className="row muted" style={{ gap: 6, fontSize: 14, marginBottom: 14 }}><Icon name="location" className="ico" style={{ width: 15, height: 15 }} />{s.location}</div>

      <div className="row between wrap" style={{ gap: 10, marginBottom: 20 }}>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <span className="muted mono" style={{ fontSize: 10, letterSpacing: '.12em' }}>SHARE CODE</span>
          <span className="tag" style={{ fontFamily: 'var(--f-mono)', letterSpacing: '.06em', fontSize: 12.5 }}>{s.joinCode || '—'}</span>
          {s.joinCode && navigator.clipboard && <button className="btn btn--ghost btn--sm" onClick={() => navigator.clipboard.writeText(s.joinCode)}>Copy</button>}
        </div>
        {ctx.isAdmin && (
          <button className="btn btn--ghost btn--sm" disabled={!canDelete} onClick={() => setConfirmDel(true)}
            title={canDelete ? 'Delete this session' : 'Locked: cannot delete within 24h of kick-off'}>
            <Icon name="x" className="ico" /> Delete session
          </button>
        )}
      </div>

      <div className="grid-3" style={{ marginBottom: 22 }}>
        <Stat k="KICK-OFF" v={timeOfDay(s.slotStart)} sub={dateLabel(s.slotStart)} />
        <Stat k="SLOT" v={s.slotMinutes + ' min'} sub={`${ctx.matches.length} matches · ${perMatch} min each`} />
        <Stat k="PROGRESS" v={`${doneCount}/${ctx.matches.length}`} sub={liveCount ? 'Match in play' : 'Matches done'} />
      </div>

      {ctx.isAdmin ? <GateBanner reason="You’re the creator — manage this session; choose organizers on the Availability page." /> :
        org && <GateBanner reason="You’re an organizer — matchday controls are editable." />}

      <div className="card card--pad" style={{ marginTop: 16 }}>
        <div className="section-title">Booking details</div>
        <div className="grid-2">
          <Field label="Turf name"><input className="input" value={bf.turfName} disabled={!org} onChange={(e) => setB('turfName', e.target.value)} /></Field>
          <Field label="Location"><input className="input" value={bf.location} disabled={!org} onChange={(e) => setB('location', e.target.value)} /></Field>
          <Field label="Slot start"><input className="input" type="datetime-local" value={bf.slotLocal} disabled={!org} onChange={(e) => setB('slotLocal', e.target.value)} /></Field>
          <Field label="Slot length (min)"><input className="input" type="number" value={bf.slotMinutes} disabled={!org} onChange={(e) => setB('slotMinutes', e.target.value)} /></Field>
          <Field label="Players per side"><input className="input" type="number" value={bf.playersPerSide} disabled={!org} onChange={(e) => setB('playersPerSide', e.target.value)} /></Field>
          <Field label="Total fee (BDT)"><input className="input" type="number" value={bf.totalFee} disabled={!org} onChange={(e) => setB('totalFee', e.target.value)} /></Field>
        </div>
      </div>

      <div className="card card--pad" style={{ marginTop: 16 }}>
        <div className="section-title">Scoring rules</div>
        <div className="grid-3" style={{ marginBottom: 18 }}>
          <PtStep label="Win" val={pts.win} on={(v) => org && setPts({ ...pts, win: Math.max(0, v) })} />
          <PtStep label="Draw" val={pts.draw} on={(v) => org && setPts({ ...pts, draw: Math.max(0, v) })} />
          <PtStep label="Loss" val={pts.loss} on={(v) => org && setPts({ ...pts, loss: Math.max(0, v) })} />
        </div>
        <div className="field"><label>Tiebreaker order</label>
          <TiebreakChips order={tb} setOrder={setTb} disabled={!org} />
        </div>
      </div>

      <RoleGate can={org} reason="Only the creator or organizers can edit this session">
        <div className="row" style={{ gap: 12, marginTop: 18, alignItems: 'center' }}>
          <button className="btn btn--accent btn--lg" disabled={savingSettings} onClick={saveSettings}>
            <Icon name="check" className="ico" /> {savingSettings ? 'Saving...' : 'Save changes'}
          </button>
          {settingsMsg && <span className="pill pill--paid">{settingsMsg}</span>}
        </div>
      </RoleGate>

      {confirmDel && (
        <div className="modal-backdrop" onClick={() => !delBusy && setConfirmDel(false)}>
          <div className="modal-card" style={{ maxWidth: 380, textAlign: 'left' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 21, margin: '0 0 6px' }}>Delete this session?</h2>
            <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.5, margin: '0 0 18px' }}>
              <b style={{ color: 'var(--chalk)' }}>{s.turfName}</b> and everything in it (teams, matches, expenses) will be removed for <b style={{ color: 'var(--chalk)' }}>all joined players</b>. This can't be undone.
            </p>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn grow" style={{ background: 'var(--red, #E5484D)', color: '#fff', borderColor: 'transparent' }} disabled={delBusy} onClick={doDelete}>
                {delBusy ? 'Deleting...' : 'Delete session'}
              </button>
              <button className="btn btn--ghost" disabled={delBusy} onClick={() => setConfirmDel(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
