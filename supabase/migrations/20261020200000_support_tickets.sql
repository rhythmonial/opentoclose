-- Client support center: a ticket per question, with a reply thread.
-- Clients see and reply to their own tickets; staff see and answer all.
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  step_id uuid references public.setup_steps(id) on delete set null,
  subject text not null,
  status text not null default 'open' check (status in ('open','answered','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index support_tickets_client_id_idx on public.support_tickets(client_id);
create index support_tickets_status_idx on public.support_tickets(status);
create index support_messages_ticket_id_idx on public.support_messages(ticket_id);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

create policy support_tickets_select on public.support_tickets
  for select using (client_id = auth.uid() or is_staff());
create policy support_tickets_insert on public.support_tickets
  for insert with check (client_id = auth.uid());
create policy support_tickets_update on public.support_tickets
  for update using (client_id = auth.uid() or is_staff())
  with check (client_id = auth.uid() or is_staff());

create policy support_messages_select on public.support_messages
  for select using (
    is_staff() or exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and t.client_id = auth.uid()
    )
  );
create policy support_messages_insert on public.support_messages
  for insert with check (
    author_id = auth.uid() and (
      is_staff() or exists (
        select 1 from public.support_tickets t
        where t.id = ticket_id and t.client_id = auth.uid()
      )
    )
  );
