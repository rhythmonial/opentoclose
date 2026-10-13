-- Renames completed_by values to match the new dev-facing buttons:
--   client -> both, staff -> setup, staff_always -> staff
-- and adds a new "diy" value (hidden from the Setup portal view, shown
-- under DIY) plus a separate is_future_build flag alongside is_optional.
update public.setup_steps set completed_by = 'setup' where completed_by = 'staff';
update public.setup_steps set completed_by = 'staff' where completed_by = 'staff_always';
update public.setup_steps set completed_by = 'both' where completed_by = 'client';

alter table public.setup_steps add column if not exists is_future_build boolean not null default false;
