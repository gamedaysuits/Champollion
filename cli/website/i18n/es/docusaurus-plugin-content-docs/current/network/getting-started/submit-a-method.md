---
sidebar_position: 1
title: "Enviar un Método"
related:
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: spec
    note: "The contract your method implements"
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
    note: "What every published run must disclose"
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Cookbook: Few-Shot Prompting"
    to: /docs/network/tutorials/few-shot-prompting
    kind: cookbook
    note: "The fastest first method to submit"
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: guide
---

# Enviar un Método

> **Resumen Ejecutivo.** Una guía paso a paso para enviar su primera ejecución de benchmark al tablero de clasificación. Instale el harness, ejecútelo contra un conjunto de datos, revise su tarjeta de ejecución y publique. Toma 10 minutos si tiene una clave API.

Esta guía lo acompaña a través del envío de su primera ejecución de benchmark al tablero de clasificación de la Red.

---

## Requisitos previos

- **Python 3.11+**
- **Una clave API de OpenRouter** (o equivalente para su proveedor de modelo)
- **Un método de traducción** — cualquier cosa que produzca traducciones a partir de un texto fuente

```bash
# Install the eval harness (provides the `mt-eval` command)
pip install mt-eval-harness
```

---

## Paso 1: Ejecutar el Harness

El harness califica su método contra un conjunto de datos estandarizado:

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model gemini-pro \
  --name your-method-name \
  --temperature 0.2
```

| Bandera | Qué hace |
|---|---|
| `--corpus` | Ruta del archivo de corpus o id de corpus registrado (`.json`, `.jsonl`, `.tsv`) |
| `--model` | Slug del modelo — alias corto (p. ej. `gemini-pro`) o ID completo de OpenRouter |
| `-n, --name` | Etiqueta legible por humanos para su ejecución (aparece en el tablero de clasificación) |
| `--temperature` | Temperatura de muestreo (menor = más determinístico) |
| `--fst-retries` | Opcional: número de intentos de reintento de FST |
| `--publish` | Publicar la tarjeta de ejecución en el tablero de clasificación cuando finalice la ejecución |

El harness produce una **tarjeta de ejecución** — un archivo JSON independiente con sus puntuaciones, el hash del conjunto de datos, el slug del modelo y una huella digital criptográfica que vincula los resultados a la configuración exacta del experimento.

---

## Paso 2: Revisar su Tarjeta de Ejecución

Las tarjetas de ejecución se guardan en `eval/logs/harness/`. Inspeccione la suya antes de enviarla:

```bash
cat eval/logs/harness/your-run-card.json | python -m json.tool
```

Campos clave a verificar:
- `scores.chrf_plus_plus` — su métrica de calidad principal
- `scores.exact_match_rate` — proporción de traducciones perfectas
- `scores.fst_acceptance_rate` — validez morfológica (si se utilizó FST)
- `totals.total_cost_usd` — cuál fue el costo de la ejecución
- `fingerprint` — el hash de reproducibilidad del experimento

Consulte la [Especificación de Tarjeta de Ejecución](/docs/network/specifications/run-card) para el esquema completo.

---

## Paso 3: Enviar

### Publicación automática

Si pasó `--publish` al ejecutar el harness, su tarjeta de ejecución ya fue cargada.

### Publicación manual

Publique cualquier tarjeta de ejecución con el harness:

```bash
mt-eval publish eval/logs/harness/your-run-card.json
```

Si prefiere no usar el flujo de publicación, abra una solicitud de extracción contra el
[repositorio del harness de evaluación](https://github.com/gamedaysuits/Champollion)
con su JSON de tarjeta de ejecución en el directorio `results/`.

:::note[La API de envío y la carga web aún no están disponibles]
Un endpoint `POST https://champollion.dev/api/leaderboard/submit` y una
interfaz de carga del Leaderboard están planeados pero **aún no se han implementado**. Hasta que se lancen,
las únicas rutas de envío que funcionan son `mt-eval publish` y una solicitud de extracción al
repositorio harness anterior.
:::

---

## Qué sucede a continuación

1. Su envío es validado (hash del dataset, integridad de la run card)
2. Los resultados aparecen en la tabla de clasificación como **Self-benchmarked** (nivel de confianza 1)
3. Para obtener el estado **Champollion Verified**, envíe su método como un plugin instalable para que los mantenedores puedan reproducir sus resultados
4. Para los métodos de lenguas indígenas: si su método alcanza el primer lugar, comienza el proceso de [transferencia de propiedad](/docs/network/sovereignty/ownership-transfer)

---

## Consulte también

- [Uso del Harness](/docs/network/specifications/harness) — referencia completa de CLI
- [Reglas del Tablero de Clasificación](/docs/network/leaderboard/rules) — criterios de envío y políticas contra manipulación
- [Construir un Método](/docs/network/specifications/methods) — el protocolo TranslationMethod
- [Conjuntos de Datos](/docs/network/leaderboard/datasets) — conjuntos de datos de evaluación disponibles
