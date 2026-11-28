CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  display_name text,
  email text,
  language text CHECK (language IN ('en','hinglish','hi')),
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro','premium')),
  credits integer NOT NULL DEFAULT 500 CHECK (credits >= 0),
  plan_renews_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (display_name, language) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  reason text NOT NULL,
  generation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.credit_ledger (user_id, created_at DESC);
GRANT SELECT ON public.credit_ledger TO authenticated;
GRANT ALL ON public.credit_ledger TO service_role;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own ledger read" ON public.credit_ledger FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tool text NOT NULL CHECK (tool IN ('voice','image','thumbnail')),
  prompt text,
  style text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','failed')),
  cost integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX ON public.generations (user_id, created_at DESC);
GRANT SELECT ON public.generations TO authenticated;
GRANT ALL ON public.generations TO service_role;
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own generations read" ON public.generations FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan text NOT NULL CHECK (plan IN ('pro','premium')),
  amount_paise integer NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  provider_order_id text UNIQUE,
  provider_payment_id text UNIQUE,
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created','paid','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz
);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own payments read" ON public.payments FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Creates the caller's profile on first sign-in (free plan, 500 credits).
CREATE OR REPLACE FUNCTION public.ensure_profile(_name text, _email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.profiles (id, display_name, email) VALUES (auth.uid(), left(_name, 80), left(_email, 200))
  ON CONFLICT (id) DO NOTHING;
  IF FOUND THEN
    INSERT INTO public.credit_ledger (user_id, amount, reason) VALUES (auth.uid(), 500, 'Free plan welcome credits');
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.ensure_profile(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_profile(text, text) TO authenticated;

-- Server-only: atomically check and deduct credits, create a pending generation.
CREATE OR REPLACE FUNCTION public.spend_credits(_user uuid, _tool text, _cost integer, _prompt text, _style text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bal integer; gid uuid;
BEGIN
  SELECT credits INTO bal FROM public.profiles WHERE id = _user FOR UPDATE;
  IF bal IS NULL THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;
  IF bal < _cost THEN RAISE EXCEPTION 'INSUFFICIENT_CREDITS'; END IF;
  UPDATE public.profiles SET credits = credits - _cost, updated_at = now() WHERE id = _user;
  INSERT INTO public.generations (user_id, tool, prompt, style, cost) VALUES (_user, _tool, left(_prompt, 2000), _style, _cost) RETURNING id INTO gid;
  INSERT INTO public.credit_ledger (user_id, amount, reason, generation_id) VALUES (_user, -_cost, initcap(_tool) || ' generation', gid);
  RETURN gid;
END $$;

CREATE OR REPLACE FUNCTION public.finish_generation(_gid uuid, _ok boolean, _error text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.generations;
BEGIN
  SELECT * INTO g FROM public.generations WHERE id = _gid AND status = 'pending' FOR UPDATE;
  IF g.id IS NULL THEN RETURN; END IF;
  IF _ok THEN
    UPDATE public.generations SET status = 'done', completed_at = now() WHERE id = _gid;
  ELSE
    UPDATE public.generations SET status = 'failed', error = left(_error, 500), completed_at = now() WHERE id = _gid;
    UPDATE public.profiles SET credits = credits + g.cost, updated_at = now() WHERE id = g.user_id;
    INSERT INTO public.credit_ledger (user_id, amount, reason, generation_id) VALUES (g.user_id, g.cost, 'Refund: generation failed', _gid);
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.spend_credits(uuid, text, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_generation(uuid, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spend_credits(uuid, text, integer, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_generation(uuid, boolean, text) TO service_role;