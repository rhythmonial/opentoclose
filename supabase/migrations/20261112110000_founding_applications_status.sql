-- Where staff are with each founding group application.
alter table public.founding_applications add column status text not null default 'new' check (status in ('new', 'contacted', 'link_sent', 'won', 'lost'));
create policy founding_applications_update_staff on public.founding_applications
  for update using (is_staff()) with check (is_staff());
