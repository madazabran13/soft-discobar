import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UtensilsCrossed, Package, Receipt, DollarSign } from 'lucide-react';

interface Stats {
  totalTables: number;
  occupiedTables: number;
  totalProducts: number;
  todayOrders: number;
  todayRevenue: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({ totalTables: 0, occupiedTables: 0, totalProducts: 0, todayOrders: 0, todayRevenue: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const today = new Date().toISOString().split('T')[0];

      const [tables, products, orders, sales] = await Promise.all([
        supabase.from('tables').select('status'),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', today),
        supabase.from('sales').select('amount').gte('created_at', today),
      ]);

      setStats({
        totalTables: tables.data?.length || 0,
        occupiedTables: tables.data?.filter(t => t.status === 'ocupada').length || 0,
        totalProducts: products.count || 0,
        todayOrders: orders.count || 0,
        todayRevenue: sales.data?.reduce((sum, s) => sum + Number(s.amount), 0) || 0,
      });
    };

    fetchStats();
  }, []);

  const cards = [
    { label: 'Mesas Ocupadas', value: `${stats.occupiedTables}/${stats.totalTables}`, icon: UtensilsCrossed, color: 'text-primary' },
    { label: 'Productos', value: stats.totalProducts, icon: Package, color: 'text-accent' },
    { label: 'Pedidos Hoy', value: stats.todayOrders, icon: Receipt, color: 'text-success' },
    { label: 'Ventas Hoy', value: `$${stats.todayRevenue.toFixed(2)}`, icon: DollarSign, color: 'text-warning' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="glass">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={cn("h-5 w-5", c.color)} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

// inline cn to avoid import issues
function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export default Dashboard;
