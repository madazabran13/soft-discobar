REVOKE ALL ON public.payment_methods FROM anon;
REVOKE ALL ON public.payments FROM anon;
REVOKE EXECUTE ON FUNCTION public.register_payment(uuid, uuid, numeric, numeric, text) FROM anon;