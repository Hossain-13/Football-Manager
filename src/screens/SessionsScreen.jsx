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

export function JoinByCodeModal({ code, setCode, busy, err, onClose, onLookup }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 380, textAlign: 'left' }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 22, margin: '0 0 6px' }}>Join a session</h2>
        <p className="muted" style={{ fontSize: 13, margin: '0 0 14px' }}>Enter the share code the organizer sent you.</p>
        <Field label="Share code">
          <input className="input" autoFocus placeholder="e.g. TURF-9F4KQ" value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && onLookup()} />
        </Field>
        {err && <p className="muted" style={{ color: 'var(--amber)', fontSize: 12.5, margin: '10px 0 0' }}>{err}</p>}
        <div className="row" style={{ gap: 8, marginTop: 14 }}>
          <button className="btn btn--accent grow" disabled={busy || !code.trim()} onClick={onLookup}>{busy ? 'Looking up...' : 'Look up'}</button>
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
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
  const [joinOpen, setJoinOpen] = useState(false);
  const [code, setCode] = useState('');
  const [peek, setPeek] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const live = USE_SUPABASE && Boolean(ctx.me);

  const doPeek = () => {
    if (!code.trim()) return;
    setBusy(true); setErr('');
    peekSession(code.trim())
      .then((p) => { setPeek(p); setBusy(false); setJoinOpen(false); })
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
      <p className="muted" style={{ margin: '0 0 18px', fontSize: 14 }}>Matchdays you've created or joined.</p>

      {/* Two distinct, unmistakable entry points — never blend create and join into one box. */}
      <div className="entry-grid" style={{ marginBottom: live ? 22 : 8 }}>
        <div className="card card--pad entry-card">
          <div className="icon-badge entry-card__badge"><Icon name="plus" className="ico" /></div>
          <div className="entry-card__title">Create a session</div>
          <button className="btn btn--accent btn--block" disabled={!live} onClick={() => setAddOpen(true)}><Icon name="plus" className="ico" /> New session</button>
        </div>

        <div className="card card--pad entry-card entry-card--join">
          <div className="icon-badge icon-badge--sky entry-card__badge"><Icon name="arrowR" className="ico" /></div>
          <div className="entry-card__title">Join a session</div>
          <button className="btn btn--accent btn--block" disabled={!live} onClick={() => { setErr(''); setJoinOpen(true); }}><Icon name="arrowR" className="ico" /> Join session</button>
        </div>
      </div>
      {!live && <p className="muted" style={{ fontSize: 12, margin: '0 0 22px' }}>Sign in (Supabase mode) to join or create sessions.</p>}

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
      {joinOpen && <JoinByCodeModal code={code} setCode={setCode} busy={busy} err={err} onClose={() => setJoinOpen(false)} onLookup={doPeek} />}
      {peek && <JoinConfirmModal peek={peek} busy={busy} onCancel={() => setPeek(null)} onConfirm={doJoin} />}
    </div>
  );
}
