# TURF — Matchday Manager

A multi-tenant web app for organising pickup / turf football sessions. Players sign in with
Google and join a session by a short code; organisers build teams, set formations on a tactical
board, run a live match timer with scores and goal scorers, track an auto-sorted standings table
and match history, and manage the turf fee split. Works on mobile and desktop and installs as a
PWA.

## Tech stack

- **Frontend:** Vite + React (single-page app), no UI framework — hand-rolled CSS design system.
- **Backend:** [Supabase](https://supabase.com) — Postgres, Google OAuth, Realtime, and
  **Row Level Security (RLS)** as the authoritative permission layer.
- **Hosting:** static frontend on Vercel; database/auth/realtime on Supabase.

There is no custom server. The browser talks to Supabase directly via the public anon key, and
every read/write is gated by RLS policies, so authorisation is enforced in the database rather
than the client.

## Architecture

- **Per-session roles** — `creator` (owns the session), up to two `organizer`s, `player`, and
  per-team `captain`. Permissions are derived from data (`sessions.created_by`, membership role,
  team captaincy), never from client state.
- **Lazy data loading** — a light summary (sessions + memberships) powers the dashboard and
  navigation; the heavy per-session detail (availability, teams, formations, matches, goals,
  expenses, payments) is fetched only for the open session and kept resident for instant,
  client-side recomputation of standings and history.
- **Realtime sync** — a single subscription patches live changes (availability, teams,
  formations, live score/clock, payments) into state so all viewers stay in sync; a manual
  refresh is available as a fallback.
- **Live clock** — the match timer is derived from the match row
  (`paused_accum_seconds` + elapsed since `started_at`) so every viewer computes the same time.



## Project structure

```
src/
  App.jsx           UI orchestrator — state, routing, app shell
  components/       Icon, core primitives, nav, signature pieces
  screens/          one file per screen (AuthScreen.jsx, LiveScreen.jsx, ... 13 total)
  styles.css        design system
  main.jsx          entry point
  lib/
    supabase.js     Supabase client + feature flag
    liveDb.js       data-access layer (queries, RPCs, mappers)
    dataView.js     DATA proxy + ACTIVE_DB + key helpers
    format.js       pure formatting/id helpers
    db.js           base/reference data
  types.ts          data-model reference
supabase/
  schema.sql        tables, triggers, RPCs
  policies.sql      Row Level Security policies + realtime
public/             PWA manifest, icon, service worker
```
