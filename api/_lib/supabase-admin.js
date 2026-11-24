import { createClient } from "@supabase/supabase-js";

/**
 * Never let a Vercel Preview deployment use the production Supabase service
 * role key. Preview deployments are untrusted test surfaces; a browser-side
 * safe-mode banner is not an API security boundary.
 *
 * A dedicated isolated preview database can be enabled later by changing this
 * policy after its URL and credentials have been explicitly configured.
 */
export function createSupabaseAdmin() {
  if (process.env.VERCEL_ENV === "preview") {
    return null;
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
