import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Minus, Trash2, ShoppingCart, Loader2 } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  category: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface ExistingOrderDetail {
  quantity: number;
  unit_price: number;
  subtotal: number;
  product: { id: string; name: string; price: number };
}

const NewOrder = () => {
  const [searchParams] = useSearchParams();
  const tableId = searchParams.get('table');
  const tableNum = searchParams.get('tableNum');
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [clientName, setClientName] = useState('');
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [existingOrder, setExistingOrder] = useState<{ id: string; client_name: string } | null>(null);
  const [existingDetails, setExistingDetails] = useState<ExistingOrderDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      if (!tableId) { setLoading(false); return; }

      const [productsRes, orderRes] = await Promise.all([
        supabase.from('products').select('*').eq('is_active', true).gt('stock_quantity', 0),
        supabase.from('orders').select('id, client_name').eq('table_id', tableId).in('status', ['confirmado', 'pendiente']).maybeSingle(),
      ]);

      if (productsRes.data) setProducts(productsRes.data as Product[]);

      if (orderRes.data) {
        setExistingOrder(orderRes.data);
        setClientName(orderRes.data.client_name);

        // Fetch existing order details
        const { data: details } = await supabase
          .from('order_details')
          .select('quantity, unit_price, subtotal, product:products(id, name, price)')
          .eq('order_id', orderRes.data.id);

        if (details) setExistingDetails(details as unknown as ExistingOrderDetail[]);
      }

      setLoading(false);
    };
    init();
  }, [tableId]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) { toast.error('Sin stock suficiente'); return prev; }
        return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.product.id !== productId) return i;
      const newQty = i.quantity + delta;
      if (newQty <= 0) return i;
      if (newQty > i.product.stock_quantity) { toast.error('Sin stock'); return i; }
      return { ...i, quantity: newQty };
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  };

  const total = cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  const handleSubmit = async () => {
    if (!tableId || !user) return;
    if (!clientName.trim()) { toast.error('Ingresa nombre del cliente'); return; }
    if (cart.length === 0) { toast.error('Agrega productos al pedido'); return; }

    setSubmitting(true);
    try {
      if (existingOrder) {
        // Add items to existing order
        const details = cart.map(i => ({
          order_id: existingOrder.id,
          product_id: i.product.id,
          quantity: i.quantity,
          unit_price: i.product.price,
          subtotal: i.product.price * i.quantity,
        }));
        const { error: detErr } = await supabase.from('order_details').insert(details);
        if (detErr) throw detErr;

        // Update order total
        const newTotal = total + existingDetails.reduce((s, d) => s + d.subtotal, 0);
        const { error: updErr } = await supabase.from('orders').update({
          total_amount: newTotal,
          // Temporarily set to pendiente then back to confirmado to trigger stock deduction
        }).eq('id', existingOrder.id);
        if (updErr) throw updErr;

        // Manually deduct stock for new items (since trigger only fires on pendiente→confirmado)
        for (const item of cart) {
          await supabase.from('products').update({
            stock_quantity: item.product.stock_quantity - item.quantity,
          }).eq('id', item.product.id);
        }

        toast.success('¡Productos agregados al pedido!');
      } else {
        // Create new order as 'pendiente' first
        const { data: order, error: orderErr } = await supabase.from('orders').insert({
          table_id: tableId,
          worker_id: user.id,
          client_name: clientName.trim(),
          status: 'pendiente',
          total_amount: total,
        }).select().single();

        if (orderErr) throw orderErr;

        // Create order details
        const details = cart.map(i => ({
          order_id: order.id,
          product_id: i.product.id,
          quantity: i.quantity,
          unit_price: i.product.price,
          subtotal: i.product.price * i.quantity,
        }));
        const { error: detErr } = await supabase.from('order_details').insert(details);
        if (detErr) throw detErr;

        // Update to 'confirmado' to trigger stock deduction via DB trigger
        const { error: statusErr } = await supabase.from('orders').update({ status: 'confirmado' }).eq('id', order.id);
        if (statusErr) throw statusErr;

        // Mark table as occupied
        await supabase.from('tables').update({ status: 'ocupada' }).eq('id', tableId);

        toast.success('¡Pedido confirmado!');
      }

      navigate('/worker');
    } catch (err: any) {
      toast.error(err.message || 'Error al crear pedido');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category && p.category.toLowerCase().includes(search.toLowerCase()))
  );

  const categories = [...new Set(filtered.map(p => p.category).filter(Boolean))];

  if (!tableId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground mb-4">Selecciona una mesa libre primero</p>
        <Button onClick={() => navigate('/worker')} className="gradient-primary">Ir a Mesas</Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          {existingOrder ? 'Agregar a Pedido' : 'Nuevo Pedido'} — Mesa #{tableNum}
        </h1>
      </div>

      <div>
        <Label>Cliente</Label>
        <Input
          value={clientName}
          onChange={e => setClientName(e.target.value)}
          placeholder="Nombre del cliente"
          className="bg-secondary/50"
          disabled={!!existingOrder}
        />
      </div>

      {/* Existing order details */}
      {existingDetails.length > 0 && (
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Productos anteriores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {existingDetails.map((d, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="flex-1 truncate">{d.product?.name}</span>
                <span className="text-muted-foreground mr-2">x{d.quantity}</span>
                <span className="font-medium">${d.subtotal.toFixed(2)}</span>
              </div>
            ))}
            <div className="border-t border-border pt-1 flex justify-between text-sm font-bold">
              <span>Subtotal anterior</span>
              <span className="text-primary">${existingDetails.reduce((s, d) => s + d.subtotal, 0).toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Input placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} className="bg-secondary/50" />

      {categories.map(cat => (
        <div key={cat}>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">{cat}</h3>
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
            {filtered.filter(p => p.category === cat).map(p => (
              <Card key={p.id} className="glass cursor-pointer hover:neon-border transition-all" onClick={() => addToCart(p)}>
                <CardContent className="flex items-center justify-between p-3">
                  <div>
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-muted-foreground">Stock: {p.stock_quantity}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">${p.price.toFixed(2)}</p>
                    <Plus className="h-4 w-4 text-muted-foreground ml-auto" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {/* Cart */}
      {cart.length > 0 && (
        <Card className="glass neon-border fixed bottom-16 left-4 right-4 z-30 sm:relative sm:bottom-auto sm:left-auto sm:right-auto">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="h-4 w-4" /> Nuevo pedido ({cart.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {cart.map(i => (
              <div key={i.product.id} className="flex items-center justify-between text-sm">
                <span className="flex-1 truncate">{i.product.name}</span>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateQty(i.product.id, -1)}><Minus className="h-3 w-3" /></Button>
                  <span className="w-6 text-center">{i.quantity}</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateQty(i.product.id, 1)}><Plus className="h-3 w-3" /></Button>
                  <span className="w-16 text-right">${(i.product.price * i.quantity).toFixed(2)}</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeFromCart(i.product.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-border pt-2">
              <span className="font-bold">Total nuevos</span>
              <span className="text-lg font-bold text-primary">${total.toFixed(2)}</span>
            </div>
            <Button onClick={handleSubmit} className="w-full gradient-primary" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : existingOrder ? 'Agregar al Pedido' : 'Confirmar Pedido'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NewOrder;
