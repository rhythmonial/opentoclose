-- The "How did you hear about us?" field on the pricing/lead-capture form.
alter table leads add column heard_about text;
alter table leads add column heard_about_detail text;

-- The Setup Initiation intake form, reachable only at /setup (not linked
-- anywhere) and tied to whoever is logged in. One row per client; upserted
-- so the same page serves both first-time completion and later edits.
create table setup_initiation (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  cell_phone text not null,
  email text not null,
  business_name text not null,
  company_structure text not null,
  states_serviced text not null,
  transactions_under_contract int,
  transactions_per_month int,
  tc_count int,
  tools_used text[] not null default '{}',
  tools_other text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id)
);

alter table setup_initiation enable row level security;

create policy "setup_initiation_own_or_staff" on setup_initiation for all
  using (client_id = auth.uid() or is_staff())
  with check (client_id = auth.uid() or is_staff());
