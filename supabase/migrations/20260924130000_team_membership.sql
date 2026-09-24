-- Previous invitations remain trial users; only explicitly designated
-- team accounts can see episodes shared to the workspace.
ALTER TABLE public.invite_codes
  ADD COLUMN IF NOT EXISTS team_access boolean NOT NULL DEFAULT false;

ALTER TABLE public.invite_sessions
  ADD COLUMN IF NOT EXISTS team_access boolean NOT NULL DEFAULT false;
