---
sidebar_position: 0
title: "Así que deseas entrenar tu propio modelo"
description: "Una guía integral de extremo a extremo orientada a agentes para entrenar un modelo de traducción de bajos recursos con nmt-forge —desde python3 -m pip install hasta un modelo servido a la CLI de champollion. Usted dirige a un agente de código; las salvaguardas detectan automáticamente los errores de principiante."
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
    note: "The whole journey: find what exists, measure, build, prove, deploy"
  - label: "MT Training in Plain Language"
    to: /docs/network/context/mt-training-concepts
    kind: doc
    note: "Read this first if any word below is unfamiliar"
  - label: "Train a Model Honestly (nmt-forge)"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The guardrail catalogue, one page"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Where a finished model goes"
  - label: "Metric Reliability"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Know which score to trust before you optimize"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
---

# Así que quiere entrenar su propio modelo

Esta es una guía completa paso a paso para entrenar un modelo de traducción
automática para un idioma de bajos recursos: desde «hablo este idioma y casi no hay
datos» hasta un modelo que usted pueda reportar con honestidad, servir a su propia
aplicación a través de la CLI de champollion y enviar a la [Red](/docs/network/). El
entrenamiento es solo un paso de un recorrido más largo (encontrar lo que existe, medir
las opciones, construir algo mejor, demostrarlo, desplegarlo); [Construir TA para su
idioma](/docs/build-mt-for-your-language) ofrece una visión general de todo el proceso.
Está escrito para principiantes y asume la forma moderna de realizar este trabajo:
**usted dirige un agente de programación** (Claude Code, OpenAI Codex, Cursor, OpenCode,
Google Antigravity o similar) y el agente ejecuta las herramientas.

Así que cada paso a continuación tiene la misma forma:

- 🗣️ **Indíquele a su agente** — qué solicitar, en lenguaje natural.
- 🛠️ **Lo que hace la herramienta** — lo que [nmt-forge](/docs/network/getting-started/training-honestly)
  ejecuta en su nombre, y la **barrera de seguridad** que atrapa el error clásico
  antes de que pueda costarle.
- 👀 **Cómo leer el resultado** — qué se ve "bien" y qué debe preocuparle.

:::info[Primero, el vocabulario]
Si términos como *dev set*, *decoding*, *chrF++*, *leakage*, o *round-trip
verification* no son segunda naturaleza aún, lea
[**MT Training in Plain Language**](/docs/network/context/mt-training-concepts)
primero — define cada palabra usada aquí con un ejemplo trabajado. Esta página se
apoyará en todas ellas.
:::

:::note[La honestidad es la característica, no la fricción]
La herramienta es opinada a propósito. Sus barreras de seguridad mecanizan errores reales y medidos
que un proyecto real cometió — así que el camino honesto es el predeterminado, y los
atajos deshonestos **se niegan con un mensaje que nombra la solución**. Donde vea
un rechazo en esta guía, eso es la herramienta haciendo su trabajo. Usted lo quiere.
:::

---

## Lo que necesita antes de comenzar

- **Un agente de programación** con acceso a la terminal y al sistema de archivos. Ese es el conductor.
- **Algunas oraciones traducidas reales** para su par de idiomas; incluso unos pocos
  cientos de pares creados por humanos son un inicio viable. Libros de texto bilingües,
  archivos comunitarios, registros públicos traducidos, material educativo. Calidad sobre
  cantidad.
- **Opcional pero potente:** texto monolingüe en su idioma de destino, un
  diccionario bilingüe, una gramática de referencia publicada y un analizador
  morfológico (FST). **No** necesita todo esto para comenzar: la herramienta le
  indica exactamente cuáles están presentes y cuáles habilitan qué capacidades.
- **Cómputo:** una computadora portátil. Las barreras de protección (guardrails), la división, la síntesis,
  la auditoría y la puntuación se ejecutan en una CPU, al igual que el entrenamiento del
  modelo predeterminado (un pequeño transformer entrenado desde cero). Una GPU solo
  importa si elige el ajuste preestablecido más grande (`nllb-600m`); consulte el [Paso 5](#step-5--train).

> 🗣️ **Dígale a su agente:** *"Instala nmt-forge con su extra de entrenamiento
> (`python3 -m pip install 'nmt-forge[hf]'`) y confirma que el comando `nmt-forge` funcione.
> Vamos a entrenar un modelo de traducción de inglés → \<your language\>,
> honestamente."*

```bash
python3 -m pip install 'nmt-forge[hf]'     # Python 3.11+; brings mt-eval-harness, the scorer
```

El extra `[hf]` es la pila de entrenamiento (torch, transformers, accelerate,
tokenizers, sentencepiece, peft); las ruedas (wheels) exclusivas para CPU están bien. No
se necesita nada más: no requiere clonar el repositorio de Champollion. Cada comando acepta `--json`
(un documento JSON en stdout; un rechazo regresa como `{"error": {…, "why",
"fix"}}` with exit code 2), and `nmt-forge status` indica el siguiente comando en
cualquier momento.

Su agente puede llamar a la herramienta `get_training_guardrails` del servidor MCP de Champollion (sin argumentos; `topic` opcional)
para cargar el libro de reglas completo —las diez barreras de protección y el error que elimina cada una—
en su propio contexto antes de escribir cualquier comando. Si está dirigiendo a un agente,
pídale que haga eso primero.

---

## Paso 1 — Elija una lengua y vea qué realmente existe

Cada proyecto comienza preguntando al índice qué tiene la lengua, honestamente.

> 🗣️ **Indíquele a su agente:** *"Ejecute `nmt-forge discover` para el código ISO 639-3 de mi lengua de destino
> y resuma qué datos existen y qué falta."*

```bash
nmt-forge discover nav        # Navajo, as an example
```

🛠️ **Qué hace la herramienta.** Lee la **ficha** (card) de Champollion del idioma —la
única fuente de verdad sobre lo que se conoce de ese idioma— e informa los
sistemas de escritura, analizadores morfológicos, diccionarios, corpus y conjuntos de datos de evaluación que
registra, y luego sitúa el idioma en la **escala de recursos** (asset ladder). (Las fichas provienen de un
directorio que usted indique con `--cards-dir`, una copia local u
`node_modules/champollion`, o del índice público de fichas —almacenado en caché, por lo que funciona
sin conexión tras la primera descarga. Si está sin conexión y sin caché, exporte la ficha con
`champollion network card <code> --json` a un directorio y pase `--cards-dir`).

```
THE ASSET LADDER — what this language can do TODAY:
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 3: dictionary (+ grammar) → a cited template pack is worth building
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  ? rung 5: LYSS referee → the language's own metric in selection
```

👀 **Cómo leer el resultado.** Las marcas `✓` indican lo que puede hacer ahora; las marcas `?`
son peldaños que esperan un recurso. De manera fundamental, **la ausencia en una ficha significa
*desconocido*, nunca «este idioma no tiene nada».** Una ficha escasa es una invitación
a agregar lo que sabe, no un callejón sin salida; e incluso una ficha vacía le proporciona el ciclo completo
de entrenamiento protegido en el peldaño 1. Una ficha rica (como Plains Cree) conecta los
peldaños superiores automáticamente: sus conjuntos de evaluación llegan marcados como **NEVER TRAIN ON THIS** (nunca entrenar con esto), y
su árbitro (referee) específico del idioma viene listo para conectarse. El peldaño 5 solo se marca cuando
el paquete de ese árbitro está instalado aquí; de lo contrario, dice ✗ *UNAVAILABLE*
junto con el comando de instalación, y el árbitro nunca se carga para un conjunto de prueba exclusivamente local o
sellado, ya que puede consultar palabras en un servicio externo.

Luego andamie un proyecto:

> 🗣️ **Indíquele a su agente:** *"Andamie un proyecto con `nmt-forge init` para este
> par de lenguas y léame el `NEXT_STEPS.md` que genera."*

```bash
nmt-forge init nav --dir my-nav-mt --pair eng-nav
cd my-nav-mt                     # run every later command from here
```

🛠️ Esto crea un espacio de trabajo (un directorio `.forge/` que consulta cada
barrera de protección), una **configuración inicial** y un resumen `NEXT_STEPS.md` redactado para *usted
y su agente*: el orden de los comandos, la escala de recursos para su idioma y
los puntos no negociables. Es el mapa para todo lo que sigue. Las rutas de la configuración son
relativas, por lo que debe ejecutar forge desde dentro del directorio del proyecto.

`init` también elige el **modelo** que entrenará (`--model`, detallado con
números explícitos en `config.json`): `cpu-tiny` de forma predeterminada, `cpu-finetune --base
<hf-id>`, or `nllb-600m`. El [Paso 5](#step-5--train) explica la elección. Si su
idioma aún no tiene una ficha, `nmt-forge init <code> --no-card --name "<name>"`
sigue estructurando el proyecto: cada dato de la ficha se registra como desconocido, nada
se inventa.

---

## Paso 2 — Apunte a un analizador y diccionario (si los tiene)

Este paso trata sobre **peldaños 3–4** de la escalera. Si su lengua no tiene
analizador, salte al [Paso 4](#step-4--split-your-real-data-safely) — entrenará
en datos reales (y retrotraducidos) solamente, que es un camino completamente legítimo.

Si un analizador y diccionario *sí* existen, desbloquean la capacidad de
*fabricar* datos de entrenamiento verificados — la palanca más grande para una lengua
con poco texto paralelo.

> 🗣️ **Indíquele a su agente:** *"La tarjeta lista un analizador morfológico y un
> diccionario para esta lengua. Obténgalos según las instrucciones de instalación en la
> tarjeta, apunte el paquete de lengua a ellos mediante las variables de entorno documentadas, y
> confirme que el analizador hace round-trip de algunas palabras conocidas."*

🛠️ **Lo que hace la herramienta — y un límite que no cruzará.** Los analizadores (FSTs)
y diccionarios son **herramientas separadas obtenidas por el usuario bajo sus propias licencias**.
El conjunto **nunca los agrupa ni redistribuye** — le apunta a dónde vienen
y cuál es su licencia, y usted los obtiene. Esto no es burocracia: muchos recursos de lengua
llevan restricciones reales de permiso y soberanía, y la herramienta las respeta por construcción.

El tejido conectivo es un **paquete de lengua**: un pequeño complemento que adapta *su*
analizador, diccionario, reglas de ortografía, y plantillas de oraciones citadas por gramática al
motor. El conjunto **no** envía paquetes en sí — los paquetes viven con sus
lenguas (el paquete de Plains Cree, por ejemplo, vive en su propio proyecto y
se conecta por ruta de módulo).

👀 **Cómo leer el resultado.** Quiere que el analizador haga **round-trip**: deletree una
forma, alimente el deletreo de vuelta, obtenga las mismas etiquetas gramaticales. Si no lo hace, el
**canonicalizador** del paquete — la única función que normaliza la ortografía dondequiera que
dos componentes se encuentren — probablemente necesita una regla. Acertar esto importa: un
solo carácter no reconciliado (`ý` vs `y`) una vez eliminó silenciosamente 1.375 verbos
de un pipeline de generación durante semanas. La **auditoría de embudo** de la herramienta cuenta
sobrevivientes en cada etapa precisamente para que una caída silenciosa como esa no pueda ocultarse.

---

## Paso 3 — Sintetice datos de entrenamiento a partir de reglas gramaticales

Con un analizador + diccionario + un paquete de plantillas citadas por gramática, puede
fabricar cientos de miles de pares verificados.

> 🗣️ **Indíquele a su agente:** *"Genere datos de entrenamiento sintéticos con
> `nmt-forge synth` usando nuestro paquete de lengua, luego muéstreme el informe de cobertura."*

```bash
nmt-forge synth my_pack.module:get_pack --out data/synth.jsonl
```

🛠️ **Lo que hace la herramienta — la ley de emisión.** Cada fila que llega a la salida
debe satisfacer reglas de las que ningún paquete puede optar por no participar:

- **Round-trip verificado** — cada palabra generada pasa *generar → analizar →
  mismo análisis*, o la fila se descarta. Ninguna forma no verificada se emite jamás.
- **Citada por gramática** — cada tipo de plantilla cita la gramática publicada que
  transcribe. Las plantillas no citadas no existen; el código se niega a cargarlas.
- **Cobertura verificada** — las plantillas se cuentan contra una lista de verificación de
  fenómenos gramaticales requeridos (imperativos, preguntas, posesión, formas inversas…). Si un
  fenómeno *requerido* tiene cero ejemplos, la compilación falla. Esta
  es la guardia contra la trampa "un millón de oraciones, todas las mismas pocas formas"
  — volumen que oculta agujeros estructurales.
- **Marcado de procedencia** — cada fila sintética está marcada `synthetic: true`.
  Esa marca es de carga: el registro se **negará** a registrar
  filas sintéticas como un conjunto de prueba. Las pruebas son solo datos reales.

👀 **Cómo leer el resultado.** Mire el informe de cobertura para **elementos requeridos con cobertura cero**
(un fenómeno gramatical que sus plantillas nunca produjeron) y la **distribución de tipos** — si dos
formas de plantilla dominan, el límite por tipo del muestreador (predeterminado 15%) las reequilibrará
para que ningún patrón único se convierta en la mitad de la experiencia del modelo.

:::tip[¿No tiene analizador? Use retrotraducción en su lugar]
Si no puede sintetizar a partir de reglas pero tiene texto **monolingüe** en el idioma de
destino, pídale a su agente que utilice el carril de **retrotraducción** (backtranslation): traduce automáticamente
su texto monolingüe *hacia* el inglés con un modelo inverso que usted proporcione y empareja
cada resultado con la oración de destino **real**. El lado de destino se mantiene auténtico.
Es una llamada a la biblioteca de Python (`nmt_forge.training.backtranslation.backtranslate`),
no un subcomando de la CLI: su agente escribe un breve script a su alrededor y añade el
archivo de salida etiquetado a los carriles `data.synthetic` de la configuración. La llamada
**audita primero las filtraciones del texto monolingüe**, porque ese texto podría *ser* en secreto
sus datos de evaluación. Consulte la
[guía práctica de retrotraducción](/docs/network/tutorials/back-translation).
:::

---

## Paso 4 — Divida sus datos reales de forma segura

Ahora tome sus pares **reales** y reserve las oraciones con las que juzgará
todo. Aquí es donde se esconde el error más destructivo de resultados en la
TA de bajos recursos, y donde la barrera de protección demuestra su verdadero valor.

Sus archivos pueden ser `.tsv` (origen, un TAB, luego la traducción, un par por
línea; las líneas que comienzan con `# ` son comentarios) o `.jsonl` (`{"source": …,
"target": …}` por línea).

**Si ya tiene un conjunto de prueba** —verificado por docentes, por personal de enfermería, privado—,
manténgalo en un archivo independiente, regístrelo, examine el corpus frente a él y extraiga
únicamente entrenamiento (train) y desarrollo (dev):

> 🗣️ **Dígale a su agente:** *"Registra nuestro conjunto de prueba, audita las
> filtraciones del corpus contra él, y luego divide el corpus limpio en train y dev con
> `nmt-forge split`, con grupos disjuntos (group-disjoint) y una semilla fija."*

```bash
nmt-forge registry add project-test ~/teacher-test.tsv --role test
nmt-forge leak-audit ~/corpus.tsv --clean-to corpus.clean.jsonl
nmt-forge split corpus.clean.jsonl --test 0 --dev 100 --seed 42 \
    --out data/split --register project
```

**Si no lo tiene**, extraiga el conjunto de prueba a partir del corpus en el mismo paso:

```bash
nmt-forge split corpus.tsv --test 150 --dev 100 --seed 42 \
    --out data/split --register project
```

🛠️ **Qué hace la herramienta: la protección de división (split-guard).** Realiza una **división
por grupos disjuntos**: cada par que comparte un origen *o* un destino se vincula en un solo grupo,
y cada grupo completo queda enteramente de un solo lado. Luego **verifica que haya cero
superposición** y se niega a continuar si existe alguna:

```
split corpus.clean.jsonl: 1580 rows in 1544 share-groups (largest 4)
  train 1480 · dev 100 · test 0  → data/split/
  verified: 0 shared canonical source/target keys across sides
  registered project-dev (role=dev)
```

Esto elimina la **filtración tipo «Feed him» / «Feed her»**: un libro de texto asigna ambos ejercicios
en inglés a una sola palabra de destino (`asam`); una división aleatoria ingenua coloca una copia en train
y su gemela en test, por lo que el modelo «aprueba» de memoria. En un proyecto real, 17
de 54 filas de prueba se filtraron de esta manera y obtuvieron una puntuación de 83 frente a 44 para las filas limpias —y cada
hallazgo construido sobre ese número quedó invalidado—. `--register project` registra el conjunto de desarrollo
(y el conjunto de prueba, cuando se extrae) como `project-dev` / `project-test` —los
nombres a los que ya apunta la configuración inicial—, de modo que cada comando posterior sabe que son
*conjuntos de evaluación con los que nunca se debe entrenar*. Cuando un conjunto de prueba ya está
registrado, `split` también examina los nuevos archivos de train y dev contra él en
el acto.

🛠️ **Y la auditoría de filtraciones.** `leak-audit` examina las filas comparándolas con cada conjunto de evaluación
registrado e indica, con ejemplos de su propio corpus, qué **descartaría**:
una fila cuyo origen sea idéntico a una consigna de prueba (incluso si su traducción
difiere), una fila cuyo destino sea idéntico a una respuesta de prueba, y una fila cuyo
destino sea un casi-duplicado de una respuesta de prueba (contiene la respuesta, es un
fragmento de ella o es al menos 90 % idéntica normalizando acentos); y qué
**conserva a propósito**: *hermanos de plantilla* (template siblings) que comparten la estructura de una oración pero cambian
una palabra (*«I see the dog»* / *«I see the cat»*), y consignas casi duplicadas con
una respuesta diferente. Las filas de prueba que tienen un hermano de plantilla en el entrenamiento se
listan y, dado que la configuración inicial establece `eval.near_dupe_corpus` hacia su
archivo de entrenamiento, el informe final puntúa las filas de prueba *sin* un hermano
por separado, como una puntuación «(strict)», para que el optimismo que aportan los hermanos sea
visible. Cuando la mayoría de las filas de prueba tienen un hermano y el conjunto de prueba es fijo,
`--clean-to <file> --drop-test-twins` también elimina esos gemelos de entrenamiento (informa
el subconjunto estricto antes y después, y se niega a vaciar el entrenamiento).
Asígnele un archivo propio (`corpus.notwins.jsonl`): es el corpus del modelo
libre de gemelos, junto al de todos los datos, y leak-audit se niega a sobrescribir
un archivo que una configuración, una ejecución o una división ya estén leyendo.
El resultado es determinista y el texto del
propio archivo de prueba nunca se imprime.

👀 **Cómo leer el resultado.** Quiere ver la línea **verified: 0 shared**. Si en su lugar
obtiene un `SplitLeakageError`, no elimine filas manualmente — eso solo reshuffles el problema. Vuelva a ejecutar
la división disjunta por grupo; esa es la solución, y el mensaje de error lo dice.

:::danger[Nunca entrene en un benchmark]
Si extrae un conjunto de datos de evaluación del registro compartido (`nmt-forge registry
add-harness`), la herramienta lo marca y lo trata como fuera de los límites para entrenamiento —
**cada** benchmark del registro está marcado *do-not-train*. Ajuste fino en lo que legítimamente pueda;
solo nunca en el conjunto de prueba. Esta es
[la única regla](/docs/network/leaderboard/rules) de toda la Red.
:::

---

## Paso 5 — Entrene

Un solo archivo de configuración describe toda la ejecución; un solo comando la ejecuta
de forma reproducible. `nmt-forge init` ya lo escribió.

> 🗣️ **Dígale a su agente:** *"Lee `config.json`, agrega nuestro carril sintético si
> creamos uno, ejecuta `nmt-forge preflight run --config config.json`, corrige todo lo que
> señale, luego ejecuta `nmt-forge run config.json` y observa los diagnósticos
> del cronograma."*

Un extracto de la configuración inicial, con el modelo predeterminado `cpu-tiny` y un
carril sintético añadido:

```jsonc
{
  "run_name": "nav-baseline",
  "workspace": ".forge",
  "data": {
    "gold": ["data/split/train.jsonl"],
    "synthetic": [{"path": "data/synth.jsonl", "tag": "<synth>"}],
    "dev": "project-dev"              // registry name, role=dev — the fence
  },
  "mix": {"gold_upweight": 20, "kind_cap": 0.15, "seed": 42},
  "regime": "auto",
  "model": {"backend": "hf-scratch", "device": "cpu", "d_model": 256,
            "layers": 3, "epochs": 60, ...},   // no time_budget_hours: init writes none
  "selection": {"metric": "generation:chrf++", "top_k": 3},
  "decode": {"max_new_tokens": 384, "headroom_factor": 1.5},
  "eval": {"battery": "project-test", "metrics": ["chrf++"],
           "near_dupe_corpus": "data/split/train.jsonl"}
}
```

**¿Qué modelo?** Elíjalo cuando ejecute `init` (`--model`); cada número queda registrado en
`config.json`:

| ajuste preestablecido | qué es | requisitos | expectativa honesta |
|---|---|---|---|
| `cpu-tiny` (predeterminado) | un pequeño transformer (~6M de parámetros) entrenado desde cero; su vocabulario se aprende únicamente de sus filas de **entrenamiento** | una CPU de computadora portátil, sin descargas | baja: con 1 a 2 mil pares, chrF++ aproximadamente entre 5 y 30 (el extremo superior solo para datos basados en plantillas muy repetitivas); frases y patrones de sus datos, no traducción general |
| `cpu-finetune --base <hf-id>` | ajusta con precisión (fine-tunes) un modelo pequeño preentrenado Marian/opus-mt que usted especifique; elija uno para un par de idiomas *relacionado* | una CPU, descarga de ~300 MB | habitualmente mejor que `cpu-tiny` cuando existe un par relacionado; mídalo en dev, no lo dé por sentado |
| `nllb-600m` | NLLB-200 distilled 600M con LoRA | una GPU, descarga de ~2.5 GB | el inicio más sólido; en una CPU, la comprobación de tiempo real (wall-clock) lo rechazará en cuestión de minutos |

El objetivo de `cpu-tiny` no es su puntuación. Hace realidad el ciclo **completo** —el
aislamiento (fence), las auditorías, la prueba pre-registrada, un modelo que la CLI puede invocar—, de modo que
más adelante un mejor modelo pueda incorporarse al mismo proyecto y medirse exactamente de la misma manera.

`preflight` enumera cada punto de control (gate) por el que pasará la ejecución, ✓ o ✗, con la solución para cada ✗
—incluido si el extra de entrenamiento está instalado
(`✗ backend-installed: … fix: python3 -m pip install 'nmt-forge[hf]'`)—.

```bash
nmt-forge preflight run --config config.json
nmt-forge run config.json
```

🛠️ **Lo que hace la herramienta — cuatro barreras de seguridad a la vez.**

- **Auditoría de filtraciones antes del entrenamiento.** *Cada* carril —de referencia (gold), sintético y cualquier
  texto retrotraducido— se examina contra *cada* conjunto de prueba y conjunto sellado
  registrado. Las filtraciones de respuestas (consignas o respuestas idénticas, respuestas casi duplicadas) y
  las coincidencias de archivos completos son fatales; los hermanos de plantilla se conservan y se informan
  (`--drop-test-twins` los elimina en el caso de un conjunto de prueba fijo).
  Nada se entrena hasta que la mezcla esté limpia.
- **Aislamiento de dev (dev-fence).** El entrenamiento **se niega a iniciar sin un conjunto de desarrollo registrado** y
  solo seleccionará puntos de control (checkpoints) en ese conjunto dev, nunca en el conjunto de prueba.
  (Incluso verifica el contenido de las filas de dev frente a los conjuntos de prueba para detectar el truco de
  `cp test.jsonl dev.jsonl`). La selección de puntos de control puede usar la **pérdida (loss)** en dev o
  una **métrica de generación** en dev: decodificar el conjunto dev y puntuar la salida real,
  la señal más honesta (la configuración inicial utiliza chrF++ en la salida decodificada de dev).
- **Sensatez del cronograma (schedule-sanity).** Si su mezcla contiene muchos datos sintéticos, la herramienta *deriva* un
  límite mínimo de parada a partir del tamaño de su mezcla y mantiene el entrenamiento a través de la
  **meseta**: la fase en la que el modelo ha terminado el aprendizaje sintético fácil y
  aún no se ha transferido a una calidad real. Esto evita la «muerte a media época»,
  donde una parada temprana ingenua desiste a un vigésimo de lo previsto. La frecuencia
  con la que se evalúa el conjunto dev también se deriva del tamaño de la ejecución,
  por lo que una ejecución pequeña aun así se evalúa. Cada intervención imprime la trayectoria
  de la pérdida en dev y el motivo, en un lenguaje sencillo.
- **Matemática de exposición + sintético etiquetado.** Los datos gold reciben mayor peso (se repiten) para
  que la poca cantidad de datos reales no quede diluida; el manifiesto registra la **exposición
  efectiva por oración única** para que una prueba A/B se mantenga justa. Las fuentes sintéticas llevan una
  etiqueta; los datos gold permanecen sin etiquetar para que sirvan de ancla al estilo de salida.

El entrenamiento es el único paso que toma algo de tiempo. Su agente debe ejecutarlo en
segundo plano enviando la salida a un archivo de registro y prestar atención a las líneas importantes
(`refused`, `Error`, `wall-clock`, `RUN EXIT`) en lugar de sondear continuamente. Se abrirá un panel en vivo
para **usted** con las curvas de pérdida y un botón de parada (en
`http://127.0.0.1:8377` cuando ese puerto esté libre). Durante los primeros minutos, forge mide la velocidad
de entrenamiento e imprime una proyección de tiempo real transcurrido (wall-clock), primero una estimación temprana y luego
una de estado estable. `init` no establece un presupuesto de tiempo, porque un presupuesto es su decisión numérica,
no un valor que la herramienta invente. Lea la proyección, decida cuánto tiempo está dispuesto a aceptar
y añada `"time_budget_hours": <hours>` a `config.json` debajo de `model`. A partir de
entonces, forge rechazará una ejecución que no pueda completarse dentro de ese plazo, por lo que una ejecución mal dimensionada
fallará rápidamente. Hasta que establezca uno, solo se aplicará el límite máximo de seguridad de forge: detiene
una ejecución que tardaría días, y cada proyección lo mostrará como «no budget set;
… ceiling» (sin presupuesto configurado; límite de seguridad), no como un presupuesto que alguien haya elegido.

👀 **Cómo leer el resultado.** La ejecución imprime un **informe de dev con intervalos de
confianza** —no hay resultados con puntuaciones aisladas sin contexto— y luego el siguiente comando (los
números a continuación son ilustrativos):

```
dev report (95% CIs — there is no bare-score rendering):
n=100 · set=project-dev
  chrf++       21.40  [18.95, 23.90] 95% CI

NEXT: nmt-forge export .forge/runs/nav-baseline-…/run-manifest.json --out export/
```

Si ve un mensaje `schedule-sanity` explicando que *mantuvo* el entrenamiento más allá de una parada
prematura, esa es la guardia de meseta funcionando — bien. La ejecución también escribe un
**manifiesto**: hash de configuración, hashes de archivo de datos, semillas, y la programación derivada, para que
la ejecución completa sea reproducible.

---

## Paso 6 — Evalúe honestamente

Tiene un modelo. Antes de puntuarlo en el conjunto de prueba, escribe lo que
espera — *primero*.

> 🗣️ **Dígale a su agente:** *"Escribe un registro previo (preregistration) para la evaluación del conjunto de prueba —
> nuestra métrica prevista, dirección y margen, con una razón de una sola línea—, y luego
> exporta la ejecución, lo que evaluará el conjunto de prueba una sola vez."*

```bash
# 1. Predict BEFORE you peek — the one format is a JSON array; edit the template
nmt-forge prereg template --out predictions.json
nmt-forge prereg new run1 --eval-set project-test --predictions predictions.json

# 2. Score the test set once against that prediction, and package the model
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg run1 --out export/
```

`--prereg` especifica el registro previo que juzga a este modelo. Si hay uno solo sobre el
conjunto de prueba, export lo encuentra por sí mismo; con un segundo modelo y su propio
registro previo sobre el mismo conjunto de prueba, export se negará a adivinar, por lo que deberá especificar cada uno.

(El registro previo puede realizarse en cualquier momento antes de la primera puntuación de prueba; `nmt-forge
status` lo solicita antes de entrenar).

🛠️ **Lo que hace la herramienta — las guardias anti-narración.**

- **Registro previo (preregistration).** Evaluar un conjunto de **prueba** registrado requiere un
  registro previo redactado *antes* de la primera observación. Un archivo de predicciones es un arreglo
  JSON: cada predicción nombra una métrica y una justificación, además de una dirección
  contra una línea base (comprobada automáticamente por `nmt-forge prereg check`) o una
  expectativa en texto libre que una persona verifica. La plantilla sin editar, el formato Markdown y la
  prosa no estructurada se rechazan indicando el formato y la solución. Sin un registro previo,
  la puntuación simplemente **se niega**:

  ```
  [preregister] no preregistration for eval set 'project-test' at its current content hash
    why: results looked at without written-down expectations become
         post-hoc stories; ...
    fix: write one FIRST: ... — then score
  ```

  Esta es la protección contra disfrazar postdicciones («por supuesto que mejoró en
  relatos orales») como si fueran predicciones. Dejar registradas por escrito las suposiciones que *fallan* es lo que
  hace confiables a las que aciertan.
- **Intervalos de confianza, siempre.** Cada puntuación se presenta con su IC del 95 % por bootstrap;
  no existe una salida sin IC. Un incremento de `+0.5` cuyos intervalos se superponen no es
  una victoria.
- **El libro de registro de evaluación (eval-ledger).** Cada lectura de cada conjunto de evaluación queda registrada (solo adición,
  con detección de manipulaciones). Consulte a `nmt-forge ledger show --set project-test` qué tan «agotado»
  está un conjunto. Los conjuntos **sellados** (sealed) son de un solo uso: se puntúan una vez y luego se cierran (un segundo
  `export` se rechaza; `--no-eval` empaqueta sin volver a puntuar).

`export` decodifica el conjunto de prueba con el punto de control seleccionado por dev, lo puntúa y
añade una sección de **Diagnóstico y recomendaciones** en lenguaje sencillo. También
escribe el resultado como un **informe de mt-eval** (`export/evaluation/`), de modo que `mt-eval
compare` compare su modelo junto a cualquier otro método medido con el entorno de pruebas en
el mismo conjunto de prueba, y empaqueta el modelo en sí (Paso 8) en `export/model/`,
el cual no contiene ninguna oración de prueba. `export/evaluation/` contiene sus oraciones
de prueba: nunca lo copie junto con el modelo y manténgalo con el conjunto de prueba. `nmt-forge evaluate <run-manifest>` es la parte que solo puntúa,
para cuando no desee generar un paquete.

👀 **Cómo leer el resultado.** Lea el número **con su intervalo y por
registro**, observe la puntuación «(strict)» si sus datos de entrenamiento comparten plantillas
de oraciones con el conjunto de prueba, y verifique **en qué métrica confiar** antes de
cantar victoria. Para puntuar el archivo de salida de otro sistema sobre el mismo conjunto registrado,
con más métricas:

```bash
nmt-forge score --eval-set project-test --hyps decoded.txt \
    --metric chrf++ --metric comet --target-lang nav
```

`nmt-forge discover` muestra la **confiabilidad medida** de cada métrica para su
familia de lenguas (de las meta-evaluaciones de WMT). Para algunas familias una métrica como
BLEU apenas rastrea el juicio humano mientras COMET lo hace; para muchas familias de recursos limitados
la respuesta honesta es *no medida* — en cuyo caso el juicio de hablantes nativos, no
ningún número automático, es la señal real. Vea
[Confiabilidad de métrica](/docs/network/specifications/metric-reliability).

:::tip[El árbitro propio de su lengua]
Si su lengua tiene un estándar de evaluación LYSS (un linter que sabe, digamos, que dos
ortografías difieren solo por una convención de vocal larga documentada), conéctelo con
`--plugin` y puntúa junto a chrF++ — e incluso puede *seleccionar* puntos de control,
así que el modelo que gana es el que el árbitro propio de la lengua prefiere. Cada
número de complemento también obtiene un intervalo de confianza.
:::

---

## Paso 7 — Itere

Ahora mejora — y cada mejora se mide de la misma manera honesta.

> 🗣️ **Dígale a su agente:** *"Cambia una sola cosa —añade un tipo de plantilla / más
> datos retrotraducidos / un ajuste preestablecido de modelo diferente—, vuelve a
> entrenar y compáralo en A/B contra la ejecución anterior en el conjunto dev,
> con significancia estadística."*

Cada ejecución ya imprime su puntuación en dev con un intervalo de confianza. Para una
prueba pareada, decodifique el conjunto dev con cada ejecución —`nmt-forge evaluate <run-manifest>
--config dev-eval.json --out-hyps run1-dev.jsonl`, where `dev-eval.json` es una
copia de su configuración cuyo `eval.battery` es `project-dev`— y luego:

```bash
nmt-forge compare --eval-set project-dev \
    --hyps-a run1-dev.jsonl --hyps-b run2-dev.jsonl --metric chrf++
```

🛠️ **Lo que hace la herramienta.** `compare` ejecuta una **prueba de significancia emparejada**, no
solo una resta, así que "B vence a A" es una afirmación que la estadística respalda — no
ruido. Itere en el conjunto de **desarrollo** (para eso sirve); mantenga el conjunto de **prueba**
para verificaciones infrecuentes y preregistradas; mantenga cualquier conjunto **sellado** para el final.

👀 **Cómo leer el resultado.** Una mejora real despeja su intervalo de confianza
*y* la prueba de significancia. Si no lo hace, aprendió algo de todas formas — que
esa palanca es más débil de lo que esperaba, lo cual vale la pena saber. Las guardias de meseta/cobertura/
fuga significan que los números que está comparando son confiables, así que puede
realmente creer en su propio bucle de iteración.

Palancas comunes siguientes, aproximadamente en orden de retorno para una lengua hambrienta de datos:

1. **Más pares reales**: en unos pocos miles de oraciones, cada par real
   adicional cuenta más que cualquier parámetro de configuración.
2. **Mayor cobertura** en la síntesis: añada los fenómenos gramaticales faltantes que el
   informe de cobertura señaló.
3. **Retrotraducción**: convierta texto monolingüe en el idioma de destino en más pares de entrenamiento.
4. **Un punto de partida más sólido**: `cpu-finetune` con un modelo base para un
   par relacionado, o `nllb-600m` en una GPU —medido frente a `cpu-tiny` en el
   mismo conjunto dev—.
5. **Currículo de aprendizaje (curriculum)**: preentrene con datos sintéticos y luego ajuste con precisión (finetune) con los pares reales.

---

## Paso 8 — Póngalo a trabajar y llévelo a la Red

Un modelo entrenado con honestidad es algo que puede usar hoy mismo, y exactamente lo que la
[Red de Champollion](/docs/network/) está diseñada para recibir.

**Úselo usted mismo.** `export` ya empaquetó el modelo: un directorio de modelo
independiente, `forge-model.json` (qué es y cómo se midió), un
manifiesto de plugin de champollion (`method.json`) y `DEPLOY.md` con los comandos
exactos.

> 🗣️ **Dígale a su agente:** *"Sirve el modelo exportado y úsalo para traducir
> las cadenas de texto de nuestra aplicación con la CLI de champollion."*

```bash
nmt-forge serve export/model                               # http://127.0.0.1:8378
LOCAL_API_BASE=http://127.0.0.1:8378/v1 champollion sync --method local
```

`serve` implementa el contrato del **método api** de champollion (`POST /translate`) y
una interfaz `/v1/chat/completions` **compatible con OpenAI**; la segunda es la que
utiliza `--method local`; `DEPLOY.md` contiene el fragmento `champollion.config.json` para
la primera. Escucha únicamente en `127.0.0.1`; exponerlo en una red requiere un
token (`--token` o `NMT_FORGE_SERVE_TOKEN`). Un modelo de NMT traduce texto e
ignora instrucciones, por lo que los prompts de tono, archivos de orientación (coaching files) y glosarios que la CLI
envía a los métodos de LLM no surten efecto en él —y su salida necesita la revisión de un
hablante fluido antes de llegar a los lectores—.

**Llévelo a la Red.**

> 🗣️ **Indíquele a su agente:** *"Empaquete este modelo como un método y envíelo a la
> tabla de clasificación para nuestro par de lenguas."*

- **[Envíe un método](/docs/network/getting-started/submit-a-method)** convierte
  su modelo en una entrada de Red, puntuada en corpus de referencia públicos y
  atribuida a usted.
- Porque su evaluación fue limpia — disjunta por grupo, cercada de desarrollo, auditada por fugas,
  con IC, preregistrada — su envío sobrevive al escrutinio que hunde la mayoría de
  afirmaciones de MT de recursos limitados. La arquitectura anti-juego (conjuntos de prueba secretos de propiedad comunitaria,
  verificaciones de reproducibilidad, validación de hablantes nativos) no es un
  obstáculo para un modelo construido de esta manera; es un sello de credibilidad.
- Si un **premio** está abierto para su lengua, un método de pie, mejor que la línea base
  construido honestamente es exactamente lo que un fondo patrocinado recompensa. Y cuando un
  método funciona para una lengua indígena, **la propiedad puede transferirse a la
  comunidad** — usted lo construye aquí y ellos lo despliegan, en sus términos. Vea la
  [Especificación de premio](/docs/network/specifications/prizes) y
  [Transferencia de propiedad](/docs/network/sovereignty/ownership-transfer).

---

## El arco completo, en un aliento

1. **Descubra** lo que tiene el idioma (`discover`, `init`): la ausencia significa desconocido, no cero.
2. **Apuntee** hacia un analizador + diccionario si existen (peldaños 3 y 4), respetando sus licencias.
3. **Sintetice** datos de entrenamiento verificados, citados y con cobertura comprobada (`synth`), o **retrotraduzca** texto monolingüe.
4. **Divida** los datos reales por grupos disjuntos, examínelos frente a su conjunto de prueba y registre los conjuntos de evaluación (`registry add`, `leak-audit`, `split`).
5. **Entrene** una configuración —en una CPU por defecto— con aislamiento de dev, auditoría de filtraciones y sensibilidad a la meseta (`preflight`, `run`).
6. **Evalúe** con predicciones redactadas de antemano, siempre con intervalos de confianza y con la métrica adecuada (`prereg`, `export`).
7. **Itere** con pruebas A/B con significancia estadística (`compare`).
8. **Utilice** el modelo a través de la CLI (`serve`) y **envíelo** a la Red, donde el trabajo honesto es el objetivo principal.

Nunca tuvo que memorizar las diez formas en que los resultados de MT de recursos limitados salen mal. La
herramienta hizo que el camino honesto fuera el predeterminado y rechazó los atajos con una
explicación. Esa es la idea completa: **las barreras de seguridad atrapan los errores de aficionado
para que pueda enfocarse en la lengua.**

## Continúe

- [**MT Training in Plain Language**](/docs/network/context/mt-training-concepts) — cada término aquí, definido con un ejemplo.
- [**Train a Model Honestly**](/docs/network/getting-started/training-honestly) — las diez barreras de seguridad en una página, cada una con su historia medida.
- [**Fine-Tuned Model**](/docs/network/tutorials/fine-tuned-model) y [**Back-Translation**](/docs/network/tutorials/back-translation) — libros de recetas más profundos en técnicas específicas.
- [**Corpus Creation**](/docs/network/tutorials/corpus-creation) — construir los datos reales en los que todo lo demás descansa.
