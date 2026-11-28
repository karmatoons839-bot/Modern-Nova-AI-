CREATE OR REPLACE FUNCTION public.s2v_finalize_render(_project uuid, _user uuid, _key text, _revision integer, _cost integer, _path text, _clips jsonb, _voices jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.s2v_projects; t public.s2v_tasks; gid uuid; current_cost integer; stored_size bigint;
BEGIN
 SELECT * INTO p FROM public.s2v_projects WHERE id=_project AND user_id=_user FOR UPDATE;
 IF p.id IS NULL OR p.studio_data IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF (p.studio_data->>'revision')::integer <> _revision THEN RAISE EXCEPTION 'PROJECT_CHANGED'; END IF;
 SELECT * INTO t FROM public.s2v_tasks WHERE project_id=_project AND operation_key=_key;
 IF t.id IS NOT NULL THEN
  IF t.kind <> 'render' OR t.status <> 'completed' THEN RAISE EXCEPTION 'RENDER_REQUIRES_REVIEW'; END IF;
  RETURN jsonb_build_object('id',t.id,'path',t.output_path,'reused',true);
 END IF;
 SELECT price_render INTO current_cost FROM public.s2v_settings WHERE id=1 AND enabled;
 IF current_cost IS NULL OR _cost <> current_cost THEN RAISE EXCEPTION 'PRICE_CHANGED'; END IF;
 IF _path NOT LIKE _user::text || '/s2v/' || _project::text || '/final-r' || _revision::text || '-%.mp4' THEN RAISE EXCEPTION 'INVALID_UPLOAD'; END IF;
 SELECT (metadata->>'size')::bigint INTO stored_size FROM storage.objects WHERE bucket_id='generations' AND name=_path;
 IF stored_size IS NULL OR stored_size < 1000 THEN RAISE EXCEPTION 'UPLOAD_MISSING_NO_CHARGE'; END IF;
 IF jsonb_typeof(_clips) <> 'array' OR jsonb_array_length(_clips) < 1 OR jsonb_array_length(_clips) <> jsonb_array_length(p.studio_data->'scenes') OR jsonb_typeof(_voices) <> 'array' OR jsonb_array_length(_voices) <> jsonb_array_length(_clips) THEN RAISE EXCEPTION 'INVALID_SCENES'; END IF;
 gid:=public.spend_credits(_user,'script_video',_cost,p.title,'render');
 INSERT INTO public.s2v_tasks(project_id,user_id,operation_key,kind,target,cost,input,generation_id,status,output_path)
 VALUES(_project,_user,_key,'render',0,_cost,jsonb_build_object('clips',_clips,'voices',_voices,'path',_path),gid,'completed',_path) RETURNING * INTO t;
 PERFORM public.finish_generation(gid,true,'');
 UPDATE public.generations SET output_path=_path WHERE id=gid;
 UPDATE public.s2v_projects SET final_video_path=_path,generation_id=gid,status='completed',stage='completed',updated_at=now() WHERE id=_project;
 RETURN jsonb_build_object('id',t.id,'path',_path,'reused',false);
END $$;
REVOKE ALL ON FUNCTION public.s2v_finalize_render(uuid,uuid,text,integer,integer,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.s2v_finalize_render(uuid,uuid,text,integer,integer,text,jsonb,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.s2v_reuse_frame(_project uuid, _user uuid, _key text, _revision integer, _target integer, _path text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.s2v_projects; tid uuid;
BEGIN
 SELECT * INTO p FROM public.s2v_projects WHERE id=_project AND user_id=_user FOR UPDATE;
 IF p.id IS NULL OR p.studio_data IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF (p.studio_data->>'revision')::integer <> _revision THEN RAISE EXCEPTION 'PROJECT_CHANGED'; END IF;
 IF _target < 0 OR _target >= jsonb_array_length(p.studio_data->'scenes') THEN RAISE EXCEPTION 'INVALID_SCENE'; END IF;
 IF _path NOT LIKE _user::text || '/%' OR _path LIKE '%..%' OR _path !~* '\.(jpg|jpeg|png|webp)$' OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='generations' AND name=_path AND metadata->>'mimetype' LIKE 'image/%') THEN RAISE EXCEPTION 'SAVED_IMAGE_UNAVAILABLE'; END IF;
 IF EXISTS (SELECT 1 FROM public.s2v_tasks WHERE project_id=_project AND status IN ('queued','running','remote','paused','review')) THEN RAISE EXCEPTION 'GENERATION_ACTIVE'; END IF;
 SELECT id INTO tid FROM public.s2v_tasks WHERE project_id=_project AND operation_key=_key;
 IF tid IS NOT NULL THEN RETURN tid; END IF;
 INSERT INTO public.s2v_tasks(project_id,user_id,operation_key,kind,target,cost,input,status,output_path)
 VALUES(_project,_user,_key,'frame',_target,0,jsonb_build_object('reused',true,'path',_path),'completed',_path) RETURNING id INTO tid;
 RETURN tid;
END $$;
REVOKE ALL ON FUNCTION public.s2v_reuse_frame(uuid,uuid,text,integer,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.s2v_reuse_frame(uuid,uuid,text,integer,integer,text) TO service_role;