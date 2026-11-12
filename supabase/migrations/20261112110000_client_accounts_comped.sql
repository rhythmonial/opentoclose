-- Accounts given a paid plan at no charge (e.g. a demo account): never
-- billed, checkout is turned off for them.
alter table public.client_accounts add column if not exists comped boolean not null default false;
