-- Select OTC Fields: what the client calls each checked field (OTC field id
-- -> their name, when it differs) and the field groups they've finished.
alter table public.client_otc_field_selections
  add column field_names jsonb not null default '{}'::jsonb,
  add column groups_done text[] not null default '{}';
