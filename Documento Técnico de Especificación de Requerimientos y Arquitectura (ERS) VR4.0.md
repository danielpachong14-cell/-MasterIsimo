# **Documento de Requerimientos Técnicos: YMS 4.0 \- Isimo CEDI**

Este documento detalla las especificaciones técnicas y funcionales para la evolución del sistema de gestión de patio (YMS) a su versión 4.0, enfocada en la reactividad operativa y la gestión dinámica de muelles.

---

## **1\. Visión General del Proyecto**

El objetivo de la versión 4.0 es transformar el Gantt de una herramienta de visualización estática a un motor de control operativo en tiempo real. El sistema debe permitir la convivencia de la planificación original ("Ghosting") con la ejecución real, gestionando automáticamente los conflictos de tiempo y espacio mediante algoritmos de re-slotting.

## **2\. Arquitectura y Stack Tecnológico**

Se debe mantener la integridad del stack actual para asegurar la compatibilidad y el rendimiento:

* **Framework:** Next.js 15 (App Router) con Server Components y Server Actions.  
* **Base de Datos:** Supabase (PostgreSQL) con políticas de RLS activas.  
* **Estado Global:** Zustand (useUIStore) para la gestión de la interfaz y modales.  
* **Tiempo Real:** Supabase Realtime para la sincronización instantánea de los cambios en el Gantt.

## **3\. Requerimientos Funcionales**

### **3.1. Visualización de "Doble Capa" (Ghosting)**

* El componente del Gantt debe renderizar dos niveles de información por cada cita:  
  * **Capa Fantasma (Original):** Representa el espacio agendado inicialmente (scheduled\_time a scheduled\_end\_time) con opacidad reducida.  
  * **Capa Operativa (Real):** Representa el tiempo real de ejecución basado en marcas de tiempo (start\_unloading\_time y end\_unloading\_time).  
* Si una cita está en estado DESCARGANDO, la capa operativa debe ser dinámica y mostrar el avance en vivo.

### **3.2. Proyección de Cita Activa y Expansión Dinámica**

* Si el proceso de descarga supera el tiempo agendado originalmente, el sistema debe incrementar la reserva de muelle automáticamente en bloques de 15 minutos.  
* Esta expansión debe activar una recalculación en cascada de las citas posteriores asignadas a ese muelle.

### **3.3. Motor de Re-Slotting Automático y Manual**

* **Re-Slotting Automático:** Ante retrasos o solapamientos, el motor debe intentar reubicar las citas afectadas en otros muelles compatibles basándose en el environment\_id y vehicle\_type\_id.  
* **Intervención Manual (Drag & Drop):** El operador debe poder arrastrar y soltar citas para forzar cambios de muelle o adelantar turnos. Cualquier cambio manual debe registrarse en el appointment\_audit\_log con el motivo del movimiento.

### **3.4. Gestión de Citas Retrasadas (Pool de Espera)**

* Implementación de un estado EN\_ESPERA para citas que pierden su slot por llegada tardía.  
* Estas citas deben visualizarse en un panel lateral (Waitlist) desde el cual el operador pueda re-inyectarlas al Gantt mediante Drag & Drop cuando exista un espacio disponible.

## **4\. Especificaciones Técnicas**

### **4.1. Modificaciones en el Esquema de Datos**

* Actualizar la proyección TimelineAppointmentRow en lib/services/appointments.ts para incluir los campos de trazabilidad real (docking\_time, start\_unloading\_time, end\_unloading\_time).  
* Asegurar que el método buildStatusTransitionUpdates() genere correctamente los timestamps de trazabilidad en cada cambio de estado.

### **4.2. Lógica del Backend**

* Crear una Server Action recalculateTimelineCascade que maneje la lógica de colisiones y reasignación de muelles.  
* Implementar validaciones estrictas con Zod para asegurar que los movimientos manuales no violen reglas críticas de negocio (ej. tipo de vehículo no soportado en muelle).

### **4.3. Optimización del Frontend**

* Implementar suscripciones de Realtime robustas para que cualquier actualización masiva de horarios se refleje en todos los dashboards operativos sin necesidad de recargar la página.  
* Manejar obligatoriamente estados de Loading, Empty y Error en el nuevo componente del Gantt.

## **5\. Criterios de Aceptación**

1. El operador puede ver visualmente la diferencia entre lo planeado y lo ejecutado en el mismo muelle.  
2. Las citas que se retrasan más de lo planeado "empujan" visualmente a las siguientes de forma automática.  
3. El sistema permite mover una cita de un muelle a otro mediante Drag & Drop, actualizando los registros de auditoría inmediatamente.  
4. No se envían notificaciones externas; toda la gestión de retrasos es de consumo interno para el personal del CEDI.

