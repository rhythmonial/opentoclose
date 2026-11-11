-- Dates checked in Select Your Dates as calculated (they still need a number
-- field when it isn't picked yet).
alter table public.client_otc_field_selections add column calc_dates jsonb not null default '[]'::jsonb check (jsonb_typeof(calc_dates) = 'array' and jsonb_array_length(calc_dates) <= 500);
