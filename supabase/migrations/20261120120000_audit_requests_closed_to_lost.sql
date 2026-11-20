-- OTC Audits: "closed" is now "lost" (delivered and upsold are the wins).
alter table public.audit_requests drop constraint if exists audit_requests_status_check;
update public.audit_requests set status = 'lost' where status = 'closed';
alter table public.audit_requests add constraint audit_requests_status_check
  check (status in ('requested', 'paid', 'in_progress', 'delivered', 'upsold', 'lost'));
