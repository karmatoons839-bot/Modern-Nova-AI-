ALTER TABLE public.profiles DROP CONSTRAINT profiles_plan_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_plan_check CHECK (plan = ANY (ARRAY['free','creator','pro','premium']));
ALTER TABLE public.payments DROP CONSTRAINT payments_plan_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_plan_check CHECK (plan = ANY (ARRAY['creator','pro','premium']));
ALTER TABLE public.profiles ALTER COLUMN credits SET DEFAULT 1000;
CREATE OR REPLACE FUNCTION public.ensure_profile(_user uuid, _name text, _email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE real_email text;
BEGIN
  INSERT INTO public.profiles (id, display_name, email, credits) VALUES (_user, left(_name, 80), left(_email, 200), 1000)
  ON CONFLICT (id) DO NOTHING;
  IF FOUND THEN
    INSERT INTO public.credit_ledger (user_id, amount, reason) VALUES (_user, 1000, 'Free plan welcome credits');
    PERFORM public.admin_notify('user', '[Modern Nova AI] New User Registered',
      'A new user has registered: ' || left(_name,80) || ' (' || left(_email,200) || '). Plan: Free. Credits: 1000.',
      'medium', _user, NULL, jsonb_build_object('name', _name, 'email', _email, 'plan', 'free', 'credits', 1000));
  END IF;
  SELECT email INTO real_email FROM auth.users WHERE id = _user AND email_confirmed_at IS NOT NULL;
  IF lower(real_email) = 'novaforgeai5@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user, 'admin') ON CONFLICT DO NOTHING;
    UPDATE public.profiles SET plan = 'premium' WHERE id = _user;
  END IF;
END $$;