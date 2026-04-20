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

1. **`scheduling-engine.ts`:** Orquestador de la lógica logística. Utiliza Inyección de Dependencia para el cliente de Supabase.
2. **`appointments.ts`:** Manejo granular de consultas a la tabla principal. Implementa el patrón **Projections** para evitar el sobre-envío de datos (over-fetching).

---

## 3. Integración con Supabase

MasterIsimo utiliza tres canales de comunicación con Supabase:
- **Server Client (SSR/Actions):** Para operaciones de lectura pesada y mutaciones transaccionales.
- **Browser Client:** Para autenticación básica del lado del cliente.
- **Realtime (WebSockets):** Escucha activa en el Tablero Kanban para reflejar cambios de otros supervisores instantáneamente.

---

## 4. Estado Global (Zustand)

Se utiliza una tienda (`uiStore.ts`) para gestionar únicamente estado de interfaz volátil:
- Visibilidad de modales laterales.
- Alertas y notificaciones del sistema.
- Filtros de búsqueda temporales.

> [!IMPORTANT]
> El estado de negocio (Citas, Muelles, Reglas) **NUNCA** se guarda en Zustand. Se maneja mediante Server-State (Server Components) o sincronización directa con Supabase para garantizar una Única Fuente de Verdad.
