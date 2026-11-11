-- Select Your Dates' Default Type: how days are counted for every date
-- (and new ones) unless changed on a date.
alter table public.client_otc_field_selections add column default_time_frame text check (default_time_frame in ('business_days', 'calendar_days', 'calendar_days_skip_weekend', 'same_day'));
