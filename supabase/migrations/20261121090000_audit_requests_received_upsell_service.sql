-- OTC Audits: "requested" and "paid" become one status, "received" (paid
-- is told by paid_at), and an upsold audit records its service (DIY or
-- Setup). New requests start as received.
alter table public.audit_requests drop constraint if exists audit_requests_status_check;
update public.audit_requests set status = 'received' where status in ('requested', 'paid');
alter table public.audit_requests alter column status set default 'received';
alter table public.audit_requests add constraint audit_requests_status_check
  check (status in ('received', 'in_progress', 'delivered', 'upsold', 'lost'));
alter table public.audit_requests add column if not exists upsell_service text check (upsell_service in ('diy', 'setup'));
drop policy if exists audit_requests_insert_anyone on public.audit_requests;
create policy audit_requests_insert_anyone on public.audit_requests
  for insert to anon, authenticated
  with check (
    status = 'received' and paid_at is null and delivered_at is null and report_link is null
    and notes is null and upsell_amount is null and upsell_service is null and stripe_session_id is null
    and audit_date is null and video_link is null
  );
