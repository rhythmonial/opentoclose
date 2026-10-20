-- Free-text note on why a client churned or how their setup wrapped up.
alter table public.client_accounts add column if not exists outcome text;
