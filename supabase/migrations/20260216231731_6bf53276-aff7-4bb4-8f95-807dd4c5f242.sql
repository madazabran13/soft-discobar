
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'trabajador');

-- User roles table (separate from profiles per security requirements)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  category TEXT DEFAULT 'General',
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Tables (mesas)
CREATE TYPE public.table_status AS ENUM ('libre', 'ocupada', 'facturacion');

CREATE TABLE public.tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  capacity INTEGER NOT NULL DEFAULT 4,
  status table_status NOT NULL DEFAULT 'libre',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

-- Orders
CREATE TYPE public.order_status AS ENUM ('pendiente', 'confirmado', 'facturado', 'cancelado');

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID REFERENCES public.tables(id) NOT NULL,
  worker_id UUID REFERENCES auth.users(id) NOT NULL,
  client_name TEXT NOT NULL DEFAULT '',
  status order_status NOT NULL DEFAULT 'pendiente',
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Order details
CREATE TABLE public.order_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_details ENABLE ROW LEVEL SECURITY;

-- Sales / Payments
CREATE TYPE public.payment_method AS ENUM ('efectivo', 'transferencia', 'tarjeta');

CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) NOT NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method payment_method NOT NULL DEFAULT 'efectivo',
  processed_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Inventory movements
CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) NOT NULL,
  quantity_change INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- ============ HELPER FUNCTIONS ============

-- has_role function (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to get current user role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::TEXT FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
$$;

-- ============ RLS POLICIES ============

-- user_roles policies
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read own role" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- profiles policies
CREATE POLICY "Admins can do all on profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- products policies
CREATE POLICY "Anyone authenticated can read products" ON public.products
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage products" ON public.products
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- tables policies
CREATE POLICY "Anyone authenticated can read tables" ON public.tables
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage tables" ON public.tables
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- orders policies
CREATE POLICY "Admins can manage all orders" ON public.orders
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Workers can read own orders" ON public.orders
  FOR SELECT TO authenticated
  USING (worker_id = auth.uid());

CREATE POLICY "Workers can insert orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (worker_id = auth.uid());

CREATE POLICY "Workers can update own orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (worker_id = auth.uid());

-- order_details policies
CREATE POLICY "Admins can manage all order_details" ON public.order_details
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Workers can read own order details" ON public.order_details
  FOR SELECT TO authenticated
  USING (order_id IN (SELECT id FROM public.orders WHERE worker_id = auth.uid()));

CREATE POLICY "Workers can insert own order details" ON public.order_details
  FOR INSERT TO authenticated
  WITH CHECK (order_id IN (SELECT id FROM public.orders WHERE worker_id = auth.uid()));

-- sales policies
CREATE POLICY "Admins can manage sales" ON public.sales
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Workers can read own sales" ON public.sales
  FOR SELECT TO authenticated
  USING (order_id IN (SELECT id FROM public.orders WHERE worker_id = auth.uid()));

-- inventory_movements policies
CREATE POLICY "Anyone authenticated can read movements" ON public.inventory_movements
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage movements" ON public.inventory_movements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============ TRIGGERS ============

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_tables_updated_at BEFORE UPDATE ON public.tables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto-deduct inventory when order is confirmed
CREATE OR REPLACE FUNCTION public.deduct_inventory_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'confirmado' AND OLD.status = 'pendiente' THEN
    -- Deduct stock for each order detail
    UPDATE public.products p
    SET stock_quantity = p.stock_quantity - od.quantity
    FROM public.order_details od
    WHERE od.order_id = NEW.id AND od.product_id = p.id;

    -- Record inventory movements
    INSERT INTO public.inventory_movements (product_id, quantity_change, reason, created_by)
    SELECT od.product_id, -od.quantity, 'Pedido ' || NEW.id::TEXT, NEW.worker_id
    FROM public.order_details od
    WHERE od.order_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_order_confirmed
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.deduct_inventory_on_order();

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
