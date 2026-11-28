CREATE TABLE public.telegram_admin_config (
 id boolean PRIMARY KEY DEFAULT true CHECK (id),
 website_owner_id uuid NOT NULL,
 owner_telegram_id text NOT NULL CHECK (owner_telegram_id ~ '^[1-9][0-9]{0,15}$'),
 admin_chat_id text NOT NULL CHECK (admin_chat_id ~ '^-[1-9][0-9]{0,15}$'),
 support_chat_id text NOT NULL CHECK (support_chat_id ~ '^-[1-9][0-9]{0,15}$'),
 enabled boolean NOT NULL DEFAULT false,
 owner_verified_at timestamptz,
 last_health_check timestamptz,
 health jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (admin_chat_id <> support_chat_id)
);
GRANT SELECT ON public.telegram_admin_config TO authenticated;
GRANT ALL ON public.telegram_admin_config TO service_role;
ALTER TABLE public.telegram_admin_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Website owners read Telegram configuration" ON public.telegram_admin_config FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE OR REPLACE FUNCTION public.save_telegram_config(_owner uuid, _telegram text, _admin text, _support text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT public.has_role(_owner, 'admin'::public.app_role) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 INSERT INTO public.telegram_admin_config(id, website_owner_id, owner_telegram_id, admin_chat_id, support_chat_id)
 VALUES(true, _owner, _telegram, _admin, _support)
 ON CONFLICT(id) DO UPDATE SET website_owner_id=EXCLUDED.website_owner_id, owner_telegram_id=EXCLUDED.owner_telegram_id, admin_chat_id=EXCLUDED.admin_chat_id, support_chat_id=EXCLUDED.support_chat_id, enabled=false, owner_verified_at=null, last_health_check=null, health='{}'::jsonb, updated_at=now();
 INSERT INTO public.admin_audit_log(admin_id, action, reason, details) VALUES(_owner, 'telegram_configuration_saved', 'Processing disabled until verification and deployment', jsonb_build_object('owner_telegram_id',_telegram,'admin_chat_id',_admin,'support_chat_id',_support));
END; $$;
REVOKE ALL ON FUNCTION public.save_telegram_config(uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_telegram_config(uuid,text,text,text) TO service_role;