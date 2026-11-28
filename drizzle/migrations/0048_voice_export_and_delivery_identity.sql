ALTER TABLE public.generations ADD COLUMN voice_export_hash text;
CREATE UNIQUE INDEX generations_voice_export_identity ON public.generations(user_id, voice_export_hash) WHERE tool = 'voice_full' AND voice_export_hash IS NOT NULL;
CREATE TABLE public.telegram_generation_receipts (
 generation_id uuid PRIMARY KEY REFERENCES public.generations(id),
 status text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending','sent','review')),
 started_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 error text
);
GRANT ALL ON public.telegram_generation_receipts TO service_role;
ALTER TABLE public.telegram_generation_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY telegram_generation_receipts_server ON public.telegram_generation_receipts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE OR REPLACE FUNCTION public.telegram_begin_generation(_generation uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inserted uuid;
BEGIN
 INSERT INTO public.telegram_generation_receipts(generation_id)
 SELECT g.id FROM public.generations g WHERE g.id=_generation AND g.status='done' AND g.tool<>'voice' AND g.telegram_sent_at IS NULL
 AND (NOT g.telegram_approval_required OR g.telegram_approved_at IS NOT NULL)
 AND (g.tool<>'script_video' OR EXISTS(SELECT 1 FROM public.s2v_projects p WHERE p.generation_id=g.id AND p.final_video_path IS NOT NULL))
 ON CONFLICT DO NOTHING RETURNING generation_id INTO inserted;
 RETURN inserted IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.telegram_begin_generation(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.telegram_begin_generation(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.telegram_claim_generations(_limit integer)
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
 UPDATE public.generations g SET telegram_claimed_at = now(), telegram_attempts = g.telegram_attempts + 1
 WHERE g.id IN (
 SELECT q.id FROM public.generations q WHERE q.status='done' AND q.telegram_sent_at IS NULL AND q.telegram_attempts<3
 AND q.tool<>'voice'
 AND NOT EXISTS(SELECT 1 FROM public.telegram_generation_receipts r WHERE r.generation_id=q.id)
 AND (NOT q.telegram_approval_required OR q.telegram_approved_at IS NOT NULL)
 AND (q.telegram_claimed_at IS NULL OR q.telegram_claimed_at<now()-interval '15 minutes')
 AND (q.tool<>'script_video' OR EXISTS(SELECT 1 FROM public.s2v_projects p WHERE p.generation_id=q.id AND p.final_video_path IS NOT NULL))
 ORDER BY q.created_at LIMIT greatest(1,least(_limit,50)) FOR UPDATE SKIP LOCKED) RETURNING g.id
$$;
REVOKE ALL ON FUNCTION public.telegram_claim_generations(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.telegram_claim_generations(integer) TO service_role;