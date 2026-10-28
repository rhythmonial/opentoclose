-- Contract documents clients upload in the "Upload Your Contract Docs"
-- configurator. The browser reads each PDF for fill-in blanks; they're
-- stored here so the fields can be extracted later.
create table contract_documents (
  id uuid primary key default gen_random_uuid(),
  client_account_id uuid not null references client_accounts(id) on delete cascade,
  uploaded_by uuid references profiles(id) on delete set null,
  storage_path text not null unique,
  file_name text not null,
  file_size integer,
  page_count integer,
  -- [{ page, kind: field|underscore|line, x, y, width, height, label, after, fieldName }]
  -- with x/y/width/height as fractions of the page, top-left origin.
  blanks jsonb not null default '[]'::jsonb,
  blank_count integer not null default 0,
  -- No readable text: likely a scan, so blanks couldn't be found.
  is_scanned boolean not null default false,
  created_at timestamptz not null default now()
);

create index contract_documents_account_idx on contract_documents (client_account_id, created_at);

alter table contract_documents enable row level security;

create policy "contract_documents_select_members_or_staff" on contract_documents for select
  using (is_staff() or client_account_id = my_client_account_id());

create policy "contract_documents_insert_members" on contract_documents for insert
  with check (client_account_id = my_client_account_id() and uploaded_by = auth.uid());

create policy "contract_documents_delete_members_or_staff" on contract_documents for delete
  using (is_staff() or client_account_id = my_client_account_id());

-- Private bucket, one folder per client account: <client_account_id>/<file>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contract-docs', 'contract-docs', false, 26214400, array['application/pdf']);

create policy "contract_docs_select_members_or_staff" on storage.objects for select
  using (
    bucket_id = 'contract-docs'
    and (is_staff() or (storage.foldername(name))[1] = my_client_account_id()::text)
  );

create policy "contract_docs_insert_members" on storage.objects for insert
  with check (
    bucket_id = 'contract-docs'
    and (storage.foldername(name))[1] = my_client_account_id()::text
  );

create policy "contract_docs_delete_members_or_staff" on storage.objects for delete
  using (
    bucket_id = 'contract-docs'
    and (is_staff() or (storage.foldername(name))[1] = my_client_account_id()::text)
  );
