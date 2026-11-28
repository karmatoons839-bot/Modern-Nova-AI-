CREATE TABLE public.video_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  generation_id uuid references public.generations(id),
  mode text not null,
  prompt text not null,
  negative_prompt text,
  source_image_mime text,
  aspect_ratio text not null,
  duration_seconds integer not null,
  visual_style text not null,
  provider text not null default 'lovable-ai-gateway',
  model text not null default 'google/gemini-omni-1.1-flash',
  provider_job_id text,
  status text not null default 'queued',
  output_video_path text,
  credits_charged integer not null,
  error_code text,
  error_message text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
GRANT SELECT ON public.video_jobs TO authenticated;
GRANT ALL ON public.video_jobs TO service_role;
ALTER TABLE public.video_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own video jobs" ON public.video_jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX video_jobs_user_created ON public.video_jobs (user_id, created_at desc);