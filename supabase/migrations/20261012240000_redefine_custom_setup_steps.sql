-- Replaces the original 8-step "custom" checklist with the canonical
-- 10-stage list: Setup Initiation, Setup Paid, Workflow Fields, Date Field
-- Calculations, Contact Management, Document Management, Email Templates,
-- Task Templates, Intake Form Setup, Build & Launch.

delete from setup_steps where path = 'custom';

insert into setup_steps (path, section, key, title, description, step_type, sort_order) values
  ('custom', 'Getting Started', 'setup_initiation', 'Setup Initiation', 'Complete the intake form so we know your business and starting point.', 'form', 1),
  ('custom', 'Getting Started', 'setup_paid', 'Setup Paid', 'Payment received and your setup officially begins.', 'form', 2),
  ('custom', 'Configuration', 'workflow_fields', 'Workflow Fields', 'Confirm which fields you need and rename anything to match your terminology.', 'configurator', 3),
  ('custom', 'Configuration', 'date_field_calculations', 'Date Field Calculations', 'Set how key dates are calculated from your contract.', 'configurator', 4),
  ('custom', 'Configuration', 'contact_management', 'Contact Management', 'Set up contact roles and how they flow through a transaction.', 'configurator', 5),
  ('custom', 'Configuration', 'document_management', 'Document Management', 'Upload and organize your document templates.', 'configurator', 6),
  ('custom', 'Configuration', 'email_templates', 'Email Templates', 'Build out the email templates sent throughout a transaction.', 'configurator', 7),
  ('custom', 'Configuration', 'task_templates', 'Task Templates', 'Define the tasks that get triggered at each stage.', 'configurator', 8),
  ('custom', 'Configuration', 'intake_form_setup', 'Intake Form Setup', 'Configure the intake form your team uses to start a new file.', 'configurator', 9),
  ('custom', 'Launch', 'build_launch', 'Build & Launch', 'We build everything into your OTC account and you go live.', 'form', 10);
