BEGIN;
-- Server-only access. User and team authorization remains in the backend.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.device_sessions, public.teams, public.team_members, public.invite_teams, public.quota_policies, public.quota_reservations, public.external_identities, public.import_tickets TO twocast_app;
GRANT USAGE, SELECT ON SEQUENCE public.device_sessions_id_seq, public.teams_id_seq TO twocast_app;
CREATE POLICY twocast_app_all ON public.device_sessions FOR ALL TO twocast_app USING (true) WITH CHECK (true);
CREATE POLICY twocast_app_all ON public.teams FOR ALL TO twocast_app USING (true) WITH CHECK (true);
CREATE POLICY twocast_app_all ON public.team_members FOR ALL TO twocast_app USING (true) WITH CHECK (true);
CREATE POLICY twocast_app_all ON public.invite_teams FOR ALL TO twocast_app USING (true) WITH CHECK (true);
CREATE POLICY twocast_app_all ON public.quota_policies FOR ALL TO twocast_app USING (true) WITH CHECK (true);
CREATE POLICY twocast_app_all ON public.quota_reservations FOR ALL TO twocast_app USING (true) WITH CHECK (true);
CREATE POLICY twocast_app_all ON public.external_identities FOR ALL TO twocast_app USING (true) WITH CHECK (true);
CREATE POLICY twocast_app_all ON public.import_tickets FOR ALL TO twocast_app USING (true) WITH CHECK (true);
COMMIT;
