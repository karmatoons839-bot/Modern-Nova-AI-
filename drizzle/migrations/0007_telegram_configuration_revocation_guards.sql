CREATE OR REPLACE FUNCTION public.telegram_revoke_configuration() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF OLD.website_owner_id IS DISTINCT FROM NEW.website_owner_id OR OLD.owner_telegram_id IS DISTINCT FROM NEW.owner_telegram_id OR OLD.admin_chat_id IS DISTINCT FROM NEW.admin_chat_id OR OLD.support_chat_id IS DISTINCT FROM NEW.support_chat_id OR (OLD.owner_verified_at IS NOT NULL AND NEW.owner_verified_at IS NULL) OR (OLD.enabled=true AND NEW.enabled=false) THEN
  NEW.verification_hash:=NULL;
  NEW.verification_expires_at:=NULL;
  NEW.owner_verified_at:=NULL;
  NEW.enabled:=false;
  UPDATE public.telegram_actions SET status='cancelled',decided_at=now(),result=jsonb_build_object('reason','configuration_revoked') WHERE status='pending';
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.telegram_revoke_configuration() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER telegram_configuration_revocation BEFORE UPDATE ON public.telegram_admin_config FOR EACH ROW EXECUTE FUNCTION public.telegram_revoke_configuration();
DO $$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.telegram_confirm_action(uuid,text,text,boolean)'::regprocedure) INTO definition;
 IF position('SELECT * INTO c FROM public.telegram_admin_config WHERE id=true;' IN definition)=0 THEN RAISE EXCEPTION 'CONFIRMATION_FUNCTION_CHANGED'; END IF;
 definition:=replace(definition,'SELECT * INTO c FROM public.telegram_admin_config WHERE id=true;','SELECT * INTO c FROM public.telegram_admin_config WHERE id=true FOR UPDATE;');
 EXECUTE definition;
END; $$;
REVOKE ALL ON FUNCTION public.telegram_confirm_action(uuid,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.telegram_confirm_action(uuid,text,text,boolean) TO service_role;