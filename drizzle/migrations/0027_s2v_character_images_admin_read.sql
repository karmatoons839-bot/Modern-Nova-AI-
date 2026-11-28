DROP POLICY IF EXISTS "Signed-in users read enabled character images" ON storage.objects;
CREATE POLICY "Admins read s2v character images" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 's2v-characters' AND public.has_role(auth.uid(), 'admin'::public.app_role));