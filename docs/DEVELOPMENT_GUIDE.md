# Guía de Desarrollo y Mejores Prácticas MasterIsimo 🛠️

Este documento establece los estándares de ingeniería necesarios para mantener la integridad, el rendimiento y la estabilidad de la plataforma MasterIsimo CEDI. Es de cumplimiento obligatorio para todo nuevo desarrollo.

---

## 1. Despliegue Exitoso en Vercel (Lessons Learned) ☁️

Para garantizar que el pipeline de CI/CD no falle, se deben seguir estas reglas estrictas:

### A. Tipado Estricto (Zero Any Policy)
Vercel rechaza cualquier compilación que contenga tipos implícitos o explícitos `any`.
- **Prohibido**: `const updates = {} as any` o `(payload) => { ... }`.
- **Obligatorio**: Definir interfaces o usar tipos genéricos seguros como `Record<string, unknown>` o `Partial<T>`.
- **Check**: Antes de subir cambios, verifica localmente con `npx tsc --noEmit`.

### B. Limpieza de Código Muerto
Las variables declaradas pero no utilizadas (`no-unused-vars`) causan errores fatales en el build de producción.
- **Acción**: Elimina estados, imports o variables locales que no aporten funcionalidad real.

### C. Case Sensitivity en rutas
Vercel opera en sistemas Linux (Case Sensitive). Asegúrate de que las rutas de los archivos coincidan exactamente con sus imports (e.g., `Modal.tsx` != `modal.tsx`).

---

## 2. Estándares de Tiempo Real (Supabase Realtime) 📡

La comunicación bidireccional es el corazón del Kanban y la Trazabilidad. Sigue este patrón robusto para evitar colisiones y fugas de memoria:

### Patrón de Suscripción Recomendado
```typescript
const channelName = `entidad-${id}-${Math.random().toString(36).substring(7)}`;
const channel = supabase.channel(channelName);

channel
  .on('postgres_changes', { 
    event: '*', 
    schema: 'public', 
    table: 'nombre_tabla',
    filter: `id=eq.${id}`
  }, (payload: { new: Partial<T> }) => { // Tipado explícito del payload
    actualizarEstadoOperacional(payload.new);
  })
  .subscribe((status: string, err?: Error) => { // Manejo exhaustivo de estados
    if (status === 'SUBSCRIBED') console.log('Conectado');
    if (status === 'CHANNEL_ERROR') console.error('Error de canal:', err);
    if (status === 'TIMED_OUT') console.warn('Tiempo de espera agotado');
  });

// Limpieza obligatoria
return () => { supabase.removeChannel(channel); };
```

---

## 3. Arquitectura de Estado Global (Zustand) 🧠

Utilizamos `useUIStore` para desacoplar la interactividad de la jerarquía de componentes.

### Cuándo usar Zustand:
- **Modales de Detalles**: Para evitar el *prop-drilling* de la entidad seleccionada.
- **Configuración de UI**: Colapso de sidebar, temas, alertas globales.
- **Acciones Transversales**: Abrir/Cerrar modales desde cualquier punto del árbol.

### Regla de Oro:
El **Store** es para la **Interfaz de Usuario**. El **DB Client** es para la **Lógica de Negocio**. Nunca guardes listas masivas de datos en Zustand; mantén el estado de negocio en Server Components o cárgalo a demanda.

---

## 4. Eficiencia de Datos (Zero Over-fetching) 🚀

Para mantener el dashboard rápido, nunca descargues el objeto completo de una cita si solo necesitas mostrar una tarjeta.

- **Usa Proyecciones**: Define tipos granulares como `KanbanAppointmentRow` en `@/lib/services/appointments`.
- **Server-First**: Realiza el 90% de las consultas pesadas en Server Components.

---

## 5. Diseño Industrial (Atomic Vibe) 🎨

Sigue el sistema de diseño establecido para mantener la coherencia estética "premium":
- **Tokens Semánticos**: Usa `text-primary`, `bg-surface`, `shadow-ambient`. Evita colores hexadecimales hardcodeados.
- **Estados de Borde**: Todo componente asíncrono debe manejar obligatoriamente `Loading`, `Empty` y `Error`.

---
*Esta guía es dinámica. Si descubres un nuevo "Gotcha" en el despliegue o la arquitectura, actualízala para ayudar al equipo.*
