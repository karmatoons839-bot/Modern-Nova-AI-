ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS telegram_sent_at timestamptz, ADD COLUMN IF NOT EXISTS telegram_attempts integer NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS telegram_claimed_at timestamptz;
CREATE INDEX IF NOT EXISTS generations_telegram_pending_idx ON public.generations (created_at) WHERE telegram_sent_at IS NULL AND status = 'done';
CREATE OR REPLACE FUNCTION public.telegram_claim_generations(_limit integer)
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.generations g SET telegram_claimed_at = now(), telegram_attempts = g.telegram_attempts + 1
  WHERE g.id IN (
    SELECT id FROM public.generations
    WHERE status = 'done' AND telegram_sent_at IS NULL AND telegram_attempts < 3
      AND (telegram_claimed_at IS NULL OR telegram_claimed_at < now() - interval '15 minutes')
    ORDER BY created_at LIMIT greatest(1, least(_limit, 50)) FOR UPDATE SKIP LOCKED)
  RETURNING g.id
$$;
REVOKE ALL ON FUNCTION public.telegram_claim_generations(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.telegram_claim_generations(integer) TO service_role;