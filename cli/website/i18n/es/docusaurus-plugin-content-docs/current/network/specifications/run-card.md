---
sidebar_position: 4
title: "Especificación de Tarjeta de Ejecución"
---

# Especificación de Tarjeta de Ejecución

> **Resumen Ejecutivo.** La tarjeta de ejecución es la unidad atómica de evaluación comparativa — un documento JSON que registra la configuración completa, resultados por entrada y puntuaciones agregadas de una ejecución de evaluación. Esta página documenta el esquema, campos, mecanismo de huella digital y estructura de puntuaciones. Consulte la [Especificación de Evaluación Comparativa](/docs/network/specifications/benchmark) para definiciones canónicas.

La tarjeta de ejecución es el registro completo de una única ejecución de evaluación. Contiene todo lo necesario para entender, reproducir y verificar el experimento: configuración, puntuaciones, resultados individuales, uso de tokens y metadatos del entorno.

**Versión del esquema:** 2.0

:::info[Esquema canónico]
La [Especificación del Benchmark](/docs/network/specifications/benchmark) es la única fuente de verdad para el esquema de la run card. Para conocer las definiciones de las métricas y cómo se puntúan las ejecuciones (la métrica principal chrF++, las métricas estándar junto a ella, los diagnósticos), consulte la [Especificación de Puntuación](/docs/network/specifications/scoring). Esta página documenta la implementación actual.
:::

---

## Campos de Nivel Superior

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `run_id` | `string` | UUID v4 generado al inicio de la ejecución |
| `harness_version` | `string` | Versión semántica del harness que produjo esta tarjeta (p. ej., `2.0`) |
| `model_slug` | `string` | Slug del modelo utilizado para la ejecución (p. ej., `google/gemini-3.1-pro-preview`) |
| `model_id` | `string` | Identificador resuelto del modelo devuelto por la API (p. ej., `gemini-3.1-pro-001`) |
| `condition` | `string` | Etiqueta del experimento: lo que el harness escribe es `naive` (su prompt integrado), `coached` (un archivo de coaching lo reemplazó) o, para un plugin de método, su clase de método; texto libre, por lo que una tarjeta creada manualmente puede indicar `coached-v3` o `few-shot`. No es una etiqueta de calidad (los niveles de calidad fueron retirados; `scores.quality_tier` es null en cada tarjeta nueva) |
| `timestamp` | `string` | Marca de tiempo UTC en formato ISO 8601 de cuándo inició la ejecución |
| `elapsed_seconds` | `number` | Duración de tiempo real (wall-clock) de toda la ejecución |

```json
{
  "run_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro-preview",
  "model_id": "gemini-3.1-pro-001",
  "condition": "naive",
  "timestamp": "2026-06-01T03:22:41Z",
  "elapsed_seconds": 142.7
}
```

---

## `dataset`

Identifica el conjunto de datos de evaluación y lo fija a una versión de contenido específica mediante SHA-256.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `string` | Identificador del conjunto de datos (p. ej., `edtekla-dev-v1`) |
| `version` | `string` | Cadena de versión del conjunto de datos |
| `language_pair` | `string` | Etiqueta de visualización (p. ej., `EN→CRK`) |
| `sha256` | `string` | Hash SHA-256 del contenido del archivo del conjunto de datos. Garantiza los datos exactos utilizados |
| `entry_count` | `number` | Número de entradas en el conjunto de datos |

```json
// Example using textbook_dev.json — the 436-entry textbook dev split
{
  "dataset": {
    "id": "edtekla-dev-v1",
    "version": "1.0",
    "language_pair": "EN→CRK",
    "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "entry_count": 436
  }
}
```

---

## `config`

La configuración de API y procesamiento por lotes utilizada para esta ejecución.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `api_provider` | `string` | Lo que transportó el texto: el proveedor de API para la ruta de LLM propia del harness (`openrouter`, `openai`, `anthropic`, `gemini`, `local`); el id del motor para un motor de MT (p. ej., `google-translate`); para un plugin de método, `local` cuando su operador certificó un transporte totalmente local (`--attest-local-transport`), de lo contrario `method-plugin` |
| `temperature` | `number` | Temperatura de muestreo |
| `max_tokens` | `number` | Tokens máximos por completación |
| `batch_size` | `number` | Entradas por lote concurrente |
| `concurrency` | `number` | Máximo de solicitudes de API en paralelo |
| `coaching_file` | `string` | Ruta al archivo de prompt de coaching, si se utilizó (el registro propio del log de ejecución; una run card publicada nombra el coaching por nombre de archivo, o `inline coaching` para texto `--coaching` — nunca una ruta local) |
| `method_path` | `string` | Ruta al directorio del plugin de método, si se utilizó |
| `fst_retries` | `number` | Cantidad de intentos de reintento de FST |

```json
{
  "config": {
    "api_provider": "openrouter",
    "temperature": 0.0,
    "max_tokens": 32768,
    "batch_size": 25,
    "concurrency": 8
  }
}
```

:::info[Las Tarjetas de Ejecución Publicadas Incluyen `method_config`]
Cuando se publica una tarjeta de ejecución a través de `mt-eval publish`, `publish.py` inyecta un bloque `method_config` que contiene la MethodConfig canónica de 8 campos. Esto permite una instalación sin fricciones en el leaderboard — cualquiera puede reproducir el método directamente desde la tarjeta publicada.

```json
{
  "method_config": {
    "model": "google/gemini-3.1-pro-preview",
    "temperature": 0.0,
    "batchSize": 25,
    "register": "Formal Plains Cree. Use SRO orthography.",
    "coachingFile": "prompts/crk-coaching-v8.txt",
    "coachingPrompt": null,
    "promptContext": "champollion",
    "qualityTier": null
  }
}
```

`qualityTier` siempre es `null` en una nueva run card: los niveles de calidad están retirados. Todos los campos usan **camelCase** y siguen el esquema canónico de MethodConfig (consulte [Creación de un método](/docs/network/specifications/methods)).
:::

---

## `system_prompt_sha256` / `system_prompt_used`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `system_prompt_sha256` | `string` | Hash SHA-256 de la indicación del sistema. Incluido en la huella digital |
| `system_prompt_used` | `string` | El texto completo de la indicación del sistema enviado al modelo |

El hash de la indicación es parte de la [huella digital](#fingerprint) — dos ejecuciones con indicaciones diferentes tendrán huellas digitales diferentes incluso si todos los demás parámetros coinciden.

---

## `fingerprint`

Un identificador de reproducibilidad. Dos ejecuciones con huellas digitales idénticas utilizaron la misma configuración experimental.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `hash` | `string` | Hash SHA-256 de los componentes ordenados |
| `components` | `object` | Los valores de entrada que fueron procesados |

### Componentes de Huella Digital

La lista canónica se encuentra en la [Especificación del Benchmark §3.8](/docs/network/specifications/benchmark#38-fingerprint). En resumen:

| Componente | Descripción |
|-----------|-------------|
| `dataset_sha256` | Hash del archivo del conjunto de datos |
| `model_slug` | Modelo utilizado (para un motor de MT o un plugin de método, el id del motor o del método) |
| `condition` | Etiqueta de condición del experimento |
| `system_prompt_sha256` | Hash del prompt del sistema |
| `temperature` | Temperatura de muestreo |
| `batch_size`, `tools_enabled` | Procesamiento por lotes y uso de herramientas |
| `harness_version` | Versión del harness |
| `api_provider`, `endpoint_host_sha256`, `max_tokens`, `method_version`, `method_sha256` | Versión 2 (harness 0.2.0 y posterior): el canal, el host del endpoint (con hash aplicado), el límite de tokens y la versión y hash de código del método |
| `method_model`, `method_dependencies_sha256` | Versión 2, únicamente ejecuciones de plugins de método: el modelo que se le entregó al plugin (`-m`) y el hash de su `dependencies` declarada |
| `method_model`, `method_model_sha256` | Versión 2, únicamente ejecuciones de `--method local-model`: el modelo que se cargó (id de Hugging Face o nombre del directorio) y el hash de su contenido (un directorio) o revisión (un id de Hugging Face) |

`fingerprint.version` indica bajo qué lista se generó el hash de una run card.

### `engine_model`

Una ejecución de un motor de MT que ejecuta un modelo que se le proporciona (`--method local-model -m <model>`) incluye el modelo que se cargó:

| Campo | Descripción |
|-------|-------------|
| `given` | Lo que indicó `-m` |
| `kind` | `directory` o `hub` (un id de Hugging Face) |
| `id` | El id de Hugging Face, o el nombre del directorio (nunca su ruta local) |
| `sha256` | Solo para directorios: SHA-256 sobre una lista estilo `sha256sum` de sus archivos |
| `revision` | Solo para un id de Hugging Face: la revisión que se cargó |
| `family`, `backend` | `opus`, `nllb` o `madlad`; `transformers` o `ctranslate2` |
| `decode` | Qué longitud podían tener las salidas: la longitud que declara el modelo, o la regla del harness (`max(64, 4 × source tokens)` tokens nuevos, limitada por las posiciones del decodificador) |
| `pair_mismatch` | Presente solo cuando se ejecutó intencionalmente un modelo de par OPUS-MT para otro par (`--allow-model-pair-mismatch`) |

`method_config.model` nombra al mismo modelo (`<id>@<revision>` o `<directory name>@sha256:<hash>`). Un log de ejecución de `local-model` que no haya registrado ningún modelo no publica nada: la run card indica `engine_model_unrecorded` y `mt-eval publish` la rechaza.

### `method_plugin`

Una ejecución de plugin de método (`--method <plugin dir>`) también incluye lo que identifica al plugin, tal como lo registró el ejecutor:

| Campo | Descripción |
|-------|-------------|
| `version` | La versión que declara `method.json` (`null` cuando no declara ninguna) |
| `code_sha256` | SHA-256 sobre los archivos del plugin (`method.json` y sus archivos `.py`, un manifiesto al estilo de `sha256sum`) |
| `model_given` | El modelo que se entregó al plugin con `-m/--model`, o `null` |
| `models_called`, `models_basis` | El modelo (o modelos) que el plugin informó haber llamado, y si eso fue observado en sus resultados o declarado |
| `dependency_class` | La clase de dependencia que declara `method.json` |
| `dependencies` | La lista de `dependencies` que declara `method.json`, sin el texto libre de `notes` |
| `dependencies_sha256` | SHA-256 de la lista declarada completa (el componente del fingerprint) |

```json
{
  "fingerprint": {
    "hash": "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    "components": {
      "dataset_sha256": "e3b0c44298fc1c14...",
      "model_slug": "google/gemini-3.1-pro-preview",
      "condition": "naive",
      "system_prompt_sha256": "abc123...",
      "temperature": 0.0,
      "harness_version": "2.0"
    }
  }
}
```

:::info[Fingerprint ≠ Hash de Tarjeta de Ejecución]
La huella digital identifica la *configuración del experimento*. El `run_card_hash` verifica la *integridad del archivo de resultados*. Consulte [Fingerprint vs Hash de Tarjeta de Ejecución](/docs/network/specifications/harness#fingerprint-vs-run-card-hash) para más detalles.
:::

---

## `scores`

Métricas agregadas para toda la ejecución.

### Puntuaciones de Nivel Superior

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `total` | `number` | Total de entradas evaluadas |
| `exact_matches` | `number` | Entradas donde la salida coincidió exactamente con el estándar de referencia (gold standard) |
| `exact_match_rate` | `number` | `exact_matches / total` (0.0–1.0) |
| `fst_accepted` | `number` | **Palabras** de salida que el analizador FST aceptó, sumadas en todas las entradas (no es un recuento de entradas). `null` si no se utilizó ningún analizador FST |
| `fst_acceptance_rate` | `number` | Media de las tasas de aceptación por entrada (las palabras aceptadas de cada entrada ÷ sus palabras; una salida vacía cuenta como 0), 0.0–1.0. **No** es `fst_accepted` ÷ todas las palabras — esa tasa agregada de palabras es el `corpus_validity_rate` del reporte, mostrado en la run card como "Words accepted". `null` si no se utilizó ningún analizador FST |
| `chrf_plus_plus` | `number` | **La métrica principal y de clasificación:** chrF++ a nivel de corpus (sacreBLEU chrF, `word_order=2`), 0–100. Su IC bootstrap del 95% es `confidence_intervals.corpus_chrf` y su firma es `sacrebleu_signatures.chrf` |
| `scoring_standard` | `string` | `"standard/1"` en cada run card nueva. Una card sin este campo se puntuó según la métrica compuesta retirada (`legacy-composite`) y se verifica de esa forma |
| `primary_metric` | `string` | `"chrf_plus_plus"` |
| `spbleu`, `ter` | `number` | Métricas estándar mostradas junto a chrF++, nunca combinadas (BLEU es el `corpus_bleu` de nivel superior de la run card; COMET es `comet_score` con `comet_model`, cuando se calcula) |
| `sacrebleu_signatures` | `object` | La firma sacreBLEU de cada métrica de sacreBLEU calculada: `chrf` (la métrica principal), `chrf_plain`, `bleu`, `spbleu`, `ter` |
| `confidence_intervals` | `object` | Intervalos bootstrap del 95%; `corpus_chrf` es el de la métrica principal |
| `composite`, `quality_tier`, `cost_adjusted` | `null` | **Retirado.** Siempre `null` en una run card nueva. Una run card heredada conserva sus valores almacenados; cualquier interfaz que aún muestre su puntuación compuesta la etiqueta como "legacy composite (retired)" |
| `errors` | `number` | Entradas que fallaron (error de API, tiempo de espera agotado, etc.) |
| `avg_latency_seconds` | `number` | Tiempo de respuesta promedio en todas las entradas |
| `median_latency_seconds` | `number` | Mediana del tiempo de respuesta |
| `p95_latency_seconds` | `number` | Percentil 95 del tiempo de respuesta |

### `by_difficulty`

Puntuaciones desglosadas por nivel de dificultad, identificadas por nivel (`"1"`–`"5"`, `"0"` para sin clasificar). Los campos **no** son los de nivel superior: `avg_chrf` y `avg_bleu` son la **media por oración** de chrF++ y BLEU sobre las entradas del nivel, mientras que el `chrf_plus_plus` y el BLEU de nivel superior son **a nivel de corpus** (calculados sobre todos los segmentos a la vez). Ambas son estadísticas diferentes: corpus BLEU en particular suele estar muy por debajo de la media de BLEU por oración, por lo que un valor principal de 0.5 junto a un valor de nivel de 10.2 no es una contradicción. Compare los niveles entre sí, nunca con la métrica principal.

```json
{
  "by_difficulty": {
    "1": {
      "name": "difficulty_1",
      "count": 20,
      "exact_match_count": 8,
      "miss_count": 12,
      "error_count": 0,
      "avg_chrf": 68.2,
      "avg_bleu": 31.5,
      "avg_latency_s": 0.84,
      "total_cost_usd": 0.0021,
      "plugin_aggregates": {}
    },
    "2": { ... },
    "3": { ... },
    "4": { ... },
    "5": { ... }
  }
}
```

### `by_provenance`

Puntuaciones desglosadas por procedencia de entrada. Cada clave (p. ej., `gold_standard`, `textbook`) contiene los mismos campos de métricas.

```json
{
  "by_provenance": {
    "gold_standard": {
      "total": 80,
      "exact_matches": 10,
      "exact_match_rate": 0.125,
      "chrf_plus_plus": 44.8
    },
    "textbook": { ... }
  }
}
```

---

## `score_caveats`

Presente solo cuando algo limita el significado de las puntuaciones. Una puntuación puede
calcularse correctamente y aun así no medir lo que indica su etiqueta, por lo que la
salvedad viaja con el número: `mt-eval test`, `mt-eval card`,
`mt-eval compare`, el panel de control (dashboard) y la vista previa de `mt-eval publish` la imprimen
junto a la métrica principal, y `publish` la almacena aquí para que la tabla de clasificación (leaderboard) la muestre.
Nunca modifica una puntuación: la métrica principal chrF++ se calcula como de costumbre, y la
advertencia (caveat) indica qué la limita a ella o a un diagnóstico junto a ella.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `kind` | `string` | `train_test_near_twin`, `length_inflation`, `length_deflation`, `source_copy` o `near_constant_output` |
| `source` | `string` | Quién lo midió: `nmt-forge` o `mt-eval-harness` |
| `severity` | `string` | `major` (interprete la métrica principal a través de esta) o `minor` |
| `message` | `string` | Una oración, máximo 480 caracteres |

**`train_test_near_twin`**, escrito por nmt-forge. Cuando `nmt-forge export` (o
`evaluate`) puntúa un modelo, comprueba cada fila de prueba para ver si existe un gemelo casi idéntico
en los datos de entrenamiento y registra el resultado en los archivos mt-eval que genera.
El harness copia esa lectura en la run card: `near_twin_rows` de `n` filas de prueba
tienen un gemelo (`near_twin_share`), y `strict_n` filas no tienen ninguno. Cuando
hay suficientes de estas, `strict_corpus_chrf` y `strict_corpus_chrf_ci`
proporcionan el chrF++ únicamente sobre ellas, el cual es el valor de generalización.
`recall_not_translation` es `true` cuando al menos la mitad de las filas tienen un gemelo.
En ese caso, incluso un chrF++ de 100 mide qué tan bien el modelo recuerda frases del entrenamiento,
no qué tan bien traduce. Si la comprobación de forge no se ejecutó,
la advertencia es `minor` y así lo indica. Una comprobación que no encontró ningún gemelo no añade ninguna advertencia.

**`length_inflation`**, medido por el harness. Se añade cuando las salidas
promedian más de 2 veces la longitud de su referencia (el límite de inflación de
[`length_ratio`](/docs/network/specifications/scoring)), o cuando al menos una
cuarta parte de las entradas puntuadas lo hacen. Ejemplos de few-shot filtrados, notas o texto
repetido inflan las salidas, y las puntuaciones basadas en referencias miden entonces eso.
Los campos son `mean_length_ratio`, `inflated_entries` de `scored_entries`,
`ratio_bound` y `share_bound`.

**`length_deflation`**, medido por el harness. Es el reflejo de
`length_inflation`: salidas mucho más **cortas** que sus referencias, por lo que se omitieron
palabras. Se añade cuando las salidas promedian menos de 0.5 veces la longitud de su
referencia (el límite de truncamiento de
[`length_ratio`](/docs/network/specifications/scoring)), o cuando al menos una
cuarta parte de las entradas puntuadas lo hacen. Algunos diagnósticos evalúan únicamente las palabras que
contiene una salida: aceptación de FST y code-switching (alternancia de código). Un sistema que descarta lo que
no puede traducir eleva estas métricas. Cuando la ejecución incluye una de ellas, la advertencia es
`major` e indica que no deben interpretarse como calidad frente a ejecuciones que traducen
todo. La métrica principal chrF++ pondera la exhaustividad (recall), por lo que contabiliza las palabras faltantes. Si ninguna
de las dos métricas está presente (solo chrF++ y coincidencia exacta), es una nota de tipo `minor`. Los campos
son `mean_length_ratio`, `short_entries` de `scored_entries`, `ratio_bound`,
`share_bound` y `emitted_only_metrics`.

**`source_copy`**, medido por el harness. Se añade cuando al menos la mitad de
las salidas puntuadas son copias de su fuente (ignorando mayúsculas/minúsculas, acentos y puntuación).
Las líneas cuya referencia es la fuente misma, tales como nombres propios, se dejan
fuera. Las métricas que no comparan contra la referencia aún pueden dar crédito a las palabras
copiadas. Los campos son `copies` de `considered_entries`, `copy_share` y
`share_bound`.

**`near_constant_output`**, medido por el harness. Se generó una misma salida
para muchas entradas *diferentes*. Las salidas y las fuentes se comparan ignorando mayúsculas/minúsculas,
puntuación y espaciado; los diacríticos sí cuentan, porque entre dos
salidas permiten diferenciar palabras. Una salida es una repetición entre fuentes cuando al
menos 3 fuentes distintas la obtuvieron (5 cuando tiene una o dos palabras de longitud, ya que
las respuestas cortas recurren legítimamente). Una salida que es igual a su propia referencia
es una respuesta correcta y no se contabiliza. La advertencia se añade cuando las repeticiones
cubren al menos una cuarta parte de las fuentes distintas, y al menos 5 de ellas. Siempre
es `major`. Cuando la ejecución incluye una métrica que evalúa una salida
sin su referencia (aceptación de FST, code-switching), el mensaje la
menciona: dicha métrica da crédito a una oración válida cada vez que aparece. Los campos
son `repeated_sources` de `considered_sources`, `repeat_share`,
`repeated_outputs`, `top_output_sources` y `top_output_words` (la salida más
repetida: cuántas fuentes la obtuvieron y su longitud), `share_bound`,
`min_repeats`, `min_sources`, `min_sources_short` y `emitted_only_metrics`.
Son únicamente recuentos: la advertencia nunca incluye el texto de una salida.

```json
"score_caveats": [
  {
    "kind": "train_test_near_twin",
    "source": "nmt-forge",
    "severity": "major",
    "checked": true,
    "recall_not_translation": true,
    "near_twin_rows": 150,
    "n": 150,
    "near_twin_share": 1.0,
    "strict_n": 0,
    "message": "all 150 test rows have a near-identical twin in the training data — there is no clean subset to score: this score measures recall of training phrases, not translation"
  }
]
```

El campo se encuentra dentro del JSON almacenado de la run card, por lo que no necesita
una columna en la base de datos. No forma parte del [fingerprint](#fingerprint): describe el
resultado, no el experimento.

---

## `totals`

Seguimiento de uso de tokens y costos para toda la ejecución.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `prompt_tokens` | `number` | Total de tokens de entrada en todas las llamadas de API |
| `completion_tokens` | `number` | Total de tokens de salida |
| `reasoning_tokens` | `number` | Tokens utilizados para razonamiento de cadena de pensamiento (dependiente del modelo, 0 para la mayoría de modelos) |
| `cached_tokens` | `number` | Tokens servidos desde la caché de indicación del proveedor |
| `total_cost_usd` | `number` | Costo total en USD (según lo informado por la API) |
| `cost_per_entry_usd` | `number` | `total_cost_usd / entry_count` |
| `reasoning_ratio` | `number` | `reasoning_tokens / completion_tokens` (0.0–1.0) |

```json
{
  "totals": {
    "prompt_tokens": 48200,
    "completion_tokens": 3100,
    "reasoning_tokens": 0,
    "cached_tokens": 12000,
    "total_cost_usd": 0.42,
    "cost_per_entry_usd": 0.0034,
    "reasoning_ratio": 0.0
  }
}
```

---

## `environment`

Metadatos del entorno de ejecución para reproducibilidad.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `harness_version` | `string` | Versión del arnés (refleja el `harness_version` de nivel superior) |
| `harness_git_commit` | `string` | SHA de confirmación de Git del arnés en tiempo de ejecución |
| `python_version` | `string` | Versión del intérprete de Python |
| `sacrebleu_version` | `string` | Versión de la biblioteca sacrebleu (utilizada para puntuación chrF++) |
| `os` | `string` | Identificador del sistema operativo |

```json
{
  "environment": {
    "harness_version": "2.0",
    "harness_git_commit": "a1b2c3d",
    "python_version": "3.11.9",
    "sacrebleu_version": "2.4.0",
    "os": "macOS-14.5-arm64"
  }
}
```

---

## `results[]`

La matriz de resultados por entrada. Un objeto por entrada del conjunto de datos, en orden de índice.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `entry_id` | `integer` | ID de esta entrada en el corpus (coincide con `entries[].id`) |
| `source` | `string` | El texto de origen que fue traducido |
| `reference` | `string` | La referencia estándar de oro del corpus |
| `predicted` | `string` | La salida real del método |
| `exact_match` | `boolean` | Si `predicted` coincide exactamente con `reference` después de la normalización |
| `entry_chrf` | `number` | Puntuación chrF++ a nivel de oración para esta entrada (0–100) |
| `fst_accepted` | `boolean \| null` | Si el analizador FST aceptó la salida. `null` si no se configuró analizador |
| `fst_analysis` | `string[]` | Cadenas de análisis FST para la salida (matriz vacía si no se analizó o fue rechazada) |
| `difficulty` | `integer` | Nivel de dificultad del corpus (1–5) |
| `provenance` | `string` | Etiqueta de procedencia del corpus |
| `latency_seconds` | `number` | Tiempo de respuesta para esta entrada individual |
| `usage` | `object` | Uso de tokens por entrada: `{ prompt_tokens, completion_tokens, reasoning_tokens }` |
| `error` | `string \| null` | Mensaje de error si esta entrada falló. `null` en caso de éxito |

```json
{
  "results": [
    {
      "entry_id": 1,
      "source": "Hello",
      "reference": "tânisi",
      "predicted": "tânisi",
      "exact_match": true,
      "entry_chrf": 100.0,
      "fst_accepted": true,
      "fst_analysis": ["tânisi+V+AI+Ind+2Sg"],
      "difficulty": 1,
      "provenance": "gold_standard",
      "latency_seconds": 0.82,
      "usage": {
        "prompt_tokens": 385,
        "completion_tokens": 12,
        "reasoning_tokens": 0
      },
      "error": null
    }
  ]
}
```

---

## `run_card_hash`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `run_card_hash` | `string` | Hash SHA-256 de toda la tarjeta de ejecución JSON, con el campo `run_card_hash` establecido en `""` durante el procesamiento |

Este es el sello de detección de manipulación. El tablero de clasificación recalcula este hash en la presentación y rechaza las tarjetas donde no coincide.

**Cálculo del hash:**

1. Serialice la tarjeta de ejecución a JSON con `run_card_hash` establecido en `""`
2. Calcule SHA-256 de la cadena serializada
3. Establezca `run_card_hash` en el resumen hexadecimal resultante

```python
import hashlib, json

card["run_card_hash"] = ""
card_json = json.dumps(card, sort_keys=True, ensure_ascii=False)
card["run_card_hash"] = hashlib.sha256(card_json.encode()).hexdigest()
```

:::info[Análisis Detallado por Entrada]
Las tarjetas de ejecución publicadas también rellenan la tabla `run_card_entries` de Supabase, que almacena resultados por entrada para análisis detallado en el leaderboard. Esta tabla se rellena automáticamente durante `mt-eval publish`.
:::

---

## Consulte también

- [Evaluación de MT](/docs/network/leaderboard/rules) — descripción general, valor de la tabla de clasificación y orientación sobre métodos buenos/malos
- [Eval Harness](/docs/network/specifications/harness) — cómo ejecutar evaluaciones y generar run cards
- [Conjuntos de datos de evaluación](/docs/network/leaderboard/datasets) — formato del conjunto de datos, EDTeKLA, FLORES+
- [Creación de un método](/docs/network/specifications/methods) — la interfaz del método y la especificación de la method card
- [Tabla de clasificación de métodos](https://champollion.dev/leaderboard) — puntuaciones del benchmark en vivo
- [Especificación del Benchmark](/docs/network/specifications/benchmark) — protocolo de evaluación, formato del corpus, esquema de la run card
- [Especificación de Puntuación](/docs/network/specifications/scoring) — SSOT para métricas y cómo se puntúan las ejecuciones
