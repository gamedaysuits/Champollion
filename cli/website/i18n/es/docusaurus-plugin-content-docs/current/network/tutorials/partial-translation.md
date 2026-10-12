---
sidebar_position: 10
title: "Recetas: Traducción Parcial (Humana + Máquina)"
---

# Traducción Parcial (Humana + Máquina)

> **La idea:** Traducir manualmente una muestra representativa, demostrar que su método de máquina coincide con el estilo humano en esa muestra, luego traducir automáticamente el resto del volumen. Combina calidad humana con escala de máquina — el humano establece el estándar, la máquina lo sigue.

:::info[Este es un libro de recetas, no una implementación terminada]
Esta guía esboza el flujo de trabajo híbrido humano-máquina. Es especialmente relevante para agencias de traducción, trabajadores de lenguas comunitarias y contextos educativos.
:::

## Cuándo Usar Esto

- Tiene **acceso a hablantes fluidos** pero su tiempo es limitado
- Necesita traducir un **gran volumen** pero solo una pequeña porción necesita ser perfecta
- Quiere **establecer una línea de base de calidad** con traducción humana, luego escalar con MT
- Está trabajando en un **contexto educativo o comunitario** donde la revisión humana de un subconjunto es viable

## Cómo Funciona

```
[Full corpus: 1,000 entries]
        │
        ├── [100 entries] ──→ Human translator ──→ Gold translations
        │                                              │
        │                                              ▼
        │                                    Train / prompt machine
        │                                    method to match style
        │                                              │
        └── [900 entries] ──→ Machine method ──→ Auto translations
                                                       │
                                                       ▼
                                              [Optional: human review
                                               of flagged entries]
```

1. **Seleccione una muestra representativa** — cubra diferentes tipos de oraciones, longitudes y temas
2. **Traduzca la muestra humanamente** — establezca el estándar de oro para estilo, registro y terminología
3. **Configure su método de máquina** — use las traducciones humanas como datos de entrenamiento, ejemplos de pocos disparos o datos de ajuste fino
4. **Califique la máquina en la muestra humana** — ¿coincide la máquina con el estilo del humano?
5. **Traduzca automáticamente el resto** — si la calidad de la máquina es aceptable en la muestra
6. **Revisión humana opcional** — marque los resultados de baja confianza para revisión del hablante

## Aseguramiento de Calidad: La Prueba de Coincidencia de Estilo

```bash
# Translate the human-translated sample with your machine method
mt-eval run \
  --corpus data/human-sample.json \
  --name coached-v3

# Compare: does the machine match the human translator's choices?
# Look at: chrF++ (similarity), FST acceptance (validity),
# and qualitative patterns (register, formality, terminology)
```

## Selección de la Muestra

**Cubra la distribución.** Sus 100 entradas deben incluir:
- Frases cortas (1–3 palabras) y oraciones completas
- Vocabulario común y términos específicos del dominio
- Estructuras simples y complejas
- Múltiples características gramaticales (preguntas, imperativos, condicionales)

**No seleccione solo las fáciles.** La muestra debe incluir entradas con las que su método probablemente tenga dificultades — ahí es donde la calidad humana importa más.

## El Flujo de Trabajo de Revisión Comunitaria

Para comunidades de lenguas indígenas, este enfoque respeta el tiempo del hablante:

1. **El hablante traduce 50–100 entradas** (2–4 horas de trabajo enfocado)
2. **La máquina traduce las 900 restantes** usando el trabajo del hablante como datos de entrenamiento
3. **El hablante revisa las entradas marcadas** — solo aquellas en las que la máquina tuvo menor confianza (otras 1–2 horas)
4. **Resultado:** 1.000 traducciones con calidad casi humana, con ~5 horas de tiempo del hablante en lugar de ~50

## Ventajas y Desventajas

| | |
|---|---|
| ✅ Combina calidad humana con escala de máquina | ❌ Requiere inversión humana inicial |
| ✅ Respeta la disponibilidad limitada del hablante | ❌ La máquina puede no capturar todos los matices estilísticos |
| ✅ Flujo de trabajo natural de aseguramiento de calidad | ❌ Cuello de botella de revisión humana para entradas marcadas |
| ✅ Excelente para contextos comunitarios/educativos | ❌ La selección de muestra afecta la calidad general |

## Se Combina Bien Con

- **[Coached LLM Prompting](./coached-llm-prompting)** — las traducciones humanas informan los datos de entrenamiento
- **[Few-Shot Prompting](./few-shot-prompting)** — traducciones humanas como ejemplos en contexto
- **[Corpus Creation](./corpus-creation)** — la muestra humana ES creación de corpus

## Véase También

- [For Language Communities](/docs/network/community/for-language-communities) — modelo de participación comunitaria
- [Data Sovereignty](/docs/network/sovereignty/data-sovereignty) — propiedad de datos de traducción
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages)
