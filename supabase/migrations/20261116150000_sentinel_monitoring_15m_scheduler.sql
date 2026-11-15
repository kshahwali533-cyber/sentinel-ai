-- Move Sentinel monitoring from daily checks to a bounded 15-minute cadence.
alter table public.monitoring_sites
  drop column if exists scan_interval_days;

alter table public.monitoring_sites
  add column if not exists scan_interval_minutes smallint not null default 15
  check (scan_interval_minutes = 15);

-- Supabase Cron provides sub-daily scheduling without relying on Vercel Hobby cron.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'sentinel-monitoring-every-15-minutes',
  '*/15 * * * *',
  $job$
    select net.http_get(
      url := 'https://project-3jyda.vercel.app/api/monitoring-run',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'sentinel_monitoring_cron_secret'
        )
      ),
      timeout_milliseconds := 5000
    ) as request_id;
  $job$
);
