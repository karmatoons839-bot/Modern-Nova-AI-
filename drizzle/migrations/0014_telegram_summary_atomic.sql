CREATE OR REPLACE FUNCTION public.telegram_save_summary(_conversation uuid,_through bigint,_content text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM 1 FROM public.telegram_conversations WHERE id=_conversation FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'MEMORY_NOT_FOUND'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.telegram_messages WHERE conversation_id=_conversation AND id=_through) THEN RETURN; END IF;
 INSERT INTO public.telegram_memory_summaries(conversation_id,through_message_id,content) VALUES(_conversation,_through,_content) ON CONFLICT DO NOTHING;
END; $$;
REVOKE ALL ON FUNCTION public.telegram_save_summary(uuid,bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.telegram_save_summary(uuid,bigint,text) TO service_role;