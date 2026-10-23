---
title: "Métodos y compuertas"
slug: /agents/methods
description: "method/1 y gate-chain/1 tal como los lee cada herramienta de Champollion, una compuerta de validez por FST como ejemplo práctico y las recetas de métodos más allá del modelo entrenado predeterminado —LLM guiado, few-shot, aumentado con diccionario, híbrido basado en reglas, encadenado, traducción parcial, con ajuste fino—, cada una indicando qué envía y a dónde."
---

# Métodos y compuertas

Un **método** es cualquier cosa que traduce: un modelo entrenado, un LLM con instrucciones, una búsqueda en diccionario, un motor de reglas, un servicio, personas. Una **compuerta** es una verificación entre la salida de un método y lo que se entrega. El método predeterminado de los rieles es un modelo entrenado con nmt-forge ([entrenamiento](/docs/agents/training)); esta página describe el formato en el que se escriben ambos y las demás recetas.

Cada receta a continuación sigue las [reglas de transmisión](/docs/agents/data-rules): **un método que llama a un proveedor de modelos envía texto a ese proveedor**, y un archivo de uso exclusivamente local, sellado o que requiere consentimiento lo rechaza.

## method/1

`$schema` `https://champollion.dev/schemas/method/1.json`. Obligatorio: `id` (palabras en minúsculas unidas por guiones), `name`, `kind` — más la única configuración que necesita ese tipo, verificada por los lectores con los mismos mensajes en ambos entornos de ejecución.

| `kind` | Configuración requerida | Se ejecuta en | Envía texto a |
|---|---|---|---|
| `llm` | `model` (un id exacto, nunca un alias); opcional `provider` | CLI; harness mediante `-m` y `--provider` | Al proveedor |
| `llm-coached` | `model`; la preparación va en `coaching` (`file`, `prompt` o `dir`) | CLI; harness mediante `-m` y `--coaching-file` | Al proveedor: las oraciones y la preparación |
| `mt-api` | `engine` (desde `shared/method-registry.json`) | CLI; harness | Al servicio del motor |
| `local-model` | `model` (un id de Hugging Face o una carpeta local) | Harness, en proceso | A ningún lado |
| `nmt-checkpoint` | `model_dir` | A través de su servicio (`nmt-forge serve`) | Al servidor de esta computadora |
| `lexicon` | `dictionary` | Harness, en proceso | A ningún lado |
| `python` | `entry_point` (`module:Class`) | Harness (`mt-eval run --method <folder>`) | A donde sea que el plugin lo envíe (`dependency_class`) |
| `service` | `service.endpoint` | CLI (método `api`) | A ese endpoint |
| `human` | — | Personas; califique sus salidas con `mt-eval test` | — |

Opcional: `version`, `description`, `author`, `pairs` (`{source?, target}`), `decode` (`temperature` 0–2, `batch_size`, `max_tokens`), `card` (lo que muestra la tabla de clasificación), `dependency_class` (`S` autónomo, `O` externo abierto, `A1`/`A2` dependiente de API, `X` cerrado), `evidence` (ejecuciones medidas: `dataset`, `metric`, `score`, `ci`, `n` — solo números), `runtimes` (`cli`, `engine`).

**De dónde proviene un method.json:** `methods/<id>/method.json` en un proyecto; `nmt-forge export` (tipo `nmt-checkpoint`); `mt-eval export --report <report> --name <name> --type <type> --locales <code>`; `champollion serve --emit-manifest` (kind `service`). Las estructuras más antiguas (el manifiesto del plugin de la CLI con `type`, el manifiesto del plugin del harness con `entry_point`) todavía se leen como method/0, con una advertencia. Un documento que incluya `$schema` se lee como method/1 y debe ser válido.

**Qué entorno de ejecución admite cada tipo.** La CLI rechaza `python`, `lexicon`, `local-model` y `human` (*"se ejecuta en el motor de evaluación (mt-eval run --method), no en la CLI de champollion — o bien ejecútelo como servicio y úselo mediante su endpoint"*). `--method <folder>` del harness solo carga `python`; para cualquier otro tipo, indica las opciones de comando con las que se ejecuta en su lugar.

**Decodificación.** La temperatura predeterminada es **0** (`shared/model-defaults.json`): un único valor para lo que una aplicación traduce y lo que el harness evalúa, de modo que lo que se mide sea lo que se entrega; `mt-eval run --temperature` lo usa de forma predeterminada. Un par, una configuración o una ejecución pueden definir el suyo. Los identificadores de modelo son slugs exactos, nunca alias.

## Cadenas de compuertas

`$schema` `https://champollion.dev/schemas/gate-chain/1.json`, un archivo en `gates/`. Obligatorio: `id`, `gates` (uno o más). Opcional: `description`, `fallback`.

Cada compuerta: `id`, `kind` (`metric-threshold`, el único tipo), `metric` (el nombre de un plugin de métrica), `field` (una clave en el resultado por segmento de ese plugin — un número, o verdadero/falso interpretado como 1/0), `min` y/o `max`, `on_refuse`.

**Las reglas** (`arena/mt_eval_harness/gates.py`):

- Las compuertas se ejecutan en orden; la **primera** compuerta que rechace un segmento decide lo que se entrega:

  | `on_refuse` | Se entrega | Se cuenta como |
  |---|---|---|
  | `drop` | nada | rechazado |
  | `keep-source` | el texto fuente | rechazado |
  | `flag` | la salida, marcada | señalada, no rechazada |
  | `fallback` | la traducción del método alternativo, si las mismas compuertas la aceptan; rechazada de nuevo, nada | rechazado |

- **Bloqueo.** Un segmento que el plugin no puede calificar se rechaza (`no_value` o `plugin_error:<type>`) — nunca se entrega como si hubiera pasado.
- **Bloqueo.** Una compuerta cuyo plugin no esté cargado, o no pueda calificar aquí, detiene la ejecución antes de traducir nada: *"una compuerta que no puede juzgar nunca se considera aprobada"*.
- **Bloqueo.** El método alternativo debe ejecutarse en este proceso (`lexicon`, `local-model` o un plugin que declare `dependency_class` `S` o `O`), de modo que un segmento rechazado no salga a ningún lado.
- **Bloqueo.** `mt-eval run` y `mt-eval test` rechazan una cadena con una compuerta `fallback`: *"un método alternativo es para servir y traducir, nunca para una medición: la puntuación pertenecería en parte a este método y en parte al alternativo, bajo un solo nombre"*. Mida el método alternativo como un método independiente.
- **Dónde aplican las compuertas:** `mt-eval run --gates`, `mt-eval test <run log> --gates` (re-scored without translating again), `mt-eval translate --gates`, `mt-eval serve --gates` y el `gates` de un despliegue.
- En una medición, la métrica principal califica lo que se entrega; el chrF++ sin compuertas y la tasa de rechazo se muestran junto a ella, y la huella digital de la cadena (sha256 de su JSON canónico) acompaña al informe ([medición](/docs/agents/measurement#gated-measurement)). Con `keep-source`, la métrica principal califica el texto fuente allí donde se entregó.
- **Bloqueo.** Cada compuerta necesita `min` y/o `max`, los id de compuerta son únicos, y una compuerta `fallback` necesita el `fallback` de la cadena — `champollion validate` y el harness dan el mismo veredicto. Reintentar un segmento rechazado con el motivo de la compuerta no está implementado.

## Ejemplo práctico: una compuerta de validez por FST

Un analizador de estados finitos (FST) indica si una palabra está bien formada en el idioma. El plugin de métrica del harness `giellalt_fst_validity` reporta, por segmento, `fst_total_words`, `fst_valid_words`, `fst_invalid_words` y `fst_validity_rate` (0–1). Las palabras se separan por espacios en blanco eliminando la puntuación de los bordes; una palabra en mayúsculas se vuelve a intentar en minúsculas.

```json
{
  "$schema": "https://champollion.dev/schemas/gate-chain/1.json",
  "id": "fst-every-word",
  "description": "Ship a sentence only when the analyzer accepts every word.",
  "gates": [
    { "id": "fst-all-words", "kind": "metric-threshold",
      "metric": "giellalt_fst_validity", "field": "fst_validity_rate",
      "min": 1.0, "on_refuse": "flag" }
  ]
}
```

```bash
mt-eval setup --status               # the languages with a pinned analyzer
mt-eval setup --fst                  # the analyzer runtime
mt-eval setup --lang <code>          # the language's analyzer, once per machine
mt-eval run --corpus <dev file> --target-lang-code <code> --method local-model -m <model folder> \
  --gates gates/fst-every-word.json
```

- El analizador **no viene incluido**: el harness solo incluye anclajes (un nombre de archivo y sha256 por idioma), y `setup --lang` obtiene el analizador desde su fuente original en `~/.mt-eval/fsts/<code>/`, bajo los términos de dicha fuente. Se ejecuta como una herramienta independiente, nunca vinculada a la CLI `champollion`.
- La ausencia de un analizador nunca se convierte en un cero: como métrica se marca como no calculada; como compuerta, detiene la ejecución.
- Una salida vacía obtiene una puntuación de 0 y se rechaza por debajo de `min`.
- Para servir con él, use `on_refuse: "fallback"` y un `fallback` como `{"method": "lexicon", "model": "data/lexicon/words.tsv"}` — solo para `translate` y `serve`.
- **Nota.** La aceptación por FST indica que una palabra existe, no que la oración signifique lo correcto. Es un diagnóstico: nunca entra en la métrica principal de chrF++.

## Las recetas

### LLM con preparación (`llm-coached`)

Un modelo general instruido con las pautas de la comunidad: notas gramaticales, estilo, términos.

```bash
mt-eval run --corpus <dev file> -m <exact model id> --coaching-file coaching.md --glossary terms.json
champollion sync --method llm-coached --coaching-file coaching.md
```

- **En el harness**, el texto del archivo de preparación *es* todo el prompt del sistema, por lo que debe indicar qué traducir y que solo devuelva la traducción. `--glossary` es una entrada de evaluación (adherencia terminológica), que nunca se envía.
- **Bloqueo.** Una ejecución del harness tiene una sola preparación: `--coaching-file`, `--coaching` (texto en línea) o el antiguo `--custom-prompt` — proporcione solo uno. Dos juntos se rechazan: *"--coaching-file and --coaching each give the run its coaching — give one (put inline text in the file, or drop the file)"*.
- **En la CLI**, `llm-coached` envía su propio prompt con la preparación como un bloque de "Coaching guidance", más `.champollion/coaching/<locale>.json` (`grammar_rules`, `style_notes`, `dictionary`).
- **Nota.** Son dos prompts distintos: una puntuación con preparación medida en el harness no corresponde al prompt exacto que entrega la CLI. Indíquelo cuando use uno como evidencia del otro.
- **Envía:** cada oración de origen y la preparación completa al proveedor. Un archivo de preparación con un sidecar de uso exclusivamente local solo se ejecuta en un endpoint de bucle invertido (loopback) (`champollion data mark coaching.md --local-only` marca uno).

### Few-shot

Ejemplos de buenas traducciones dentro de la preparación. Es un LLM con preparación: los mismos comandos, el mismo transporte — los ejemplos viajan en el prompt del sistema hacia el proveedor.

- **Nota.** Nunca tome ejemplos del conjunto de prueba, y nunca de un archivo de uso exclusivamente local para un proveedor remoto. Nada verifica automáticamente los ejemplos de few-shot contra las referencias de prueba.

### LLM aumentado con diccionario

- **CLI:** el `dictionary` en `.champollion/coaching/<locale>.json` se envía a cada método de LLM como "REQUIRED TERMINOLOGY" para los términos encontrados en cada lote (coincidencia de subcadenas que no distingue mayúsculas de minúsculas). DeepL lo recibe como un glosario. Se advierte sobre las infracciones después de traducir; no hay reintento.
- **Harness:** un diccionario solo llega al modelo como texto en el archivo de preparación.
- **Diccionario solo:** `mt-eval run --method lexicon -m data/lexicon/words.tsv --corpus <dev file>` — la frase más larga primero, se conservan las palabras desconocidas, en proceso. `nmt-forge floor` es esto, sobre el conjunto de desarrollo ([medición](/docs/agents/measurement#the-dictionary-floor)).
- **Envía:** las entradas coincidentes del diccionario, junto con las oraciones, al proveedor. Un diccionario de uso exclusivamente local no debe enviarse a un proveedor remoto.

### Híbrido basado en reglas

No hay ningún motor de reglas incorporado. Lo que existe es: `lexicon` (determinista, en proceso); `mt-eval run --method apertium` (un motor basado en reglas — envía texto a `apertium.org` a menos que `APERTIUM_API_URL` apunte a su propio servidor); y plugins `python` para sus propias reglas, opcionalmente con un LLM. Una clase de plugin necesita `async def translate(self, entries, config)`; ejecútela con `mt-eval run --method <folder>`. Valide su salida con una cadena de compuertas.

- **Envía:** lo que sea que llame el plugin. Un plugin es un método externo: en un corpus sellado o que requiera consentimiento (incluido el de uso exclusivamente local), el harness lo rechaza a menos que se use `--attest-local-transport` — el cual usted solo debe pasar tras verificar que todo lo que llama está en esta máquina.

### Métodos encadenados

Hay dos cadenas incorporadas:

1. **El método alternativo de una cadena de compuertas:** método → compuertas → método alternativo en proceso → las mismas compuertas. Solo para `translate` y `serve`.
2. **El método alternativo por par de la CLI** (`"fallback": {"method": …}` en un par de una aplicación): método principal → compuerta de calidad de la CLI → un reintento con la retroalimentación de la compuerta (métodos LLM, o un endpoint de `api` que declare `acceptsInstructions`) → el método alternativo una vez, a través de la misma compuerta.

Cualquier proceso más extenso (generar, editar, validar a través de modelos) es un plugin de `python` o un `service`.

- **Envía:** cada eslabón envía lo que su tipo envía. Una cadena es tan privada como su eslabón menos privado.

### Traducción parcial (personas y máquinas)

El modelo genera un borrador; un hablante revisa y corrige. En los rieles, esta es la ronda de mejora: `champollion improve sheet` genera borradores, el hablante marca `Y`/`N`/`?`, `champollion improve marks` convierte las correcciones y los borradores confirmados en pares de entrenamiento, y las filas de práctica en oraciones de desarrollo ([coaching](/docs/agents/coaching)). Para evaluar las traducciones de las personas como un método (`kind` `human`), ejecute `mt-eval test` sobre sus salidas. Una compuerta con `on_refuse: "flag"` marca la salida para revisión.

- **Nota.** Una oración utilizada para preparar o entrenar un método nunca debe ser una sobre la que se le evalúe.
- **Envía:** nada más allá de las reglas propias del modelo de borrador; las hojas permanecen en la carpeta del proyecto.

### Modelo ajustado

- **En los rieles:** `nmt-forge` (`nmt-checkpoint`; preajustes `cpu-tiny`, `byt5-small`, `byt5-small-lowmem`, `cpu-finetune`, `nllb-600m`), exportado, servido y conectado — [entrenamiento](/docs/agents/training), [servicio](/docs/agents/serving).
- **Un modelo abierto que ya tenga:** `mt-eval run --method local-model -m <Hugging Face id or folder>` — en proceso; nada sale de la máquina.
- **Un LLM que usted mismo sirve** (Ollama, vLLM o cualquiera compatible con OpenAI): `mt-eval run --provider local --base-url http://127.0.0.1:11434/v1 -m <model name>`. Solo cuenta como local cuando el endpoint es una dirección de bucle invertido (loopback).
- **Envía:** nada fuera de la máquina, siempre que el endpoint sea verdaderamente local.

## Para profundizar

- [La especificación del método](/docs/network/specifications/methods) y el [manifiesto del plugin](/docs/reference/plugin-spec) (la estructura anterior).
- [Servicio y despliegue](/docs/agents/serving) — deployment/1 y service-api/1.
- [Reglas de medición](/docs/agents/measurement) — puntuaciones con compuertas.
- [Reglas de datos y transmisión](/docs/agents/data-rules) — lo que se permite enviar.
- [Métodos de traducción para aplicaciones y sitios](/docs/guides/translation-methods).
