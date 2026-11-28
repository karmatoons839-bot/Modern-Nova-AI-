ALTER TABLE public.telegram_admin_config ADD COLUMN IF NOT EXISTS verification_hash text, ADD COLUMN IF NOT EXISTS verification_expires_at timestamptz, ADD COLUMN IF NOT EXISTS last_update_at timestamptz;
CREATE TABLE public.telegram_updates (update_id bigint PRIMARY KEY, status text NOT NULL DEFAULT 'processing', received_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, error_code text);
GRANT ALL ON public.telegram_updates TO service_role;
ALTER TABLE public.telegram_updates ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.telegram_limits (sender_id text PRIMARY KEY, window_start timestamptz NOT NULL DEFAULT now(), attempts integer NOT NULL DEFAULT 1);
GRANT ALL ON public.telegram_limits TO service_role;
ALTER TABLE public.telegram_limits ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.telegram_tickets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), telegram_user_id text NOT NULL, website_user_id uuid, kind text NOT NULL DEFAULT 'support', description text NOT NULL, generation_id uuid, status text NOT NULL DEFAULT 'open', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.telegram_tickets TO authenticated;
GRANT ALL ON public.telegram_tickets TO service_role;
ALTER TABLE public.telegram_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners and linked users read tickets" ON public.telegram_tickets FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR website_user_id=auth.uid());
CREATE TABLE public.telegram_account_links (telegram_user_id text PRIMARY KEY, website_user_id uuid UNIQUE NOT NULL, confirmed_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.telegram_account_links TO authenticated;
GRANT ALL ON public.telegram_account_links TO service_role;
ALTER TABLE public.telegram_account_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own Telegram link" ON public.telegram_account_links FOR SELECT TO authenticated USING (website_user_id=auth.uid() OR has_role(auth.uid(),'admin'::app_role));
CREATE TABLE public.telegram_link_requests (token_hash text PRIMARY KEY, website_user_id uuid NOT NULL, expires_at timestamptz NOT NULL, used_at timestamptz);
GRANT ALL ON public.telegram_link_requests TO service_role;
ALTER TABLE public.telegram_link_requests ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.telegram_actions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, telegram_user_id text NOT NULL, chat_id text NOT NULL, kind text NOT NULL CHECK (kind IN ('credits','status','approve_upi','reject_upi','announcement','close_ticket')), target_user uuid, amount integer, reason text NOT NULL, reference_id text, message text, status text NOT NULL DEFAULT 'pending', result jsonb, expires_at timestamptz NOT NULL DEFAULT now()+interval '5 minutes', created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz);
GRANT SELECT ON public.telegram_actions TO authenticated;
GRANT ALL ON public.telegram_actions TO service_role;
ALTER TABLE public.telegram_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read Telegram actions" ON public.telegram_actions FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'::app_role));
CREATE TABLE public.telegram_deliveries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), dedupe_key text UNIQUE NOT NULL, chat_id text NOT NULL, message text NOT NULL, status text NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0, message_id bigint, error_code text, created_at timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz);
GRANT SELECT ON public.telegram_deliveries TO authenticated;
GRANT ALL ON public.telegram_deliveries TO service_role;
ALTER TABLE public.telegram_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read delivery status" ON public.telegram_deliveries FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'::app_role));
CREATE OR REPLACE FUNCTION public.telegram_accept_update(_update bigint,_sender text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _attempts integer; _inserted bigint;
BEGIN
 INSERT INTO public.telegram_limits(sender_id) VALUES(_sender) ON CONFLICT(sender_id) DO UPDATE SET attempts=CASE WHEN telegram_limits.window_start < now()-interval '1 minute' THEN 1 ELSE telegram_limits.attempts+1 END, window_start=CASE WHEN telegram_limits.window_start < now()-interval '1 minute' THEN now() ELSE telegram_limits.window_start END RETURNING attempts INTO _attempts;
 IF _attempts>20 THEN RETURN false; END IF;
 INSERT INTO public.telegram_updates(update_id) VALUES(_update) ON CONFLICT DO NOTHING RETURNING update_id INTO _inserted;
 RETURN _inserted IS NOT NULL;
END; $$;
REVOKE ALL ON FUNCTION public.telegram_accept_update(bigint,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.telegram_accept_update(bigint,text) TO service_role;
CREATE OR REPLACE FUNCTION public.telegram_verify_owner(_sender text,_hash text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _owner uuid;
BEGIN
 UPDATE public.telegram_admin_config SET owner_verified_at=now(),verification_hash=null,verification_expires_at=null WHERE id=true AND owner_telegram_id=_sender AND verification_hash=_hash AND verification_expires_at>now() RETURNING website_owner_id INTO _owner;
 IF _owner IS NULL THEN RETURN false; END IF;
 INSERT INTO public.admin_audit_log(admin_id,action,details) VALUES(_owner,'telegram_owner_verified',jsonb_build_object('telegram_user_id',_sender));
 RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.telegram_verify_owner(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.telegram_verify_owner(text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.telegram_consume_link(_sender text,_hash text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _user uuid;
BEGIN
 SELECT website_user_id INTO _user FROM public.telegram_link_requests WHERE token_hash=_hash AND expires_at>now() AND used_at IS NULL FOR UPDATE;
 IF _user IS NULL THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.telegram_account_links WHERE telegram_user_id=_sender OR website_user_id=_user) THEN RETURN false; END IF;
 INSERT INTO public.telegram_account_links(telegram_user_id,website_user_id) VALUES(_sender,_user);
 UPDATE public.telegram_link_requests SET used_at=now() WHERE token_hash=_hash;
 RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.telegram_consume_link(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.telegram_consume_link(text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.telegram_confirm_action(_id uuid,_sender text,_chat text,_approve boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.telegram_actions; c public.telegram_admin_config; p public.profiles; pay public.payments; _result jsonb; _ledger uuid;
BEGIN
 SELECT * INTO c FROM public.telegram_admin_config WHERE id=true;
 IF c.owner_verified_at IS NULL OR NOT c.enabled OR c.owner_telegram_id<>_sender OR (_chat<>c.admin_chat_id AND _chat<>c.owner_telegram_id) OR NOT public.has_role(c.website_owner_id,'admin'::public.app_role) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO a FROM public.telegram_actions WHERE id=_id FOR UPDATE;
 IF a.id IS NULL OR a.owner_id<>c.website_owner_id OR a.telegram_user_id<>_sender OR a.chat_id<>_chat THEN RAISE EXCEPTION 'ACTION_NOT_FOUND'; END IF;
 IF a.status<>'pending' THEN RETURN jsonb_build_object('status',a.status,'result',a.result,'already_decided',true); END IF;
 IF a.expires_at<=now() THEN UPDATE public.telegram_actions SET status='expired',decided_at=now() WHERE id=a.id; RETURN jsonb_build_object('status','expired'); END IF;
 IF NOT _approve THEN UPDATE public.telegram_actions SET status='cancelled',decided_at=now() WHERE id=a.id; INSERT INTO public.admin_audit_log(admin_id,action,target_user,reason,related_id) VALUES(c.website_owner_id,'telegram_action_cancelled',a.target_user,a.reason,a.id::text); RETURN jsonb_build_object('status','cancelled'); END IF;
 IF a.kind='credits' THEN
  IF a.amount IS NULL OR a.amount=0 OR abs(a.amount)>1000000 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  SELECT * INTO p FROM public.profiles WHERE id=a.target_user FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
  IF p.credits+a.amount<0 THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;
  UPDATE public.profiles SET credits=credits+a.amount,updated_at=now() WHERE id=p.id;
  INSERT INTO public.credit_ledger(user_id,amount,reason) VALUES(p.id,a.amount,'Telegram admin: '||a.reason||' [reference '||coalesce(a.reference_id,a.id::text)||']') RETURNING id INTO _ledger;
  _result=jsonb_build_object('credits',p.credits+a.amount,'ledger_id',_ledger,'amount',a.amount);
 ELSIF a.kind='status' THEN
  IF a.target_user=c.website_owner_id THEN RAISE EXCEPTION 'OWNER_PROTECTED'; END IF;
  IF a.message NOT IN ('active','suspended') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
  UPDATE public.profiles SET status=a.message,updated_at=now() WHERE id=a.target_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
  _result=jsonb_build_object('account_status',a.message);
 ELSIF a.kind IN ('approve_upi','reject_upi') THEN
  SELECT * INTO pay FROM public.payments WHERE order_id=a.reference_id FOR UPDATE;
  IF pay.id IS NULL OR pay.status<>'pending' OR pay.payment_method<>'upi_manual' OR pay.user_id<>a.target_user OR pay.amount_paise<>a.amount THEN RAISE EXCEPTION 'PAYMENT_CHANGED'; END IF;
  IF a.kind='approve_upi' THEN
   IF pay.provider_payment_id IS NULL THEN RAISE EXCEPTION 'UTR_REQUIRED'; END IF;
   PERFORM public.activate_payment(pay.order_id,pay.provider_payment_id,'upi',pay.amount_paise);
  ELSE PERFORM public.close_payment(pay.order_id,'failed',a.reason); END IF;
  _result=jsonb_build_object('order_id',pay.order_id,'decision',a.kind);
 ELSIF a.kind='close_ticket' THEN
  UPDATE public.telegram_tickets SET status='closed',updated_at=now() WHERE id=a.reference_id::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'TICKET_NOT_FOUND'; END IF;
  _result=jsonb_build_object('ticket_id',a.reference_id,'status','closed');
 ELSIF a.kind='announcement' THEN
  IF a.message IS NULL OR length(a.message)>3000 THEN RAISE EXCEPTION 'INVALID_ANNOUNCEMENT'; END IF;
  INSERT INTO public.telegram_deliveries(dedupe_key,chat_id,message) VALUES('announcement:'||a.id::text,c.support_chat_id,a.message) ON CONFLICT DO NOTHING;
  _result=jsonb_build_object('status','queued','group','support');
 END IF;
 UPDATE public.telegram_actions SET status='completed',result=_result,decided_at=now() WHERE id=a.id;
 INSERT INTO public.admin_audit_log(admin_id,action,target_user,reason,related_id,details) VALUES(c.website_owner_id,'telegram_'||a.kind,a.target_user,a.reason,coalesce(a.reference_id,a.id::text),jsonb_build_object('action_id',a.id,'telegram_user_id',_sender,'result',_result));
 RETURN jsonb_build_object('status','completed','result',_result);
END; $$;
REVOKE ALL ON FUNCTION public.telegram_confirm_action(uuid,text,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.telegram_confirm_action(uuid,text,text,boolean) TO service_role;