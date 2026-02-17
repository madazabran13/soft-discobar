ALTER TABLE public.inventory_movements
  DROP CONSTRAINT inventory_movements_created_by_fkey;

ALTER TABLE public.inventory_movements
  ADD CONSTRAINT inventory_movements_created_by_profiles_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id);