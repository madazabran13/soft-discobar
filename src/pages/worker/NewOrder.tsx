import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Plus, Minus, Trash2, ShoppingCart, Loader2, Search, Package, ChevronDown, ChevronUp } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  category: string;
  image_url: string | null;
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
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(true);

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
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const handleSubmit = async () => {
    if (!tableId || !user) return;
    if (!clientName.trim()) { toast.error('Ingresa nombre del cliente'); return; }
    if (cart.length === 0) { toast.error('Agrega productos al pedido'); return; }

    setSubmitting(true);
    try {
      if (existingOrder) {
        const details = cart.map(i => ({
          order_id: existingOrder.id,
          product_id: i.product.id,
          quantity: i.quantity,
          unit_price: i.product.price,
          subtotal: i.product.price * i.quantity,
        }));
        const { error: detErr } = await supabase.from('order_details').insert(details);
        if (detErr) throw detErr;

        const newTotal = total + existingDetails.reduce((s, d) => s + d.subtotal, 0);
        const { error: updErr } = await supabase.from('orders').update({
          total_amount: newTotal,
        }).eq('id', existingOrder.id);
        if (updErr) throw updErr;

        for (const item of cart) {
          await supabase.from('products').update({
            stock_quantity: item.product.stock_quantity - item.quantity,
          }).eq('id', item.product.id);
        }

        toast.success('¡Productos agregados al pedido!');
      } else {
        const { data: order, error: orderErr } = await supabase.from('orders').insert({
          table_id: tableId,
          worker_id: user.id,
          client_name: clientName.trim(),
          status: 'pendiente',
          total_amount: total,
        }).select().single();

        if (orderErr) throw orderErr;

        const details = cart.map(i => ({
          order_id: order.id,
          product_id: i.product.id,
          quantity: i.quantity,
          unit_price: i.product.price,
          subtotal: i.product.price * i.quantity,
        }));
        const { error: detErr } = await supabase.from('order_details').insert(details);
        if (detErr) throw detErr;

        const { error: statusErr } = await supabase.from('orders').update({ status: 'confirmado' }).eq('id', order.id);
        if (statusErr) throw statusErr;

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

  const filtered = useMemo(() => products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category && p.category.toLowerCase().includes(search.toLowerCase()))
  ), [products, search]);

  const categories = useMemo(() => [...new Set(filtered.map(p => p.category).filter(Boolean))], [filtered]);

  const displayedProducts = useMemo(() => {
    if (activeCategory) return filtered.filter(p => p.category === activeCategory);
    return filtered;
  }, [filtered, activeCategory]);

  const getCartQty = (productId: string) => {
    const item = cart.find(i => i.product.id === productId);
    return item?.quantity || 0;
  };

  if (!tableId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Package className="h-12 w-12 text-muted-foreground mb-4" />
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
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="shrink-0 space-y-3 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold neon-text">
              Mesa #{tableNum}
            </h1>
            <p className="text-xs text-muted-foreground">
              {existingOrder ? 'Agregar productos al pedido' : 'Nuevo pedido'}
            </p>
          </div>
          {cart.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="relative neon-border"
              onClick={() => setCartOpen(!cartOpen)}
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="ml-1.5 font-bold">${total.toFixed(2)}</span>
              <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full gradient-primary text-[10px] font-bold text-primary-foreground">
                {cartCount}
              </span>
            </Button>
          )}
        </div>

        {!existingOrder && (
          <div>
            <Label className="text-xs">Cliente</Label>
            <Input
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              placeholder="Nombre del cliente"
              className="bg-secondary/50 h-9 text-sm"
            />
          </div>
        )}
        {existingOrder && (
          <p className="text-sm text-muted-foreground">Cliente: <span className="text-foreground font-medium">{clientName}</span></p>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar producto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-secondary/50 h-9 text-sm"
          />
        </div>

        {/* Category pills */}
        <ScrollArea className="w-full">
          <div className="flex gap-2 pb-1">
            <Button
              size="sm"
              variant={activeCategory === null ? 'default' : 'outline'}
              className={`shrink-0 h-7 text-xs px-3 rounded-full ${activeCategory === null ? 'gradient-primary' : ''}`}
              onClick={() => setActiveCategory(null)}
            >
              Todos
            </Button>
            {categories.map(cat => (
              <Button
                key={cat}
                size="sm"
                variant={activeCategory === cat ? 'default' : 'outline'}
                className={`shrink-0 h-7 text-xs px-3 rounded-full ${activeCategory === cat ? 'gradient-primary' : ''}`}
                onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Existing order summary */}
      {existingDetails.length > 0 && (
        <div className="shrink-0 mb-3 rounded-lg bg-secondary/30 border border-border/50 p-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">Productos anteriores</p>
          <div className="flex flex-wrap gap-1">
            {existingDetails.map((d, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {d.product?.name} x{d.quantity}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-right mt-1 font-medium text-primary">
            Subtotal: ${existingDetails.reduce((s, d) => s + d.subtotal, 0).toFixed(2)}
          </p>
        </div>
      )}

      {/* Product grid */}
      <ScrollArea className="flex-1 -mx-4 px-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pb-4">
          {displayedProducts.map(p => {
            const inCart = getCartQty(p.id);
            return (
              <Card
                key={p.id}
                className={`glass cursor-pointer transition-all active:scale-[0.97] ${inCart > 0 ? 'neon-border' : 'hover:border-primary/30'}`}
                onClick={() => addToCart(p)}
              >
                <CardContent className="p-3 flex flex-col gap-1 relative">
                  {inCart > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full gradient-primary text-[10px] font-bold text-primary-foreground z-10">
                      {inCart}
                    </span>
                  )}
                  <p className="font-medium text-sm leading-tight line-clamp-2">{p.name}</p>
                  <div className="flex items-end justify-between mt-auto pt-1">
                    <span className="text-lg font-bold text-primary">${p.price.toFixed(2)}</span>
                    <span className="text-[10px] text-muted-foreground">Stock: {p.stock_quantity}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        {displayedProducts.length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm">
            No se encontraron productos
          </div>
        )}
      </ScrollArea>

      {/* Cart panel */}
      {cart.length > 0 && (
        <div className={`shrink-0 border-t border-border bg-card/80 backdrop-blur-xl -mx-4 px-4 pt-3 pb-2 transition-all ${cartOpen ? '' : ''}`}>
          <button
            onClick={() => setCartOpen(!cartOpen)}
            className="flex items-center justify-between w-full text-sm font-medium mb-2"
          >
            <span className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              {cart.length} producto{cart.length > 1 ? 's' : ''} nuevo{cart.length > 1 ? 's' : ''}
            </span>
            {cartOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>

          {cartOpen && (
            <div className="space-y-1.5 max-h-36 overflow-y-auto mb-2">
              {cart.map(i => (
                <div key={i.product.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate text-xs">{i.product.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="outline" className="h-6 w-6 rounded-full" onClick={(e) => { e.stopPropagation(); updateQty(i.product.id, -1); }}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-5 text-center text-xs font-bold">{i.quantity}</span>
                    <Button size="icon" variant="outline" className="h-6 w-6 rounded-full" onClick={(e) => { e.stopPropagation(); updateQty(i.product.id, 1); }}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <span className="w-14 text-right text-xs font-medium">${(i.product.price * i.quantity).toFixed(2)}</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive shrink-0" onClick={(e) => { e.stopPropagation(); removeFromCart(i.product.id); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Button onClick={handleSubmit} className="w-full gradient-primary h-10" disabled={submitting}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                {existingOrder ? 'Agregar al Pedido' : 'Confirmar Pedido'} — ${total.toFixed(2)}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default NewOrder;
