import React, { useState } from 'react';
import { Icon } from '../components/Icon.jsx';
import { Avatar, StatusPill, RoleGate, GateBanner, SessionCard, Countdown, Field } from '../components/core.jsx';
import { DATA } from '../lib/dataView.js';
import { dateLabel, timeOfDay, taka, newId } from '../lib/format.js';
import { USE_SUPABASE } from '../lib/supabase.js';
import { createSession, peekSession, joinSession, updateSession, deleteSession } from '../lib/liveDb.js';

export const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];
export function AuthScreen({ onDone, onGoogle, live = false, profile, error = '', busy = false }) {
  const [step, setStep] = useState(profile ? 'form' : 'start'); // start | form
  const [f, setF] = useState(profile?.firstName || ''); const [l, setL] = useState(profile?.lastName || '');
  const [contact, setContact] = useState(profile?.contact || '');
  const [pos1, setPos1] = useState(profile?.prefPos1 || ''); const [pos2, setPos2] = useState(profile?.prefPos2 || '');
  const [googleBusy, setGoogleBusy] = useState(false);
  const canEnter = f.trim() && contact.trim() && pos1 && pos2 && pos1 !== pos2;
  const submitProfile = () => onDone({ firstName: f.trim(), lastName: l.trim(), contact: contact.trim(), prefPos1: pos1, prefPos2: pos2 });
  const runGoogle = () => {
    if (!live) {
      setStep('form');
      return;
    }
    setGoogleBusy(true);
    Promise.resolve(onGoogle()).catch(() => setGoogleBusy(false));
  };
  const isBusy = busy || googleBusy;
  return (
    <div className="hero-auth pitch-bg">
      <div className="auth-card">
        <div className="row" style={{ justifyContent: 'center', gap: 12, marginBottom: 22 }}>
          <div className="brand__mark" style={{ width: 48, height: 48, fontSize: 28 }}>T</div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontFamily: 'var(--f-display)', fontSize: 30, fontWeight: 700, letterSpacing: '.12em', lineHeight: 1 }}>TURF</div>
            <div className="mono muted" style={{ fontSize: 10, letterSpacing: '.26em' }}>MATCHDAY MANAGER</div>
          </div>
        </div>

        {step === 'start' ? (
          <div className="card card--pad" style={{ textAlign: 'left' }}>
            <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 27, lineHeight: 1.1, margin: '4px 0 10px', textAlign: 'center' }}>Sort the squad.<br />Run the match.</h2>
            <p className="muted" style={{ textAlign: 'center', margin: '0 0 22px', fontSize: 14, lineHeight: 1.5 }}>Availability, balanced teams, live scores and the turf bill — for your crew’s pickup games.</p>
            {error && <p className="muted" style={{ color: 'var(--amber)', fontSize: 12.5, lineHeight: 1.45, margin: '0 0 12px', textAlign: 'center' }}>{error}</p>}
            <button className="gbtn" onClick={runGoogle} disabled={isBusy}>
              <Icon name="google" /> {isBusy ? 'Opening Google...' : 'Continue with Google'}
            </button>
            <div className="row" style={{ gap: 10, margin: '16px 0' }}>
              <div className="grow" style={{ height: 1, background: 'var(--line)' }} /><span className="muted mono" style={{ fontSize: 10 }}>FIRST TIME HERE</span><div className="grow" style={{ height: 1, background: 'var(--line)' }} />
            </div>
            <button className="btn btn--block" onClick={runGoogle} disabled={isBusy}>{isBusy ? 'Waiting for Google...' : 'Set up my profile'}</button>
          </div>
        ) : (
          <div className="card card--pad" style={{ textAlign: 'left' }}>
            <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 22, margin: '0 0 4px' }}>Welcome to the crew</h2>
            <p className="muted" style={{ margin: '0 0 18px', fontSize: 13.5 }}>Tell us your name and where you like to play.</p>
            <div className="stack">
              <Field label="First name"><input className="input" placeholder="John" value={f} onChange={(e) => setF(e.target.value)} /></Field>
              <Field label="Last name"><input className="input" placeholder="Doe" value={l} onChange={(e) => setL(e.target.value)} /></Field>
              <Field label="Contact (phone / handle)"><input className="input" placeholder="e.g. 01XXXXXXXXX" value={contact} onChange={(e) => setContact(e.target.value)} /></Field>
              <div className="grid-2">
                <Field label="Preferred position 1">
                  <select className="input" value={pos1} onChange={(e) => setPos1(e.target.value)}>
                    <option value="">Select…</option>
                    {POSITIONS.map((p) => <option key={p} value={p} disabled={p === pos2}>{p}</option>)}
                  </select>
                </Field>
                <Field label="Preferred position 2">
                  <select className="input" value={pos2} onChange={(e) => setPos2(e.target.value)}>
                    <option value="">Select…</option>
                    {POSITIONS.map((p) => <option key={p} value={p} disabled={p === pos1}>{p}</option>)}
                  </select>
                </Field>
              </div>
              <button className="btn btn--accent btn--block btn--lg" style={{ marginTop: 6 }} disabled={!canEnter} onClick={submitProfile}>Enter TURF <Icon name="arrowR" className="ico" /></button>
              {!profile && <button className="btn btn--ghost btn--block" onClick={() => setStep('start')}>Back</button>}
            </div>
          </div>
        )}
        <p className="muted" style={{ textAlign: 'center', fontSize: 11.5, marginTop: 16 }}>Sort the squad, run the match, split the bill — fair and simple.</p>
      </div>
    </div>
  );
}

/* ---------------- DASHBOARD ---------------- */
export function memberCount(sid) { return DATA.members.filter((m) => m.sessionId === sid).length; }

export const DashFlag = ({ label, tone }) => {
  const cls = tone === 'ok' ? 'pill pill--paid' : tone === 'warn' ? 'pill pill--due' : tone === 'out' ? 'pill pill--out' : 'pill';
  return <span className={cls} style={{ fontSize: 10.5 }}>{label}</span>;
};

export function DashboardScreen({ ctx }) {
  const me = ctx.me || DATA.currentUserId;
  const myName = DATA.first(me);
  const sessions = DATA.sessions;
  const stats = ctx.dashStats;
  const ongoing = sessions.filter((s) => s.status === 'live');
  const upcoming = sessions.filter((s) => s.status === 'upcoming');
  const recent = sessions.filter((s) => s.status === 'done').slice(0, 2);
  const open = (s) => { ctx.openSession(s.id); ctx.go(s.status === 'done' ? 'history' : 'detail'); };
  const iManage = (s) => s.createdBy === me || DATA.members.some((m) => m.sessionId === s.id && m.profileId === me && m.role === 'organizer');

  // per-session flags (Remember: it's a dashboard — quick status at a glance)
  const flagsFor = (s) => {
    const out = [];
    const mark = (stats?.myMarks || {})[s.id];
    const teams = (stats?.teamsBySession || {})[s.id];
    if (s.status !== 'done') {
      out.push(mark === 'available' ? { label: "You're IN", tone: 'ok' }
        : mark === 'out' ? { label: 'You marked OUT', tone: 'out' }
        : { label: 'Not marked', tone: 'warn' });
      out.push(teams?.count ? { label: `${teams.count} teams`, tone: 'ok' } : { label: 'No teams yet', tone: 'warn' });
      if (iManage(s) && teams?.count) {
        out.push(teams.withCaptain === teams.count
          ? { label: 'Captains set', tone: 'ok' }
          : { label: `${teams.withCaptain}/${teams.count} captains`, tone: 'warn' });
      }
    }
    return out;
  };

  const Row = ({ s }) => (
    <div className="card card--pad" style={{ cursor: 'pointer', marginBottom: 10 }} onClick={() => open(s)}>
      <div className="row between" style={{ gap: 10 }}>
        <div className="row" style={{ gap: 10, minWidth: 0 }}>
          <StatusPill status={s.status} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.turfName}</div>
            <div className="muted mono" style={{ fontSize: 10.5 }}>{dateLabel(s.slotStart)} · {timeOfDay(s.slotStart)} · {memberCount(s.id)} in</div>
          </div>
        </div>
        {iManage(s) && <span className="tag tag--org">{s.createdBy === me ? 'CREATOR' : 'ORGANIZER'}</span>}
      </div>
      <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
        {flagsFor(s).map((f, i) => <DashFlag key={i} label={f.label} tone={f.tone} />)}
      </div>
    </div>
  );

  const Group = ({ title, items, empty }) => (
    <div style={{ marginBottom: 22 }}>
      <div className="section-title">{title}</div>
      {items.length === 0 ? <div className="muted" style={{ fontSize: 13 }}>{empty}</div> : items.map((s) => <Row key={s.id} s={s} />)}
    </div>
  );

  const Stat = ({ k, v, c }) => (
    <div className="surface" style={{ padding: '14px 16px' }}>
      <div className="muted mono" style={{ fontSize: 10, letterSpacing: '.1em' }}>{k}</div>
      <div className="num" style={{ fontSize: 24, marginTop: 2, color: c }}>{v}</div>
    </div>
  );

  return (
    <div className="page">
      <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 30, margin: 0, letterSpacing: '.01em' }}>
        {myName && myName !== '—' ? `Hi, ${myName}` : 'Dashboard'}
      </h1>
      <p className="muted" style={{ margin: '3px 0 18px', fontSize: 14 }}>Your matchday activity at a glance.</p>

      <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', marginBottom: 22 }}>
        <Stat k="SESSIONS" v={sessions.length} />
        <Stat k="SPENT" v={stats ? taka(stats.totalSpent) : '—'} />
        <Stat k="OUTSTANDING" v={stats ? taka(stats.outstanding) : '—'} c={stats && stats.outstanding > 0 ? 'var(--amber)' : 'var(--accent)'} />
        <Stat k="GOALS LOGGED" v={stats ? stats.goalCount : '—'} />
      </div>

      {sessions.length === 0 && (
        <div className="card card--pad" style={{ marginBottom: 20 }}>
          <div className="section-title" style={{ margin: 0 }}>No sessions yet</div>
          <p className="muted" style={{ fontSize: 13.5 }}>Create a session or join one with a code.</p>
          <button className="btn btn--accent" onClick={() => ctx.go('sessions')}><Icon name="sessions" className="ico" /> Go to My Sessions</button>
        </div>
      )}

      <Group title="Ongoing" items={ongoing} empty="No live match right now." />
      <Group title="Upcoming" items={upcoming} empty="Nothing scheduled yet." />
      <Group title="Recent" items={recent} empty="No past sessions yet." />
    </div>
  );
}

/* ---------------- SESSIONS LIST (+ Join by code + Add session) ---------------- */
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

/* ---------------- SESSION DETAIL / EDIT ---------------- */
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

/* ---------------- AVAILABILITY POOL (+ creator's organizer picker) ---------------- */
export function AvailabilityScreen({ ctx }) {
  const s = ctx.session;
  if (!s) return null;
  const org = ctx.canManage;           // creator or organizer
  const isCreator = ctx.isAdmin;
  const me = ctx.me || DATA.currentUserId;
  const [av, setAv] = ctx.availability;
  const [members, setMembers] = ctx.members;
  const [guestName, setGuestName] = useState('');
  const [adding, setAdding] = useState(false);
  const [orgMsg, setOrgMsg] = useState('');

  const sessionAv = av.filter((a) => a.sessionId === s.id);
  const lockAt = new Date(s.slotStart).getTime() - 60 * 60 * 1000; // 1 hour before
  const myEntry = sessionAv.find((a) => a.profileId === me);
  const mine = myEntry?.status || null;
  const inList = sessionAv.filter((a) => a.status === 'available');
  const outList = sessionAv.filter((a) => a.status === 'out');

  // Each handler updates local state optimistically AND persists ONLY the changed row.
  const setRowStatus = (row, status) => {
    if (!org) return;
    setAv(av.map((a) => (a.id === row.id ? { ...a, status } : a)));
    ctx.saveAvailRow({ ...row, status });
  };
  const setMyStatus = (status) => {
    if (ctx.locked) return; // players are locked from 1h before; managers (ctx.locked=false) bypass
    if (myEntry) setAv(av.map((a) => (a.sessionId === s.id && a.profileId === me ? { ...a, status } : a)));
    else setAv([...av, { id: newId('av'), sessionId: s.id, profileId: me, status, addedBy: me }]);
    ctx.saveAvailRow({ profileId: me, status, addedBy: me });
  };
  const addGuest = () => {
    if (!guestName.trim()) return;
    const name = guestName.trim();
    setAv([...av, { id: newId('av'), sessionId: s.id, guestName: name, status: 'available', addedBy: me }]);
    setGuestName('');
    ctx.saveAvailRow({ guestName: name, status: 'available', addedBy: me });
  };
  const addExisting = (pid) => {
    if (sessionAv.some((a) => a.profileId === pid)) return;
    setAv([...av, { id: newId('av'), sessionId: s.id, profileId: pid, status: 'available', addedBy: me }]);
    ctx.saveAvailRow({ profileId: pid, status: 'available', addedBy: me });
  };

  // creator-only organizer picker, from this session's joined members (excluding creator), max 2
  const sessionMembers = members.filter((m) => m.sessionId === s.id);
  const organizerIds = sessionMembers.filter((m) => m.role === 'organizer' && m.profileId !== s.createdBy).map((m) => m.profileId);
  const memberProfiles = sessionMembers.filter((m) => m.profileId && m.profileId !== s.createdBy).map((m) => DATA.profile(m.profileId)).filter(Boolean);
  const toggleOrganizer = (pid) => {
    const sel = organizerIds.includes(pid);
    if (!sel && organizerIds.length >= 2) return;
    setMembers(members.map((m) => (m.sessionId === s.id && m.profileId === pid ? { ...m, role: sel ? 'player' : 'organizer' } : m)));
    setOrgMsg(sel ? 'Organizer removed' : 'Organizer added'); setTimeout(() => setOrgMsg(''), 1500);
  };
  // joined members not yet in the availability pool (organizer can add them)
  const notInPool = sessionMembers.filter((m) => m.profileId && m.profileId !== me && !sessionAv.some((a) => a.profileId === m.profileId)).map((m) => DATA.profile(m.profileId)).filter(Boolean);

  const Row = ({ a }) => {
    const isGuest = !a.profileId;
    return (
      <div className="surface" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div className="row" style={{ gap: 10 }}>
          <Avatar id={a.profileId} name={a.guestName} size={30} color={isGuest ? 'var(--raise)' : undefined} />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="row wrap" style={{ gap: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{a.profileId ? DATA.name(a.profileId) : a.guestName}</span>
              {isGuest && <span className="tag tag--guest">GUEST</span>}
              {a.profileId === me && <span className="tag">YOU</span>}
            </div>
          </div>
          <span className={'pill ' + (a.status === 'available' ? 'pill--paid' : 'pill--out')} style={{ fontSize: 10.5 }}>{a.status === 'available' ? 'IN' : 'OUT'}</span>
        </div>
        {org && (
          <div className="av-toggle" style={{ alignSelf: 'flex-start' }}>
            {['available', 'out'].map((k) => (
              <button key={k} className={a.status === k ? 'on ' + k : ''} onClick={() => setRowStatus(a, k)}>{k === 'available' ? 'In' : 'Out'}</button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page">
      <div className="row between wrap" style={{ marginBottom: 18, gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 30, margin: 0 }}>Availability</h1>
          <p className="muted" style={{ margin: '3px 0 0', fontSize: 14 }}>{s.turfName} · {dateLabel(s.slotStart)} · {timeOfDay(s.slotStart)}</p>
        </div>
        <div className="card card--pad" style={{ padding: '10px 16px', textAlign: 'center' }}>
          <div className="muted mono" style={{ fontSize: 9.5, letterSpacing: '.1em' }}>TEAMS LOCK IN</div>
          <div className="num" style={{ fontSize: 24, color: 'var(--amber)' }}><Countdown to={new Date(lockAt).toISOString()} expired="LOCKED" /></div>
          <div className="muted" style={{ fontSize: 10.5 }}>1h before kick-off (players)</div>
        </div>
      </div>

      {/* my status */}
      <div className="card card--pad" style={{ marginBottom: 18 }}>
        <div className="row between wrap" style={{ gap: 12 }}>
          <div className="row" style={{ gap: 12 }}>
            <Avatar id={me} size={42} />
            <div><div style={{ fontWeight: 700, fontSize: 16 }}>{DATA.name(me)} <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>(you)</span></div><div className="muted" style={{ fontSize: 12.5 }}>{ctx.locked ? 'Locked — within 1h of kick-off' : 'Are you playing this match?'}</div></div>
          </div>
          <div className="av-toggle" style={{ transform: 'scale(1.05)' }}>
            {['available', 'out'].map((k) => (
              <button key={k} className={mine === k ? 'on ' + k : ''} onClick={() => setMyStatus(k)} disabled={ctx.locked}>{k === 'available' ? "I'm in" : 'Out'}</button>
            ))}
          </div>
        </div>
      </div>

      {/* creator-only: choose up to two organizers from the joined players */}
      {isCreator && (
        <div className="card card--pad" style={{ marginBottom: 18 }}>
          <div className="row between wrap" style={{ gap: 10, marginBottom: 10 }}>
            <div><div className="section-title" style={{ margin: 0 }}>Session organizers</div><p className="muted" style={{ margin: 0, fontSize: 12.5 }}>Pick up to two from the joined players. Saves instantly.</p></div>
            <div className="row" style={{ gap: 8 }}>{orgMsg && <span className="pill pill--paid" style={{ fontSize: 10.5 }}>{orgMsg}</span>}<span className="pill">{organizerIds.length}/2</span></div>
          </div>
          {memberProfiles.length === 0 ? <div className="muted" style={{ fontSize: 13 }}>No one has joined yet — share the code.</div> : (
            <div className="row wrap" style={{ gap: 8 }}>
              {memberProfiles.map((p) => {
                const sel = organizerIds.includes(p.id);
                const disabled = !sel && organizerIds.length >= 2;
                return (
                  <button key={p.id} className="surface" disabled={disabled} onClick={() => toggleOrganizer(p.id)}
                    style={{ padding: '8px 12px', borderColor: sel ? 'var(--sky)' : 'var(--line)', opacity: disabled ? 0.45 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
                    <span className="row" style={{ gap: 8 }}><Avatar id={p.id} size={24} /> <span style={{ fontWeight: 600, fontSize: 13.5 }}>{DATA.first(p.id)}</span>{sel && <span className="pill" style={{ color: 'var(--sky)', borderColor: 'var(--sky)', fontSize: 10 }}>ORG</span>}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="row between" style={{ marginBottom: 12 }}>
        <div className="row" style={{ gap: 8 }}>
          <span className="pill pill--paid">{inList.length} IN</span>
          <span className="pill pill--out">{outList.length} OUT</span>
        </div>
        <RoleGate can={org} reason="Organizers only" inline>
          <button className="btn btn--sm" onClick={() => setAdding(!adding)}><Icon name="plus" className="ico" /> Add player</button>
        </RoleGate>
      </div>

      {adding && org && (
        <div className="card card--pad" style={{ marginBottom: 16 }}>
          <div className="section-title">Add to pool</div>
          {notInPool.length > 0 && (
            <div className="row wrap" style={{ gap: 8, marginBottom: 14 }}>
              {notInPool.map((p) => <button key={p.id} className="btn btn--sm" onClick={() => addExisting(p.id)}><Icon name="plus" className="ico" /> {p.firstName}</button>)}
            </div>
          )}
          <div className="row" style={{ gap: 8 }}>
            <input className="input grow" placeholder="One-off guest name…" value={guestName} onChange={(e) => setGuestName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addGuest()} />
            <button className="btn btn--accent" onClick={addGuest}>Add guest</button>
          </div>
        </div>
      )}

      <div className="grid-2">
        {[['available', 'In', inList], ['out', 'Out', outList]].map(([k, lbl, list]) => (
          <div key={k}>
            <div className="section-title" style={{ fontSize: 12 }}>{lbl} · {list.length}</div>
            <div className="stack" style={{ gap: 8 }}>
              {list.map((a) => <Row key={a.id} a={a} />)}
              {list.length === 0 && <div className="muted" style={{ fontSize: 13, padding: '8px 2px' }}>—</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
