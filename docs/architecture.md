# Guía de Arquitectura Técnica (v3.1) 🏗️

Este documento detalla la implementación técnica avanzada del YMS, centrada en el rendimiento, la seguridad y la escalabilidad de Next.js 15.

## 1. Patrón Arquitectónico: Server-First

El sistema prioriza la ejecución de lógica y el fetching de datos en el servidor para minimizar el JS enviado al cliente (Hydration) y proteger la lógica de negocio.

### A. Server Components vs Client Components
- **Server Components:** Utilizados para el 90% del fetching de datos (e.g., `resumen/page.tsx`, `kanban/page.tsx`). Permiten acceso directo a Supabase sin exponer el cliente del navegador.
- **Client Components:** Reservados exclusivamente para interactividad (Drag & Drop, Modales, Formularios dinámicos). Ejemplo: `KanbanBoard`, `SupplierForm`.

### B. El Puente: Server Actions
Para que los Client Components ejecuten lógica privilegiada (como el motor de agendamiento) sin exponer lógica de BD, se utilizan **Server Actions**.

### C. Seguridad de Ruteo: Middleware & Public Access
El sistema implementa una capa de seguridad en `middleware.ts` que intercepta todas las peticiones para validar la sesión de Supabase:

1. **Rutas Privadas:** Requieren autenticación (`/operacion/*`, `/admin/*`, `/perfil`).
2. **Rutas Públicas (Whitelisted):** Acceso sin token para proveedores y transportadores:
    - `/proveedores/**` (Agendamiento externo).
    - `/p/**` (Reporte de llegada/Check-in).
3. **Escudo RLS:** En las rutas públicas, la seguridad se transfiere desde la sesión del usuario hacia las políticas de **RLS (Row Level Security)** en Postgres, permitiendo inserciones anónimas solo bajo esquemas de validación estrictos.

---

## 2. Capa de Servicios (`lib/services`)

La lógica de acceso a datos se ha desacoplado de la UI para garantizar consistencia y facilitar el mantenimiento.

1. **`scheduling-engine.ts`**: Orquestación logística y resolución de slots.
2. **`appointments.ts`**: Implementa el patrón **Projections**. Define tipos como `KanbanAppointmentRow` que contienen solo los campos necesarios, reduciendo el payload de red hasta en un 80%.

---

## 3. Integración con Supabase

MasterIsimo utiliza tres canales de comunicación:
- **Server Client (SSR/Actions)**: Para lectura pesada y mutaciones protegidas.
- **Browser Client**: Para autenticación y lógica volátil de cliente.
- **Realtime (WebSockets)**: Sincronización instantánea de estados entre todos los usuarios del dashboard.

---

## 4. Estado Global (Zustand)

Se utiliza `useUIStore` para desacoplar la interactividad compleja:
- **Gestión de Modales**: El store almacena la entidad seleccionada (e.g., `selectedAppointment`) y controla la apertura/cierre de los paneles de detalle para evitar el *prop-drilling*.
- **Configuración de UI**: Estados del Sidebar y alertas globales.

> [!IMPORTANT]
> Aunque el store gestione la "entidad activa" para la UI, el **Estado de Negocio** se sincroniza directamente con Supabase mediante Server Actions o suscripciones en tiempo real. El store nunca sustituye a la base de datos como fuente primaria de datos persistentes.
