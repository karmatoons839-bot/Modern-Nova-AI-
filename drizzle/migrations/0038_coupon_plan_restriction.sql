ALTER TABLE public.promo_codes ADD COLUMN allowed_plan text;
ALTER TABLE public.promo_codes ADD CONSTRAINT promo_codes_allowed_plan_check CHECK (allowed_plan IS NULL OR allowed_plan IN ('creator','pro','premium'));
CREATE OR REPLACE FUNCTION public.enforce_promo_plan() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE restricted_plan text;
BEGIN
 IF NEW.promo_code IS NOT NULL THEN
  SELECT allowed_plan INTO restricted_plan FROM public.promo_codes WHERE code=NEW.promo_code;
  IF restricted_plan IS NOT NULL AND NEW.plan IS DISTINCT FROM restricted_plan THEN RAISE EXCEPTION 'PROMO_PLAN_NOT_ALLOWED'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_promo_plan() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER payments_promo_plan_guard BEFORE INSERT OR UPDATE OF plan,promo_code ON public.payments FOR EACH ROW EXECUTE FUNCTION public.enforce_promo_plan();