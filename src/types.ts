// =====================================================================
// TURF — shared domain types (drop into a Next.js app as types.ts)
// =====================================================================

export type Role = 'organizer' | 'player';
export type Availability = 'available' | 'maybe' | 'out';
export type MatchStatus = 'scheduled' | 'live' | 'done';
export type PayMethod = 'bkash' | 'cash';

export interface Profile { id: string; firstName: string; lastName: string; avatarUrl?: string; }

export interface Session {
  id: string; turfName: string; location: string; slotStart: string; // ISO
  slotMinutes: number; playersPerSide: number; totalFee: number;
  scoring: { win: number; draw: number; loss: number; tiebreakers: ('GD' | 'GF' | 'H2H')[] };
  createdBy: string;
}

export interface SessionMember { sessionId: string; profileId: string; role: Role; }

export interface AvailabilityEntry {
  sessionId: string; profileId?: string; guestName?: string;
  status: Availability; addedBy: string;
}

export interface Team {
  id: string; sessionId: string; name: string; color: string;
  captainId?: string; formationPreset?: string;
}

export interface TeamPlayer { teamId: string; profileId: string; x: number; y: number; roleLabel?: string; }

export interface Match {
  id: string; sessionId: string; matchNo: number; teamA: string; teamB: string;
  scoreA: number; scoreB: number; status: MatchStatus;
  startedAt?: string; pausedAccumSeconds: number; durationSeconds: number;
}

export interface Goal { id: string; matchId: string; teamId: string; scorerId?: string; minute: number; }

export interface Expense { id: string; sessionId: string; label: string; amount: number; createdBy: string; }

export interface Payment {
  sessionId: string; profileId: string; amountDue: number; amountPaid: number;
  method: PayMethod; confirmedBy?: string;
}

export interface StandingRow {
  teamId: string; teamName: string;
  p: number; w: number; d: number; l: number; gf: number; ga: number; gd: number; pts: number;
}
