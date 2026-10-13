-- Redefine what a step "is": lesson_type now distinguishes a full Lesson
-- (video + resources, what every step already behaved like) from a bare
-- Form or Link (a single URL the step opens straight to) and the existing
-- Configurator (a one-off custom-built page, unchanged).
alter type step_type add value if not exists 'lesson';
alter type step_type add value if not exists 'link';

alter table setup_steps add column if not exists link_url text;

-- Every existing step except the one Configurator (Terminology) keeps
-- behaving exactly as it does today by becoming 'lesson' explicitly.
update setup_steps set step_type = 'lesson' where step_type <> 'configurator';
