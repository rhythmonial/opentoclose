-- Field Setup: the new fields they've marked as created in Open to Close.
alter table public.client_field_organization add column if not exists built_fields text[] not null default '{}';
