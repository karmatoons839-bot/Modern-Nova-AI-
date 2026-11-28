CREATE OR REPLACE FUNCTION public.telegram_claim_generations(_limit integer)
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
 UPDATE public.generations g SET telegram_claimed_at = now(), telegram_attempts = g.telegram_attempts + 1
 WHERE g.id IN (
  SELECT q.id FROM public.generations q WHERE q.status = 'done' AND q.telegram_sent_at IS NULL AND q.telegram_attempts < 3
   AND (NOT q.telegram_approval_required OR q.telegram_approved_at IS NOT NULL)
   AND (q.telegram_claimed_at IS NULL OR q.telegram_claimed_at < now() - interval '15 minutes')
   -- Unfinished Script-to-Video projects must not occupy claim slots and starve every other creation.
   AND (q.tool <> 'script_video' OR EXISTS (SELECT 1 FROM public.s2v_projects p WHERE p.generation_id = q.id AND p.final_video_path IS NOT NULL))
  ORDER BY q.created_at LIMIT greatest(1, least(_limit,50)) FOR UPDATE SKIP LOCKED)
 RETURNING g.id
$$;
REVOKE ALL ON FUNCTION public.telegram_claim_generations(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.telegram_claim_generations(integer) TO service_role;

-- Give earlier failed forwards a fresh retry budget (approval-gated test-account items stay gated).
UPDATE public.generations SET telegram_attempts = 0, telegram_claimed_at = NULL
WHERE status = 'done' AND telegram_sent_at IS NULL AND NOT telegram_approval_required
  AND (telegram_attempts >= 3 OR tool = 'script_video');