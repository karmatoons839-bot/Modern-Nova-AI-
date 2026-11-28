CREATE TABLE public.site_content (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_content TO anon, authenticated;
GRANT ALL ON public.site_content TO service_role;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Site content public read" ON public.site_content FOR SELECT TO anon, authenticated USING (true);