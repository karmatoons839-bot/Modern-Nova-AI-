DO $$ DECLARE c text; BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.payments'::regclass AND contype='c' AND pg_get_constraintdef(oid) ILIKE '%status%' LOOP
    EXECUTE format('ALTER TABLE public.payments DROP CONSTRAINT %I', c);
  END LOOP; END $$;
UPDATE public.payments SET status = CASE status WHEN 'paid' THEN 'success' WHEN 'created' THEN 'pending' ELSE status END;
ALTER TABLE public.payments ALTER COLUMN status SET DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS order_id text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS credits integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_start timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_end timestamptz,
  ADD CONSTRAINT payments_status_check CHECK (status IN ('pending','success','failed','cancelled','refunded'));
UPDATE public.payments SET order_id = 'MN-' || replace(id::text,'-','') WHERE order_id IS NULL;
ALTER TABLE public.payments ALTER COLUMN order_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payments_order_id_key ON public.payments(order_id);
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_order_key ON public.payments(provider_order_id) WHERE provider_order_id IS NOT NULL;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'none'
  CHECK (subscription_status IN ('none','active','expired'));

CREATE OR REPLACE FUNCTION public.activate_payment(_order text, _txn text, _method text, _amount_paise integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p public.payments; em text; s timestamptz := now(); e timestamptz := now() + interval '30 days';
BEGIN
  SELECT * INTO p FROM public.payments WHERE order_id = _order FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF p.status = 'success' THEN RETURN 'already_processed'; END IF;
  IF p.status IN ('refunded') THEN RAISE EXCEPTION 'ORDER_CLOSED'; END IF;
  IF p.amount_paise <> _amount_paise THEN RAISE EXCEPTION 'AMOUNT_MISMATCH'; END IF;
  UPDATE public.payments SET status='success', provider_payment_id=_txn, payment_method=_method, verified_at=now(),
    subscription_start=s, subscription_end=e WHERE id=p.id;
  UPDATE public.profiles SET plan=p.plan, subscription_status='active', plan_renews_at=e,
    credits = credits + p.credits, updated_at=now() WHERE id=p.user_id;
  INSERT INTO public.credit_ledger (user_id, amount, reason) VALUES (p.user_id, p.credits, initcap(p.plan) || ' plan payment ' || _order);
  IF p.promo_code IS NOT NULL THEN UPDATE public.promo_codes SET uses = uses + 1 WHERE code = p.promo_code; END IF;
  SELECT email INTO em FROM public.profiles WHERE id=p.user_id;
  PERFORM public.admin_notify('payment','[Modern Nova AI] Payment Successful',
    COALESCE(em,'?') || ' paid ₹' || (p.amount_paise/100.0) || ' for ' || initcap(p.plan) || '. Order ' || _order || ', txn ' || _txn,
    'medium', p.user_id, _txn, jsonb_build_object('order_id',_order,'plan',p.plan,'amount_paise',p.amount_paise,'credits',p.credits));
  RETURN 'activated';
END $$;

CREATE OR REPLACE FUNCTION public.close_payment(_order text, _status text, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p public.payments; em text;
BEGIN
  IF _status NOT IN ('failed','cancelled') THEN RAISE EXCEPTION 'BAD_STATUS'; END IF;
  SELECT * INTO p FROM public.payments WHERE order_id=_order FOR UPDATE;
  IF p.id IS NULL OR p.status <> 'pending' THEN RETURN; END IF;
  UPDATE public.payments SET status=_status WHERE id=p.id;
  IF _status='failed' THEN
    SELECT email INTO em FROM public.profiles WHERE id=p.user_id;
    PERFORM public.admin_notify('payment','[Modern Nova AI] Payment Failed',
      COALESCE(em,'?') || ' — ' || initcap(p.plan) || ' order ' || _order || ': ' || left(COALESCE(_reason,''),300),
      'high', p.user_id, _order, jsonb_build_object('order_id',_order,'plan',p.plan), 'pay-fail');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.expire_subscriptions(_user uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer;
BEGIN
  UPDATE public.profiles SET plan='free', subscription_status='expired', updated_at=now()
   WHERE subscription_status='active' AND plan_renews_at < now() AND (_user IS NULL OR id=_user)
     AND NOT public.has_role(id,'admin');
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.spend_credits(_user uuid, _tool text, _cost integer, _prompt text, _style text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE bal integer; st text; gid uuid; adm boolean;
BEGIN
  adm := public.has_role(_user, 'admin');
  SELECT credits, status INTO bal, st FROM public.profiles WHERE id = _user FOR UPDATE;
  IF bal IS NULL THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;
  IF st = 'suspended' THEN RAISE EXCEPTION 'ACCOUNT_SUSPENDED'; END IF;
  IF adm THEN
    INSERT INTO public.generations (user_id, tool, prompt, style, cost) VALUES (_user, _tool, left(_prompt, 20000), _style, 0) RETURNING id INTO gid;
    RETURN gid;
  END IF;
  IF bal < _cost THEN RAISE EXCEPTION 'INSUFFICIENT_CREDITS'; END IF;
  UPDATE public.profiles SET credits = credits - _cost, updated_at = now() WHERE id = _user;
  INSERT INTO public.generations (user_id, tool, prompt, style, cost) VALUES (_user, _tool, left(_prompt, 20000), _style, _cost) RETURNING id INTO gid;
  INSERT INTO public.credit_ledger (user_id, amount, reason, generation_id) VALUES (_user, -_cost, initcap(_tool) || ' generation', gid);
  RETURN gid;
END $function$;

REVOKE ALL ON FUNCTION public.activate_payment(text,text,text,integer), public.close_payment(text,text,text), public.expire_subscriptions(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_payment(text,text,text,integer), public.close_payment(text,text,text), public.expire_subscriptions(uuid) TO service_role;