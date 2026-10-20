export interface HistoryPayment {
  id: string;
  amount: number;
  received_amount: number | null;
  change_amount: number;
  created_at: string;
  payment_method_id: string;
  payment_methods?: { name: string } | null;
}

export interface HistoryOrder {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
  worker_id: string;
  payments?: HistoryPayment[];
}

export interface HistoryFilters {
  from: string;
  to: string;
  worker: string;
  paymentStatus: string;
  method: string;
}

export const emptyHistoryFilters: HistoryFilters = {
  from: '', to: '', worker: 'all', paymentStatus: 'all', method: 'all',
};

export function paymentSummary(order: Pick<HistoryOrder, 'status' | 'total_amount' | 'payments'>) {
  const recorded = (order.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
  // Previously invoiced orders may predate individual payment records.
  const paid = order.status === 'facturado' ? Math.max(recorded, Number(order.total_amount)) : recorded;
  const remaining = Math.max(0, Number(order.total_amount) - paid);
  const status = order.status === 'cancelado' ? 'cancelado' :
    order.status === 'facturado' || (paid > 0 && remaining === 0) ? 'pagado' :
    paid > 0 ? 'parcial' : 'sin_pago';
  return { paid, remaining, status };
}

export const paymentStatusLabels: Record<string, string> = {
  sin_pago: 'Sin pagos', parcial: 'Pago parcial', pagado: 'Pagado', cancelado: 'Cancelado',
};

export function orderDate(value: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(value));
}

export function matchesHistoryFilters(order: HistoryOrder, filters: HistoryFilters) {
  const date = orderDate(order.created_at);
  return (!filters.from || date >= filters.from) &&
    (!filters.to || date <= filters.to) &&
    (filters.worker === 'all' || order.worker_id === filters.worker) &&
    (filters.paymentStatus === 'all' || paymentSummary(order).status === filters.paymentStatus) &&
    (filters.method === 'all' || (order.payments || []).some(p => p.payment_method_id === filters.method));
}