# Documentación Maestra: MasterIsimo CEDI 🛡️

Este documento consolida el conocimiento técnico y operativo del Sistema de Gestión de Patio (YMS) v2.0.

## 📂 Índice de Documentación

### 1. Arquitectura y Desarrollo
- [Guía de Arquitectura Avanzada](./architecture.md)
  - Motor de Agendamiento Inteligente y lógica de 3 pasos.
  - Modelado de datos por ambientes y reglas en cascada.
- **Servicios Core:**
  - `src/lib/services/scheduling-engine.ts`: Corazón del sistema. Maneja capacidad, resolución de reglas y búsqueda de slots.
  - `src/lib/supabase/client.ts`: Integración con la capa de datos real-time.

### 2. Manuales de Usuario
- [Manual para Administradores (SuperAdmin)](./manuales/manual_superadmin.md)
  - Gestión de Ambientes, Límites de Cajas y Reglas de Duración.
- [Guía para Proveedores](./manuales/guia_proveedores.md)
  - Flujo de agendamiento basado en slots garantizados.

---

## 🌐 DevOps & Despliegue (Vercel)

Dada la arquitectura de carpetas que aísla la capa web de otras documentaciones y agentes (Monorepo pattern), el despliegue a **Vercel** requiere de una configuración paramétrica inicial para evitar que los procesos de compilación o el enrutador fallen en producción.

### Parámetros Exactos de Configuración en Vercel
1.  **Directorio Raíz (`Root Directory`)**: `frontend`.
    *   **Razón**: Vercel no compilará tu app si intenta ejecutar el comando en la raíz técnica (donde se encuentran archivos de git, scripts aislados y READMEs organizativos). El motor de construcción requiere estar exactamente donde reside el archivo `package.json` de Next.js.
2.  **Ignorar scripts aledaños**: Los scripts utilitarios como `seed.mjs` y `register.mjs` conviven de forma inofensiva. Como no están integrados internamente al árbol de importaciones dependientes de `app/`, Vercel mediante Webpack los ignorará automáticamente durante la "fase de tree-shaking" y no afectarán en lo absoluto el peso, rendimiento o arranque de la aplicación web final.
3.  **Variables de Entorno Estrictas**:
    *   `NEXT_PUBLIC_SUPABASE_URL`
    *   `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 🚀 Resumen Técnico (v2.0)

| Componente | Tecnología | Responsabilidad |
| :--- | :--- | :--- |
| **Framework** | Next.js 15 (React 19) | Ecosistema escalable y renderizado de alta velocidad. |
| **Lógica Logística** | Cascading Engine | Resolución de tiempos de descarga basada en parámetros variables. |
| **Control de Capacidad** | Soft Limits | Prevención de saturación mediante alertas visuales. |
| **Especialización** | Ambientes (Tags) | Segmentación de muelles (Secos, Fríos, etc.) en el Timeline. |
| **Control Operativo** | Dashboard Kanban v2 | KPIs dinámicos de eficiencia, muelles libres y gestión de flujo "En Portería". |
| **Gestión de Ingreso** | Voucher/QR Engine | Generación de tickets digitales para conductores con enlace de Auto Check-in. |

---

## 🛠️ Roadmap y Mantenimiento

1. **Check-in Automatizado:** Activar la lectura de QRs en portería para actualizar el estado del vehículo a `EN_PORTERIA` automáticamente.
2. **Alertas de Productividad:** Exportación automática de KPIs cuando un ambiente opera consistentemente sobre el 80% de su capacidad.
3. **Integración WMS:** Sincronización de llegada de vehículos con órdenes de recibo reales.

---
*Ultima actualización: Abril 2026 - Generado por Antigravity*
