-- A staff-set status per client account (active/paused/completed/churned),
-- distinct from the computed "current stage" (which tracks setup progress
-- through setup_steps). Lets staff mark an account without it implying
-- anything about where they are in the checklist.

create type client_account_status as enum ('active', 'paused', 'completed', 'churned');
alter table client_accounts add column status client_account_status not null default 'active';
