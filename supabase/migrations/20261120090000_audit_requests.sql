-- $55 OTC Audit requests (the public /audit form). Anyone can submit one
-- (as "requested", nothing else set); only staff read and update them.
create table public.audit_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) <= 120),
  email text not null check (char_length(email) <= 200),
  phone text check (char_length(phone) <= 40),
  team_name text not null check (char_length(team_name) <= 200),
  team_size text not null check (char_length(team_size) <= 40),
  frustrations text not null check (char_length(frustrations) <= 4000),
  access_method text not null check (access_method in ('add_user', 'share_later', 'not_sure')),
  anything_else text check (char_length(anything_else) <= 4000),
  status text not null default 'requested'
    check (status in ('requested', 'paid', 'in_progress', 'delivered', 'upsold', 'closed')),
  paid_at timestamptz,
  delivered_at timestamptz,
  report_link text check (char_length(report_link) <= 1000),
  notes text check (char_length(notes) <= 10000),
  upsell_amount numeric(10, 2) check (upsell_amount >= 0),
  stripe_session_id text,
  updated_at timestamptz not null default now()
);
create index audit_requests_created_at on public.audit_requests (created_at desc);

alter table public.audit_requests enable row level security;
create policy audit_requests_insert_anyone on public.audit_requests
  for insert to anon, authenticated
  with check (
    status = 'requested' and paid_at is null and delivered_at is null and report_link is null
    and notes is null and upsell_amount is null and stripe_session_id is null
  );
create policy audit_requests_select_staff on public.audit_requests for select using (is_staff());
create policy audit_requests_update_staff on public.audit_requests for update using (is_staff()) with check (is_staff());
create policy audit_requests_delete_staff on public.audit_requests for delete using (is_staff());
