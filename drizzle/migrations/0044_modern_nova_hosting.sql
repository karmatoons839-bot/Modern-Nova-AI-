CREATE TABLE public.hosting_resources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 kind text NOT NULL CHECK (kind IN ('website','domain','database','backup','server','ftp','cron','deployment','security')),
 provider_id text,
 website_id uuid REFERENCES public.hosting_resources(id),
 name text NOT NULL,
 status text NOT NULL DEFAULT 'not_connected',
 details jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(kind,provider_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hosting_resources TO authenticated;
GRANT ALL ON public.hosting_resources TO service_role;
ALTER TABLE public.hosting_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY hosting_resources_owner ON public.hosting_resources FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TABLE public.hosting_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL,
 price numeric(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
 billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly','yearly')),
 limits jsonb NOT NULL DEFAULT '{}'::jsonb,
 ssl_enabled boolean NOT NULL DEFAULT true,
 backups_enabled boolean NOT NULL DEFAULT true,
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hosting_plans TO authenticated;
GRANT ALL ON public.hosting_plans TO service_role;
ALTER TABLE public.hosting_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY hosting_plans_owner ON public.hosting_plans FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TABLE public.hosting_operations (
 id uuid PRIMARY KEY,
 admin_id uuid NOT NULL,
 action text NOT NULL,
 resource_id uuid REFERENCES public.hosting_resources(id),
 status text NOT NULL CHECK (status IN ('pending','completed','failed','review_required')),
 message text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.hosting_operations TO authenticated;
GRANT ALL ON public.hosting_operations TO service_role;
ALTER TABLE public.hosting_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY hosting_operations_owner ON public.hosting_operations FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX hosting_resource_kind ON public.hosting_resources(kind);
CREATE INDEX hosting_operation_created ON public.hosting_operations(created_at DESC);