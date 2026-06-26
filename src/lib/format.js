/* TURF - pure formatting + id helpers (no React). Extracted from Turf.jsx. */

export const pad = (n) => String(n).padStart(2, '0');
export const mmss = (sec) => { sec = Math.max(0, Math.floor(sec)); return pad(Math.floor(sec / 60)) + ':' + pad(sec % 60); };
export const timeOfDay = (isoStr) => new Date(isoStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const dateLabel = (isoStr) => new Date(isoStr).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
export const taka = (n) => '\u09F3' + n.toLocaleString('en-IN');
/* first letter, skipping punctuation like "(Antor)" so avatars never show "(" */
export const firstLetter = (s) => (s && s.match(/[A-Za-z]/)?.[0]) || '?';
export const newId = (prefix = 'id') => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : prefix + Date.now());

// A session's place name and its optional Google Maps URL live together in the one `location`
// text (no schema change). parseLocation splits them back out; joinLocation stores them as
// "name url". The URL is detected by pattern, so old rows that already have a link pasted in
// ("Mohammadpur - https://maps.app.goo.gl/…") are understood automatically.
export const parseLocation = (loc) => {
  const str = String(loc || '');
  const match = str.match(/https?:\/\/\S+/i);
  const mapUrl = match ? match[0] : '';
  const name = (mapUrl ? str.replace(mapUrl, '') : str).replace(/^[\s\-–—|·,]+|[\s\-–—|·,]+$/g, '').trim();
  return { name, mapUrl };
};
export const joinLocation = (name, mapUrl) => [String(name || '').trim(), String(mapUrl || '').trim()].filter(Boolean).join(' ');

// The knockout final is a real match row, identified by a sentinel match number so it always
// sorts last and is never confused with a round-robin fixture (no schema change needed).
export const FINAL_MATCH_NO = 9000;
export const isFinalMatch = (m) => (m?.matchNo || 0) >= FINAL_MATCH_NO;

// A match only counts as "live" for badges once its clock has actually been started — running
// (started_at set) or started-then-paused (banked seconds). A freshly-current match whose timer
// hasn't been pressed yet is NOT shown as live. Score without a clock also counts as started.
export const matchStarted = (m) => m?.status === 'live' && (!!m.startedAt || (m.pausedAccumSeconds || 0) > 0 || (m.scoreA || 0) > 0 || (m.scoreB || 0) > 0);

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const allPairs = (teams) => {
  const out = [];
  for (let i = 0; i < teams.length; i++) for (let j = i + 1; j < teams.length; j++) out.push([i, j]);
  return out;
};

// Per-match length from the slot: floor(slot / total games), capped at 20 min. E.g. 4 teams =
// 6 round-robin + 1 final = 7 games; 180 min slot → floor(180/7)=25 → min(25,20)=20 min each.
// Computed once at generation and stored per match; never re-synced (a captain may override it in
// the live timer). Falls back to 15 min if no slot length is set.
export const perMatchSeconds = (totalGames, slotMinutes) => {
  const slot = Number(slotMinutes) || 0;
  const mins = slot > 0 && totalGames > 0 ? Math.min(Math.floor(slot / totalGames), 20) : 15;
  return Math.max(1, mins) * 60;
};

// Full single round-robin (every team plays every other ONCE) in a randomised order, plus — when
// there are 3+ teams — one knockout FINAL pinned at the end. The final's teams start as a
// placeholder (resolved to the real Top 1 vs Top 2 once every round-robin fixture is played).
export const buildDefaultMatches = (sessionId, teams, slotMinutes) => {
  if (!teams || teams.length < 2) return [];
  const pairs = allPairs(teams);
  const hasFinal = teams.length >= 3;
  const durationSeconds = perMatchSeconds(pairs.length + (hasFinal ? 1 : 0), slotMinutes);
  const matches = shuffle(pairs).map(([a, b], index) => ({
    id: newId('match'),
    sessionId,
    matchNo: index + 1,
    teamA: teams[a].id,
    teamB: teams[b].id,
    scoreA: 0,
    scoreB: 0,
    status: index === 0 ? 'live' : 'scheduled',
    durationSeconds,
  }));
  if (hasFinal) {
    matches.push({
      id: newId('match'), sessionId, matchNo: FINAL_MATCH_NO,
      teamA: teams[0].id, teamB: teams[1].id, // placeholder; resolved when the round-robin completes
      scoreA: 0, scoreB: 0, status: 'scheduled', durationSeconds,
    });
  }
  return matches;
};

// The set of unordered team-pair keys the schedule SHOULD contain for a given team list — used to
// detect when the current fixtures no longer match the teams (team added/removed, or stale/dupe
// rows) so "Generate" knows to rebuild instead of merely reshuffling a wrong schedule.
export const expectedPairKeys = (teams) => allPairs(teams).map(([a, b]) => [teams[a].id, teams[b].id].sort().join('~'));
export const matchPairKey = (m) => [m.teamA, m.teamB].sort().join('~');

// Randomise the ORDER of the existing fixtures only — same rows, same matchups, same scores.
// Pre-game (nothing started) it's a free reshuffle and the new first fixture becomes the current
// one. Once play has begun, only the still-scheduled fixtures move — played/in-progress matches
// keep their slot so results and the running match are never disturbed. Final stays pinned last.
export const shuffleMatches = (matches) => {
  const rr = matches.filter((m) => !isFinalMatch(m));
  const finals = matches.filter(isFinalMatch);
  const started = rr.some((m) => m.status === 'done' || m.startedAt || m.scoreA || m.scoreB);
  let result;
  if (!started) {
    result = shuffle(rr).map((m, i) => ({ ...m, status: i === 0 ? 'live' : 'scheduled' }));
  } else {
    const idxs = [];
    rr.forEach((m, i) => { if (m.status === 'scheduled') idxs.push(i); });
    const pool = shuffle(idxs.map((i) => rr[i]));
    result = [...rr];
    idxs.forEach((pos, k) => { result[pos] = pool[k]; });
  }
  return [
    ...result.map((m, i) => ({ ...m, matchNo: i + 1 })),
    ...finals.map((m) => ({ ...m, matchNo: FINAL_MATCH_NO })),
  ];
};
