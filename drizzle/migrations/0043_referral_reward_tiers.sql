CREATE OR REPLACE FUNCTION public.reward_referral_on_payment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r referrals; reward integer; ref_plan text;
BEGIN
  IF NEW.status = 'success' AND OLD.status IS DISTINCT FROM 'success' AND NEW.amount_paise > 0 THEN
    SELECT * INTO r FROM referrals WHERE referred_user_id = NEW.user_id AND status = 'pending' FOR UPDATE;
    IF r.referred_user_id IS NOT NULL THEN
      SELECT plan INTO ref_plan FROM profiles WHERE id = r.referrer_user_id;
      reward := CASE WHEN ref_plan IS NOT NULL AND ref_plan <> 'free' THEN 5000 ELSE 500 END;
      UPDATE referrals SET status='rewarded', rewarded_at=now(), payment_id=NEW.id, reward_credits=reward WHERE referred_user_id = r.referred_user_id;
      UPDATE profiles SET credits = credits + reward, updated_at = now() WHERE id = r.referrer_user_id;
      INSERT INTO credit_ledger(user_id, amount, reason) VALUES (r.referrer_user_id, reward, 'Referral reward ' || NEW.order_id);
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.reward_referral_on_payment() FROM PUBLIC, anon, authenticated;