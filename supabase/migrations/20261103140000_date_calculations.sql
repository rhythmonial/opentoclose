-- A client's date calculations (Select Your Date Fields): for each Open to
-- Close date field they check, how it's worked out from another date.
create table public.date_calculations (
  client_account_id uuid not null references public.client_accounts(id) on delete cascade,
  -- The OTC date field (built-in id, or a "new-otc:" id for one they added).
  otc_field text not null,
  enabled boolean not null default true,
  -- A set number of days, or (days_on_contract) a blank on the contract
  -- that the agent fills in, recorded as the OTC number field it goes in.
  days integer check (days between 0 and 3650),
  days_on_contract boolean not null default false,
  number_field text,
  time_frame text check (time_frame in ('calendar_days', 'business_days')),
  direction text check (direction in ('before', 'after')),
  relative_to text,
  updated_at timestamptz not null default now(),
  primary key (client_account_id, otc_field)
);

alter table public.date_calculations enable row level security;

create policy date_calculations_select_members_or_staff on public.date_calculations
  for select using (is_staff() or client_account_id = my_client_account_id());
create policy date_calculations_insert_members_or_staff on public.date_calculations
  for insert with check (is_staff() or client_account_id = my_client_account_id());
create policy date_calculations_update_members_or_staff on public.date_calculations
  for update using (is_staff() or client_account_id = my_client_account_id())
  with check (is_staff() or client_account_id = my_client_account_id());
create policy date_calculations_delete_members_or_staff on public.date_calculations
  for delete using (is_staff() or client_account_id = my_client_account_id());

update public.setup_steps set step_type = 'configurator' where key = 'select_your_date_fields';
