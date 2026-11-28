DROP FUNCTION public.ensure_profile(text, text);
CREATE OR REPLACE FUNCTION public.ensure_profile(_user uuid, _name text, _email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email) VALUES (_user, left(_name, 80), left(_email, 200))
  ON CONFLICT (id) DO NOTHING;
  IF FOUND THEN
    INSERT INTO public.credit_ledger (user_id, amount, reason) VALUES (_user, 500, 'Free plan welcome credits');
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.ensure_profile(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_profile(uuid, text, text) TO service_role;