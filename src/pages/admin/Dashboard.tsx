import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UtensilsCrossed, Package, Receipt, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

interface Stats {
  totalTables: number;
  occupiedTables: number;
  totalProducts: number;
  todayOrders: number;
  todayRevenue: number;
}

interface DailySale { day: string; total: number }
interface PaymentBreakdown { method: string; total: number }

const PAYMENT_COLORS = [
  'hsl(280, 100%, 65%)',
  'hsl(330, 100%, 60%)',
  'hsl(142, 76%, 45%)',
  'hsl(38, 92%, 50%)',
];

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
};

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({ totalTables: 0, occupiedTables: 0, totalProducts: 0, todayOrders: 0, todayRevenue: 0 });
  const [dailySales, setDailySales] = useState<DailySale[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentBreakdown[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      const today = new Date().toISOString().split('T')[0];
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

      const [tables, products, orders, salesToday, salesWeek] = await Promise.all([
        supabase.from('tables').select('status'),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', today),
        supabase.from('sales').select('amount').gte('created_at', today),
        supabase.from('sales').select('amount, created_at, payment_method').gte('created_at', sevenDaysAgo),
      ]);

      setStats({
        totalTables: tables.data?.length || 0,
        occupiedTables: tables.data?.filter(t => t.status === 'ocupada').length || 0,
        totalProducts: products.count || 0,
        todayOrders: orders.count || 0,
        todayRevenue: salesToday.data?.reduce((sum, s) => sum + Number(s.amount), 0) || 0,
      });

      // Daily sales aggregation
      const dailyMap: Record<string, number> = {};
      salesWeek.data?.forEach(s => {
        const day = s.created_at.split('T')[0];
        dailyMap[day] = (dailyMap[day] || 0) + Number(s.amount);
      });
      const dailyArr: DailySale[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const key = d.toISOString().split('T')[0];
        const label = d.toLocaleDateString('es', { weekday: 'short', day: 'numeric' });
        dailyArr.push({ day: label, total: dailyMap[key] || 0 });
      }
      setDailySales(dailyArr);

      // Payment method breakdown
      const pmMap: Record<string, number> = {};
      salesWeek.data?.forEach(s => {
        pmMap[s.payment_method] = (pmMap[s.payment_method] || 0) + Number(s.amount);
      });
      setPaymentBreakdown(
        Object.entries(pmMap).map(([method, total]) => ({ method: PAYMENT_LABELS[method] || method, total }))
      );
    };

    fetchAll();
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

      {/* KPI Cards */}
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

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Bar Chart - Daily Sales */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Ventas últimos 7 días</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dailySales}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(240, 5%, 18%)" />
                <XAxis dataKey="day" stroke="hsl(240, 5%, 55%)" fontSize={12} />
                <YAxis stroke="hsl(240, 5%, 55%)" fontSize={12} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(240, 6%, 6%)',
                    border: '1px solid hsl(240, 5%, 18%)',
                    borderRadius: '8px',
                    color: 'hsl(0, 0%, 95%)',
                  }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Total']}
                />
                <Bar dataKey="total" fill="hsl(280, 100%, 65%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pie Chart - Payment Methods */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Métodos de pago (7 días)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={paymentBreakdown}
                  dataKey="total"
                  nameKey="method"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  strokeWidth={2}
                  stroke="hsl(240, 6%, 6%)"
                  label={({ method, percent }) => `${method} ${(percent * 100).toFixed(0)}%`}
                >
                  {paymentBreakdown.map((_, i) => (
                    <Cell key={i} fill={PAYMENT_COLORS[i % PAYMENT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'hsl(240, 6%, 6%)',
                    border: '1px solid hsl(240, 5%, 18%)',
                    borderRadius: '8px',
                    color: 'hsl(0, 0%, 95%)',
                  }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Total']}
                />
                <Legend wrapperStyle={{ color: 'hsl(0, 0%, 95%)' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
