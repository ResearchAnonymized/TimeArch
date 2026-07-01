-- Clean up old pg_cron job run history and set up auto-cleanup
DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days';

-- Schedule daily auto-cleanup to keep only last 7 days of cron logs
SELECT cron.schedule(
  'cleanup-cron-history',
  '0 3 * * *',
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'$$
);