# Motor de Agendamiento Inteligente (Deep Dive) 🧠

El motor de agendamiento (`scheduling-engine.ts`) es el núcleo lógico del YMS MasterIsimo. Su función es transformar una solicitud de descarga en una asignación precisa de tiempo y espacio (muelle).

## 🚀 Proceso de Ejecución en 3 Pasos

El motor se ejecuta de forma lineal y determinista siguiendo esta secuencia:

### Paso 1: Validación de Capacidad (Soft Limits)
El sistema evalúa si el ambiente operativo tiene "espacio logístico" para recibir más carga.

- **Lógica:** Suma todas las cajas (`box_count`) de las citas activas para la fecha y ambiente.
- **PROYECCIÓN:** `Cajas Totales = Cajas Existentes + Nuevas Cajas`.
- **RESULTADOS:**
  - `dentroNormal`: `projectedTotal <= normal_box_limit`.
  - `requiereExtendido`: `projectedTotal > normal_box_limit && projectedTotal <= extended_box_limit`.
  - `sobrecupoCrítico`: `projectedTotal > extended_box_limit`.

> [!NOTE]
> El motor **NUNCA bloquea** el agendamiento por capacidad; su objetivo es la visibilidad proactiva para la toma de decisiones.

---

### Paso 2: Resolución de Duración (Cálculo Matemático)
Determina cuántos minutos ocupará el vehículo en el muelle.

#### A. Resolución de Regla de Cascada
Se busca en la tabla `scheduling_rules` el match más específico:
1. **Filtro Obligatorio:** Debe coincidir el `environment_id` (si la solicitud tiene uno).
2. **Match en Cascada:** Prioriza reglas con `vehicle_type_id` y `category_id` específicos.
3. **Prioridad:** En caso de múltiples matches, se selecciona la de menor valor en el campo `priority`.

#### B. Fórmula de Interpolación Lineal (LERP)
Si la regla es **Dinámica** (`is_dynamic = true`) y tiene límites definidos, se aplica:

$$ T_{final} = T_{min} + \frac{(C_{req} - C_{min}) \times (T_{max} - T_{min})}{C_{max} - C_{min}} $$

Donde:
- $C_{req}$: Cajas solicitadas.
- $C_{min} / C_{max}$: Rango de cajas de la regla.
- $T_{min}$: Duración base de la regla.
- $T_{max}$: Duración máxima permitida.

#### C. Fallback por Vehículo
Si no hay regla o la duración no es dinámica por rango, se usa la eficiencia base del vehículo:
- `Minutos = (Cajas / Eficiencia_Vehículo) * Tiempo_Base + Maniobra`.

---

### Paso 3: Motor de Disponibilidad (Slotting)
Busca un "hueco" físico en los muelles compatibles.

1. **Filtrado de Muelles:** Identifica muelles activos, que permitan `DESCARGA` y que coincidan con el ambiente y tipos de vehículo soportados.
2. **Detección de Colisiones:**
   - Define el horario operativo (e.g., 06:00 a 22:00 si hay horario extendido).
   - Itera en bloques de **30 minutos**.
   - Para cada slot, verifica si **al menos un muelle individual** tiene libre el bloque completo de `duración calculada`.
3. **Asignación Preventiva:** El motor retorna el muelle sugerido (`dock_id`) para garantizar que la cita tiene un espacio físico real.

## 🛠️ Implementation Details (Public & Server Access)

El motor utiliza **Inyección de Dependencia (DI)** para el cliente de Supabase.

```typescript
// Firma de la función principal
export async function runSchedulingEngine(
  supabase: SupabaseClient, // Cliente de servidor (Service Role, Auth o Anon)
  request: SchedulingRequest
): Promise<SchedulingResult>
```

### Seguridad en Rutas Públicas
Para permitir el agendamiento externo sin autenticación (`/proveedores`), el motor ha sido auditado para garantizar que **no depende de sesiones de usuario**. El cliente de Supabase inyectado por la Server Action `scheduleEngineAction` puede ser anónimo, delegando la integridad de los datos exclusivamente a las políticas de **RLS (Row Level Security)** en la base de datos.

> [!CAUTION]
> El motor **NUNCA** debe ejecutarse en el navegador. Todas las invocaciones deben pasar por la Server Action `scheduleEngineAction` para garantizar que las llaves de API y la lógica de negocio permanezcan protegidas.
