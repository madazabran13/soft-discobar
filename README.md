# Discobar Cotico

Desarrolla un software web responsive para gestión de una Discobar/Restobar, utilizando React JS para el frontend y Supabase como backend (Base de Datos, Autenticación y Storage).
El sistema debe ser moderno, intuitivo, seguro y escalable. Debe incluir manejo de roles, control de inventario automático y flujo de pedidos por mesas.

Requerimientos Generales

Diseño responsive (desktop, tablet y móvil).

Interfaz moderna y fácil de usar.

Arquitectura modular y escalable.

Autenticación con Supabase Auth.

Base de datos PostgreSQL de Supabase.

Manejo de roles y permisos.

Generación de reportes descargables en PDF.

Control de inventario en tiempo real.

Panel administrativo y panel operativo.

Roles del Sistema

1. Administrador

Tiene acceso total al sistema.

Funciones:

Gestión de Usuarios (crear, editar, eliminar, consultar).

Gestión de Inventario de Productos (CRUD).

Gestión de Mesas del restaurante/discobar (CRUD).

Gestión de Pedidos (ver detalle, trabajador que lo realizó, productos, total).

Historial de Ventas.

Reportes:

Diario

Semanal

Mensual

Rango de fechas

Descarga en PDF

Facturación de Mesas:

Mostrar total a pagar.

Seleccionar método de pago (Efectivo, Transferencia, Tarjeta).

Guardar método de pago en historial.

Liberar mesa automáticamente al pagar.

Visualizar estado de mesas (Libres / Ocupadas / En facturación).

2. Trabajador

Rol operativo con permisos limitados.

Funciones:

Ver mesas disponibles y mesas asignadas.

Crear pedidos seleccionando número de mesa.

Añadir productos al pedido.

Registrar nombre del cliente.

Confirmar pedido.

Consultar historial de pedidos atendidos.

No puede ver reportes ni inventario completo.

Lógica del Sistema

Flujo de Pedido

Trabajador selecciona mesa libre.

Ingresa nombre del cliente.

Añade productos.

Confirma pedido.

El sistema:

Cambia estado de mesa a “Ocupada”.

Descuenta automáticamente el inventario.

Asocia pedido al trabajador.

Guarda pedido en base de datos.

Flujo de Facturación

Administrador selecciona mesa ocupada.

Sistema muestra detalle del pedido.

Calcula total automático.

Admin selecciona método de pago.

Sistema:

Guarda venta en historial.

Libera la mesa.

Cierra pedido.

Estados de Mesas

Libre

Ocupada

En Facturación

Base de Datos (Tablas sugeridas)

users

roles

products

inventory_movements

tables

orders

order_details

payments

sales

reports

Funcionalidades Técnicas

React Router para navegación.

Context API o Zustand para estado global.

Supabase Realtime para actualización de inventario y mesas.

Generación de PDF para reportes.

Protección de rutas por rol.

Validaciones de formularios.

Manejo de errores y notificaciones.

UI moderna (Material UI o Tailwind).

Objetivo Final

Un sistema web integral para discobar que permita controlar inventario, pedidos por mesa, ventas y reportes en tiempo real, con seguridad de roles, experiencia de usuario fluida

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://discobar-buddy.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e05ff931-5982-4c1d-aacb-ff80f854b6cd).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
