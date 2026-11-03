-- Categorize Your Documents: a client's own document categories (beyond
-- the starter ones in the app), and each document's categories and sides.
create table public.document_categories (
  id uuid primary key default gen_random_uuid(),
  client_account_id uuid not null references public.client_accounts(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  color text not null default 'green' check (color in ('green', 'yellow', 'red', 'blue', 'purple', 'gray')),
  created_at timestamptz not null default now(),
  unique (client_account_id, name)
);

-- A document: one uploaded in Upload Your Contracts (contract_document_id),
-- or one the client added by name.
create table public.prep_documents (
  id uuid primary key default gen_random_uuid(),
  client_account_id uuid not null references public.client_accounts(id) on delete cascade,
  contract_document_id uuid unique references public.contract_documents(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  -- Category ids: a starter category's key, or "custom:<document_categories.id>".
  categories text[] not null default '{}',
  sides text[] not null default '{}' check (sides <@ array['seller', 'buyer', 'listing']),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.document_categories enable row level security;
alter table public.prep_documents enable row level security;

create policy document_categories_all_members_or_staff on public.document_categories
  for all using (is_staff() or client_account_id = my_client_account_id())
  with check (is_staff() or client_account_id = my_client_account_id());
create policy prep_documents_all_members_or_staff on public.prep_documents
  for all using (is_staff() or client_account_id = my_client_account_id())
  with check (is_staff() or client_account_id = my_client_account_id());

update public.setup_steps set step_type = 'configurator' where key = 'categorize_your_documents';
