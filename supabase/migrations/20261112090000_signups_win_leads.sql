-- Sign-ups pay to join now, so they're no longer added as leads. A lead
-- with the same email (e.g. a founding member marked won, or an info
-- request) is linked to the new account and marked won.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  meta jsonb := new.raw_user_meta_data;
  acct_id uuid;
  new_role user_role := coalesce((meta->>'role')::user_role, 'client_owner');
  self_signup boolean := false;
begin
  if meta ? 'client_account_id' then
    acct_id := (meta->>'client_account_id')::uuid;
  elsif new_role = 'client_owner' then
    insert into client_accounts (name, state)
    values (coalesce(meta->>'business_name', 'New Account'), meta->>'state')
    returning id into acct_id;
    self_signup := true;
  end if;

  insert into public.profiles (id, role, client_account_id, email)
  values (new.id, new_role, acct_id, new.email);

  if self_signup then
    update leads
       set converted_client_account_id = acct_id,
           status = 'won',
           archived_at = null,
           updated_at = now()
     where id = (
       select id from leads
        where lower(email) = lower(new.email)
          and converted_client_account_id is null
        order by created_at desc
        limit 1
     );
  end if;

  return new;
end;
$function$;
