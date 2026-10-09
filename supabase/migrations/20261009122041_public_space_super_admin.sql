BEGIN;
ALTER TABLE public.invite_codes ADD COLUMN account_role varchar(16) NOT NULL DEFAULT 'member' CHECK(account_role IN ('member','admin'));
ALTER TABLE public.invite_sessions ADD COLUMN disabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.invite_sessions ADD CONSTRAINT account_role_check CHECK(role IN ('member','admin','super_admin'));
ALTER TABLE public.tasks DROP CONSTRAINT tasks_visibility_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_visibility_check CHECK(visibility IN ('private','team','public'));
CREATE UNIQUE INDEX single_super_admin ON public.invite_sessions(role) WHERE role='super_admin';
-- Additional guard for the dedicated backend role; no SECURITY DEFINER or client grants.
CREATE FUNCTION public.protect_super_admin() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user='twocast_app' AND OLD.role='super_admin' THEN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Super administrator cannot be deleted'; END IF;
    IF NEW.role<>OLD.role OR NEW.disabled THEN RAISE EXCEPTION 'Super administrator cannot be demoted or disabled'; END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_super_admin() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.protect_super_admin() TO twocast_app;
CREATE TRIGGER protect_super_admin BEFORE UPDATE OR DELETE ON public.invite_sessions FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin();
COMMIT;
