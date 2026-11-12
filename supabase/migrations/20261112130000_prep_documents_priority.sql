alter table public.prep_documents add column if not exists priority text check (priority in ('high','medium','low'));
