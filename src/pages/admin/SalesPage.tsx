import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { DollarSign, Download } from 'lucide-react';

interface Sale {
  id: string;
  amount: number;
  payment_method: string;
  created_at: string;
  orders?: { client_name: string; tables?: { number: number } };
  profiles?: { full_name: string };
}

const SalesPage = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchSales = async () => {
    const { data } = await supabase
      .from('sales')
      .select('*, orders(client_name, tables(number)), profiles!sales_processed_by_fkey(full_name)')
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59')
      .order('created_at', { ascending: false });
    if (data) setSales(data as any);
  };

  useEffect(() => { fetchSales(); }, [startDate, endDate]);

  const totalRevenue = sales.reduce((sum, s) => sum + Number(s.amount), 0);

  const paymentLabel: Record<string, string> = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta' };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Ventas & Reportes</h1>

      <div className="flex flex-wrap gap-4 items-end">
        <div><Label>Desde</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-secondary/50 w-44" /></div>
        <div><Label>Hasta</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-secondary/50 w-44" /></div>
        <Button variant="outline" onClick={fetchSales}>Filtrar</Button>
      </div>

      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm text-muted-foreground">Total del periodo</CardTitle>
          <DollarSign className="h-5 w-5 text-success" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-success">${totalRevenue.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">{sales.length} transacciones</p>
        </CardContent>
      </Card>

      <Card className="glass overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Fecha</TableHead>
                <TableHead>Mesa</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Procesado por</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((s) => (
                <TableRow key={s.id} className="border-border">
                  <TableCell className="text-sm">{new Date(s.created_at).toLocaleString('es')}</TableCell>
                  <TableCell>#{s.orders?.tables?.number}</TableCell>
                  <TableCell>{s.orders?.client_name}</TableCell>
                  <TableCell><Badge variant="outline">{paymentLabel[s.payment_method] || s.payment_method}</Badge></TableCell>
                  <TableCell>{s.profiles?.full_name || '—'}</TableCell>
                  <TableCell className="text-right font-medium">${Number(s.amount).toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {sales.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No hay ventas en este periodo</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default SalesPage;
