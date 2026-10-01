BEGIN;
GRANT USAGE ON SCHEMA storage TO twocast_app;
GRANT SELECT (bucket_id, metadata) ON storage.objects TO twocast_app;
CREATE POLICY twocast_app_storage_metadata_read ON storage.objects FOR SELECT TO twocast_app USING (bucket_id IN ('podcast-audio','podcast-files','podcast-covers','podcast-imports'));
COMMIT;
