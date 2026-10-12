-- Lets each setup step be assigned to either the client or internal staff
-- (dev/dev_admin), so the portal and the setup-steps editor can treat them
-- differently. Defaults to 'client' for all existing steps; assignment of
-- which steps are staff-owned is done through the editor, not here.
alter table setup_steps add column completed_by text not null default 'client';
