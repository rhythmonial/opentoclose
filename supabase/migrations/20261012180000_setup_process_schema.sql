-- Open to Close: core schema for the client Setup process (Custom + Express paths).
-- The DIY course is out of scope for now.

create type user_role as enum ('client', 'specialist', 'admin');
create type setup_path as enum ('custom', 'express');
create type step_status as enum ('locked', 'not_started', 'in_progress', 'submitted', 'returned', 'approved');
create type step_type as enum ('video', 'configurator', 'download', 'external_link', 'form');
create type field_action as enum ('keep', 'remove', 'add', 'rename');
create type date_rule_status as enum ('confirmed', 'updated', 'removed', 'needs_input', 'custom');

-- Extends auth.users with app-specific profile data.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'client',
  business_name text,
  setup_path setup_path,
  state text,
  created_at timestamptz not null default now()
);

-- The checklist itself, kept as editable data rather than hardcoded screens.
create table setup_steps (
  id uuid primary key default gen_random_uuid(),
  path setup_path not null,
  section text not null,
  key text not null,
  title text not null,
  description text,
  step_type step_type not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (path, key)
);

-- Per-client progress against each step.
create table client_step_status (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles(id) on delete cascade,
  step_id uuid not null references setup_steps(id) on delete cascade,
  status step_status not null default 'not_started',
  updated_at timestamptz not null default now(),
  unique (client_id, step_id)
);

-- Our Term -> Your Term mapping (the state-terminology substitution).
create table terminology (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles(id) on delete cascade,
  our_term text not null,
  your_term text,
  applies boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Generalized Configurator rows: Workflow Fields, Contacts & Roles, Doc Templates, Smart Blocks.
create table configurator_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles(id) on delete cascade,
  category text not null,
  section text not null,
  item_name text not null,
  is_default boolean not null default false,
  action field_action not null default 'keep',
  renamed_to text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Date Calculations rules.
create table date_rules (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  days int,
  direction text check (direction in ('before', 'after')),
  reference_field text,
  count_method text not null default 'calendar',
  weekend_roll boolean not null default true,
  status date_rule_status not null default 'confirmed',
  is_default boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- A client's submission of a step for specialist review (the approval gate).
create table submissions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles(id) on delete cascade,
  step_id uuid not null references setup_steps(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'returned')),
  specialist_feedback text,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz
);

-- The hours-used work log shown on the client dashboard.
create table hours_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles(id) on delete cascade,
  logged_by uuid references profiles(id),
  hours numeric(5, 2) not null,
  description text not null,
  logged_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table setup_steps enable row level security;
alter table client_step_status enable row level security;
alter table terminology enable row level security;
alter table configurator_items enable row level security;
alter table date_rules enable row level security;
alter table submissions enable row level security;
alter table hours_log enable row level security;

create or replace function is_staff()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role in ('specialist', 'admin')
  );
$$;

create policy "profiles_select_own_or_staff" on profiles for select
  using (id = auth.uid() or is_staff());
create policy "profiles_insert_own" on profiles for insert
  with check (id = auth.uid());
create policy "profiles_update_own_or_staff" on profiles for update
  using (id = auth.uid() or is_staff())
  with check (id = auth.uid() or is_staff());

create policy "setup_steps_select_authenticated" on setup_steps for select
  using (auth.role() = 'authenticated');
create policy "setup_steps_write_staff" on setup_steps for all
  using (is_staff())
  with check (is_staff());

create policy "client_step_status_rw" on client_step_status for all
  using (client_id = auth.uid() or is_staff())
  with check (client_id = auth.uid() or is_staff());

create policy "terminology_rw" on terminology for all
  using (client_id = auth.uid() or is_staff())
  with check (client_id = auth.uid() or is_staff());

create policy "configurator_items_rw" on configurator_items for all
  using (client_id = auth.uid() or is_staff())
  with check (client_id = auth.uid() or is_staff());

create policy "date_rules_rw" on date_rules for all
  using (client_id = auth.uid() or is_staff())
  with check (client_id = auth.uid() or is_staff());

create policy "submissions_select" on submissions for select
  using (client_id = auth.uid() or is_staff());
create policy "submissions_insert_client" on submissions for insert
  with check (client_id = auth.uid());
create policy "submissions_update_staff" on submissions for update
  using (is_staff())
  with check (is_staff());

create policy "hours_log_select" on hours_log for select
  using (client_id = auth.uid() or is_staff());
create policy "hours_log_write_staff" on hours_log for insert
  with check (is_staff());
