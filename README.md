# MasterIsimo CEDI 🛡️

Plataforma integral para la gestión inteligente de muelles y patios (Yard Management System) diseñada para maximizar la eficiencia operativa del CEDI Isimo.

## 🚀 Características Principales

- **Motor de Agendamiento Inteligente:** Cálculo dinámico de duraciones y asignación de muelles basado en ambiente, vehículo y volumen de carga.
- **Gestión de Capacidades (Soft Limits):** Monitoreo en tiempo real de topes de cajas por ambiente con alertas de sobrecupo.
- **Dashboard Resumen Diario:** Visualización operativa con barras de progreso y estados (Normal, Extendido, Crítico).
- **Tablero Kanban Real-time:** Gestión de flujo de vehículos (Portería -> Mulle -> Descarga) con KPIs dinámicos de eficiencia y disponibilidad de muelles.
- **Módulo de Configuración Maestro:** Panel administrativo 100% operativo para gestionar Ambientes, Categorías de Producto, Tipos de Vehículo, Muelles y Reglas de Negocio.
- **Voucher Digital (QR Check-in):** Generación automática de comprobantes imprimibles con códigos QR para agilizar el ingreso en portería.
- **Formulario Público:** Wizard para proveedores con validación de slots disponibles en tiempo real.

## 🛠️ Stack Tecnológico

- **Framework:** [Next.js 15](https://nextjs.org/) (App Router)
- **Lenguaje:** TypeScript
- **Base de Datos & Auth:** [Supabase](https://supabase.com/) (PostgreSQL + Realtime)
- **Estilos:** Tailwind CSS
- **Estado Global:** Zustand
- **Validación:** Zod + React Hook Form

## 📁 Estructura del Proyecto

```text
/frontend/src
  ├── /app                  # Rutas de la aplicación (Dashboard, Admin, Public)
  │    ├── /admin/configuracion   # Config de motor y ambientes
  │    ├── /operacion/resumen     # Dashboard de capacidad
  │    ├── /operacion/muelles     # Timeline de muelles
  │    └── /proveedores           # Portal público
  ├── /components           # Componentes UI y Features
  ├── /lib
  │    ├── /services        # Lógica core (Engine, API Clients)
  │    └── /supabase        # Configuración de Supabase (Client/Server)
  ├── /types                # Definiciones de TypeScript de dominio
  └── /config               # Configuración estática (Menús, Temas)
```

## 🚦 Primeros Pasos

### Requisitos Previos

- Node.js 20+
- npm o pnpm

### Instalación

1. Clona el repositorio.
2. Instala las dependencias:
   ```bash
   cd frontend
   npm install
   ```
3. Configura las variables de entorno (`.env.local`):
   ```env
   NEXT_PUBLIC_SUPABASE_URL=tu_url_supabase
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
   ```
4. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

## ☁️ Despliegue a Producción (Vercel)

El proyecto está diseñado estructuralmente como un monorepo ligero. Para desplegar en [Vercel](https://vercel.com/) de forma exitosa y sin errores de rutas, sigue estos pasos:

1. Importa este repositorio desde tu panel de Vercel.
2. En la sección **Build & Development Settings**, localiza el campo **Root Directory**.
3. Haz clic en Editar e ingresa exactamente `frontend` (ya que el código fuente de Next.js reside en esta subcarpeta).
4. El **Framework Preset** será autodetectado como `Next.js`. Deja los comandos por defecto (`npm run build`).
5. Abre la sección de **Environment Variables** y registra obligatoriamente:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Haz clic en **Deploy**.

## 📖 Documentación Relacionada

- [**Guía de Desarrollo y Estándares**](./docs/DEVELOPMENT_GUIDE.md) ⬅️ **Empieza aquí para contribuir.**
- [Documento Técnico (ERS)](./Documento%20Técnico%20de%20Especificación%20de%20Requerimientos%20y%20Arquitectura%20(ERS).md)
- [Guía de Arquitectura Avanzada](./docs/architecture.md)
- [Manual para Administradores](./docs/manuales/manual_superadmin.md)

---
*Desarrollado para Isimo por el equipo de Advanced Agentic Coding.*
