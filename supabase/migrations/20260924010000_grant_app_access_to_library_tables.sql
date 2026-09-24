-- The dedicated server-side application role needs privileges on tables
-- created after the original deployment. Browser roles retain no access.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_api_settings, public.api_grants TO twocast_app;
GRANT USAGE, SELECT ON SEQUENCE public.api_grants_id_seq TO twocast_app;

CREATE POLICY twocast_app_all ON public.user_api_settings
  FOR ALL TO twocast_app USING (true) WITH CHECK (true);
CREATE POLICY twocast_app_all ON public.api_grants
  FOR ALL TO twocast_app USING (true) WITH CHECK (true);
