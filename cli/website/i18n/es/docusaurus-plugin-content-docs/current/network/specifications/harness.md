---
sidebar_position: 2
title: "Eval Harness v2.0"
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "What the harness metrics feed into"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
  - label: "Cookbook: Translate 30 Languages"
    to: https://champollion.dev/docs/tutorials/translate-30-languages
    kind: champollion
    note: "Use the harness to audit registers in production"
---

# Eval Harness v2.0

> **Resumen ejecutivo.** Esta página cubre la instalación, configuración y uso del arnés de evaluación de MT — la herramienta que compara métodos de traducción contra corpus estandarizados y produce tarjetas de ejecución puntuadas. Para definiciones canónicas de métricas, esquemas y protocolo de evaluación, consulte la [Especificación de referencia](/docs/network/specifications/benchmark).

El arnés ejecuta experimentos de traducción y produce tarjetas de ejecución. Maneja la construcción de indicaciones, llamadas a API, puntuación y serialización de resultados — usted proporciona el conjunto de datos y el modelo.

## Instalación

**Requisitos:** Python 3.10+

```bash
pip install mt-eval-harness
```

Esto instala el comando `mt-eval`.

## Uso

```bash
mt-eval run --corpus path/to/dataset.json
```

Esto ejecuta cada entrada del corpus a través del modelo configurado (o complemento de método), puntúa los resultados y escribe un archivo JSON de tarjeta de ejecución en el directorio de salida.

## Banderas CLI

### `mt-eval run`

| Bandera | Requerida | Predeterminado | Descripción |
|------|----------|---------|-------------|
| `--corpus` | ✅ | — | Ruta al archivo de corpus (`.json`, `.jsonl`, `.tsv`) |
| `--source-file` / `--reference-file` | — | — | Archivos de texto paralelo (FLORES+, formato WMT) |
| `-m, --model` | — | `gemini-pro` | Slug del modelo (nombre corto o ID completo de OpenRouter). Se resuelve mediante `shared/model-aliases.json`. Separado por comas para ejecuciones multimodelo |
| `-d, --dataset` | — | `all` | Filtro de conjunto de datos: `all`, nombre de segmento o rango de ID |
| `--ids` | — | — | ID de entrada separados por comas para evaluar |
| `--source-lang` | — | `English` | Nombre del idioma de origen |
| `--target-lang` | — | — | Nombre del idioma de destino |
| `-p, --prompt` | — | `naive` | Versión de indicación (`naive`, `custom`, `champollion`) |
| `--coaching-file` | — | — | Ruta al archivo de texto de indicación de entrenamiento |
| `--coaching` | — | — | Texto de entrenamiento en línea (cadena entrecomillada) |
| `--method` | — | — | Ruta al directorio del complemento de método (contiene `method.json` + módulo Python) |
| `--method-card` | — | — | Ruta al JSON de tarjeta de método para metadatos de tabla de clasificación |
| `--fst-retries` | — | `0` | Número de intentos de reintento de FST (solo método LLM predeterminado) |
| `--skip-fst` | — | `false` | Omitir completamente la puerta de calidad de FST |
| `--tools` | — | `false` | Habilitar modo de llamada de herramienta |
| `--tools-list` | — | — | Nombres de herramientas separados por comas |
| `--max-tool-rounds` | — | `8` | Rondas máximas de llamada de herramienta por entrada |
| `--hooks` | — | — | Nombres de gancho posterior a la traducción |
| `--style-profile` | — | — | Ruta a un JSON de perfil de estilo. Habilita métricas de consistencia de estilo de escritura (informativo — nunca parte de la puntuación compuesta; consulte [§ Métricas de estilo de escritura y registro](#writing-style-and-register-metrics-informational)) |
| `-b, --batch-size` | — | `25` | Entradas por llamada a API |
| `-c, --concurrency` | — | `8` | Llamadas a API paralelas |
| `--max-tokens` | — | `32768` | Tokens máximos por llamada a API |
| `--temperature` | — | `0.0` | Temperatura de muestreo (0.0 = determinista) |
| `--no-cache` | — | `false` | Deshabilitar almacenamiento en caché de respuestas |
| `--cache-dir` | — | `eval/cache/harness` | Ruta del directorio de caché |
| `-o, --output-dir` | — | `eval/logs/harness` | Directorio de salida para tarjetas de ejecución y registros |
| `-n, --name` | — | — | Nombre de ejecución legible por humanos |
| `--dry-run` | — | `false` | Validar configuración sin realizar llamadas a API |
| `--champollion-config` | — | — | Ruta a `champollion.config.json` |
| `--champollion-cards-dir` | — | — | Directorio de tarjetas de idioma |
| `--target-lang-code` | — | — | Código de idioma BCP-47 |

### Cada subcomando

Los dieciocho subcomandos de nivel superior, generados contra `mt_eval_harness/cli.py`
el 2026-08-01. Hasta entonces, esta sección enumeraba siete de ellos, y seis —
incluyendo `node`, el nodo de puntuación del organizador soberano — no estaban documentados
**ni aquí ni en la guía del harness**.

**Ejecutar y puntuar**

| Subcomando | Qué hace |
|---|---|
| `mt-eval run` | Realiza una ejecución de traducción (banderas anteriores) |
| `mt-eval test <log>` | Analiza un registro de ejecución completado |
| `mt-eval compare <logs…>` | Compara múltiples registros de ejecución |
| `mt-eval dashboard <logs…>` | Genera un panel HTML interactivo |
| `mt-eval card <run-card>` | Imprime con formato una tarjeta de ejecución legible para humanos |

**Encuentre su camino hacia un método**

| Subcomando | Qué hace |
|---|---|
| `mt-eval recommend <src> <tgt>` | Orientación de métodos para un par de idiomas: disponibilidad más **evidencia citada**, no una simple clasificación |
| `mt-eval corpora --source X --target Y` | Enumera los corpus de evaluación disponibles para un par |
| `mt-eval list models\|prompts\|datasets` | Enumera los recursos disponibles |

**Contribuir**

| Subcomando | Qué hace |
|---|---|
| `mt-eval publish <report>` | Envía un TestReport a la tabla de clasificación |
| `mt-eval queue` | Ejecuta la parte superior de la cola de cómputo de la comunidad con su propia clave; consulte [Contributing Compute](/docs/network/getting-started/contributing-compute) |
| `mt-eval export` | Empaqueta un TestReport como un plugin de método de champollion |
| `mt-eval generate-plugin` | Alias de `export` |
| `mt-eval export-config` | Genera un fragmento `champollion.config.json` a partir de un TestReport |

**Concursos y cómo organizar uno usted mismo**

| Subcomando | Qué hace |
|---|---|
| `mt-eval contest` | Administra concursos de evaluación: `prepare`, `register`, `create`, `submit`, `submit-hypotheses`, `status`, `list` |
| `mt-eval shared-task` | Marco de edición de tareas compartidas de múltiples pares: una fila agrupa los N concursos por par de una edición al estilo AmericasNLP y contiene sus valores predeterminados de política. **Solo agrupación y valores predeterminados: cada control de acceso se mantiene por concurso** |
| `mt-eval node` | **El nodo de puntuación del organizador.** Sondea la recepción, controla el acceso según el clasificador público, autoriza según la política del concurso, puntúa contra **referencias secretas en poder del organizador**, publica solo las puntuaciones. Este es el comando detrás de [Run a Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest) y el [Sovereign Eval Node](/docs/network/sovereignty/sovereign-eval-node): el corpus nunca sale de la computadora del organizador |

`mt-eval node` tiene diecisiete subcomandos propios, incluyendo el carril airgap
(`import-bundle`, `export-scores`, `relay`, `egress-check`, `manifest`) y la
ceremonia de custodia M-de-N (`ceremony`, `seal`, `keygen`, `sign-manifest`,
`verify-manifest`, `ledger`). Ejecute `mt-eval node --help`; las mecánicas de
soberanía se describen en las dos páginas enlazadas anteriormente.

**Configuración**

| Subcomando | Qué hace |
|---|---|
| `mt-eval setup` | Instala dependencias opcionales (métrica neuronal COMET, entorno de ejecución FST) |
| `mt-eval logout` | Elimina las credenciales de autenticación almacenadas |

### Ejemplos

```bash
# Run with defaults (gemini-pro alias → google/gemini-3.1-pro-preview, naive prompt)
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1

# Coached experiment with coaching file
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro \
  --coaching-file prompts/crk-coaching-v8.txt \
  --temperature 0.0

# Run a custom method plugin with FST retries
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --method ./methods/fst-gated-pipeline \
  --fst-retries 3
```

---

## Esquema de tarjeta de ejecución

Cada experimento produce una **tarjeta de ejecución** — un documento JSON independiente. La estructura de nivel superior:

```json
{
  "run_id": "uuid-v4",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro",
  "model_id": "gemini-3.1-pro-001",
  "condition": "baseline",
  "timestamp": "2026-06-01T03:22:41Z",
  "elapsed_seconds": 142.7,
  "dataset": { ... },
  "config": { ... },
  "method_card": { ... },
  "system_prompt_sha256": "abc123...",
  "system_prompt_used": "You are a translator...",
  "fingerprint": { ... },
  "scores": { ... },
  "totals": { ... },
  "environment": { ... },
  "results": [ ... ],
  "run_card_hash": "sha256-of-entire-card"
}
```

Consulte la [Especificación de tarjeta de ejecución](/docs/network/specifications/run-card) para el esquema completo con cada campo documentado.

:::info[Esquema Autorizado]
La [Especificación de Benchmark](/docs/network/specifications/benchmark) es la única fuente de verdad para el esquema de tarjeta de ejecución. Para definiciones de métricas, pesos compuestos y niveles de calidad, consulte la [Especificación de Puntuación](/docs/network/specifications/scoring). Esta página documenta cómo usar el harness; las especificaciones definen qué significan los resultados.
:::

### Bloques clave

**`dataset`** — Identifica qué conjunto de datos se utilizó, incluido su hash de contenido para que los resultados estén vinculados a una versión específica:

```json
// Example using textbook_dev.json — the 436-entry textbook dev split
{
  "id": "edtekla-dev-v1",
  "version": "1.0",
  "language_pair": "EN→CRK",
  "sha256": "...",
  "entry_count": 436
}
```

**`scores`** — Métricas agregadas para la ejecución:

```json
// Counts reflect the dataset used (here: textbook_dev.json, 436 entries)
{
  "total": 436,
  "exact_matches": 12,
  "exact_match_rate": 0.0968,
  "fst_accepted": 87,
  "fst_acceptance_rate": 0.7016,
  "chrf_plus_plus": 42.31,
  "errors": 0,
  "avg_latency_seconds": 1.15,
  "median_latency_seconds": 1.02,
  "p95_latency_seconds": 2.34,
  "by_difficulty": { ... },
  "by_provenance": { ... }
}
```

**`totals`** — Seguimiento de uso de tokens y costos:

```json
{
  "prompt_tokens": 48200,
  "completion_tokens": 3100,
  "reasoning_tokens": 0,
  "cached_tokens": 12000,
  "total_cost_usd": 0.42,
  "cost_per_entry_usd": 0.0034,
  "reasoning_ratio": 0.0
}
```

---

## Métricas de estilo de escritura y registro (informativo) {#writing-style-and-register-metrics-informational}

El arnés puede evaluar si las traducciones coinciden con un **registro** y **estilo de escritura** objetivo, mediante el complemento de métrica `WritingStyleConsistency` (`mt_eval_harness/plugins/writing_style.py`). Una traducción puede ser lingüísticamente correcta pero en el registro incorrecto — fraseología informal en un documento legal, texto estándar formal en copia de marketing — y las métricas de cadena no lo notarán. Estas métricas sí.

**Lo que se mide (por entrada):**

| Métrica | Escala | Significado |
|--------|-------|---------|
| `style_register_match` | booleano | ¿El resultado coincide con el registro esperado? El objetivo proviene del campo `register` de la entrada del corpus (consulte [Especificación de referencia §2.6](/docs/network/specifications/benchmark)) o de un perfil de estilo |
| `style_sentence_length_ratio` | flotante | Longitud promedio de oración predicha vs referencia (1.0 = coincidencia; divergencia = desviación de estilo) |
| `style_formality_score` | 0.0–1.0 | Presencia de marcadores formales/informales (pronombres T–V, contracciones, …) usando recursos de marcadores por idioma |

**Agregado:** `style_consistency_rate` — la fracción de entradas sin desajuste de registro detectado.

Habilite un objetivo personalizado con `--style-profile path/to/profile.json` (por ejemplo, un perfil de voz de marca); sin uno, el complemento recurre a los metadatos `register` de cada entrada del corpus donde estén presentes.

:::caution[Alcance honesto]
Estas métricas son **solo informativas** — nunca forman parte de la puntuación compuesta, y la detección de formalidad se basa en marcadores (una heurística), no en un juicio aprendido. Trátelas como un detector de desviación para la adherencia al registro, no como un veredicto sobre la calidad del estilo.
:::

---

## Huella digital vs hash de tarjeta de ejecución {#fingerprint-vs-run-card-hash}

El arnés produce dos hashes distintos. Sirven para propósitos diferentes:

### Huella digital

La **huella digital** responde: *"¿Podría reproducirse esta ejecución?"*

Genera un hash de la combinación de entradas que definen la configuración del experimento — no los resultados:

- SHA-256 del conjunto de datos
- Slug del modelo
- Etiqueta de condición
- SHA-256 del indicador del sistema
- Temperatura
- Versión del arnés

Dos ejecuciones con huellas digitales idénticas utilizaron la misma configuración. Sus resultados deben ser comparables (módulo no determinismo de API).

### Hash de tarjeta de ejecución

El **hash de tarjeta de ejecución** responde: *"¿Ha sido manipulado este archivo de resultado específico?"*

Es el SHA-256 de todo el JSON de tarjeta de ejecución (excluyendo el campo `run_card_hash` en sí). Si algún campo cambia — una puntuación, una marca de tiempo, un único resultado — el hash se rompe.

:::info[Cuándo usar cuál]
Use la **huella digital** para agrupar ejecuciones comparables (mismo experimento, ejecuciones diferentes). Use el **hash de tarjeta de ejecución** para verificar la integridad de un archivo de resultado específico.
:::

---

## Publicación en la tabla de clasificación

Después de completar una ejecución, use `mt-eval publish` para enviar la tarjeta de ejecución:

```bash
mt-eval publish eval/logs/harness/your-run-card.json
```

Si no se proporcionó `--method-card` durante la ejecución, `mt-eval publish` inicia un asistente interactivo (`method_card_wizard.py`) que lo guía a través de la descripción de su método (nombre, clase, herramientas utilizadas, etc.). La salida del asistente se incrusta en la tarjeta de ejecución antes del envío.

### Inspección manual

Las tarjetas de ejecución se guardan como archivos JSON en el directorio de salida (`eval/logs/harness/` por defecto) — inspecciónelas allí antes de publicar. `mt-eval publish` es la ruta de envío; no hay ingesta de tarjeta de ejecución basada en PR.

:::note[La API de envío y la carga web del Leaderboard aún no están activas]
Un endpoint `POST https://champollion.dev/api/leaderboard/submit` y una interfaz de carga del Leaderboard están planeados pero **aún no implementados**. Hasta que se lancen, la única ruta de envío que funciona es `mt-eval publish`.
:::

:::warning[Validación del Leaderboard]
El leaderboard valida las tarjetas de ejecución enviadas contra el registro de conjuntos de datos. Los envíos que hacen referencia a conjuntos de datos desconocidos, o con un `run_card_hash` roto, son rechazados.
:::

:::danger[NO ENTRENE con datos de evaluación]
Si su método ha visto el conjunto de datos de evaluación durante el desarrollo — como datos de entrenamiento, ejemplos few-shot, entradas de diccionario o material de ingeniería de prompts — su envío será **descalificado**. Consulte [MT Evaluation](/docs/network/leaderboard/rules) para saber qué hace que un método sea bueno o malo.
:::

---

## Consulte también

- [Evaluación de MT](/docs/network/leaderboard/rules) — descripción general, propuesta de valor de tabla de clasificación y orientación de método bueno/malo
- [Conjuntos de datos de evaluación](/docs/network/leaderboard/datasets) — formato de conjunto de datos, EDTeKLA, FLORES+
- [Especificación de tarjeta de ejecución](/docs/network/specifications/run-card) — el esquema JSON completo
- [Construcción de un método](/docs/network/specifications/methods) — la interfaz de método para crear métodos evaluables
- [Tabla de clasificación de métodos](https://champollion.dev/leaderboard) — puntuaciones de referencia en vivo
- [Especificación de referencia](/docs/network/specifications/benchmark) — protocolo de evaluación, formato de corpus, esquema de tarjeta de ejecución
- [Especificación de puntuación](/docs/network/specifications/scoring) — SSOT para métricas, pesos compuestos y niveles de calidad
