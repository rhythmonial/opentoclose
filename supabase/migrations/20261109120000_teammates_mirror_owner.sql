-- Teammates share one account: they see and update the same progress and
-- setup form as the owner (all stored under the owner's id).
create or replace function public.same_account(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles p
    where p.id = uid
      and p.client_account_id is not null
      and p.client_account_id = my_client_account_id()
  );
$$;

grant execute on function public.same_account(uuid) to authenticated;

drop policy if exists "client_step_status_rw" on public.client_step_status;
create policy "client_step_status_rw" on public.client_step_status for all
  using (client_id = auth.uid() or is_staff() or same_account(client_id))
  with check (client_id = auth.uid() or is_staff() or same_account(client_id));

drop policy if exists "setup_initiation_own_or_staff" on public.setup_initiation;
create policy "setup_initiation_own_or_staff" on public.setup_initiation for all
  using (client_id = auth.uid() or is_staff() or same_account(client_id))
  with check (client_id = auth.uid() or is_staff() or same_account(client_id));

drop policy if exists "submissions_select" on public.submissions;
create policy "submissions_select" on public.submissions for select
  using (client_id = auth.uid() or is_staff() or same_account(client_id));

drop policy if exists "submissions_insert_client" on public.submissions;
create policy "submissions_insert_client" on public.submissions for insert
  with check (client_id = auth.uid() or same_account(client_id));

drop policy if exists "payments_select_own_or_staff" on public.payments;
create policy "payments_select_own_or_staff" on public.payments for select
  using (client_id = auth.uid() or is_staff() or same_account(client_id));
