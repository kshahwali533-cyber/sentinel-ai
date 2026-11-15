create index monitoring_alerts_run_idx
  on public.monitoring_alerts (run_id)
  where run_id is not null;

create index monitoring_alerts_site_idx
  on public.monitoring_alerts (site_id, created_at desc);
