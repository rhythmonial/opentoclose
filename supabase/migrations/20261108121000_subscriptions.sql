-- The monthly access fee: a Stripe subscription per client account (DIY is
-- the subscription alone; Setup is the one-time setup plus it). Written only
-- by the Stripe webhook and the billing actions (service role); readable by
-- the account's members and staff.
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_account_id uuid references public.client_accounts(id) on delete cascade,
  -- Who subscribed.
  client_id uuid references public.profiles(id) on delete set null,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  -- Stripe's status: active, past_due, canceled, unpaid, incomplete...
  status text not null,
  cancel_at_period_end boolean not null default false,
  current_period_end timestamptz,
  amount_cents integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_account_idx on public.subscriptions (client_account_id);
alter table public.subscriptions enable row level security;
create policy subscriptions_select_members_or_staff on public.subscriptions
  for select using (is_staff() or client_account_id = my_client_account_id());

-- Monthly fee charges are logged with the other payments (by invoice id).
alter table public.payments drop constraint payments_kind_check;
alter table public.payments add constraint payments_kind_check
  check (kind in ('setup', 'diy', 'step', 'monthly'));
