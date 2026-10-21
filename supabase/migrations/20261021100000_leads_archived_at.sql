-- Archived leads are hidden in a collapsed list instead of being deleted.
alter table public.leads add column if not exists archived_at timestamptz;
