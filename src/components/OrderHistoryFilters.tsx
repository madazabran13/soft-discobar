import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RotateCcw } from 'lucide-react';
import { emptyHistoryFilters, paymentStatusLabels, type HistoryFilters } from '@/lib/orderHistory';

interface Props {
  value: HistoryFilters;
  onChange: (value: HistoryFilters) => void;
  workers: { id: string; name: string }[];
  methods: { id: string; name: string }[];
}

export default function OrderHistoryFilters({ value, onChange, workers, methods }: Props) {
  const change = (key: keyof HistoryFilters, next: string) => onChange({ ...value, [key]: next });
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div className="space-y-1 min-w-0">
          <Label htmlFor="history-from">Desde</Label>
          <Input id="history-from" type="date" value={value.from} max={value.to || undefined} onChange={e => change('from', e.target.value)} />
        </div>
        <div className="space-y-1 min-w-0">
          <Label htmlFor="history-to">Hasta</Label>
          <Input id="history-to" type="date" value={value.to} min={value.from || undefined} onChange={e => change('to', e.target.value)} />
        </div>
        <div className="space-y-1 min-w-0">
          <Label htmlFor="history-worker">Trabajador</Label>
          <Select value={value.worker} onValueChange={v => change('worker', v)}>
            <SelectTrigger id="history-worker"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem>{workers.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1 min-w-0">
          <Label htmlFor="history-payment-status">Estado de pago</Label>
          <Select value={value.paymentStatus} onValueChange={v => change('paymentStatus', v)}>
            <SelectTrigger id="history-payment-status"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem>{Object.entries(paymentStatusLabels).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1 min-w-0">
          <Label htmlFor="history-method">Medio de pago</Label>
          <Select value={value.method} onValueChange={v => change('method', v)}>
            <SelectTrigger id="history-method"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem>{methods.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center justify-end gap-3">
        {value.from && value.to && value.from > value.to && <p role="alert" className="text-sm text-destructive">La fecha inicial debe ser anterior a la final.</p>}
        <Button variant="ghost" size="sm" onClick={() => onChange({ ...emptyHistoryFilters })}><RotateCcw className="mr-2 h-4 w-4" />Limpiar filtros</Button>
      </div>
    </div>
  );
}