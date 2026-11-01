-- Every step is now required and shown to every plan; the only split left
-- is whether our team handles it. Lesson types are just lessons and
-- configurators. Snapshot first, so this can be reviewed or undone (the
-- per-row history also records each change).
insert into setup_content_snapshots (note, steps, resources)
select
  'Before steps were simplified (no optional/future build, all plans, lesson/configurator only)',
  coalesce((select jsonb_agg(to_jsonb(s) order by s.path, s.sort_order) from setup_steps s), '[]'),
  coalesce((select jsonb_agg(to_jsonb(r) order by r.step_id, r.sort_order) from setup_step_resources r), '[]');

update setup_steps
set is_optional = false, is_future_build = false
where is_optional or is_future_build;

update setup_steps
set completed_by = 'both'
where completed_by in ('diy', 'setup');

-- Initiate Your Setup is the /setup form, now treated as a configurator.
update setup_steps
set step_type = 'configurator', link_url = null
where key = 'setup_initiation';

-- Any other single-link steps become lessons, keeping their link as a
-- resource link.
insert into setup_step_resources (step_id, kind, label, url, sort_order)
select id, 'link', title, link_url, 0
from setup_steps
where step_type in ('form', 'link') and link_url is not null;

update setup_steps
set step_type = 'lesson'
where step_type in ('form', 'link');
