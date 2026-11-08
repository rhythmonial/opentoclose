-- Setup hours bought from the profile (by the hour, or the 10-hour bundle)
-- are logged as 'hours' payments; the hourly rate is $125.
alter table public.payments drop constraint payments_kind_check;
alter table public.payments add constraint payments_kind_check
  check (kind in ('setup', 'diy', 'step', 'monthly', 'hours'));

insert into public.app_settings (key, value) values ('hourly_rate', '125')
  on conflict (key) do update set value = excluded.value, updated_at = now();
