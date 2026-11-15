-- Sentinel AI security hardening.
-- Applied to Supabase project vceqmqwszvisvxxbgbfs as migration
-- 20261114110820_sentinel_security_hardening_20261114.
-- Keep the RLS event trigger active; revoke direct RPC execution only.
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- Remove duplicate, non-constraint index; retain the primary-key index.
DROP INDEX IF EXISTS public.scan_rate_limits_ip_address_key;

-- Restrict profile and scan-history ownership policies to authenticated users,
-- and avoid per-row auth.uid() evaluation.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can delete own scan history" ON public.scan_history;
CREATE POLICY "Users can delete own scan history"
  ON public.scan_history FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own scan history" ON public.scan_history;
CREATE POLICY "Users can insert own scan history"
  ON public.scan_history FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own scan history" ON public.scan_history;
CREATE POLICY "Users can view own scan history"
  ON public.scan_history FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Preserve only the operations used by the current signed-in app.
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE INSERT, DELETE ON TABLE public.profiles FROM authenticated;
GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;

REVOKE ALL ON TABLE public.scan_history FROM anon;
REVOKE UPDATE ON TABLE public.scan_history FROM authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.scan_history TO authenticated;

-- Internal/server-managed tables are never directly exposed to clients.
REVOKE ALL ON TABLE public.product_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.scan_rate_limits FROM anon, authenticated;

DROP POLICY IF EXISTS "Block public access" ON public.product_events;
CREATE POLICY "Block public access"
  ON public.product_events FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Block public access" ON public.scan_rate_limits;
CREATE POLICY "Block public access"
  ON public.scan_rate_limits FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- SECURITY DEFINER function uses fully qualified objects.
ALTER FUNCTION public.check_scan_rate_limit(text, timestamptz, integer)
  SET search_path = pg_catalog;
