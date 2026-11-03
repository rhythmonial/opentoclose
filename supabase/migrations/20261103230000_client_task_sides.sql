-- Plan Your Task Templates: task lists a client adds beside Buyer, Seller
-- and Listing (e.g. "Dual" with prefix "D -"). A task's side is then
-- 'buyer', 'seller', 'listing' or one of these lists' ids.
create table public.client_task_sides (
  id uuid primary key default gen_random_uuid(),
  client_account_id uuid not null references public.client_accounts(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 40),
  -- The template prefix, without the dash (e.g. "D" for "D - General").
  prefix text not null check (char_length(prefix) between 1 and 6),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index client_task_sides_account on public.client_task_sides (client_account_id, sort_order);

alter table public.client_task_sides enable row level security;
create policy client_task_sides_all_members_or_staff on public.client_task_sides
  for all using (is_staff() or client_account_id = my_client_account_id())
  with check (is_staff() or client_account_id = my_client_account_id());

alter table public.client_task_plans drop constraint if exists client_task_plans_side_check;
alter table public.client_task_plans add constraint client_task_plans_side_check
  check (side in ('buyer', 'seller', 'listing')
    or side ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
