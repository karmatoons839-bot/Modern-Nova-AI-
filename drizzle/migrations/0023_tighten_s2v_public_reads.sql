DROP POLICY IF EXISTS "Public reads s2v character images" ON storage.objects;
CREATE POLICY "Signed-in users read enabled character images" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 's2v-characters' AND (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.s2v_characters c WHERE c.image_path = storage.objects.name AND c.enabled)
));
DROP POLICY IF EXISTS "Anyone reads s2v settings" ON public.s2v_settings;
CREATE POLICY "Anyone reads the single s2v settings row" ON public.s2v_settings FOR SELECT TO anon, authenticated USING (id = 1);