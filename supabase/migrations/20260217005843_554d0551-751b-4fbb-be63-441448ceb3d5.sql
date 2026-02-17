
CREATE OR REPLACE FUNCTION public.deduct_stock_for_addition(
  p_order_id UUID,
  p_items JSONB,
  p_worker_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item JSONB;
  current_stock INT;
  requested_qty INT;
  product_name TEXT;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    requested_qty := (item->>'quantity')::INT;

    -- Get current stock and name
    SELECT stock_quantity, name INTO current_stock, product_name
    FROM public.products
    WHERE id = (item->>'product_id')::UUID;

    -- Validate sufficient stock
    IF current_stock < requested_qty THEN
      RAISE EXCEPTION 'Stock insuficiente para "%". Disponible: %, solicitado: %', product_name, current_stock, requested_qty;
    END IF;

    -- Deduct stock
    UPDATE public.products
    SET stock_quantity = stock_quantity - requested_qty
    WHERE id = (item->>'product_id')::UUID;

    -- Record inventory movement
    INSERT INTO public.inventory_movements (product_id, quantity_change, reason, created_by)
    VALUES (
      (item->>'product_id')::UUID,
      -requested_qty,
      'Pedido ' || p_order_id::TEXT || ' (adición)',
      p_worker_id
    );
  END LOOP;
END;
$$;
