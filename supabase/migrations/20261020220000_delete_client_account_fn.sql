-- Lets a signed-in dev delete a client account and every login on it
-- without the service-role key. Runs as the function owner so it can
-- remove auth.users rows; the role check keeps it dev-only.
create or replace function public.delete_client_account(target_account_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_logins integer;
begin
  if not exists (
    select 1 from profiles where id = auth.uid() and role = 'dev'
  ) then
    raise exception 'Only dev accounts can delete client accounts';
  end if;

  if not exists (select 1 from client_accounts where id = target_account_id) then
    raise exception 'Client account not found';
  end if;

  -- Removing each login cascades to its profile and all of its data.
  delete from auth.users
  where id in (
    select id from profiles
    where client_account_id = target_account_id
      and role in ('client_owner', 'client_admin')
  );
  get diagnostics deleted_logins = row_count;

  delete from client_accounts where id = target_account_id;

  return deleted_logins;
end;
$$;

revoke all on function public.delete_client_account(uuid) from public, anon;
grant execute on function public.delete_client_account(uuid) to authenticated;
