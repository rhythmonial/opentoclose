-- Stripe payments: plan purchases (Setup / DIY) and per-step "have the
-- team do it" purchases priced at estimated_hours x the hourly rate.
alter table public.setup_steps add column if not exists estimated_hours numeric(6,2);

create table public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
create policy app_settings_read on public.app_settings
  for select to authenticated using (true);
create policy app_settings_staff_write on public.app_settings
  for all using (is_staff()) with check (is_staff());
insert into public.app_settings (key, value) values ('hourly_rate', '100')
  on conflict (key) do nothing;

-- Written only by the Stripe webhook (service role); readable by the
-- paying client and staff.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('setup','diy','step')),
  step_id uuid references public.setup_steps(id) on delete set null,
  hours numeric(6,2),
  amount_cents integer not null,
  stripe_session_id text not null unique,
  created_at timestamptz not null default now()
);
create index payments_client_id_idx on public.payments(client_id);
alter table public.payments enable row level security;
create policy payments_select_own_or_staff on public.payments
  for select using (client_id = auth.uid() or is_staff());

alter table public.setup_initiation alter column engagement_type set default 'free';

create or replace function public.guard_engagement_type()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Plans change only through staff or the Stripe webhook (service role,
  -- which has no auth.uid()); clients can't grant themselves a plan.
  if auth.uid() is not null and not is_staff() then
    if tg_op = 'INSERT' then
      new.engagement_type := 'free';
    else
      new.engagement_type := old.engagement_type;
    end if;
  end if;
  return new;
end;
$$;

create trigger setup_initiation_guard_engagement_type
  before insert or update on public.setup_initiation
  for each row execute function public.guard_engagement_type();
