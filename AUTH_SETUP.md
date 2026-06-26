# TURF — Google Auth Setup (do this once, ~15 min)

Follow these in order. By the end you'll log into TURF with Google on `localhost:5173`.
You need: your Supabase project, a Google account. Nothing to install.

Two values you'll reuse — grab them first:
- **Supabase project ref**: in your Supabase URL `https://<REF>.supabase.co` — the `<REF>` part.
  (Supabase → Project Settings → General → "Reference ID".)
- **Supabase callback URL** (you'll paste this into Google):
  `https://<REF>.supabase.co/auth/v1/callback`

---

## 1) Google Cloud — create an OAuth client
1. Go to https://console.cloud.google.com/ and pick (or create) any project (top bar).
2. Left menu → **APIs & Services → OAuth consent screen**.
   - User type: **External** → Create.
   - App name: `TURF`. User support email: your email. Developer contact: your email. Save.
   - On **Audience/Test users**: add your own Gmail (and any tester emails) as **Test users**.
     (While the app is in "Testing", only listed emails can log in — that's fine for now.)
3. Left menu → **APIs & Services → Credentials → + Create credentials → OAuth client ID**.
   - Application type: **Web application**. Name: `TURF Web`.
   - Under **Authorized redirect URIs → + Add URI**, paste EXACTLY:
     `https://<REF>.supabase.co/auth/v1/callback`
   - Create. A popup shows your **Client ID** and **Client secret** — keep it open / copy both.

## 2) Supabase — enable Google
1. Supabase dashboard → your project → **Authentication → Providers → Google**.
2. Toggle **Enable**. Paste the **Client ID** and **Client secret** from step 1.3.
3. **Save**.

## 3) Supabase — URL configuration
1. **Authentication → URL Configuration**.
2. **Site URL**: `http://localhost:5173`
3. **Redirect URLs** → Add URL: `http://localhost:5173`  (and `http://localhost:5173/` too if it lets you).
4. Save. (We'll add your Vercel URL here later, at deploy time.)

## 4) Run the database SQL (if you haven't yet)
> Skip if you already ran these. They're safe to re-run.
1. Supabase → **SQL Editor → New query**.
2. Paste all of `supabase/schema.sql`, **Run**.
3. New query → paste all of `supabase/policies.sql`, **Run**.
4. No red errors = good.

## 5) Local env
Your `.env` (in the project root) should have:
```
VITE_USE_SUPABASE=true
VITE_SUPABASE_URL=https://<REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<your anon public key>   # Supabase → Project Settings → API → "anon public"
VITE_SITE_URL=http://localhost:5173
```
(Anon key is safe to expose in a frontend — that's its purpose. The service_role key must NEVER go here.)

## 6) Verify (the 60-second test)
1. Stop the dev server if running, then start it fresh: `npm run dev`.
2. Open `http://localhost:5173` → click **Continue with Google** → pick your (test-user) account.
3. You should land back in TURF, logged in.
4. In Supabase → **Table Editor → profiles**: you should see a new row with your user id.
5. Refresh the page — you should stay logged in (session persists).

✅ If all 5 happen, Step 0 passes — tell me and I'll start Step 1 (schema/role migration).

---

## If something breaks — quick fixes
- **"redirect_uri_mismatch"** → the URI in Google (step 1.3) must be EXACTLY
  `https://<REF>.supabase.co/auth/v1/callback` (https, no trailing slash, correct ref).
- **Login loops / lands logged-out** → check Supabase **Redirect URLs** includes `http://localhost:5173`
  (step 3) and `.env` `VITE_SITE_URL=http://localhost:5173`, then restart `npm run dev`.
- **"Access blocked / app not verified"** → your Gmail isn't in **Test users** (step 1.2). Add it.
- **Profiles row didn't appear** → re-run `supabase/schema.sql` (the `handle_new_user` trigger creates it).
- **Anything else** → copy the exact on-screen error to me; I'll pinpoint it.
