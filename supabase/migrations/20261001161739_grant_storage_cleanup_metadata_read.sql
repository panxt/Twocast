-- The existing server-only bucket policy also limits cleanup metadata reads.
GRANT SELECT (name, created_at) ON storage.objects TO twocast_app;
