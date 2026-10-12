---
sidebar_position: 4
title: "Recetario: LLM Aumentado con Diccionario"
---

# LLM Aumentado con Diccionario

> **La idea:** Forzar traducciones conocidas y verificadas para términos específicos desde un diccionario bilingüe, y dejar que el LLM maneje la estructura de oraciones y vocabulario desconocido. El diccionario proporciona puntos de anclaje de corrección; el LLM proporciona fluidez.

:::info[Este es un libro de recetas, no una implementación terminada]
Esta guía esboza el enfoque. La estrategia específica de coincidencia de diccionarios e inyección dependerá de su par de idiomas y los recursos léxicos disponibles.
:::

## Cuándo Usar Esto

- **Existe un diccionario bilingüe** para su par de idiomas (incluso uno pequeño)
- El LLM **alucina consistentemente términos clave** — inventando palabras que no existen
- Necesita **consistencia terminológica** en las traducciones (la misma palabra traducida de la misma manera en todas partes)
- Está traduciendo **contenido específico del dominio** donde las traducciones estándar del LLM son incorrectas (legal, médico, educativo)

## Cómo funciona

1. **Cargue un diccionario bilingüe** — pares clave→valor que asignan términos fuente a traducciones objetivo verificadas
2. **Coincida el texto fuente con el diccionario** — identifique términos en la entrada que tengan traducciones conocidas
3. **Inyecte coincidencias en el prompt** — dígale al LLM "estos términos DEBEN traducirse de la siguiente manera"
4. **El LLM genera la traducción** — con restricciones de diccionario como requisitos obligatorios
5. **Post-procesamiento** — verifique que los términos del diccionario aparezcan en la salida; reintente si no lo hacen

## Formato del Diccionario

```json title="dictionaries/crk-terms.json"
{
  "school": "kiskinwahamâtowikamik",
  "teacher": "okiskinwahamâkêw",
  "student": "kiskinwahamâkan",
  "book": "masinahikan",
  "home": "kīwēwin",
  "water": "nipiy"
}
```

## Estructura del Prompt

```
Translate the following English to Plains Cree (SRO).

REQUIRED TERMINOLOGY — use these exact translations:
- "school" → "kiskinwahamâtowikamik"
- "teacher" → "okiskinwahamâkêw"

Source: "The teacher went to the school"
```

## Decisiones de Diseño Clave

**Estrategia de coincidencia:** La coincidencia exacta es la más simple. La coincidencia lematizada ("teachers" coincide con "teacher") captura más pero requiere un lematizador del idioma fuente. La coincidencia difusa arriesga falsos positivos.

**Manejo de inflexión:** En idiomas polisintéticos, la forma del diccionario puede necesitar inflexión para ajustarse a la oración. Puede proporcionar la raíz y dejar que el LLM inflexione, o proporcionar múltiples formas inflexionadas. Un [FST](./fst-gated-pipeline) puede validar el resultado.

**Resolución de conflictos:** ¿Qué pasa si el LLM ignora un término del diccionario? Opciones: (a) reintentar con instrucción más fuerte, (b) post-procesamiento por reemplazo de cadena, (c) aceptar y marcar para revisión.

## Ventajas y Desventajas

| | |
|---|---|
| ✅ Elimina alucinaciones para términos conocidos | ❌ La cobertura del diccionario siempre es incompleta |
| ✅ Garantiza consistencia para vocabulario clave | ❌ La inflexión/conjugación puede no coincidir con el contexto de la oración |
| ✅ Fácil de auditar y actualizar | ❌ El exceso de restricciones puede producir salida poco natural |
| ✅ El diccionario es un activo reutilizable | ❌ Requiere que exista un diccionario en primer lugar |

## Dónde Encontrar Diccionarios

- **[itwêwina](https://itwewina.altlab.app/)** — cree de las llanuras–inglés (impulsado por FST; la plataforma morphodict es de código abierto — el contenido del diccionario en sí no tiene licencia abierta)
- **[Wolvengrey, *nêhiyawêwin: itwêwina / Cree: Words*](https://uofrpress.ca/Books/C/Cree-Words)** — referencia exhaustiva del cree de las llanuras (University of Regina Press)
- **[Apertium](https://www.apertium.org/)** — diccionarios bilingües para docenas de pares de idiomas
- **[Giellatekno](https://giellalt.github.io/)** — diccionarios para lenguas sami, urálicas y otras lenguas minoritarias
- Glosarios creados por la comunidad, materiales educativos, listas de términos

## Se Combina Bien Con

- **[Coached LLM Prompting](./coached-llm-prompting)** — las entradas del diccionario son una forma de datos de coaching
- **[FST-Gated Pipeline](./fst-gated-pipeline)** — FST valida que los términos del diccionario estén correctamente inflexionados
- **[Rule-Based + LLM Hybrid](./rule-based-hybrid)** — búsqueda de diccionario determinista como una capa de regla

## Consulte también

- [Support a Low-Resource Language](/docs/network/community/low-resource-languages) — el contexto completo
- [Method Interface](/docs/network/specifications/methods) — cómo se estructuran los métodos
