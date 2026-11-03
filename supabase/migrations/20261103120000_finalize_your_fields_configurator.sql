-- Finalize Your Fields becomes a configurator (/configurator/finalize_your_fields).
update setup_steps set step_type = 'configurator' where key = 'finalize_your_fields';
