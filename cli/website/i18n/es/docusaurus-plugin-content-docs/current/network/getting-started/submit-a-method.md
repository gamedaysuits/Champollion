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
python3 -m pip install mt-eval-harness
```

---

## Paso 1: Ejecutar el Harness

El harness califica su método contra un conjunto de datos estandarizado:

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro-preview \
  --name your-method-name \
  --temperature 0.2
```

| Opción | Qué hace |
|---|---|
| `--corpus` | Ruta del archivo de corpus o ID de corpus registrado (`.json`, `.jsonl`, `.tsv`) |
| `--model` | Slug exacto del modelo: el ID completo de OpenRouter (p. ej., `google/gemini-3.1-pro-preview`); se rechazan los alias cortos y los ID flotantes (`…-latest`). Con `--method <plugin dir>`, el modelo entregado a su plugin como `config.method_model` (cualquier nomenclatura que utilice su plugin) |
| `-n, --name` | Etiqueta legible por humanos para su ejecución (aparece en la tabla de clasificación) |
| `--temperature` | Temperatura de muestreo (más baja = más determinista) |
| `--fst-retries` | Opcional: número de reintentos de FST |
| `--publish` | Publicar la tarjeta de ejecución en la tabla de clasificación cuando finalice la ejecución |

El harness produce una **tarjeta de ejecución** — un archivo JSON independiente con sus puntuaciones, el hash del conjunto de datos, el slug del modelo y una huella digital criptográfica que vincula los resultados a la configuración exacta del experimento.

---

## Paso 2: Revisar su Tarjeta de Ejecución

Cada ejecución escribe dos archivos en `eval/logs/harness/`: el registro de ejecución `<run-id>.json`
y el informe evaluado `<run-id>_report.json`. El informe es lo que usted publica.
Inspecciónelo primero:

```bash
python -m json.tool eval/logs/harness/<run-id>_report.json | less
```

Campos clave en el bloque `overall` del informe:
- `corpus_chrf`: chrF++ a nivel de corpus (0–100), la métrica
  principal y de clasificación. Su IC bootstrap del 95 % es `confidence_intervals.corpus_chrf` y su
  firma de sacreBLEU es `sacrebleu_signatures.chrf`
- `scoring_standard` (`"standard/1"`) y `primary_metric`
  (`"chrf_plus_plus"`): el estándar bajo el cual se evaluó el informe
- `corpus_bleu`, `corpus_spbleu`, `corpus_ter`: las demás métricas estándar,
  mostradas junto a chrF++ y nunca combinadas con esta
- `exact_match_rate`: un diagnóstico: la proporción de traducciones perfectas
- `confidence_intervals`: intervalos bootstrap para las métricas anteriores
- `total_cost_usd`: cuánto costó la ejecución (`null` cuando el modelo no tiene un precio
  publicado, p. ej., un modelo local; nunca se reporta como $0)

El informe también registra qué se le indicó al modelo, como un puntero
(`instructions`: el nombre y SHA-256 del archivo de coaching, el SHA-256
del prompt del sistema y, donde está el texto completo, el registro de ejecución en su máquina). La tarjeta
de ejecución que se envía a la tabla de clasificación se ensambla a partir de este informe. Agrega la
tarjeta de método y la huella de reproducibilidad, y encabeza con el mismo
chrF++ e IC; sus `composite` y `quality_tier` son `null`, porque ambos están
[retirados](/docs/network/specifications/scoring#how-runs-are-scored). (Un informe
escrito antes del estándar puede incluir un `published_composite`; es una métrica compuesta
heredada, retirada y que nunca se compara con chrF++).
`mt-eval publish <report> --dry-run` imprime la tarjeta exactamente como se
publicaría. Consulte la [Especificación de la tarjeta de ejecución](/docs/network/specifications/run-card)
para conocer su esquema.

---

## Paso 3: Enviar

La publicación escribe en la tabla de clasificación **en vivo**, por lo que requiere un
`--prod` explícito; sin él, el harness se rehusará y se lo notificará. Obtenga una vista previa primero:

```bash
# See exactly what would be uploaded (no sign-in, no network)
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run

# Publish (opens a browser sign-in the first time; add --anonymous to skip it)
mt-eval publish eval/logs/harness/<run-id>_report.json --prod
```

Para publicar directamente desde una ejecución, agregue `--publish --prod` a `mt-eval run`. Si el
paso de publicación falla, las puntuaciones de la ejecución aún se guardan y el harness imprime el
comando exacto para reintentar. Configurar `MT_EVAL_ALLOW_PROD=1` en el entorno es el
equivalente a `--prod` para scripts.

:::note[La API de envío y la carga web aún no están disponibles]
Un endpoint `POST https://champollion.dev/api/leaderboard/submit` y una
interfaz de usuario de carga para la tabla de clasificación están planificados, pero **aún no implementados**. Hasta que se lancen,
la única vía de envío que funciona es `mt-eval publish` (no hay
recepción mediante pull requests).
:::

---

## Qué sucede a continuación

1. Su envío es validado (hash del conjunto de datos, integridad de la tarjeta de ejecución)
2. Los resultados aparecen en la tabla de clasificación como **Autoevaluado** (nivel de confianza 1)
3. Para obtener el estado de **Verificado por Champollion**, envíe su método como un plugin instalable para que los mantenedores puedan reproducir sus resultados
4. Para métodos de lenguas indígenas: si su método llega al primer puesto, comienza el proceso de [transferencia de propiedad](/docs/network/sovereignty/ownership-transfer)

---

## Consulte también

- [Uso del Harness](/docs/network/specifications/harness) — referencia completa de CLI
- [Reglas del Tablero de Clasificación](/docs/network/leaderboard/rules) — criterios de envío y políticas contra manipulación
- [Construir un Método](/docs/network/specifications/methods) — el protocolo TranslationMethod
- [Conjuntos de Datos](/docs/network/leaderboard/datasets) — conjuntos de datos de evaluación disponibles
