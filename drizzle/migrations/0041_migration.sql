
CREATE TABLE public.referral_codes (
  user_id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{6,12}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.referrals (
  referred_user_id uuid PRIMARY KEY,
  referrer_user_id uuid NOT NULL,
  code text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','rewarded')),
  reward_credits integer NOT NULL DEFAULT 500,
  payment_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  rewarded_at timestamptz,
  CHECK (referred_user_id <> referrer_user_id)
);
CREATE INDEX referrals_referrer_idx ON public.referrals (referrer_user_id);
GRANT SELECT ON public.referral_codes TO authenticated;
GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referral_codes, public.referrals TO service_role;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own referral code" ON public.referral_codes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own referrals" ON public.referrals FOR SELECT TO authenticated USING (referrer_user_id = auth.uid() OR referred_user_id = auth.uid());

-- Get (or create) the caller's code.
CREATE OR REPLACE FUNCTION public.my_referral_code() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c text; uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  SELECT code INTO c FROM referral_codes WHERE user_id = uid;
  IF c IS NOT NULL THEN RETURN c; END IF;
  LOOP
    c := upper(substr(translate(encode(gen_random_bytes(8),'base64'),'+/=0O1I',''),1,8));
    BEGIN
      INSERT INTO referral_codes(user_id, code) VALUES (uid, c) ON CONFLICT (user_id) DO NOTHING;
      SELECT code INTO c FROM referral_codes WHERE user_id = uid; RETURN c;
    EXCEPTION WHEN unique_violation THEN END;
  END LOOP;
END $$;

-- New user binds one referral code once; only before any successful paid payment.
CREATE OR REPLACE FUNCTION public.apply_referral_code(_code text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); ref uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  SELECT user_id INTO ref FROM referral_codes WHERE code = upper(trim(_code));
  IF ref IS NULL THEN RETURN 'invalid'; END IF;
  IF ref = uid THEN RETURN 'self'; END IF;
  IF EXISTS (SELECT 1 FROM referrals WHERE referred_user_id = uid) THEN RETURN 'already'; END IF;
  IF EXISTS (SELECT 1 FROM payments WHERE user_id = uid AND status = 'success' AND amount_paise > 0) THEN RETURN 'not_new'; END IF;
  INSERT INTO referrals(referred_user_id, referrer_user_id, code) VALUES (uid, ref, upper(trim(_code))) ON CONFLICT DO NOTHING;
  RETURN 'applied';
END $$;
REVOKE ALL ON FUNCTION public.my_referral_code(), public.apply_referral_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_referral_code(), public.apply_referral_code(text) TO authenticated;

-- Reward the referrer exactly once, on the referred user's first verified paid (non-zero) payment.
CREATE OR REPLACE FUNCTION public.reward_referral_on_payment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r referrals;
BEGIN
  IF NEW.status = 'success' AND OLD.status IS DISTINCT FROM 'success' AND NEW.amount_paise > 0 THEN
    SELECT * INTO r FROM referrals WHERE referred_user_id = NEW.user_id AND status = 'pending' FOR UPDATE;
    IF r.referred_user_id IS NOT NULL THEN
      UPDATE referrals SET status='rewarded', rewarded_at=now(), payment_id=NEW.id WHERE referred_user_id = r.referred_user_id;
      UPDATE profiles SET credits = credits + r.reward_credits, updated_at = now() WHERE id = r.referrer_user_id;
      INSERT INTO credit_ledger(user_id, amount, reason) VALUES (r.referrer_user_id, r.reward_credits, 'Referral reward ' || NEW.order_id);
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.reward_referral_on_payment() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER payments_reward_referral AFTER UPDATE OF status ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.reward_referral_on_payment();
