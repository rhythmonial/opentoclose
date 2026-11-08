-- Why and when a subscription was cancelled (from Stripe's cancellation
-- details: the client's feedback in the billing portal, or the reason staff
-- gave when cancelling).
alter table public.subscriptions
  add column cancel_reason text,
  add column canceled_at timestamptz;
