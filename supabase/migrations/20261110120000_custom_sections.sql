-- Sections a client adds (when Open to Close doesn't have the one a new
-- field belongs in): [{ id: "new-section:<uuid>", name, group }].
alter table public.client_otc_field_selections
  add column custom_sections jsonb not null default '[]'::jsonb
  check (jsonb_typeof(custom_sections) = 'array' and jsonb_array_length(custom_sections) <= 100);
