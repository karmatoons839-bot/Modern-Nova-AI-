REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.profiles FROM anon, authenticated;
REVOKE ALL ON public.profiles FROM anon;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (display_name, language) ON public.profiles TO authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.credit_ledger, public.generations, public.payments, public.user_roles, public.admin_settings, public.admin_audit_log, public.support_messages, public.login_events FROM anon, authenticated;
REVOKE ALL ON public.credit_ledger, public.generations, public.payments, public.user_roles, public.admin_notifications, public.admin_settings, public.admin_audit_log, public.support_messages, public.login_events FROM anon;
REVOKE INSERT, TRUNCATE ON public.admin_notifications FROM authenticated;
REVOKE UPDATE ON public.admin_notifications FROM authenticated;
GRANT UPDATE (is_read) ON public.admin_notifications TO authenticated;