CREATE OR REPLACE FUNCTION public.s2v_queue_task(_project uuid, _user uuid, _key text, _kind text, _target integer, _cost integer, _input jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE p public.s2v_projects; t public.s2v_tasks; gid uuid;
BEGIN
 SELECT * INTO p FROM public.s2v_projects WHERE id=_project AND user_id=_user FOR UPDATE;
 IF p.id IS NULL OR p.studio_data IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO t FROM public.s2v_tasks WHERE project_id=_project AND operation_key=_key;
 IF t.id IS NOT NULL THEN RETURN t.id; END IF;
 IF _cost < 0 THEN RAISE EXCEPTION 'INVALID_COST'; END IF;
 gid:=public.spend_credits(_user,'script_video',_cost,p.title,_kind);
 INSERT INTO public.s2v_tasks(project_id,user_id,operation_key,kind,target,cost,input,generation_id) VALUES(_project,_user,_key,_kind,_target,_cost,_input,gid) RETURNING id INTO gid;
 RETURN gid;
END $function$;
REVOKE EXECUTE ON FUNCTION public.s2v_queue_task(uuid,uuid,text,text,integer,integer,jsonb) FROM PUBLIC, anon, authenticated;
UPDATE public.s2v_settings SET max_scenes=40 WHERE id=1 AND max_scenes<40;