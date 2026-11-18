-- Prep Your Intake Form: the fields a client adds to their intake form
-- beyond their contract fields, the ones they require, and per field the
-- document and task templates it triggers and on which answers:
-- { <field id>: [{ templates: [...], options: [...] }] }.
create table public.client_intake_forms (
  client_account_id uuid primary key references public.client_accounts(id) on delete cascade,
  added text[] not null default '{}',
  required text[] not null default '{}',
  triggers jsonb not null default '{}'::jsonb check (jsonb_typeof(triggers) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.client_intake_forms enable row level security;
create policy client_intake_forms_members_or_staff on public.client_intake_forms
  for all using (is_staff() or client_account_id = my_client_account_id())
  with check (is_staff() or client_account_id = my_client_account_id());

update public.setup_steps set step_type = 'configurator' where key = 'prep_your_intake_form';
