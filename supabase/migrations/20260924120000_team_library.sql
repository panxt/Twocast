-- Existing material stays private until its owner or an administrator shares it.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS visibility varchar(8) NOT NULL DEFAULT 'private';

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_visibility_check CHECK (visibility IN ('private', 'team'));

CREATE INDEX IF NOT EXISTS tasks_team_created_idx
  ON public.tasks (created_at DESC) WHERE visibility = 'team';
