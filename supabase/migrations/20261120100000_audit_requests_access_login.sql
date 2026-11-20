-- OTC Audit form: no team size any more; access is "I'll provide them
-- below" (username, and the password encrypted by the app) or "I'll share
-- them directly". Old access values stay valid for earlier requests.
alter table public.audit_requests alter column team_size drop not null;
alter table public.audit_requests drop constraint if exists audit_requests_access_method_check;
alter table public.audit_requests add constraint audit_requests_access_method_check
  check (access_method in ('provide_below', 'share_directly', 'add_user', 'share_later', 'not_sure'));
alter table public.audit_requests add column if not exists otc_username text check (char_length(otc_username) <= 200);
alter table public.audit_requests add column if not exists otc_password_enc text check (char_length(otc_password_enc) <= 2000);
