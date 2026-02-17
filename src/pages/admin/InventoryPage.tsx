import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ArrowDownCircle, ArrowUpCircle, FileSpreadsheet } from 'lucide-react';
import { SortableHeader, useSortableData } from '@/components/SortableHeader';
import { PaginationControls, usePagination } from '@/components/PaginationControls';
import * as XLSX from 'xlsx';

interface Movement {
  id: string;
  product_id: string;
  quantity_change: number;
  reason: string;
  created_at: string;
  products?: { name: string };
  profiles?: { full_name: string };
}

type FilterPeriod = 'today' | 'week' | 'month' | 'custom';

function getDateRange(period: FilterPeriod): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  switch (period) {
    case 'today': return { start: end, end };
    case 'week': { const d = new Date(now); d.setDate(d.getDate() - 7); return { start: d.toISOString().split('T')[0], end }; }
    case 'month': { const d = new Date(now); d.setMonth(d.getMonth() - 1); return { start: d.toISOString().split('T')[0], end }; }
    default: return { start: end, end };
  }
}

const InventoryPage = () => {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [period, setPeriod] = useState<FilterPeriod>('week');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');

  const fetchMovements = async (s: string, e: string) => {
    const { data } = await supabase
      .from('inventory_movements')
      .select('*, products(name), profiles:created_by(full_name)')
      .gte('created_at', s)
      .lte('created_at', e + 'T23:59:59')
      .order('created_at', { ascending: false });
    if (data) setMovements(data as any);
  };

  useEffect(() => {
    if (period !== 'custom') {
      const { start, end } = getDateRange(period);
      setStartDate(start);
      setEndDate(end);
      fetchMovements(start, end);
    } else {
      fetchMovements(startDate, endDate);
    }
  }, [period]);

  useEffect(() => {
    if (period === 'custom') fetchMovements(startDate, endDate);
  }, [startDate, endDate]);

  const filtered = movements.filter(m =>
    (m.products?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    m.reason.toLowerCase().includes(search.toLowerCase()) ||
    (m.profiles?.full_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const { sorted, sort, toggleSort } = useSortableData(filtered);
  const { paged, currentPage, totalItems, pageSize, setCurrentPage } = usePagination(sorted);

  const totalIn = filtered.filter(m => m.quantity_change > 0).reduce((s, m) => s + m.quantity_change, 0);
  const totalOut = filtered.filter(m => m.quantity_change < 0).reduce((s, m) => s + m.quantity_change, 0);

  const exportExcel = () => {
    const wsData = [
      ['Fecha', 'Producto', 'Cambio', 'Tipo', 'Razón', 'Realizado por'],
      ...sorted.map(m => [
        new Date(m.created_at).toLocaleString('es'),
        m.products?.name || '—',
        m.quantity_change,
        m.quantity_change > 0 ? 'Entrada' : 'Salida',
        m.reason,
        m.profiles?.full_name || '—',
      ]),
      [],
      ['', '', '', '', 'Total Entradas', totalIn],
      ['', '', '', '', 'Total Salidas', totalOut],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
    XLSX.writeFile(wb, `movimientos_${startDate}_${endDate}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Historial de Inventario</h1>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <ArrowDownCircle className="h-5 w-5 text-success" />
              <ArrowUpCircle className="h-5 w-5 text-destructive -ml-2" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Movimientos</p>
              <p className="text-2xl font-bold">{filtered.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-3">
            <ArrowDownCircle className="h-8 w-8 text-success" />
            <div>
              <p className="text-sm text-muted-foreground">Entradas</p>
              <p className="text-2xl font-bold text-success">+{totalIn}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4 flex items-center gap-3">
            <ArrowUpCircle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-sm text-muted-foreground">Salidas</p>
              <p className="text-2xl font-bold text-destructive">{totalOut}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <Label>Periodo</Label>
          <Select value={period} onValueChange={(v) => setPeriod(v as FilterPeriod)}>
            <SelectTrigger className="bg-secondary/50 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="week">Última semana</SelectItem>
              <SelectItem value="month">Último mes</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {period === 'custom' && (
          <>
            <div><Label>Desde</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-secondary/50 w-44" /></div>
            <div><Label>Hasta</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-secondary/50 w-44" /></div>
          </>
        )}
        <Button variant="outline" className="gap-2" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar movimiento..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/50" />
      </div>

      <Card className="glass overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <SortableHeader label="Fecha" sortKey="created_at" currentSort={sort} onSort={toggleSort} />
                <SortableHeader label="Producto" sortKey="products" currentSort={sort} onSort={toggleSort} />
                <SortableHeader label="Cambio" sortKey="quantity_change" currentSort={sort} onSort={toggleSort} className="text-center" />
                <SortableHeader label="Razón" sortKey="reason" currentSort={sort} onSort={toggleSort} />
                <SortableHeader label="Realizado por" sortKey="profiles" currentSort={sort} onSort={toggleSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((m) => (
                <TableRow key={m.id} className="border-border">
                  <TableCell className="text-sm">{new Date(m.created_at).toLocaleString('es')}</TableCell>
                  <TableCell className="font-medium">{m.products?.name || '—'}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={m.quantity_change > 0 ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}>
                      {m.quantity_change > 0 ? '+' : ''}{m.quantity_change}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{m.reason}</TableCell>
                  <TableCell className="text-sm">{m.profiles?.full_name || '—'}</TableCell>
                </TableRow>
              ))}
              {paged.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No hay movimientos en este periodo</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <PaginationControls currentPage={currentPage} totalItems={totalItems} pageSize={pageSize} onPageChange={setCurrentPage} />
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryPage;
