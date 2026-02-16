import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Edit, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

type TableRow = {
  id: string;
  number: number;
  name: string;
  capacity: number;
  status: 'libre' | 'ocupada' | 'facturacion';
};

const statusColors: Record<string, string> = {
  libre: 'bg-success/20 text-success border-success/30',
  ocupada: 'bg-destructive/20 text-destructive border-destructive/30',
  facturacion: 'bg-warning/20 text-warning border-warning/30',
};

const TablesPage = () => {
  const [tables, setTables] = useState<TableRow[]>([]);
  const [open, setOpen] = useState(false);
  const [editTable, setEditTable] = useState<TableRow | null>(null);
  const [form, setForm] = useState({ number: '', name: '', capacity: '4' });
  const [search, setSearch] = useState('');

  const fetchTables = async () => {
    const { data } = await supabase.from('tables').select('*').order('number');
    if (data) setTables(data as TableRow[]);
  };

  useEffect(() => {
    fetchTables();
    const channel = supabase.channel('tables-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => fetchTables()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = tables.filter(t =>
    String(t.number).includes(search) ||
    (t.name || '').toLowerCase().includes(search.toLowerCase()) ||
    t.status.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    const num = parseInt(form.number);
    const cap = parseInt(form.capacity);
    if (!num || !cap) { toast.error('Completa los campos'); return; }
    if (editTable) {
      const { error } = await supabase.from('tables').update({ number: num, name: form.name, capacity: cap }).eq('id', editTable.id);
      if (error) toast.error(error.message); else toast.success('Mesa actualizada');
    } else {
      const { error } = await supabase.from('tables').insert({ number: num, name: form.name, capacity: cap });
      if (error) toast.error(error.message); else toast.success('Mesa creada');
    }
    setOpen(false);
    setEditTable(null);
    setForm({ number: '', name: '', capacity: '4' });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('tables').delete().eq('id', id);
    if (error) toast.error(error.message); else toast.success('Mesa eliminada');
  };

  const openEdit = (t: TableRow) => {
    setEditTable(t);
    setForm({ number: String(t.number), name: t.name, capacity: String(t.capacity) });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mesas</h1>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditTable(null); setForm({ number: '', name: '', capacity: '4' }); } }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary gap-2"><Plus className="h-4 w-4" /> Nueva Mesa</Button>
          </DialogTrigger>
          <DialogContent className="glass">
            <DialogHeader><DialogTitle>{editTable ? 'Editar' : 'Nueva'} Mesa</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Número</Label><Input type="number" value={form.number} onChange={e => setForm({...form, number: e.target.value})} className="bg-secondary/50" /></div>
              <div><Label>Nombre</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="bg-secondary/50" placeholder="VIP, Terraza..." /></div>
              <div><Label>Capacidad</Label><Input type="number" value={form.capacity} onChange={e => setForm({...form, capacity: e.target.value})} className="bg-secondary/50" /></div>
              <Button onClick={handleSave} className="w-full gradient-primary">Guardar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar mesa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/50" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {filtered.map((t) => (
          <Card key={t.id} className="glass group relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-2xl font-bold">#{t.number}</p>
                  <p className="text-sm text-muted-foreground">{t.name || `Mesa ${t.number}`}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t.capacity} personas</p>
                </div>
                <Badge className={cn('capitalize', statusColors[t.status])}>{t.status}</Badge>
              </div>
              <div className="mt-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="sm" variant="ghost" onClick={() => openEdit(t)}><Edit className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(t.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default TablesPage;
