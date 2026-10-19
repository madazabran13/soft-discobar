REVOKE ALL ON public.tenants, public.modules, public.tenant_modules, public.audit_logs FROM anon;
REVOKE EXECUTE ON FUNCTION public.protect_profile_fields(), public.protect_user_roles(), public.audit_tenant_modules() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.module_enabled(text), public.is_superadmin(), public.get_my_role(), public.has_role(uuid, app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.module_enabled(text), public.is_superadmin(), public.get_my_role(), public.has_role(uuid, app_role) TO authenticated;