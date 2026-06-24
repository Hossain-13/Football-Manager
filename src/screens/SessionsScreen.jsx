import React, { useState } from 'react';
import { Icon } from '../components/Icon.jsx';
import { SessionCard, Field } from '../components/core.jsx';
import { DATA, memberCount } from '../lib/dataView.js';
import { dateLabel, timeOfDay, taka } from '../lib/format.js';
import { USE_SUPABASE } from '../lib/supabase.js';
import { createSession, peekSession, joinSession } from '../lib/liveDb.js';

export function AddSessionModal({ ctx, onClose }) {
  const localNow = () => { const d = new Date(Date.now() + 24 * 3600 * 1000); d.setMinutes(0); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  const [f, setF] = useState({ turfName: '', location: '', slotLocal: localNow(), slotMinutes: 90, playersPerSide: 5, totalFee: 0 });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const submit = () => {
    if (!f.turfName.trim()) { setErr('Turf name is required.'); return; }
    setBusy(true); setErr('');
    createSession({
      turfName: f.turfName.trim(), location: f.location.trim(),
      slotStart: new Date(f.slotLocal).toISOString(),
      slotMinutes: Number(f.slotMinutes) || 90, playersPerSide: Number(f.playersPerSide) || 5,
      totalFee: Number(f.totalFee) || 0,
      scoring: { win: 3, draw: 1, loss: 0, tiebreakers: ['GD', 'GF', 'H2H'] },
      createdBy: ctx.me,
    }).then((s) => { ctx.reload(); ctx.openSession(s.id); ctx.go('detail'); onClose(); })
      .catch((e) => { setErr(e.message || 'Could not create session.'); setBusy(false); });
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 460, textAlign: 'left' }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 22, margin: '0 0 14px' }}>New session</h2>
        <div className="stack">
          <Field label="Turf name"><input className="input" placeholder="e.g. Touchline Turf" value={f.turfName} onChange={(e) => set('turfName', e.target.value)} /></Field>
          <Field label="Location"><input className="input" placeholder="Area, city" value={f.location} onChange={(e) => set('location', e.target.value)} /></Field>
          <div className="grid-2">
            <Field label="Kick-off"><input className="input" type="datetime-local" value={f.slotLocal} onChange={(e) => set('slotLocal', e.target.value)} /></Field>
            <Field label="Slot length (min)"><input className="input" type="number" value={f.slotMinutes} onChange={(e) => set('slotMinutes', e.target.value)} /></Field>
            <Field label="Players per side"><input className="input" type="number" value={f.playersPerSide} onChange={(e) => set('playersPerSide', e.target.value)} /></Field>
            <Field label="Total fee (BDT)"><input className="input" type="number" value={f.totalFee} onChange={(e) => set('totalFee', e.target.value)} /></Field>
          </div>
          {err && <p className="muted" style={{ color: 'var(--amber)', fontSize: 12.5, margin: 0 }}>{err}</p>}
          <div className="row" style={{ gap: 8, marginTop: 4 }}>
            <button className="btn btn--accent grow" disabled={busy} onClick={submit}>{busy ? 'Creating...' : 'Create session'}</button>
            <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          </div>
          <p className="muted" style={{ fontSize: 11.5, margin: 0 }}>You'll be the creator and get a share code for others to join.</p>
        </div>
      </div>
    </div>
  );
}

export function JoinConfirmModal({ peek, busy, onCancel, onConfirm }) {
  const feePer = peek.totalFee ? Math.round(peek.totalFee / ((peek.memberCount || 0) + 1)) : 0;
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-card" style={{ maxWidth: 400, textAlign: 'left' }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 22, margin: '0 0 4px' }}>{peek.turfName}</h2>
        <p className="muted" style={{ fontSize: 13, margin: '0 0 14px' }}>{peek.location || 'Confirm to join this matchday.'}</p>
        <div className="stack" style={{ gap: 8 }}>
          <div className="kv"><span className="kv__k">Creator</span><span className="kv__v">{peek.creatorName || '—'}</span></div>
          <div className="kv"><span className="kv__k">Kick-off</span><span className="kv__v">{dateLabel(peek.slotStart)} · {timeOfDay(peek.slotStart)}</span></div>
          <div className="kv"><span className="kv__k">Slot</span><span className="kv__v">{peek.slotMinutes} min</span></div>
          <div className="kv"><span className="kv__k">Fee / person</span><span className="kv__v num">{feePer ? taka(feePer) : '—'}</span></div>
        </div>
        {peek.clash && (
          <div className="gate-banner" style={{ marginTop: 12 }}><Icon name="clock" className="ico" /> <span>This overlaps another session you're in — joining is blocked.</span></div>
        )}
        {peek.alreadyMember && <p className="muted" style={{ color: 'var(--accent)', fontSize: 12.5, marginTop: 10 }}>You're already in this session.</p>}
        <div className="row" style={{ gap: 8, marginTop: 16 }}>
          <button className="btn btn--accent grow" disabled={busy || peek.clash} onClick={onConfirm}>{busy ? 'Joining...' : peek.alreadyMember ? 'Open' : 'Join session'}</button>
          <button className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export function SessionsScreen({ ctx }) {
  const upcoming = DATA.sessions.filter((s) => s.status !== 'done');
  const past = DATA.sessions.filter((s) => s.status === 'done');
  const [addOpen, setAddOpen] = useState(false);
  const [code, setCode] = useState('');
  const [peek, setPeek] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const live = USE_SUPABASE && Boolean(ctx.me);

  const doPeek = () => {
    if (!code.trim()) return;
    setBusy(true); setErr('');
    peekSession(code.trim())
      .then((p) => { setPeek(p); setBusy(false); })
      .catch((e) => { setErr(e.message === 'INVALID_CODE' ? 'No session found for that code.' : (e.message || 'Could not look up code.')); setBusy(false); });
  };
  const doJoin = () => {
    setBusy(true); setErr('');
    joinSession(code.trim())
      .then((s) => { setPeek(null); setCode(''); ctx.reload(); ctx.openSession(s.id); ctx.go('detail'); })
      .catch((e) => { setErr(e.message === 'TIME_CLASH' ? 'Time clash — you already have a session then.' : (e.message || 'Could not join.')); setBusy(false); });
  };

  return (
    <div className="page">
      <div className="row between wrap" style={{ marginBottom: 18, gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 30, margin: 0, letterSpacing: '.01em' }}>My Sessions</h1>
          <p className="muted" style={{ margin: '3px 0 0', fontSize: 14 }}>Matchdays you've created or joined.</p>
        </div>
        <button className="btn btn--accent" disabled={!live} onClick={() => setAddOpen(true)}><Icon name="plus" className="ico" /> New session</button>
      </div>

      {/* Join by code */}
      <div className="card card--pad" style={{ marginBottom: 22 }}>
        <div className="section-title">Join a session</div>
        <div className="row wrap" style={{ gap: 8 }}>
          <input className="input grow" placeholder="Enter share code, e.g. TURF-9F4KQ" value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && doPeek()} style={{ minWidth: 180 }} />
          <button className="btn" disabled={!live || busy || !code.trim()} onClick={doPeek}><Icon name="arrowR" className="ico" /> Look up</button>
        </div>
        {err && <p className="muted" style={{ color: 'var(--amber)', fontSize: 12.5, margin: '10px 0 0' }}>{err}</p>}
        {!live && <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>Sign in (Supabase mode) to join or create sessions.</p>}
      </div>

      <div className="section-title">Upcoming &amp; live</div>
      <div className="grid-auto" style={{ marginBottom: 28 }}>
        {upcoming.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Nothing upcoming.</div>}
        {upcoming.map((s) => <SessionCard key={s.id} session={s} count={memberCount(s.id)} onOpen={() => { ctx.openSession(s.id); ctx.go('detail'); }} />)}
      </div>

      <div className="section-title">Past</div>
      <div className="grid-auto">
        {past.length === 0 && <div className="muted" style={{ fontSize: 13 }}>No past sessions.</div>}
        {past.map((s) => <SessionCard key={s.id} session={s} count={memberCount(s.id)} onOpen={() => { ctx.openSession(s.id); ctx.go('history'); }} />)}
      </div>

      {addOpen && <AddSessionModal ctx={ctx} onClose={() => setAddOpen(false)} />}
      {peek && <JoinConfirmModal peek={peek} busy={busy} onCancel={() => setPeek(null)} onConfirm={doJoin} />}
    </div>
  );
}
