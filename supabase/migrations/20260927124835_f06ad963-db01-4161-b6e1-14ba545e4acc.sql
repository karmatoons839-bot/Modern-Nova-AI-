ALTER TABLE public.generations ADD COLUMN output_path text;
CREATE POLICY "Own generation files read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'generations' AND (storage.foldername(name))[1] = auth.uid()::text);