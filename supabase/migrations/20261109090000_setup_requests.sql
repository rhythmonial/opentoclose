-- Lessons a client asked our team to set up (with their setup hours).
-- Open until the lesson is completed (done_at set).
create table if not exists public.setup_requests (
  id uuid primary key default gen_random_uuid(),
  client_account_id uuid not null references public.client_accounts(id) on delete cascade,
  step_id uuid not null references public.setup_steps(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  done_at timestamptz
);

-- One open request per lesson per account.
create unique index if not exists setup_requests_one_open
  on public.setup_requests (client_account_id, step_id)
  where done_at is null;

alter table public.setup_requests enable row level security;

create policy "setup_requests_select_members_or_staff" on public.setup_requests for select
  using (is_staff() or client_account_id = my_client_account_id());

create policy "setup_requests_insert_members" on public.setup_requests for insert
  with check (client_account_id = my_client_account_id() and requested_by = auth.uid());

create policy "setup_requests_update_members_or_staff" on public.setup_requests for update
  using (is_staff() or client_account_id = my_client_account_id());

create policy "setup_requests_delete_staff" on public.setup_requests for delete
  using (is_staff());
