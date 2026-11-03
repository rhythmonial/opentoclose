-- Plan Your Task Templates: emails sent from a task (up to 3, by email
-- template title; OTC sends emails only from tasks) and documents attached
-- to it (any number, by document name).
alter table public.client_task_plans
  add column email_templates text[] not null default '{}'
    check (cardinality(email_templates) <= 3),
  add column documents text[] not null default '{}'
    check (cardinality(documents) <= 200);
