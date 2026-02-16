
-- Add foreign key from user_roles.user_id to profiles.id (not auth.users to avoid issues)
-- Actually profiles.id references auth.users.id, so user_roles needs FK to auth.users
-- But PostgREST needs an explicit FK to join tables. Let's add FK from orders.worker_id to profiles.id
-- and from user_roles.user_id to profiles.id for PostgREST joins

-- FK: user_roles.user_id -> profiles.id  
ALTER TABLE public.user_roles
ADD CONSTRAINT user_roles_user_id_profiles_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- FK: orders.worker_id -> profiles.id
ALTER TABLE public.orders
ADD CONSTRAINT orders_worker_id_profiles_fkey
FOREIGN KEY (worker_id) REFERENCES public.profiles(id);

-- FK: sales.processed_by -> profiles.id
ALTER TABLE public.sales
ADD CONSTRAINT sales_processed_by_profiles_fkey
FOREIGN KEY (processed_by) REFERENCES public.profiles(id);

-- Create categories table
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read categories"
  ON public.categories FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage categories"
  ON public.categories FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Migrate existing categories from products.category text to categories table
INSERT INTO public.categories (name)
SELECT DISTINCT category FROM public.products WHERE category IS NOT NULL AND category != ''
ON CONFLICT (name) DO NOTHING;

-- Add category_id column to products
ALTER TABLE public.products ADD COLUMN category_id uuid REFERENCES public.categories(id);

-- Populate category_id from existing category text
UPDATE public.products p
SET category_id = c.id
FROM public.categories c
WHERE p.category = c.name;
