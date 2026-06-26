import React, { createContext, useCallback, useContext, useState } from 'react';
import { Icon } from './Icon.jsx';

const DialogContext = createContext(null);

/* App-wide confirm/alert modals. Replaces window.alert/confirm so every system dialogue
   matches the app's own look instead of the browser's native chrome. */
export function DialogProvider({ children }) {
  const [state, setState] = useState(null);
  const [closing, setClosing] = useState(false);

  const confirm = useCallback((opts) => {
    const o = typeof opts === 'string' ? { message: opts } : opts;
    return new Promise((resolve) => {
      setState({
        kind: 'confirm', title: o.title, message: o.message, danger: o.danger,
        confirmLabel: o.confirmLabel || 'Confirm', cancelLabel: o.cancelLabel || 'Cancel', resolve,
      });
    });
  }, []);

  const alert = useCallback((opts) => {
    const o = typeof opts === 'string' ? { message: opts } : opts;
    return new Promise((resolve) => {
      setState({ kind: 'alert', title: o.title, message: o.message, danger: o.danger, confirmLabel: o.confirmLabel || 'OK', resolve });
    });
  }, []);

  const close = (result) => {
    setClosing(true);
    setTimeout(() => { state?.resolve(result); setState(null); setClosing(false); }, 180);
  };

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      {state && (
        <div className={'modal-backdrop' + (closing ? ' is-closing' : '')} onClick={() => close(state.kind === 'confirm' ? false : undefined)}>
          <div className={'modal-card dialog-card' + (state.danger ? ' dialog-card--danger' : '') + (closing ? ' is-closing' : '')} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-card__icon">
              <Icon name={state.danger ? 'x' : (state.kind === 'confirm' ? 'lock' : 'check')} size={20} />
            </div>
            {state.title && <h2 className="dialog-card__title">{state.title}</h2>}
            {state.message && <p className="dialog-card__msg">{state.message}</p>}
            <div className="row" style={{ gap: 8, marginTop: 18 }}>
              {state.kind === 'confirm' && (
                <button className="btn btn--ghost grow" onClick={() => close(false)}>{state.cancelLabel}</button>
              )}
              <button className={'btn grow' + (state.danger ? ' btn--danger' : ' btn--accent')} onClick={() => close(true)} autoFocus>
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used inside DialogProvider');
  return ctx;
}
