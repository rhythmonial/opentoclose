-- Setup vs. DIY engagement type (controls who's tasked with "staff"-eligible
-- steps), plus an upgrade-request flag so DIY clients can ask to purchase
-- the flat 10-hour Full Setup bundle at any point.
alter table setup_initiation add column if not exists engagement_type text not null default 'custom';
alter table setup_initiation add column if not exists upgrade_requested_at timestamptz;

-- Dedicated video field per step; the old single resource_url is replaced
-- by the setup_step_resources table below (ordered, typed resource links).
alter table setup_steps add column if not exists video_url text;

-- Ops-only steps (payment, intake-form approval) were the only rows marked
-- 'staff' so far — reclassify them as 'staff_always' so they stay staff-only
-- regardless of a client's engagement type. Steps marked plain 'staff' going
-- forward are "assignable": staff for Full Setup clients, client for DIY.
update setup_steps set completed_by = 'staff_always' where completed_by = 'staff';

create table if not exists setup_step_resources (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null references setup_steps(id) on delete cascade,
  kind text not null default 'link' check (kind in ('google_doc','pdf','link')),
  label text,
  url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table setup_step_resources enable row level security;

create policy setup_step_resources_select_authenticated on setup_step_resources
  for select using (auth.role() = 'authenticated');

create policy setup_step_resources_write_staff on setup_step_resources
  for all using (is_staff()) with check (is_staff());

-- One-time backfill of the old single resource_url into the new table.
insert into setup_step_resources (step_id, kind, label, url, sort_order)
select id,
  case
    when resource_url ilike '%docs.google.com%' then 'google_doc'
    when resource_url ilike '%.pdf' then 'pdf'
    else 'link'
  end,
  null,
  resource_url,
  0
from setup_steps
where resource_url is not null;

alter table setup_steps drop column resource_url;
