ALTER TABLE public.tasks ADD COLUMN deleted_at timestamptz;
CREATE INDEX tasks_deleted_at ON public.tasks(deleted_at) WHERE deleted_at IS NOT NULL;
