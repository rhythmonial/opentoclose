-- Activity log for dev-managed actions on internal team accounts
-- (email changes, password reset requests, invites), visible only to
-- the 'dev' role on a staff member's account detail page.
create table public.staff_activity_log (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index staff_activity_log_profile_id_idx
  on public.staff_activity_log (profile_id, created_at desc);

create or replace function is_dev()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'dev'
  );
$$;

revoke execute on function is_dev() from public, anon;
grant execute on function is_dev() to authenticated;

alter table public.staff_activity_log enable row level security;

create policy "dev can view staff activity log"
  on public.staff_activity_log for select
  using (is_dev());

create policy "dev can insert staff activity log"
  on public.staff_activity_log for insert
  with check (is_dev());
