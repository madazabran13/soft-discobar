CREATE POLICY "Only superadmin sees superadmin roles"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (role <> 'superadmin'::public.app_role OR public.is_superadmin());