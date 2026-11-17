-- Tasks can be on an "Other" side too (beside Buyer, Seller, Listing).
alter table public.client_task_plans drop constraint client_task_plans_side_check;
alter table public.client_task_plans add constraint client_task_plans_side_check check ((side = any (array['buyer','seller','listing','other'])) or (side ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'));
