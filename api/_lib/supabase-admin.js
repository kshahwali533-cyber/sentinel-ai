import { createClient } from "@supabase/supabase-js";

/**
 * Never let a Vercel Preview deployment use the production Supabase service
 * role key. Preview deployments are untrusted test surfaces; a browser-side
 * safe-mode banner is not an API security boundary.
 *
 * A dedicated isolated preview database can be enabled later by changing this
 * policy after its URL and credentials have been explicitly configured.
 */
export function isPreviewDatabaseBlocked(env = process.env) {
  return env.VERCEL_ENV === "preview";
}

export function createSupabaseAdmin(env = process.env) {
  if (isPreviewDatabaseBlocked(env)) {
    return null;
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  return createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
