-- Resource Center content (Training videos, call Replays, FAQs), managed by
-- staff from the dev Resources tab and readable by any signed-in user.
create table public.resource_items (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('training','replay','faq')),
  title text not null,
  body text,
  url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.resource_items enable row level security;

create policy resource_items_read on public.resource_items
  for select to authenticated using (true);

create policy resource_items_staff_write on public.resource_items
  for all using (is_staff()) with check (is_staff());
