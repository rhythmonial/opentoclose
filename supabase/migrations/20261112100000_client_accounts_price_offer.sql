-- A client's special pricing, set by staff: "founding" (founding member:
-- the $499 setup) or "first_month" (past client or referral:
-- first month $55, then the regular monthly price).
alter table public.client_accounts add column price_offer text check (price_offer in ('founding', 'first_month'));
