-- Clients review each page of an uploaded contract, adding or adjusting
-- blank boxes, and confirm it. reviewed_at is set once every page is.
alter table contract_documents
  add column confirmed_pages integer[] not null default '{}',
  add column reviewed_at timestamptz;

create policy "contract_documents_update_members_or_staff" on contract_documents for update
  using (is_staff() or client_account_id = my_client_account_id())
  with check (is_staff() or client_account_id = my_client_account_id());
