-- Match OTC's Date Calculation options: two more time frames, and the
-- weekend / federal holiday settings (null = N/A).
alter table public.date_calculations drop constraint date_calculations_time_frame_check;
alter table public.date_calculations add constraint date_calculations_time_frame_check
  check (time_frame in ('business_days', 'calendar_days', 'calendar_days_skip_weekend', 'same_day'));
alter table public.date_calculations
  add column weekend_roll text check (weekend_roll in ('back', 'forward')),
  add column holiday_roll text check (holiday_roll in ('back', 'forward')),
  add column federal_holidays text check (federal_holidays in ('count', 'skip'));
