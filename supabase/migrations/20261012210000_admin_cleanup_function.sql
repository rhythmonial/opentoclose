-- A staff-only cleanup action, callable as a button from the app instead of
-- the SQL Editor. Safe to run multiple times (every step checks first).
create or replace function public.run_legacy_cleanup()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  result text := '';
  deleted_users int;
begin
  if not is_staff() then
    raise exception 'Only staff can run this.';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'business_name') then
    alter table profiles drop column business_name;
    result := result || 'Dropped profiles.business_name. ';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'state') then
    alter table profiles drop column state;
    result := result || 'Dropped profiles.state. ';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'setup_path') then
    alter table profiles drop column setup_path;
    result := result || 'Dropped profiles.setup_path. ';
  end if;

  if exists (select 1 from pg_type where typname = 'user_role_old') then
    drop type user_role_old;
    result := result || 'Dropped the old user_role_old type. ';
  end if;

  delete from auth.users
  where email in ('otc-smoke-test@mailinator.com', 'otc-smoke-test2@mailinator.com');
  get diagnostics deleted_users = row_count;
  if deleted_users > 0 then
    result := result || format('Deleted %s smoke-test account(s). ', deleted_users);
  end if;

  if result = '' then
    result := 'Nothing to clean up — already done.';
  end if;

  return result;
end;
$$;

revoke execute on function public.run_legacy_cleanup() from public, anon, authenticated;
grant execute on function public.run_legacy_cleanup() to authenticated;
