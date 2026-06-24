import React, { useState, useMemo } from 'react';
import { Icon } from '../components/Icon.jsx';
import { Avatar, RoleGate } from '../components/core.jsx';
import { DATA, isGuestKey, keyName } from '../lib/dataView.js';
import { taka, newId } from '../lib/format.js';

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
