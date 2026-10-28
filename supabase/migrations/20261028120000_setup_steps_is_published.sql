-- Steps can be switched off while being built: clients only see published
-- steps (and their resource links); staff see everything. All steps start
-- unpublished.
alter table public.setup_steps
  add column if not exists is_published boolean not null default false;

alter policy setup_steps_select_authenticated on public.setup_steps
  using (auth.role() = 'authenticated' and (is_published or is_staff()));

alter policy setup_step_resources_select_authenticated on public.setup_step_resources
  using (auth.role() = 'authenticated' and (
    is_staff() or exists (
      select 1 from public.setup_steps s
      where s.id = step_id and s.is_published)));
