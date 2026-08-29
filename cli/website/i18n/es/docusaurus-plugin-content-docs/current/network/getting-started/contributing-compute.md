---
sidebar_position: 4
title: "Contribuir Capacidad de Cómputo"
description: "Ejecutar la cola: ejecuta barridos de evaluación comparativa abiertos desde la cola pública con tu propia clave de API y publica los resultados."
related:
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: guide
  - label: "Cookbook: Coached LLM Prompting"
    to: /docs/network/tutorials/coached-llm-prompting
    kind: cookbook
  - label: "Cookbook: FST-Gated Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
  - label: "Method Interface & Dependency Classes"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Leaderboard Rules & Trust Tiers"
    to: /docs/network/leaderboard/rules
    kind: guide
---

# Contribuir Compute

> **La idea:** la tabla de clasificación tiene casillas vacías: combinaciones de (par de idiomas, método, condición) que nadie ha medido. Mantenemos una cola pública de ellas. Usted ejecuta los elementos con su propia clave de API, publica los informes y el mapa se va completando. Contribuir con capacidad de cómputo es una contribución real y citable a la evaluación de la traducción automática (MT) de bajos recursos.

La cola contiene dos tipos de trabajo. Los **elementos de LLM** prueban un modelo de chat en un par de idiomas, en una condición de prompting `naive` o `coached`. Los **elementos de motor** (condición `engine`) prueban un servicio clásico de MT — DeepL, Google Translate, Microsoft Translator, LibreTranslate, Tilde — en pares dentro de la propia cobertura publicada de ese servicio; estos son la columna vertebral medida del mapa de cobertura, y hasta 2026-08 estaban casi completamente en blanco. Ambos tipos se ejecutan a través del mismo entorno de pruebas (harness) y se publican en el mismo tablero.

## La cola

La cola en vivo se sirve desde la base de datos (el entorno de pruebas la lee por defecto); se publica una instantánea compacta en [champollion.dev/queue-preview.json](https://champollion.dev/queue-preview.json), con el archivo completo en [queue.json](https://champollion.dev/queue.json) (decenas de MB: la vista previa es la primera descarga adecuada). Puede observar lo que construyen sus ejecuciones en [el mapa en vivo en champollion.dev](https://champollion.dev), el mapa de cobertura de quién puede traducir qué. También hay un visor de terminal que no requiere instalación:

```bash
curl -fsSL https://champollion.dev/run_queue | bash -s -- --budget 2
```

El visor solo *muestra* elementos abiertos y sus comandos exactos `mt-eval run` — nunca ejecuta nada ni gasta sus tokens. Cada elemento contiene:

- `run_command` — listo para copiar y pegar (descarga el corpus, ejecuta el entorno de pruebas)
- `est_cost_usd` y `est_basis` — ya sea el costo **observado** de nuestra propia ejecución de referencia del mismo (corpus, modelo), o una **extrapolación** del costo promedio por entrada del barrido de ese modelo × el recuento de entradas del corpus. La base se indica por elemento; su costo real depende de los precios del proveedor en el momento de la ejecución.
- `priority` — la clasificación publicada (modo de encuesta: primera luz a través de
  pares, idiomas y familias por dólar). La vista previa también publica
  **niveles de presupuesto** — lo que compran $1 / $10 / $100 / $1000 de la parte superior de la
  clasificación (elementos, pares, modelos alcanzados) — para que pueda dimensionar una contribución
  antes de gastar nada. El modelo de valor subyacente es el **valor de
  cadena esperado**: cuánto se predice que esta única ejecución fortalecerá toda la malla de idiomas, por dólar estimado. Cada elemento lleva el desglose completo de su fórmula (`edge_strength`, `pair_prior`, `model_offset`, `exploration_bonus`, `predicted_strength`, `expected_mesh_gain`, `ecv_per_usd`) para que cualquier clasificación pueda volver a derivarse a mano; la fórmula y sus valores predeterminados se publican en la [Especificación de construcción de la cola](/docs/network/specifications/queue-construction), y el razonamiento detrás de ella en [Por qué la cola se construye de esta manera](/docs/network/perspectives/why-the-queue).

**Sin bloqueo de reclamación — elija cualquier elemento abierto.** Dos personas ejecutando el mismo elemento es inofensivo por diseño: cada tarjeta de ejecución tiene huella digital (SHA-256 sobre hash de conjunto de datos + modelo + condición + indicación del sistema, [Especificación de Referencia §3.8](/docs/network/specifications/benchmark)), por lo que las ejecuciones idénticas se deduplicarán al publicar, y las replicaciones independientes de la misma configuración son evidencia útil, no desperdicio.

Los corpus en cola están divididos en dev, CC-BY-family (derivados de Tatoeba), y marcados `do_not_train` — son conjuntos de evaluación, no datos de entrenamiento. Los corpus con licencia no comercial y en cuarentena se excluyen de la cola abierta.

## Configuración (una sola vez)

```bash
# 1. Install the harness (python3 + pipx, no sudo — read it first if you like)
pipx install mt-eval-harness

# 2. Set your API key — any ONE of these; the harness auto-detects it
export OPENROUTER_API_KEY="sk-or-..."     # reaches every model in the queue
# or a direct vendor key:
#   ANTHROPIC_API_KEY / OPENAI_API_KEY / GOOGLE_API_KEY
# (any of them can also live in a local .env file)
```

### ¿Qué clave de proveedor?

El arnés acepta cuatro claves de proveedor, seleccionadas con `--provider` en `mt-eval run` y `mt-eval queue` — o detectadas automáticamente de cualquier clave establecida en su entorno o `.env`:

| `--provider` | Clave | Alcanza |
|---|---|---|
| `openrouter` (predeterminado) | `OPENROUTER_API_KEY` | cada modelo en la alineación de cola |
| `anthropic` | `ANTHROPIC_API_KEY` | modelos Anthropic Claude |
| `openai` | `OPENAI_API_KEY` | modelos OpenAI GPT |
| `gemini` | `GOOGLE_API_KEY` | modelos Google Gemini |

Una clave [OpenRouter](https://openrouter.ai/keys) alcanza cada modelo en la alineación, y el seguimiento de costos del arnés y las instantáneas de precios provienen de los mismos metadatos de OpenRouter, por lo que el costo de ejecución reportado coincide con lo que se facturó a su clave — por eso es el predeterminado. Si sus créditos están con Anthropic, OpenAI o Google directamente, establezca la clave de ese proveedor y el arnés llama a la API del proveedor sin proxy. Una clave directa solo alcanza los propios modelos de ese proveedor (bueno para un lote de un solo proveedor), y sus cifras de costo provienen de los precios publicados del proveedor en lugar de metadatos facturados — trátelos como estimaciones cercanas. Si se establecen tanto una clave OpenRouter como una clave directa, la detección automática elige OpenRouter; el trabajador de cola le dice así y cómo anularlo con `--provider`. Cada tarjeta de ejecución registra qué carril la ejecutó en su campo `api_provider`.

(`mt-eval run` también toma `--provider local` para puntos finales compatibles con OpenAI autohospedados — Ollama, vLLM, LM Studio — vía `--base-url`. Es una opción explícita, nunca detectada automáticamente.)

### Sin clave de API: ejecute un modelo autoalojado

No necesita una clave en la nube en absoluto. El método `local-model` ejecuta un modelo abierto de MT neuronal en su propio hardware: los modelos que los motores en la nube no ofrecen, que es exactamente donde reside la cobertura de bajos recursos: **NLLB-200**, **OPUS-MT** (Helsinki-NLP) y **MADLAD-400**.

```bash
# transformers backend (Hugging Face) — install the extra once:
pip install 'mt-eval[local-models]'

# then point --model at any Hugging Face id (or a local from_pretrained dir):
mt-eval run --method local-model \
  --model facebook/nllb-200-distilled-600M \
  --dataset flores-eng-fra
```

**Dos "formas habituales" de cargar un modelo, seleccionadas automáticamente; nada que configurar:**

- **transformers** (predeterminado): `--model` es un ID del hub de Hugging Face (`facebook/nllb-200-distilled-600M`, `Helsinki-NLP/opus-mt-en-es`, `google/madlad400-3b-mt`) o un directorio `from_pretrained()` local. Requiere `pip install 'mt-eval[local-models]'`.
- **CTranslate2** (inferencia rápida en CPU/GPU): `--model` es un directorio de modelo convertido a CTranslate2 (uno producido por `ct2-transformers-converter`, que contiene un `model.bin`). Requiere `pip install 'mt-eval[ctranslate2]'`. El tokenizador se lee desde el directorio convertido, o se nombra con `LOCAL_TOKENIZER_ID`.

El backend se detecta a partir de la ruta del modelo (un directorio de CTranslate2 tiene un `model.bin`); fuércelo con `LOCAL_MODEL_BACKEND=transformers|ctranslate2` si alguna vez lo necesita.

**Los códigos de idioma provienen de la tarjeta de idioma, no de una suposición.** Para un modelo multilingüe como NLLB, el entorno de pruebas lee el código FLORES-200 directamente de la tarjeta del idioma de destino (la misma fuente de verdad que utilizan todos los métodos). Un idioma que el modelo genuinamente no admite — NLLB-200, por ejemplo, no tiene Plains Cree (`crk`) — **falla honestamente** ("fuera del alcance de este modelo") en lugar de emitir un código falso y una traducción plausible pero incorrecta. Los modelos OPUS-MT son específicos para cada par, por lo que el par *es* el modelo.

La ejecución de un modelo local se califica y publica exactamente igual que cualquier otra ejecución: mismas métricas, misma tarjeta de ejecución, misma tabla de clasificación. (Es un método del entorno de pruebas; la herramienta de traducción de la CLI lo alcanza más tarde a través de un puente de subproceso, por lo que Node nunca necesita una pila de ML de Python).

### La vía rápida del agente

Si trabaja con Claude Code u otro agente de codificación, toda la contribución es una indicación:

```text
Install the Champollion mt-eval harness with `pipx install mt-eval-harness`.
Fetch https://champollion.dev/queue.json and show me the top 3 open items.
Using my API key (OPENROUTER_API_KEY, or a direct ANTHROPIC_API_KEY /
OPENAI_API_KEY / GOOGLE_API_KEY), execute the run_command of the
item I pick, then run `mt-eval publish` on the generated report JSON and
show me the published run card.
```

## Nivel 0 — Un comando

La forma más rápida de contribuir es dejar que el arnés tome la parte superior de la
cola para usted:

```bash
mt-eval queue --top 5          # run the 5 highest-value open items
mt-eval queue --budget 2.50    # or: run from the top until ~$2.50 of
                               # estimated spend is committed
mt-eval queue --top 3 --dry-run   # see the plan first, spend nothing
```

Nunca reordena — el orden de la cola *es* el [modelo de
prioridad](/docs/network/specifications/queue-construction) — y muestra el plan completo
con gasto estimado y pregunta antes de ejecutar cualquier cosa. Los elementos entrenados se omiten a menos que traiga su propio archivo de entrenamiento
(`--include-coached --coaching-file my-coaching.txt`).

**El trabajador de cola publica por usted — no se necesita cuenta.** A diferencia de un solo
`mt-eval run` (que nunca publica automáticamente), `mt-eval queue` resuelve una
identidad de publicación *antes* de gastar tokens y **publica automáticamente cada
ejecución exitosa** en el tablero a medida que se completa — sin paso de publicación separado. Inicie sesión (GitHub/Google) solo si desea su nombre en el tablero;
de lo contrario, continúe anónimamente y los resultados se publican como remitente `anonymous`
(`--anonymous` lo fuerza, y las ejecuciones `curl | bash` no interactivas sin inicio de sesión en caché predeterminado a él, diciéndolo en voz alta). Pase `--no-publish` para
mantener los resultados locales en su lugar (puede publicarlos más tarde con `mt-eval
publish`). Luego vea qué construyeron sus ejecuciones en
[el mapa en vivo en champollion.dev](https://champollion.dev).

## Nivel 1 — Ejecutar una referencia

Cada `run_command` del elemento de cola es autónomo. Uno típico:

```bash
mt-eval run --corpus eval-eng-yor-tatoeba-dev-v1 \
  --model anthropic/claude-haiku-4.5 \
  --target-lang "Yoruba" \
  --yes
```

Usted pasa el **id del registro**, no un archivo — el arnés obtiene la referencia de
su fuente ascendente en tiempo de ejecución y califica contra los datos recién obtenidos
(el contenido del corpus nunca se hospeda ni se rastrea aquí).

La ejecución imprime su costo total y escribe un registro de ejecución más un reporte calificado en `eval/logs/`. Luego publique:

```bash
mt-eval publish eval/logs/harness/run_..._report.json
```

**No se necesita cuenta.** La publicación ofrece un inicio de sesión OAuth (GitHub/Google) para que su nombre se convierta en la atribución del tablero — pero es opcional: `mt-eval publish <report> --anonymous` publica sin una cuenta, y la fila se muestra exactamente como cualquier otro resultado autoevaluado con remitente `anonymous`. La entrada anónima tiene límite de velocidad (algunas tarjetas por hora por conexión; el inicio de sesión es la vía ilimitada) y se ejecuta a través de las mismas puertas de integridad de base de datos que cualquier otra presentación — cuarentena, rangos de puntuación, vinculación de corpus-sha, y la protección de contenido de corpus se aplican idénticamente. Anónimo o atribuido, las presentaciones de la comunidad llegan al nivel de confianza **autoevaluado** — claramente etiquetado como "enviado por la persona que lo ejecutó." Eso no es una degradación; es el modelo de confianza funcionando. La tarjeta de ejecución contiene todo lo necesario para que cualquiera vuelva a ejecutar su configuración exacta: hash del conjunto de datos, modelo, condición, la indicación del sistema completa, y costo. Los niveles elevados (verificación, validación de la comunidad) se otorgan por revisión — vea [Reglas del Tablero](/docs/network/leaderboard/rules).

:::note[Moderación]
Las filas anónimas se moderan como todo lo demás: las presentaciones son inmutables para la API pública, y cualquier eliminación o corrección del curador se realiza a través del carril de rol de servicio, donde el registro de auditoría de la base de datos preserva la fila anterior — por lo que una purga se registra y es reversible, nunca silenciosa.
:::

## Nivel 2 — Crear indicaciones entrenadas

El arnés tiene soporte de primera clase para **entrenamiento**: reemplace la indicación del sistema ingenua con una que lleve conocimiento lingüístico real. Pase `--coaching-file` (o `--coaching "inline text"` para indicaciones cortas) y el arnés usa su texto como la indicación del sistema, registra el **texto completo más su SHA-256** en el bloque de procedencia del registro de ejecución, y etiqueta la condición de la ejecución como **`coached`** (a menos que establezca `--prompt` explícitamente) — por lo que la elaboración de indicaciones es un experimento reproducible y atribuible, dos archivos de entrenamiento diferentes nunca pueden confundirse entre sí, y las ejecuciones entrenadas nunca se confunden con líneas de base ingenuas en el tablero.

Un ejemplo trabajado para Feroés, usando hechos de tipología y entradas de glosario de la [tarjeta de idioma pública](https://champollion.dev/languages) del idioma:

```text title="coaching-fao.txt"
You are translating English into Faroese (føroyskt).

Grammar notes:
- Faroese is a North Germanic V2 language: the finite verb is the second
  constituent of a main clause.
- Nouns inflect for case (nominative, accusative, dative, genitive),
  gender (masculine, feminine, neuter), and number. Make adjectives and
  determiners agree.
- The skerping pattern applies before -gv/-ggj sequences; preserve
  standard orthography including ð (which is silent).

Glossary (use these exact equivalents):
- language -> mál
- island -> oyggj
- weather -> veður

Style: plain register, modern standard orthography. Output only the
Faroese translation, no commentary.
```

```bash
mt-eval run --corpus eval-eng-fao-tatoeba-dev-v1 \
  --model anthropic/claude-haiku-4.5 \
  --target-lang "Faroese" \
  --coaching-file coaching-fao.txt \
  --yes
```

(Escriba su propio contenido de entrenamiento — los hechos anteriores ilustran la *forma*: algunas reglas gramaticales de alto impacto, un pequeño glosario de términos que el modelo entiende mal, una instrucción de registro. Las tarjetas de idioma en [champollion.dev/languages](https://champollion.dev/languages) citan fuentes de tipología de las que puede extraer.)

Compare contra la línea de base ingenua con `mt-eval compare <naive_log> <coached_log>`, itere, y publique su mejor ejecución. La ejecución se publica con condición `coached` automáticamente; si desea que el tablero muestre un método nombrado en lugar de la etiqueta genérica, adjunte una tarjeta de método cuando publique (el flujo de publicación ofrece un asistente). Vencer la línea de base ingenua en un par de bajo recurso con nada más que ingeniería de indicaciones es un hallazgo genuino y publicable — vea el [libro de cocina completo de Indicaciones LLM Entrenadas](/docs/network/tutorials/coached-llm-prompting) para orientación de diseño.

## Nivel 3 — Construir un método

La contribución más ambiciosa: implemente el protocolo `TranslationMethod` (`translate(entries, config)`) y evalúe un sistema real, no una indicación. El arnés lo ejecuta vía `--method <plugin-dir>` e incrusta su tarjeta de método en la tarjeta de ejecución. Patrones con libros de cocina trabajados:

- **[Tuberías con puerta FST](/docs/network/tutorials/fst-gated-pipeline)** — cada palabra candidata se verifica con un analizador morfológico; el LLM regenera hasta que la puerta pase. Salida semideterminista, garantizada por morfología.
- **[Generación aumentada por diccionario](/docs/network/tutorials/dictionary-augmented-llm)** — busque términos de origen en un léxico bilingüe en tiempo de traducción y restrinja la salida.
- [Modelos encadenados](/docs/network/tutorials/chained-models), [recuperación de pocos disparos](/docs/network/tutorials/few-shot-prompting), [retrotraducción](/docs/network/tutorials/back-translation), [híbridos basados en reglas](/docs/network/tutorials/rule-based-hybrid)…

Los métodos declaran una **clase de dependencia** (S/O/A1/A2/X — vea [la especificación de métodos](/docs/network/specifications/methods#method-validity-and-dependency-classes)) describiendo qué necesitan para ejecutar y transferir: una tubería autónoma es Clase S; una que llama a una API de diccionario con licencia en tiempo de ejecución es A2. Declare honestamente — la clase determina dónde puede competir su método, y los manifiestos se auditan.

## Por qué esto importa más allá del tablero

Cada ejecución publicada es evidencia independiente sobre la calidad de MT para un par de idiomas que los proveedores comerciales no miden. La cola también funciona como un registro público de *demanda*: qué pares considera la comunidad que vale la pena medir, qué cobertura cuesta a los precios actuales de API, y cuánto se extiende el compute contribuido. Cuando pedimos a agencias de financiamiento que financien barridos sistemáticos, esta cola y su tasa de llenado son la evidencia de demanda.
