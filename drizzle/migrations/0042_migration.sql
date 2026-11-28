
CREATE OR REPLACE FUNCTION public.my_referral_code() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c text; uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN'; END IF;
  SELECT code INTO c FROM referral_codes WHERE user_id = uid;
  IF c IS NOT NULL THEN RETURN c; END IF;
  LOOP
    c := 'MN' || upper(substr(md5(random()::text || clock_timestamp()::text || uid::text), 1, 6));
    BEGIN
      INSERT INTO referral_codes(user_id, code) VALUES (uid, c) ON CONFLICT (user_id) DO NOTHING;
      SELECT code INTO c FROM referral_codes WHERE user_id = uid; RETURN c;
    EXCEPTION WHEN unique_violation THEN END;
  END LOOP;
END $$;
