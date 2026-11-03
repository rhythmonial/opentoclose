-- Recurring tasks repeat every so many days (empty = not recurring), and a
-- task is due from either a date field or its parent task, not both
-- ("Task Completed" as a date field is now just having a parent task).
alter table public.client_task_plans
  add column recur_days integer check (recur_days between 1 and 365);
update public.client_task_plans set date_field = '' where date_field = 'Task Completed';
