import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type TableRow = {
  id: string;
  number: number;
  name: string;
  capacity: number;
  status: 'libre' | 'ocupada' | 'facturacion';
};

type ActiveOrder = {
  table_id: string;
  worker_id: string;
  client_name: string;
};

const statusColors: Record<string, string> = {
  libre: 'bg-success/20 text-success border-success/30',
  ocupada: 'bg-destructive/20 text-destructive border-destructive/30',
  facturacion: 'bg-warning/20 text-warning border-warning/30',
};

const WorkerTables = () => {
  const [tables, setTables] = useState<TableRow[]>([]);
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const fetchData = async () => {
    const [tablesRes, ordersRes] = await Promise.all([
      supabase.from('tables').select('*').order('number'),
      supabase.from('orders').select('table_id, worker_id, client_name').in('status', ['confirmado', 'pendiente']),
    ]);
    if (tablesRes.data) setTables(tablesRes.data as TableRow[]);
    if (ordersRes.data) setActiveOrders(ordersRes.data as ActiveOrder[]);
  };

  useEffect(() => {
    fetchData();
    const ch = supabase.channel('worker-tables')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const getActiveOrder = (tableId: string) => activeOrders.find(o => o.table_id === tableId);

  // Filter: show free tables to all, occupied only to the worker who owns it
  const visibleTables = tables.filter(t => {
    if (t.status === 'libre') return true;
    if (t.status === 'ocupada') {
      const order = getActiveOrder(t.id);
      return order?.worker_id === user?.id;
    }
    // facturacion tables - show to owner only
    const order = getActiveOrder(t.id);
    return order?.worker_id === user?.id;
  });

  const handleTableClick = (t: TableRow) => {
    if (t.status === 'libre') {
      navigate(`/worker/pedido?table=${t.id}&tableNum=${t.number}`);
    } else if (t.status === 'ocupada') {
      const order = getActiveOrder(t.id);
      if (order?.worker_id === user?.id) {
        navigate(`/worker/pedido?table=${t.id}&tableNum=${t.number}`);
      }
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Mesas</h1>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        {visibleTables.map((t) => {
          const order = getActiveOrder(t.id);
          const isClickable = t.status === 'libre' || (t.status === 'ocupada' && order?.worker_id === user?.id);
          return (
            <Card
              key={t.id}
              className={cn("glass transition-transform", isClickable && 'cursor-pointer active:scale-95 hover:neon-border')}
              onClick={() => isClickable && handleTableClick(t)}
            >
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">#{t.number}</p>
                <p className="text-xs text-muted-foreground mb-1">{t.name || `Mesa ${t.number}`}</p>
                {order && t.status === 'ocupada' && (
                  <p className="text-xs text-primary truncate mb-1">{order.client_name}</p>
                )}
                <Badge className={cn('capitalize text-xs', statusColors[t.status])}>{t.status}</Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default WorkerTables;
