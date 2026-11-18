-- Prep Your Intake Form: per field, the other fields it shows and on which
-- answers: { <field id>: [{ fields: [...], options: [...] }] }.
alter table public.client_intake_forms
  add column if not exists conditions jsonb not null default '{}'::jsonb check (jsonb_typeof(conditions) = 'object');
