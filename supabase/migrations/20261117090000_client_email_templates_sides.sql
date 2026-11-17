-- Which tabs a template shows on in Prep Your Messages (buyer, seller, listing, other); empty = from its title's prefix.
alter table public.client_email_templates add column if not exists sides text[] not null default '{}';
