/* =====================================================================
   TURF - shared data view singleton (extracted from Turf.jsx).

   ACTIVE_DB is a module-level mutable reference; DATA is a Proxy that
   always reads the freshest ACTIVE_DB. The App reassigns ACTIVE_DB via
   setActiveDb() each render (imported live bindings are read-only, so the
   old in-file `ACTIVE_DB = ...` becomes a setter call). Every component
   imports the SAME module instance, so reads stay reactive exactly as
   before the split.
   ===================================================================== */
import { DB } from './db.js';

let ACTIVE_DB = DB;

export function setActiveDb(db) {
  ACTIVE_DB = db;
}

export const DATA = new Proxy({}, {
  get(_target, prop) {
    return ACTIVE_DB[prop];
  },
});

/* Player "keys" used in team building are either a profile id (real member) or
   'g:<name>' for a guest (no account). These helpers resolve a key to display values. */
export const isGuestKey = (k) => typeof k === 'string' && k.startsWith('g:');
export const keyFirst = (k) => (isGuestKey(k) ? k.slice(2) : DATA.first(k));
export const keyName = (k) => (isGuestKey(k) ? k.slice(2) : DATA.name(k));
