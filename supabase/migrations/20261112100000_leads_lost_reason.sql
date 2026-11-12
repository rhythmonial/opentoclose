-- Why and when a lead was lost.
alter table public.leads add column if not exists lost_reason text, add column if not exists lost_at timestamptz;
update public.leads set lost_at = coalesce(archived_at, updated_at) where status = 'lost' and lost_at is null;
