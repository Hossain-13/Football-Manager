# TURF — Build Log & Handoff Doc

> Living document. Updated continuously during the build so anyone (or a future chat) can
> see exactly what was decided, what's done, and what's left. **If a session ends mid-build,
> start by reading the "Where we left off" section at the bottom.**

Last updated: 2026-06-24



## What we're building
**TURF** — a pickup/turf football session manager for one friend group. Replaces the manual
MS-Paint + paper + notes-app workflow with: availability pool, random+manual team builder,
SVG formation board, live match timer, auto-sorted standings, saved match history, and a
fee/expense tracker. Mobile + PC, free-tier hosting. Full product spec lives in the approved
plan: `C:\Users\Administrator\.claude\plans\i-ll-describe-you-the-lazy-snowglobe.md`.

The frontend was designed separately in **Claude Design** and exported to `design-export/`.
This build ports that design into a real, deployable app wired to a backend.

---

## Key architecture decisions (and *why*)

### 1. Stack: **Vite + React (SPA) + Supabase** — *changed from Next.js in the plan*
The plan said Next.js, but the Claude Design output is a **pure client-side React app** and
Supabase already provides everything a backend would (Postgres, Google auth, realtime, and
Row-Level-Security). So an SSR framework adds complexity with no benefit here.
- **Vite + React** = the design ports over with near-zero transformation, fast dev server,
  tiny build. Deploys free on Vercel/Netlify exactly like Next would.
- **Supabase** = DB + Google OAuth + Realtime (live table/timer) + **RLS** (the real security
  layer — players physically cannot write to payments/matches even via the API).
- Net effect: less code, faster build, same free deploy, same capabilities. Documented here
  as a deliberate deviation.

### 2. Styling: **keep `styles.css` as-is** — *changed from Tailwind in the plan*
The design shipped a complete, polished `styles.css` (CSS variables = the source of truth for
the look). Converting it to Tailwind would be pure busywork and risk breaking the look. We
keep it as a global stylesheet. (Tailwind can be layered later if ever needed.)

### 3. Port strategy: **single UI module, mechanical transform**
The prototype used a browser-global pattern (`window.Foo = Foo`, Babel-in-browser). Rather
than hand-rewrite ~1500 lines, we concatenate the design's component/screen files into one
ES module (`src/Turf.jsx`), stripping the `window.*` registrations and the React-global
destructure, and add proper `import`s. All components share one module scope, so their
existing cross-references keep working unchanged. Faithful to the design, minimal risk.

### 4. Data-access seam: **mock-first with a Supabase flag**
`src/lib/db.js` holds the ported mock data (exported as `DB`) so the app runs and is testable
**immediately** with zero backend setup. A `VITE_USE_SUPABASE` flag + `src/lib/supabase.js`
introduce the real client. Screens read/write through this seam, so swapping mock → live is
localized, not a rewrite. (Live wiring is staged — see roadmap.)

### 5. Security model (enforced in DB, mirrored in UI)
- **Player**: self-only availability; read everything; no writes to teams/results/payments.
- **Organizer**: session + teams + captains + expenses/payments. Can edit teams **even after
  the 2h lock** (the lock is players-only — per the user's correction).
- **Captain**: the *only* role that can run the live clock + enter scores (so a sitting team's
  captain can keep the board while organizers play).
- **2-hour lock**: freezes pool/teams/formation **for players only**; organizers bypass it.
- All enforced by **Supabase RLS** (authoritative) and mirrored by UI gating (`RoleGate`).

---

## Project layout (target)
```
F:\Football Manager\
  design-export/        # original Claude Design prototype (reference, untouched)
  src/
    main.jsx            # React entry
    Turf.jsx            # ported UI (all components + screens + app shell)
    styles.css          # design stylesheet (copied from export)
    types.ts            # shared domain types (copied from export)
    lib/
      db.js             # data-access layer: mock data now, Supabase seam
      supabase.js       # Supabase client (+ USE_SUPABASE flag)
  public/
    manifest.webmanifest, icon.svg, sw.js   # PWA (installable on phone/PC)
  supabase/
    schema.sql          # tables + indexes
    policies.sql        # RLS policies (roles, 2h lock, anti-tamper)
  index.html            # Vite entry
  package.json, vite.config.js, .env.example, README.md
  BUILD_LOG.md          # this file
```

---

## Progress checklist
- [x] Node.js installed (v24.16.0, npm 11.13.0) via winget
- [x] Architecture decided + documented (this file)
- [x] Vite + React project scaffolded (package.json, vite.config.js, index.html, main.jsx)
- [x] Design ported → `src/Turf.jsx` (1491 lines: icons, components, nav, signature, 12 screens, app shell)
- [x] Data-access layer: `src/lib/db.js` (mock) + `src/lib/supabase.js` (flagged client seam)
- [x] Supabase SQL: `supabase/schema.sql` (10 tables, triggers, indexes) + `supabase/policies.sql` (RLS)
- [x] PWA: manifest + icon.svg + service worker (registered in main.jsx, prod only)
- [x] `npm install` (72 pkgs), `npm run build` (✓ 32 modules, no errors), dev server smoke test (HTTP 200)
- [x] Removed the top-bar design-preview strip from the real app (`Org/Player/Captain/Locked/PC-Phone` toggles are gone)
- [x] Roles/captain access now derive from session data for the current user instead of manual preview toggles
- [x] Phone vs PC layout is viewport-driven through CSS media queries instead of a manual device toggle
- [x] Onboarding collects first name, last name, and two preferred positions after the Google entry step
- [x] Player lock is auto-computed from kickoff time and applies only to non-organizers
- [x] Expenses now include only players assigned into actual teams; the unassigned pool and broader user list do not contribute
- [x] Added Vercel SPA config and `DEPLOYMENT.md` readiness/runbook docs
- [x] Live Supabase auth/data spine: Google auth, onboarding profile save, live reads, core writes, and realtime refresh
- [ ] (next session) Deploy to Vercel + Supabase

## Last-minute change audit (2026-06-14)
- **Preview strip**: done in `src/Turf.jsx`. The real app shows only status badges for actual organizer/captain/locked state.
- **Roles from data**: done in mock and live modes. `role` is derived from session membership; the session creator is the admin and can choose two organizers per session.
- **PC/phone dynamic**: done in `src/styles.css` with responsive media queries.
- **Onboarding positions**: done in `AuthScreen`; live persistence to `profiles.pref_pos_1/pref_pos_2` waits on Supabase auth wiring.
- **2h lock**: done in UI for players only; RLS policies also encode the players-only lock behavior.
- **Fresh real backend + deploy**: live wiring is now in code. Needs real Supabase dashboard smoke testing, organizer bootstrap, then Vercel deployment.
- **Expenses contributors**: done. The Expenses screen derives contributors from assigned team columns, excluding `pool`, so only selected team players split the bill.
- **Deployment prep**: done for preview deployment (`vercel.json`, `DEPLOYMENT.md`). Real-user deployment now needs smoke testing with the connected Supabase project.

## Next session — live Supabase wiring (the seam is ready)
Each screen currently reads `DB.*` (mock) and mutates React state. To go live, route those
through `src/lib/db.js`, branching on `USE_SUPABASE`:
1. **Auth**: swap mock `AuthScreen.onDone` for `supabase.auth.signInWithOAuth({provider:'google'})`;
   on first login write `first_name`/`last_name` to `profiles`; derive `currentUserId` from the session.
2. **Reads**: async fetchers in `db.js` (sessions, members→roles, availability, teams, team_players,
   matches, goals, expenses, payments) keyed by `session_id`; map snake_case→camelCase.
3. **Writes**: availability self-toggle / organizer-add / guest, team shuffle+move+captain, formation
   x/y, schedule gen, score/timer/status, goals, expenses, payments → `supabase.from(...).upsert/update`.
   RLS already enforces *who* may write; surface denials as a toast.
4. **Realtime**: per-session channel on `matches`/`goals`/`availability`/`payments` → refresh state so
   the live table + timer sync across phones.
5. **Timer**: persist `started_at` + `paused_accum_seconds` to `matches` (columns exist) instead of the
   prototype's `localStorage` key `turf_timer_<id>`, so the clock is server-synced.
- **Role nuance**: the 2h lock is **players-only** — mirror in UI by using
  `isPlayerLocked = locked && role !== 'organizer'` (DB already encodes this in the `avail_*` policies).
- **Open decision** (see `policies.sql`): live score/timer updates currently allow **captains OR
  organizers** (organizer kept as admin fallback). UI already gates to captains. For strictly
  captain-only at the DB, remove `is_organizer(...)` from `matches_update` and `goals_write`.

---

## Current deployment next steps
The live wiring is now in code behind `VITE_USE_SUPABASE=true`. Use `DEPLOYMENT.md` as the active runbook. The next practical step is a Supabase smoke test: run the SQL, confirm Google OAuth, sign in locally, create the first session, promote organizers, test with a second account, then deploy to Vercel.

## Supabase role/schedule repair (2026-06-14)
- [x] Split session `admin` from per-session `organizer`; session creator is repaired/promoted to `admin`.
- [x] Admin UI added on Session Detail to select up to two organizers from registered profiles for that specific session.
- [x] Team Builder/captain assignment now requires admin/organizer access; players cannot edit teams just because the 2h lock has not started.
- [x] New live sessions create default teams and a starter schedule; partial sessions with no matches show a recovery screen instead of blanking the app.
- [x] Active-session match state is scoped per session, preparing the app for distinct sessions with different organizers.

## Where we left off
See the **v2 REDESIGN PROGRESS** section below — that is now the active workstream.

---

# v2 REDESIGN PROGRESS (multi-tenant / public)
Active plan: `C:\Users\Administrator\.claude\plans\i-ll-describe-you-the-lazy-snowglobe.md`
(role model = Creator/Organizer/Player, join-by-code, Dashboard+My Sessions nav, 1h players-only
lock, In/Out availability, auth fix). **Strict one-step-at-a-time; test each on localhost before next.**

## ⭐ RESUME HERE (read first when re-opening this project)
**Current position:** Steps 0–2 PASSED; Steps 3–4 code shipped. **Round-2 feedback (2026-06-21)
surfaced bugs + edits — roadmap renumbered to 5–14 (see plan's "ROUND-2 FEEDBACK").** Next = **Step 5
(Auth & entry fixes)**, the highest priority because it unblocks real/mobile testing.
- **Step checklist (statuses):**
  - [x] 0 Auth foundation (PKCE) — PASSED
  - [x] 1 Schema + RLS migration — PASSED
  - [x] 2 Onboarding contact + mojibake fix — PASSED
  - [x] 3 Data layer refactor (summary + lazy per-session) — code shipped
  - [x] 4 Nav restructure (Dashboard + My Sessions + collapsible) — code shipped
  - [ ] 5 **Auth & entry FIXES** — mobile/LAN login (#5), reload→onboarding (#2), route to Dashboard +
        Get started/Welcome back modals (#6), logout (#7), onboarding polish, sign-in/RLS audit (#8)
  - [ ] 6 Dashboard content + flags (expenses/goals history, self-mark/team/captain/formation flags)
  - [ ] 7 My Sessions + Join-by-code · [ ] 8 Add Session + delete/CRUD (24h rule)
  - [ ] 9 Organizers picker in Availability · [ ] 10 Team Builder rework (view-only, Add-team popup,
        Randomise, captain "C") · [ ] 11 Formation rework + view-gating (team roster bar, per-role edit)
  - [ ] 12 Schedule refresh+reorder · [ ] 13 Concurrency/visibility polish · [ ] 14 Deploy
- **How to run (Node not on PATH):** prefix shell with `$env:Path="$env:ProgramFiles\nodejs;"+$env:Path`,
  or call `npm.cmd`. User's own terminal needs `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.
  Build check = `npm run build`. Dev = `npm run dev` → localhost:5173 (+ LAN for phone).
- **Live mode is ON:** `.env` has `VITE_USE_SUPABASE=true` + real project URL/anon key. Mock mode = flag false.
- **Gotcha:** the one-shot encoding-repair script also "fixes" genuine em-dashes/apostrophes you add —
  so write NEW source comments/strings in ASCII, or re-check for `�` after any such script.
- **Protocol:** make ONE step → tell user exactly what to test → they confirm on localhost → next step.
  Keep this file updated after every step. Plan file has the full spec + role/permission matrix.

### KNOWN BUG to fix at Step 2 (onboarding): text encoding / mojibake
Non-ASCII chars in `src/Turf.jsx` (and possibly `src/lib/db.js`) are corrupted UTF-8→Win1252
mojibake from the original concatenation: `…`→`â€¦`, `'`→`â€™`, `—`→`â€"`, emoji→`ðŸ™‚`.
Visible on the onboarding "Select…" dropdowns + the auth footer emoji. **Fix at Step 2** with a
file-wide re-encode/replace pass (it affects every screen's apostrophes/dashes, not just onboarding).

### Step 0 — Auth foundation ✅ PASSED (user confirmed: login + profile row + persist all work)
- `src/lib/supabase.js`: client now uses `auth: { persistSession, autoRefreshToken,
  detectSessionInUrl, flowType:'pkce' }` so supabase-js handles the Google `?code=` callback.
- Removed the implicit-flow hand-parser: deleted `completeOAuthFromUrl` from `src/lib/liveDb.js`
  and its import/usage in `src/Turf.jsx` (auth effect now just calls `getSession()`).
- Wrote `AUTH_SETUP.md` — exact numbered Google Cloud + Supabase setup the user follows once.
- Build verified clean (75 modules).
- **NEXT:** user follows `AUTH_SETUP.md`, confirms Google login + profile row + session persist on
  localhost. On confirmation → Step 1 (schema + RLS migration).

### Step 1 — Schema + RLS migration ✅ code done, awaiting user's Supabase run
- `supabase/schema.sql` rewritten + made **re-runnable/migration-safe**: adds `profiles.contact`,
  `sessions.join_code` (UNIQUE NOT NULL + `gen_join_code()` default, backfilled), `session_members.joined_at`
  + role check `(organizer|player)` (migrates old `admin`→`organizer`), availability status check
  `(available|out)` (migrates `maybe`→`out`), creator-as-organizer trigger, and the **`join_session(code)`
  RPC** (validates code → `INVALID_CODE`; overlap check → `TIME_CLASH`; else inserts player membership).
- `supabase/policies.sql` rewritten: `is_admin`→**`is_creator`**, `can_manage_session = creator OR organizer`,
  **`is_team_locked` = 1 hour** (players only), members writes = creator-only, matches/goals writable by
  captain OR managers, teams/expenses/payments by managers. Re-runnable (drops policies first).
- `src/lib/liveDb.js`: added `joinSession(code)` (maps INVALID_CODE/TIME_CLASH) + `joinCode` in `mapSession`.
- Build verified clean.
- **NEXT:** user runs `schema.sql` then `policies.sql` in Supabase SQL editor (no errors) + verification
  queries. On confirmation → Step 2 (onboarding contact field + mojibake fix).

### Step 1 — Schema + RLS migration ✅ PASSED (user ran schema.sql + policies.sql; functions confirmed)

### Step 2 — Onboarding contact + encoding fix ✅ code done, awaiting user's local test
- `AuthScreen` now collects **Contact** (phone/handle) alongside name + 2 positions; `canEnter` and
  `submitProfile` include it. `saveProfile`/`mapProfile` persist+read `profiles.contact`; App's
  `needsOnboarding` now also requires `contact` (so existing users get prompted once to add it).
- **Mojibake fixed file-wide** in `src/Turf.jsx` via a one-shot Win1252→UTF-8 repair script (now deleted):
  `â€¦`→`…`, `â€™`→`'`, `â€"`→`—`, `ðŸ™‚`→`🙂`, etc. 0 mojibake markers remain. Only Turf.jsx was affected.
- Build verified clean.
- **NEXT:** user reloads localhost (existing profile lacks contact → onboarding form reappears, name/positions
  prefilled), fills Contact, confirms it saves to `profiles.contact`, and that the garbled text is gone.

### Step 3 — Data layer refactor ✅ code done, awaiting test
- `src/lib/liveDb.js`: split the monolithic `loadAppData` into **`loadSummary(userId)`** (profiles +
  my sessions + memberships only — cheap) and **`loadSessionDetail(sessionId)`** (the heavy tables for
  ONE session). `loadAppData(userId, activeSessionId)` now composes summary + only the active session's
  detail, so we no longer fetch every session's availability/teams/matches/etc. up front.
- `src/Turf.jsx`: `refreshLiveData` takes a target session (via `activeIdRef`); new `openSession(id)`
  sets active + lazy-loads that session's detail; ctx uses `openSession`. Live/active session stays
  resident so Standings/History compute from memory. (Realtime scoping/debounce is Step 10.)

### Step 4 — Nav restructure ✅ code done, awaiting test
- `Sidebar` rewritten: top items **Dashboard** + **My Sessions**, then a **collapsible list of my
  sessions**; expanding one reveals that session's 9 feature pages; clicking a feature opens that session
  + page. Active session auto-expands and is highlighted.
- New **`DashboardScreen`** (Ongoing / Upcoming / Recent groups of my sessions; Step 5 enriches it).
- `BottomTabBar` tabs → Home(Dashboard) / Sessions / Live / Table / More; `MoreScreen` lists the active
  session's pages. `SessionsScreen` renamed "My Sessions", real member counts. Default screen = dashboard.
- Removed unused `NAV_MAIN`; small CSS for active-session nav head. Build clean (75 modules).
- **NEXT (tests both 3 & 4):** user logs in → lands on Dashboard; nav shows Dashboard + My Sessions +
  collapsible session menu; opening a session loads only its data; all feature pages still work.

### ROUND-2 FEEDBACK LOG (2026-06-21) — bugs + edits from user review
Full detail in the plan file ("ROUND-2 FEEDBACK"). Summary:
- **Bugs:** #5 mobile/LAN Google login fails (redirect hardcoded to localhost) · #2 reload lands on
  post-signup page · #6 forced "create first session" + wrong routing · #8 non-test-user sign-in concern
  (audit RLS isolation) · #7 no logout button.
- **Onboarding UI:** nicer position dropdown; placeholders → John/Doe; reword footer + remove emoji.
- **Entry:** route to Dashboard after onboarding; Get started (1st) / Welcome back (returning) modals over
  blurred bg.
- **Dashboard:** add sessions overview, expenses history (total + remaining), past goals/tags history,
  upcoming flags (self-mark/team-alloc done?), organizer flags (captain/player-guest/team/formation done?).
- **Team Builder:** general view-only; Randomise creates+distributes; Add-team popup asks Team Name;
  captain "C" highlight.
- **Formation:** add FIFA-style team roster bar; per-role edit (creator/org any, captain own, others view).
- **Sessions CRUD:** creator delete (cascades to joined users) but blocked within 24h of slot; audit CRUD.
- **Concurrency:** edits must be visible to all users at once; latency/loading for concurrent users.
→ Renumbered roadmap to Steps 5–14. **Next: Step 5 (Auth & entry fixes).** Not yet started.

### Step 5 — Auth & entry fixes ✅ code done, awaiting test (needs Supabase Redirect URL + policies re-run)
- **#5 mobile/LAN login:** `signInWithGoogle` now redirects to `window.location.origin` (not hardcoded
  localhost). **User must add their LAN origin (e.g. `http://192.168.x.x:5173`) to Supabase → Auth → URL
  Configuration → Redirect URLs.** Auth effect also strips `?code=`/`#access_token` from the URL after login.
- **#2/#6 reload→post-signup + routing:** removed the forced "Create your first session" full-page; users
  with zero sessions now land on the **Dashboard** (its own empty state). Guarded `titles.detail` for the
  no-session case. Dropped `createStarterSession` usage/import.
- **#6 modals:** Get started (first login) / Welcome back (returning) modal over a blurred backdrop
  (`welcome` state + `localStorage turf_welcomed_<uid>`); dismiss → dashboard. CSS `.modal-backdrop/.modal-card`.
- **#7 logout:** `signOut` wired to `ctx.logout`; Log out button in the topbar + Profile screen.
- **Onboarding polish:** placeholders → John/Doe; footer reworded, emoji removed; `select.input` restyled
  with a custom chevron + hover (less "blunt").
- **#8 security:** `policies.sql` — new `shares_session()` + `profiles_read` tightened to **self OR
  co-session members** (no longer world-readable; protects names/contacts). **User must re-run policies.sql.**
- Build verified clean (75 modules).
- **NEXT (user test):** re-run `policies.sql`; add LAN origin to Supabase Redirect URLs; restart dev; test
  desktop (land on Dashboard, modals, logout, reload stays put, polish) + **mobile login over LAN**; confirm a
  non-co-member account can't read your profile/sessions.

### Step 5 follow-up fixes (after user round-1 test)
- **Blank page on "Create session" (new user):** session-scoped screens now render a "No session selected"
  placeholder when there's no active session (instead of crashing/blanking). The "New session" button is
  **disabled** until Step 7/8 builds the real create+join.
- **Back button jumped to Google:** `go()` now `pushState`s an in-app history entry and a `popstate`
  handler restores the previous screen, so Back navigates within the app.
- **Mobile login + "not secure":** NOT a code bug — it's plain-HTTP-on-LAN + OAuth. Redirect code is correct
  (returns to current origin). Reliable mobile test needs **HTTPS** (Vercel deploy or a tunnel). Pending the
  user's choice; desktop auth/flows all pass.

### Steps 6–8 — Dashboard / Join-by-code / Add+Delete ✅ code done, awaiting test
- **Step 6 Dashboard:** `loadDashboardStats(userId)` (cross-session aggregates, RLS-scoped) → stat cards
  (Sessions, Spent, Outstanding, Goals) + per-session **flag chips** (You're IN / Not marked, N teams /
  No teams, Captains set) + CREATOR/ORGANIZER tags. Loaded when the dashboard is shown (`ctx.dashStats`).
- **Step 7 Join-by-code:** new `peek_session(code)` RPC (preview without joining: creator, slot, fee/person,
  clash flag) → `JoinConfirmModal` (blocks on clash) → `join_session` RPC joins as player → opens session.
  Invalid code + clash surfaced as friendly messages.
- **Step 8 Add + Delete:** `AddSessionModal` (turf/location/kick-off/slot/side/fee) → `createSession` →
  becomes creator + share code; Detail shows **SHARE CODE** (copy) + creator-only **Delete** (disabled +
  RLS-blocked within 24h of kick-off, cascades to joined users). `ctx.reload/me` added; "admin"→"Creator".
- **SQL changes (user must re-run):** `schema.sql` adds `peek_session`; `policies.sql` `sessions_delete`
  now requires `slot_start - now() > 24h`.
- Build clean (75 modules).
- **NEXT (user test):** re-run schema.sql + policies.sql; restart; test dashboard flags, Add Session (code
  shown), Join by code from a 2nd account (+ invalid + clash), and delete (allowed >24h, blocked <24h).

### Steps 6–8 follow-up fixes (after user test)
- **DATA-LOSS FIX (critical):** `saveSessionMembers` was delete-all-then-reinsert against the creator's
  (possibly stale) member list → could wipe a freshly-joined player (session vanished for them). Now
  **upsert-only** (never deletes); added surgical `setOrganizerRole`. Organizer toggle is optimistic +
  shows "Organizer added/removed" feedback.
- **Organizer count bug:** showed 2/2 with 1 picked because the creator's own `organizer` membership was
  counted. Now `organizerIds` **excludes the creator**; picker lists **only this session's joined members**
  (not everyone you've shared a session with).
- **Ugly delete popup:** replaced `window.confirm` with a **styled in-UI modal** (loading state, cascade
  warning) matching the design.
- **"Save changes" did nothing:** booking fields are now controlled and wired to **`updateSession`** with a
  **Saving.../Saved** state. DetailScreen remounts per session (`key`) so the form never goes stale.
- No SQL changes this round. Build clean.
- **NEXT (user re-test):** restart dev; pick an organizer (count correct, player NOT lost), edit booking +
  Save changes (loading + Saved), delete via the new modal.

### Steps 9–11 ✅ code done, awaiting test (NO SQL changes this round)
- **Step 9 Availability:** organizer picker MOVED here (creator-only, ≤2 from joined players, instant save +
  feedback) and removed from Detail. Fixed latent bugs: **"Maybe" removed → In/Out only**; lock label now
  **1h**; uses the **active session** (was `ctx.upcoming`); App now persists availability to the **active
  session id** (was wrong id). Players set only their own status; managers can set others'.
- **Step 10 Team Builder:** **pool = players marked IN** (derived from availability, not stored);
  **Add team** popup (Team Name) via `createTeam`; **Randomise** auto-creates teams from the IN count then
  evenly distributes (async, awaits each step, then reload — no stale-state writes); remove-team; captain
  flag shows **C**; non-managers get **VIEW ONLY**. Moves persist team_players (scoped, non-destructive).
- **Step 11 Formation:** added a **FIFA-style team roster bar** (Add/Remove players to the field, shows
  position/SUB + captain C). **Per-role edit:** creator/organizer edit ANY team; **captain edits own team
  only** (marked ★, and not while player-locked); everyone else **view-only**.
- New liveDb: `createTeam`, `deleteTeam`, `setOrganizerRole`, `updateSession` (RLS already permits via
  `can_manage`/`is_creator`). Build clean (75 modules).
- **NEXT (user test, just restart dev):** Availability In/Out + organizer pick (no player lost);
  Team Builder pool=IN + Add team + Randomise + captain; Formation roster bar + per-role edit gating.

### Steps 9–11 follow-up bug fixes (after user test)
- **BUG #2 (player's IN mark disappears on nav):** `openSession()` re-fetched from the DB on EVERY nav
  click — even for the already-active session — racing & overwriting the just-made optimistic availability
  mark. Fixed: `openSession` is a no-op when the session is already active (no refetch, no clobber).
- **BUG #1 (guests not in Team Builder pool):** `team_players` required a real `profile_id`. Migrated it to
  support guests (surrogate `id` PK, nullable `profile_id`, new `guest_name`, check, unique member index).
  Player "keys" are now `profileId` for members or **`g:<name>` for guests**; helpers `isGuestKey/keyFirst/
  keyName`. Pool/Team Builder/Formation now include + render guests (avatar from name, GUEST tag); guests
  can't be captain or DB goal-scorer (filtered). Expenses still split across real profiles only.
  `liveDb.loadSessionDetail` maps tokens; `saveTeamPlayers` writes guest rows.
- **SQL (user must re-run):** `schema.sql` only (team_players migration). policies.sql unchanged. Build clean.
- **NEXT (user test):** re-run schema.sql, restart; 2nd-account IN mark persists across nav; organizer-added
  guest shows in pool, assigns to a team, survives reload, shows in Formation; guest can't be captain.

### Guests = full participants (goals + expenses) — after user clarification
Guests must count exactly like real players everywhere. Previously they were excluded from goal-scoring
and the fee split. Fixed:
- **Goals:** `goals.scorer_guest_name` added; a guest can now be tagged as scorer (Live + History show the
  name via `keyFirst`). `mapGoal`/`saveGoals` handle the `g:<name>` scorer key.
- **Expenses/payments:** `payments` migrated to allow guests (surrogate `id` PK, nullable `profile_id`,
  `guest_name`, full unique indexes `uq_pay_member`/`uq_pay_guest`). `savePayments` upserts members vs guests
  on their respective keys. Expenses now **split across members AND guests** assigned to teams; per-guest
  paid/method tracked; `mapPayment` exposes a `key`. Expenses screen rekeyed to tokens.
- **SQL (user must re-run): `schema.sql` only** (adds goals.scorer_guest_name + payments guest migration).
  policies.sql unchanged. Build clean.
- Guest identity is still by **name** (give guests distinct names). Guests can't be captain (captain_id is a
  profile FK) — that's the one place they differ.
- **NEXT (user test):** re-run schema.sql, restart; tag a guest as a goal scorer (shows in Live + History);
  Expenses includes the guest in the split + per-guest paid toggle.

### Schema re-run fix — PK ordering error (after user hit `column "profile_id" is in a primary key`)
- **Cause:** `team_players`/`payments` guest migrations did `alter column profile_id drop not null`
  BEFORE dropping the old composite PK. A PK column is implicitly NOT NULL, so Postgres refused.
- **Fix (`schema.sql`):** reordered both — drop old PK first, THEN drop NOT NULL, THEN add surrogate-id PK.

### Availability visibility + persistence rework (Step 13 pulled forward — BLOCKING bug)
**User report (4-window test):** In/Out changes only visible to creator; players' marks vanish on
reload; creator/organizer state-change or reload wiped others' statuses to "unmarked".
- **Root cause:** `setAvailability` persisted the ENTIRE session pool every change
  (`saveAvailability` → `upsert(allRows)`). A player can only write their OWN row under RLS, so the
  batch upsert was rejected → their mark never saved (vanished on reload). Managers re-wrote everyone
  from a stale local copy → clobber/desync. Realtime re-subscribed on every `liveData` change → events
  dropped.
- **Fix:**
  - `liveDb.saveAvailabilityRow(sessionId, row)` — SURGICAL single-row save. Member = upsert on
    `(session_id, profile_id)` (player only touches their own row); guest = update by id / insert.
  - `Turf.jsx`: `setAvailability` is now local-only; new `ctx.saveAvailRow` persists just the changed
    row. AvailabilityScreen handlers (setRowStatus/setMyStatus/addGuest/addExisting) call it.
  - Realtime: subscribe ONCE per auth session via `refreshRef` + 200ms debounce; added `teams`,
    `team_players`, `session_members` to the channel so cross-page edits propagate.
  - Header **Refresh** button (global reload fallback) next to Log out; added `refresh` icon.
- **SQL (user MUST re-run BOTH):**
  - `schema.sql` — makes `uq_avail_member` a FULL unique index (was partial) so onConflict works.
  - `policies.sql` — publishes `session_members` for realtime.
- **Build:** clean (75 modules).
- **NEXT (user test, 2+ windows):** player marks IN → visible to everyone within ~1s + persists on
  reload; creator/organizer marking out does NOT wipe others; guest add persists; Refresh button works.

### Formation persistence + Expenses overpay + Sidebar name + Refresh spinner (after user 4-window test)
**User reports:** (a) Formation page: removing from roster / repositioning beads didn't persist or show
to others; (b) Refresh button gave no feedback; (c) sidebar said "Profile" not the user's name;
(d) Expenses had DUE tags but no way to mark paid, and no way to record a player paying MORE to cover
someone who didn't pay.
- **Formation was never persisted at all** (field + x/y were local component state). Fix:
  - `schema.sql`: `teams.formation jsonb` (whole board: preset + on-pitch list + x/y, atomic).
  - `liveDb`: `saveFormation(teamId, formation)`; `mapTeam` exposes `formation`.
  - `FormationPitch`: hydrates from `saved`, persists via `onSave` on add/remove/drag-end/preset.
    Locked viewers remount on board change (key includes formation JSON) → see live updates; editors
    keep stable key so their drag isn't interrupted.
- **Sidebar:** footer shows Avatar + bold user name (links to Profile screen) instead of "Profile".
- **Refresh button:** `doRefresh` with `refreshing` state, spinning icon (`.spin` keyframe) + "Refreshing…".
- **Expenses:** `amountPaid` is now the REAL amount given (was forced to per-head). New **＋ Money** inline
  editor sets an exact amount (can exceed share → "+৳X covers others"); status = PAID / PARTIAL / DUE;
  outstanding = max(0, total − Σpaid). Managers only.
- **SQL (user MUST re-run):** `schema.sql` (adds `teams.formation`; also earlier: PK reorder + full
  `uq_avail_member`). `policies.sql` (adds `session_members` to realtime). Build clean (75 modules).
- **NEXT (user test):** Formation reposition/remove persists + visible in a 2nd window; Refresh spins;
  sidebar shows name; Expenses ＋Money records overpay and adjusts outstanding; PAID/PARTIAL/DUE work.

### Formation permissions revamp + RLS captain-save + Expenses fee base (after user 2-window test)
**User reports:** (1) Formation still inconsistent — a general-user CAPTAIN added himself to the field
but other team members / creator didn't see it; (2) PAID/DUE toggle did nothing.
- **Root cause #1 (two parts):**
  - Creator had `canManage` → was an EDITOR → stable remount key (excl. formation) → never remounted on
    realtime → froze at mount. Fixed by the new view-only model (viewers remount on formation change).
  - **RLS:** a general-user captain's formation write hit `teams_write` (managers only) → silently
    rejected → never persisted. Fixed with **`save_formation` RPC** (SECURITY DEFINER, in policies.sql):
    allows the team's **captain OR a manager**, updates only the formation columns. `liveDb.saveFormation`
    now calls the RPC instead of a direct `teams` update.
- **New Formation permission model (per user):**
  - EDIT = **captain of THIS team only** (captain may be creator/organizer/general user, never a guest).
    **Formation never locks** (even on game day) — removed the lock from `canEdit`.
  - VIEW: **creator → ALL teams** (view-only, realtime); **organizer/general user → only THEIR team**
    (the team they're assigned to / captain). Team tabs now list only `visibleTeams`; "not on a team"
    message otherwise. (Team Builder + Availability pages untouched, per instruction.)
- **Root cause #2:** Expenses `total` summed only extra expenses, ignoring the session's turf fee, so
  `per` was 0 and the PAID pill was disabled. Fixed: `total = s.totalFee (base) + extra expenses`; the
  Extra-expenses card now shows a "Turf booking fee · base" line so the split math is transparent.
- **SQL (user MUST re-run BOTH):** `schema.sql` (teams.formation etc.) + **`policies.sql` (adds
  `save_formation` RPC + session_members realtime)**. Build clean (75 modules).
- **NEXT (user test, 2 windows):** general-user captain edits formation → teammates + creator see it
  live; creator sees all teams view-only, organizer/general user see only their team; set a turf fee →
  PAID/DUE toggles and ＋Money/overpay both work.

### Step 12 — Schedule: Refresh + reorder + min-teams ✅ code done, awaiting test
- **Regenerate → Refresh:** schedule page has a **Refresh** button (spinner) = manual pull; matches are
  already realtime-subscribed so fixtures **auto-sync**. Kept a separate **Rebuild** (org-only, confirm,
  resets scores) for when teams change.
- **Reorder (bring forward / push later):** ▲▼ buttons on each SCHEDULED fixture (org only). `move()`
  swaps two adjacent scheduled matches (never a live/done one) and renumbers `matchNo`; kickoff times
  re-derive from order automatically. Persists via `saveMatches`; realtime shows it to all.
- **Min-teams rule:** `MIN_TEAMS_OK = 4` (recommended). <2 teams blocks generation; 2–3 shows an amber
  warning banner but still allows play. Empty-state Generate button gated to org + ≥2 teams.
- **No SQL changes** (matches table + saveMatches + realtime already in place). Build clean (75 modules).
- **NEXT (user test):** open Schedule → ▲▼ reorder a scheduled match (times re-flow), Refresh spins,
  Rebuild confirms+resets, 2–3 teams shows the warning, second window sees reorder live.

### Live Match sync + captain persistence + Schedule drag-reorder (after user Live-page test)
**User reports:** (1) Live timer not synced across users; (2) captain's score increment didn't update
everywhere and reverted on refresh; (3) schedule reorder arrows clunky — wants drag.
- **Root cause (score/timer reverting):** `setScore`/`onTimerChange` used `ctx.setMatches` → `saveMatches`
  (UPSERT). An upsert trips the **managers-only `matches_insert` policy**, so a CAPTAIN's write was
  rejected by RLS → never persisted → reverted on refresh, and nothing to broadcast. **Fix:**
  `liveDb.updateMatch(matchId, patch)` does a plain **UPDATE** (hits only `matches_update`, which allows
  captains) wired via `ctx.updateMatch`. setScore / timer / finish now use it. (No SQL change — RLS already
  allowed captain UPDATE.)
- **Root cause (timer not synced):** `TimerDisplay` ran off localStorage + local state. **Fix:** clock is
  now DERIVED from the match row — `elapsed = paused_accum_seconds + (started_at ? now − started_at : 0)`;
  `started_at` set ⇒ running. Start/Pause/Reset only patch those fields (surgical). All viewers compute
  the same time; realtime keeps them in sync. Goal tags also derive from live `DATA.goals` (sync to all).
- **Schedule reorder → drag & drop:** replaced ▲▼ with a **grip handle**; pointer-based drag (touch +
  mouse) reorders SCHEDULED fixtures (`startDrag`/`reorderTo` via `elementFromPoint`), drop highlight +
  drag dim. `.fixture` grid first col `44px → auto`; spacer keeps non-draggable rows aligned.
- Access unchanged: control = manager OR captain; everyone else view-only (now truly live).
- **No SQL changes.** Build clean (75 modules).
- **NEXT (user test, 2 windows):** captain starts clock → both windows tick together; captain +score →
  shows everywhere + persists on reload; drag a fixture by its grip to reorder (works on phone).

### Step 14 (Deploy) — pending (see plan's ROUND-2 build sequence). Step 13 (concurrency/visibility)
folded into the availability + formation + live realtime work already shipped.



---

## UI/UX Redesign Plan (Frontend-Refactored branch)

# MUST : USE IMPECCABLE'S SKILLS AT ALL TIME
Goal: redesign the entire UI/UX per PRODUCT.md + DESIGN.md (dark neutral-charcoal broadcast
system, football soul; FotMob/SofaScore/Linear/Splitwise references) and the tester feedback.
**No functionality, data-loading, or data-flow changes** - visual/IA/UX only. Done in pairs of
steps; build stays green; each round is reviewed live (HMR) and committed with its own message.
Bracketed numbers map to the tester feedback points.

Round 1 - Foundation (global, mostly styles.css)
- [X] 1. Typography & readability: one crisp UI sans at proper weights (stop using condensed
      display Oswald for labels/buttons/data); fixed rem type scale; reserve condensed/numeric
      treatment for scores/clock only. [#1]
- [X] 2. Surface/color system + interactive states: neutral charcoal tokens, retuned accents,
      full state vocab (hover/focus/active/disabled/selected/loading/error); AA contrast; gated/
      disabled controls render truly inert (not pseudo-pressable); restyle card/btn/pill/input/
      seg/surface. [#2, #4]

Round 2 - Shell & chrome
- [X] 3. Topbar/header declutter: drop role-tag clutter + oversized refresh/logout into a clean
      compact account/actions area; clearer titling. [#11]
- [X] 4. Mobile navigation rework: better bottom bar; kill the "More" dumping ground; surface the
      important destinations. [#5]

Round 3 - System states
- [X] 5. Skeleton loading states replacing the "Loading TURF..." screen and in-content spinners. [#12]
- [X] 6. Modal/popup system restyle to accessible, polished dialogs -- ALL SORTS OF SYSTEM DIALOGUES SHOULD BE POPUPS. [#13]

Round 4 - Primary screens
- [X] 7. Dashboard IA rebuild: glanceable, genuinely a dashboard. [#6]
- [ ] 8. Create/Join session flow: guided + intuitive, less interpretation. -- MAKE SEPARATE BUTTONS/CARDS INSIDE SESSIONS PAGE IF NEEDED - CLARITY AND CLEAR. All the cards in this page needs to be horizontally carded not vertically in mobile layout. **SPECIFICALLY CHANGE THE CREATE SESSION AND JOIN SESSION CARD**[#7]

Round 5 - Role clarity & redundancy
- [ ] 9. Role-gated UX across screens inclV. Formation: non-managers/non-captains get clean
      view-only; no controls that merely look pressable. [#4]
- [ ] 10. Redundancy cut: booking details shown once; contextual mini-summaries instead of repeats - **LIKE Table and Schedule can be shown inside one single page, both pages go empty most of the time. And do change the UI for the table etc according to the inspirations. Then the Live page layout can be changed a bit and info that is needed to glanced at once inside it WITHOUT COMPACTING. USE YOUR IMPECCABLE SKILL PRECISIELY PLEASE. Then if table and schedule are brought together then the Expenses Button can be brough inside the floating nav bar----- these are examples I am giving, be intuitive, polish and add GOOOD GODDAMN LAYOUTS AND ANNIMATIONS PLEASE.** [#4, #9]

Round 6 - Remaining screens
- [ ] 11. Expenses clarity for players (non-managers): intuitive read-only view. [#8]
- [ ] 12. Profile page: a real "My Profile" (identity, stats, prefs, sessions). [#10]

Round 7 - Embedding, signature polish & QA
- [ ] 13. Cross-screen embedding: compact sections surfacing other pages' info where it helps. [#9]
- [ ] 14. Signature broadcast polish (Live/Standings/Formation/Schedule/History) + final
      consistency + a11y (reduced-motion, colorblind-safe) + mobile QA + build. [overall]
- [ ] 15. Refreshing with browser takes back to the dashboard page, it is supposed to remain in the very same page. AND the in built refresh button has no intuitive progress thing or anything.
> CAVEAT (user, after Round 1): the turf/pitch BACKGROUND was liked - it must be REFINED into a
> beautiful, aesthetic backdrop in Round 7 (subtle mowing stripes, depth/vignette, low opacity so
> text stays AA-readable), NOT left flat neutral. Round 1 cleared it to neutral charcoal; bring it
> back tastefully while keeping neutral cards/panels. Honor the FotMob/SofaScore/Linear references.

**Thorough check for security and loading time.**

Each round: implement 2 steps -> `npm run build` green -> user reviews on the live dev server ->
user supplies the commit message -> commit (authored by user only) -> user pushes so history is
visible on GitHub.

---