-- Initiate Your Setup is a form (its own page at /setup), so it's a
-- configurator, not a lesson.
update public.setup_steps set step_type = 'configurator' where key = 'setup_initiation';
