-- Auto-create a profile row whenever someone signs up via Supabase Auth.
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
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'client')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
