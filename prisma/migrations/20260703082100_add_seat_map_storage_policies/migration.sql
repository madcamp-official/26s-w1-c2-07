INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'seat-maps',
  'seat-maps',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  updated_at = now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'seat_maps_public_read'
  ) THEN
    CREATE POLICY "seat_maps_public_read"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'seat-maps');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'seat_maps_authenticated_upload'
  ) THEN
    CREATE POLICY "seat_maps_authenticated_upload"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'seat-maps'
      AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'seat_maps_authenticated_delete_own'
  ) THEN
    CREATE POLICY "seat_maps_authenticated_delete_own"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'seat-maps'
      AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
    );
  END IF;
END $$;

