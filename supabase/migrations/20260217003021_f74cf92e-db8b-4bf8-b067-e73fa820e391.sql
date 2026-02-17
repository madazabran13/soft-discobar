-- Remove duplicate AFTER UPDATE trigger (keeping only the BEFORE UPDATE one)
DROP TRIGGER IF EXISTS on_order_confirmed ON public.orders;