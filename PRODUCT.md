# Product

## Register

product

## Users

A single, tight-knit friend group that rents turf for casual pickup football. Two contexts:
- **Before the match (planning, at home / on the go):** an organizer/creator sets up a session,
  players mark availability, managers build balanced teams, captains set formations, the fee is
  split. Mostly phone, some desktop.
- **On the touchline (live, on a phone, one-handed, outdoors in daylight):** a captain/organizer
  runs the match clock, taps scores and goal-scorers, and everyone watches the live standings
  update. Glanceability and big tap targets matter most here.

The job to be done: "sort the squad, run the match, split the bill" with zero spreadsheet
friction, and make matchday feel like a real broadcast event.

## Product Purpose

A multi-tenant PWA for organizing pickup/turf football: availability pool, balanced team builder,
drag-and-drop tactical formation board, a live match timer with scores and goal scorers, an
auto-sorted standings table + match history, and a fair turf-fee split. Supabase backend with RLS;
roles (creator/organizer/captain/player) derived from data. Logic and features tested at 10/10 by
real users; this redesign targets the UI/UX, which testers flagged as the weak point. Success =
the app *looks and feels* as good as it works, on a phone, on matchday.

## Brand Personality

Broadcast-grade, energetic, precise. Three words: **live, confident, sporting.** It should feel
like a sports app you'd actually want open during a game — the quiet authority of Linear's shell,
the matchday adrenaline of FotMob/SofaScore's live cards, and the sport-brand confidence of
Strava. Never corporate, never a generic admin dashboard.

## Anti-references

- **The current build's flat, under-designed look** (the thing testers flagged): weak hierarchy,
  green-drenched panels with low contrast, uniform cards, no live energy.
- **Generic SaaS / admin-dashboard aesthetic** — identical icon+heading+text card grids, the
  hero-metric template, cream/sand "warm-neutral" backgrounds, tiny tracked uppercase eyebrows.
- **Loud, toy-like gamification** — this is competitive sport, not a kids' game; energy comes from
  type, motion, and decisive color, not confetti.

## Design Principles

1. **Matchday first.** The live match, the score, and the table are the heroes; design the rest to
   get out of their way. Glanceable at arm's length, in daylight, one-handed.
2. **One system, every screen.** Synthesize the references into a single design language and apply
   it consistently — a viewer should never feel they changed apps between Live, Standings, and
   Expenses.
3. **Numbers are the typography.** Scores, clocks, points, and money are the loudest elements;
   tabular, confident, unmistakable.
4. **Football soul, modern execution.** Keep pitch motifs, jersey-color team coding, and the
   tactical board — but render them sharp and contemporary, not skeuomorphic.
5. **Earned restraint.** Dark, quiet surfaces so the live/brand accent and team colors carry all
   the energy. Color means something (live, team, paid/due, in/out).

## Accessibility & Inclusion

- **WCAG AA** contrast on all text and controls (body >=4.5:1, large text >=3:1), including in
  outdoor daylight glare — bias dark surfaces toward true contrast, not low-contrast "elegance".
- **Reduced motion:** every animation (live pulse, score tick, reveals) has a
  `prefers-reduced-motion: reduce` crossfade/instant fallback.
- **Colorblind-safe team coding:** teams are color-coded everywhere; never rely on hue alone —
  pair every team color with its name/initial/jersey number so red-green or blue-purple confusion
  never blocks a user.
- **Touch targets** >=44px on matchday controls (score steppers, clock, availability toggles).
