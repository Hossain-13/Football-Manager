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

  const [addOpen, setAddOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const canAddExpense = newLabel.trim() && Number(newAmount) > 0;
  const addExpense = () => {
    if (!canAddExpense) return;
    const row = { id: newId('expense'), sessionId: s.id, label: newLabel.trim(), amount: Math.round(Number(newAmount)), createdBy: s.createdBy };
    setExp([...exp, row]);
    ctx.saveExpenseRow(row);
    setNewLabel(''); setNewAmount(''); setAddOpen(false);
  };
  const cancelAddExpense = () => { setAddOpen(false); setNewLabel(''); setNewAmount(''); };

  const keyOf = (p) => p.key || p.profileId || ('g:' + (p.guestName || ''));
  const updatePayment = (key, patch) => {
    if (!org) return;
    const guest = isGuestKey(key);
    const identity = { key, profileId: guest ? undefined : key, guestName: guest ? key.slice(2) : undefined };
    const idx = pay.findIndex((p) => p.sessionId === s.id && keyOf(p) === key);
    const current = idx >= 0 ? pay[idx] : { sessionId: s.id, ...identity, amountPaid: 0, method: 'cash' };
    const nextPayment = { ...current, ...identity, ...patch, amountDue: per };
    setPay((prev) => {
      const i = prev.findIndex((p) => p.sessionId === s.id && keyOf(p) === key);
      if (i < 0) return [...prev, nextPayment];
      return prev.map((p, j) => (j === i ? nextPayment : p));
    });
    ctx.savePaymentRow(nextPayment);
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

  return (
    <div className="page page--narrow">
      <div className="row between wrap" style={{ marginBottom: 16, gap: 10 }}>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>Turf bill, split between {head} assigned team players.</p>
        {!org && <span className="pill"><Icon name="lock" className="ico" style={{ width: 13, height: 13 }} /> ORGANIZER CONTROLS</span>}
      </div>

      {/* Was 3 separate stat boxes + a duplicate progress card — same 3 numbers (total/collected/
          outstanding) now live on one progress bar instead of being repeated across two layout
          blocks that ate vertical space without adding any visual read on the relationship
          between them. */}
      <div className="card card--pad pay-hero" style={{ marginBottom: 16 }}>
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div className="row" style={{ gap: 10 }}>
            <div className="icon-badge"><Icon name="expenses" className="ico" /></div>
            <div>
              <div className="muted mono" style={{ fontSize: 10, letterSpacing: '.1em' }}>TOTAL POT</div>
              <div className="num" style={{ fontSize: 22 }}>{taka(total)}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="num" style={{ fontSize: 22, color: 'var(--accent)' }}>{Math.round(progress)}%</div>
            <div className="muted" style={{ fontSize: 10.5 }}>collected</div>
          </div>
        </div>
        <div className="pay-hero__bar"><span style={{ width: progress + '%' }} /></div>
        <div className="row between" style={{ marginTop: 8 }}>
          <span style={{ fontSize: 12.5 }}><span style={{ color: 'var(--accent)', fontWeight: 700 }}>{taka(collected)}</span> <span className="muted">collected</span></span>
          <span style={{ fontSize: 12.5 }}><span style={{ color: outstanding > 0 ? 'var(--amber)' : 'var(--accent)', fontWeight: 700 }}>{taka(outstanding)}</span> <span className="muted">outstanding</span></span>
        </div>
        <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>{taka(per)} per player · {paidCount}/{head} paid · only assigned players contribute.</div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        {contributors.map((p) => {
          const guest = isGuestKey(p.key);
          const fully = per > 0 && p.amountPaid >= per;
          const partial = p.amountPaid > 0 && p.amountPaid < per;
          const extra = p.amountPaid - per; // > 0 means this player covered others' shares
          const editing = editKey === p.key;
          return (
            <div key={p.key} className="pay-row">
              <div className="pay-row__who">
                <Avatar id={guest ? undefined : p.key} name={guest ? keyName(p.key) : undefined} size={30} color={guest ? 'var(--raise)' : undefined} />
                <div style={{ minWidth: 0 }}>
                  <span className="row" style={{ gap: 5, fontWeight: 600, fontSize: 14 }}>{keyName(p.key)} {guest && <span className="tag tag--guest" style={{ fontSize: 9 }}>GUEST</span>}</span>
                  {extra > 0 && <div className="muted" style={{ fontSize: 11, color: 'var(--accent)' }}>+{taka(extra)} covers others</div>}
                </div>
              </div>

              <button
                className="pay-row__amount"
                disabled={!org}
                title={org ? 'Tap to enter the exact amount this player gave' : undefined}
                onClick={() => org && (editing ? setEditKey(null) : openEdit(p))}
              >
                <span className="num" style={{ fontSize: 15, color: p.amountPaid > 0 ? 'var(--accent)' : 'var(--chalk)' }}>{taka(p.amountPaid)}</span>
                <span className="muted" style={{ fontSize: 11 }}>of {taka(per)} {org && <Icon name="edit" className="ico" />}</span>
              </button>

              <button
                className={'pay-row__pill pill ' + (fully ? 'pill--paid' : 'pill--due')}
                onClick={() => togglePaid(p.key)}
                style={{ minWidth: 78, justifyContent: 'center' }}
                disabled={!org || per <= 0}
              >
                {fully ? <><Icon name="check" className="ico" style={{ width: 12, height: 12 }} /> PAID</> : partial ? 'PARTIAL' : 'DUE'}
              </button>

              {editing && org && (
                <div className="pay-row__editor row wrap" style={{ gap: 8 }}>
                  <input className="input" type="number" inputMode="numeric" value={editVal} autoFocus
                    placeholder={'Amount given (e.g. ' + (per * 2) + ' to cover one more)'}
                    onChange={(e) => setEditVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); }}
                    style={{ maxWidth: 240, flex: '1 1 160px' }} />
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
        <RoleGate can={org} reason="Only the organizer can add expenses">
          {addOpen ? (
            <div className="row wrap" style={{ gap: 8, marginTop: 14 }}>
              <input
                className="input" placeholder="Label (e.g. Extra balls)" value={newLabel} autoFocus
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addExpense(); if (e.key === 'Escape') cancelAddExpense(); }}
                style={{ flex: '2 1 180px' }}
              />
              <input
                className="input" type="number" inputMode="numeric" placeholder="Amount" value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addExpense(); if (e.key === 'Escape') cancelAddExpense(); }}
                style={{ flex: '1 1 100px', maxWidth: 130 }}
              />
              <button className="btn btn--accent btn--sm" disabled={!canAddExpense} onClick={addExpense}>Save</button>
              <button className="btn btn--ghost btn--sm" onClick={cancelAddExpense}>Cancel</button>
            </div>
          ) : (
            <button className="btn btn--sm" style={{ marginTop: 14 }} onClick={() => setAddOpen(true)}><Icon name="plus" className="ico" /> Add expense</button>
          )}
        </RoleGate>
      </div>
    </div>
  );
}
