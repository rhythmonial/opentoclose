-- Plan Your Task Templates: a client's planned tasks, per side (buyer /
-- seller / listing, i.e. the "B -" / "S -" / "L -" templates), mirroring
-- the TC Optimize task setup prep sheet.
create table public.client_task_plans (
  id uuid primary key default gen_random_uuid(),
  client_account_id uuid not null references public.client_accounts(id) on delete cascade,
  side text not null check (side in ('buyer', 'seller', 'listing')),
  -- The template name after the prefix (e.g. "General" in "B - General").
  template text not null check (char_length(template) between 1 and 80),
  name text not null check (char_length(name) between 1 and 200),
  notes text not null default '' check (char_length(notes) <= 2000),
  critical boolean not null default false,
  recurring boolean not null default false,
  due_days integer check (due_days between 0 and 3650),
  time_frame text check (time_frame in ('business_days', 'calendar_days', 'calendar_days_skip_weekend')),
  timing text check (timing in ('before', 'after', 'same_day')),
  -- A date field name, or "Task Completed" (due when the parent task is).
  date_field text not null default '' check (char_length(date_field) <= 120),
  parent_task text not null default '' check (char_length(parent_task) <= 200),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index client_task_plans_account_side on public.client_task_plans (client_account_id, side, sort_order);

alter table public.client_task_plans enable row level security;
create policy client_task_plans_all_members_or_staff on public.client_task_plans
  for all using (is_staff() or client_account_id = my_client_account_id())
  with check (is_staff() or client_account_id = my_client_account_id());

update public.setup_steps set step_type = 'configurator' where key = 'plan_your_task_templates';
