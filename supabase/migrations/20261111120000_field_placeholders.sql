-- Per field, the placeholder the client set in Finalize Your Fields ("" when
-- they removed one).
alter table public.client_otc_field_selections add column placeholders jsonb not null default '{}'::jsonb check (jsonb_typeof(placeholders) = 'object');
