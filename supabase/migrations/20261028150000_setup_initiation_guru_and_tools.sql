-- Setup Initiation: OTC Guru contact (optionally same as the team owner)
-- and separate e-sign / transaction management / email provider answers.
alter table public.setup_initiation
  add column if not exists guru_first_name text,
  add column if not exists guru_last_name text,
  add column if not exists guru_cell text,
  add column if not exists guru_email text,
  add column if not exists guru_same_as_owner boolean not null default false,
  add column if not exists esign_platform text,
  add column if not exists esign_other text,
  add column if not exists tms text,
  add column if not exists email_provider text;
