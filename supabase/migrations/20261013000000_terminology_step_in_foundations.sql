-- Move "Terminology" out of being a dead top-level nav tab and into the
-- Foundations phase of the checklist, as the first step a client does there
-- (a configurator step backed by the existing `terminology` table).

update setup_steps set sort_order = sort_order + 1 where path = 'custom' and sort_order >= 31;

insert into setup_steps (path, phase, section, key, title, description, step_type, sort_order, is_optional, completed_by, resource_url) values
('custom', 'Foundations', 'Terminology', 'terminology', 'Set Your Terminology', 'OTC uses its own vocabulary for a lot of things. Tell us which terms apply to your business and what you call them instead, so your templates and training match how your team actually talks.', 'configurator', 31, false, 'client', null);
