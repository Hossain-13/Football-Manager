import React, { useState } from 'react';
import { Icon } from '../components/Icon.jsx';
import { Avatar, LockRing, RoleGate } from '../components/core.jsx';
import { DATA } from '../lib/dataView.js';
import { newId } from '../lib/format.js';

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
      {/* lock countdown + my status, side by side for page balance instead of a floating
          isolated card with empty space beside it */}
      <div className="av-top">
        <div className="card card--pad av-top__ring">
          <LockRing to={new Date(lockAt).toISOString()} label="LOCK IN" />
          <div className="muted" style={{ fontSize: 10.5, textAlign: 'center', maxWidth: 110 }}>1h before kick-off (players)</div>
        </div>

        <div className="card card--pad av-top__status">
          <div className="row between wrap" style={{ gap: 12, width: '100%' }}>
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
