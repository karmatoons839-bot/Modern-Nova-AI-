CREATE OR REPLACE FUNCTION public.diwali_settle_source() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status THEN
  -- Claims and failure refunds both acquire profile before source rows.
  PERFORM id FROM public.profiles WHERE id=NEW.user_id FOR UPDATE;
  UPDATE public.diwali_sources s SET settled_at=NEW.completed_at, eligible=(NEW.status='done' AND NOT s.reversed AND NEW.completed_at <= c.claim_opens_at)
  FROM public.diwali_campaigns c WHERE s.generation_id=NEW.id AND c.id=s.campaign_id AND s.claim_id IS NULL;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.diwali_settle_source() FROM PUBLIC;
CREATE FUNCTION public.diwali_validate_wallet_cap() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.max_return > 2147483647 THEN RAISE EXCEPTION 'Maximum return exceeds wallet capacity'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.diwali_validate_wallet_cap() FROM PUBLIC;
CREATE TRIGGER diwali_wallet_cap_validation BEFORE INSERT OR UPDATE ON public.diwali_campaigns FOR EACH ROW EXECUTE FUNCTION public.diwali_validate_wallet_cap();