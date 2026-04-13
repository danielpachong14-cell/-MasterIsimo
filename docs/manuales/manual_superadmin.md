# Manual de Administración: Motor de Agendamiento 🏢

Este manual guía a los SuperAdmins en la configuración de los parámetros logísticos del CEDI Isimo.

## 1. Gestión de Ambientes
Los ambientes permiten segmentar la operación (ej. Secos, Fríos, Fruver).
- **Cómo configurar:** Acceda a `Configuración CEDI > Ambientes`.
- **Campos:**
  - **Código:** Identificador interno (ej. SEC01).
  - **Display Name:** Nombre visible en toda la plataforma.
  - **Color e Icono:** Permiten identificar visualmente el ambiente en el Timeline de muelles y en el dashboard de resumen.

## 2. Límites de Capacidad (Soft Limits)
Define cuántas cajas puede procesar el CEDI por ambiente antes de entrar en estado de alerta.
- **Límite Normal:** Capacidad estándar de operación.
- **Límite Extendido:** Capacidad máxima bajo condiciones extraordinarias.
- **Horarios:** Define la ventana de tiempo para operación normal y extendida.
- **Alertas en Dashboard:**
  - 🟢 **Bajo el Límite Normal:** Operación fluida.
  - 🟡 **Sobre el Límite Normal:** Alerta de horario extendido.
  - 🔴 **Sobre el Límite Extendido:** Alerta de sobrecupo crítico.

## 3. Reglas de Scheduling (Motor en Cascada)
Las reglas definen cuánto tiempo ocupará un camión el muelle. El sistema evalúa las reglas por **Prioridad** (menor número = mayor prioridad).
- **Criterios de Aplicación:**
  - Ambiente.
  - Categoría de Producto.
  - Tipo de Vehículo.
  - Rango de Cajas (Mínimo/Máximo).
- **Ejemplo:** Una regla con prioridad 5 que diga "Fríos + Bebidas + >1000 cajas = 210 min" se aplicará antes que una regla genérica de "Fríos = 60 min".

## 4. Configuración de Muelles
Cada muelle debe ser "especializado" para que el motor funcione correctamente.
- **Ambiente Asociado:** Seleccione a qué ambiente pertenece el muelle (ej. Muelle 15 -> Fríos).
- **Tipos de Vehículo:** Marque qué vehículos puede recibir físicamente ese muelle (Tractocamión, Doble Troque, etc.).

---
*Recomendación: Revise mensualmente las reglas para ajustarlas según los tiempos reales de descarga medidos en patio.*
