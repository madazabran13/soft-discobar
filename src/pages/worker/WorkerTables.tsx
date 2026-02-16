import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

const WorkerTables = () => {
  const [tables, setTables] = useState<TableRow[]>([]);
  const navigate = useNavigate();

  const fetchTables = async () => {
    const { data } = await supabase.from('tables').select('*').order('number');
    if (data) setTables(data as TableRow[]);
  };

  useEffect(() => {
    fetchTables();
    const ch = supabase.channel('worker-tables').on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => fetchTables()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Mesas</h1>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        {tables.map((t) => (
          <Card
            key={t.id}
            className={cn("glass cursor-pointer transition-transform active:scale-95", t.status === 'libre' && 'hover:neon-border')}
            onClick={() => t.status === 'libre' && navigate(`/worker/pedido?table=${t.id}&tableNum=${t.number}`)}
          >
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">#{t.number}</p>
              <p className="text-xs text-muted-foreground mb-2">{t.name || `Mesa ${t.number}`}</p>
              <Badge className={cn('capitalize text-xs', statusColors[t.status])}>{t.status}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default WorkerTables;
