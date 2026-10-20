-- Medios de pago configurables por negocio
CREATE TABLE public.payment_methods (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL DEFAULT public.get_my_tenant_id() REFERENCES public.tenants(id),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.payment_methods AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id() OR public.is_superadmin())
  WITH CHECK (tenant_id = public.get_my_tenant_id() OR public.is_superadmin());
CREATE POLICY "Members read payment methods" ON public.payment_methods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage payment methods" ON public.payment_methods FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Semilla de medios de pago para todos los negocios existentes
INSERT INTO public.payment_methods (tenant_id, name, sort_order)
SELECT t.id, m.name, m.sort_order
FROM public.tenants t
CROSS JOIN (VALUES ('Efectivo',1),('Transferencia',2),('Nequi',3),('Daviplata',4),('Tarjeta',5)) AS m(name, sort_order)
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Pagos parciales / mixtos por pedido
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL DEFAULT public.get_my_tenant_id() REFERENCES public.tenants(id),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  payment_method_id uuid NOT NULL REFERENCES public.payment_methods(id),
  amount numeric NOT NULL DEFAULT 0,
  received_amount numeric,
  change_amount numeric NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id),
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX payments_idempotency_key_uidx ON public.payments (idempotency_key) WHERE idempotency_key IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.payments AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id() OR public.is_superadmin())
  WITH CHECK (tenant_id = public.get_my_tenant_id() OR public.is_superadmin());
CREATE POLICY "Admins manage payments" ON public.payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Workers read own order payments" ON public.payments FOR SELECT TO authenticated
  USING (order_id IN (SELECT id FROM public.orders WHERE worker_id = auth.uid()));
CREATE POLICY "Workers insert own order payments" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (order_id IN (SELECT id FROM public.orders WHERE worker_id = auth.uid()));

-- Registrar pago: valida, evita duplicados y salda el pedido
CREATE OR REPLACE FUNCTION public.register_payment(
  p_order_id uuid,
  p_payment_method_id uuid,
  p_amount numeric,
  p_received_amount numeric DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_method public.payment_methods%ROWTYPE;
  v_paid numeric;
  v_total numeric;
  v_change numeric := 0;
  v_payment_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'El monto del pago debe ser mayor a cero';
  END IF;

  -- Idempotencia: si la clave ya existe, devolver el estado actual sin duplicar
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_payment_id FROM public.payments WHERE idempotency_key = p_idempotency_key;
    IF v_payment_id IS NOT NULL THEN
      SELECT COALESCE(SUM(amount),0) INTO v_paid FROM public.payments WHERE order_id = p_order_id;
      SELECT total_amount INTO v_total FROM public.orders WHERE id = p_order_id;
      RETURN jsonb_build_object('duplicated', true, 'paid', v_paid, 'total', v_total, 'remaining', GREATEST(v_total - v_paid, 0));
    END IF;
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido no encontrado'; END IF;
  IF v_order.tenant_id IS DISTINCT FROM public.get_my_tenant_id() AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Pedido de otro negocio';
  END IF;
  IF v_order.status NOT IN ('confirmado','pendiente') THEN
    RAISE EXCEPTION 'El pedido no está disponible para cobro (estado: %)', v_order.status;
  END IF;
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) AND v_order.worker_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Solo puedes cobrar tus propios pedidos';
  END IF;

  SELECT * INTO v_method FROM public.payment_methods WHERE id = p_payment_method_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Medio de pago no válido o inactivo'; END IF;

  SELECT COALESCE(SUM(amount),0) INTO v_paid FROM public.payments WHERE order_id = p_order_id;
  v_total := v_order.total_amount;
  IF v_paid + p_amount > v_total + 0.009 THEN
    RAISE EXCEPTION 'El pago excede el saldo pendiente (%). Pendiente: %', v_total, v_total - v_paid;
  END IF;

  -- Cambio en efectivo
  IF v_method.name = 'Efectivo' AND p_received_amount IS NOT NULL AND p_received_amount > p_amount THEN
    v_change := p_received_amount - p_amount;
  END IF;

  INSERT INTO public.payments (tenant_id, order_id, payment_method_id, amount, received_amount, change_amount, created_by, idempotency_key)
  VALUES (v_order.tenant_id, p_order_id, p_payment_method_id, p_amount, p_received_amount, v_change, auth.uid(), p_idempotency_key)
  RETURNING id INTO v_payment_id;

  v_paid := v_paid + p_amount;

  -- Si quedó saldado: facturar, registrar venta y liberar mesa
  IF v_paid >= v_total - 0.009 THEN
    UPDATE public.orders SET status = 'facturado' WHERE id = p_order_id;
    UPDATE public.tables SET status = 'libre' WHERE id = v_order.table_id;
    IF NOT EXISTS (SELECT 1 FROM public.sales WHERE order_id = p_order_id) THEN
      INSERT INTO public.sales (tenant_id, order_id, amount, payment_method, processed_by)
      VALUES (v_order.tenant_id, p_order_id, v_total,
        CASE lower(v_method.name)
          WHEN 'efectivo' THEN 'efectivo'::payment_method
          WHEN 'tarjeta' THEN 'tarjeta'::payment_method
          ELSE 'transferencia'::payment_method
        END,
        auth.uid());
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'duplicated', false,
    'payment_id', v_payment_id,
    'paid', v_paid,
    'total', v_total,
    'remaining', GREATEST(v_total - v_paid, 0),
    'change', v_change,
    'settled', v_paid >= v_total - 0.009
  );
END;
$function$;
GRANT EXECUTE ON FUNCTION public.register_payment(uuid, uuid, numeric, numeric, text) TO authenticated;