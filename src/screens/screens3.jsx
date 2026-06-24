import React, { useState, useMemo } from 'react';
import { Icon } from '../components/Icon.jsx';
import { Avatar, TeamDot, StatusPill, RoleGate } from '../components/core.jsx';
import { TimerDisplay, ScoreStepper, StandingsTable } from '../components/signature.jsx';
import { DATA, isGuestKey, keyFirst, keyName } from '../lib/dataView.js';
import { dateLabel, taka, newId, buildDefaultMatches } from '../lib/format.js';

export function LiveScreen({ ctx }) {
  const matches = ctx.matches;
  const sessionTeams = ctx.teams;
  const generateSchedule = () => ctx.setMatches(buildDefaultMatches(ctx.session.id, sessionTeams));

  if (!matches.length) {
    return (
      <div className="page page--narrow">
        <div className="card card--pad" style={{ textAlign: 'left' }}>
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 28, margin: '0 0 8px' }}>No live match yet</h1>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>This session has teams but no schedule. Generate fixtures before opening the live clock.</p>
          <RoleGate can={ctx.canManage && sessionTeams.length >= 2} reason="Admin or organizers can generate matches">
            <button className="btn btn--accent btn--block" onClick={generateSchedule}><Icon name="plus" className="ico" /> Generate schedule</button>
          </RoleGate>
        </div>
      </div>
    );
  }

  const live = matches.find((m) => m.status === 'live') || matches.find((m) => m.status === 'scheduled') || matches[0];
  const A = DATA.team(live.teamA), B = DATA.team(live.teamB);
  if (!A || !B) {
    return (
      <div className="page page--narrow">
        <div className="card card--pad">
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 28, margin: '0 0 8px' }}>Match teams missing</h1>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>This schedule points to teams that are not loaded for the current session.</p>
        </div>
      </div>
    );
  }
  const [caps] = ctx.captains;
  const canControl = ctx.canManage || ctx.isCaptain;
  const controlLabel = ctx.canManage ? (ctx.isAdmin ? 'ADMIN MODE' : 'ORGANIZER MODE') : 'CAPTAIN MODE';
  const reason = 'Only admins, organizers, or match captains can score';
  // Goals are DERIVED from live data so scorer tags sync to all viewers via realtime (no stale
  // local copy). saveGoals upserts; the new goal gets a real UUID so the insert is valid.
  const goals = DATA.goals.filter((g) => g.matchId === live.id);
  const [tagFor, setTagFor] = useState(null);

  const setScore = (side, val) => ctx.updateMatch(live.id, { [side]: Math.max(0, val) });
  const addGoal = (teamId, scorerId) => {
    ctx.saveGoals?.([...goals, { id: newId('goal'), matchId: live.id, teamId, scorerId, minute: 0 }]);
    setTagFor(null);
  };
  const finish = () => {
    const idx = matches.findIndex((m) => m.id === live.id);
    ctx.updateMatch(live.id, { status: 'done' });
    const nx = matches.find((m, i) => i > idx && m.status === 'scheduled');
    if (nx) ctx.updateMatch(nx.id, { status: 'live' });
  };

  const queue = matches.filter((m) => m.status === 'scheduled').slice(0, 4);
  const teamGoals = (tid) => goals.filter((g) => g.teamId === tid);

  return (
    <div className="page">
      <div className="row between wrap" style={{ marginBottom: 14, gap: 10 }}>
        <div className="row" style={{ gap: 10 }}>
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 30, margin: 0 }}>Live Match</h1>
          <span className="mono muted" style={{ fontSize: 12, alignSelf: 'center' }}>MATCH {live.matchNo} of {matches.length}</span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {canControl ? <span className="pill pill--live"><span className="dot" /> {controlLabel}</span>
            : <span className="pill"><Icon name="lock" className="ico" style={{ width: 13, height: 13 }} /> VIEW ONLY</span>}
        </div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '1fr', gap: 16 }}>
        <TimerDisplay
          match={live}
          can={canControl}
          reason={reason}
          onTimerChange={(patch) => ctx.updateMatch(live.id, patch)}
        />

        <div className="card card--pad">
          <div className="scoreboard">
            <ScoreStepper team={A} score={live.scoreA} can={canControl} onChange={(v) => setScore('scoreA', v)} />
            <div className="vs">VS</div>
            <ScoreStepper team={B} score={live.scoreB} can={canControl} onChange={(v) => setScore('scoreB', v)} />
          </div>

          {/* goal scorer tags */}
          <hr className="divline" />
          <div className="grid-2">
            {[A, B].map((T) => (
              <div key={T.id}>
                <div className="row between" style={{ marginBottom: 8 }}>
                  <span className="row" style={{ gap: 6, fontFamily: 'var(--f-display)', fontWeight: 600 }}><TeamDot color={T.color} /> {T.name} scorers</span>
                  {canControl && <button className="btn btn--sm btn--ghost" onClick={() => setTagFor(tagFor === T.id ? null : T.id)}><Icon name="plus" className="ico" /> Tag</button>}
                </div>
                <div className="row wrap" style={{ gap: 6 }}>
                  {teamGoals(T.id).map((g) => (
                    <span key={g.id} className="tag" style={{ background: T.color + '22', color: '#fff', fontSize: 11 }}>⚽ {g.scorerId ? keyFirst(g.scorerId) : 'OG'}</span>
                  ))}
                  {teamGoals(T.id).length === 0 && <span className="muted" style={{ fontSize: 12 }}>No scorers tagged</span>}
                </div>
                {tagFor === T.id && (
                  <div className="row wrap" style={{ gap: 6, marginTop: 8, padding: 8, background: 'rgba(0,0,0,.2)', borderRadius: 10 }}>
                    {(DATA.teamPlayers[T.id] || []).map((pid) => <button key={pid} className="btn btn--sm" onClick={() => addGoal(T.id, pid)}>{keyFirst(pid)}</button>)}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="row between" style={{ marginTop: 18 }}>
            <RoleGate can={canControl} reason="Captains only" inline>
              <button className="btn btn--accent" onClick={finish}><Icon name="check" className="ico" /> Full time &amp; next</button>
            </RoleGate>
            <span className="muted" style={{ fontSize: 12.5 }}>{!canControl && <span className="row" style={{ gap: 6, color: 'var(--amber)' }}><Icon name="lock" className="ico" /> Admins, organizers, or captains can control</span>}</span>
          </div>
        </div>

        {/* next match queue */}
        <div className="card card--pad">
          <div className="section-title">Up next</div>
          <div className="stack" style={{ gap: 8 }}>
            {queue.map((m) => {
              const a = DATA.team(m.teamA), b = DATA.team(m.teamB);
              return (
                <div key={m.id} className="row between" style={{ padding: '10px 12px', background: 'rgba(0,0,0,.18)', borderRadius: 10 }}>
                  <span className="row" style={{ gap: 10 }}>
                    <span className="fixture__no" style={{ fontSize: 15 }}>{String(m.matchNo).padStart(2, '0')}</span>
                    <span className="row" style={{ gap: 6, fontWeight: 600 }}><TeamDot color={a.color} />{a.name}</span>
                    <span className="muted">vs</span>
                    <span className="row" style={{ gap: 6, fontWeight: 600 }}><TeamDot color={b.color} />{b.name}</span>
                  </span>
                  <span className="muted mono" style={{ fontSize: 11 }}>QUEUED</span>
                </div>
              );
            })}
            {queue.length === 0 && <div className="muted">All matches played 🏁</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- STANDINGS ---------------- */
export function StandingsScreen({ ctx }) {
  return (
    <div className="page page--narrow">
      <div className="row between wrap" style={{ marginBottom: 16, gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 30, margin: 0 }}>Standings</h1>
          <p className="muted" style={{ margin: '3px 0 0', fontSize: 14 }}>Auto-sorted live as results come in.</p>
        </div>
        <span className="pill pill--live"><span className="dot" /> UPDATING LIVE</span>
      </div>
      <StandingsTable matches={ctx.matches} teams={DATA.teams} scoring={ctx.session.scoring} qualifiers={2} />
    </div>
  );
}

/* ---------------- MATCH HISTORY ---------------- */
export function HistoryScreen({ ctx }) {
  const done = ctx.matches.filter((m) => m.status === 'done');
  return (
    <div className="page page--narrow">
      <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 30, margin: '0 0 4px' }}>Match History</h1>
      <p className="muted" style={{ margin: '0 0 18px', fontSize: 14 }}>{ctx.session.turfName} · {dateLabel(ctx.session.slotStart)}</p>

      <div className="card">
        {done.length === 0 && <div className="card--pad muted" style={{ padding: 18 }}>No completed matches yet.</div>}
        {done.map((m) => {
          const A = DATA.team(m.teamA), B = DATA.team(m.teamB);
          const gs = DATA.goals.filter((g) => g.matchId === m.id);
          const aWin = m.scoreA > m.scoreB, draw = m.scoreA === m.scoreB;
          return (
            <div key={m.id} style={{ padding: '14px 16px', borderBottom: '1px solid var(--line-soft)' }}>
              <div className="row between">
                <span className="mono muted" style={{ fontSize: 11 }}>MATCH {String(m.matchNo).padStart(2, '0')}</span>
                <StatusPill status="done" />
              </div>
              <div className="row between" style={{ marginTop: 8, gap: 10 }}>
                <span className="row" style={{ gap: 8, fontFamily: 'var(--f-display)', fontSize: 18, whiteSpace: 'nowrap', fontWeight: aWin || draw ? 600 : 400, opacity: !aWin && !draw ? 0.7 : 1 }}><TeamDot color={A.color} /> {A.name}</span>
                <span className="num" style={{ fontSize: 22, whiteSpace: 'nowrap' }}>{m.scoreA} – {m.scoreB}</span>
                <span className="row" style={{ gap: 8, fontFamily: 'var(--f-display)', fontSize: 18, whiteSpace: 'nowrap', fontWeight: !aWin || draw ? 600 : 400, opacity: aWin && !draw ? 0.7 : 1, justifyContent: 'flex-end' }}>{B.name} <TeamDot color={B.color} /></span>
              </div>
              {gs.length > 0 && (
                <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
                  {gs.map((g) => <span key={g.id} className="tag" style={{ background: DATA.team(g.teamId).color + '22', color: '#fff' }}>⚽ {g.scorerId ? keyFirst(g.scorerId) : 'OG'} {g.minute ? g.minute + "'" : ''}</span>)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- EXPENSES & PAYMENTS ---------------- */
export function ExpensesScreen({ ctx }) {
  const s = ctx.session;
  const org = ctx.canManage;
  const [pay, setPay] = ctx.payments;
  const [exp, setExp] = ctx.expenses;
  const [assign] = ctx.assign;
  const sessionExpenses = exp.filter((e) => e.sessionId === s.id);
  const extraTotal = sessionExpenses.reduce((a, e) => a + e.amount, 0);
  const baseFee = Number(s.totalFee) || 0;
  const total = baseFee + extraTotal; // turf booking fee + extra expenses = the pot to split
  // contributors = everyone assigned to a team — members AND guests (guests are full players).
  const contributorKeys = useMemo(() => {
    const ids = Object.entries(assign)
      .filter(([teamId]) => teamId !== 'pool')
      .flatMap(([, players]) => players);
    return [...new Set(ids)].filter((k) => (isGuestKey(k) ? true : DATA.profile(k)));
  }, [assign]);
  const head = contributorKeys.length;
  const per = head ? Math.round(total / head) : 0;
  const sessionPayments = pay.filter((p) => p.sessionId === s.id);
  const payByKey = new Map(sessionPayments.map((p) => [p.key || p.profileId || ('g:' + (p.guestName || '')), p]));
  // amountPaid is the REAL amount a player handed over (may exceed their per-head share to
  // cover someone who didn't pay). Outstanding nets all payments against the total pot.
  const contributors = contributorKeys.map((key) => {
    const existing = payByKey.get(key);
    const guest = isGuestKey(key);
    return {
      sessionId: s.id, key,
      profileId: guest ? undefined : key,
      guestName: guest ? key.slice(2) : undefined,
      amountDue: per,
      amountPaid: existing ? existing.amountPaid : 0,
      method: existing?.method || 'cash',
      confirmedBy: existing?.confirmedBy,
    };
  });
  const collected = contributors.reduce((a, p) => a + p.amountPaid, 0);
  const outstanding = Math.max(0, total - collected);
  const paidCount = contributors.filter((p) => per > 0 && p.amountPaid >= per).length;
  const progress = total > 0 ? Math.min(100, (collected / total) * 100) : 0;

  const [editKey, setEditKey] = useState(null);
  const [editVal, setEditVal] = useState('');

  const keyOf = (p) => p.key || p.profileId || ('g:' + (p.guestName || ''));
  const updatePayment = (key, patch) => {
    if (!org) return;
    const guest = isGuestKey(key);
    const identity = { key, profileId: guest ? undefined : key, guestName: guest ? key.slice(2) : undefined };
    setPay((prev) => {
      const idx = prev.findIndex((p) => p.sessionId === s.id && keyOf(p) === key);
      const current = idx >= 0 ? prev[idx] : { sessionId: s.id, ...identity, amountPaid: 0, method: 'cash' };
      const nextPayment = { ...current, ...identity, ...patch, amountDue: per };
      if (idx < 0) return [...prev, nextPayment];
      return prev.map((p, i) => (i === idx ? nextPayment : p));
    });
  };
  // mark fully paid / clear (toggle on the per-head share)
  const togglePaid = (key) => {
    const row = contributors.find((p) => p.key === key);
    if (!row || per <= 0) return;
    const settled = row.amountPaid >= per;
    updatePayment(key, { amountPaid: settled ? 0 : per, confirmedBy: settled ? undefined : s.createdBy });
  };
  // set the exact amount a player gave (Add money) — can be more than their share
  const setPaidAmount = (key, amt) => {
    const v = Math.max(0, Math.round(Number(amt) || 0));
    updatePayment(key, { amountPaid: v, confirmedBy: v > 0 ? s.createdBy : undefined });
  };
  const openEdit = (p) => { setEditKey(p.key); setEditVal(p.amountPaid ? String(p.amountPaid) : ''); };
  const saveEdit = () => { if (editKey != null) setPaidAmount(editKey, editVal); setEditKey(null); setEditVal(''); };
  const setMethod = (key, method) => updatePayment(key, { method });

  const Stat = ({ k, v, c }) => (
    <div className="surface" style={{ padding: '14px 16px' }}>
      <div className="muted mono" style={{ fontSize: 10, letterSpacing: '.1em' }}>{k}</div>
      <div className="num" style={{ fontSize: 26, marginTop: 2, color: c }}>{v}</div>
    </div>
  );

  return (
    <div className="page page--narrow">
      <div className="row between wrap" style={{ marginBottom: 16, gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 30, margin: 0 }}>Expenses</h1>
          <p className="muted" style={{ margin: '3px 0 0', fontSize: 14 }}>Turf bill, split between {head} assigned team players.</p>
        </div>
        {!org && <span className="pill"><Icon name="lock" className="ico" style={{ width: 13, height: 13 }} /> ORGANIZER CONTROLS</span>}
      </div>

      <div className="grid-3" style={{ marginBottom: 18 }}>
        <Stat k="TOTAL POT" v={taka(total)} />
        <Stat k="COLLECTED" v={taka(collected)} c="var(--accent)" />
        <Stat k="OUTSTANDING" v={taka(outstanding)} c={outstanding > 0 ? 'var(--amber)' : 'var(--accent)'} />
      </div>

      <div className="card card--pad" style={{ marginBottom: 16 }}>
        <div className="row between">
          <div className="section-title" style={{ margin: 0 }}>Per player</div>
          <span className="num" style={{ fontSize: 20 }}>{taka(per)} <span className="muted" style={{ fontSize: 12 }}>each</span></span>
        </div>
        <div style={{ height: 8, background: 'rgba(255,255,255,.08)', borderRadius: 8, overflow: 'hidden', margin: '12px 0 4px' }}>
          <div style={{ width: progress + '%', height: '100%', background: 'var(--accent)' }} />
        </div>
        <div className="muted" style={{ fontSize: 12 }}>{paidCount}/{head} paid · only players assigned to teams contribute</div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        {contributors.map((p) => {
          const guest = isGuestKey(p.key);
          const fully = per > 0 && p.amountPaid >= per;
          const partial = p.amountPaid > 0 && p.amountPaid < per;
          const extra = p.amountPaid - per; // > 0 means this player covered others' shares
          const editing = editKey === p.key;
          return (
            <div key={p.key} style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="row between wrap" style={{ gap: 10 }}>
                <div className="row" style={{ gap: 10, minWidth: 0 }}>
                  <Avatar id={guest ? undefined : p.key} name={guest ? keyName(p.key) : undefined} size={30} color={guest ? 'var(--raise)' : undefined} />
                  <div style={{ minWidth: 0 }}>
                    <span className="row" style={{ gap: 5, fontWeight: 600, fontSize: 14 }}>{keyName(p.key)} {guest && <span className="tag tag--guest" style={{ fontSize: 9 }}>GUEST</span>}</span>
                    <div className="muted" style={{ fontSize: 11.5 }}>
                      Paid <span style={{ color: p.amountPaid > 0 ? 'var(--accent)' : 'inherit', fontWeight: 600 }}>{taka(p.amountPaid)}</span> of {taka(per)}
                      {extra > 0 && <span style={{ color: 'var(--accent)' }}> · +{taka(extra)} covers others</span>}
                    </div>
                  </div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <div className="seg seg--ghost" style={{ opacity: org ? 1 : 0.6 }}>
                    {['bkash', 'cash'].map((mth) => (
                      <button key={mth} className={p.method === mth ? 'on' : ''} onClick={() => setMethod(p.key, mth)} disabled={!org} style={{ fontSize: 10.5, padding: '4px 8px' }}>{mth === 'bkash' ? 'bKash' : 'Cash'}</button>
                    ))}
                  </div>
                  {org && <button className="btn btn--ghost btn--sm" onClick={() => (editing ? setEditKey(null) : openEdit(p))} title="Enter the exact amount this player gave"><Icon name="plus" className="ico" style={{ width: 13, height: 13 }} /> Money</button>}
                  <button className={'pill ' + (fully ? 'pill--paid' : 'pill--due')} onClick={() => togglePaid(p.key)} style={{ cursor: org && per > 0 ? 'pointer' : 'default', minWidth: 78, justifyContent: 'center' }} disabled={!org || per <= 0}>
                    {fully ? <><Icon name="check" className="ico" style={{ width: 12, height: 12 }} /> PAID</> : partial ? 'PARTIAL' : 'DUE'}
                  </button>
                </div>
              </div>
              {editing && org && (
                <div className="row wrap" style={{ gap: 8 }}>
                  <input className="input" type="number" inputMode="numeric" value={editVal} autoFocus
                    placeholder={'Amount given (e.g. ' + (per * 2) + ' to cover one more)'}
                    onChange={(e) => setEditVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); }}
                    style={{ maxWidth: 240 }} />
                  <button className="btn btn--accent btn--sm" onClick={saveEdit}>Save</button>
                  <button className="btn btn--ghost btn--sm" onClick={() => { setEditKey(null); setEditVal(''); }}>Cancel</button>
                </div>
              )}
            </div>
          );
        })}
        {contributors.length === 0 && <div className="card--pad muted" style={{ padding: 18 }}>No team players selected yet.</div>}
      </div>

      <div className="card card--pad">
        <div className="section-title">Extra expenses</div>
        <div className="stack" style={{ gap: 0 }}>
          <div className="kv">
            <span className="kv__k">Turf booking fee <span className="muted mono" style={{ fontSize: 11 }}>· base</span></span>
            <span className="kv__v num">{taka(baseFee)}</span>
          </div>
          {sessionExpenses.map((e) => (
            <div key={e.id} className="kv">
              <span className="kv__k">{e.label} <span className="muted mono" style={{ fontSize: 11 }}>· by {DATA.first(e.createdBy)}</span></span>
              <span className="kv__v num">{taka(e.amount)}</span>
            </div>
          ))}
          <div className="kv" style={{ borderTop: '1px solid var(--line)', marginTop: 6, paddingTop: 12 }}>
            <span style={{ fontFamily: 'var(--f-display)', letterSpacing: '.08em' }}>RUNNING TOTAL</span>
            <span className="num" style={{ fontSize: 20 }}>{taka(total)}</span>
          </div>
        </div>
        <RoleGate can={org} reason="Only the organizer can add expenses" >
          <button className="btn btn--sm" style={{ marginTop: 14 }} onClick={() => setExp([...exp, { id: newId('expense'), sessionId: s.id, label: 'New expense', amount: 200, createdBy: s.createdBy }])}><Icon name="plus" className="ico" /> Add expense</button>
        </RoleGate>
      </div>
    </div>
  );
}

/* ---------------- PROFILE ---------------- */
export function ProfileScreen({ ctx }) {
  const id = DATA.currentUserId;
  const badges = [];
  if (ctx.role === 'admin') badges.push(['Admin', 'var(--accent)']);
  if (ctx.role === 'organizer') badges.push(['Organizer', 'var(--sky)']);
  if (ctx.isCaptain) badges.push(['Captain', 'var(--amber)']);
  badges.push(['Player', 'var(--accent)']);
  const mySessions = DATA.sessions;

  return (
    <div className="page page--narrow">
      <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 30, margin: '0 0 18px' }}>Profile</h1>

      <div className="card card--pad" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 16 }}>
          <Avatar id={id} size={68} />
          <div className="grow">
            <div style={{ fontFamily: 'var(--f-display)', fontSize: 26, fontWeight: 700 }}>{DATA.name(id)}</div>
            <div className="row wrap" style={{ gap: 7, marginTop: 8 }}>
              {badges.map(([b, c]) => (
                <span key={b} className="pill" style={{ color: c, borderColor: c + '66', background: c + '18' }}>{b}</span>
              ))}
            </div>
          </div>
          <button className="icobtn"><Icon name="settings" className="ico" /></button>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 16 }}>
        {[['MATCHES', 41], ['GOALS', 17], ['SESSIONS', 12]].map(([k, v]) => (
          <div key={k} className="surface" style={{ padding: '16px', textAlign: 'center' }}>
            <div className="num" style={{ fontSize: 30 }}>{v}</div>
            <div className="muted mono" style={{ fontSize: 10, letterSpacing: '.1em' }}>{k}</div>
          </div>
        ))}
      </div>

      <div className="card card--pad">
        <div className="section-title">My sessions</div>
        <div className="stack" style={{ gap: 0 }}>
          {mySessions.map((s) => (
            <div key={s.id} className="kv" style={{ cursor: 'pointer' }} onClick={() => { ctx.openSession(s.id); ctx.go('detail'); }}>
              <span className="row" style={{ gap: 10 }}><StatusPill status={s.status} /><span className="kv__k" style={{ color: 'var(--chalk)' }}>{s.turfName}</span></span>
              <span className="muted" style={{ fontSize: 12.5 }}>{dateLabel(s.slotStart)}</span>
            </div>
          ))}
        </div>
      </div>

      {ctx.logout && (
        <button className="btn btn--ghost btn--block" style={{ marginTop: 16 }} onClick={ctx.logout}>
          <Icon name="x" className="ico" /> Log out
        </button>
      )}

      <p className="muted" style={{ fontSize: 12.5, marginTop: 18, textAlign: 'center' }}>Your permissions come from the current session roster and captain picks.</p>
    </div>
  );
}
