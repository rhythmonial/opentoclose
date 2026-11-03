-- Select OTC Fields: the Open to Close fields (from the app's catalog, by
-- id) a client checked as ones their process uses.
create table public.client_otc_field_selections (
  client_account_id uuid primary key references public.client_accounts(id) on delete cascade,
  fields text[] not null default '{}' check (cardinality(fields) <= 500),
  updated_at timestamptz not null default now()
);

alter table public.client_otc_field_selections enable row level security;
create policy client_otc_field_selections_all_members_or_staff on public.client_otc_field_selections
  for all using (is_staff() or client_account_id = my_client_account_id())
  with check (is_staff() or client_account_id = my_client_account_id());

update public.setup_steps set step_type = 'configurator' where key = 'select_otc_fields';
