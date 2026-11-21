-- OTC Audits: the upsell is billed hourly (its hours; the amount is hours
-- x $125 less the $55 audit credit), and each audit's report is filled in
-- on its report form (saved as it's written) and marked complete.
alter table public.audit_requests add column if not exists upsell_hours numeric(6, 2) check (upsell_hours >= 0);
alter table public.audit_requests add column if not exists report jsonb not null default '{}'::jsonb
  check (jsonb_typeof(report) = 'object' and pg_column_size(report) <= 200000);
alter table public.audit_requests add column if not exists report_completed_at timestamptz;
