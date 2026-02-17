
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
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Get current stock
    SELECT stock_quantity INTO current_stock
    FROM public.products
    WHERE id = (item->>'product_id')::UUID;

    -- Deduct stock
    UPDATE public.products
    SET stock_quantity = stock_quantity - (item->>'quantity')::INT
    WHERE id = (item->>'product_id')::UUID;

    -- Record inventory movement
    INSERT INTO public.inventory_movements (product_id, quantity_change, reason, created_by)
    VALUES (
      (item->>'product_id')::UUID,
      -(item->>'quantity')::INT,
      'Pedido ' || p_order_id::TEXT || ' (adición)',
      p_worker_id
    );
  END LOOP;
END;
$$;
