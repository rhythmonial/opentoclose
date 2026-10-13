-- Broaden staff_activity_log into a shared activity log for any profile:
-- client teammates will start getting entries too (sign-ins), viewable by
-- anyone sharing their client_account_id; 'dev' keeps full visibility.
alter table public.staff_activity_log rename to profile_activity_log;

alter policy "dev can view staff activity log" on public.profile_activity_log
  using (
    is_dev()
    or exists (
      select 1
      from profiles me
      join profiles target on target.id = profile_id
      where me.id = auth.uid()
        and me.client_account_id is not null
        and me.client_account_id = target.client_account_id
    )
  );

alter policy "dev can view staff activity log" on public.profile_activity_log
  rename to "view own profile activity log";

alter policy "staff can insert staff activity log" on public.profile_activity_log
  with check (is_staff() or profile_id = auth.uid());

alter policy "staff can insert staff activity log" on public.profile_activity_log
  rename to "insert profile activity log";
