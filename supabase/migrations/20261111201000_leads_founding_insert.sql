-- Founding group applications add a lead too (from anyone, signed in or not).
drop policy leads_public_insert on public.leads;
create policy leads_public_insert on public.leads for insert to anon, authenticated
  with check (status = 'new'::lead_status and source in ('request_info', 'founding') and converted_client_account_id is null);
