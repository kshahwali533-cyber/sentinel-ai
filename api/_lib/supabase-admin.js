import { createClient } from "@supabase/supabase-js";

/**
 * Prevent Vercel Preview deployments from using the production Supabase
 * service-role key. Preview is an untrusted test surface and must fail closed.
 */
export function isPreviewDatabaseBlocked(env = process.env) {
  return env.VERCEL_ENV === "preview";
}

export function createSupabaseAdmin(env = process.env) {
  if (isPreviewDatabaseBlocked(env)) return null;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
