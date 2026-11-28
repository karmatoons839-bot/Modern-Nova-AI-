CREATE OR REPLACE FUNCTION public.telegram_remember_delivery() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _conversation uuid;
BEGIN
 IF NEW.status='sent' AND OLD.status IS DISTINCT FROM 'sent' AND NEW.update_id IS NOT NULL AND coalesce(NEW.delivery_method,'sendMessage')='sendMessage' THEN
 SELECT m.conversation_id INTO _conversation FROM public.telegram_messages m JOIN public.telegram_conversations c ON c.id=m.conversation_id WHERE m.update_id=NEW.update_id AND m.role='user' AND c.chat_id=NEW.chat_id;
 IF _conversation IS NOT NULL THEN
 INSERT INTO public.telegram_messages(conversation_id,update_id,role,content,delivery_id) VALUES(_conversation,NEW.update_id,'assistant',left(NEW.message,8000),NEW.id) ON CONFLICT DO NOTHING;
 UPDATE public.telegram_conversations SET updated_at=now() WHERE id=_conversation;
 END IF;
 END IF;
 RETURN NEW;
END; $$;