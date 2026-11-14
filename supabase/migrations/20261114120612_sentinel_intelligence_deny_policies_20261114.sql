create policy "Deny client access to vulnerability cache"
  on public.vulnerability_cache for all to anon, authenticated
  using (false) with check (false);

create policy "Deny client access to KEV catalog cache"
  on public.kev_catalog_cache for all to anon, authenticated
  using (false) with check (false);

create policy "Deny client access to intelligence rate limits"
  on public.intelligence_rate_limits for all to anon, authenticated
  using (false) with check (false);
