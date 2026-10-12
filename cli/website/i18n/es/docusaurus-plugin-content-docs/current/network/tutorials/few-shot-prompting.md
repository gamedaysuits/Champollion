---
sidebar_position: 3
title: "Recetario: Prompting con Pocos Ejemplos"
---

# Indicaciones con Pocos Ejemplos

> **La idea:** Incluir pares de traducción verificados y de alta calidad como ejemplos en contexto para que el modelo de lenguaje aprenda los patrones, estilo y convenciones del idioma de destino mediante demostración en lugar de instrucción.

:::info[Este es un libro de recetas, no una implementación terminada]
Esta guía esboza el enfoque y sus decisiones de diseño clave. Adáptela a su par de idiomas y recursos disponibles.
:::

## Cuándo Usar Esto

- Tiene un **conjunto pequeño de traducciones verificadas** (incluso 5–10 pares de referencia ayudan)
- Desea que el modelo de lenguaje coincida con un **estilo o registro específico** mediante ejemplo en lugar de regla
- Su idioma de destino tiene patrones que son **más fáciles de mostrar que de describir** (orden de palabras, patrones de afijación, marcadores de formalidad)

## Cómo Funciona

1. **Curar pares de ejemplo** — seleccionar traducciones de alta calidad origen→destino que demuestren patrones clave
2. **Formatear como ejemplos en contexto** — incluirlos en el indicador del sistema o usuario antes de la solicitud de traducción real
3. **Ejecutar el arnés** — medir si los ejemplos mejoran las métricas en comparación con cero ejemplos
4. **Iterar en la selección de ejemplos** — intercambiar ejemplos para cubrir diferentes modos de fallo

## Estructura de Indicación de Ejemplo

```
You are translating English to Plains Cree (SRO orthography).

Examples of correct translations:
- "Hello" → "tânisi"
- "Thank you" → "kinanâskomitin"  
- "I am going home" → "nikîwân"
- "The children are playing" → "awâsisak mêtawêwak"

Now translate the following:
- "Welcome to the school"
```

## Regla Crítica: Sin Contaminación de Datos de Evaluación

:::danger[NO utilice datos de evaluación como ejemplos few-shot]
Si sus ejemplos provienen del conjunto de datos de evaluación, su método será **descalificado** del leaderboard. Los ejemplos few-shot deben provenir de fuentes independientes — diccionarios, libros de texto, pares verificados por la comunidad, o un conjunto de desarrollo separado. El harness genera una huella digital de su prompt exacto; la contaminación es detectable.
:::

## Decisiones de Diseño Clave

**¿Cuántos ejemplos?** 3–8 es el punto óptimo. Menos ejemplos dan al modelo de lenguaje muy poca señal; más ejemplos consumen la ventana de contexto con rendimientos decrecientes.

**¿Cuáles ejemplos?** Priorice la diversidad sobre la dificultad. Cubra diferentes estructuras de oraciones, longitudes de palabras y características gramaticales. No agrupe ejemplos alrededor de un patrón.

**¿Selección estática vs. dinámica?** Los ejemplos estáticos son más simples. La selección dinámica (elegir ejemplos similares a la entrada actual) puede mejorar la calidad pero agrega complejidad — considere [modelos encadenados](./chained-models) para el paso de recuperación.

## Ventajas y Desventajas

| | |
|---|---|
| ✅ Poderoso para coincidencia de estilo | ❌ La pequeña ventana de contexto limita el número de ejemplos |
| ✅ No requiere entrenamiento | ❌ La selección de ejemplos es un arte, no una ciencia |
| ✅ Funciona con cualquier modelo de lenguaje | ❌ Riesgo de contaminación de datos de evaluación (descalificación) |
| ✅ Fácil de hacer pruebas A/B con diferentes conjuntos de ejemplos | ❌ Los ejemplos pueden no generalizarse a todos los tipos de entrada |

## Se Combina Bien Con

- **[Indicaciones de Modelo de Lenguaje Entrenado](./coached-llm-prompting)** — reglas + ejemplos juntos superan a cualquiera de los dos por separado
- **[Modelo de Lenguaje Aumentado con Diccionario](./dictionary-augmented-llm)** — términos forzados + ejemplos de estilo
- **[Tubería Controlada por FST](./fst-gated-pipeline)** — ejemplos para estilo, FST para corrección morfológica

## Véase También

- [Reglas de Evaluación de MT](/docs/network/leaderboard/rules) — qué se descalifica
- [Conjuntos de Datos de Evaluación](/docs/network/leaderboard/datasets) — sepa qué NO puede usar como ejemplos
- [Apoyar un Idioma de Pocos Recursos](/docs/network/community/low-resource-languages)
