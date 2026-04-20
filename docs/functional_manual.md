# Manual Funcional por Módulos 🧩

Este documento detalla los procesos operativos y reglas de negocio implementadas en los tres frentes del sistema MasterIsimo.

---

## 1. Módulo de Operación (Dashboard Interno)

Es el centro de control del CEDI, diseñado para supervisores y jefes de patio.

### A. Tablero Kanban (Gestión de Flujo)
- **Función:** Control visual del estado de las citas mediante Drag & Drop.
- **Reglas de Negocio:**
  - Al mover a `EN_PORTERIA`: Registra automáticamente `arrival_time`.
  - Al mover a `EN_MUELLE`: Requiere asignación de muelle físico. Registra `docking_time`.
  - **Optimización:** Utiliza proyecciones granulares para mantener el rendimiento con cientos de tarjetas.

### B. Gestión de Muelles (Timeline)
- **Función:** Visualización temporal de la ocupación de muelles.
- **Reglas de Negocio:**
  - Evita el solapamiento visual de citas en el mismo muelle.
  - Permite la edición de horarios y muelles mediante "Asignación Forzada" (con registro de motivo).

### C. Resumen Diario (KPIs de Capacidad)
- **Función:** Monitoreo de los **Soft Limits** programados.
- **Visualización:**
  - 🟢 **Verde:** Ocupación normal.
  - 🟡 **Amarillo:** Horario Extendido (requiere más personal).
  - 🔴 **Rojo:** Sobrecupo Crítico.
- **Tecnología:** Renderizado en el servidor (SSR) para carga instantánea de métricas.

---

## 2. Módulo de Administración (Configuración)

Permite parametrizar el comportamiento del motor de agendamiento.

- **Gestión de Ambientes:** Define sub-centros operativos (e.g., Fruver, Secos).
- **Reglas de Scheduling:** Configuración de la cascada de resolución (Prioridades).
- **Daily Capacity Limits:** Definición de umbrales para los Soft Limits (Normal vs Extendido).
- **Tipos de Vehículo:** Configuración de eficiencias base para el cálculo de tiempos.

---

## 3. Portal Público (Registro de Proveedores)

Interfaz de auto-servicio para transportadores y proveedores.

- **Flujo Wizard (3 Pasos):**
  1. **Datos del vehículo:** Placas y tipo.
  2. **Carga:** Ingreso de Órdenes de Compra (OC).
  3. **Reserva:** Selección de Slot garantizado.
- **Seguridad:** El cálculo de disponibilidad se realiza exclusivamente en el servidor vía **Server Actions**, protegiendo la lógica de colisión y las reglas de negocio.
- **Resultado:** Generación de un voucher digital con ID de cita para ingreso a portería.
