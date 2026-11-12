-- Message and task spreadsheets uploaded in Setup Prep (Upload Your
-- Messages / Upload Your Tasks), mapped later in Prep Your Messages / Tasks.
-- Files live in the contact-files bucket under <account>/<kind>/.
create table if not exists public.prep_file_uploads (
  id uuid primary key default gen_random_uuid(),
  client_account_id uuid not null references public.client_accounts(id) on delete cascade,
  kind text not null check (kind in ('messages','tasks')),
  file_name text not null,
  storage_path text not null,
  columns text[] not null default '{}',
  row_count integer not null default 0,
  mapping jsonb not null default '{}'::jsonb,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists prep_file_uploads_account_kind on public.prep_file_uploads (client_account_id, kind);
alter table public.prep_file_uploads enable row level security;
create policy "prep_file_uploads_all_members_or_staff" on public.prep_file_uploads for all
  using (is_staff() or client_account_id = my_client_account_id())
  with check (is_staff() or client_account_id = my_client_account_id());
