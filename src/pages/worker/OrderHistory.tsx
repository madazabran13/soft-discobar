import { useEffect, useState } from 'react';
import { formatCOP } from '@/lib/formatCurrency';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { XCircle } from 'lucide-react';

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
  const [cancelOrder, setCancelOrder] = useState<Order | null>(null);
  const { user } = useAuthStore();

  const fetchOrders = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('orders')
      .select('*, tables(number)')
      .eq('worker_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setOrders(data as any);
  };

  useEffect(() => {
    fetchOrders();
  }, [user]);

  const confirmCancel = async () => {
    if (!cancelOrder) return;
    const { error } = await supabase.from('orders').update({ status: 'cancelado' }).eq('id', cancelOrder.id);
    if (error) { toast.error(error.message); setCancelOrder(null); return; }
    toast.success('Pedido cancelado' + (cancelOrder.status === 'confirmado' ? ' y stock devuelto' : ''));
    setCancelOrder(null);
    fetchOrders();
  };

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
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="font-bold">{formatCOP(Number(o.total_amount))}</p>
                <Badge className={statusColors[o.status]}>{o.status}</Badge>
              </div>
              {(o.status === 'pendiente' || o.status === 'confirmado') && (
                <Button size="icon" variant="ghost" className="text-destructive shrink-0" onClick={() => setCancelOrder(o)}>
                  <XCircle className="h-5 w-5" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
      {orders.length === 0 && <p className="text-center text-muted-foreground py-10">No hay pedidos aún</p>}

      <AlertDialog open={!!cancelOrder} onOpenChange={() => setCancelOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar este pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Mesa <strong>#{cancelOrder?.tables?.number}</strong> — {cancelOrder?.client_name}
              {cancelOrder?.status === 'confirmado' && '. El stock será devuelto automáticamente.'}
              {' '}Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, volver</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sí, cancelar pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OrderHistory;
