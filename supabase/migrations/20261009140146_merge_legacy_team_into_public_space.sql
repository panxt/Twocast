BEGIN;
-- Retire only the original migration-created default team; preserve independent groups.
DO $$
DECLARE legacy_id integer; works_before bigint;
BEGIN
  SELECT count(*) INTO works_before FROM public.tasks;
  FOR legacy_id IN SELECT id FROM public.teams WHERE name='原有团队' LOOP
    -- Publish only completed content shared exclusively to this default team.
    UPDATE public.tasks SET visibility='public', shared_team_ids='[]'::json
      WHERE visibility='team' AND status='success'
      AND shared_team_ids::jsonb=jsonb_build_array(legacy_id);
    UPDATE public.teams SET active=false WHERE id=legacy_id;
    DELETE FROM public.invite_teams WHERE team_id=legacy_id;
  END LOOP;
  IF (SELECT count(*) FROM public.tasks) <> works_before THEN RAISE EXCEPTION 'Work count changed'; END IF;
END $$;
COMMIT;
