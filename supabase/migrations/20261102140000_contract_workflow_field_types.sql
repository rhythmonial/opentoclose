-- Each picked workflow field now records what kind of field it is:
-- [{ id, type: contact|text|text_area|decimal|date|number|choice,
--    decimal_format?: currency|percentage, choice_role?: question|option }]
-- workflow_field_ids is replaced by this.
alter table contract_documents
  add column workflow_fields jsonb not null default '[]'::jsonb;

update contract_documents
set workflow_fields = (
  select coalesce(jsonb_agg(jsonb_build_object('id', id)), '[]'::jsonb)
  from unnest(workflow_field_ids) as id
)
where cardinality(workflow_field_ids) > 0;
