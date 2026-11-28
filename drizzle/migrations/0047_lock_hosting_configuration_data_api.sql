REVOKE ALL ON TABLE public.hosting_configuration FROM anon,authenticated;
GRANT ALL ON TABLE public.hosting_configuration TO service_role;