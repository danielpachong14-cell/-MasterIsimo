# Documento Técnico de Especificación de Requerimientos y Arquitectura (ERS) 🏗️

**Proyecto:** Plataforma Integral de Abastecimiento y Gestión de CEDI "isimo"  
**Versión:** 3.0 (Arquitectura Server-First & Servicios Granulares)  
**Última Actualización:** Abril 2026

---

## 1. Resumen Ejecutivo y Alcance Optimizado

El sistema YMS de MasterIsimo ha evolucionado hacia un modelo de **Alto Rendimiento** y **Seguridad de Grado Empresarial**. La versión 3.0 consolida la infraestructura necesaria para soportar el flujo operativo masivo del CEDI sin latencias.

### Logros Clave (Versión 3.0):
- **Capa de Servicios Centralizada:** Eliminación de lógica de base de datos dispersa en la UI.
- **Optimización de Payload:** Reducción del ~80% en la transferencia de datos mediante proyecciones granulares.
- **Seguridad Server-Side:** Ejecución del motor de agendamiento protegida mediante Server Actions.
- **Renderizado Instantáneo:** Migración de vistas críticas (Resumen) a Server Components puros.

---

## 2. Fuente Única de Verdad (Documentación Completa)

Para detalles técnicos específicos, consulte la suite de documentación extendida:

| Área | Documento | Descripción |
| :--- | :--- | :--- |
| **Arquitectura** | [architecture.md](./docs/architecture.md) | Next.js 15, Server Components y flujo de datos. |
| **Motor Lógico** | [engine.md](./docs/engine.md) | Deep dive en el algoritmo de agendamiento y LERP. |
| **Datos y Tipos** | [data_dictionary.md](./docs/data_dictionary.md) | Diccionario de tablas y tipos de TypeScript. |
| **Manual de Usuario** | [functional_manual.md](./docs/functional_manual.md) | Reglas de negocio por módulo (Operación/Admin). |
| **Desarrolladores** | [onboarding.md](./docs/onboarding.md) | Guía de configuración de entorno y despliegue. |

---

## 3. Hoja de Ruta Técnica (Próximos Pasos)

1. **Monitoreo de Rendimiento:** Implementación de Vercel Speed Insights para medir TTI en ambientes reales.
2. **Alertas Push:** Integración de notificaciones en tiempo real para supervisores cuando un muelle supera el 120% del tiempo estimado.
3. **Optimización de Imágenes:** Generación dinámica de QRs ligeros para los vouchers de entrada.

---
*Este documento es dinámico y debe actualizarse ante cualquier cambio significativo en la lógica del motor o el esquema de datos core.*
