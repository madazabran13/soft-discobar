import { useEffect, useState } from 'react';
import { formatCOP } from '@/lib/formatCurrency';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Eye, XCircle } from 'lucide-react';
import OrderHistoryFilters from '@/components/OrderHistoryFilters';
import OrderPaymentHistory from '@/components/OrderPaymentHistory';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { emptyHistoryFilters, matchesHistoryFilters, paymentSummary, paymentStatusLabels, type HistoryPayment } from '@/lib/orderHistory';

interface Order {
  id: string;
  client_name: string;
  status: string;
  total_amount: number;
  created_at: string;
  worker_id: string;
  payments?: HistoryPayment[];
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
  const { user, profile } = useAuthStore();
  const [filters, setFilters] = useState({ ...emptyHistoryFilters });
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const fetchOrders = async () => {
    if (!user) return;
    const { data, error } = await (supabase as any)
      .from('orders')
      .select('*, tables(number), payments(id, amount, received_amount, change_amount, created_at, payment_method_id, payment_methods(name))')
      .eq('worker_id', user.id)
      .order('created_at', { ascending: false });
    setLoading(false);
    setLoadError(!!error);
    if (error) { toast.error('No se pudo cargar el historial de pedidos'); return; }
    if (data) setOrders(data as any);
  };

  useEffect(() => {
    fetchOrders();
    const channel = supabase.channel('worker-history')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => fetchOrders()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const methods = Array.from(new Map(orders.flatMap(o => (o.payments || []).map(p => [p.payment_method_id, { id: p.payment_method_id, name: p.payment_methods?.name || 'Medio no disponible' }] as const))).values());
  const filtered = orders.filter(o => matchesHistoryFilters(o, filters));

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
      <OrderHistoryFilters value={filters} onChange={setFilters} workers={user ? [{ id: user.id, name: profile?.full_name || 'Mis pedidos' }] : []} methods={methods} />
      <p className="text-sm text-muted-foreground">{filtered.length} pedidos encontrados</p>
      {loadError && <div role="alert" className="flex items-center gap-3 text-destructive">No se pudo cargar el historial.<Button variant="outline" onClick={fetchOrders}>Reintentar</Button></div>}
      {filtered.map((o) => (
        <Card key={o.id} className="glass">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0 break-words">
              <p className="font-medium">Mesa #{o.tables?.number} — {o.client_name}</p>
              <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString('es')}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="font-bold">{formatCOP(Number(o.total_amount))}</p>
                <Badge className={statusColors[o.status]}>{o.status}</Badge>
                <p className="mt-1 text-xs text-muted-foreground">{paymentStatusLabels[paymentSummary(o).status]}</p>
              </div>
              <Button size="icon" variant="ghost" aria-label="Ver pagos del pedido" onClick={() => setSelectedOrder(o)}><Eye className="h-5 w-5" /></Button>
              {(o.status === 'pendiente' || o.status === 'confirmado') && (
                <Button size="icon" variant="ghost" className="text-destructive shrink-0" onClick={() => setCancelOrder(o)}>
                  <XCircle className="h-5 w-5" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
      {filtered.length === 0 && <p className="text-center text-muted-foreground py-10">{loading ? 'Cargando pedidos…' : loadError ? 'Historial no disponible' : 'No hay pedidos que coincidan con los filtros'}</p>}

      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="glass max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Pagos del pedido</DialogTitle></DialogHeader>
          {selectedOrder && <><p>Mesa #{selectedOrder.tables?.number} — {selectedOrder.client_name}</p><p className="font-semibold">Total: {formatCOP(Number(selectedOrder.total_amount))}</p><OrderPaymentHistory order={orders.find(o => o.id === selectedOrder.id) || selectedOrder} /></>}
        </DialogContent>
      </Dialog>

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
