-- Number field -> the date it's the days for, as the client picked it in
-- Finalize Your Fields.
alter table public.client_otc_field_selections add column number_ties jsonb not null default '{}'::jsonb check (jsonb_typeof(number_ties) = 'object');
