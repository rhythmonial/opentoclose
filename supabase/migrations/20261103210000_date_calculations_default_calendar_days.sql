-- Dates count in calendar days unless the client picks another time frame.
update public.date_calculations set time_frame = 'calendar_days' where time_frame is null;
alter table public.date_calculations alter column time_frame set default 'calendar_days';
