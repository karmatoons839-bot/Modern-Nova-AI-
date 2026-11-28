CREATE TABLE public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9_-]{3,30}$'),
  percent integer NOT NULL CHECK (percent BETWEEN 1 AND 90),
  active boolean NOT NULL DEFAULT true,
  max_uses integer CHECK (max_uses IS NULL OR max_uses > 0),
  uses integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.promo_codes TO authenticated;
GRANT ALL ON public.promo_codes TO service_role;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read promos" ON public.promo_codes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
ALTER TABLE public.payments ADD COLUMN promo_code text, ADD COLUMN discount_percent integer NOT NULL DEFAULT 0, ADD COLUMN bonus_credits integer NOT NULL DEFAULT 0;