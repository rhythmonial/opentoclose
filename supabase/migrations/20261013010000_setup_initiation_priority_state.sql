-- Supports the states-serviced multiselect: when a client services more
-- than one state, they pick which one to set up first.
alter table setup_initiation add column if not exists priority_state text;
