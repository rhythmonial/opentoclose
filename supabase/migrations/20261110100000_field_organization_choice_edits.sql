-- Organize Your Fields: choice options the client wants deleted or added,
-- per choice field: { <field id>: { removed: [...], added: [...] } }.
alter table public.client_field_organization
  add column choice_edits jsonb not null default '{}'::jsonb
  check (jsonb_typeof(choice_edits) = 'object');
