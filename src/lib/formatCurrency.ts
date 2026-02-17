export function formatCOP(value: number): string {
  return '$' + Math.round(value).toLocaleString('es-CO');
}
