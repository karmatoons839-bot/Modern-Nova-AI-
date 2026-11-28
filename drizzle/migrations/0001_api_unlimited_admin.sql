CREATE OR REPLACE FUNCTION public.api_is_unlimited(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user, 'admin')
      OR EXISTS (SELECT 1 FROM auth.users WHERE id = _user AND email_confirmed_at IS NOT NULL AND lower(email) = 'modernnovaai@gmail.com')
$$;
REVOKE ALL ON FUNCTION public.api_is_unlimited(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_is_unlimited(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.api_spend(_user uuid, _api uuid, _service text, _cost bigint, _request text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.api_wallets; tx uuid;
BEGIN
  INSERT INTO api_wallets(user_id) VALUES (_user) ON CONFLICT DO NOTHING;
  SELECT * INTO w FROM api_wallets WHERE user_id = _user FOR UPDATE;
  IF public.api_is_unlimited(_user) THEN
    INSERT INTO api_credit_transactions(user_id, api_id, kind, service, request_id, previous_balance, credits, new_balance, status)
      VALUES (_user, _api, 'usage', _service, _request, w.balance, 0, w.balance, 'pending') RETURNING id INTO tx;
    RETURN tx;
  END IF;
  IF w.balance < _cost THEN RAISE EXCEPTION 'INSUFFICIENT_API_CREDITS'; END IF;
  UPDATE api_wallets SET balance = balance - _cost, updated_at = now() WHERE user_id = _user;
  INSERT INTO api_credit_transactions(user_id, api_id, kind, service, request_id, previous_balance, credits, new_balance, status)
    VALUES (_user, _api, 'usage', _service, _request, w.balance, _cost, w.balance - _cost, 'pending') RETURNING id INTO tx;
  RETURN tx;
END $$;
REVOKE ALL ON FUNCTION public.api_spend(uuid,uuid,text,bigint,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_spend(uuid,uuid,text,bigint,text) TO service_role;