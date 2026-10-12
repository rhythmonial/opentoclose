-- Lets anyone (staff or client) record a display name and phone number on
-- their own profile, shown/edited on the Profile page.

alter table profiles add column name text;
alter table profiles add column phone text;
