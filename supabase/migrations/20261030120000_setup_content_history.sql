-- Safety net for the Setup Tasks content (and the client work tied to it).
--
-- 1. setup_content_history keeps the previous copy of a lesson or resource
--    link whenever it's edited or deleted, plus the client progress and
--    submissions that get deleted along with a lesson.
-- 2. restore_setup_step() brings a deleted lesson back with all of that.
-- 3. setup_content_snapshots holds full point-in-time copies; one is taken
--    now.

create table setup_content_history (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_id uuid not null,
  operation text not null check (operation in ('UPDATE', 'DELETE')),
  old_row jsonb not null,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create index setup_content_history_lookup_idx
  on setup_content_history (table_name, operation, changed_at desc);
create index setup_content_history_row_idx
  on setup_content_history (row_id, changed_at desc);

alter table setup_content_history enable row level security;

-- Staff can read it; only the triggers below write to it.
create policy "setup_content_history_select_staff" on setup_content_history for select
  using (is_staff());

create or replace function record_setup_content_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Reordering only changes sort_order; that isn't worth keeping and would
  -- flood the history, since one move renumbers many lessons.
  if TG_OP = 'UPDATE'
     and (to_jsonb(OLD) - 'sort_order') = (to_jsonb(NEW) - 'sort_order') then
    return null;
  end if;

  insert into setup_content_history (table_name, row_id, operation, old_row, changed_by)
  values (TG_TABLE_NAME, OLD.id, TG_OP, to_jsonb(OLD), auth.uid());
  return null;
end;
$$;

create trigger setup_steps_history
  after update or delete on setup_steps
  for each row execute function record_setup_content_history();

create trigger setup_step_resources_history
  after update or delete on setup_step_resources
  for each row execute function record_setup_content_history();

-- Client work is only captured when it's deleted (as happens when its
-- lesson is), not on every status change.
create trigger client_step_status_history
  after delete on client_step_status
  for each row execute function record_setup_content_history();

create trigger submissions_history
  after delete on submissions
  for each row execute function record_setup_content_history();

-- Brings back a deleted lesson exactly as it was, in its pillar, section
-- and place, with the resource links, client progress and submissions that
-- were deleted along with it.
create or replace function restore_setup_step(p_step_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted setup_content_history;
  step setup_steps;
begin
  if not is_staff() then
    raise exception 'Only staff can restore lessons';
  end if;
  if exists (select 1 from setup_steps where id = p_step_id) then
    raise exception 'This lesson has already been restored';
  end if;

  select * into deleted
  from setup_content_history
  where table_name = 'setup_steps' and operation = 'DELETE' and row_id = p_step_id
  order by changed_at desc
  limit 1;
  if not found then
    raise exception 'No deleted copy of this lesson was found';
  end if;

  step := jsonb_populate_record(null::setup_steps, deleted.old_row);
  -- Keys must be unique per path; a newer lesson may have taken this one.
  if exists (select 1 from setup_steps where path = step.path and key = step.key) then
    step.key := step.key || '_restored_' || substr(md5(random()::text), 1, 4);
  end if;
  insert into setup_steps select step.*;

  -- Everything cascaded away with it, within a few minutes of the delete.
  insert into setup_step_resources
  select r.*
  from setup_content_history h,
    lateral jsonb_populate_record(null::setup_step_resources, h.old_row) r
  where h.table_name = 'setup_step_resources'
    and h.operation = 'DELETE'
    and h.old_row ->> 'step_id' = p_step_id::text
    and h.changed_at between deleted.changed_at - interval '5 minutes'
                         and deleted.changed_at + interval '5 minutes'
  on conflict do nothing;

  insert into client_step_status
  select c.*
  from setup_content_history h,
    lateral jsonb_populate_record(null::client_step_status, h.old_row) c
  where h.table_name = 'client_step_status'
    and h.operation = 'DELETE'
    and h.old_row ->> 'step_id' = p_step_id::text
    and h.changed_at between deleted.changed_at - interval '5 minutes'
                         and deleted.changed_at + interval '5 minutes'
  on conflict do nothing;

  insert into submissions
  select s.*
  from setup_content_history h,
    lateral jsonb_populate_record(null::submissions, h.old_row) s
  where h.table_name = 'submissions'
    and h.operation = 'DELETE'
    and h.old_row ->> 'step_id' = p_step_id::text
    and h.changed_at between deleted.changed_at - interval '5 minutes'
                         and deleted.changed_at + interval '5 minutes'
  on conflict do nothing;
end;
$$;

revoke all on function restore_setup_step(uuid) from public, anon;
grant execute on function restore_setup_step(uuid) to authenticated;

create table setup_content_snapshots (
  id bigint generated always as identity primary key,
  taken_at timestamptz not null default now(),
  note text,
  steps jsonb not null,
  resources jsonb not null
);

alter table setup_content_snapshots enable row level security;

create policy "setup_content_snapshots_select_staff" on setup_content_snapshots for select
  using (is_staff());

insert into setup_content_snapshots (note, steps, resources)
select
  'Before history tracking was added',
  coalesce((select jsonb_agg(to_jsonb(s) order by s.path, s.sort_order) from setup_steps s), '[]'),
  coalesce((select jsonb_agg(to_jsonb(r) order by r.step_id, r.sort_order) from setup_step_resources r), '[]');
