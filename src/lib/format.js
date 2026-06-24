/* TURF - pure formatting + id helpers (no React). Extracted from Turf.jsx. */

export const pad = (n) => String(n).padStart(2, '0');
export const mmss = (sec) => { sec = Math.max(0, Math.floor(sec)); return pad(Math.floor(sec / 60)) + ':' + pad(sec % 60); };
export const timeOfDay = (isoStr) => new Date(isoStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const dateLabel = (isoStr) => new Date(isoStr).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
export const taka = (n) => '\u09F3' + n.toLocaleString('en-IN');
export const newId = (prefix = 'id') => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : prefix + Date.now());
export const buildDefaultMatches = (sessionId, teams) => {
  const pairIndexes = [[0, 1], [2, 3], [0, 4], [1, 2], [3, 4], [0, 2], [1, 3], [2, 4], [0, 3], [1, 4]];
  return pairIndexes
    .filter(([a, b]) => teams[a] && teams[b])
    .map(([a, b], index) => ({
      id: newId('match'),
      sessionId,
      matchNo: index + 1,
      teamA: teams[a].id,
      teamB: teams[b].id,
      scoreA: 0,
      scoreB: 0,
      status: index === 0 ? 'live' : 'scheduled',
      durationSeconds: 900,
    }));
};
