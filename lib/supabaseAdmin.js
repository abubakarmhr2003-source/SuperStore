import { createClient } from "@supabase/supabase-js";

// Server-side only client using the SERVICE ROLE key — never expose this
// key or this client to the browser. Used for all Supabase Auth operations
// (login verification, creating/updating/deleting staff accounts).
export function getSupabaseAdmin() {
  if (!global._gsSupabaseAdmin) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set. Copy .env.example to " +
        ".env.local and fill them in."
      );
    }
    global._gsSupabaseAdmin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return global._gsSupabaseAdmin;
}

// Our login screen still just asks for a "username" (not an email), to keep
// the UI unchanged — but Supabase Auth requires an email address under the
// hood. This deterministically turns a username into one, e.g.
// "admin" -> "admin@general-store.local".
export function usernameToEmail(username) {
  return `${String(username).trim().toLowerCase()}@general-store.local`;
}
