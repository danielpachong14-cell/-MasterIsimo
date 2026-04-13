Documento Técnico de Especificación de Requerimientos y Arquitectura (ERS)  
Proyecto: Plataforma Integral de Abastecimiento y Gestión de CEDI "isimo"  
Versión: 2.0 (Motor de Agendamiento Inteligente)

1. Resumen Ejecutivo y Alcance  
El presente documento especifica la arquitectura y los requisitos para el desarrollo de un Sistema de Gestión de Patios y Muelles (YMS - Yard Management System) para el Centro de Distribución (CEDI) de la empresa "isimo". 

El alcance actual contempla:
- **Motor de Agendamiento Inteligente:** Asignación automática de citas basada en reglas logísticas (ambiente, vehículo, categorías, volumen).
- **Gestión de Capacidades (Soft Limits):** Control dinámico de flujo diario por ambiente operativo para evitar colapsos.
- **Interfaz Pública:** Formulario wizard para proveedores con slots de tiempo garantizados.
- **Panel de Control Interno:** Tablero Kanban real-time y Dashboard de Resumen Operativo.
- **Módulo de Administración:** Configuración granular de reglas, ambientes y prioridades.

2. Análisis y Decisión de Arquitectura  
Patrón Arquitectónico: Monorepo Desacoplado (Serverless Frontend + BaaS).
Lógica de Dominio: El motor de agendamiento se encuentra encapsulado en `lib/services/scheduling-engine.ts`, permitiendo una validación determinista de slots y capacidades antes de persistir en base de datos.

Stack Tecnológico:
- Frontend: Next.js 15+ (App Router), React 19, Tailwind CSS.
- Backend: Supabase (Postgres, Auth, Realtime).
- Motor de Lógica: TypeScript determinista con validación en cascada.

3. Ecosistema de Integración y API-First  
- Sincronización: Uso de Supabase Realtime para el Dashboard de Resumen Diario y el Tablero Kanban.
- Operación Predictiva: El sistema está preparado para integrar modelos de IA que optimicen la secuencia de descarga basándose en la ocupación histórica de los ambientes.

4. Estructura del Proyecto (Mapeo de Directorios)
/src  
 ├── /app  
 │    ├── /admin/configuracion    # Gestión de Ambientes, Límites y Reglas
 │    ├── /operacion/resumen      # Dashboard de Capacidad Diaria
 │    ├── /operacion/muelles      # Timeline y gestión de muelle físico
 │    └── /proveedores           # Formulario público inteligente
 ├── /lib/services               # Motor de Agendamiento y Lógica de Negocio
 ├── /types                      # Definiciones de dominio (Environment, SchedulingRule, etc.)

5. Esquema de Base de Datos (SQL)
Esquema relacional con soporte para multitenancia operativa por ambientes.

-- Ambientes Operativos (Secos, Fríos, etc.)
CREATE TABLE environments (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    display_name VARCHAR(50) NOT NULL,
    color VARCHAR(20),
    icon VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE
);

-- Reglas de Scheduling (Motor en Cascada)
CREATE TABLE scheduling_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    priority INT DEFAULT 100,
    environment_id INT REFERENCES environments(id),
    vehicle_type_id INT REFERENCES vehicle_types(id),
    category_id INT REFERENCES product_categories(id),
    min_boxes INT DEFAULT 0,
    max_boxes INT,
    duration_minutes INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- Límites de Capacidad (Soft Limits)
CREATE TABLE daily_capacity_limits (
    id SERIAL PRIMARY KEY,
    environment_id INT REFERENCES environments(id) UNIQUE,
    normal_limit_boxes INT NOT NULL,
    extended_limit_boxes INT NOT NULL,
    start_time_normal TIME DEFAULT '06:00',
    end_time_normal TIME DEFAULT '14:00',
    start_time_extended TIME DEFAULT '14:00',
    end_time_extended TIME DEFAULT '22:00'
);

-- Tabla Core: Citas (Actualizada)
ALTER TABLE appointments 
    ADD COLUMN environment_id INT REFERENCES environments(id),
    ADD COLUMN category_id INT REFERENCES product_categories(id),
    ADD COLUMN scheduling_rule_id INT REFERENCES scheduling_rules(id),
    ADD COLUMN estimated_duration_minutes INT,
    ADD COLUMN scheduled_end_time TIME,
    ADD COLUMN box_count INT,
    ADD COLUMN is_forced_assignment BOOLEAN DEFAULT FALSE,
    ADD COLUMN force_reason TEXT,
    ADD COLUMN requires_extended_hours BOOLEAN DEFAULT FALSE;

6. Requerimientos Funcionales (Actualizado)
RF-06: Gestión de Configuración Operativa
El sistema debe permitir a supervisores configurar dinámicamente ambientes, límites de cajas diarios y reglas de duración por tipo de carga.

RF-07: Motor de Agendamiento Inteligente
El sistema debe calcular automáticamente la duración de la cita y asignar un muelle compatible preventivamente al momento del registro. No debe permitir solapamientos en un mismo muelle.

RF-08: Dashboard de Capacidad (Resumen Diario)
Visualización en tiempo real del uso de capacidad por ambiente operativo, alertando visualmente (colores) cuando se superan los límites configurados.

7. Requerimientos No Funcionales (NFR)
NFR-05: Resiliencia de Motor
El cálculo de slots debe realizarse en menos de 500ms para no afectar la experiencia de usuario en el formulario público.

NFR-06: Visibilidad Operativa
Cualquier cambio en la configuración de ambientes o reglas debe impactar instantáneamente el cálculo de nuevas citas.
