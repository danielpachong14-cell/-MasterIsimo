# Documentación Maestra: MasterIsimo CEDI 🛡️

Este documento consolida el conocimiento técnico y operativo del Sistema de Gestión de Patio (YMS) v3.1.

## 📂 Índice de Documentación Technical (SSoT)

### 1. Arquitectura y Lógica de Negocio
- [Guía de Arquitectura Avanzada](./architecture.md)
  - Next.js 15, Server Components y flujo de Server Actions.
- [Motor de Agendamiento (Deep Dive)](./engine.md)
  - Lógica de capacidad, resolución de reglas y matemáticas (LERP).
- [Diccionario de Datos y Tipos](./data_dictionary.md)
  - Mapeo de DB, Enum de Estados y Proyecciones Granulares de TS.

### 2. Manuales y Onboarding
- [Guía de Onboarding Técnico](./onboarding.md)
  - Configuración de entorno, variables `.env` y despliegue en Vercel.
- [Manual Funcional por Módulos](./functional_manual.md)
  - Reglas de negocio para Operación, Admin y Portal Público.
- [Manual para Administradores (Legacy)](./manuales/manual_superadmin.md)
- [Guía para Proveedores (Legacy)](./manuales/guia_proveedores.md)

---

## 🌐 DevOps & Despliegue (Vercel)

Dada la arquitectura de carpetas que aísla la capa web de otras documentaciones y agentes (Monorepo pattern), el despliegue a **Vercel** requiere de una configuración paramétrica inicial:

1.  **Directorio Raíz (`Root Directory`)**: `frontend`.
2.  **Ignorar scripts aledaños**: Los scripts como `seed.mjs` son ignorados vía tree-shaking.
3.  **Variables de Entorno Estrictas**:
    *   `NEXT_PUBLIC_SUPABASE_URL`
    *   `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 🚀 Resumen Técnico (v3.1)

| Componente | Tecnología | Responsabilidad |
| :--- | :--- | :--- |
| **Framework** | Next.js 15 (React 19) | Ecosistema escalable y renderizado de alta velocidad. |
| **Lógica Logística** | Cascading Engine | Resolución de tiempos de descarga basada en parámetros variables. |
| **Capa de Datos** | Supabase Services | Fetching granular con proyecciones para evitar over-fetching. |
| **Control de Capacidad** | Soft Limits | Prevención de saturación mediante alertas visuales en Server Components. |
| **Control Operativo** | Dashboard Kanban v2 | KPIs dinámicos y gestión de flujo real-time. |

---

## 🛠️ Roadmap y Mantenimiento

1. **Check-in Automatizado:** Activar la lectura de QRs en portería.
2. **Alertas de Productividad:** Exportación automática de KPIs operacionales.
3. **Integración WMS:** Sincronización de llegada con órdenes de recibo reales.

---
*Ultima actualización: Abril 2026 - Consolidación de Documentación v3.1 (Public Access Release)*
