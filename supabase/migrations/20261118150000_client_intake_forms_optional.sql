-- Prep Your Intake Form: fields on the form that are optional (required
-- ones are in "required").
alter table public.client_intake_forms add column if not exists optional text[] not null default '{}';
