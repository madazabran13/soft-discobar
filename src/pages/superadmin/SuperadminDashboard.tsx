import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCOP } from '@/lib/formatCurrency';
import { Building2, Users, DollarSign, ShoppingCart, ArrowRight, Activity } from 'lucide-react';

const db = supabase as any;

interface TenantStats {
  id: string;
  name: string;
  is_active: boolean;
  users: number;
  salesTotal: number;
  salesCount: number;
  activeOrders: number;
  modulesOn: number;
}

const SuperadminDashboard = () => {
  const [stats, setStats] = useState<TenantStats[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [tenants, profiles, sales, orders, tmods, logs] = await Promise.all([
        db.from('tenants').select('id, name, is_active').order('created_at'),
        db.from('profiles').select('id, tenant_id'),
        db.from('sales').select('tenant_id, amount'),
        db.from('orders').select('tenant_id, status'),
        db.from('tenant_modules').select('tenant_id, enabled'),
        db.from('audit_logs').select('action, entity, details, created_at, tenant_id').order('created_at', { ascending: false }).limit(10),
      ]);

      const rows: TenantStats[] = (tenants.data || []).map((t: any) => {
        const tSales = (sales.data || []).filter((s: any) => s.tenant_id === t.id);
        return {
          id: t.id,
          name: t.name,
          is_active: t.is_active,
          users: (profiles.data || []).filter((p: any) => p.tenant_id === t.id).length,
          salesTotal: tSales.reduce((s: number, x: any) => s + Number(x.amount), 0),
          salesCount: tSales.length,
          activeOrders: (orders.data || []).filter((o: any) => o.tenant_id === t.id && ['pendiente', 'confirmado'].includes(o.status)).length,
          modulesOn: (tmods.data || []).filter((m: any) => m.tenant_id === t.id && m.enabled).length,
        };
      });
      setStats(rows);
      setAudit(logs.data || []);
      setLoading(false);
    };
    load();
  }, []);

  const totals = {
    tenants: stats.length,
    users: stats.reduce((s, t) => s + t.users, 0),
    sales: stats.reduce((s, t) => s + t.salesTotal, 0),
    activeOrders: stats.reduce((s, t) => s + t.activeOrders, 0),
  };

  const cards = [
    { label: 'Negocios', value: totals.tenants, icon: Building2 },
    { label: 'Usuarios totales', value: totals.users, icon: Users },
    { label: 'Ventas acumuladas', value: formatCOP(totals.sales), icon: DollarSign },
    { label: 'Pedidos activos', value: totals.activeOrders, icon: ShoppingCart },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Panel de Plataforma</h1>
          <p className="text-sm text-muted-foreground">Vista global de todos los negocios — INGEMD SOLUTIONS</p>
        </div>
        <Link to="/admin/plataforma">
          <Button variant="outline" className="gap-2">Gestionar negocios <ArrowRight className="h-4 w-4" /></Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="glass">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl gradient-primary">
                <c.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-xl font-bold">{loading ? '…' : c.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass">
        <CardHeader><CardTitle className="text-base">Negocios</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Negocio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Usuarios</TableHead>
                <TableHead className="text-right">Módulos activos</TableHead>
                <TableHead className="text-right">Pedidos activos</TableHead>
                <TableHead className="text-right">Ventas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map((t) => (
                <TableRow key={t.id} className="border-border">
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>
                    <Badge className={t.is_active ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}>
                      {t.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{t.users}</TableCell>
                  <TableCell className="text-right">{t.modulesOn}</TableCell>
                  <TableCell className="text-right">{t.activeOrders}</TableCell>
                  <TableCell className="text-right font-medium">{formatCOP(t.salesTotal)} ({t.salesCount})</TableCell>
                </TableRow>
              ))}
              {stats.length === 0 && !loading && (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No hay negocios</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" /> Actividad reciente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {audit.map((a, i) => (
            <div key={i} className="flex items-center justify-between rounded bg-secondary/30 px-3 py-2 text-sm">
              <span>{a.action} — {a.entity}</span>
              <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString('es-CO')}</span>
            </div>
          ))}
          {audit.length === 0 && <p className="text-sm text-muted-foreground">Sin actividad registrada aún.</p>}
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperadminDashboard;
