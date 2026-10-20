import { formatCOP } from '@/lib/formatCurrency';
import { paymentSummary, paymentStatusLabels, type HistoryOrder } from '@/lib/orderHistory';

export default function OrderPaymentHistory({ order }: { order: Pick<HistoryOrder, 'status' | 'total_amount' | 'payments'> }) {
  const summary = paymentSummary(order);
  const payments = [...(order.payments || [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return (
    <section className="space-y-3 border-t border-border pt-4">
      <h3 className="font-semibold">Pagos registrados</h3>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <span>{paymentStatusLabels[summary.status]}</span>
        <span>Pagado: <strong>{formatCOP(summary.paid)}</strong></span>
        <span>Saldo: <strong>{formatCOP(summary.remaining)}</strong></span>
      </div>
      {payments.map((p, index) => (
        <div key={p.id} className="space-y-1 border-b border-border py-2 text-sm">
          <div className="flex flex-wrap justify-between gap-2"><span>{index + 1}. {p.payment_methods?.name || 'Medio no disponible'}</span><strong>{formatCOP(Number(p.amount))}</strong></div>
          <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p>
          {p.received_amount != null && <p className="text-xs text-muted-foreground">Recibido: {formatCOP(Number(p.received_amount))} · Cambio: {formatCOP(Number(p.change_amount))}</p>}
        </div>
      ))}
      {payments.length === 0 && <p className="text-sm text-muted-foreground">{order.status === 'facturado' ? 'Pedido facturado sin desglose de pagos registrado.' : 'Sin pagos registrados.'}</p>}
    </section>
  );
}