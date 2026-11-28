CREATE TABLE public.diwali_campaigns (
 id text PRIMARY KEY DEFAULT 'diwali-2026', enabled boolean NOT NULL DEFAULT false,
 starts_at timestamptz, ends_at timestamptz, claim_opens_at timestamptz, claim_closes_at timestamptz,
 refund_percent integer NOT NULL DEFAULT 100 CHECK (refund_percent BETWEEN 1 AND 100),
 tools text[] NOT NULL DEFAULT ARRAY['voice','image','thumbnail','music','story','video','script_video'],
 max_return bigint CHECK (max_return > 0), locked_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.diwali_campaigns TO authenticated;
GRANT ALL ON public.diwali_campaigns TO service_role;
ALTER TABLE public.diwali_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY diwali_owner_campaign_read ON public.diwali_campaigns FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TABLE public.diwali_claims (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id text NOT NULL REFERENCES public.diwali_campaigns(id),
 user_id uuid NOT NULL, eligible_credits bigint NOT NULL, returned_credits integer NOT NULL,
 ledger_id uuid, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(campaign_id,user_id)
);
GRANT SELECT ON public.diwali_claims TO authenticated;
GRANT ALL ON public.diwali_claims TO service_role;
ALTER TABLE public.diwali_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY diwali_claim_read ON public.diwali_claims FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TABLE public.diwali_sources (
 generation_id uuid PRIMARY KEY, campaign_id text NOT NULL REFERENCES public.diwali_campaigns(id), user_id uuid NOT NULL,
 tool text NOT NULL, debited_credits integer NOT NULL CHECK (debited_credits > 0),
 started_at timestamptz NOT NULL, settled_at timestamptz, eligible boolean NOT NULL DEFAULT false,
 reversed boolean NOT NULL DEFAULT false, claim_id uuid REFERENCES public.diwali_claims(id)
);
GRANT SELECT ON public.diwali_sources TO authenticated;
GRANT ALL ON public.diwali_sources TO service_role;
ALTER TABLE public.diwali_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY diwali_source_read ON public.diwali_sources FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE INDEX diwali_source_user_idx ON public.diwali_sources(campaign_id,user_id);
CREATE FUNCTION public.diwali_validate_campaign() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.enabled AND (NEW.starts_at IS NULL OR NEW.ends_at IS NULL OR NEW.claim_opens_at IS NULL OR NEW.claim_closes_at IS NULL) THEN RAISE EXCEPTION 'Configure all campaign dates before enabling'; END IF;
 IF NEW.starts_at IS NOT NULL AND NEW.ends_at IS NOT NULL AND NEW.starts_at >= NEW.ends_at THEN RAISE EXCEPTION 'Campaign end must follow start'; END IF;
 IF NEW.claim_opens_at IS NOT NULL AND NEW.ends_at IS NOT NULL AND NEW.claim_opens_at < NEW.ends_at THEN RAISE EXCEPTION 'Claims must open after campaign end'; END IF;
 IF NEW.claim_closes_at IS NOT NULL AND NEW.claim_opens_at IS NOT NULL AND NEW.claim_closes_at <= NEW.claim_opens_at THEN RAISE EXCEPTION 'Claim deadline must follow refund opening'; END IF;
 IF array_length(NEW.tools,1) IS NULL OR NOT NEW.tools <@ ARRAY['voice','image','thumbnail','music','story','video','script_video']::text[] THEN RAISE EXCEPTION 'Choose valid website tools'; END IF;
 IF TG_OP='UPDATE' AND OLD.locked_at IS NOT NULL AND (NEW.starts_at,NEW.ends_at,NEW.claim_opens_at,NEW.claim_closes_at,NEW.refund_percent,NEW.tools,NEW.max_return) IS DISTINCT FROM (OLD.starts_at,OLD.ends_at,OLD.claim_opens_at,OLD.claim_closes_at,OLD.refund_percent,OLD.tools,OLD.max_return) THEN RAISE EXCEPTION 'Earned campaign rules are locked; enablement may still change'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER diwali_campaign_validation BEFORE INSERT OR UPDATE ON public.diwali_campaigns FOR EACH ROW EXECUTE FUNCTION public.diwali_validate_campaign();
CREATE FUNCTION public.diwali_capture_debit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.diwali_campaigns; g public.generations;
BEGIN
 IF NEW.generation_id IS NULL THEN RETURN NEW; END IF;
 IF NEW.amount > 0 THEN
  UPDATE public.diwali_sources SET reversed=true, eligible=false WHERE generation_id=NEW.generation_id AND claim_id IS NULL;
  RETURN NEW;
 END IF;
 IF NEW.amount >= 0 THEN RETURN NEW; END IF;
 SELECT * INTO g FROM public.generations WHERE id=NEW.generation_id;
 IF g.id IS NULL OR g.cost <= 0 OR g.user_id <> NEW.user_id THEN RETURN NEW; END IF;
 SELECT * INTO c FROM public.diwali_campaigns WHERE enabled AND g.created_at >= starts_at AND g.created_at < ends_at AND g.tool=ANY(tools) ORDER BY starts_at DESC LIMIT 1 FOR UPDATE;
 IF c.id IS NULL THEN RETURN NEW; END IF;
 INSERT INTO public.diwali_sources(generation_id,campaign_id,user_id,tool,debited_credits,started_at,eligible,settled_at)
 VALUES(g.id,c.id,g.user_id,g.tool,LEAST(g.cost,-NEW.amount),g.created_at,g.status='done',g.completed_at) ON CONFLICT(generation_id) DO NOTHING;
 UPDATE public.diwali_campaigns SET locked_at=COALESCE(locked_at,now()) WHERE id=c.id;
 RETURN NEW;
END $$;
CREATE TRIGGER diwali_capture_ledger AFTER INSERT ON public.credit_ledger FOR EACH ROW EXECUTE FUNCTION public.diwali_capture_debit();
CREATE FUNCTION public.diwali_settle_source() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status THEN
  UPDATE public.diwali_sources s SET settled_at=NEW.completed_at, eligible=(NEW.status='done' AND NOT s.reversed AND NEW.completed_at <= c.claim_opens_at)
  FROM public.diwali_campaigns c WHERE s.generation_id=NEW.id AND c.id=s.campaign_id AND s.claim_id IS NULL;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER diwali_settlement AFTER UPDATE OF status ON public.generations FOR EACH ROW EXECUTE FUNCTION public.diwali_settle_source();
CREATE FUNCTION public.diwali_public_campaign() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE((SELECT jsonb_build_object('id',id,'enabled',enabled,'starts_at',starts_at,'ends_at',ends_at,'claim_opens_at',claim_opens_at,'claim_closes_at',claim_closes_at,'refund_percent',refund_percent,'tools',tools,'max_return',max_return,'locked_at',locked_at) FROM public.diwali_campaigns WHERE id='diwali-2026'),'null'::jsonb)
$$;
REVOKE ALL ON FUNCTION public.diwali_public_campaign() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.diwali_public_campaign() TO anon,authenticated,service_role;
CREATE FUNCTION public.diwali_save_campaign(_config jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.diwali_campaigns;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Owner access required'; END IF;
 INSERT INTO public.diwali_campaigns(id,enabled,starts_at,ends_at,claim_opens_at,claim_closes_at,refund_percent,tools,max_return)
 VALUES('diwali-2026',COALESCE((_config->>'enabled')::boolean,false),(_config->>'starts_at')::timestamptz,(_config->>'ends_at')::timestamptz,(_config->>'claim_opens_at')::timestamptz,(_config->>'claim_closes_at')::timestamptz,COALESCE((_config->>'refund_percent')::integer,100),ARRAY(SELECT jsonb_array_elements_text(_config->'tools')),(_config->>'max_return')::bigint)
 ON CONFLICT(id) DO UPDATE SET enabled=EXCLUDED.enabled,starts_at=EXCLUDED.starts_at,ends_at=EXCLUDED.ends_at,claim_opens_at=EXCLUDED.claim_opens_at,claim_closes_at=EXCLUDED.claim_closes_at,refund_percent=EXCLUDED.refund_percent,tools=EXCLUDED.tools,max_return=EXCLUDED.max_return,updated_at=now() RETURNING * INTO c;
 INSERT INTO public.admin_audit_log(admin_id,action,details) VALUES(auth.uid(),'diwali_campaign_saved',to_jsonb(c));
 RETURN to_jsonb(c);
END $$;
REVOKE ALL ON FUNCTION public.diwali_save_campaign(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.diwali_save_campaign(jsonb) TO authenticated;
CREATE FUNCTION public.diwali_claim(_campaign text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.diwali_campaigns; p public.profiles; receipt public.diwali_claims; total bigint; award bigint; lid uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT * INTO p FROM public.profiles WHERE id=auth.uid() FOR UPDATE;
 IF p.id IS NULL OR p.status='suspended' THEN RAISE EXCEPTION 'Account unavailable'; END IF;
 SELECT * INTO receipt FROM public.diwali_claims WHERE campaign_id=_campaign AND user_id=auth.uid();
 IF receipt.id IS NOT NULL THEN RETURN to_jsonb(receipt); END IF;
 SELECT * INTO c FROM public.diwali_campaigns WHERE id=_campaign;
 IF c.id IS NULL OR now() < c.claim_opens_at OR now() >= c.claim_closes_at OR c.claim_opens_at IS NULL THEN RAISE EXCEPTION 'Outside claim window'; END IF;
 PERFORM generation_id FROM public.diwali_sources WHERE campaign_id=c.id AND user_id=p.id FOR UPDATE;
 SELECT COALESCE(sum(debited_credits),0) INTO total FROM public.diwali_sources WHERE campaign_id=c.id AND user_id=p.id AND eligible AND NOT reversed AND claim_id IS NULL AND settled_at <= c.claim_opens_at;
 award := LEAST(floor(total*c.refund_percent/100.0)::bigint,COALESCE(c.max_return,2147483647::bigint));
 IF award <= 0 THEN RAISE EXCEPTION 'No eligible credits'; END IF;
 IF p.credits::bigint+award > 2147483647 THEN RAISE EXCEPTION 'Wallet capacity reached; contact support'; END IF;
 INSERT INTO public.diwali_claims(campaign_id,user_id,eligible_credits,returned_credits) VALUES(c.id,p.id,total,award::integer) RETURNING * INTO receipt;
 INSERT INTO public.credit_ledger(user_id,amount,reason) VALUES(p.id,award::integer,'Diwali Credit Back 2026') RETURNING id INTO lid;
 UPDATE public.profiles SET credits=credits+award::integer,updated_at=now() WHERE id=p.id;
 UPDATE public.diwali_claims SET ledger_id=lid WHERE id=receipt.id;
 UPDATE public.diwali_sources SET claim_id=receipt.id WHERE campaign_id=c.id AND user_id=p.id AND eligible AND NOT reversed AND claim_id IS NULL;
 receipt.ledger_id := lid;
 RETURN to_jsonb(receipt);
END $$;
REVOKE ALL ON FUNCTION public.diwali_claim(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.diwali_claim(text) TO authenticated;
REVOKE ALL ON FUNCTION public.diwali_capture_debit(),public.diwali_settle_source(),public.diwali_validate_campaign() FROM PUBLIC;
COMMENT ON TABLE public.diwali_sources IS 'Immutable debit snapshots survive generation history deletion; successful charges only, globally one campaign per source. No retroactive enrollment.';