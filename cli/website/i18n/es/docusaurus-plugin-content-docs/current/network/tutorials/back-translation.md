---
sidebar_position: 8
title: "Recetario: Aumento mediante Retrotraducción"
---

# Aumento por Retrotraducción

> **La idea:** Generar datos paralelos sintéticos traduciendo texto existente en idioma de destino de vuelta al idioma de origen, y luego usar estos pares sintéticos para entrenar o indicar un modelo directo. Esto expande su corpus paralelo económicamente — pero con advertencias sobre la calidad.

:::info[Este es un libro de recetas, no una implementación terminada]
Esta guía esboza la estrategia y sus trampas críticas. La retrotraducción es poderosa pero puede amplificar errores si no se realiza cuidadosamente.
:::

## Cuándo Usar Esto

- Tiene **texto monolingüe en idioma de destino** pero datos paralelos limitados
- Desea **expandir un corpus de entrenamiento** para [ajuste fino](./fine-tuned-model) sin traducción manual
- Necesita **más ejemplos de few-shot** pero no puede obtener traducciones humanas lo suficientemente rápido
- Está dispuesto a **filtrar por calidad** los datos sintéticos agresivamente

## Cómo Funciona

```
[Target-language text]          "awâsisak mêtawêwak"
        │
        ▼
[Back-translate to source]      "The children are playing"  (via LLM or MT API)
        │
        ▼
[Create synthetic pair]         ("The children are playing", "awâsisak mêtawêwak")
        │
        ▼
[Quality filter]                Keep only high-confidence pairs
        │
        ▼
[Use for training/prompting]    Expand your parallel corpus
```

1. **Recopilar texto monolingüe** — libros, artículos, transcripciones y redes sociales en idioma de destino
2. **Retrotraducir** — usar un LLM o API de MT para traducir cada oración al idioma de origen
3. **Filtrar por calidad** — hacer un viaje de ida y vuelta (traducir de nuevo) y comparar; mantener pares donde el viaje de ida y vuelta ≈ original
4. **Usar el corpus sintético** — para ajuste fino, ejemplos de few-shot o datos de coaching

## Filtrado de Calidad: La Prueba de Viaje de Ida y Vuelta

```python
# Pseudo-code for round-trip quality filtering
for target_text in monolingual_corpus:
    # Back-translate: target → source
    synthetic_source = translate(target_text, "crk", "en")
    
    # Forward-translate: source → target
    round_trip = translate(synthetic_source, "en", "crk")
    
    # Compare round-trip to original
    chrf_score = compute_chrf(target_text, round_trip)
    
    if chrf_score > 0.70:  # High similarity = high-quality pair
        parallel_corpus.append((synthetic_source, target_text))
```

## Trampa Crítica: Amplificación de Errores

:::warning[La retrotraducción amplifica los sesgos existentes del modelo]
Si su modelo de retrotraducción comete consistentemente los mismos errores, su corpus sintético codificará esos errores como "correctos". Esto crea un bucle de retroalimentación: entrenar con datos malos → producir traducciones peores → generar datos sintéticos peores. **Siempre filtre la calidad de manera agresiva** y mezcle datos sintéticos con traducciones humanas verificadas.
:::

## Dónde Encontrar Texto Monolingüe

- Boletines comunitarios, periódicos y publicaciones
- Documentos gubernamentales en idioma de destino (p. ej., Nunavut Hansard para inuktitut)
- Materiales educativos y libros de texto
- Textos religiosos (ampliamente disponibles para muchos idiomas)
- Redes sociales (con permisos apropiados y filtrado de calidad)
- Audio/video transcrito de programas de idiomas

## Ventajas y Desventajas

| | |
|---|---|
| ✅ Expande datos de entrenamiento económicamente | ❌ Amplifica errores del modelo si no se filtra |
| ✅ Utiliza texto monolingüe abundante | ❌ El techo de calidad está limitado por el modelo de retrotraducción |
| ✅ Fácil de generar a escala | ❌ El filtrado de viaje de ida y vuelta consume muchos recursos computacionales |
| ✅ Complementa otros enfoques | ❌ Los datos sintéticos nunca son tan buenos como la traducción humana |

## Se Combina Bien Con

- **[Modelo Ajustado Finamente](./fine-tuned-model)** — la retrotraducción crea datos de entrenamiento para ajuste fino
- **[Creación de Corpus](./corpus-creation)** — datos sintéticos complementan corpus creados por humanos
- **[Indicación de LLM Entrenado](./coached-llm-prompting)** — ejemplos sintéticos pueden informar diccionarios de coaching

## Véase También

- [Conjuntos de Datos de Evaluación](/docs/network/leaderboard/datasets) — los datos sintéticos no deben superponerse con datos de evaluación
- [Reglas del Leaderboard](/docs/network/leaderboard/rules) — política de contaminación
- [Apoyar un Idioma de Bajo Recurso](/docs/network/community/low-resource-languages)
