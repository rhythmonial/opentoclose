-- Seed data for the "custom" (full-service) setup path.
-- The "express" path's numbered 00-09 toolkit sequence is seeded separately
-- once that flow is built.

insert into setup_steps (path, section, key, title, description, step_type, sort_order) values
  ('custom', 'Onboarding', 'initiation_payment', 'Setup Initiation & Payment', 'Your signed contract and bundle payment.', 'form', 1),
  ('custom', 'Onboarding', 'terminology', 'Set Your Terminology', 'Tell us your state''s terms so every sample is ready to use.', 'configurator', 2),
  ('custom', 'Prep Sheets', 'date_calculations', 'Date Setup Prep Sheet', 'Confirm or adjust OTC''s default deadline calculations.', 'configurator', 3),
  ('custom', 'Prep Sheets', 'doc_templates', 'Doc Setup Prep Sheet', 'Review your document templates and intro-email roles.', 'configurator', 4),
  ('custom', 'Prep Sheets', 'task_templates', 'Task Setup Prep Sheet', 'Review your task templates and triggers.', 'configurator', 5),
  ('custom', 'Prep Sheets', 'share_sheets', 'Share Your Prep Sheets', 'Submit all prep sheets together for review.', 'form', 6),
  ('custom', 'Build', 'kickoff_call', 'Kickoff Call', 'Schedule your 1:1 to kick off the build.', 'external_link', 7),
  ('custom', 'Build', 'build_launch', 'Build & Launch', 'We build your workspace behind the scenes and launch it with you.', 'form', 8)
on conflict (path, key) do nothing;
