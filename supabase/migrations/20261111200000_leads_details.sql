-- A lead's setup initiation answers (from a founding group application).
alter table public.leads add column details jsonb check (details is null or (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 20000));
