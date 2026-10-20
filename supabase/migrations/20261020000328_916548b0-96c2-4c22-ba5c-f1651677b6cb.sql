CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid;
BEGIN
  SELECT id INTO v_tenant FROM public.tenants WHERE is_active ORDER BY created_at LIMIT 1;
  INSERT INTO profiles (id, full_name, email, saas_role, tenant_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'saas_role')::saas_role, 'trabajador'),
    v_tenant
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    tenant_id = COALESCE(profiles.tenant_id, EXCLUDED.tenant_id),
    updated_at = NOW();
  RETURN NEW;
END;
$function$;