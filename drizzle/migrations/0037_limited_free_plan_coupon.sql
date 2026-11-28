ALTER TABLE public.promo_codes DROP CONSTRAINT promo_codes_percent_check;
ALTER TABLE public.promo_codes ADD CONSTRAINT promo_codes_percent_check CHECK (percent BETWEEN 1 AND 100);
CREATE OR REPLACE FUNCTION public.redeem_free_promo(_user uuid, _plan text, _code text, _credits integer, _order text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.promo_codes;
BEGIN
  SELECT * INTO c FROM public.promo_codes WHERE code=upper(trim(_code)) FOR UPDATE;
  IF c.id IS NULL OR NOT c.active OR c.percent<>100 OR c.max_uses IS NULL OR c.uses>=c.max_uses OR (c.expires_at IS NOT NULL AND c.expires_at<=now()) THEN RAISE EXCEPTION 'PROMO_INVALID_OR_EXHAUSTED'; END IF;
  IF _plan NOT IN ('creator','pro','premium') OR _credits<=0 THEN RAISE EXCEPTION 'INVALID_PLAN'; END IF;
  PERFORM 1 FROM public.profiles WHERE id=_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_NOT_FOUND'; END IF;
  IF EXISTS (SELECT 1 FROM public.payments WHERE user_id=_user AND promo_code=c.code AND status='success') THEN RAISE EXCEPTION 'PROMO_ALREADY_USED'; END IF;
  INSERT INTO public.payments(user_id,plan,amount_paise,currency,order_id,payment_method,status,credits,promo_code,discount_percent,bonus_credits)
  VALUES(_user,_plan,0,'INR',_order,'free_coupon','pending',_credits,c.code,100,0);
  RETURN public.activate_payment(_order,'coupon:'||_order,'free_coupon',0);
END $$;
REVOKE ALL ON FUNCTION public.redeem_free_promo(uuid,text,text,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_free_promo(uuid,text,text,integer,text) TO service_role;