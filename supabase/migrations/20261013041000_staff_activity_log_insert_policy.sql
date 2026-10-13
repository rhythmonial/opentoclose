-- Any staff member's actions (e.g. a dev_admin inviting a colleague)
-- should be loggable, even though only 'dev' can later view the log.
alter policy "dev can insert staff activity log" on public.staff_activity_log
  with check (is_staff());

alter policy "dev can insert staff activity log" on public.staff_activity_log
  rename to "staff can insert staff activity log";
