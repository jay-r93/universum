/*
# Create attachment storage bucket

1. Storage
- Create a private bucket `attachments` for user-uploaded images and videos.
- Files are stored under `user_<uuid>/` path prefixes.

2. Security
- Storage policies: only authenticated users can CRUD their own files under `user_<uuid>/` prefix.
- The bucket is private (not public).

3. Important notes
- The frontend uploads files directly to Supabase Storage using the supabase-js client.
- Files are keyed by `user_<auth.uid()>/<random-id>.<ext>`.
- The workspace state (user_universe_state) stores only a storage path reference instead of base64 data.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "select_own_attachments" ON storage.objects;
CREATE POLICY "select_own_attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = 'user_' || auth.uid()::text);

DROP POLICY IF EXISTS "insert_own_attachments" ON storage.objects;
CREATE POLICY "insert_own_attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'attachments' AND (storage.foldername(name))[1] = 'user_' || auth.uid()::text);

DROP POLICY IF EXISTS "update_own_attachments" ON storage.objects;
CREATE POLICY "update_own_attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = 'user_' || auth.uid()::text)
WITH CHECK (bucket_id = 'attachments' AND (storage.foldername(name))[1] = 'user_' || auth.uid()::text);

DROP POLICY IF EXISTS "delete_own_attachments" ON storage.objects;
CREATE POLICY "delete_own_attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = 'user_' || auth.uid()::text);
