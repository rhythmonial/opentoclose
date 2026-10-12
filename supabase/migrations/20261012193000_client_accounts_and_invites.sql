-- Introduces a shared "business" record so a client_owner and one or more
-- client_admins can belong to the same account, and supports inviting a
-- client_admin by email (via supabase.auth.admin.inviteUserByEmail, which
-- creates the auth.users row directly — this trigger then attaches it to
-- the inviter's client_account_id instead of creating a new account).

create table client_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  state text,
  setup_path setup_path,
  created_at timestamptz not null default now()
);

alter table client_accounts enable row level security;

alter table profiles add column client_account_id uuid references client_accounts(id) on delete cascade;
alter table profiles add column first_login_at timestamptz;
alter table profiles add column email text;

update profiles set email = u.email from auth.users u where u.id = profiles.id;

-- One-time backfill: give existing client profiles (pre-dating this table)
-- their own client_accounts row instead of being left ungrouped.
with new_acct as (
  insert into client_accounts (name, state, setup_path)
  select business_name, state, setup_path
  from profiles
  where role in ('client_owner', 'client_admin') and business_name is not null
  returning id
)
update profiles
set client_account_id = new_acct.id
from new_acct
where profiles.role in ('client_owner', 'client_admin')
  and profiles.business_name is not null
  and profiles.client_account_id is null;

create or replace function my_client_account_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select client_account_id from profiles where id = auth.uid();
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := new.raw_user_meta_data;
  acct_id uuid;
  new_role user_role := coalesce((meta->>'role')::user_role, 'client_owner');
begin
  if meta ? 'client_account_id' then
    acct_id := (meta->>'client_account_id')::uuid;
  elsif new_role = 'client_owner' then
    insert into client_accounts (name, state)
    values (coalesce(meta->>'business_name', 'New Account'), meta->>'state')
    returning id into acct_id;
  end if;

  insert into public.profiles (id, role, client_account_id, email)
  values (new.id, new_role, acct_id, new.email);

  return new;
end;
$$;

-- Lets teammates (same client_account_id) see each other's profile rows.
-- Added as an additional permissive policy rather than replacing the
-- original "own row or staff" policy, since Postgres OR's multiple
-- permissive policies for the same command together.
create policy "profiles_select_teammates" on profiles for select
  using (client_account_id is not null and client_account_id = my_client_account_id());

create policy "client_accounts_select_members_or_staff" on client_accounts for select
  using (is_staff() or id = my_client_account_id());

create policy "client_accounts_update_owner_or_staff" on client_accounts for update
  using (is_staff() or (id = my_client_account_id() and exists (select 1 from profiles where id = auth.uid() and role = 'client_owner')))
  with check (is_staff() or (id = my_client_account_id() and exists (select 1 from profiles where id = auth.uid() and role = 'client_owner')));

-- These SECURITY DEFINER helpers are meant for use inside RLS policies only
-- (handle_new_user as a trigger, the others via auth.uid()) — not as
-- directly callable RPCs.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_staff() from public, anon;
revoke execute on function public.my_client_account_id() from public, anon;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.my_client_account_id() to authenticated;
