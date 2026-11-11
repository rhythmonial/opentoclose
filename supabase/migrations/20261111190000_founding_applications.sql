-- Applications for the founding group (the public /founding form). Anyone
-- can apply; only staff read them.
create table public.founding_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_structure text not null check (char_length(company_structure) <= 80),
  business_name text not null check (char_length(business_name) <= 200),
  first_name text not null check (char_length(first_name) <= 100),
  last_name text not null check (char_length(last_name) <= 100),
  email text not null check (char_length(email) <= 200),
  phone text check (char_length(phone) <= 40),
  states_serviced text check (char_length(states_serviced) <= 1000),
  priority_state text check (char_length(priority_state) <= 80),
  tms text check (char_length(tms) <= 120),
  email_provider text check (char_length(email_provider) <= 120),
  esign_platform text check (char_length(esign_platform) <= 120),
  esign_other text check (char_length(esign_other) <= 120),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object' and pg_column_size(answers) <= 20000)
);
alter table public.founding_applications enable row level security;
create policy founding_applications_insert_anyone on public.founding_applications
  for insert to anon, authenticated with check (true);
create policy founding_applications_select_staff on public.founding_applications
  for select using (is_staff());
create policy founding_applications_delete_staff on public.founding_applications
  for delete using (is_staff());
