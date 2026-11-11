-- Accounts that see every lesson unlocked (test accounts), whatever their
-- plan or progress.
alter table public.client_accounts add column unlock_all boolean not null default false;
