
-- Drop the insert trigger since order_details don't exist yet at insert time
DROP TRIGGER IF EXISTS trg_deduct_inventory_on_order_insert ON public.orders;
DROP FUNCTION IF EXISTS public.deduct_inventory_on_order_insert();

-- Fix the overly permissive policy
DROP POLICY IF EXISTS "Workers can update table status" ON public.tables;
CREATE POLICY "Authenticated users can update table status"
  ON public.tables
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
