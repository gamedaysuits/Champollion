---
sidebar_position: 9
title: "Recetario: Evolutivo / Basado en Búsqueda"
---

# Traducción Evolutiva / Basada en Búsqueda

> **La idea:** Generar múltiples traducciones candidatas, puntuarlas contra una función de aptitud (chrF++, aceptación FST, consistencia de traducción inversa), mutar los mejores desempeños, y repetir. Selección natural para traducciones — los más aptos sobreviven.

:::info[Este es un libro de recetas, no una implementación finalizada]
Este es el enfoque más experimental de la serie de libros de recetas. No ha sido probado para MT a escala, pero la arquitectura es sólida y el arnés puntuará felizmente lo que produzca.
:::

## Cuándo Usar Esto

- Tiene una **buena función de puntuación** pero ningún modelo individual produce resultados consistentes
- Desea **explorar el espacio de soluciones** de manera más amplia que una única generación codiciosa
- Tiene **presupuesto computacional** para muchas generaciones paralelas (docenas de candidatos por entrada)
- Le interesa la **investigación novedosa** — este enfoque está poco explorado para MT de bajo recurso

## Cómo Funciona

```
[Generation 0]    Generate N candidates (different models, temperatures, prompts)
       │
       ▼
[Score]           Evaluate each candidate: chrF++, FST acceptance, fluency
       │
       ▼
[Select]          Keep top K performers
       │
       ▼
[Mutate]          Prompt an LLM: "improve this translation, fix these issues"
       │
       ▼
[Generation 1]    Score again. Repeat for G generations.
       │
       ▼
[Output]          Best-scoring candidate from final generation
```

## Esqueleto

```python
async def evolutionary_translate(source, reference=None, generations=3, pop_size=8):
    # Generation 0: diverse candidates
    population = []
    for model in ["gemini-2.5-pro", "gpt-4o", "claude-sonnet-4-6"]:
        for temp in [0.3, 0.7, 1.0]:
            candidate = await translate(source, model=model, temperature=temp)
            population.append(candidate)
    
    for gen in range(generations):
        # Score each candidate
        scored = [(c, score(c, reference)) for c in population]
        scored.sort(key=lambda x: x[1], reverse=True)
        
        # Select top K
        survivors = [c for c, s in scored[:pop_size // 2]]
        
        # Mutate: ask LLM to improve each survivor
        mutants = []
        for survivor in survivors:
            mutant = await improve(source, survivor, feedback=scored[0])
            mutants.append(mutant)
        
        population = survivors + mutants
    
    return max(population, key=lambda c: score(c, reference))
```

## Diseño de la Función de Aptitud

La función de aptitud lo es todo. Opciones:

| Métrica | Qué Mide | ¿Automatizada? |
|---------|----------|----------------|
| chrF++ contra referencia | Similitud a nivel de caracteres con el estándar de oro | ✅ Sí |
| Tasa de aceptación FST | Validez morfológica | ✅ Sí (si FST está disponible) |
| Consistencia de traducción inversa | ¿Se recupera la fuente al traducir de vuelta? | ✅ Sí |
| LLM como juez | Otro LLM califica fluidez/precisión | ✅ Sí (pero ruidoso) |
| Presencia de términos de diccionario | ¿Aparecen correctamente los términos conocidos? | ✅ Sí |

:::tip[Combine múltiples señales]
Una combinación ponderada de métricas crea una función de aptitud más robusta que cualquier métrica individual. Esto refleja la [puntuación compuesta](/docs/network/leaderboard/rules) del propio arnés.
:::

## Ventajas y Desventajas

| | |
|---|---|
| ✅ Explora soluciones diversas | ❌ Computacionalmente costoso (N × G llamadas API) |
| ✅ Puede descubrir enfoques que ningún modelo individual encuentra | ❌ Requiere una buena función de aptitud |
| ✅ Paralelizable | ❌ Lento — múltiples generaciones por traducción |
| ✅ Agnóstico del modelo | ❌ Rendimientos decrecientes después de pocas generaciones |

## Se Combina Bien Con

- **[Modelos Encadenados](./chained-models)** — el paso de mutación es una forma de encadenamiento
- **[Tubería Controlada por FST](./fst-gated-pipeline)** — aceptación FST como señal de aptitud
- **[LLM Aumentado con Diccionario](./dictionary-augmented-llm)** — presencia de diccionario como señal de aptitud

## Véase También

- [Especificación de Tarjeta de Ejecución](/docs/network/specifications/run-card) — el costo y la latencia se registran por entrada
- [Arnés de Evaluación](/docs/network/specifications/harness) — el arnés puntúa su salida final, no su proceso
- [Soporte para Idiomas de Bajo Recurso](/docs/network/community/low-resource-languages)
