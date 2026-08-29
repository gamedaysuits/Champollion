---
sidebar_position: 6
title: "Recetario: Modelos Encadenados"
---

# Modelos Encadenados (Pipeline Multi-Etapa)

> **La idea:** El Modelo A genera una traducción aproximada → El Modelo B la post-edita → El Modelo C la califica o valida. Cada etapa se especializa en una cosa. La salida del pipeline es mejor que la de cualquier modelo individual.

:::info[Este es un libro de recetas, no una implementación terminada]
Esta guía esboza la arquitectura de una canalización de múltiples etapas. Los modelos específicos y la configuración de la cadena dependen de su par de idiomas y presupuesto.
:::

## Cuándo Usar Esto

- Un modelo individual produce **calidad inconsistente** — buena en algunas entradas, mala en otras
- Desea **separar la generación de la validación** — un modelo crea, otro critica
- Tiene presupuesto para **múltiples llamadas a API por traducción** (la latencia y el costo escalan linealmente con las etapas)
- Desea combinar modelos con **fortalezas diferentes** (p. ej., un generador creativo + un editor preciso)

## Cómo Funciona

```
Input ──→ [Stage 1: Generator] ──→ [Stage 2: Editor] ──→ [Stage 3: Validator] ──→ Output
              │                         │                        │
              │ "Translate this"        │ "Fix errors in         │ "Rate 1-5 and
              │                         │  this translation"     │  flag issues"
              ▼                         ▼                        ▼
         Raw translation          Polished translation      Score + accept/reject
```

## Ejemplo: Pipeline de Tres Etapas

```python
# Stage 1: Fast model generates candidate
raw = await fast_model.translate(source, target_lang="crk")

# Stage 2: Strong model post-edits
edited = await strong_model.complete(
    f"The following {target_lang} translation may contain errors. "
    f"Fix any grammatical or vocabulary mistakes:\n"
    f"Source: {source}\nTranslation: {raw}\nCorrected:"
)

# Stage 3: Validator model scores
score = await validator.complete(
    f"Rate this translation 1-5 for accuracy and fluency:\n"
    f"Source: {source}\nTranslation: {edited}\nScore:"
)

# Accept if score >= 3, otherwise retry Stage 1 with different temperature
```

## Patrones de Cadena Comunes

| Patrón | Etapas | Caso de Uso |
|---------|--------|----------|
| **Generar → Editar** | LLM rápido → LLM fuerte | Mejora de calidad eficiente en costo |
| **Generar → Validar → Reintentar** | LLM → FST/reglas → LLM (reintentar si falla) | Corrección morfológica (ver [FST-Gated](./fst-gated-pipeline)) |
| **Generar → Retrotraducir → Calificar** | LLM(en→crk) → LLM(crk→en) → comparar | Verificación de consistencia de viaje redondo |
| **Conjunto → Votación** | 3 LLMs independientes → voto mayoritario | Robustez a través de diversidad |

## Decisiones de Diseño Clave

**Presupuesto de latencia:** Cada etapa multiplica la latencia. Una cadena de 3 etapas con 2s por etapa = 6s por traducción. Para evaluación por lotes esto está bien; para tiempo real puede no serlo.

**Multiplicador de costo:** 3 etapas = 3× el costo de API. Use modelos más económicos para las primeras etapas, modelos costosos para las etapas críticas.

**Propagación de errores:** Una salida deficiente de la Etapa 1 puede confundir a la Etapa 2. Incluya la fuente original en cada etapa para que los modelos posteriores puedan recuperarse.

## Ventajas y Desventajas

| | |
|---|---|
| ✅ Puede combinar fortalezas especializadas | ❌ La latencia y el costo se multiplican por etapa |
| ✅ Separación de responsabilidades (generar vs. validar) | ❌ Complejo de depurar — ¿qué etapa introdujo el error? |
| ✅ Fácil de intercambiar etapas individuales | ❌ Propagación de errores entre etapas |
| ✅ La validación de viaje redondo detecta alucinaciones | ❌ Rendimientos decrecientes más allá de 2-3 etapas |

## Se Combina Bien Con

- **[FST-Gated Pipeline](./fst-gated-pipeline)** — FST como etapa de validación
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — inyección de diccionario en la etapa de generación
- **[Coached LLM Prompting](./coached-llm-prompting)** — coaching en una o más etapas

## Véase También

- [Eval Harness](/docs/network/specifications/harness) — el arnés mide la salida del pipeline de extremo a extremo
- [Run Card Specification](/docs/network/specifications/run-card) — la latencia y el costo se registran por entrada
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages)
