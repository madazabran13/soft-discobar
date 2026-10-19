CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.modules (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  default_roles text[] NOT NULL DEFAULT ARRAY['admin'],
  sort_order int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.modules TO authenticated;
GRANT ALL ON public.modules TO service_role;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tenant_modules (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_key text NOT NULL REFERENCES public.modules(key),
  enabled boolean NOT NULL DEFAULT true,
  allowed_roles text[] NOT NULL DEFAULT ARRAY['admin'],
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, module_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_modules TO authenticated;
GRANT ALL ON public.tenant_modules TO service_role;
ALTER TABLE public.tenant_modules ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  user_id uuid DEFAULT auth.uid(),
  action text NOT NULL,
  entity text NOT NULL DEFAULT '',
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Security helpers (roles from user_roles only)
CREATE OR REPLACE FUNCTION public.is_superadmin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'superadmin')
$$;

CREATE OR REPLACE FUNCTION public.get_my_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role::text FROM public.user_roles WHERE user_id = auth.uid()
  ORDER BY CASE role::text WHEN 'superadmin' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id
    AND (role = _role OR (role::text = 'superadmin' AND _role::text = 'admin')))
$$;

CREATE OR REPLACE FUNCTION public.module_enabled(_key text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_superadmin() OR EXISTS (
    SELECT 1 FROM public.tenant_modules tm
    WHERE tm.tenant_id = public.get_my_tenant_id() AND tm.module_key = _key AND tm.enabled
      AND public.get_my_role() = ANY(tm.allowed_roles))
$$;

-- Modules catalog
INSERT INTO public.modules (key, name, description, default_roles, sort_order) VALUES
 ('dashboard','Dashboard','Resumen y gráficos',ARRAY['admin'],1),
 ('mesas','Mesas y cuentas','Estados de mesas y cuentas',ARRAY['admin','trabajador'],2),
 ('pedidos','Pedidos','Registro y seguimiento de pedidos',ARRAY['admin','trabajador'],3),
 ('productos','Productos','Catálogo y precios',ARRAY['admin'],4),
 ('categorias','Categorías','Categorías de productos',ARRAY['admin'],5),
 ('usuarios','Usuarios','Trabajadores del negocio',ARRAY['admin'],6),
 ('ventas','Ventas','Ventas, reportes y exportación',ARRAY['admin'],7),
 ('inventario','Inventario','Movimientos y ajustes',ARRAY['admin'],8),
 ('configuracion','Configuración','Ajustes del negocio',ARRAY['admin'],9)
ON CONFLICT (key) DO NOTHING;

-- COTICO tenant + backfill
INSERT INTO public.tenants (name, slug) SELECT 'COTICO','cotico'
WHERE NOT EXISTS (SELECT 1 FROM public.tenants WHERE slug='cotico');

INSERT INTO public.tenant_modules (tenant_id, module_key, enabled, allowed_roles)
SELECT t.id, m.key, true, m.default_roles FROM public.tenants t CROSS JOIN public.modules m
WHERE t.slug='cotico' ON CONFLICT DO NOTHING;

UPDATE public.profiles SET tenant_id = (SELECT id FROM public.tenants WHERE slug='cotico') WHERE tenant_id IS NULL;

DO $$
DECLARE t text; cot uuid := (SELECT id FROM public.tenants WHERE slug='cotico');
BEGIN
  FOREACH t IN ARRAY ARRAY['tables','products','categories','orders','order_details','sales','inventory_movements'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id)', t);
    EXECUTE format('UPDATE public.%I SET tenant_id = %L WHERE tenant_id IS NULL', t, cot);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET DEFAULT public.get_my_tenant_id()', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(tenant_id)', 'idx_'||t||'_tenant', t);
    EXECUTE format('CREATE POLICY "Tenant isolation" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (tenant_id = public.get_my_tenant_id() OR public.is_superadmin()) WITH CHECK (tenant_id = public.get_my_tenant_id() OR public.is_superadmin())', t);
  END LOOP;
END $$;

-- Module enforcement at DB level for module-owned tables
CREATE POLICY "Module ventas" ON public.sales AS RESTRICTIVE FOR SELECT TO authenticated USING (public.module_enabled('ventas') OR public.module_enabled('pedidos'));
CREATE POLICY "Module inventario" ON public.inventory_movements AS RESTRICTIVE FOR SELECT TO authenticated USING (public.module_enabled('inventario'));

-- Profiles: tenant isolation for admins + block privilege escalation
CREATE POLICY "Tenant isolation" ON public.profiles AS RESTRICTIVE FOR ALL TO authenticated
USING (id = auth.uid() OR tenant_id = public.get_my_tenant_id() OR public.is_superadmin())
WITH CHECK (id = auth.uid() OR tenant_id = public.get_my_tenant_id() OR public.is_superadmin());
CREATE POLICY "Superadmin manages profiles" ON public.profiles FOR ALL TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

CREATE OR REPLACE FUNCTION public.protect_profile_fields() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_superadmin() THEN
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.saas_role IS DISTINCT FROM OLD.saas_role THEN
      RAISE EXCEPTION 'No autorizado para cambiar negocio o rol';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_protect_profile_fields BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

-- user_roles: only superadmin can grant/revoke superadmin; admins limited to own tenant
CREATE OR REPLACE FUNCTION public.protect_user_roles() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF auth.uid() IS NULL OR public.is_superadmin() THEN RETURN COALESCE(NEW, OLD); END IF;
  r := COALESCE(NEW, OLD);
  IF r.role::text = 'superadmin' OR (TG_OP='UPDATE' AND OLD.role::text='superadmin') THEN
    RAISE EXCEPTION 'Solo el Superadministrador puede gestionar ese rol';
  END IF;
  IF (SELECT tenant_id FROM public.profiles WHERE id = r.user_id) IS DISTINCT FROM public.get_my_tenant_id() THEN
    RAISE EXCEPTION 'Usuario de otro negocio';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER trg_protect_user_roles BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.protect_user_roles();

-- Policies for new tables
CREATE POLICY "Members read own tenant" ON public.tenants FOR SELECT TO authenticated USING (id = public.get_my_tenant_id() OR public.is_superadmin());
CREATE POLICY "Superadmin manages tenants" ON public.tenants FOR ALL TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY "Authenticated read modules" ON public.modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Superadmin manages modules" ON public.modules FOR ALL TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY "Members read tenant modules" ON public.tenant_modules FOR SELECT TO authenticated USING (tenant_id = public.get_my_tenant_id() OR public.is_superadmin());
CREATE POLICY "Superadmin manages tenant modules" ON public.tenant_modules FOR ALL TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY "Admins read tenant audit" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_superadmin() OR (public.has_role(auth.uid(),'admin') AND tenant_id = public.get_my_tenant_id()));
CREATE POLICY "Users insert own audit" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Audit module toggles automatically
CREATE OR REPLACE FUNCTION public.audit_tenant_modules() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs (tenant_id, user_id, action, entity, entity_id, details)
  VALUES (NEW.tenant_id, auth.uid(), 'module_update', 'tenant_modules', NEW.module_key,
    jsonb_build_object('enabled', NEW.enabled, 'allowed_roles', NEW.allowed_roles));
  RETURN NEW;
END $$;
CREATE TRIGGER trg_audit_tenant_modules AFTER INSERT OR UPDATE ON public.tenant_modules FOR EACH ROW EXECUTE FUNCTION public.audit_tenant_modules();

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Platform owner: INGEMD account becomes superadmin (keeps admin)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'superadmin' FROM public.profiles WHERE email = 'ingemigueldaza@gmail.com'
AND NOT EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.profiles p ON p.id=ur.user_id WHERE p.email='ingemigueldaza@gmail.com' AND ur.role::text='superadmin');

-- Theme preference
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'dark';