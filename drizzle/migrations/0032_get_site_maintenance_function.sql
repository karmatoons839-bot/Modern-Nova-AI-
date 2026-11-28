-- Expose only the maintenance on/off flag through a locked-down function and
-- remove direct public read access to the status table.
CREATE OR REPLACE FUNCTION public.get_site_maintenance()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT enabled FROM public.site_maintenance WHERE id = true;
$$;

REVOKE ALL ON FUNCTION public.get_site_maintenance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_site_maintenance() TO anon, authenticated;

DROP POLICY "Public maintenance status" ON public.site_maintenance;
REVOKE SELECT ON public.site_maintenance FROM anon, authenticated;