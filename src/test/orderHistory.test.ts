import { describe, expect, it } from 'vitest';
import { emptyHistoryFilters, matchesHistoryFilters, paymentSummary, type HistoryOrder, type HistoryPayment } from '@/lib/orderHistory';

const payment = (method: string, amount: number): HistoryPayment => ({ id: method, amount, payment_method_id: method, received_amount: amount, change_amount: 0, created_at: '2026-10-20T00:00:00Z' });
const order: HistoryOrder = { id: '1', worker_id: 'miguel', status: 'confirmado', total_amount: 15000, created_at: '2026-10-20T00:57:00Z', payments: [payment('nequi', 8000)] };

describe('Order history filters', () => {
  it('includes both date boundaries using the Bogota creation date', () => {
    expect(matchesHistoryFilters(order, { ...emptyHistoryFilters, from: '2026-10-19', to: '2026-10-19' })).toBe(true);
    expect(matchesHistoryFilters(order, { ...emptyHistoryFilters, from: '2026-10-20' })).toBe(false);
    expect(matchesHistoryFilters(order, { ...emptyHistoryFilters, to: '2026-10-18' })).toBe(false);
  });
  it('matches only the selected worker', () => {
    expect(matchesHistoryFilters(order, { ...emptyHistoryFilters, worker: 'miguel' })).toBe(true);
    expect(matchesHistoryFilters(order, { ...emptyHistoryFilters, worker: 'otro' })).toBe(false);
  });
  it('distinguishes partial, unpaid, fully paid and cancelled orders', () => {
    expect(paymentSummary(order)).toEqual({ paid: 8000, remaining: 7000, status: 'parcial' });
    expect(matchesHistoryFilters(order, { ...emptyHistoryFilters, paymentStatus: 'parcial' })).toBe(true);
    expect(matchesHistoryFilters(order, { ...emptyHistoryFilters, paymentStatus: 'pagado' })).toBe(false);
    expect(paymentSummary({ ...order, payments: [] }).status).toBe('sin_pago');
    expect(paymentSummary({ ...order, payments: [payment('nequi', 8000), payment('cash', 7000)] }).status).toBe('pagado');
    expect(paymentSummary({ ...order, status: 'cancelado' }).status).toBe('cancelado');
    expect(paymentSummary({ ...order, status: 'facturado', payments: [] }).status).toBe('pagado');
  });
  it('finds any tender in a mixed payment without counting change as payment', () => {
    const mixed = { ...order, payments: [payment('nequi', 8000), { ...payment('cash', 7000), received_amount: 10000, change_amount: 3000 }] };
    expect(matchesHistoryFilters(mixed, { ...emptyHistoryFilters, method: 'cash' })).toBe(true);
    expect(matchesHistoryFilters(mixed, { ...emptyHistoryFilters, method: 'nequi' })).toBe(true);
    expect(matchesHistoryFilters(mixed, { ...emptyHistoryFilters, method: 'card' })).toBe(false);
    expect(paymentSummary(mixed).paid).toBe(15000);
  });
  it('combines all filters and clears them', () => {
    expect(matchesHistoryFilters(order, { from: '2026-10-19', to: '2026-10-19', worker: 'miguel', paymentStatus: 'parcial', method: 'nequi' })).toBe(true);
    expect(matchesHistoryFilters(order, { ...emptyHistoryFilters, worker: 'otro', method: 'nequi' })).toBe(false);
    expect(matchesHistoryFilters(order, emptyHistoryFilters)).toBe(true);
  });
});