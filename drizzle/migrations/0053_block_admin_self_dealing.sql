CREATE OR REPLACE FUNCTION public.api_approve_order(_order uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE o public.api_credit_orders; w public.api_wallets;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO o FROM api_credit_orders WHERE id = _order FOR UPDATE;
  IF o IS NULL OR o.status <> 'submitted' THEN RAISE EXCEPTION 'ORDER_NOT_PAYABLE'; END IF;
  IF o.user_id = auth.uid() THEN RAISE EXCEPTION 'SELF_APPROVAL_FORBIDDEN'; END IF;
  INSERT INTO api_wallets(user_id) VALUES (o.user_id) ON CONFLICT DO NOTHING;
  SELECT * INTO w FROM api_wallets WHERE user_id = o.user_id FOR UPDATE;
  UPDATE api_wallets SET balance = balance + o.credits, updated_at = now() WHERE user_id = o.user_id;
  UPDATE api_credit_orders SET status = 'paid', decided_at = now() WHERE id = _order;
  INSERT INTO api_credit_transactions(user_id, kind, request_id, previous_balance, credits, new_balance)
    VALUES (o.user_id, 'purchase', o.id::text, w.balance, o.credits, w.balance + o.credits);
END $function$;

CREATE OR REPLACE FUNCTION public.earning_review(_id uuid, _approve boolean, _reason text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE r public.earning_rewards; BEGIN
IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
IF length(trim(_reason))<8 THEN RAISE EXCEPTION 'REVIEW_REASON_REQUIRED'; END IF;
SELECT * INTO r FROM public.earning_rewards WHERE id=_id FOR UPDATE;
IF _approve AND r.id IS NOT NULL AND (r.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.telegram_account_links l WHERE l.website_user_id = auth.uid() AND l.telegram_user_id = r.telegram_user_id)) THEN RAISE EXCEPTION 'SELF_APPROVAL_FORBIDDEN'; END IF;
UPDATE public.earning_rewards SET status=CASE WHEN _approve THEN 'approved' ELSE 'rejected' END, verification=_reason,decided_by=auth.uid(),decided_at=now() WHERE id=_id AND source='telegram' AND status='pending';
IF NOT FOUND THEN RAISE EXCEPTION 'NOT_REVIEWABLE'; END IF;
INSERT INTO public.earning_audit(actor,action,reward_id,details) VALUES(auth.uid(),CASE WHEN _approve THEN 'approve' ELSE 'reject' END,_id,jsonb_build_object('reason',_reason)); END; $function$;

CREATE OR REPLACE FUNCTION public.earning_save_settings(_telegram boolean, _ad integer, _member integer)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ BEGIN
IF NOT public.has_role(auth.uid(),'owner') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
INSERT INTO public.earning_settings(id,telegram_enabled,ad_credits,member_credits) VALUES(true,_telegram,_ad,_member) ON CONFLICT(id) DO UPDATE SET telegram_enabled=excluded.telegram_enabled,ad_credits=excluded.ad_credits,member_credits=excluded.member_credits,updated_at=now();
INSERT INTO public.earning_audit(actor,action,details) VALUES(auth.uid(),'settings',jsonb_build_object('telegram',_telegram,'ad_credits',_ad,'member_credits',_member)); END; $function$;