CREATE TABLE public.api_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  brand text NOT NULL,
  website_url text,
  description text,
  services text[] NOT NULL DEFAULT '{}',
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  rate_limit_per_min int NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.api_projects TO authenticated;
GRANT ALL ON public.api_projects TO service_role;
ALTER TABLE public.api_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own api projects" ON public.api_projects FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.api_wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance bigint NOT NULL DEFAULT 0 CHECK (balance >= 0),
  free_granted boolean NOT NULL DEFAULT false,
  free_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.api_wallets TO authenticated;
GRANT ALL ON public.api_wallets TO service_role;
ALTER TABLE public.api_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own api wallet" ON public.api_wallets FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.api_credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_id uuid,
  kind text NOT NULL CHECK (kind IN ('grant','usage','refund','purchase')),
  service text,
  request_id text,
  previous_balance bigint NOT NULL,
  credits bigint NOT NULL,
  new_balance bigint NOT NULL,
  status text NOT NULL DEFAULT 'success',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.api_credit_transactions (user_id, created_at DESC);
GRANT SELECT ON public.api_credit_transactions TO authenticated;
GRANT ALL ON public.api_credit_transactions TO service_role;
ALTER TABLE public.api_credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own api tx" ON public.api_credit_transactions FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.api_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service text NOT NULL,
  status_code int NOT NULL,
  credits_used int NOT NULL DEFAULT 0,
  duration_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.api_requests (api_id, created_at DESC);
CREATE INDEX ON public.api_requests (user_id, created_at DESC);
GRANT SELECT ON public.api_requests TO authenticated;
GRANT ALL ON public.api_requests TO service_role;
ALTER TABLE public.api_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own api requests" ON public.api_requests FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.api_credit_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  credits bigint NOT NULL,
  price_inr int,
  description text NOT NULL,
  is_custom boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.api_credit_packages TO anon, authenticated;
GRANT ALL ON public.api_credit_packages TO service_role;
ALTER TABLE public.api_credit_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "packages readable" ON public.api_credit_packages FOR SELECT TO anon, authenticated USING (active);
INSERT INTO public.api_credit_packages (name, credits, price_inr, description, is_custom, sort) VALUES
 ('5,000 API Credits', 5000, 99, 'For small projects', false, 1),
 ('25,000 API Credits', 25000, 399, 'For growing websites', false, 2),
 ('100,000 API Credits', 100000, 1299, 'For high-volume applications', false, 3),
 ('Custom', 0, NULL, 'For large businesses', true, 4);

CREATE TABLE public.api_credit_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.api_credit_packages(id),
  credits bigint NOT NULL,
  amount_inr int NOT NULL,
  utr text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted','paid','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
GRANT SELECT ON public.api_credit_orders TO authenticated;
GRANT ALL ON public.api_credit_orders TO service_role;
ALTER TABLE public.api_credit_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own api orders" ON public.api_credit_orders FOR SELECT TO authenticated USING (user_id = auth.uid());

-- One-time free grant per user (never repeats, even if APIs are deleted and re-created)
CREATE OR REPLACE FUNCTION public.api_grant_free(_user uuid, _amount bigint)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.api_wallets;
BEGIN
  INSERT INTO api_wallets(user_id) VALUES (_user) ON CONFLICT DO NOTHING;
  SELECT * INTO w FROM api_wallets WHERE user_id = _user FOR UPDATE;
  IF w.free_granted THEN RETURN w.balance; END IF;
  UPDATE api_wallets SET balance = balance + _amount, free_granted = true, updated_at = now() WHERE user_id = _user;
  INSERT INTO api_credit_transactions(user_id, kind, previous_balance, credits, new_balance)
    VALUES (_user, 'grant', w.balance, _amount, w.balance + _amount);
  RETURN w.balance + _amount;
END $$;

CREATE OR REPLACE FUNCTION public.api_spend(_user uuid, _api uuid, _service text, _cost bigint, _request text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.api_wallets; tx uuid;
BEGIN
  SELECT * INTO w FROM api_wallets WHERE user_id = _user FOR UPDATE;
  IF w IS NULL OR w.balance < _cost THEN RAISE EXCEPTION 'INSUFFICIENT_API_CREDITS'; END IF;
  UPDATE api_wallets SET balance = balance - _cost, updated_at = now() WHERE user_id = _user;
  INSERT INTO api_credit_transactions(user_id, api_id, kind, service, request_id, previous_balance, credits, new_balance, status)
    VALUES (_user, _api, 'usage', _service, _request, w.balance, _cost, w.balance - _cost, 'pending') RETURNING id INTO tx;
  RETURN tx;
END $$;

CREATE OR REPLACE FUNCTION public.api_finish(_tx uuid, _ok boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.api_credit_transactions; w public.api_wallets;
BEGIN
  SELECT * INTO t FROM api_credit_transactions WHERE id = _tx AND status = 'pending' FOR UPDATE;
  IF t IS NULL THEN RETURN; END IF;
  IF _ok THEN UPDATE api_credit_transactions SET status = 'success' WHERE id = _tx; RETURN; END IF;
  UPDATE api_credit_transactions SET status = 'refunded' WHERE id = _tx;
  SELECT * INTO w FROM api_wallets WHERE user_id = t.user_id FOR UPDATE;
  UPDATE api_wallets SET balance = balance + t.credits, updated_at = now() WHERE user_id = t.user_id;
  INSERT INTO api_credit_transactions(user_id, api_id, kind, service, request_id, previous_balance, credits, new_balance)
    VALUES (t.user_id, t.api_id, 'refund', t.service, t.request_id, w.balance, t.credits, w.balance + t.credits);
END $$;

-- Credits are added only here, only once, only by an admin after payment is confirmed.
CREATE OR REPLACE FUNCTION public.api_approve_order(_order uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.api_credit_orders; w public.api_wallets;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO o FROM api_credit_orders WHERE id = _order FOR UPDATE;
  IF o IS NULL OR o.status <> 'submitted' THEN RAISE EXCEPTION 'ORDER_NOT_PAYABLE'; END IF;
  INSERT INTO api_wallets(user_id) VALUES (o.user_id) ON CONFLICT DO NOTHING;
  SELECT * INTO w FROM api_wallets WHERE user_id = o.user_id FOR UPDATE;
  UPDATE api_wallets SET balance = balance + o.credits, updated_at = now() WHERE user_id = o.user_id;
  UPDATE api_credit_orders SET status = 'paid', decided_at = now() WHERE id = _order;
  INSERT INTO api_credit_transactions(user_id, kind, request_id, previous_balance, credits, new_balance)
    VALUES (o.user_id, 'purchase', o.id::text, w.balance, o.credits, w.balance + o.credits);
END $$;

REVOKE ALL ON FUNCTION public.api_grant_free(uuid,bigint), public.api_spend(uuid,uuid,text,bigint,text), public.api_finish(uuid,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_grant_free(uuid,bigint), public.api_spend(uuid,uuid,text,bigint,text), public.api_finish(uuid,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.api_approve_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.api_approve_order(uuid) TO authenticated;