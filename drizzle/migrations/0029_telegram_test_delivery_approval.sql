ALTER TABLE public.generations ADD COLUMN telegram_approval_required boolean NOT NULL DEFAULT false, ADD COLUMN telegram_approved_at timestamptz, ADD COLUMN telegram_approved_by uuid;
CREATE OR REPLACE FUNCTION public.telegram_test_delivery_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.user_id = '36380128-ba23-4dc1-a3ec-c18d12623209'::uuid THEN NEW.telegram_approval_required := true; END IF;
 IF NEW.telegram_approval_required AND NEW.telegram_approved_at IS NULL THEN
  IF TG_OP = 'UPDATE' AND NEW.telegram_claimed_at IS DISTINCT FROM OLD.telegram_claimed_at AND NEW.telegram_claimed_at IS NOT NULL THEN RETURN NULL; END IF;
  IF TG_OP = 'INSERT' THEN NEW.telegram_claimed_at := NULL; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER telegram_test_delivery_guard BEFORE INSERT OR UPDATE ON public.generations FOR EACH ROW EXECUTE FUNCTION public.telegram_test_delivery_guard();
UPDATE public.generations SET telegram_approval_required = true WHERE user_id = '36380128-ba23-4dc1-a3ec-c18d12623209'::uuid;
CREATE OR REPLACE FUNCTION public.telegram_claim_generations(_limit integer)
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
 UPDATE public.generations g SET telegram_claimed_at = now(), telegram_attempts = g.telegram_attempts + 1
 WHERE g.id IN (
  SELECT id FROM public.generations WHERE status = 'done' AND telegram_sent_at IS NULL AND telegram_attempts < 3
   AND (NOT telegram_approval_required OR telegram_approved_at IS NOT NULL)
   AND (telegram_claimed_at IS NULL OR telegram_claimed_at < now() - interval '15 minutes')
  ORDER BY created_at LIMIT greatest(1, least(_limit,50)) FOR UPDATE SKIP LOCKED)
 RETURNING g.id
$$;
REVOKE ALL ON FUNCTION public.telegram_claim_generations(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.telegram_claim_generations(integer) TO service_role;
CREATE OR REPLACE FUNCTION public.telegram_approve_creation(_owner uuid, _generation uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE gid uuid;
BEGIN
 IF NOT public.has_role(_owner,'admin'::public.app_role) THEN RAISE EXCEPTION 'OWNER_APPROVAL_REQUIRED'; END IF;
 UPDATE public.generations SET telegram_approved_at = coalesce(telegram_approved_at,now()), telegram_approved_by = coalesce(telegram_approved_by,_owner)
 WHERE id = _generation AND telegram_approval_required AND status = 'done' AND telegram_sent_at IS NULL RETURNING id INTO gid;
 IF gid IS NULL THEN RAISE EXCEPTION 'DELIVERY_NOT_READY'; END IF;
 RETURN gid;
END $$;
REVOKE ALL ON FUNCTION public.telegram_approve_creation(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.telegram_approve_creation(uuid,uuid) TO service_role;