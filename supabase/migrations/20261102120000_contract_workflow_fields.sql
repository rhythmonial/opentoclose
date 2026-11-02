-- "Assign Your Workflow Fields": clients pick which contract fields their
-- transaction workflow tracks. Picks refer to fields by a stable id, so
-- adding or removing boxes during review doesn't shift them.
alter table contract_documents
  add column workflow_field_ids text[] not null default '{}',
  add column workflow_fields_updated_at timestamptz;

-- Give every field saved so far an id.
update contract_documents d
set blanks = (
  select jsonb_agg(
    case when b ? 'id' then b else b || jsonb_build_object('id', gen_random_uuid()::text) end
    order by ord
  )
  from jsonb_array_elements(d.blanks) with ordinality as t(b, ord)
)
where jsonb_array_length(d.blanks) > 0;

-- The lesson becomes the configurator page at
-- /configurator/assign_your_workflow_fields.
update setup_steps
set step_type = 'configurator'
where key = 'assign_your_workflow_fields';
