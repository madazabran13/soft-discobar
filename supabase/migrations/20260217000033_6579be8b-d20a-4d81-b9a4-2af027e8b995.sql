
-- Create trigger for automatic stock deduction when order status changes to 'confirmado'
CREATE TRIGGER trg_deduct_inventory_on_order
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.deduct_inventory_on_order();

-- Also handle direct inserts as 'confirmado' (new trigger function)
CREATE OR REPLACE FUNCTION public.deduct_inventory_on_order_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'confirmado' THEN
    UPDATE public.products p
    SET stock_quantity = p.stock_quantity - od.quantity
    FROM public.order_details od
    WHERE od.order_id = NEW.id AND od.product_id = p.id;

    INSERT INTO public.inventory_movements (product_id, quantity_change, reason, created_by)
    SELECT od.product_id, -od.quantity, 'Pedido ' || NEW.id::TEXT, NEW.worker_id
    FROM public.order_details od
    WHERE od.order_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- This trigger fires AFTER insert so order_details exist
CREATE TRIGGER trg_deduct_inventory_on_order_insert
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.deduct_inventory_on_order_insert();

-- Allow workers to update table status (libre/ocupada)
CREATE POLICY "Workers can update table status"
  ON public.tables
  FOR UPDATE
  USING (true)
  WITH CHECK (true);
