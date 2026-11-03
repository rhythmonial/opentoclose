-- Sample Email Templates: a client's copy of a sample template (sample_key)
-- once they change it, or a template of their own (no sample_key).
create table public.client_email_templates (
  id uuid primary key default gen_random_uuid(),
  client_account_id uuid not null references public.client_accounts(id) on delete cascade,
  sample_key text,
  include boolean not null default true,
  title text not null check (char_length(title) between 1 and 200),
  subject text not null default '' check (char_length(subject) <= 500),
  body text not null default '' check (char_length(body) <= 20000),
  -- OTC contact role names, and document (file role) names.
  to_roles text[] not null default '{}',
  cc_roles text[] not null default '{}',
  bcc_roles text[] not null default '{}',
  file_roles text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_account_id, sample_key)
);

alter table public.client_email_templates enable row level security;
create policy client_email_templates_all_members_or_staff on public.client_email_templates
  for all using (is_staff() or client_account_id = my_client_account_id())
  with check (is_staff() or client_account_id = my_client_account_id());

update public.setup_steps set step_type = 'configurator' where key = 'sample_email_templates';
