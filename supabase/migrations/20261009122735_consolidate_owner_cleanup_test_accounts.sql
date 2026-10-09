BEGIN;
ALTER FUNCTION public.protect_super_admin() SET search_path=pg_catalog,public;
DO $$
DECLARE owner_id integer; aliases integer[]; original_works bigint;
BEGIN
  SELECT count(*) INTO original_works FROM public.tasks;
  -- These predate administrator invitations and were all created with the deployment owner's bootstrap code.
  SELECT id INTO owner_id FROM public.invite_sessions s
    WHERE role='admin' AND invite_code_id IS NULL AND created_at<'2026-10-09T00:00:00Z'
    ORDER BY (SELECT count(*) FROM public.tasks t WHERE t.user_id=s.id) DESC,created_at LIMIT 1 FOR UPDATE;
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Owner identity requires manual review'; END IF;
  SELECT coalesce(array_agg(id),ARRAY[]::integer[]) INTO aliases FROM public.invite_sessions
    WHERE role='admin' AND invite_code_id IS NULL AND created_at<'2026-10-09T00:00:00Z' AND id<>owner_id;
  -- Stop rather than discard independently configured credentials, personal codes, SSO or shared-key ownership.
  IF EXISTS(SELECT 1 FROM public.invite_sessions WHERE id=ANY(aliases) AND login_code_hash IS NOT NULL)
    OR EXISTS(SELECT 1 FROM public.user_api_settings WHERE user_id=ANY(aliases))
    OR EXISTS(SELECT 1 FROM public.member_api_shares WHERE owner_user_id=ANY(aliases) OR recipient_user_id=ANY(aliases) OR delegated_by_user_id=ANY(aliases))
    OR EXISTS(SELECT 1 FROM public.external_identities WHERE user_id=ANY(aliases))
    OR EXISTS(SELECT 1 FROM public.api_grants WHERE user_id=ANY(aliases))
    OR EXISTS(SELECT 1 FROM public.import_tickets WHERE user_id=ANY(aliases))
    OR EXISTS(SELECT 1 FROM public.quota_policies WHERE scope='user' AND scope_id=ANY(aliases)) THEN
    RAISE EXCEPTION 'Owner aliases have independent data; review required';
  END IF;
  UPDATE public.invite_sessions SET expires_at=greatest(expires_at,(SELECT max(expires_at) FROM public.invite_sessions WHERE id=ANY(aliases))),role='super_admin',display_name=coalesce(display_name,'超级管理员') WHERE id=owner_id;
  UPDATE public.device_sessions SET user_id=owner_id WHERE user_id=ANY(aliases);
  UPDATE public.tasks SET user_id=owner_id WHERE user_id=ANY(aliases);
  UPDATE public.quota_reservations SET user_id=owner_id WHERE user_id=ANY(aliases);
  INSERT INTO public.team_members(team_id,user_id,role) SELECT DISTINCT team_id,owner_id,'admin' FROM public.team_members WHERE user_id=ANY(aliases) ON CONFLICT(team_id,user_id) DO UPDATE SET role='admin';
  DELETE FROM public.invite_sessions WHERE id=ANY(aliases);
  -- Delete only the explicitly named empty smoke-test member; never delete its content.
  DELETE FROM public.invite_sessions s USING public.invite_codes i
    WHERE s.invite_code_id=i.id AND i.label='测试1' AND s.role='member'
    AND NOT EXISTS(SELECT 1 FROM public.tasks WHERE user_id=s.id)
    AND NOT EXISTS(SELECT 1 FROM public.user_api_settings WHERE user_id=s.id)
    AND NOT EXISTS(SELECT 1 FROM public.member_api_shares WHERE owner_user_id=s.id OR recipient_user_id=s.id OR delegated_by_user_id=s.id)
    AND NOT EXISTS(SELECT 1 FROM public.api_grants WHERE user_id=s.id)
    AND NOT EXISTS(SELECT 1 FROM public.external_identities WHERE user_id=s.id)
    AND NOT EXISTS(SELECT 1 FROM public.import_tickets WHERE user_id=s.id)
    AND NOT EXISTS(SELECT 1 FROM public.quota_reservations WHERE user_id=s.id)
    AND NOT EXISTS(SELECT 1 FROM public.quota_policies WHERE scope='user' AND scope_id=s.id);
  DELETE FROM public.invite_codes i WHERE label='测试1' AND NOT EXISTS(SELECT 1 FROM public.invite_sessions WHERE invite_code_id=i.id) AND NOT EXISTS(SELECT 1 FROM public.api_grants WHERE invite_code_id=i.id);
  IF (SELECT count(*) FROM public.tasks)<>original_works THEN RAISE EXCEPTION 'Work count changed'; END IF;
END $$;
COMMIT;
