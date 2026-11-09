-- Coupon codes our team creates: a free stretch of DIY access (no card,
-- no subscription). Clients redeem them on the server (service role).
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and length(code) between 3 and 40),
  free_days integer not null default 30 check (free_days between 1 and 365),
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  expires_at timestamptz,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- One redemption per coupon per account. Access ends at access_ends_at;
-- ended_at is when the account was switched back (or kept, if subscribed).
create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  client_account_id uuid not null references public.client_accounts(id) on delete cascade,
  redeemed_by uuid references public.profiles(id) on delete set null,
  redeemed_at timestamptz not null default now(),
  access_ends_at timestamptz not null,
  ended_at timestamptz,
  unique (coupon_id, client_account_id)
);

alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;

create policy "coupons_staff_all" on public.coupons for all
  using (is_staff()) with check (is_staff());

create policy "coupon_redemptions_select_members_or_staff" on public.coupon_redemptions for select
  using (is_staff() or client_account_id = my_client_account_id());

create policy "coupon_redemptions_staff_write" on public.coupon_redemptions for all
  using (is_staff()) with check (is_staff());
