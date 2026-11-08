-- Which lessons a logged block of work was on.
alter table public.hours_log add column if not exists step_ids uuid[] not null default '{}';
