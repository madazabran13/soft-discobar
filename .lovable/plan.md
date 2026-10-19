# Plan COTICO — POS modular (INGEMD SOLUTIONS)

## Arquitectura actual (auditoría)
- React + Vite + Supabase externo. Roles en `user_roles` (admin, trabajador); `profiles` ya tiene `tenant_id` y `saas_role` (superadmin/admin/trabajador/viewer) sin usar.
- Módulos existentes: Dashboard, Mesas, Pedidos, Productos, Categorías, Usuarios, Ventas (PDF/Excel), Inventario (historial + ajustes), Configuración (umbral en navegador).
- Stock: se descuenta por trigger al confirmar y por función al adicionar; se devuelve al cancelar.
- Pagos: una sola venta por pedido, 3 medios (efectivo, transferencia, tarjeta). Sin pagos parciales, división de cuenta, comprobantes, caja ni tema claro.
- No hay separación por negocio en mesas/productos/ventas.

## Se implementa en fases (cada una probada antes de la siguiente)

### Fase 1 — Negocios, Superadministrador y módulos
- Tabla de negocios; crear "COTICO" y asignarle todos los datos actuales (nada se borra).
- Agregar `tenant_id` a mesas, productos, categorías, pedidos, ventas, inventario; políticas que impidan ver datos de otro negocio.
- Rol `superadmin` en `user_roles`; solo él puede asignarlo.
- Catálogo de módulos (identificador fijo) + activación por negocio + permisos por rol. Validado en base de datos (función `module_enabled`) y en la interfaz (menú oculto + ruta bloqueada).
- Panel Superadmin: negocios, usuarios por negocio, encender/apagar módulos.
- Registro de auditoría de acciones administrativas.

### Fase 2 — Mesas, cuentas y pagos
- Medios de pago configurables (efectivo, transferencia, Nequi, Daviplata, tarjeta, otros).
- Pagos parciales y mixtos por pedido, saldo pendiente y cambio en efectivo.
- Dividir cuenta por productos o por montos.
- La mesa se libera al saldar el total. Clave única para evitar pagos duplicados.

### Fase 3 — Comprobantes
- Comprobante interno con consecutivo por negocio, impresión 58/80 mm, reimpresión sin crear venta nueva.

### Fase 4 — Caja y arqueo
- Apertura con base, ingresos/egresos/retiros, efectivo esperado vs contado, diferencia y cierre por turno. Pagos en efectivo se ligan a la caja abierta.

### Fase 5 — Movimientos, devoluciones y reportes
- Ingresos/egresos con concepto y responsable; anulación/devolución autorizada por admin que ajusta caja e inventario.
- Reportes: ventas por período y medio, más vendidos, bajo stock, ingresos/egresos, resumen de caja.
- Umbral de stock pasa a guardarse por negocio en la base de datos.

### Fase 6 — Tema claro/oscuro
- Selector en ambos paneles, guardado en el navegador y en el perfil; sin recargar.

## Detalles técnicos
- Migraciones solo aditivas (`ADD COLUMN`, backfill a COTICO, luego `NOT NULL`).
- Funciones `SECURITY DEFINER` para operaciones sensibles: `register_payment`, `open/close_cash_session`, `void_sale`.
- Stock sigue descontándose una sola vez (trigger existente); se agrega prueba.
- Pruebas automáticas de reglas: cálculo de cambio/saldo, división de cuenta, permisos de módulos.

Propuesta: empezar con Fase 1 + Fase 6 en este turno y continuar fase por fase.
