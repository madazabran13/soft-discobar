
CREATE OR REPLACE FUNCTION public.restore_inventory_on_cancel()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'cancelado' AND OLD.status IN ('pendiente', 'confirmado') THEN
    -- Only restore stock if it was previously deducted (confirmado)
    IF OLD.status = 'confirmado' THEN
      UPDATE public.products p
      SET stock_quantity = p.stock_quantity + od.quantity
      FROM public.order_details od
      WHERE od.order_id = NEW.id AND od.product_id = p.id;

      INSERT INTO public.inventory_movements (product_id, quantity_change, reason, created_by)
      SELECT od.product_id, od.quantity, 'Cancelación pedido ' || NEW.id::TEXT, NEW.worker_id
      FROM public.order_details od
      WHERE od.order_id = NEW.id;
    END IF;

    -- Free the table
    UPDATE public.tables SET status = 'libre' WHERE id = NEW.table_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_restore_inventory_on_cancel
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.restore_inventory_on_cancel();
