ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS notify_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_generation boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_payment boolean NOT NULL DEFAULT true;
GRANT UPDATE (avatar_url, notify_email, notify_generation, notify_payment) ON public.profiles TO authenticated;

CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);