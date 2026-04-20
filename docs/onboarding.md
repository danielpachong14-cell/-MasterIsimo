# Guía de Onboarding Técnico 🚀

Bienvenido al equipo de desarrollo de MasterIsimo CEDI. Esta guía te permitirá configurar tu entorno y realizar tu primer despliegue en menos de 24 horas.

## 1. Requisitos de Entorno
- **Node.js:** Versión 20 o superior (Recomendado: v22 LTS).
- **Gestor de Paquetes:** npm o yarn.
- **Git:** Para control de versiones.

---

## 2. Configuración Inicial

1. **Clonar el repositorio:**
   ```bash
   git clone <repo-url>
   cd "Abastecimiento Isimo"
   ```

2. **Acceder al directorio del frontend:**
   *El proyecto está estructurado con el código web dentro de `/frontend`.*
   ```bash
   cd frontend
   ```

3. **Instalar dependencias:**
   ```bash
   npm install
   ```

4. **Variables de Entorno:**
   Crea un archivo `.env.local` en la carpeta `/frontend` con las siguientes llaves (solicítalas al administrador de Supabase):
   ```env
   NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
   # Opcional para scripts de servidor (seed/migrations):
   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
   ```

---

## 3. Comandos Útiles

| Comando | Acción |
| :--- | :--- |
| `npm run dev` | Inicia el servidor de desarrollo en `localhost:3000`. |
| `npm run build` | Compila la aplicación para producción (Verifica tipos y linting). |
| `npm run lint` | Ejecuta el análisis estático de código. |

---

## 4. Guía de Despliegue (Vercel)

Dada la estructura del repositorio (Monorepo), el despliegue requiere una configuración específica para que Vercel encuentre la aplicación:

1. **Root Directory:** Establecer como `frontend`.
2. **Framework Preset:** Seleccionar `Next.js`.
3. **Build Command:** `next build` (automático si Root Directory es correcto).
4. **Environment Variables:** Carga las mismas variables de tu `.env.local` en el panel de Vercel.

> [!IMPORTANT]
> Si no estableces el **Root Directory** en `frontend`, Vercel fallará al intentar compilar desde la raíz técnica del repositorio.

---

## 5. Estándares de Código
- **Tipado:** No usar `any`. Usar las proyecciones de `lib/services/appointments.ts` para optimizar vistas.
- **Lógica de Negocio:** Toda lógica pesada (scheduling, cálculos masivos) debe ir en `lib/services` y ser invocada vía **Server Actions**.
- **Componentes UI:** Usar los componentes base en `components/ui` para mantener la consistencia del Sistema de Diseño.
