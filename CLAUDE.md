# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev      # http://localhost:5173, exposed on the LAN (host:true) for phone testing
npm run build    # production build into dist/ — use this as the compile/type check
npm run preview  # serve the production build
```

There is **no test suite, linter, or type-checker configured**. `npm run build` is the only
automated verification — run it after changes to confirm the app still compiles. `.ts` files
(e.g. `src/types.ts`) are reference docs, not compiled; the app is `.jsx`.

## Architecture

Vite + React SPA with **Supabase as the entire backend** (Postgres, Google OAuth, Realtime,
RLS). There is no server code — the browser talks to Supabase directly via the anon key, and
**RLS is the authoritative permission layer**. The UI only mirrors permissions; never treat
client-side role checks as security.

### The data-access seam (mock vs live)
- `src/lib/supabase.js` exports `USE_SUPABASE` (true only when `VITE_USE_SUPABASE=true` and env
  is set) and the `supabase` client (PKCE + `detectSessionInUrl` — do not hand-parse OAuth).
- `src/lib/db.js` is the mock/base dataset. `createDbView(liveData, userId)` in `liveDb.js`
  spreads the mock as a base and overlays live data, so the app shape is identical in both modes.
- `src/lib/liveDb.js` is the only place that issues Supabase queries/RPCs and maps rows
  (`snake_case` columns ↔ `camelCase` app objects via the `map*` functions).

### UI module layout (split from the old single `src/Turf.jsx`)
The UI was extracted from one ~2600-line file into modules; behaviour is unchanged. `npm run
build` output is byte-identical CSS and same-size JS. Map:
- `src/App.jsx` - the orchestrator: state, effects, realtime, role/lock derivation, the `ctx`
  object, screen routing, and the app shell (sidebar/topbar/bottom-bar).
- `src/lib/dataView.js` - the `DATA` proxy + `ACTIVE_DB` + `setActiveDb()` + key helpers
  (`isGuestKey`, `keyFirst`, `keyName`). Shared singleton imported everywhere.
- `src/lib/format.js` - pure helpers (`pad`, `mmss`, `timeOfDay`, `dateLabel`, `taka`, `newId`,
  `buildDefaultMatches`).
- `src/components/` - `Icon.jsx`, `core.jsx` (Avatar/PlayerChip/StatusPill/RoleGate/Field/...),
  `nav.jsx` (Sidebar/BottomTabBar/MoreScreen), `signature.jsx` (StandingsTable/TimerDisplay/
  ScoreStepper/FormationPitch + `computeStandings`).
- `src/screens/` - one file per screen, named for its page: `AuthScreen.jsx`,
  `DashboardScreen.jsx`, `SessionsScreen.jsx`, `DetailScreen.jsx`, `AvailabilityScreen.jsx`,
  `TeamsScreen.jsx`, `FormationScreen.jsx`, `ScheduleScreen.jsx`, `LiveScreen.jsx`,
  `StandingsScreen.jsx`, `HistoryScreen.jsx`, `ExpensesScreen.jsx`, `ProfileScreen.jsx`. Each
  screen takes a single `ctx` prop; single-use sub-components/modals are co-located in their
  screen file. `memberCount` (shared by Dashboard + Sessions) lives in `lib/dataView.js`.
  Mobile vs desktop is NOT split per screen - it lives in `components/nav.jsx` (Sidebar vs
  BottomTabBar) and the `@media` blocks in `styles.css`.

### State, the DATA proxy, and ACTIVE_DB
- `DATA` is a `Proxy` over a mutable module-level `ACTIVE_DB` (in `src/lib/dataView.js`).
  `ACTIVE_DB` is reassigned each render via `setActiveDb(createDbView(liveData, userId))` (an
  imported binding can't be reassigned directly), so `DATA.profile(id)`, `DATA.teams`,
  `DATA.goals`, etc. always read the freshest hydrated data. Reading derived data via `DATA.*`
  is automatically reactive to the latest refresh; you rarely need local copies.
- The App hydrates React state (`matches`, `assign`, `captains`, `availability`, `payments`,
  `expenses`, `members`) from `liveData` whenever it changes.

### Roles & permissions (per session, derived from data — never stored UI flags)
- `creator` = `sessions.created_by` (full control; not a stored member role).
- `organizer` = up to 2 members chosen by the creator (`session_members.role`).
- `player` = any other member.
- `captain` = a member set as a team's `captain_id` (may be creator/organizer/general user,
  never a guest).
- `ctx.canManage = creator || organizer`. Helper functions in `policies.sql`
  (`is_creator`, `is_organizer`, `can_manage_session`, `is_session_captain`, `is_team_locked`)
  are `SECURITY DEFINER` to avoid RLS recursion and are the source of truth.

### "Guests" and player keys
A player is referenced by a **key**: a profile UUID (real member) or `g:<name>` (guest with no
account, added by a manager). Guests are full participants everywhere (teams, formation, goals,
expenses). Helpers `isGuestKey`, `keyFirst`, `keyName` resolve keys; in `liveDb`, guest rows use
`guest_name` instead of `profile_id`.

### Lazy loading + realtime
- `loadSummary` (light: sessions + memberships + profiles) powers the dashboard/nav;
  `loadSessionDetail` (heavy: availability/teams/matches/goals/expenses/payments) is fetched
  only for the **active** session. `loadAppData` composes both.
- A single realtime channel (subscribed once per auth session, debounced) patches changes from
  `matches`, `goals`, `availability`, `payments`, `teams`, `team_players`, `session_members`
  into state. The header **Refresh** button is the manual fallback.
- The live match **clock is derived from the match row**
  (`paused_accum_seconds + (now - started_at)`); `started_at` set ⇒ running. Never store the
  clock in local/localStorage state — that desyncs viewers.

## Critical write patterns (this is where bugs have repeatedly come from)

**An UPSERT triggers the INSERT policy.** Several tables allow non-managers to UPDATE but only
managers to INSERT. So writing with `.upsert()` (used by the bulk `saveX` helpers) gets rejected
by RLS for captains/players even when the row already exists, and the change silently reverts on
refresh. Rules:

- **Availability:** persist the single changed row via `saveAvailabilityRow` (member rows upsert
  on `(session_id, profile_id)` so a player only ever writes their own row). Never re-save the
  whole pool.
- **Live match score/clock/status:** use `updateMatch` (a plain `.update()`, hits only
  `matches_update` which allows captains) via `ctx.updateMatch`. Do **not** route live control
  through `saveMatches`/`ctx.setMatches` (those upsert and are manager-only). `setMatches` is
  fine for manager-only bulk ops (generate/reorder fixtures).
- **Formation:** a captain may be a general user, so a direct `teams` UPDATE is blocked by RLS.
  Saves go through the `save_formation(p_team, p_formation)` SECURITY DEFINER RPC (captain or
  manager), which writes only the formation columns. The whole board (preset + on-pitch list +
  x/y) is stored atomically as `teams.formation jsonb`.
- **Optimistic IDs:** `newId()` returns a real UUID (`crypto.randomUUID`), so optimistic rows can
  be inserted directly. The bulk save helpers gate optimistic-vs-real ids with `isUuid`.

## Database

Run `supabase/schema.sql` first, then `supabase/policies.sql` in the Supabase SQL editor; both
are **idempotent and safe to re-run**. `schema.sql` holds tables, triggers
(`handle_new_user`, `handle_new_session`), and RPCs (`join_session`, `peek_session`,
`gen_join_code`); the guest/PK migrations within it must drop a primary key **before** dropping
`NOT NULL` on a column that was part of it. `policies.sql` holds the RLS helper functions,
policies, `save_formation`, and the realtime publication. When you add a column/RPC the app
relies on, update the matching `.sql` and tell the user to re-run it — there is no migration tool.

## Conventions

- Write new source/comments in **ASCII** (a past one-shot encoding-repair script corrupted
  genuine em-dashes/apostrophes into mojibake; avoid reintroducing non-ASCII).
- Keep the build green (`npm run build`) and follow the existing inline-style + utility-class
  (`row`, `card`, `pill`, `btn`, `seg`) idiom in `Turf.jsx`/`styles.css`.
