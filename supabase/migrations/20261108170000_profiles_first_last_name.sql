-- Teammates' first and last names (from the invite form).
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text;
