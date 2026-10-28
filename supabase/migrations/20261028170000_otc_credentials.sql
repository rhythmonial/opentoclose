-- Open to Close login details collected on the Setup Initiation form for
-- Setup clients, so our team can sign in and build their setup.
alter table setup_initiation
  add column otc_username text,
  add column otc_password_set boolean not null default false;

-- The password lives apart from setup_initiation: staff can read it, but
-- clients can only write it (through save_otc_password), never read it back.
create table otc_credentials (
  client_id uuid primary key references profiles(id) on delete cascade,
  password text not null,
  updated_at timestamptz not null default now()
);

alter table otc_credentials enable row level security;

create policy "otc_credentials_staff_all" on otc_credentials for all
  using (is_staff())
  with check (is_staff());

create or replace function save_otc_password(p_password text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  insert into otc_credentials (client_id, password, updated_at)
  values (auth.uid(), p_password, now())
  on conflict (client_id)
    do update set password = excluded.password, updated_at = now();

  update setup_initiation
    set otc_password_set = true
    where client_id = auth.uid();
end;
$$;

revoke all on function save_otc_password(text) from public, anon;
grant execute on function save_otc_password(text) to authenticated;
