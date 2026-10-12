-- Replaces the placeholder client/specialist/admin role model with the real
-- one: internal staff (dev, dev_admin) vs. client-side users (client_owner,
-- client_admin).

alter type user_role rename to user_role_old;
create type user_role as enum ('dev', 'dev_admin', 'client_owner', 'client_admin');

alter table profiles alter column role drop default;
alter table profiles
  alter column role type user_role
  using (
    case role::text
      when 'admin' then 'dev_admin'
      when 'specialist' then 'dev'
      else 'client_owner'
    end
  )::user_role;
alter table profiles alter column role set default 'client_owner';

create or replace function is_staff()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role in ('dev', 'dev_admin')
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, business_name, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'business_name',
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'client_owner')
  );
  return new;
end;
$$;
