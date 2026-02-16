import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Eye, CreditCard } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

interface Order {
  id: string;
  client_name: string;
  status: string;
  total_amount: number;
  created_at: string;
  table_id: string;
  worker_id: string;
  tables?: { number: number; name: string };
  profiles?: { full_name: string };
}

interface OrderDetail {
  id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  products?: { name: string };
}

const statusColors: Record<string, string> = {
  pendiente: 'bg-warning/20 text-warning',
  confirmado: 'bg-primary/20 text-primary',
  facturado: 'bg-success/20 text-success',
  cancelado: 'bg-destructive/20 text-destructive',
};

const OrdersPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [details, setDetails] = useState<OrderDetail[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [billingOrder, setBillingOrder] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('efectivo');
  const { user } = useAuthStore();

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, tables(number, name), profiles!orders_worker_id_fkey(full_name)')
      .order('created_at', { ascending: false });
    if (data) setOrders(data as any);
  };

  useEffect(() => {
    fetchOrders();
    const ch = supabase.channel('orders-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const viewDetails = async (order: Order) => {
    setSelectedOrder(order);
    const { data } = await supabase.from('order_details').select('*, products(name)').eq('order_id', order.id);
    if (data) setDetails(data as any);
  };

  const handleBill = async () => {
    if (!billingOrder || !user) return;

    // Create sale
    const { error: saleErr } = await supabase.from('sales').insert({
      order_id: billingOrder.id,
      amount: billingOrder.total_amount,
      payment_method: paymentMethod as any,
      processed_by: user.id,
    });
    if (saleErr) { toast.error(saleErr.message); return; }

    // Update order status
    await supabase.from('orders').update({ status: 'facturado' }).eq('id', billingOrder.id);

    // Free the table
    await supabase.from('tables').update({ status: 'libre' }).eq('id', billingOrder.table_id);

    toast.success('Pedido facturado exitosamente');
    setBillingOrder(null);
    fetchOrders();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Pedidos</h1>

      <Card className="glass overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Mesa</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Trabajador</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id} className="border-border">
                  <TableCell>#{o.tables?.number}</TableCell>
                  <TableCell>{o.client_name}</TableCell>
                  <TableCell>{o.profiles?.full_name || '—'}</TableCell>
                  <TableCell><Badge className={statusColors[o.status]}>{o.status}</Badge></TableCell>
                  <TableCell className="text-right font-medium">${Number(o.total_amount).toFixed(2)}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => viewDetails(o)}><Eye className="h-3 w-3" /></Button>
                    {o.status === 'confirmado' && (
                      <Button size="sm" variant="ghost" className="text-success" onClick={() => setBillingOrder(o)}><CreditCard className="h-3 w-3" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No hay pedidos</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Order detail dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="glass">
          <DialogHeader><DialogTitle>Detalle del Pedido</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Cliente: <span className="text-foreground">{selectedOrder?.client_name}</span></p>
            <Table>
              <TableHeader><TableRow className="border-border"><TableHead>Producto</TableHead><TableHead className="text-right">Cant.</TableHead><TableHead className="text-right">Precio</TableHead><TableHead className="text-right">Subtotal</TableHead></TableRow></TableHeader>
              <TableBody>
                {details.map(d => (
                  <TableRow key={d.id} className="border-border">
                    <TableCell>{d.products?.name}</TableCell>
                    <TableCell className="text-right">{d.quantity}</TableCell>
                    <TableCell className="text-right">${Number(d.unit_price).toFixed(2)}</TableCell>
                    <TableCell className="text-right">${Number(d.subtotal).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-right text-lg font-bold">Total: ${Number(selectedOrder?.total_amount || 0).toFixed(2)}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Billing dialog */}
      <Dialog open={!!billingOrder} onOpenChange={() => setBillingOrder(null)}>
        <DialogContent className="glass">
          <DialogHeader><DialogTitle>Facturar Pedido</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p>Mesa <strong>#{billingOrder?.tables?.number}</strong> — {billingOrder?.client_name}</p>
            <p className="text-2xl font-bold">Total: ${Number(billingOrder?.total_amount || 0).toFixed(2)}</p>
            <div>
              <p className="text-sm font-medium mb-2">Método de Pago</p>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleBill} className="w-full gradient-primary">Confirmar Facturación</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrdersPage;
