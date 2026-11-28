CREATE OR REPLACE FUNCTION public.telegram_confirm_action(_id uuid, _sender text, _chat text, _approve boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE a public.telegram_actions; c public.telegram_admin_config; p public.profiles; pay public.payments; _result jsonb; _ledger uuid;
BEGIN
 SELECT * INTO c FROM public.telegram_admin_config WHERE id=true FOR UPDATE;
 IF c.owner_verified_at IS NULL OR NOT c.enabled OR c.owner_telegram_id<>_sender OR (_chat<>c.admin_chat_id AND _chat<>c.owner_telegram_id) OR NOT public.has_role(c.website_owner_id,'admin'::public.app_role) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO a FROM public.telegram_actions WHERE id=_id FOR UPDATE;
 IF a.id IS NULL OR a.owner_id<>c.website_owner_id OR a.telegram_user_id<>_sender OR a.chat_id<>_chat THEN RAISE EXCEPTION 'ACTION_NOT_FOUND'; END IF;
 IF a.status<>'pending' THEN RETURN jsonb_build_object('status',a.status,'result',a.result,'already_decided',true); END IF;
 IF a.expires_at<=now() THEN UPDATE public.telegram_actions SET status='expired',decided_at=now() WHERE id=a.id; RETURN jsonb_build_object('status','expired'); END IF;
 IF NOT _approve THEN UPDATE public.telegram_actions SET status='cancelled',decided_at=now() WHERE id=a.id; INSERT INTO public.admin_audit_log(admin_id,action,target_user,reason,related_id) VALUES(c.website_owner_id,'telegram_action_cancelled',a.target_user,a.reason,a.id::text); RETURN jsonb_build_object('status','cancelled'); END IF;
 IF a.kind IN ('credits','plan') AND (a.target_user=c.website_owner_id OR public.has_role(a.target_user,'admin'::public.app_role) OR public.has_role(a.target_user,'owner'::public.app_role)) THEN RAISE EXCEPTION 'OWNER_PROTECTED'; END IF;
 IF a.kind='credits' THEN
  IF a.amount IS NULL OR a.amount=0 OR abs(a.amount)>1000000 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  SELECT * INTO p FROM public.profiles WHERE id=a.target_user FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
  IF p.credits+a.amount<0 THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;
  UPDATE public.profiles SET credits=credits+a.amount,updated_at=now() WHERE id=p.id;
  INSERT INTO public.credit_ledger(user_id,amount,reason) VALUES(p.id,a.amount,'Telegram admin: '||a.reason||' [reference '||coalesce(a.reference_id,a.id::text)||']') RETURNING id INTO _ledger;
  _result=jsonb_build_object('credits',p.credits+a.amount,'ledger_id',_ledger,'amount',a.amount);
 ELSIF a.kind='plan' THEN IF a.message NOT IN ('free','creator','pro','premium') OR a.amount IS NULL OR a.amount<0 OR a.amount>1000000 THEN RAISE EXCEPTION 'INVALID_PLAN'; END IF; SELECT * INTO p FROM public.profiles WHERE id=a.target_user FOR UPDATE; IF p.id IS NULL THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF; UPDATE public.profiles SET plan=a.message,subscription_status=CASE WHEN a.message='free' THEN 'none' ELSE 'active' END,plan_renews_at=CASE WHEN a.message='free' THEN NULL ELSE now()+interval '30 days' END,credits=credits+a.amount,updated_at=now() WHERE id=p.id; IF a.amount>0 THEN INSERT INTO public.credit_ledger(user_id,amount,reason) VALUES(p.id,a.amount,'Telegram confirmed plan grant: '||a.reason||' ['||a.id::text||']'); END IF; _result=jsonb_build_object('plan',a.message,'credits_added',a.amount); ELSIF a.kind='status' THEN
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
  INSERT INTO public.telegram_deliveries(dedupe_key,chat_id,message,website_user_id) SELECT 'broadcast:'||a.id::text||':'||l.telegram_user_id,l.telegram_user_id,a.message,l.website_user_id FROM public.telegram_account_links l WHERE l.notify_announcements=true ON CONFLICT DO NOTHING;
  _result=jsonb_build_object('status','queued','recipients','opted_in_linked_users');
 END IF;
 UPDATE public.telegram_actions SET status='completed',result=_result,decided_at=now() WHERE id=a.id;
 INSERT INTO public.admin_audit_log(admin_id,action,target_user,reason,related_id,details) VALUES(c.website_owner_id,'telegram_'||a.kind,a.target_user,a.reason,coalesce(a.reference_id,a.id::text),jsonb_build_object('action_id',a.id,'telegram_user_id',_sender,'result',_result));
 RETURN jsonb_build_object('status','completed','result',_result);
END; $function$;

CREATE OR REPLACE FUNCTION public.telegram_confirm_offer(_id uuid, _sender text, _chat text, _approve boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ DECLARE c public.telegram_admin_config; o public.telegram_offers; ord text; BEGIN SELECT * INTO c FROM public.telegram_admin_config WHERE id=true FOR UPDATE; IF NOT c.enabled OR c.owner_verified_at IS NULL OR c.owner_telegram_id<>_sender OR (_chat<>c.owner_telegram_id AND _chat<>c.admin_chat_id) OR NOT public.has_role(c.website_owner_id,'admin'::public.app_role) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF; SELECT * INTO o FROM public.telegram_offers WHERE id=_id FOR UPDATE; IF o.id IS NULL OR o.owner_id<>c.website_owner_id OR o.confirmation_chat_id IS DISTINCT FROM _chat THEN RAISE EXCEPTION 'OFFER_NOT_FOUND'; END IF; IF o.status<>'draft' THEN RETURN jsonb_build_object('status',o.status,'order_id',o.order_id,'already_decided',true); END IF; IF o.expires_at<now() THEN UPDATE public.telegram_offers SET status='expired' WHERE id=o.id; RETURN jsonb_build_object('status','expired'); END IF; IF _approve AND (o.user_id=c.website_owner_id OR public.has_role(o.user_id,'admin'::public.app_role) OR public.has_role(o.user_id,'owner'::public.app_role)) THEN RAISE EXCEPTION 'OWNER_PROTECTED'; END IF; IF NOT _approve THEN UPDATE public.telegram_offers SET status='cancelled' WHERE id=o.id; RETURN jsonb_build_object('status','cancelled'); END IF; IF c.original_qr_file_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.telegram_account_links WHERE website_user_id=o.user_id) THEN RAISE EXCEPTION 'ORIGINAL_QR_AND_LINK_REQUIRED'; END IF; ord:='MN-TG-'||replace(o.id::text,'-',''); INSERT INTO public.payments(user_id,plan,amount_paise,currency,order_id,payment_method,status,credits,telegram_offer_id) VALUES(o.user_id,o.tier,o.amount_paise,'INR',ord,'upi_manual','pending',o.credits,o.id); UPDATE public.telegram_offers SET status='pending_payment',order_id=ord WHERE id=o.id; INSERT INTO public.telegram_deliveries(dedupe_key,chat_id,message,website_user_id,delivery_method,payload) SELECT 'offer:'||o.id::text,l.telegram_user_id,o.name||E'\n₹'||(o.amount_paise/100.0)||' · '||o.credits||' credits · '||o.days||' days · '||o.tier||E'\nOrder: '||ord||E'\nSend /utr '||ord||' <12-digit UTR> privately. Owner must verify actual bank receipt before activation.',o.user_id,'sendPhoto',jsonb_build_object('photo',c.original_qr_file_id) FROM public.telegram_account_links l WHERE l.website_user_id=o.user_id ON CONFLICT DO NOTHING; INSERT INTO public.admin_audit_log(admin_id,action,target_user,reason,related_id,details) VALUES(c.website_owner_id,'telegram_custom_offer',o.user_id,o.reason,ord,jsonb_build_object('offer_id',o.id,'amount_paise',o.amount_paise,'credits',o.credits,'days',o.days,'tier',o.tier)); RETURN jsonb_build_object('status','pending_payment','order_id',ord); END; $function$;

CREATE OR REPLACE FUNCTION public.earning_claim(_sender text)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE u uuid; r public.earning_rewards; total integer:=0; lid uuid; BEGIN
SELECT website_user_id INTO u FROM public.telegram_account_links WHERE telegram_user_id=_sender;
IF u IS NULL THEN RAISE EXCEPTION 'VERIFIED_ACCOUNT_LINK_REQUIRED'; END IF;
IF public.has_role(u,'admin'::public.app_role) OR public.has_role(u,'owner'::public.app_role) OR EXISTS(SELECT 1 FROM public.admin_members m WHERE m.user_id=u) OR EXISTS(SELECT 1 FROM public.telegram_admin_config c WHERE c.website_owner_id=u OR c.owner_telegram_id=_sender) THEN RAISE EXCEPTION 'STAFF_REWARDS_FORBIDDEN'; END IF;
PERFORM 1 FROM public.profiles WHERE id=u AND status='active' FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_UNAVAILABLE'; END IF;
FOR r IN SELECT * FROM public.earning_rewards WHERE telegram_user_id=_sender AND source='telegram' AND status='approved' AND decided_by IS DISTINCT FROM u ORDER BY id FOR UPDATE LOOP
INSERT INTO public.credit_ledger(user_id,amount,reason) VALUES(u,r.amount,'telegram_member_reward:'||r.id::text) RETURNING id INTO lid;
UPDATE public.earning_rewards SET status='claimed',user_id=u,claimed_at=now(),ledger_id=lid WHERE id=r.id;
total:=total+r.amount;
END LOOP;
IF total>0 THEN UPDATE public.profiles SET credits=credits+total,updated_at=now() WHERE id=u; INSERT INTO public.earning_audit(action,details) VALUES('claim',jsonb_build_object('user',u,'amount',total)); END IF;
RETURN total; END; $function$;

CREATE OR REPLACE FUNCTION public.check_promo_code(_code text, _plan text)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT CASE WHEN auth.uid() IS NULL THEN NULL ELSE (SELECT jsonb_build_object('code',p.code,'percent',p.percent,'allowed_plan',p.allowed_plan) FROM public.promo_codes p WHERE p.code=upper(trim(_code)) AND p.active AND (p.expires_at IS NULL OR p.expires_at>now()) AND (p.max_uses IS NULL OR p.uses<p.max_uses)) END $function$;
REVOKE ALL ON FUNCTION public.check_promo_code(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_promo_code(text,text) TO authenticated;