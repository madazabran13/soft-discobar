import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';

export const useOrderNotifications = () => {
  const { role } = useAuthStore();
  const lowStockThreshold = useSettingsStore((s) => s.lowStockThreshold);

  useEffect(() => {
    if (!role) return;

    const channels: ReturnType<typeof supabase.channel>[] = [];

    // Admin-only: new order notifications
    if (role === 'admin') {
      const ordersChannel = supabase
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
      channels.push(ordersChannel);
    }

    // Both roles: stock low / out-of-stock notifications
    const stockChannel = supabase
      .channel('stock-notifications')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'products' },
        (payload) => {
          const product = payload.new as any;
          const oldProduct = payload.old as any;

          if (product.stock_quantity <= 0 && oldProduct.stock_quantity > 0) {
            toast.error(`🚫 Sin stock: ${product.name}`, {
              description: 'El producto se ha agotado completamente.',
              duration: 15000,
            });
          } else if (
            product.stock_quantity <= lowStockThreshold &&
            product.stock_quantity > 0 &&
            oldProduct.stock_quantity > lowStockThreshold
          ) {
            toast.warning(`⚠️ Stock bajo: ${product.name}`, {
              description: `Quedan solo ${product.stock_quantity} unidades.`,
              duration: 10000,
            });
          }
        }
      )
      .subscribe();
    channels.push(stockChannel);

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [role, lowStockThreshold]);
};
