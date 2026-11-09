-- Invite links: a one-time coupon whose code is the secret token in the
-- link, with a note saying who it's for.
alter table public.coupons
  add column if not exists is_invite boolean not null default false,
  add column if not exists note text;
