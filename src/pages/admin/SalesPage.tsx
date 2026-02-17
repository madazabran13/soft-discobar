import { useEffect, useState } from 'react';
import { formatCOP } from '@/lib/formatCurrency';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Search, FileText, FileSpreadsheet } from 'lucide-react';
import { SortableHeader, useSortableData } from '@/components/SortableHeader';
import { PaginationControls, usePagination } from '@/components/PaginationControls';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface Sale {
  id: string;
  amount: number;
  payment_method: string;
  created_at: string;
  orders?: { client_name: string; tables?: { number: number } };
  profiles?: { full_name: string };
}

type FilterPeriod = 'custom' | 'today' | 'week' | 'month';

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

const paymentLabel: Record<string, string> = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta' };

const SalesPage = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [period, setPeriod] = useState<FilterPeriod>('today');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');

  const fetchSales = async (s: string, e: string) => {
    const { data } = await supabase
      .from('sales')
      .select('*, orders(client_name, tables(number)), profiles(full_name)')
      .gte('created_at', s)
      .lte('created_at', e + 'T23:59:59')
      .order('created_at', { ascending: false });
    if (data) setSales(data as any);
  };

  useEffect(() => {
    if (period !== 'custom') {
      const { start, end } = getDateRange(period);
      setStartDate(start);
      setEndDate(end);
      fetchSales(start, end);
    } else {
      fetchSales(startDate, endDate);
    }
  }, [period]);

  useEffect(() => {
    if (period === 'custom') fetchSales(startDate, endDate);
  }, [startDate, endDate]);

  const filtered = sales.filter(s =>
    (s.orders?.client_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (paymentLabel[s.payment_method] || s.payment_method).toLowerCase().includes(search.toLowerCase()) ||
    (s.profiles?.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    String(s.orders?.tables?.number || '').includes(search)
  );
  const { sorted, sort, toggleSort } = useSortableData(filtered);
  const { paged, currentPage, totalItems, pageSize, setCurrentPage } = usePagination(sorted);

  const totalRevenue = filtered.reduce((sum, s) => sum + Number(s.amount), 0);

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Reporte de Ventas', 14, 22);
    doc.setFontSize(10);
    doc.text(`Periodo: ${startDate} — ${endDate}`, 14, 30);
    doc.text(`Total: ${formatCOP(totalRevenue)} | ${filtered.length} transacciones`, 14, 36);
    autoTable(doc, {
      startY: 42,
      head: [['Fecha', 'Mesa', 'Cliente', 'Método', 'Procesado por', 'Monto']],
      body: sorted.map(s => [
        new Date(s.created_at).toLocaleString('es'),
        `#${s.orders?.tables?.number || '—'}`,
        s.orders?.client_name || '—',
        paymentLabel[s.payment_method] || s.payment_method,
        s.profiles?.full_name || '—',
        formatCOP(Number(s.amount)),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [100, 0, 200] },
    });
    doc.save(`ventas_${startDate}_${endDate}.pdf`);
  };

  const exportExcel = () => {
    const wsData = [
      ['Fecha', 'Mesa', 'Cliente', 'Método de Pago', 'Procesado por', 'Monto'],
      ...sorted.map(s => [
        new Date(s.created_at).toLocaleString('es'),
        s.orders?.tables?.number || '',
        s.orders?.client_name || '',
        paymentLabel[s.payment_method] || s.payment_method,
        s.profiles?.full_name || '',
        Number(s.amount),
      ]),
      [],
      ['', '', '', '', 'TOTAL', totalRevenue],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ventas');
    XLSX.writeFile(wb, `ventas_${startDate}_${endDate}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Ventas & Reportes</h1>

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
        <Button variant="outline" className="gap-2" onClick={exportPDF}><FileText className="h-4 w-4" /> PDF</Button>
        <Button variant="outline" className="gap-2" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar venta..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/50" />
      </div>

      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm text-muted-foreground">Total del periodo</CardTitle>
          <DollarSign className="h-5 w-5 text-success" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-success">{formatCOP(totalRevenue)}</p>
          <p className="text-xs text-muted-foreground">{filtered.length} transacciones</p>
        </CardContent>
      </Card>

      <Card className="glass overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <SortableHeader label="Fecha" sortKey="created_at" currentSort={sort} onSort={toggleSort} />
                <SortableHeader label="Mesa" sortKey="orders" currentSort={sort} onSort={toggleSort} />
                <SortableHeader label="Cliente" sortKey="client_name" currentSort={sort} onSort={toggleSort} />
                <SortableHeader label="Método" sortKey="payment_method" currentSort={sort} onSort={toggleSort} />
                <SortableHeader label="Procesado por" sortKey="profiles" currentSort={sort} onSort={toggleSort} />
                <SortableHeader label="Monto" sortKey="amount" currentSort={sort} onSort={toggleSort} className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((s) => (
                <TableRow key={s.id} className="border-border">
                  <TableCell className="text-sm">{new Date(s.created_at).toLocaleString('es')}</TableCell>
                  <TableCell>#{s.orders?.tables?.number}</TableCell>
                  <TableCell>{s.orders?.client_name}</TableCell>
                  <TableCell><Badge variant="outline">{paymentLabel[s.payment_method] || s.payment_method}</Badge></TableCell>
                  <TableCell>{s.profiles?.full_name || '—'}</TableCell>
                  <TableCell className="text-right font-medium">{formatCOP(Number(s.amount))}</TableCell>
                </TableRow>
              ))}
              {paged.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No hay ventas en este periodo</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <PaginationControls currentPage={currentPage} totalItems={totalItems} pageSize={pageSize} onPageChange={setCurrentPage} />
        </CardContent>
      </Card>
    </div>
  );
};

export default SalesPage;
