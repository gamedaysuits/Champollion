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
  - label: "Methods and gates"
    to: /docs/agents/methods
    kind: cookbook
  - label: "Measurement rules"
    to: /docs/agents/measurement
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
  --name your-method-name
```

| Indicador | Qué hace |
|---|---|
| `--corpus` | Ruta al archivo del corpus o identificador registrado del corpus (`.json`, `.jsonl`, `.tsv`) |
| `--model` | Slug exacto del modelo: el identificador completo de OpenRouter (p. ej., `google/gemini-3.1-pro-preview`); se rechazan los alias cortos y los identificadores flotantes (`…-latest`). Con `--method <plugin dir>`, el modelo entregado a su complemento como `config.method_model` (cualquier nomenclatura que use su complemento) |
| `-n, --name` | Etiqueta legible para personas de su ejecución (aparece en la tabla de clasificación) |
| `--temperature` | Temperatura de muestreo (predeterminada: `0.0`, determinista; el valor predeterminado en `shared/model-defaults.json`) |
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

1. Se valida su envío (hash del conjunto de datos, integridad de la tarjeta de ejecución)
2. Los resultados aparecen en la tabla de clasificación como **Autoevaluado** (nivel de confianza 1)
3. El estado **Verificado por Champollion** proviene de volver a evaluar los resultados enviados frente al corpus fijado mediante SHA. La reevaluación es un comando para mantenedores que se ejecuta manualmente; nada lo ejecuta al realizar el envío y nada lo programa, por lo que hoy en día cada fila permanece como autoevaluada ([niveles de verificación](/docs/network/leaderboard/rules#verification-tiers))
4. Un lugar en la tabla de clasificación abierta no transfiere ningún derecho. Los derechos sobre un método solo se transfieren bajo los términos del premio declarados de un concurso cerrado, publicados antes de que cualquier persona participe ([Propiedad y términos](/docs/network/sovereignty/ownership-transfer))

---

## Consulte también

- [Uso del Harness](/docs/network/specifications/harness) — referencia completa de CLI
- [Reglas del Tablero de Clasificación](/docs/network/leaderboard/rules) — criterios de envío y políticas contra manipulación
- [Construir un Método](/docs/network/specifications/methods) — el protocolo TranslationMethod
- [Conjuntos de Datos](/docs/network/leaderboard/datasets) — conjuntos de datos de evaluación disponibles
