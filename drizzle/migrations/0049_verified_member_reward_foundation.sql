CREATE TABLE public.earning_settings (id boolean PRIMARY KEY DEFAULT true CHECK(id), ads_enabled boolean NOT NULL DEFAULT false, telegram_enabled boolean NOT NULL DEFAULT false, ad_credits integer NOT NULL DEFAULT 1000 CHECK(ad_credits BETWEEN 1 AND 100000), member_credits integer NOT NULL DEFAULT 1000 CHECK(member_credits BETWEEN 1 AND 100000), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.earning_settings TO authenticated; GRANT ALL ON public.earning_settings TO service_role;
ALTER TABLE public.earning_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in read reward settings" ON public.earning_settings FOR SELECT TO authenticated USING(auth.uid() IS NOT NULL);
CREATE TABLE public.earning_members (chat_id text NOT NULL, member_id text NOT NULL, first_update bigint NOT NULL, first_seen timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(chat_id,member_id));
GRANT ALL ON public.earning_members TO service_role; ALTER TABLE public.earning_members ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.earning_rewards (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source text NOT NULL CHECK(source IN ('telegram','ad')), event_key text NOT NULL UNIQUE, telegram_user_id text, member_id text, user_id uuid, amount integer NOT NULL CHECK(amount>0), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','claimed')), verification text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), decided_by uuid, decided_at timestamptz, claimed_at timestamptz, ledger_id uuid);
GRANT SELECT ON public.earning_rewards TO authenticated; GRANT ALL ON public.earning_rewards TO service_role; ALTER TABLE public.earning_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User reads linked rewards; admins review" ON public.earning_rewards FOR SELECT TO authenticated USING(user_id=auth.uid() OR EXISTS(SELECT 1 FROM public.telegram_account_links l WHERE l.website_user_id=auth.uid() AND l.telegram_user_id=earning_rewards.telegram_user_id) OR public.has_role(auth.uid(),'admin'));
CREATE TABLE public.earning_audit (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor uuid, action text NOT NULL, reward_id uuid, details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.earning_audit TO authenticated; GRANT ALL ON public.earning_audit TO service_role; ALTER TABLE public.earning_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin reads reward audit" ON public.earning_audit FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE FUNCTION public.earning_observe_member(_chat text,_member text,_inviter text,_update bigint,_bot boolean,_eligible boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE c public.earning_settings; rid uuid; BEGIN
IF NOT EXISTS(SELECT 1 FROM public.telegram_admin_config WHERE id=true AND support_chat_id=_chat) THEN RETURN jsonb_build_object('status','ignored'); END IF;
INSERT INTO public.earning_members(chat_id,member_id,first_update) VALUES(_chat,_member,_update) ON CONFLICT DO NOTHING;
IF NOT FOUND THEN RETURN jsonb_build_object('status','existing'); END IF;
SELECT * INTO c FROM public.earning_settings WHERE id=true;
IF NOT coalesce(c.telegram_enabled,false) OR _bot OR NOT _eligible OR _inviter IS NULL OR _member=_inviter THEN RETURN jsonb_build_object('status','ineligible'); END IF;
INSERT INTO public.earning_rewards(source,event_key,telegram_user_id,member_id,amount,verification) VALUES('telegram','telegram:'||_chat||':'||_member,_inviter,_member,c.member_credits,'FIRST_OBSERVED_JOIN_REQUIRES_GENUINE_MEMBER_REVIEW') ON CONFLICT DO NOTHING RETURNING id INTO rid;
RETURN jsonb_build_object('status','pending','id',rid,'amount',c.member_credits); END; $$;
REVOKE ALL ON FUNCTION public.earning_observe_member(text,text,text,bigint,boolean,boolean) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.earning_observe_member(text,text,text,bigint,boolean,boolean) TO service_role;
CREATE FUNCTION public.earning_review(_id uuid,_approve boolean,_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
IF length(trim(_reason))<8 THEN RAISE EXCEPTION 'REVIEW_REASON_REQUIRED'; END IF;
UPDATE public.earning_rewards SET status=CASE WHEN _approve THEN 'approved' ELSE 'rejected' END, verification=_reason,decided_by=auth.uid(),decided_at=now() WHERE id=_id AND source='telegram' AND status='pending';
IF NOT FOUND THEN RAISE EXCEPTION 'NOT_REVIEWABLE'; END IF;
INSERT INTO public.earning_audit(actor,action,reward_id,details) VALUES(auth.uid(),CASE WHEN _approve THEN 'approve' ELSE 'reject' END,_id,jsonb_build_object('reason',_reason)); END; $$;
REVOKE ALL ON FUNCTION public.earning_review(uuid,boolean,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.earning_review(uuid,boolean,text) TO authenticated;
CREATE FUNCTION public.earning_save_settings(_telegram boolean,_ad integer,_member integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
INSERT INTO public.earning_settings(id,telegram_enabled,ad_credits,member_credits) VALUES(true,_telegram,_ad,_member) ON CONFLICT(id) DO UPDATE SET telegram_enabled=excluded.telegram_enabled,ad_credits=excluded.ad_credits,member_credits=excluded.member_credits,updated_at=now();
INSERT INTO public.earning_audit(actor,action,details) VALUES(auth.uid(),'settings',jsonb_build_object('telegram',_telegram,'ad_credits',_ad,'member_credits',_member)); END; $$;
REVOKE ALL ON FUNCTION public.earning_save_settings(boolean,integer,integer) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.earning_save_settings(boolean,integer,integer) TO authenticated;
CREATE FUNCTION public.earning_claim(_sender text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE u uuid; r public.earning_rewards; total integer:=0; lid uuid; BEGIN
SELECT website_user_id INTO u FROM public.telegram_account_links WHERE telegram_user_id=_sender;
IF u IS NULL THEN RAISE EXCEPTION 'VERIFIED_ACCOUNT_LINK_REQUIRED'; END IF;
PERFORM 1 FROM public.profiles WHERE id=u AND status='active' FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_UNAVAILABLE'; END IF;
FOR r IN SELECT * FROM public.earning_rewards WHERE telegram_user_id=_sender AND source='telegram' AND status='approved' ORDER BY id FOR UPDATE LOOP
INSERT INTO public.credit_ledger(user_id,amount,reason) VALUES(u,r.amount,'telegram_member_reward:'||r.id::text) RETURNING id INTO lid;
UPDATE public.earning_rewards SET status='claimed',user_id=u,claimed_at=now(),ledger_id=lid WHERE id=r.id;
total:=total+r.amount;
END LOOP;
IF total>0 THEN UPDATE public.profiles SET credits=credits+total,updated_at=now() WHERE id=u; INSERT INTO public.earning_audit(action,details) VALUES('claim',jsonb_build_object('user',u,'amount',total)); END IF;
RETURN total; END; $$;
REVOKE ALL ON FUNCTION public.earning_claim(text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.earning_claim(text) TO service_role;