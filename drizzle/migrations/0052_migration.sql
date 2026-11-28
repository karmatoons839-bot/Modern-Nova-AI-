CREATE TABLE public.api_providers (
  service text PRIMARY KEY CHECK (service IN ('all_in_one','voiceover','image','thumbnail')),
  base_url text NOT NULL,
  encrypted_key text NOT NULL,
  key_hint text NOT NULL DEFAULT '',
  model text,
  enabled boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.api_providers TO service_role;
ALTER TABLE public.api_providers ENABLE ROW LEVEL SECURITY;