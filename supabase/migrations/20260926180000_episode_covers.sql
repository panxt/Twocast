-- 节目封面：用户上传或 AI 生成的一张图，按 supabase-cover:<file> 记在 tasks.cover_location。
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS cover_location varchar(255);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('podcast-covers', 'podcast-covers', false, 3000000,
  ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO NOTHING;
