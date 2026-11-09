-- Clients can put their contracts in their own order, separately in Upload
-- Your Contracts and Assign Your Workflow Fields (Assign starts from the
-- upload order), and finish each contract in Assign on its own.
alter table public.contract_documents
  add column upload_order integer,
  add column assign_order integer,
  add column assign_done_at timestamptz;
