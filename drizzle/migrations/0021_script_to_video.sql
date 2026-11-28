ALTER TABLE public.generations DROP CONSTRAINT generations_tool_check;
ALTER TABLE public.generations ADD CONSTRAINT generations_tool_check CHECK (tool = ANY (ARRAY['voice','voice_full','image','thumbnail','story','music','video','script_video']));

CREATE TABLE public.s2v_characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('male','female','child','old')),
  description text NOT NULL DEFAULT '',
  image_path text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.s2v_characters TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.s2v_characters TO authenticated;
GRANT ALL ON public.s2v_characters TO service_role;
ALTER TABLE public.s2v_characters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone sees enabled characters" ON public.s2v_characters FOR SELECT TO anon, authenticated USING (enabled OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin manages characters" ON public.s2v_characters FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.s2v_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT true,
  credits_per_second int NOT NULL DEFAULT 1000 CHECK (credits_per_second >= 0),
  max_script_chars int NOT NULL DEFAULT 100000 CHECK (max_script_chars BETWEEN 100 AND 200000),
  max_scenes int NOT NULL DEFAULT 6 CHECK (max_scenes BETWEEN 1 AND 6),
  allow_vertical boolean NOT NULL DEFAULT true,
  allow_landscape boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.s2v_settings TO anon, authenticated;
GRANT UPDATE ON public.s2v_settings TO authenticated;
GRANT ALL ON public.s2v_settings TO service_role;
ALTER TABLE public.s2v_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads s2v settings" ON public.s2v_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin updates s2v settings" ON public.s2v_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.s2v_settings (id) VALUES (1);

CREATE TABLE public.s2v_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT '',
  script text NOT NULL,
  aspect_ratio text NOT NULL CHECK (aspect_ratio IN ('16:9','9:16')),
  character_id uuid,
  character_name text NOT NULL DEFAULT '',
  character_image_path text NOT NULL DEFAULT '',
  background_path text NOT NULL,
  background_summary text NOT NULL DEFAULT '',
  plan jsonb,
  status text NOT NULL DEFAULT 'analyzing',
  stage text NOT NULL DEFAULT 'understanding',
  scene_count int NOT NULL DEFAULT 0,
  total_seconds int NOT NULL DEFAULT 0,
  credits_charged int NOT NULL DEFAULT 0,
  generation_id uuid,
  final_video_path text,
  thumbnail_path text,
  error_message text,
  request_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, request_key)
);
CREATE INDEX s2v_projects_user_idx ON public.s2v_projects (user_id, created_at DESC);
GRANT SELECT ON public.s2v_projects TO authenticated;
GRANT ALL ON public.s2v_projects TO service_role;
ALTER TABLE public.s2v_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner or admin reads projects" ON public.s2v_projects FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.s2v_scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.s2v_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  idx int NOT NULL,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_seconds int NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  keyframe_path text,
  provider_job_id text,
  video_path text,
  attempts int NOT NULL DEFAULT 0,
  error_message text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, idx)
);
GRANT SELECT ON public.s2v_scenes TO authenticated;
GRANT ALL ON public.s2v_scenes TO service_role;
ALTER TABLE public.s2v_scenes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner or admin reads scenes" ON public.s2v_scenes FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public reads s2v character images" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 's2v-characters');
CREATE POLICY "Admin writes s2v character images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 's2v-characters' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin updates s2v character images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 's2v-characters' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin deletes s2v character images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 's2v-characters' AND public.has_role(auth.uid(), 'admin'));

INSERT INTO public.s2v_characters (name, category, description, image_path, sort_order) VALUES
('Male Character 01','male','Indian man, 28, short black hair, light stubble, white kurta, blue jeans, brown sandals','seed/male-01.jpg',1),
('Male Character 02','male','Indian man, 35, combed black hair, thick mustache, maroon checked shirt, grey trousers, black shoes, wristwatch','seed/male-02.jpg',2),
('Male Character 03','male','Indian village farmer, 40, orange turban, mustache, beige vest, white dhoti, muscular, dark skin','seed/male-03.jpg',3),
('Male Character 04','male','Young Indian man, 22, spiky brown-tinted hair, black hoodie, olive cargo pants, white sneakers','seed/male-04.jpg',4),
('Male Character 05','male','Indian businessman, 45, grey temples, glasses, navy suit, white shirt, red tie','seed/male-05.jpg',5),
('Female Character 01','female','Indian woman, 25, long black braid, red and gold saree, bindi, bangles','seed/female-01.jpg',6),
('Female Character 02','female','Indian college girl, 20, shoulder-length wavy hair, yellow kurti, blue jeans, tote bag','seed/female-02.jpg',7),
('Female Character 03','female','Indian village woman, 32, green cotton saree with dupatta over head, anklets, barefoot','seed/female-03.jpg',8),
('Female Character 04','female','Indian teacher, 38, glasses, low ponytail, purple salwar kameez, holding a book','seed/female-04.jpg',9),
('Female Character 05','female','Indian professional woman, 28, black bob haircut, white blouse, black blazer and trousers','seed/female-05.jpg',10),
('Child Character 01','child','Indian boy, 8, messy black hair, white school shirt, navy shorts, red backpack','seed/child-01.jpg',11),
('Child Character 02','child','Indian girl, 7, pigtails with red ribbons, pink floral frock, white sandals','seed/child-02.jpg',12),
('Child Character 03','child','Indian village boy, 10, short hair, orange t-shirt, brown shorts, barefoot, slingshot','seed/child-03.jpg',13),
('Child Character 04','child','Indian girl, 11, long single braid, teal school pinafore over white shirt','seed/child-04.jpg',14),
('Child Character 05','child','Indian boy, 5, curly hair, green striped t-shirt, blue shorts','seed/child-05.jpg',15),
('Old Character 01','old','Indian grandfather, 75, white hair and beard, round glasses, white kurta pyjama, brown shawl, walking stick','seed/old-01.jpg',16),
('Old Character 02','old','Indian grandmother, 70, grey hair bun, glasses, white saree with blue border','seed/old-02.jpg',17),
('Old Character 03','old','Elderly Indian sadhu, 80, long grey matted hair and beard, saffron robes, rudraksha beads, tilak','seed/old-03.jpg',18),
('Old Character 04','old','Elderly Indian village man, 68, grey mustache, black cap, beige kurta, white dhoti','seed/old-04.jpg',19),
('Old Character 05','old','Elderly Indian village woman, 72, white hair, dark green saree over head, nose ring','seed/old-05.jpg',20);