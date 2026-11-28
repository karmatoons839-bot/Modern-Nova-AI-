CREATE TABLE public.telegram_conversations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), telegram_user_id text NOT NULL, chat_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), last_error_code text, last_error_at timestamptz,
 UNIQUE(telegram_user_id,chat_id)
);
GRANT SELECT ON public.telegram_conversations TO authenticated;
GRANT ALL ON public.telegram_conversations TO service_role;
ALTER TABLE public.telegram_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_memory_read ON public.telegram_conversations FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE TABLE public.telegram_messages (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, conversation_id uuid NOT NULL REFERENCES public.telegram_conversations(id) ON DELETE CASCADE,
 update_id bigint NOT NULL, role text NOT NULL CHECK(role IN ('user','assistant')), content text NOT NULL CHECK(length(content)<=8000),
 delivery_id uuid REFERENCES public.telegram_deliveries(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(update_id,role,delivery_id)
);
GRANT SELECT ON public.telegram_messages TO authenticated;
GRANT ALL ON public.telegram_messages TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.telegram_messages_id_seq TO service_role;
ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_message_read ON public.telegram_messages FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE UNIQUE INDEX telegram_inbound_once ON public.telegram_messages(update_id) WHERE role='user';
CREATE UNIQUE INDEX telegram_outbound_once ON public.telegram_messages(delivery_id) WHERE role='assistant';
CREATE INDEX telegram_history_idx ON public.telegram_messages(conversation_id,id DESC);
CREATE INDEX telegram_history_date_idx ON public.telegram_messages(conversation_id,created_at DESC);
CREATE INDEX telegram_message_search_idx ON public.telegram_messages USING gin(to_tsvector('simple',content));
CREATE TABLE public.telegram_memory_summaries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES public.telegram_conversations(id) ON DELETE CASCADE,
 through_message_id bigint NOT NULL, content text NOT NULL CHECK(length(content)<=6000), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(conversation_id,through_message_id)
);
GRANT SELECT ON public.telegram_memory_summaries TO authenticated;
GRANT ALL ON public.telegram_memory_summaries TO service_role;
ALTER TABLE public.telegram_memory_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_summary_read ON public.telegram_memory_summaries FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE INDEX telegram_summary_idx ON public.telegram_memory_summaries(conversation_id,through_message_id DESC);
CREATE INDEX telegram_summary_search_idx ON public.telegram_memory_summaries USING gin(to_tsvector('simple',content));
CREATE TABLE public.telegram_user_memories (
 conversation_id uuid PRIMARY KEY REFERENCES public.telegram_conversations(id) ON DELETE CASCADE,
 content text NOT NULL DEFAULT '' CHECK(length(content)<=6000), updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid
);
GRANT SELECT ON public.telegram_user_memories TO authenticated;
GRANT ALL ON public.telegram_user_memories TO service_role;
ALTER TABLE public.telegram_user_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_fact_read ON public.telegram_user_memories FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.telegram_store_incoming(_sender text,_chat text,_update bigint,_content text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _conversation uuid;
BEGIN
 IF _sender !~ '^[0-9]{1,17}$' OR _chat !~ '^-?[0-9]{1,17}$' OR length(_content)>8000 THEN RAISE EXCEPTION 'INVALID_MEMORY_INPUT'; END IF;
 INSERT INTO public.telegram_conversations(telegram_user_id,chat_id) VALUES(_sender,_chat)
 ON CONFLICT(telegram_user_id,chat_id) DO UPDATE SET updated_at=now() RETURNING id INTO _conversation;
 INSERT INTO public.telegram_messages(conversation_id,update_id,role,content) VALUES(_conversation,_update,'user',_content) ON CONFLICT DO NOTHING;
 RETURN _conversation;
END; $$;
REVOKE ALL ON FUNCTION public.telegram_store_incoming(text,text,bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.telegram_store_incoming(text,text,bigint,text) TO service_role;
CREATE OR REPLACE FUNCTION public.telegram_remember_delivery() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _conversation uuid;
BEGIN
 IF NEW.status='sent' AND OLD.status IS DISTINCT FROM 'sent' AND NEW.update_id IS NOT NULL AND NEW.delivery_method='sendMessage' THEN
 SELECT m.conversation_id INTO _conversation FROM public.telegram_messages m JOIN public.telegram_conversations c ON c.id=m.conversation_id WHERE m.update_id=NEW.update_id AND m.role='user' AND c.chat_id=NEW.chat_id;
 IF _conversation IS NOT NULL THEN
 INSERT INTO public.telegram_messages(conversation_id,update_id,role,content,delivery_id) VALUES(_conversation,NEW.update_id,'assistant',left(NEW.message,8000),NEW.id) ON CONFLICT DO NOTHING;
 UPDATE public.telegram_conversations SET updated_at=now() WHERE id=_conversation;
 END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER telegram_delivery_memory AFTER UPDATE OF status ON public.telegram_deliveries FOR EACH ROW EXECUTE FUNCTION public.telegram_remember_delivery();
CREATE OR REPLACE FUNCTION public.telegram_manage_memory(_owner uuid,_conversation uuid,_action text,_content text,_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.has_role(_owner,'admin') THEN RAISE EXCEPTION 'OWNER_REQUIRED'; END IF;
 IF length(_reason)<5 OR length(_reason)>300 OR length(_content)>6000 THEN RAISE EXCEPTION 'INVALID_MEMORY_CHANGE'; END IF;
 PERFORM 1 FROM public.telegram_conversations WHERE id=_conversation FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'MEMORY_NOT_FOUND'; END IF;
 IF _action='correct' THEN
 INSERT INTO public.telegram_user_memories(conversation_id,content,updated_by) VALUES(_conversation,_content,_owner) ON CONFLICT(conversation_id) DO UPDATE SET content=excluded.content,updated_by=_owner,updated_at=now();
 ELSIF _action='delete' THEN
 DELETE FROM public.telegram_messages WHERE conversation_id=_conversation;
 DELETE FROM public.telegram_memory_summaries WHERE conversation_id=_conversation;
 DELETE FROM public.telegram_user_memories WHERE conversation_id=_conversation;
 UPDATE public.telegram_conversations SET last_error_code=NULL,last_error_at=NULL WHERE id=_conversation;
 ELSE RAISE EXCEPTION 'INVALID_MEMORY_ACTION'; END IF;
 INSERT INTO public.admin_audit_log(admin_id,action,reason,related_id,details) VALUES(_owner,'telegram_memory_'||_action,_reason,_conversation::text,jsonb_build_object('conversation_id',_conversation));
END; $$;
REVOKE ALL ON FUNCTION public.telegram_manage_memory(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.telegram_manage_memory(uuid,uuid,text,text,text) TO service_role;