import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/authStore';

export const useOrderNotifications = () => {
  const { role } = useAuthStore();

  useEffect(() => {
    if (role !== 'admin') return;

    const channel = supabase
      .channel('admin-order-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          const order = payload.new as any;
          toast.info('🆕 Nuevo pedido creado', {
            description: `Mesa asignada — Total: $${Number(order.total_amount).toFixed(2)}`,
            duration: 8000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [role]);
};
