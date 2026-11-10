-- "Assign Your Workflow Fields" is now "Assign Your Fields".
update public.setup_steps set title = 'Assign Your Fields'
where key = 'assign_your_workflow_fields' and title = 'Assign Your Workflow Fields';
