ALTER TABLE public.generations DROP CONSTRAINT IF EXISTS generations_tool_check;
ALTER TABLE public.generations ADD CONSTRAINT generations_tool_check CHECK (tool IN ('voice','voice_full','image','thumbnail','story','music'));
-- One running music generation per user: blocks duplicate/double-click requests atomically.
CREATE UNIQUE INDEX IF NOT EXISTS generations_one_pending_music ON public.generations (user_id) WHERE tool = 'music' AND status = 'pending';

CREATE TABLE public.music_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tool text NOT NULL DEFAULT 'AI Music Maker',
  duration integer NOT NULL CHECK (duration IN (15,30,60,90)),
  credit_cost integer NOT NULL,
  status text NOT NULL CHECK (status IN ('reserved','completed','refunded')),
  generation_id uuid NOT NULL UNIQUE REFERENCES public.generations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.music_transactions TO authenticated;
GRANT ALL ON public.music_transactions TO service_role;
ALTER TABLE public.music_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own music transactions" ON public.music_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all music transactions" ON public.music_transactions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX ON public.music_transactions (created_at DESC);