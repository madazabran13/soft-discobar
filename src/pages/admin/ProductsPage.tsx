import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Edit, Package, Search, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { SortableHeader, useSortableData } from '@/components/SortableHeader';
import { PaginationControls, usePagination } from '@/components/PaginationControls';
import { useSettingsStore } from '@/stores/settingsStore';
import { formatCOP } from '@/lib/formatCurrency';
import * as XLSX from 'xlsx';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock_quantity: number;
  category: string;
  category_id: string | null;
  is_active: boolean;
  categories?: { name: string } | null;
}

interface Category {
  id: string;
  name: string;
}

const ProductsPage = () => {
  const { user } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: '', description: '', price: '', stock_quantity: '', category_id: '' });
  const [search, setSearch] = useState('');
  const lowStockThreshold = useSettingsStore((s) => s.lowStockThreshold);

  const outOfStock = products.filter(p => p.stock_quantity <= 0);
  const lowStock = products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= lowStockThreshold);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*, categories(name)').order('name');
    if (data) setProducts(data as any);
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('id, name').order('name');
    if (data) setCategories(data);
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();

    const channel = supabase
      .channel('products-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchProducts();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.categories?.name || p.category || '').toLowerCase().includes(search.toLowerCase())
  );
  const { sorted, sort, toggleSort } = useSortableData(filtered);
  const { paged, currentPage, totalItems, pageSize, setCurrentPage } = usePagination(sorted);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nombre requerido'); return; }
    const catName = categories.find(c => c.id === form.category_id)?.name || 'General';
    const newStock = parseInt(form.stock_quantity) || 0;
    const payload = {
      name: form.name,
      description: form.description,
      price: parseFloat(form.price) || 0,
      stock_quantity: newStock,
      category: catName,
      category_id: form.category_id || null,
    };
    if (editProduct) {
      const { error } = await supabase.from('products').update(payload).eq('id', editProduct.id);
      if (error) { toast.error(error.message); return; }

      // Record stock change if different
      const diff = newStock - editProduct.stock_quantity;
      if (diff !== 0) {
        await supabase.from('inventory_movements').insert({
          product_id: editProduct.id,
          quantity_change: diff,
          reason: `Ajuste desde productos: ${diff > 0 ? 'aumento' : 'reducción'} de stock`,
          created_by: user?.id,
        });
      }
      toast.success('Producto actualizado');
      fetchProducts();
    } else {
      const { data: newProduct, error } = await supabase.from('products').insert(payload).select().single();
      if (error) { toast.error(error.message); return; }

      // Record initial stock as inventory entry
      if (newStock > 0 && newProduct) {
        await supabase.from('inventory_movements').insert({
          product_id: newProduct.id,
          quantity_change: newStock,
          reason: 'Stock inicial al crear producto',
          created_by: user?.id,
        });
      }
      toast.success('Producto creado');
      fetchProducts();
    }
    closeDialog();
  };

  const handleDelete = async (id: string) => {
    const product = products.find(p => p.id === id);
    if (product && product.stock_quantity > 0) {
      await supabase.from('inventory_movements').insert({
        product_id: id,
        quantity_change: -product.stock_quantity,
        reason: `Producto eliminado: ${product.name}`,
        created_by: user?.id,
      });
    }
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Producto eliminado'); fetchProducts(); }
  };

  const closeDialog = () => {
    setOpen(false);
    setEditProduct(null);
    setForm({ name: '', description: '', price: '', stock_quantity: '', category_id: '' });
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setForm({ name: p.name, description: p.description || '', price: String(p.price), stock_quantity: String(p.stock_quantity), category_id: p.category_id || '' });
    setOpen(true);
  };

  const exportInventoryExcel = () => {
    const getStatus = (qty: number) => qty <= 0 ? '🔴 Agotado' : qty <= lowStockThreshold ? '🟡 Stock bajo' : '🟢 Normal';
    const wsData = [
      ['Producto', 'Categoría', 'Precio', 'Stock', 'Estado'],
      ...sorted.map(p => [
        p.name,
        p.categories?.name || p.category,
        p.price,
        p.stock_quantity,
        getStatus(p.stock_quantity),
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
    XLSX.writeFile(wb, `inventario_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Stock Alert Banners */}
      {outOfStock.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <div>
            <p className="text-sm font-semibold text-destructive">Productos agotados ({outOfStock.length})</p>
            <p className="text-xs text-muted-foreground">{outOfStock.map(p => p.name).join(', ')}</p>
          </div>
        </div>
      )}
      {lowStock.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-warning/50 bg-warning/10 p-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
          <div>
            <p className="text-sm font-semibold text-warning">Stock bajo ({lowStock.length})</p>
            <p className="text-xs text-muted-foreground">{lowStock.map(p => `${p.name} (${p.stock_quantity})`).join(', ')}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Productos</h1>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={exportInventoryExcel}>
            <FileSpreadsheet className="h-4 w-4" /> Exportar
          </Button>
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
              <div>
                <Label>Categoría</Label>
                <Select value={form.category_id} onValueChange={v => setForm({...form, category_id: v})}>
                  <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSave} className="w-full gradient-primary">Guardar</Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/50" />
      </div>

      <Card className="glass overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <SortableHeader label="Producto" sortKey="name" currentSort={sort} onSort={toggleSort} />
                <SortableHeader label="Categoría" sortKey="category" currentSort={sort} onSort={toggleSort} />
                <SortableHeader label="Precio" sortKey="price" currentSort={sort} onSort={toggleSort} className="text-right" />
                <SortableHeader label="Stock" sortKey="stock_quantity" currentSort={sort} onSort={toggleSort} className="text-right" />
                <SortableHeader label="Acciones" sortKey="" currentSort={null} onSort={() => {}} className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((p) => (
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
                  <TableCell><Badge variant="outline">{p.categories?.name || p.category}</Badge></TableCell>
                  <TableCell className="text-right font-medium">{formatCOP(p.price)}</TableCell>
                  <TableCell className="text-right">
                    <Badge className={p.stock_quantity > lowStockThreshold ? 'bg-success/20 text-success' : p.stock_quantity > 0 ? 'bg-warning/20 text-warning' : 'bg-destructive/20 text-destructive'}>
                      {p.stock_quantity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Edit className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="h-3 w-3" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {paged.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No hay productos</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <PaginationControls currentPage={currentPage} totalItems={totalItems} pageSize={pageSize} onPageChange={setCurrentPage} />
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductsPage;
