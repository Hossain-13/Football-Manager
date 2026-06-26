# TURF Deployment Runbook

## Current Readiness

**Preview deployment:** ready. The Vite app builds cleanly and can be deployed to Vercel as a working mock-data preview.

**Real-user deployment:** code-ready, needs dashboard setup + smoke testing. Supabase auth, onboarding, live reads, core writes, admin/organizer roles, and realtime refresh are implemented behind `VITE_USE_SUPABASE=true`.

## What Is Done

- Vite production build.
- Vercel SPA config in `vercel.json`.
- PWA assets and service worker.
- Supabase schema for profiles, sessions, members, availability, teams, matches, goals, expenses, and payments.
- RLS policies for admin, organizer, player, captain, and 2-hour player lock behavior.
- Google-login onboarding UI fields for name and two preferred positions.
- Supabase-backed app data loading in `src/lib/liveDb.js`.
- Supabase-backed Google auth/onboarding in `src/Turf.jsx`.
- Core live writes for availability, per-session organizer selection, team assignment, captains, matches/timer/scores, goals, expenses, and payments.
- Realtime refresh for matches, goals, availability, and payments.

## Remaining Real Backend Blockers

1. **Google OAuth and SQL must be smoke-tested in your Supabase project.**
   The code builds, but the actual OAuth dashboard setup and RLS behavior need a browser test with real accounts.

2. **Google OAuth callbacks must include production.**
   In Supabase Auth URL settings, add:
   - local dev: `http://localhost:5173`
   - deployed site: `https://YOUR-VERCEL-PROJECT.vercel.app`

3. **Full session-detail editing is still shallow.**
   The main matchday flows are wired, but detailed booking/scoring-rule edits still need dedicated save handlers before calling the app fully complete.

## Preview Deploy To Vercel

1. Push this repo to GitHub.
2. Import it in Vercel.
3. Use framework preset `Vite`.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Leave `VITE_USE_SUPABASE=false` for preview mode.

## Real Deploy Sequence

1. Create the Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Run `supabase/policies.sql`.
4. Enable Google provider in Supabase Auth.
5. Add local and deployed URLs to Supabase Auth URL configuration.
6. Set Vercel env vars from `.env.example`.
7. Deploy.
8. Smoke test with at least three Google accounts: admin, organizer, and player.

## Smoke Test Checklist

- Google login redirects back to TURF.
- First login saves first name, last name, preferred position 1, preferred position 2.
- Admin can choose two organizers for a distinct session.
- Player sees only their own availability controls.
- Organizer can add players, assign teams, set captains, and edit expenses.
- Player controls lock automatically inside 2 hours of kickoff.
- Captain can control live score/timer.
- Expenses split only across players assigned into teams.
- Refresh on a second phone/browser reflects live changes.
