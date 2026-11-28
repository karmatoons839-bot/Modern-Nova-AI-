-- Telegram channel poster material queue: fresh AI PNG/background posts, deduplicated by prompt_key, lease-claimed for safe retry.
CREATE TABLE public.telegram_poster_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('png','background')),
  prompt text NOT NULL,
  prompt_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','posted','failed')),
  lease_until timestamptz,
  local_date date NOT NULL,
  storage_path text,
  message_id bigint,
  error text,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  posted_at timestamptz
);
GRANT ALL ON public.telegram_poster_queue TO service_role;
ALTER TABLE public.telegram_poster_queue ENABLE ROW LEVEL SECURITY;
CREATE INDEX telegram_poster_queue_status_idx ON public.telegram_poster_queue (status, lease_until) WHERE status IN ('queued','running');
CREATE INDEX telegram_poster_queue_date_idx ON public.telegram_poster_queue (local_date, kind, status);

-- Poster settings: daily targets, pause reason (circuit breaker), cached invite links.
ALTER TABLE public.telegram_broadcast_settings ADD COLUMN IF NOT EXISTS poster_daily_png int NOT NULL DEFAULT 50;
ALTER TABLE public.telegram_broadcast_settings ADD COLUMN IF NOT EXISTS poster_daily_backgrounds int NOT NULL DEFAULT 50;
ALTER TABLE public.telegram_broadcast_settings ADD COLUMN IF NOT EXISTS poster_paused_reason text;
ALTER TABLE public.telegram_broadcast_settings ADD COLUMN IF NOT EXISTS channel_invite_link text;
ALTER TABLE public.telegram_broadcast_settings ADD COLUMN IF NOT EXISTS support_invite_link text;