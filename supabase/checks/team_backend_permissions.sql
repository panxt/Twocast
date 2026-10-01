-- Read-only deployment check: run as the database maintenance role after migrations.
DO $$
DECLARE table_name text; operation text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['device_sessions','teams','team_members','invite_teams','quota_policies','quota_reservations','external_identities','import_tickets'] LOOP
    FOREACH operation IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
      IF NOT has_table_privilege('twocast_app','public.'||table_name,operation) THEN
        RAISE EXCEPTION 'Missing backend % on %',operation,table_name;
      END IF;
      IF has_table_privilege('anon','public.'||table_name,operation) OR has_table_privilege('authenticated','public.'||table_name,operation) THEN
        RAISE EXCEPTION 'Unexpected browser % on %',operation,table_name;
      END IF;
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=table_name AND policyname='twocast_app_all' AND roles=ARRAY['twocast_app']::name[] AND cmd='ALL' AND qual='true' AND with_check='true') THEN
      RAISE EXCEPTION 'Missing backend RLS policy on %',table_name;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=table_name AND c.relrowsecurity) THEN
      RAISE EXCEPTION 'RLS disabled on %',table_name;
    END IF;
  END LOOP;
  IF NOT has_sequence_privilege('twocast_app','public.device_sessions_id_seq','USAGE') OR NOT has_sequence_privilege('twocast_app','public.teams_id_seq','USAGE') THEN
    RAISE EXCEPTION 'Missing backend identity sequence access';
  END IF;
  IF NOT has_schema_privilege('twocast_app','storage','USAGE') OR NOT has_column_privilege('twocast_app','storage.objects','metadata','SELECT') OR NOT has_column_privilege('twocast_app','storage.objects','bucket_id','SELECT') THEN
    RAISE EXCEPTION 'Missing storage metrics read access';
  END IF;
  IF NOT has_column_privilege('twocast_app','storage.objects','name','SELECT') OR NOT has_column_privilege('twocast_app','storage.objects','created_at','SELECT') THEN
    RAISE EXCEPTION 'Missing storage cleanup metadata read access';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='twocast_app_storage_metadata_read' AND roles=ARRAY['twocast_app']::name[] AND cmd='SELECT') THEN
    RAISE EXCEPTION 'Missing storage metrics RLS policy';
  END IF;
END $$;
