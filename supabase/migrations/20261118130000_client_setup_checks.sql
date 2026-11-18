-- Setup lessons' checklists (Document Setup's templates, documents and doc
-- features done in Open to Close): the keys checked, per account and lesson.
create table public.client_setup_checks (
  client_account_id uuid not null references public.client_accounts(id) on delete cascade,
  step_key text not null,
  checked text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (client_account_id, step_key)
);

alter table public.client_setup_checks enable row level security;
create policy client_setup_checks_members_or_staff on public.client_setup_checks
  for all using (is_staff() or client_account_id = my_client_account_id())
  with check (is_staff() or client_account_id = my_client_account_id());
