/* =====================================================================
   TURF — mock data (plain JS, attaches window.DB)
   All records conform to the types in types.ts. Names are the real crew
   from the organizer's manual spreadsheet.
   ===================================================================== */
import { firstLetter } from './format.js';

export const DB = (function () {
  const now = Date.now();
  const MIN = 60 * 1000;
  const iso = (ms) => new Date(ms).toISOString();

  /* ---- Profiles (the crew) ---------------------------------------- */
  const roster = {
    A: ['Hossain Bhai', 'Moin Bhai', 'Jarif Bhai', 'Rishad', 'Sabbir'],
    B: ['Imtiaz', 'Fuad', 'Dhrubo', 'Asifur', 'Rayan', 'Om', 'Tahseen'],
    C: ['Wasi', 'Jawad', 'Reddy', 'Shamraj', 'Minhaj', 'Nuhad'],
    D: ['Hassan', 'Ishmahi', 'Abrar', 'Ramin', 'Taysir', 'Ronku', 'Mush'],
    E: ['Musa', 'Tawhidul', 'Mahdi', 'Shahzad', 'Dibbo', 'Afeef'],
  };
  const profiles = [];
  const teamRoster = { A: [], B: [], C: [], D: [], E: [] };
  let pid = 0;
  for (const key of Object.keys(roster)) {
    for (const full of roster[key]) {
      pid += 1;
      const parts = full.split(' ');
      const id = 'p' + pid;
      profiles.push({ id, firstName: parts[0], lastName: parts.slice(1).join(' ') });
      teamRoster[key].push(id);
    }
  }
  const byName = (n) => profiles.find((p) => (p.firstName + ' ' + p.lastName).trim() === n);

  /* ---- Teams ------------------------------------------------------- */
  const teams = [
    { id: 'tA', sessionId: 's1', name: 'Team A', color: '#E5484D', captainId: teamRoster.A[0], formationPreset: '1-2-1' },
    { id: 'tB', sessionId: 's1', name: 'Team B', color: '#3E7BFA', captainId: teamRoster.B[0], formationPreset: '2-1-1' },
    { id: 'tC', sessionId: 's1', name: 'Team C', color: '#F5A623', captainId: teamRoster.C[0], formationPreset: '1-2-1' },
    { id: 'tD', sessionId: 's1', name: 'Team D', color: '#9B6DFF', captainId: teamRoster.D[0], formationPreset: '2-1-1' },
    { id: 'tE', sessionId: 's1', name: 'Team E', color: '#15C2A8', captainId: teamRoster.E[0], formationPreset: '1-2-1' },
  ];
  const teamKeyById = { tA: 'A', tB: 'B', tC: 'C', tD: 'D', tE: 'E' };
  const teamPlayers = {};
  teams.forEach((t) => { teamPlayers[t.id] = teamRoster[teamKeyById[t.id]].slice(); });

  /* ---- Sessions ---------------------------------------------------- */
  const scoring = { win: 3, draw: 1, loss: 0, tiebreakers: ['GD', 'GF', 'H2H'] };
  const sessions = [
    {
      id: 's1', turfName: 'Touchline Turf', location: 'Block C, Bashundhara R/A, Dhaka',
      slotStart: iso(now - 25 * MIN), slotMinutes: 150, playersPerSide: 5, totalFee: 6000,
      scoring, createdBy: teamRoster.A[0], status: 'live',
    },
    {
      id: 's2', turfName: 'Touchline Turf', location: 'Block C, Bashundhara R/A, Dhaka',
      slotStart: iso(now + 3 * 24 * 60 * MIN + 90 * MIN), slotMinutes: 150, playersPerSide: 5, totalFee: 6000,
      scoring, createdBy: teamRoster.A[0], status: 'upcoming',
    },
    {
      id: 's0', turfName: 'Arena Turf', location: 'Mohakhali DOHS, Dhaka',
      slotStart: iso(now - 7 * 24 * 60 * MIN), slotMinutes: 120, playersPerSide: 5, totalFee: 5000,
      scoring, createdBy: teamRoster.A[0], status: 'done',
    },
  ];

  /* ---- Session members (roles) ------------------------------------ */
  const members = [];
  profiles.forEach((p) => members.push({ sessionId: 's1', profileId: p.id, role: 'player' }));
  // organizers
  [teamRoster.A[0], teamRoster.B[0]].forEach((id) => {
    const m = members.find((x) => x.profileId === id); if (m) m.role = 'organizer';
  });

  /* ---- Availability pool (for upcoming s2) ------------------------- */
  const pickStatus = (i) => (i % 7 === 0 ? 'out' : i % 4 === 0 ? 'maybe' : 'available');
  const availability = profiles.slice(0, 18).map((p, i) => ({
    sessionId: 's2', profileId: p.id, status: pickStatus(i), addedBy: p.id,
  }));
  // organizer-added existing member + a one-off guest
  availability.push({ sessionId: 's2', profileId: profiles[20].id, status: 'available', addedBy: teamRoster.A[0] });
  availability.push({ sessionId: 's2', guestName: 'Rafiul (Imtiaz +1)', status: 'available', addedBy: teamRoster.A[0] });
  availability.push({ sessionId: 's2', guestName: 'Tonmoy', status: 'maybe', addedBy: teamRoster.A[0] });

  /* ---- Match schedule (from the manual fixture list) -------------- */
  const fixtureBase = [
    ['tA', 'tB'], ['tC', 'tD'], ['tA', 'tE'], ['tB', 'tC'], ['tD', 'tE'],
    ['tA', 'tC'], ['tB', 'tE'], ['tA', 'tD'], ['tC', 'tE'], ['tB', 'tD'],
  ];
  // slot starts at 16:30, each match 15 min
  const slot0 = new Date(sessions[0].slotStart).getTime();
  const results = { 0: [2, 1], 1: [0, 3], 2: [1, 1], 3: [2, 2] }; // M1-M4 done
  const matches = fixtureBase.map((pair, i) => {
    const status = i < 4 ? 'done' : i === 4 ? 'live' : 'scheduled';
    const sc = results[i] || (i === 4 ? [1, 0] : [0, 0]);
    return {
      id: 'm' + (i + 1), sessionId: 's1', matchNo: i + 1, teamA: pair[0], teamB: pair[1],
      scoreA: status === 'scheduled' ? 0 : sc[0], scoreB: status === 'scheduled' ? 0 : sc[1],
      status, startedAt: i === 4 ? iso(now - 6 * MIN) : (i < 4 ? iso(slot0 + i * 15 * MIN) : undefined),
      pausedAccumSeconds: i === 4 ? 372 : 0, durationSeconds: 15 * 60,
    };
  });

  /* ---- Goals (scorer tags for played matches) --------------------- */
  const goals = [
    { id: 'g1', matchId: 'm1', teamId: 'tA', scorerId: teamRoster.A[1], minute: 4 },
    { id: 'g2', matchId: 'm1', teamId: 'tA', scorerId: teamRoster.A[3], minute: 9 },
    { id: 'g3', matchId: 'm1', teamId: 'tB', scorerId: teamRoster.B[2], minute: 12 },
    { id: 'g4', matchId: 'm2', teamId: 'tD', scorerId: teamRoster.D[1], minute: 3 },
    { id: 'g5', matchId: 'm2', teamId: 'tD', scorerId: teamRoster.D[1], minute: 7 },
    { id: 'g6', matchId: 'm2', teamId: 'tD', scorerId: teamRoster.D[4], minute: 14 },
    { id: 'g7', matchId: 'm5', teamId: 'tD', scorerId: teamRoster.D[0], minute: 5 },
  ];

  /* ---- Expenses & payments ---------------------------------------- */
  const expenses = [
    { id: 'e1', sessionId: 's1', label: 'Turf rent (2.5 hrs)', amount: 6000, createdBy: teamRoster.A[0] },
    { id: 'e2', sessionId: 's1', label: 'Bibs + water', amount: 350, createdBy: teamRoster.A[0] },
    { id: 'e3', sessionId: 's1', label: 'Extra 15 min', amount: 600, createdBy: teamRoster.A[0] },
  ];
  const headcount = 24;
  const due = Math.round((6000 + 350 + 600) / headcount); // ~290
  const payments = profiles.slice(0, headcount).map((p, i) => {
    const paid = i % 3 !== 0; // 2/3 have paid
    return {
      sessionId: 's1', profileId: p.id, amountDue: due,
      amountPaid: paid ? due : 0, method: i % 2 === 0 ? 'bkash' : 'cash',
      confirmedBy: paid ? teamRoster.A[0] : undefined,
    };
  });

  /* ---- Current viewer --------------------------------------------- */
  const currentUserId = teamRoster.A[0]; // Hossain Bhai — organizer + captain of Team A

  return {
    now, profiles, teams, teamPlayers, sessions, members, availability,
    matches, goals, expenses, payments, currentUserId, scoring,
    profile: (id) => profiles.find((p) => p.id === id),
    team: (id) => teams.find((t) => t.id === id),
    initials: (id) => {
      const p = profiles.find((x) => x.id === id);
      if (!p) return '?';
      return (firstLetter(p.firstName) + (p.lastName ? firstLetter(p.lastName) : firstLetter(p.firstName.slice(1)))).toUpperCase();
    },
    name: (id) => { const p = profiles.find((x) => x.id === id); return p ? (p.firstName + (p.lastName ? ' ' + p.lastName : '')) : '—'; },
    first: (id) => { const p = profiles.find((x) => x.id === id); return p ? p.firstName : '—'; },
  };
})();
