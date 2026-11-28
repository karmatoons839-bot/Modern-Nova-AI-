CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own roles read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.ensure_profile(_user uuid, _name text, _email text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE real_email text;
BEGIN
  INSERT INTO public.profiles (id, display_name, email) VALUES (_user, left(_name, 80), left(_email, 200))
  ON CONFLICT (id) DO NOTHING;
  IF FOUND THEN
    INSERT INTO public.credit_ledger (user_id, amount, reason) VALUES (_user, 500, 'Free plan welcome credits');
  END IF;
  SELECT email INTO real_email FROM auth.users WHERE id = _user AND email_confirmed_at IS NOT NULL;
  IF lower(real_email) = 'novaforgeai5@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user, 'admin') ON CONFLICT DO NOTHING;
    UPDATE public.profiles SET plan = 'premium' WHERE id = _user;
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.spend_credits(_user uuid, _tool text, _cost integer, _prompt text, _style text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE bal integer; gid uuid; adm boolean;
BEGIN
  adm := public.has_role(_user, 'admin');
  SELECT credits INTO bal FROM public.profiles WHERE id = _user FOR UPDATE;
  IF bal IS NULL THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;
  IF adm THEN
    INSERT INTO public.generations (user_id, tool, prompt, style, cost) VALUES (_user, _tool, left(_prompt, 2000), _style, 0) RETURNING id INTO gid;
    RETURN gid;
  END IF;
  IF bal < _cost THEN RAISE EXCEPTION 'INSUFFICIENT_CREDITS'; END IF;
  UPDATE public.profiles SET credits = credits - _cost, updated_at = now() WHERE id = _user;
  INSERT INTO public.generations (user_id, tool, prompt, style, cost) VALUES (_user, _tool, left(_prompt, 2000), _style, _cost) RETURNING id INTO gid;
  INSERT INTO public.credit_ledger (user_id, amount, reason, generation_id) VALUES (_user, -_cost, initcap(_tool) || ' generation', gid);
  RETURN gid;
END $function$;
REVOKE EXECUTE ON FUNCTION public.spend_credits(uuid, text, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_profile(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spend_credits(uuid, text, integer, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_profile(uuid, text, text) TO service_role;