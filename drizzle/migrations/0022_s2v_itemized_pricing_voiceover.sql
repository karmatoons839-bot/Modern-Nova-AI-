ALTER TABLE public.s2v_settings
  ADD COLUMN price_scene_image int NOT NULL DEFAULT 300 CHECK (price_scene_image >= 0),
  ADD COLUMN price_anim_5 int NOT NULL DEFAULT 1000 CHECK (price_anim_5 >= 0),
  ADD COLUMN price_anim_10 int NOT NULL DEFAULT 2000 CHECK (price_anim_10 >= 0),
  ADD COLUMN price_render int NOT NULL DEFAULT 100 CHECK (price_render >= 0);
ALTER TABLE public.s2v_settings DROP CONSTRAINT IF EXISTS s2v_settings_max_scenes_check;
ALTER TABLE public.s2v_settings ADD CONSTRAINT s2v_settings_max_scenes_range CHECK (max_scenes BETWEEN 1 AND 240);
COMMENT ON COLUMN public.s2v_settings.credits_per_second IS 'DEPRECATED: replaced by itemized price_* columns';
ALTER TABLE public.s2v_projects ADD COLUMN clip_seconds int NOT NULL DEFAULT 5 CHECK (clip_seconds IN (5, 10));
ALTER TABLE public.s2v_scenes ADD COLUMN audio_path text;