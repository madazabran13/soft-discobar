# Roadmap COTICO

## En curso
- [x] Filtros del historial por fecha, trabajador, estado y medio de pago; detalle de pagos parciales en admin y trabajador (5 pruebas aprobadas)
- [ ] Verificar filtros y desglose de pagos con una sesión real (bloqueado: Supabase externo sin sesión de prueba disponible)
- [x] Ocultar superadmin del módulo de usuarios del admin (filtro en UsersPage + política RLS restrictiva)
- [ ] Fase 2: división de cuentas y pagos parciales/mixtos (implementados; verificación bloqueada por falta de sesión de prueba en Supabase externo)
- [ ] Panel propio para superadmin (creado; verificación bloqueada por falta de sesión de prueba en Supabase externo)

## Pendiente (plan COTICO)
- [ ] Fase 3: comprobantes 58/80mm con consecutivo y reimpresión sin duplicar venta
- [ ] Fase 4: caja y arqueo (apertura, ingresos/egresos, cierre)
- [ ] Fase 5: movimientos, devoluciones y reportes
- [ ] Revisar ~45 advertencias de seguridad del linter (anteriores a estos cambios)
- [ ] Cambiar el nombre "DiscoBar" de la pantalla de login a COTICO
