-- Task templates a task launches when it's completed (by name, with the side prefix).
alter table public.client_task_plans add column if not exists task_templates text[] not null default '{}' check (cardinality(task_templates) <= 50);
