ALTER TABLE public.profiles ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended'));

CREATE TABLE public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('user','security','payment','subscription','credits','generation','api','system','support')),
  title text NOT NULL,
  message text NOT NULL,
  priority text NOT NULL DEFAULT 'low' CHECK (priority IN ('high','medium','low')),
  user_id uuid,
  transaction_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  group_key text,
  occurrences integer NOT NULL DEFAULT 1,
  is_read boolean NOT NULL DEFAULT false,
  email_sent boolean NOT NULL DEFAULT false,
  email_attempts integer NOT NULL DEFAULT 0,
  email_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.admin_notifications (created_at DESC);
CREATE INDEX ON public.admin_notifications (group_key, created_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.admin_notifications TO authenticated;
GRANT ALL ON public.admin_notifications TO service_role;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read notifications" ON public.admin_notifications FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update notifications" ON public.admin_notifications FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete notifications" ON public.admin_notifications FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.admin_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  admin_email text NOT NULL DEFAULT 'novaforgeai5@gmail.com',
  email_enabled boolean NOT NULL DEFAULT true,
  security_alerts boolean NOT NULL DEFAULT true,
  user_notifications boolean NOT NULL DEFAULT true,
  payment_notifications boolean NOT NULL DEFAULT true,
  subscription_notifications boolean NOT NULL DEFAULT true,
  api_notifications boolean NOT NULL DEFAULT true,
  support_notifications boolean NOT NULL DEFAULT true,
  system_notifications boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.admin_settings DEFAULT VALUES;
GRANT SELECT ON public.admin_settings TO authenticated;
GRANT ALL ON public.admin_settings TO service_role;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read settings" ON public.admin_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  admin_email text,
  action text NOT NULL,
  target_user uuid,
  reason text,
  related_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit" ON public.admin_audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read support" ON public.support_messages FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  user_id uuid,
  success boolean NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.login_events (email, created_at DESC);
GRANT SELECT ON public.login_events TO authenticated;
GRANT ALL ON public.login_events TO service_role;
ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read logins" ON public.login_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Central notifier. Repeated events with the same group_key inside 5 minutes are merged;
-- at 10+ merges the alert becomes a single "High Error Rate" notification.
CREATE OR REPLACE FUNCTION public.admin_notify(_type text, _title text, _message text, _priority text,
  _user uuid DEFAULT NULL, _txn text DEFAULT NULL, _meta jsonb DEFAULT '{}'::jsonb, _group text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE existing public.admin_notifications; nid uuid;
BEGIN
  IF _group IS NOT NULL THEN
    SELECT * INTO existing FROM public.admin_notifications
      WHERE group_key = _group AND created_at > now() - interval '5 minutes'
      ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
    IF existing.id IS NOT NULL THEN
      UPDATE public.admin_notifications SET
        occurrences = occurrences + 1,
        updated_at = now(),
        is_read = false,
        priority = CASE WHEN occurrences + 1 >= 10 THEN 'high' ELSE priority END,
        title = CASE WHEN occurrences + 1 >= 10 THEN '[Modern Nova AI] High Error Rate Detected' ELSE title END,
        message = CASE WHEN occurrences + 1 >= 10
          THEN (occurrences + 1) || ' errors detected in the last 5 minutes. Latest: ' || left(_message, 400)
          ELSE message END,
        email_sent = CASE WHEN occurrences + 1 = 10 THEN false ELSE email_sent END,
        email_attempts = CASE WHEN occurrences + 1 = 10 THEN 0 ELSE email_attempts END
      WHERE id = existing.id;
      RETURN existing.id;
    END IF;
  END IF;
  INSERT INTO public.admin_notifications (type, title, message, priority, user_id, transaction_id, metadata, group_key)
  VALUES (_type, left(_title, 200), left(_message, 2000), _priority, _user, _txn, COALESCE(_meta, '{}'::jsonb), _group)
  RETURNING id INTO nid;
  RETURN nid;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_notify(text,text,text,text,uuid,text,jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_notify(text,text,text,text,uuid,text,jsonb,text) TO service_role;

-- New user → notification
CREATE OR REPLACE FUNCTION public.ensure_profile(_user uuid, _name text, _email text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE real_email text;
BEGIN
  INSERT INTO public.profiles (id, display_name, email) VALUES (_user, left(_name, 80), left(_email, 200))
  ON CONFLICT (id) DO NOTHING;
  IF FOUND THEN
    INSERT INTO public.credit_ledger (user_id, amount, reason) VALUES (_user, 500, 'Free plan welcome credits');
    PERFORM public.admin_notify('user', '[Modern Nova AI] New User Registered',
      'A new user has registered: ' || left(_name,80) || ' (' || left(_email,200) || '). Plan: Free. Credits: 500.',
      'medium', _user, NULL, jsonb_build_object('name', _name, 'email', _email, 'plan', 'free', 'credits', 500));
  END IF;
  SELECT email INTO real_email FROM auth.users WHERE id = _user AND email_confirmed_at IS NOT NULL;
  IF lower(real_email) = 'novaforgeai5@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user, 'admin') ON CONFLICT DO NOTHING;
    UPDATE public.profiles SET plan = 'premium' WHERE id = _user;
  END IF;
END $function$;

-- Suspended users cannot spend
CREATE OR REPLACE FUNCTION public.spend_credits(_user uuid, _tool text, _cost integer, _prompt text, _style text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE bal integer; st text; gid uuid; adm boolean;
BEGIN
  adm := public.has_role(_user, 'admin');
  SELECT credits, status INTO bal, st FROM public.profiles WHERE id = _user FOR UPDATE;
  IF bal IS NULL THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;
  IF st = 'suspended' THEN RAISE EXCEPTION 'ACCOUNT_SUSPENDED'; END IF;
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

-- Failed generation → grouped alert per tool
CREATE OR REPLACE FUNCTION public.finish_generation(_gid uuid, _ok boolean, _error text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE g public.generations; em text;
BEGIN
  SELECT * INTO g FROM public.generations WHERE id = _gid AND status = 'pending' FOR UPDATE;
  IF g.id IS NULL THEN RETURN; END IF;
  IF _ok THEN
    UPDATE public.generations SET status = 'done', completed_at = now() WHERE id = _gid;
  ELSE
    UPDATE public.generations SET status = 'failed', error = left(_error, 500), completed_at = now() WHERE id = _gid;
    IF g.cost > 0 THEN
      UPDATE public.profiles SET credits = credits + g.cost, updated_at = now() WHERE id = g.user_id;
      INSERT INTO public.credit_ledger (user_id, amount, reason, generation_id) VALUES (g.user_id, g.cost, 'Refund: generation failed', _gid);
    END IF;
    SELECT email INTO em FROM public.profiles WHERE id = g.user_id;
    PERFORM public.admin_notify(
      CASE WHEN _error ~* '(401|403|auth|api key|not configured)' THEN 'api' ELSE 'generation' END,
      '[Modern Nova AI] AI Generation Failed — ' || initcap(g.tool),
      'User ' || COALESCE(em,'?') || ': ' || left(COALESCE(_error,'unknown error'), 400),
      CASE WHEN _error ~* '(401|403|auth|api key|not configured)' THEN 'high' ELSE 'medium' END,
      g.user_id, _gid::text, jsonb_build_object('tool', g.tool, 'error', left(_error, 400)),
      'gen-fail-' || g.tool);
  END IF;
END $function$;