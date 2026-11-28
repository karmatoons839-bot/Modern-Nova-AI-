CREATE TABLE public.site_maintenance (id boolean PRIMARY KEY DEFAULT true CHECK (id = true), enabled boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid);
GRANT SELECT ON public.site_maintenance TO anon, authenticated;
GRANT ALL ON public.site_maintenance TO service_role;
ALTER TABLE public.site_maintenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public maintenance status" ON public.site_maintenance FOR SELECT TO anon, authenticated USING (true);
CREATE OR REPLACE FUNCTION public.set_site_maintenance(_enabled boolean) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF; INSERT INTO public.site_maintenance(id,enabled,updated_by) VALUES(true,_enabled,auth.uid()) ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled,updated_by=excluded.updated_by,updated_at=now(); INSERT INTO public.admin_audit_log(admin_id,action,details) VALUES(auth.uid(),'site_maintenance_changed',jsonb_build_object('enabled',_enabled)); RETURN _enabled; END; $$;
REVOKE ALL ON FUNCTION public.set_site_maintenance(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_site_maintenance(boolean) TO authenticated;