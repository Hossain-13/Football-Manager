/* =====================================================================
   TURF — Supabase client + feature flag (the data-access seam).

   The app runs on mock data (src/lib/db.js) until you flip the flag.
   To go live:
     1. Create a free project at https://supabase.com
     2. Copy .env.example -> .env and fill in the two values below
     3. Set VITE_USE_SUPABASE=true
     4. Run supabase/schema.sql then supabase/policies.sql in the SQL editor
   ===================================================================== */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const USE_SUPABASE =
  import.meta.env.VITE_USE_SUPABASE === 'true' && Boolean(url && anonKey);

// Only construct a client when configured, so the mock-only path needs no env.
// Auth options: PKCE flow + detectSessionInUrl lets supabase-js handle the Google
// OAuth callback (?code=...) automatically. We do NOT hand-parse tokens anymore.
export const supabase = USE_SUPABASE
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : null;
