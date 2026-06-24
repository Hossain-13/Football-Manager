import React, { useState } from 'react';
import { Icon } from '../components/Icon.jsx';
import { Field } from '../components/core.jsx';

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
