-- Fields a client adds themselves in Finalize Your Fields (not on their
-- contracts): [{ id, name, sectionId, kind, options? }].
alter table public.client_otc_field_selections
  add column custom_fields jsonb not null default '[]'::jsonb
  check (jsonb_typeof(custom_fields) = 'array' and jsonb_array_length(custom_fields) <= 200);
