-- OTC Audits: the date each audit is scheduled for (the report is due 5
-- business days later) and a link to the recorded walkthrough.
alter table public.audit_requests add column if not exists audit_date date;
alter table public.audit_requests add column if not exists video_link text check (char_length(video_link) <= 1000);
