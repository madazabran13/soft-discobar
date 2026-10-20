import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatCOP } from '@/lib/formatCurrency';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2 } from 'lucide-react';

interface PaymentMethod { id: string; name: string }
interface PaymentRow { id: string; amount: number; change_amount: number; payment_methods?: { name: string } }
interface DraftPayment { methodId: string; amount: string; received: string }

interface Props {
  order: { id: string; total_amount: number; client_name: string; tables?: { number: number } } | null;
  onClose: () => void;
  onSettled: () => void;
}

const db = supabase as any;

const BillingDialog = ({ order, onClose, onSettled }: Props) => {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [drafts, setDrafts] = useState<DraftPayment[]>([{ methodId: '', amount: '', received: '' }]);
  const [loading, setLoading] = useState(false);
  const [settled, setSettled] = useState(false);

  const total = Number(order?.total_amount || 0);
  const paid = useMemo(() => payments.reduce((s, p) => s + Number(p.amount), 0), [payments]);
  const remaining = Math.max(total - paid, 0);

  const load = async () => {
    if (!order) return;
    const [{ data: m }, { data: p }] = await Promise.all([
      db.from('payment_methods').select('id, name').eq('is_active', true).order('sort_order'),
      db.from('payments').select('id, amount, change_amount, payment_methods(name)').eq('order_id', order.id).order('created_at'),
    ]);
    setMethods(m || []);
    setPayments(p || []);
  };

  useEffect(() => {
    if (order) {
      setSettled(false);
      setDrafts([{ methodId: '', amount: '', received: '' }]);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id]);

  const setDraft = (i: number, patch: Partial<DraftPayment>) =>
    setDrafts((d) => d.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  const addDraft = () => setDrafts((d) => [...d, { methodId: '', amount: '', received: '' }]);
  const removeDraft = (i: number) => setDrafts((d) => d.filter((_, idx) => idx !== i));

  const draftSum = drafts.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);

  const submit = async () => {
    if (!order) return;
    const valid = drafts.filter((d) => d.methodId && parseFloat(d.amount) > 0);
    if (valid.length === 0) { toast.error('Agrega al menos un pago con medio y monto'); return; }
    if (paid + draftSum > total + 0.009) { toast.error('La suma de pagos excede el saldo pendiente'); return; }

    setLoading(true);
    try {
      for (const d of valid) {
        const amount = parseFloat(d.amount);
        const received = d.received ? parseFloat(d.received) : null;
        const { data, error } = await supabase.rpc('register_payment', {
          p_order_id: order.id,
          p_payment_method_id: d.methodId,
          p_amount: amount,
          p_received_amount: received,
          p_idempotency_key: crypto.randomUUID(),
        } as any);
        if (error) throw error;
        const res = data as any;
        if (res?.change > 0) toast.info(`Cambio a devolver: ${formatCOP(res.change)}`);
        if (res?.settled) setSettled(true);
      }
      toast.success('Pago registrado');
      setDrafts([{ methodId: '', amount: '', received: '' }]);
      await load();
      const { data: p } = await db.from('payments').select('amount').eq('order_id', order.id);
      const newPaid = (p || []).reduce((s: number, x: any) => s + Number(x.amount), 0);
      if (newPaid >= total - 0.009) { setSettled(true); onSettled(); }
    } catch (e: any) {
      toast.error(e.message || 'Error registrando el pago');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!order} onOpenChange={() => onClose()}>
      <DialogContent className="glass max-w-lg">
        <DialogHeader><DialogTitle>Facturar Pedido</DialogTitle></DialogHeader>
        {order && (
          <div className="space-y-4">
            <p>Mesa <strong>#{order.tables?.number}</strong> — {order.client_name}</p>
            <div className="flex items-center justify-between rounded-lg bg-secondary/40 p-3">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-xl font-bold">{formatCOP(total)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Pendiente</p>
                <p className={`text-xl font-bold ${remaining > 0 ? 'text-warning' : 'text-success'}`}>{formatCOP(remaining)}</p>
              </div>
            </div>

            {payments.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium">Pagos registrados</p>
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm rounded bg-secondary/30 px-3 py-1.5">
                    <span>{p.payment_methods?.name}</span>
                    <span className="font-medium">{formatCOP(Number(p.amount))}</span>
                  </div>
                ))}
              </div>
            )}

            {!settled && remaining > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Nuevo pago {drafts.length > 1 && <Badge variant="secondary">dividido</Badge>}</p>
                  <Button size="sm" variant="outline" onClick={addDraft} className="gap-1"><Plus className="h-3 w-3" /> Dividir cuenta</Button>
                </div>
                {drafts.map((d, i) => {
                  const method = methods.find((m) => m.id === d.methodId);
                  const isCash = method?.name === 'Efectivo';
                  const amount = parseFloat(d.amount) || 0;
                  const received = parseFloat(d.received) || 0;
                  return (
                    <div key={i} className="space-y-2 rounded-lg border border-border p-3">
                      <div className="flex gap-2">
                        <Select value={d.methodId} onValueChange={(v) => setDraft(i, { methodId: v })}>
                          <SelectTrigger className="bg-secondary/50 flex-1"><SelectValue placeholder="Medio de pago" /></SelectTrigger>
                          <SelectContent>
                            {methods.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number" min={0} placeholder={`Monto (máx ${formatCOP(remaining)})`}
                          value={d.amount} onChange={(e) => setDraft(i, { amount: e.target.value })}
                          className="bg-secondary/50 w-40"
                        />
                        {drafts.length > 1 && (
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeDraft(i)}><Trash2 className="h-4 w-4" /></Button>
                        )}
                      </div>
                      {isCash && amount > 0 && (
                        <div className="flex items-center gap-2">
                          <Label className="text-xs whitespace-nowrap">Recibido:</Label>
                          <Input
                            type="number" min={0} placeholder="¿Con cuánto paga?"
                            value={d.received} onChange={(e) => setDraft(i, { received: e.target.value })}
                            className="bg-secondary/50 w-40"
                          />
                          {received > amount && (
                            <span className="text-xs text-success font-medium">Cambio: {formatCOP(received - amount)}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {drafts.length > 1 && (
                  <p className="text-right text-sm text-muted-foreground">
                    Suma de pagos: <span className="font-medium text-foreground">{formatCOP(draftSum)}</span>
                  </p>
                )}
                <Button onClick={submit} disabled={loading} className="w-full gradient-primary">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : `Registrar pago${drafts.length > 1 ? 's' : ''}`}
                </Button>
              </div>
            )}

            {(settled || remaining <= 0) && (
              <p className="rounded-lg bg-success/10 p-3 text-center text-sm font-medium text-success">
                Pedido saldado — la mesa quedó libre
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BillingDialog;
