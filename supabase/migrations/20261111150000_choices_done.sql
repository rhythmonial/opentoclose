-- Choice fields whose options the client has gone over (Done in their
-- popup in Customize Your Fields).
alter table public.client_otc_field_selections add column choices_done jsonb not null default '[]'::jsonb check (jsonb_typeof(choices_done) = 'array' and jsonb_array_length(choices_done) <= 1000);
