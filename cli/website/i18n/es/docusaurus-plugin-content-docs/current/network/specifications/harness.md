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
python3 -m pip install mt-eval-harness
```

Esto instala el comando `mt-eval`.

## Uso

```bash
mt-eval run --corpus path/to/dataset.json
```

Esto ejecuta cada entrada del corpus a través del modelo configurado (o complemento de método), puntúa los resultados y escribe un archivo JSON de tarjeta de ejecución en el directorio de salida.

## Banderas CLI

### `mt-eval run`

| Opción | Obligatorio | Predeterminado | Descripción |
|---|---|---|---|
| `--corpus` | ✅ | — | Ruta al archivo de corpus (`.json`, `.jsonl`, `.tsv`) |
| `--source-file` / `--reference-file` | — | — | Archivos de texto paralelo (formato FLORES+, WMT) |
| `-m, --model` | — | `google/gemini-3.1-pro-preview` | Slug exacto del modelo: el ID completo de OpenRouter o el nombre exacto propio de un proveedor directo. Sin alias ni IDs flotantes (`~vendor/…`, `…-latest`): se rechaza un nombre corto como `gemini-pro`, y el rechazo indica el slug que debe escribirse. Separado por comas para ejecuciones con múltiples modelos. Con `--method local-model` es el modelo a ejecutar —un ID de Hugging Face o un directorio de modelos— y es obligatorio: ese motor no tiene un modelo predeterminado. Con un plugin de método, se pasa al plugin como `config.method_model`. Cualquier otro motor de TA traduce con su propio modelo y la ejecución indica que `-m` no se utiliza |
| `-d, --dataset` | — | `all` | Filtro del conjunto de datos: `all`, nombre de segmento o rango de IDs |
| `--ids` | — | — | IDs de entradas a evaluar, separados por comas |
| `--source-lang` | — | `English` | Nombre del idioma de origen |
| `--target-lang` | — | — | Nombre del idioma de destino, tal como lo indica el prompt. Un código proporcionado aquí (`sme`) se nombra a partir de su ficha de idioma ("Northern Sami"), y el encabezado de la ejecución así lo indica; un código que ninguna ficha nombre (un `qaa` de uso privado) se mantiene como código, con una advertencia de que el prompt lo incluirá |
| `-p, --prompt` | — | `naive` | Versión del prompt (`naive`, `custom`, `champollion`) |
| `--coaching-file` | — | — | Ruta al archivo de texto con el prompt de coaching. **Reemplaza** el prompt integrado: el modelo recibe el archivo tal como está escrito (más la línea `--target-script`), no la instrucción integrada "Translate the given … text to …; output only the translation". La ejecución de prueba (dry run) y el encabezado de la ejecución lo indican en un único veredicto: ✓ cuando el archivo nombra el idioma de destino (y mediante qué nombre o código), ⚠ cuando no nombra ni el idioma ni su código, o no verificado cuando no se conoce ningún nombre o código |
| `--glossary` | — | — | Glosario de evaluación (JSON) para la adherencia terminológica; solo para puntuación, nunca se envía al modelo |
| `--coaching` | — | — | Texto de coaching en línea (cadena entre comillas) |
| `--method` | — | — | Ruta al directorio del plugin de método (contiene `method.json` + módulo de Python), o un motor de TA registrado (`google-translate`, `deepl`, `local-model`, …) |
| `--allow-model-pair-mismatch` | — | `false` | Con `--method local-model`: ejecuta un modelo de pares OPUS-MT cuyo ID nombra un par distinto al del corpus (`opus-mt-en-fi` en un corpus `eng>sme`, como línea base de idioma relacionado). Se rechaza sin este; la ficha de ejecución lo registra |
| `--method-card` | — | — | Ruta al JSON de la ficha de método para metadatos de la tabla de clasificación |
| `--fst-retries` | — | `0` | Número de reintentos de FST (solo para el método LLM predeterminado) |
| `--skip-fst` | — | `false` | Puntúa sin aceptación de FST, incluso cuando el idioma disponga de un FST, y no añade más información al respecto. La ficha de ejecución lo marca como no calculado. Sin esta opción, la falta de un FST (el analizador o su entorno de ejecución pyhfst) tampoco detiene la ejecución: continúa, la ficha de ejecución marca la aceptación de FST y la morfología como no calculadas, y el aviso indica `mt-eval setup --lang <code>`. Tras esa instalación, `mt-eval test <run log>` añade la puntuación de FST a la ejecución finalizada sin volver a traducir. No se descarga nada automáticamente |
| `--skip-eval-standard` | — | `false` | Puntúa sin las métricas de evaluación estándar de la ficha de idioma (un paquete externo). La ficha de ejecución las marca como no calculadas. Sin esta opción, se calculan las métricas de un paquete instalado; un paquete que no esté instalado es un complemento opcional: la ejecución continúa sin sus métricas (marcadas como no calculadas) e indica el `python3 -m pip install` que declara la ficha. Una ejecución no instala nada |
| `--tools` | — | `false` | Habilitar el modo de llamada a herramientas (tool-calling) |
| `--tools-list` | — | — | Nombres de herramientas separados por comas |
| `--max-tool-rounds` | — | `8` | Rondas máximas de llamada a herramientas por entrada |
| `--hooks` | — | — | Nombres de hooks posteriores a la traducción |
| `--style-profile` | — | — | Ruta a un JSON de perfil de estilo. Habilita métricas de consistencia de estilo de redacción (diagnósticos; nunca forman parte de la puntuación principal; consulte [§ Métricas de estilo de redacción y registro](#writing-style-and-register-metrics-informational)) |
| `-b, --batch-size` | — | `25` | Entradas por llamada a la API |
| `-c, --concurrency` | — | `8` | Llamadas paralelas a la API |
| `--max-tokens` | — | `32768` | Máximo de tokens por llamada a la API |
| `--temperature` | — | `0.0` | Temperatura de muestreo (0.0 = determinista) |
| `--no-cache` | — | `false` | Deshabilitar el almacenamiento en caché de respuestas |
| `--cache-dir` | — | `eval/cache/harness` | Ruta del directorio de caché (consulte [La caché de traducción](#the-translation-cache)) |
| `--metricx` | — | `false` | También calcula MetricX-24 (Google, Apache-2.0), una puntuación de error neuronal en la que un valor menor es mejor (0–25), reportada junto a la puntuación principal chrF++ y nunca combinada con ella. Requiere el extra `metricx` y el código de modelo de Google (consulte [Métricas neuronales opcionales](#opt-in-neural-metrics)) |
| `--metricx-model` | — | `google/metricx-24-hybrid-large-v2p6` | Con `--metricx`: otro checkpoint de MetricX (uno xl/xxl o uno `google/metricx-25-*`) |
| `--fuse` | — | `false` | También calcula el comparador de estilo FUSE, una reimplementación sin entrenamiento del enfoque AmericasNLP 2025 FUSE, reportado como un comparador de diagnóstico, nunca en la puntuación principal. Requiere el extra `fuse` (consulte [Métricas neuronales opcionales](#opt-in-neural-metrics)) |
| `-o, --output-dir` | — | `eval/logs/harness` | Directorio de salida para fichas de ejecución y registros |
| `-n, --name` | — | — | Nombre de ejecución legible para humanos |
| `--dry-run` | — | `false` | Valida la configuración y el corpus sin realizar llamadas a la API. Indica el archivo de coaching y el glosario que usaría la ejecución (o `none`), muestra el prompt (el integrado completo; un archivo de coaching mediante su primera línea y sha256, y que reemplaza al integrado), señala dónde está la caché de traducción y realiza la misma verificación de eval-pack que hace la ejecución real, informando en líneas que comienzan con `EVAL PACK:` (`ready (…)`, `missing — <pieces>; …` o `none needed for <language>`) sin fallar. Una segunda línea indica si la ejecución real se detendría: la falta de un FST nunca la detiene, mientras que cualquier otro elemento faltante sí lo hace. Bajo `--json`, el resumen incluye `coaching_file`, `prompt` (su tipo, sha256 y longitud; el texto del prompt integrado), `glossary_file` y `eval_pack` (`status`, `missing`, `setup_command`, `blocks_run`, `advisory`) |
| `--target-lang-code` | — | — | Código de idioma BCP-47 |
| `--target-script` | — | — | El sistema de escritura ISO 15924 en el que deben redactarse las traducciones (`Latn`, `Cans`, …), uno que figure en la ficha del idioma de destino. El prompt del harness lo solicita (también añadido al texto de un archivo de coaching), por lo que forma parte del sha256 del prompt. Para un idioma que se escribe en más de un sistema de escritura, como el cree de las llanuras (Plains Cree), utilice el sistema de escritura en el que estén redactadas sus referencias. Sin esta opción, el harness cuenta las letras de las referencias por sistema de escritura (un agregado: no se muestra ninguna oración, por lo que esto también aplica a un corpus exclusivamente local) y solicita el sistema de escritura que contenga el 90 % o más de ellas, indicándolo en el encabezado de la ejecución ("las referencias son 100% Latn → solicitando Latn") y registrándolo en el registro de la ejecución (`config.target_script_source`); las referencias mixtas no reciben ningún sistema de escritura y obtienen una advertencia con las proporciones, y una referencia en el otro sistema de escritura obtiene una puntuación cercana a cero. Se rechaza para un motor de TA o un plugin de método, que no reciben ningún prompt |

`--champollion-config` y `--prompt champollion` se retiraron en la versión 0.2.0 y se rechazan indicando el motivo. Lo mismo ocurre con `--champollion-cards-dir`; configure `MT_EVAL_CARDS_DIR` para apuntar el harness hacia otro directorio de fichas. Estos reconstruían el prompt de la CLI en Python, y esa copia se había desfasado de la CLI. Utilice un complemento de método (`--method`) para evaluar un método de la CLI, y `mt-eval export-config` para trasladar un resultado de vuelta a un proyecto de la CLI.

### Métricas neuronales opcionales

COMET se calcula siempre que `unbabel-comet` esté instalado (`mt-eval setup --comet`: aproximadamente 300 MB para instalar, y cerca de 2.3 GB de modelo en el primer uso). Dos métricas adicionales están desactivadas a menos que una ejecución las solicite, ya que cada una carga un modelo pesado. Al igual que COMET, se ejecutan en esta máquina (sin costo de API, sin enviar texto a ningún lado), se reportan junto con el resultado principal de chrF++ y nunca se combinan con este, y la ficha de ejecución indica "not run" junto con el parámetro que se debe pasar cuando no se solicitaron.

| Métrica | Parámetro | Qué necesita | Cuál es su costo |
|--------|------|---------------|---------------|
| MetricX-24 (`metricx_score`, menor es mejor, 0–25) | `--metricx` (checkpoint: `--metricx-model`) | `python3 -m pip install 'mt-eval-harness[metricx]'` (PyTorch, Transformers, SentencePiece) y el código de modelo de Google, que no está en PyPI: `python3 -m pip install git+https://github.com/google-research/metricx` | El checkpoint predeterminado `google/metricx-24-hybrid-large-v2p6` y el tokenizador mT5-XL descargan varios GB desde Hugging Face en el primer uso; la puntuación es lenta en CPU. Sin una referencia, califica en su modo sin referencia (QE) |
| Comparador de estilo FUSE (`fuse_score`) | `--fuse` | `python3 -m pip install 'mt-eval-harness[fuse]'` (sentence-transformers, jellyfish) | LaBSE descarga alrededor de 1.8 GB en el primer uso. Sin LaBSE, la puntuación no se calcula y el informe así lo indica. No está entrenado (es una media no ponderada de sus partes) y el resultado se marca como `fuse_untrained` |

A través de MCP, `run_benchmark` toma `metricx` (con `metricx_model`) y `fuse`, y `comet: true` requiere COMET; su plan indica si cada uno está instalado, y se rechaza una ejecución confirmada que solicite uno que el harness no pueda calcular.

Lo que mide cada métrica y hasta qué punto confiar en ella para un idioma determinado se encuentra en [Puntuación](/docs/network/specifications/scoring) y [Confiabilidad de las métricas](/docs/network/specifications/metric-reliability).

### La caché de traducción

Cada ejecución guarda la salida del modelo para cada oración de origen en una caché (`--cache-dir`, de forma predeterminada `eval/cache/harness` bajo el directorio en el que comienza la ejecución), de modo que una repetición de la misma configuración la reutiliza sin costo. La clave de caché abarca el modelo, el prompt tal como se envió (su sha256), la configuración que altera las salidas y la versión del harness, por lo que ante un cambio en cualquiera de ellos nunca se entrega una salida antigua. La caché almacena copias de las oraciones del corpus:

- el encabezado de ejecución y la ejecución de prueba imprimen dónde se encuentra y cuántas entradas contiene;
- la carpeta incluye un `.gitignore`, por lo que git la ignora;
- nunca se escribe dentro de una carpeta `mt-eval contest prepare` marcada como publicable (su `public/`): `mt-eval run` rechaza dicho `--cache-dir` o `--output-dir` y nombra en su lugar la carpeta `runs/` del concurso ([Ejecutar un concurso soberano](/docs/network/sovereignty/run-a-sovereign-contest));
- un corpus exclusivamente local, sellado o que requiera consentimiento obtiene su propia carpeta `protected/<namespace>/`, identificada por la configuración de la ejecución, el sha256 del corpus y sus términos, y cada archivo allí lleva la marca del corpus en un archivo adjunto `<file>.champollion.json` ([Registro de corpus](/docs/network/sovereignty/registering-corpora));
- elimine la carpeta para borrar las copias, o pase `--no-cache` para no conservar ninguna.

El `run_benchmark` del servidor MCP nombra la caché en su plan y en su resultado. Para un archivo que usted posee, coloca la caché junto a los resultados de la ejecución (`<corpus folder>/results/cache/`), y para el ID de un corpus registrado, en su propia carpeta (`~/.champollion-mcp/cache/harness/`). Una caché que ya se encuentre en `eval/cache/harness` bajo el directorio de trabajo del servidor procedente de ejecuciones anteriores se sigue utilizando, de modo que sus salidas no se pagan dos veces. Sus entradas no dependen de la ubicación de la carpeta, por lo que se puede mover.

### Todos los subcomandos

Los dieciocho subcomandos de nivel superior, generados con respecto a `mt_eval_harness/cli.py`
el 2026-08-01. Hasta entonces, esta sección enumeraba siete de ellos, y seis —
incluido `node`, el nodo de puntuación del organizador soberano— no estaban documentados
**ni aquí ni en la guía del harness**.

**Ejecutar y calificar**

| Subcomando | Qué hace |
|---|---|
| `mt-eval run` | Ejecuta una sesión de traducción (parámetros anteriores) |
| `mt-eval test <log>` | Analiza el registro de una ejecución completada. `-o <path>` escribe el informe en otro lugar que no sea `<log>_report.json`, y el registro de ejecución guarda esa ruta para que `card` y `compare` lo encuentren. `--glossary <file>` califica la terminología contra ese glosario; el informe registra su nombre y sha256, y la ficha, `compare` y la vista previa de publicación indican contra qué glosario se evaluó la adherencia terminológica (un diagnóstico) |
| `mt-eval compare <reports…>` | Compara dos o más ejecuciones (`*_report.json` o registros de ejecución). Una fila por métrica (chrF++, BLEU, spBLEU, TER, …), una columna por ejecución con las letras A, B, C…, con las métricas donde un valor menor es mejor marcadas; `--significance` agrega pruebas pareadas para cada par, con cada tabla nombrada por las letras de las ejecuciones, con el IC del 95 % sobre Δ, e indica que los valores p son por métrica y no están corregidos; `--method paired_bootstrap` reemplaza la aleatorización aproximada predeterminada por el bootstrap de Koehn ([Significancia](/docs/network/specifications/significance)). Escribe `comparison-<hash>.json` (el hash de los ID de las ejecuciones comparadas, para que otra comparación nunca lo sobreescriba) junto a los informes cuando comparten carpeta; de lo contrario, en `comparisons/` en su carpeta común más cercana (nunca dentro de la carpeta propia de una ejecución), a menos que `-o` indique un archivo. La prueba chrF++ por sí sola decide qué ejecución es mejor; las demás filas se muestran, pero no se usan para decidir. Se indica que la puntuación compuesta de un informe heredado está retirada y no se compara |
| `mt-eval dashboard <logs…>` | Genera un panel de control HTML interactivo |
| `mt-eval card <run log>` | Muestra con formato legible para humanos una ficha de ejecución. Las puntuaciones provienen del informe de la ejecución: junto al registro, donde `mt-eval test -o` lo registró, o en `--report <path>`. Una ejecución sin informe encontrado muestra NOT SCORED y el lugar donde buscó, nunca ceros. También se puede pasar un archivo de informe; se lee junto con el registro de ejecución que contiene registrado |

**Encontrar el camino hacia un método**

| Subcomando | Qué hace |
|---|---|
| `mt-eval recommend <src> <tgt>` | Orientación sobre métodos para un par de idiomas: disponibilidad más **evidencia citada**, no un simple ranking. El par también puede proporcionarse como `--source <src> --target <tgt>`, el formato que toma `corpora` |
| `mt-eval corpora --source X --target Y` | Enumera los corpus de evaluación disponibles para un par. Cualquiera de los dos parámetros funciona por sí solo: `--target Y` enumera todos los corpus hacia Y, `--source X` todos los corpus desde X |
| `mt-eval corpora --with-fst` | Solo los corpus cuyo idioma de destino tiene un FST fijado por el harness, de modo que se pueda calificar la aceptación FST. Cada destino se lista indicando si su FST está instalado en esta máquina y cómo instalarlo (`mt-eval setup --lang <code>`, o una instalación manual para algunos formatos). Combínelo con `--source`/`--target`, o úselo solo para todos los pares. No se descarga nada |
| `mt-eval list models\|prompts\|datasets` | Enumera los recursos disponibles |

**Contribuir**

| Subcomando | Qué hace |
|---|---|
| `mt-eval publish <report>` | Envía un TestReport a la tabla de clasificación |
| `mt-eval queue` | Ejecuta el elemento superior de la cola de cómputo comunitaria con su propia clave; consulte [Cómo contribuir con cómputo](/docs/network/getting-started/contributing-compute) |
| `mt-eval export` | Empaqueta un TestReport como un complemento de método de champollion |
| `mt-eval generate-plugin` | Alias de `export` |
| `mt-eval export-config` | Genera un fragmento de `champollion.config.json` a partir de un TestReport |

**Concursos y cómo organizar uno propio**

| Subcomando | Qué hace |
|---|---|
| `mt-eval contest` | Ejecute o participe en un **concurso soberano** — los comandos del organizador: `prepare`, `register`, `create`, `rank`, `close`, `export`; los del participante: `qualify` (autoevalúe el conjunto de desarrollo público para obtener el comprobante de admisión; el clasificador es chrF++ en escala de 0–100), `validate` (ensaye las verificaciones del nodo fuera de línea), `submit-model` / `submit-method` (entregue un modelo o un método), `status`, `list`. Para participar en un concurso se entrega al nodo del organizador algo que pueda EJECUTAR; subir traducciones y vincular una ficha autorreportada se retiraron como vías de participación el 2026-09-06 |
| `mt-eval shared-task` | Marco general para ediciones de tareas compartidas multipar: una fila agrupa los N concursos por par de una edición al estilo de AmericasNLP y contiene sus políticas predeterminadas. **Solo agrupación y valores predeterminados — cada filtro se mantiene por concurso** |
| `mt-eval node` | **El nodo de puntuación del organizador.** Sondea la recepción, filtra mediante el calificador público, autoriza según la política del concurso, califica contra **referencias secretas en poder del organizador**, publica únicamente puntuaciones. Este es el comando detrás de [Ejecutar un concurso soberano](/docs/network/sovereignty/run-a-sovereign-contest) y el [Nodo de evaluación soberano](/docs/network/sovereignty/sovereign-eval-node) — el corpus nunca sale de la máquina del organizador |

`mt-eval node` tiene dieciocho subcomandos propios, incluido el canal aislado (airgap)
(`import-bundle`, `export-scores`, `relay`, `egress-check`, `manifest`) y la
ceremonia de custodia M-de-N (`ceremony`, `seal`, `keygen`, `sign-manifest`,
`verify-manifest`, `ledger`). Ejecute `mt-eval node --help`; los mecanismos
de soberanía se describen en las dos páginas enlazadas arriba.

**Configuración**

| Subcomando | Qué hace |
|---|---|
| `mt-eval setup` | Instala dependencias opcionales (métrica neuronal COMET, entorno de ejecución FST) |
| `mt-eval logout` | Elimina las credenciales de autenticación almacenadas |

### Ejemplos

```bash
# Run with defaults (google/gemini-3.1-pro-preview, naive prompt)
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1

# Coached experiment with coaching file
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro-preview \
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
  "model_slug": "google/gemini-3.1-pro-preview",
  "model_id": "gemini-3.1-pro-001",
  "condition": "naive",
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

:::info[Esquema autoritativo]
La [Especificación del benchmark](/docs/network/specifications/benchmark) es la única fuente de verdad para el esquema de la ficha de ejecución. Para conocer las definiciones de las métricas y cómo se califican las ejecuciones, consulte la [Especificación de puntuación](/docs/network/specifications/scoring). Esta página documenta cómo utilizar el harness; las especificaciones definen qué significan los resultados.
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
Estas métricas son **diagnósticos**: nunca forman parte de la puntuación principal, y la detección de formalidad se basa en marcadores (una heurística), no en un juicio aprendido. Considérelas como un detector de desviación para la adherencia al registro, no como un veredicto sobre la calidad del estilo.
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
- SHA-256 del prompt del sistema
- Temperatura
- Tamaño de lote
- Herramientas habilitadas
- Versión del harness

Ocho componentes en total: el tamaño de lote y las llamadas a herramientas cambian la salida
sustancialmente, por lo que forman parte de la identidad del experimento; dos ejecuciones con
diferentes tamaños de lote **no** comparten una huella digital. Consulte
[Especificación del benchmark §3.8](/docs/network/specifications/benchmark#38-fingerprint).

Dos ejecuciones con huellas digitales idénticas utilizaron la misma configuración. Sus resultados deben ser comparables (módulo no determinismo de API).

### Hash de tarjeta de ejecución

El **hash de tarjeta de ejecución** responde: *"¿Ha sido manipulado este archivo de resultado específico?"*

Es el SHA-256 de todo el JSON de tarjeta de ejecución (excluyendo el campo `run_card_hash` en sí). Si algún campo cambia — una puntuación, una marca de tiempo, un único resultado — el hash se rompe.

:::info[Cuándo usar cuál]
Use la **huella digital** para agrupar ejecuciones comparables (mismo experimento, ejecuciones diferentes). Use el **hash de tarjeta de ejecución** para verificar la integridad de un archivo de resultado específico.
:::

---

## Publicación en la tabla de clasificación

Tras completar una ejecución, use `mt-eval publish` en el `<run-id>_report.json` de la ejecución. La escritura en la tabla de clasificación en vivo requiere un `--prod` explícito (o `MT_EVAL_ALLOW_PROD=1`); `mt-eval run --publish --prod` realiza ambos pasos a la vez:

```bash
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run   # preview
mt-eval publish eval/logs/harness/<run-id>_report.json --prod      # write to the live board
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

- [Evaluación de MT](/docs/network/leaderboard/rules) — descripción general, propuesta de valor de la tabla de clasificación y orientación sobre métodos adecuados/inadecuados
- [Conjuntos de datos de evaluación](/docs/network/leaderboard/datasets) — formato del conjunto de datos, EDTeKLA, FLORES+
- [Especificación de la ficha de ejecución](/docs/network/specifications/run-card) — el esquema JSON completo
- [Creación de un método](/docs/network/specifications/methods) — la interfaz de método para crear métodos evaluables
- [Tabla de clasificación de métodos](https://champollion.dev/leaderboard) — puntuaciones del benchmark en vivo
- [Especificación del benchmark](/docs/network/specifications/benchmark) — protocolo de evaluación, formato del corpus, esquema de la ficha de ejecución
- [Especificación de puntuación](/docs/network/specifications/scoring) — fuente única de verdad para las métricas y la puntuación de las ejecuciones
