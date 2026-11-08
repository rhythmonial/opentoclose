-- Images and videos on support questions and replies:
-- [{ path, name, type, size }], files in the support-attachments bucket.
alter table public.support_messages
  add column if not exists attachments jsonb not null default '[]'::jsonb;

-- Private bucket, one folder per uploader: <user_id>/<file>. Pages show
-- files through short-lived signed links made on the server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support-attachments', 'support-attachments', false, 52428800, array['image/*', 'video/*'])
on conflict (id) do nothing;

create policy "support_attachments_select_own_or_staff" on storage.objects for select
  using (
    bucket_id = 'support-attachments'
    and (is_staff() or (storage.foldername(name))[1] = auth.uid()::text)
  );

create policy "support_attachments_insert_own" on storage.objects for insert
  with check (
    bucket_id = 'support-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "support_attachments_delete_own" on storage.objects for delete
  using (
    bucket_id = 'support-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
