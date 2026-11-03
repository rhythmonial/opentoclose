-- Dates a client adds themselves (otc_field "new-otc:..."): their name.
alter table public.date_calculations
  add column field_name text check (char_length(field_name) <= 120);
