-- Number fields the client said aren't days for a date calculation (Finalize
-- Your Fields).
alter table public.client_otc_field_selections add column numbers_not_dates jsonb not null default '[]'::jsonb check (jsonb_typeof(numbers_not_dates) = 'array' and jsonb_array_length(numbers_not_dates) <= 500);
