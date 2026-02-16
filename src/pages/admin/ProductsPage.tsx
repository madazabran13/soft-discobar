import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Edit, Package } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock_quantity: number;
  category: string;
  is_active: boolean;
}

const ProductsPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: '', description: '', price: '', stock_quantity: '', category: 'General' });

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('name');
    if (data) setProducts(data as Product[]);
  };

  useEffect(() => { fetchProducts(); }, []);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nombre requerido'); return; }
    const payload = {
      name: form.name,
      description: form.description,
      price: parseFloat(form.price) || 0,
      stock_quantity: parseInt(form.stock_quantity) || 0,
      category: form.category,
    };

    if (editProduct) {
      const { error } = await supabase.from('products').update(payload).eq('id', editProduct.id);
      if (error) toast.error(error.message); else { toast.success('Producto actualizado'); fetchProducts(); }
    } else {
      const { error } = await supabase.from('products').insert(payload);
      if (error) toast.error(error.message); else { toast.success('Producto creado'); fetchProducts(); }
    }
    closeDialog();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Producto eliminado'); fetchProducts(); }
  };

  const closeDialog = () => {
    setOpen(false);
    setEditProduct(null);
    setForm({ name: '', description: '', price: '', stock_quantity: '', category: 'General' });
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setForm({ name: p.name, description: p.description || '', price: String(p.price), stock_quantity: String(p.stock_quantity), category: p.category || 'General' });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Productos</h1>
        <Dialog open={open} onOpenChange={(o) => { if (!o) closeDialog(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary gap-2"><Plus className="h-4 w-4" /> Nuevo Producto</Button>
          </DialogTrigger>
          <DialogContent className="glass">
            <DialogHeader><DialogTitle>{editProduct ? 'Editar' : 'Nuevo'} Producto</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nombre</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="bg-secondary/50" /></div>
              <div><Label>Descripción</Label><Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="bg-secondary/50" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Precio</Label><Input type="number" step="0.01" value={form.price} onChange={e => setForm({...form, price: e.target.value})} className="bg-secondary/50" /></div>
                <div><Label>Stock</Label><Input type="number" value={form.stock_quantity} onChange={e => setForm({...form, stock_quantity: e.target.value})} className="bg-secondary/50" /></div>
              </div>
              <div><Label>Categoría</Label><Input value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="bg-secondary/50" /></div>
              <Button onClick={handleSave} className="w-full gradient-primary">Guardar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="glass overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Producto</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id} className="border-border">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <Package className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.description}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{p.category}</Badge></TableCell>
                  <TableCell className="text-right font-medium">${p.price.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <Badge className={p.stock_quantity > 10 ? 'bg-success/20 text-success' : p.stock_quantity > 0 ? 'bg-warning/20 text-warning' : 'bg-destructive/20 text-destructive'}>
                      {p.stock_quantity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Edit className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="h-3 w-3" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {products.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No hay productos</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductsPage;
