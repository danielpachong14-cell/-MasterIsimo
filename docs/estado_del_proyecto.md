# Estado del Proyecto: MasterIsimo CEDI 🛡️

Documentación técnica y funcional del estado actual del sistema (Abril 2026).

## 🚀 Funcionalidades Core Implementadas

### 1. Motor de Agendamiento Inteligente (`Scheduling Engine`)
- **Lógica de Cascada:** Sistema que resuelve reglas de negocio basadas en el cruce de: *Ambiente + Tipo de Vehículo + Categoría de Producto + Cantidad de Cajas*.
- **Cálculo Dinámico de Duración:** Determina automáticamente cuánto tiempo requiere un vehículo en muelle según su carga.
- **Control de Capacidad (Soft Limits):** Validación dinámica de límites de cajas (Normal y Extendido) por ambiente, visualizando el estado de saturación del CEDI en tiempo real.
- **Buscador de Slots:** Algoritmo de slotting que encuentra huecos disponibles en muelles específicos según el horario operativo.

### 2. DataGrid Operativo (Trazabilidad Avanzada)
- **Gestión 360°:** Visualización tipo tabla de alto rendimiento con filtros multivariables (Placas, Empresa, Estados, Fechas).
- **KPIs Automatizados:** Medición sistemática de:
    - *Tiempo de Espera:* Desde la llegada (check-in) hasta el inicio de descarga.
    - *Tiempo de Operación:* Duración exacta del proceso de descarga.
- **Ingreso Express (Walk-In):** Flujo simplificado para registrar vehículos que llegan al CEDI sin cita previa.

### 3. Panel de Patio (Kanban Real-time)
- **Flujo Visual:** Tablero Kanban con estados operativos: `PENDIENTE`, `EN PORTERÍA`, `EN PATIO`, `EN MUELLE`, `DESCARGANDO` y `FINALIZADO`.
- **Métricas en Vivo:** Visualización de muelles libres, vehículos en espera y porcentaje de eficiencia.

### 4. Panel Administrativo (Configuración CEDI)
- **Gestión de Infraestructura:** Configuración de Ambientes, Muelles y Tipos de Vehículo.
- **Reglas de Negocio:** Definición de límites de capacidad diaria y reglas de duración.

### 5. Portal de Proveedores
- **Formulario Público:** Wizard de solicitud de citas con validación de capacidad en tiempo real.
- **Voucher Digital:** Generación de confirmaciones QR.

## 🛠️ Stack Tecnológico Activo
- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS.
- **Backend/Realtime:** Supabase (Auth, DB, Realtime).
- **Estado:** Zustand.

---
*Generado automáticamente para el registro histórico del proyecto.*
