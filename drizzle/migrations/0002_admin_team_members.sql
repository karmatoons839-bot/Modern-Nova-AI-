CREATE TABLE public.admin_members (
  user_id uuid PRIMARY KEY,
  email text,
  sections text[] NOT NULL DEFAULT '{}',
  can_edit boolean NOT NULL DEFAULT false,
  unlimited_credits boolean NOT NULL DEFAULT false,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_members TO authenticated;
GRANT ALL ON public.admin_members TO service_role;
ALTER TABLE public.admin_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read own row" ON public.admin_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.admin_can(_user uuid, _section text, _edit boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user, 'admin') OR EXISTS (
    SELECT 1 FROM public.admin_members m
    WHERE m.user_id = _user AND _section = ANY(m.sections) AND (NOT _edit OR m.can_edit)
  )
$$;

CREATE POLICY "Team reads notifications" ON public.admin_notifications FOR SELECT TO authenticated USING (public.admin_can(auth.uid(), 'notifications'));
CREATE POLICY "Team updates notifications" ON public.admin_notifications FOR UPDATE TO authenticated USING (public.admin_can(auth.uid(), 'notifications', true));
CREATE POLICY "Team deletes notifications" ON public.admin_notifications FOR DELETE TO authenticated USING (public.admin_can(auth.uid(), 'notifications', true));
CREATE POLICY "Team reads audit" ON public.admin_audit_log FOR SELECT TO authenticated USING (public.admin_can(auth.uid(), 'audit'));
CREATE POLICY "Team reads settings" ON public.admin_settings FOR SELECT TO authenticated USING (public.admin_can(auth.uid(), 'settings'));

CREATE OR REPLACE FUNCTION public.spend_credits(_user uuid, _tool text, _cost integer, _prompt text, _style text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bal integer; st text; gid uuid; adm boolean;
BEGIN
  adm := public.has_role(_user, 'admin') OR EXISTS (SELECT 1 FROM public.admin_members WHERE user_id = _user AND unlimited_credits);
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
END $$;