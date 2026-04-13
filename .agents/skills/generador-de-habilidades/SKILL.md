---
name: generador-de-habilidades
description: Crea nuevas habilidades en español para este workspace siguiendo la estructura oficial de Google Antigravity.
---

# Generador de Habilidades en Español

Esta habilidad permite a Antigravity crear otras habilidades de forma automatizada, asegurando que sigan los estándares de calidad y estructura requeridos.

## Cuándo usar esta habilidad
- Cuando el usuario solicite crear una nueva "habilidad" (skill).
- Cuando se identifique una tarea recurrente que se beneficiaría de tener sus propias instrucciones y recursos especializados.

## Instrucciones para el Agente (Antigravity)
1.  **Identificar el propósito**: Comprender qué debe hacer la nueva habilidad.
2.  **Determinar el nombre**: Usar un nombre descriptivo en kebab-case (ej. `analizador-de-codigo`, `formateador-de-datos`).
3.  **Crear el directorio**: La habilidad debe residir en `.agents/skills/<nombre-de-habilidad>/`.
4.  **Crear el archivo SKILL.md**:
    -   Incluir el frontmatter YAML con `name` y `description` (en tercera persona).
    -   Escribir las instrucciones en español de forma detallada.
    -   Incluir secciones de "Cuándo usar", "Cómo usar" e "Instrucciones detalladas".
5.  **Archivos adicionales (Opcional)**:
    -   Si la habilidad requiere scripts, crearlos en la carpeta `scripts/` dentro del directorio de la habilidad.
    -   Si requiere ejemplos, crearlos en `examples/`.
6.  **Validación**: Asegurarse de que el `SKILL.md` sea legible y completo.

## Estructura Esperada
- `.agents/skills/<nombre-de-habilidad>/SKILL.md`
- Carpeta `scripts/` para herramientas adicionales.
- Carpeta `examples/` para casos de uso.
