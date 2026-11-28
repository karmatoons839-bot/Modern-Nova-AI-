ALTER TABLE public.s2v_projects ADD COLUMN studio_data jsonb;
ALTER TABLE public.s2v_settings ADD COLUMN studio_image_price integer NOT NULL DEFAULT 500 CHECK (studio_image_price >= 0), ADD COLUMN studio_character_price integer NOT NULL DEFAULT 300 CHECK (studio_character_price >= 0), ADD COLUMN studio_voice_per_minute integer NOT NULL DEFAULT 500 CHECK (studio_voice_per_minute >= 0);
CREATE TABLE public.s2v_tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES public.s2v_projects(id) ON DELETE CASCADE, user_id uuid NOT NULL,
 operation_key text NOT NULL, kind text NOT NULL CHECK (kind IN ('background','character','frame','voice','animation','render','story')), target integer NOT NULL DEFAULT 0,
 status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','remote','completed','failed','paused','review')),
 input jsonb NOT NULL DEFAULT '{}'::jsonb, output_path text, provider_job_id text, error_message text, cost integer NOT NULL CHECK (cost >= 0), generation_id uuid,
 lease_until timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(project_id,operation_key)
);
GRANT SELECT ON public.s2v_tasks TO authenticated;
GRANT ALL ON public.s2v_tasks TO service_role;
ALTER TABLE public.s2v_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Studio task owner admin reads" ON public.s2v_tasks FOR SELECT TO authenticated USING (user_id=auth.uid() AND public.has_role(auth.uid(),'admin'));
CREATE INDEX s2v_tasks_work_idx ON public.s2v_tasks(status,updated_at);
CREATE OR REPLACE FUNCTION public.s2v_queue_task(_project uuid,_user uuid,_key text,_kind text,_target integer,_cost integer,_input jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.s2v_projects; t public.s2v_tasks; gid uuid;
BEGIN
 SELECT * INTO p FROM public.s2v_projects WHERE id=_project AND user_id=_user FOR UPDATE;
 IF p.id IS NULL OR p.studio_data IS NULL OR NOT public.has_role(_user,'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO t FROM public.s2v_tasks WHERE project_id=_project AND operation_key=_key;
 IF t.id IS NOT NULL THEN RETURN t.id; END IF;
 IF _cost < 0 THEN RAISE EXCEPTION 'INVALID_COST'; END IF;
 gid:=public.spend_credits(_user,'script_video',_cost,p.title,_kind);
 INSERT INTO public.s2v_tasks(project_id,user_id,operation_key,kind,target,cost,input,generation_id) VALUES(_project,_user,_key,_kind,_target,_cost,_input,gid) RETURNING id INTO gid;
 RETURN gid;
END $$;
REVOKE ALL ON FUNCTION public.s2v_queue_task(uuid,uuid,text,text,integer,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.s2v_queue_task(uuid,uuid,text,text,integer,integer,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.s2v_claim_task(_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.s2v_tasks SET status='review',error_message='Processing interrupted; review provider outcome before retrying.',updated_at=now() WHERE id=_id AND status='running' AND lease_until<now();
 UPDATE public.s2v_tasks SET status='running',lease_until=now()+interval '8 minutes',updated_at=now() WHERE id=_id AND status='queued';
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.s2v_claim_task(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.s2v_claim_task(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.s2v_settle_task(_id uuid,_ok boolean,_path text,_error text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.s2v_tasks;
BEGIN
 SELECT * INTO t FROM public.s2v_tasks WHERE id=_id FOR UPDATE;
 IF t.id IS NULL OR t.status IN ('completed','failed') THEN RETURN; END IF;
 PERFORM public.finish_generation(t.generation_id,_ok,_error);
 UPDATE public.s2v_tasks SET status=CASE WHEN _ok THEN 'completed' ELSE 'failed' END,output_path=_path,error_message=CASE WHEN _ok THEN NULL ELSE left(_error,500) END,lease_until=NULL,updated_at=now() WHERE id=_id;
END $$;
REVOKE ALL ON FUNCTION public.s2v_settle_task(uuid,boolean,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.s2v_settle_task(uuid,boolean,text,text) TO service_role;