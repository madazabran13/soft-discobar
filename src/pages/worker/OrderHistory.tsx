import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Order {
  id: string;
  client_name: string;
  status: string;
  total_amount: number;
  created_at: string;
  tables?: { number: number };
}

const statusColors: Record<string, string> = {
  pendiente: 'bg-warning/20 text-warning',
  confirmado: 'bg-primary/20 text-primary',
  facturado: 'bg-success/20 text-success',
  cancelado: 'bg-destructive/20 text-destructive',
};

const OrderHistory = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('orders')
        .select('*, tables(number)')
        .eq('worker_id', user.id)
        .order('created_at', { ascending: false });
      if (data) setOrders(data as any);
    };
    fetch();
  }, [user]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Mis Pedidos</h1>
      {orders.map((o) => (
        <Card key={o.id} className="glass">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">Mesa #{o.tables?.number} — {o.client_name}</p>
              <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString('es')}</p>
            </div>
            <div className="text-right">
              <p className="font-bold">${Number(o.total_amount).toFixed(2)}</p>
              <Badge className={statusColors[o.status]}>{o.status}</Badge>
            </div>
          </CardContent>
        </Card>
      ))}
      {orders.length === 0 && <p className="text-center text-muted-foreground py-10">No hay pedidos aún</p>}
    </div>
  );
};

export default OrderHistory;
