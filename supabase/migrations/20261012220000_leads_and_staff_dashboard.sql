-- Supports the internal staff dashboard: a lightweight leads/CRM table
-- (manually added by staff, or captured from the public "Request Info"
-- page — convertible later into a real client_account) and a purchased
-- hours figure per client (previously hardcoded in the UI).

create type lead_status as enum ('new', 'contacted', 'info_sent', 'proposal_sent', 'won', 'lost');

create table leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  notes text,
  status lead_status not null default 'new',
  source text not null default 'manual',
  converted_client_account_id uuid references client_accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table client_accounts add column hours_purchased numeric(6,2) not null default 10;

alter table leads enable row level security;

create policy "leads_staff_all" on leads for all
  using (is_staff())
  with check (is_staff());

-- The public "Request Info" page inserts as anon. Constrained to only ever
-- create a brand-new, unconverted lead — anon can never read, update, or
-- fabricate a won/converted row.
create policy "leads_public_insert" on leads for insert
  to anon
  with check (
    status = 'new'
    and source = 'request_info'
    and converted_client_account_id is null
  );
