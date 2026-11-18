-- Calculate Your Dates: dates the client has checked off as reviewed.
alter table public.date_calculations add column if not exists reviewed boolean not null default false;
