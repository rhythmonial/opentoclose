-- Organize Your Fields: how a client arranged the fields they use (sections
-- within field groups, fields within sections), every move they made, and
-- when they finished.
create table public.client_field_organization (
  client_account_id uuid primary key references public.client_accounts(id) on delete cascade,
  layout jsonb not null default '[]'::jsonb check (jsonb_typeof(layout) = 'array'),
  moves jsonb not null default '[]'::jsonb
    check (jsonb_typeof(moves) = 'array' and jsonb_array_length(moves) <= 5000),
  done_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.client_field_organization enable row level security;
create policy client_field_organization_members_or_staff on public.client_field_organization
  for all using (is_staff() or client_account_id = my_client_account_id())
  with check (is_staff() or client_account_id = my_client_account_id());

update public.setup_steps set step_type = 'configurator' where key = 'organize_your_fields';
