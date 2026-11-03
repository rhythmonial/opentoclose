-- Prep Your Contacts: contact lists a client uploads (any common format),
-- and how each of their columns matches OTC's contact import fields.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contact-files', 'contact-files', false, 26214400,
  array[
    'text/csv', 'text/plain', 'text/tab-separated-values', 'text/vcard', 'text/x-vcard',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream'
  ]
);

-- Files live under "<client_account_id>/...".
create policy contact_files_select_members_or_staff on storage.objects
  for select using (
    bucket_id = 'contact-files'
    and (is_staff() or (storage.foldername(name))[1] = my_client_account_id()::text)
  );
create policy contact_files_insert_members_or_staff on storage.objects
  for insert with check (
    bucket_id = 'contact-files'
    and (is_staff() or (storage.foldername(name))[1] = my_client_account_id()::text)
  );
create policy contact_files_delete_members_or_staff on storage.objects
  for delete using (
    bucket_id = 'contact-files'
    and (is_staff() or (storage.foldername(name))[1] = my_client_account_id()::text)
  );

create table public.contact_imports (
  id uuid primary key default gen_random_uuid(),
  client_account_id uuid not null references public.client_accounts(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  -- The file's column headings, in order.
  columns text[] not null default '{}',
  row_count integer not null default 0,
  -- Column heading -> OTC import field (or "__full_name" to split a full
  -- name into first and last).
  mapping jsonb not null default '{}'::jsonb,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contact_imports enable row level security;
create policy contact_imports_all_members_or_staff on public.contact_imports
  for all using (is_staff() or client_account_id = my_client_account_id())
  with check (is_staff() or client_account_id = my_client_account_id());

update public.setup_steps set step_type = 'configurator' where key = 'prep_contact_roles_for_setup';
