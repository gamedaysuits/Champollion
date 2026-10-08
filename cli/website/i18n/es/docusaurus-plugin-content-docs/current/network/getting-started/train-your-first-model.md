---
sidebar_position: 3
title: "Entrene su primer modelo (con su agente)"
description: "Una guía paso a paso para entrenar un modelo de traducción automática de bajos recursos dirigiendo a un agente de programación — instalar, proteger su conjunto de prueba, entrenar en la CPU de una laptop, evaluar una vez y servir el modelo a la CLI de champollion. Qué dice usted, qué hace forge y cómo se ve un rechazo."
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
    note: "The whole journey — this page is the forge part of its steps 2 and 4"
  - label: "Train a Model Honestly"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The why behind every guard in this walkthrough"
  - label: "Diagnosing a Training Run"
    to: /docs/network/getting-started/diagnosing-training
    kind: guide
    note: "Symptom-first: what to do when the numbers disappoint"
  - label: "forge Command Reference"
    to: /docs/network/getting-started/forge-command-reference
    kind: reference
---

# Entrene su primer modelo (con su agente)

No necesita saber cómo entrenar un modelo de traducción automática neuronal. Necesita poder **decirle a un agente de codificación qué desea** — Claude, o un modelo de clase Sonnet/Flash, o cualquier agente que pueda ejecutar comandos de shell. **nmt-forge** está construido para que el agente lo maneje *mecánicamente*: en cada paso la herramienta le dice al agente exactamente qué hacer a continuación, y se rehúsa — ruidosamente, con una solución — cuando un paso corrompería sus resultados.

Esta página cubre el ciclo completo, desde `pip install` hasta un modelo al que el CLI de champollion puede llamar. Cada paso está redactado como **qué decirle a su agente**, **qué hace forge**, **cómo se ve un rechazo** (para que ninguno de los dos entre en pánico cuando se active uno: un rechazo significa que la herramienta está funcionando) y, al final, **cómo leer el informe**. Es la parte correspondiente a forge de los pasos 2 y 4 de [Crear TA para su idioma](/docs/build-mt-for-your-language), que cubre lo que viene antes (descubrir qué existe), en medio (medir las opciones existentes) y después (publicar, combinar métodos).

**El orden importa.** Registre su conjunto de prueba, evalúe sus datos de entrenamiento comparándolos con este y escriba sus predicciones (Pasos 1–3) **antes de que se puntúe nada en el conjunto de prueba**, incluidas las líneas base que el paso 3 de la guía mide con `mt-eval run`. Un benchmark es una lectura de puntuación: forge la cuenta y rechaza una predicción escrita después de una. Luego divida y entrene (Paso 4).

:::tip La regla única para su agente
Dígale: *«Ejecuta siempre `nmt-forge status --json` primero y después de cada paso. Haz lo que diga su `next_command`».* Ese único hábito convierte a forge en una guía sobre rieles. Cada comando de forge acepta `--json`: exactamente un documento JSON en stdout, y un rechazo se devuelve como `{"error": {…, "why", "fix"}}` con código de salida 2. Si su agente se conecta mediante MCP, el mismo ciclo es la herramienta `forge_status` (`{ "project_dir": "<dir>" }`); consulte la [Guía del agente](/docs/network/getting-started/agent-guide).
:::

---

## Paso 0 — Instalar y dirigir a su agente hacia su idioma

**Usted dice:** *«Instala nmt-forge con su extra de entrenamiento. Quiero entrenar un modelo de inglés a [su idioma]. Comienza por descubrir qué sabe forge sobre él. El código ISO 639-3 es `crk`»* (use el código de su idioma).

```bash
python3 -m pip install 'nmt-forge[hf]'      # Python 3.11+; brings mt-eval-harness (the scorer)
```

El extra `[hf]` añade las bibliotecas de entrenamiento (torch, transformers, accelerate, tokenizers, sentencepiece, peft). Los wheels solo para CPU son suficientes para el modelo predeterminado. El paquete básico `python3 -m pip install nmt-forge` le proporciona las protecciones, divisiones, auditorías y puntuaciones sin necesidad de entrenar.

**forge hace:** `nmt-forge discover crk` lee la ficha del idioma: sistemas de escritura, diccionarios, analizadores morfológicos, corpus existentes y conjuntos de evaluación (con cualquier marca de `do_not_train` / cuarentena) y métricas de referencia por idioma. No necesita una copia del repositorio de Champollion: las fichas se encuentran en un directorio que usted indique (`--cards-dir`), un checkout local o `node_modules/champollion`, o el índice público de fichas (almacenado en caché, para que funcione sin conexión después). Luego, forge ubica su idioma en la **escala de recursos**: (1) texto paralelo → entrenamiento protegido; (2) + monolingüe → retrotraducción etiquetada; (3) + diccionario/gramática → datos sintéticos con fuentes citadas; (4) + analizador → síntesis verificada en ciclo completo (round-trip); (5) + métrica de referencia → la propia métrica del idioma en la puntuación y selección de checkpoints.

**Un campo en blanco significa DESCONOCIDO, nunca cero.** Una tarjeta dispersa no significa "este idioma no tiene nada" — simplemente puede no registrar el recurso aún. Siempre puede traer su propio corpus paralelo.

Luego: *«Genera la estructura del proyecto».*

```bash
nmt-forge init crk --dir school-mt && cd school-mt
```

Esto escribe un espacio de trabajo (`.forge/`), un `config.json` inicial y un informe breve en `NEXT_STEPS.md` con el orden exacto de los comandos. **Ejecute todos los comandos posteriores desde el directorio del proyecto**; las rutas de la configuración son relativas a él.

La configuración inicial utiliza el preajuste de modelo **`cpu-tiny`** a menos que elija otro:

| `--model` | Qué es | Requiere | Qué esperar |
|---|---|---|---|
| `cpu-tiny` (predeterminado) | un transformer pequeño (~6M de parámetros) entrenado desde cero con sus pares; su vocabulario se aprende solo a partir de sus filas de entrenamiento | una CPU, ninguna descarga | modesto: en 1–2 mil pares, chrF++ aproximadamente de 5–30 (el extremo superior solo para datos muy basados en plantillas). Aprende las frases y patrones de sus datos, no el idioma en general |
| `cpu-finetune --base <hf-id>` | ajusta con fine-tuning un modelo Marian/opus-mt preentrenado pequeño que usted indique (elija uno para un par de idiomas *relacionado*) | una CPU, descarga de ~300 MB | habitualmente mejor que `cpu-tiny` cuando existe un par relacionado; mídalo en su conjunto de desarrollo, no lo dé por sentado |
| `nllb-600m` | NLLB-200 destilado de 600M con LoRA | una GPU, descarga de ~2.5 GB | el punto de partida más sólido; la verificación de tiempo de reloj (wall-clock) de forge lo rechazará en una CPU en cuestión de minutos |

El preajuste se escribe con números explícitos en `config.json` → `model`, de modo que nada quede oculto y cambiar un número genere una ejecución nueva y con un hash independiente.

**¿No hay ficha para su idioma?** `nmt-forge init <code> --no-card --name "<name>"` aun así genera la estructura de un proyecto; todo lo que habría indicado una ficha se registra como desconocido y no se inventa nada.

---

## Paso 1 — Aparte su conjunto de prueba y regístrelo {#step-1--set-your-test-set-aside-then-split}

**Usted dice:** *«Aquí está mi corpus paralelo y, por separado, el conjunto de prueba verificado por profesores. Mantén el conjunto de prueba fuera del entrenamiento y regístralo antes de que se puntúe nada con él».*

Los archivos pueden ser `.tsv` (origen, un TAB, luego la traducción, un par por línea; las líneas que comienzan con `# ` son comentarios) o `.jsonl` (`{"source": …, "target": …}` por línea). Si el conjunto de prueba es privado, márquelo como solo local **antes** de que cualquier proceso lo lea, incluido su agente:
`echo '{"transmission": "local-only"}' > ~/teacher-test.tsv.champollion.json`.
Así, forge nunca imprimirá sus oraciones.

**forge hace — si usted tiene su propio conjunto de prueba** (el caso habitual para una escuela o una clínica):

```bash
nmt-forge registry add project-test ~/teacher-test.tsv --role test
```

El registro inicia el **registro de lecturas** del archivo (`<file>.reads.jsonl`): a partir de este momento, cada puntuación de este archivo —por parte de forge o por `mt-eval run` / `mt-eval compare`— queda contabilizada. Por eso el registro va primero: una ejecución de benchmark realizada antes de este se lista al registrarlo, pero no se contabiliza.

**Si no tiene un conjunto de prueba independiente**, extraiga uno del corpus en su lugar —
`nmt-forge split pairs.tsv --test 150 --dev 100 --seed 42 --out data/split
--register project` registers `project-test` and `project-dev` en un solo paso
(el Paso 4 explica la división) — y continúe al Paso 3.

`nmt-forge status` ahora indica el siguiente paso: las predicciones (Paso 3), antes de cualquier benchmark; evalúe primero su corpus (Paso 2).

---

## Paso 2 — Detecte fugas

**Usted dice:** *«Antes de entrenar, compara el corpus contra el conjunto de prueba y dime qué descartarías y por qué».*

```bash
nmt-forge leak-audit ~/pairs.tsv --clean-to pairs.clean.jsonl
```

**forge hace:** audita cada fila contra cada conjunto dev/test/sealed registrado. El mismo corpus y los mismos conjuntos registrados siempre dan el mismo resultado. Explica lo que **descartaría**:

- **Prompt idéntico**: la oración de origen de la fila es igual a la de una fila de prueba (tras ignorar mayúsculas/minúsculas, puntuación y espacios). Se descarta **incluso si la traducción de la fila es diferente**: el modelo aun así habría practicado con el prompt exacto de prueba.
- **Respuesta idéntica**: el texto destino de la fila es igual a una referencia de prueba.
- **Respuesta casi duplicada**: el texto destino de la fila comparte al menos el 60 % de sus palabras con una respuesta de prueba (con acentos unificados, de modo que las variantes ortográficas cuentan) **y** contiene la respuesta completa, es un fragmento de ella o es idéntica en al menos un 90 %. Al modelo se le estaría mostrando la mayor parte de la respuesta.

…y lo que **conserva a propósito**, reportado pero nunca eliminado:

- **Hermanos de plantilla (template siblings)**: la fila comparte una estructura de oración con una respuesta de prueba pero intercambia una palabra en cada sentido (*«I see the dog»* / *«I see the cat»*). El modelo aún debe producir la palabra que nunca vio en esa estructura. Los corpus escolares y de libros de texto basados en plantillas están llenos de estos casos. forge lista las filas de prueba que tienen un hermano en el entrenamiento; como la configuración inicial establece `eval.near_dupe_corpus`, el informe final muestra una puntuación **«(estricta)»** en las filas que no tienen ninguno junto a la puntuación completa.
- **Prompt similar, respuesta diferente**: el origen es un casi duplicado (no una copia idéntica) de un origen de prueba, pero la traducción es diferente: un contraste mínimo legítimo, no una filtración.

Aquí está el informe para un corpus de prueba de 12 filas evaluado contra un conjunto de prueba de 3 filas (recortado; las oraciones de ejemplo son en inglés con un destino similar al francés):

```
leak-audit: pairs.tsv — 12 rows screened against project-test [test, 3 rows]

DROPPED by --clean-to: 4 row(s) — the model would see an eval answer (or prompt)
  • identical PROMPT: the row's source equals an eval row's source ...
      project-test (test): 2
      e.g. line 2 "The library opens at nine." → project-test row 2
      e.g. line 3 "The library opens at nine!" → project-test row 2
  • identical ANSWER: the row's target equals an eval row's reference ...
      project-test (test): 1
  • near-duplicate ANSWER: the row's target overlaps an eval answer and only adds/removes words ...
      project-test (test): 1
      e.g. line 6 "ou est la grande grange rouge maintenant?" → project-test row 3 (contains the whole answer; overlap 0.86)

KEPT on purpose (reported, never removed): 1 row(s)
  • template sibling: shares a sentence frame with an eval answer but swaps a word each way ...
      e.g. line 1 "je vois le chat dans la maison." → project-test row 1 (swaps word(s); overlap 0.75)

Cleaned: 8 row(s) kept → pairs.clean.jsonl (audit manifest: pairs.clean.audit.json)
```

La línea 3 tiene una traducción *diferente* a la fila de prueba y aun así se descarta: su prompt es el prompt de prueba.

Los ejemplos citan filas de **su corpus** por número de línea; el texto del archivo de prueba en sí nunca se imprime, y una fila que coincidió con un conjunto **sellado (sealed)** se muestra únicamente por número de línea. (Cuando una fila del corpus es idéntica a una fila de prueba, o la contiene, citar la fila del corpus también muestra esa oración de prueba; pase `--no-examples` si la salida se compartirá).

`--clean-to pairs.clean.jsonl` escribe las filas supervivientes, junto con un registro de auditoría sin contenido junto a ellas (`pairs.clean.audit.json`). Audite el corpus **antes** de dividir (el Paso 4 divide el archivo limpio). No vuelva a auditar todo el corpus después de extraer un conjunto de desarrollo de él; las filas de desarrollo coincidirían consigo mismas y se descartarían. Audite cualquier dato *adicional* (recolección web, texto monolingüe) de la misma manera antes de añadirlo al entrenamiento.

**La auditoría no agota su conjunto de prueba.** leak-audit lee el conjunto de prueba para comparar filas, y forge registra eso como una lectura de *auditoría*, nunca de puntuación: no interfiere con las predicciones que escriba en el Paso 3.

**Lea primero el veredicto** (la línea `VERDICT:`; con `--json`, la clave `verdict`). Si indica que la mayoría de las filas de prueba tienen un casi-gemelo en su corpus, un modelo entrenado con todos los datos medirá la memorización de frases de entrenamiento en lugar de la traducción. Con un conjunto de prueba fijo (verificado por profesores o personal médico), por lo general entrenará **dos modelos**: uno con todos los datos —habitualmente el más útil para implementar— y otro libre de gemelos cuya puntuación indica cómo maneja el enfoque oraciones nuevas. El corpus libre de gemelos se obtiene con `--drop-test-twins`:

```bash
nmt-forge leak-audit ~/pairs.tsv --clean-to pairs.notwins.jsonl --drop-test-twins
```

Elimina las filas de entrenamiento que son casi gemelas de las filas de prueba, informa el subconjunto estricto antes y después, rechaza la operación si eso no dejara nada para entrenar, y escribe la configuración del modelo libre de gemelos junto a la suya, **`config-notwins.json`**: la misma configuración con su propio `run_name`, y con `data.gold` / `eval.near_dupe_corpus` apuntando al archivo libre de gemelos (`--companion-config <file>` asigna otro nombre de archivo; nunca se sobrescribe un archivo existente). Imprime el comando para entrenarlo. Hasta que se registre el conjunto de desarrollo (Paso 4), indicará que primero debe extraerlo y ejecutar esta auditoría de nuevo, para que las filas de desarrollo también salgan del archivo libre de gemelos. `nmt-forge status` mantiene el veredicto —y luego el modelo libre de gemelos no entrenado— en sus advertencias hasta que usted tome medidas al respecto.

**Cómo se ve un rechazo:** no tiene que acordarse de ejecutarlo; `nmt-forge run` audita cada archivo de entrenamiento contra sus conjuntos de prueba y sellados y rechaza cualquier filtración: *"[leak-audit] corpus leaks into 1 test/sealed set(s) — project-test: 0 identical prompt(s), 3 identical answer(s), 1 near-duplicate answer(s) — plus 12 template sibling(s) … which are KEPT"*. Solución: `nmt-forge leak-audit <file> --clean-to <file.clean.jsonl>` y entrene con el archivo limpio.

---

## Paso 3 — Prediga antes de mirar

**Usted dice:** *«Escribe lo que esperamos que cada modelo obtenga como puntuación en el conjunto de prueba, antes de que midamos nada en él».*

**forge hace:** un prerregistro por cada modelo que planee entrenar, nombrado a partir del modelo:

```bash
nmt-forge prereg template --out predictions.json    # then EDIT it
nmt-forge prereg new all-data --eval-set project-test --predictions predictions.json
nmt-forge prereg new notwins --eval-set project-test --predictions predictions-notwins.json   # only with a twin-free model
```

Un archivo de predicciones es un arreglo JSON de predicciones. Cada una indica una métrica y una justificación de una sola oración, además de una dirección frente a una línea base (`"direction": "increase", "baseline_score": 0, "margin": 5`) —verificada automáticamente más adelante— o una expectativa en texto libre (`"expect": "between 10 and 30"`) que una persona verifica. Usted (o su agente, en voz alta) confirma esto **antes** de que exista cualquier puntuación de prueba —**y antes de cualquier benchmark de un modelo existente en el conjunto de prueba**: las líneas base del paso 3 de [Crear TA para su idioma](/docs/build-mt-for-your-language#3-measure-the-options) van *después* de este paso. Al exportar, `--prereg <id>` indica qué predicción evalúa a qué modelo. O bien fije una predicción a la configuración de su modelo ahora: `--config-hash <hash>` en `prereg new`, con el hash completo que imprime `nmt-forge preflight run --config config-notwins.json`. Cualquier edición posterior de esa configuración (un presupuesto de tiempo, por ejemplo) cambia el hash y elimina la fijación, por lo que indicar el prerregistro al exportar es el camino más simple.

**Cómo se ve un rechazo:** cuatro con los que podría encontrarse aquí.

- La plantilla sin editar es rechazada: sus marcadores de posición `REPLACE` no predicen nada. Escriba su propia expectativa y justificación.
- Un archivo en Markdown o en prosa es rechazado indicando el formato y el comando de plantilla. Solo hay un formato: el arreglo JSON.
- Un prerregistro escrito después de que el conjunto de prueba ya fue puntuado es rechazado: *"[preregister] eval set 'project-test' was already read for scoring … before this preregistration"*. Un benchmark cuenta. `--allow-after-reads` existe únicamente para predicciones que realmente se escribieron antes de esas lecturas (en papel, por ejemplo); queda registrado y cada informe, exportación, `DEPLOY.md` y `nmt-forge status` indicará entonces que las predicciones se hicieron después de N lecturas de puntuación.
- Puntuar un conjunto de prueba sin prerregistro es rechazado: *"[preregister] no preregistration for eval set 'project-test' … why: results looked at without written-down expectations become post-hoc stories"*. Esto es lo que separa un resultado de una narrativa armada a posteriori.

:::info Por qué esto se siente como trabajo extra
Es el trabajo. Cada guardia aquí es un error que ha engañado a investigadores reales. La herramienta hace que el camino honesto sea el camino fácil y el camino deshonesto sea el que lo detiene.
:::

Ahora mida las opciones existentes en el conjunto de prueba —paso 3 de [Crear TA para su idioma](/docs/build-mt-for-your-language#3-measure-the-options)— y regrese a entrenar.

---

## Paso 4 — Dividir, verificar los controles y luego entrenar {#step-4--check-the-gates-then-train}

**Usted dice:** *«Divide el corpus limpio en train y dev. ¿Pasará la ejecución de entrenamiento todas sus comprobaciones? Si es así, entrena».*

**forge hace — la división:**

```bash
nmt-forge split pairs.clean.jsonl --test 0 --dev 100 --seed 42 \
    --out data/split --register project
```

`--test 0` extrae únicamente train y dev, porque su conjunto de prueba ya existe como su propio archivo registrado (con un conjunto de prueba extraído, el Paso 1 ya realizó la división). `--register project` registra `project-dev` en el espacio de trabajo: el nombre al que ya apunta la configuración inicial.

La división es **disjunta por grupos (group-disjoint)**: cualesquiera dos pares de oraciones que compartan un origen *o* un destino quedan en el **mismo** lado. Esta es la forma más común en que se inflan las puntuaciones con bajos recursos: un libro de texto asigna muchos ejercicios en inglés a una sola palabra de destino, una división aleatoria ingenua coloca una copia en train y su gemela en test, y el modelo «traduce» respuestas que memorizó. La salida indica lo que sucedió:

```
split pairs.clean.jsonl: 1580 rows in 1544 share-groups (largest 4)
  train 1480 · dev 100 · test 0  → data/split/
  verified: 0 shared canonical source/target keys across sides
  test side: none (--test 0) — your test set is a separate file; ...
  registered project-dev (role=dev)
```

Con un conjunto de prueba ya registrado, `split` también audita los nuevos archivos de train y dev contra este en el momento y advierte si alguna fila sería rechazada más adelante.

**Corpus basados en plantillas (guías de conversación, ejercicios).** `--near-dupe 0.6` también mantiene los *casi* duplicados —oraciones construidas sobre la misma estructura— en un solo lado, de modo que una fila de dev o test nunca tenga un gemelo de plantilla en el entrenamiento. En un corpus muy basado en plantillas, las estructuras pueden encadenarse en un único grupo gigante (*«Does your arm hurt?»* ~ *«Does your leg hurt?»* ~ *«Your leg looks swollen»*…), y un grupo solo puede ir completo a un lado. Cuando eso le daría a un lado muchas más filas de las solicitadas —más de **1.5×** la solicitud— o dejaría al entrenamiento con menos de la mitad de lo que la solicitud le deja, `split` lo rechaza y no escribe nada: *"[split-guard] split refused — nothing was written: the carve does not match the request (dev: asked for 100 rows, the carve put 663 there (6.63×); training keeps 210 of the 773 rows the request leaves it)"*, seguido por el motivo (el encadenamiento, con el tamaño del grupo más grande) y las alternativas viables: un umbral más alto, un límite en el tamaño del grupo (`--near-dupe 0.6 --max-group 51`; los enlaces de casi duplicados que superen el límite permanecen sin cortar y la división los cuenta), descartar los gemelos de un conjunto de prueba fijo con `leak-audit --drop-test-twins`, o escribir oraciones de dev/test de forma independiente del material de entrenamiento. forge verifica el encadenamiento por sí mismo: en un corpus de este tipo, su recomendación sobre casi gemelos (aquí, en preflight y en el archivo DEPLOY.md de la exportación) no recomienda `--near-dupe 0.6`.

**Cómo se ve un rechazo:** si le proporciona a forge una división hecha por usted mismo, `nmt-forge verify-split train.jsonl dev.jsonl test.jsonl` la rechaza cuando los lados se superponen —*\"[split-guard] 3 shared canonical source keys and 1 shared target keys between 'train' and 'test'\"*— con la solución: vuelva a dividir con `split`; no elimine las filas conflictivas a mano.

**¿Dos modelos?** Ahora que el conjunto dev está registrado, ejecute de nuevo la auditoría libre de gemelos del Paso 2 (las filas de dev también saldrán del archivo libre de gemelos); su `config-notwins.json` entrena el segundo modelo a continuación.

**forge hace — los controles:** `nmt-forge preflight run --config config.json` lista cada control por el que pasará la ejecución, ✓ o ✗, cada ✗ con su solución; incluyendo si el extra de entrenamiento está instalado:

```
preflight: nmt-forge run

  ✓ config: config.json parses (config hash 9a85524275ff)
  ✓ dev-fence: config data.dev = 'project-dev': registered, role=dev
  ✓ training-data: 1 gold + 0 synthetic file(s) present
  ✗ backend-installed: backend 'hf-scratch' needs accelerate — not installed (the run would refuse)
      fix: python3 -m pip install 'nmt-forge[hf]'
  ✓ leak-audit: every gold and synthetic lane in the config will be audited ...
  ✓ schedule-sanity: regime, early-stop floor and eval cadence are derived from the config's data mix ...
  ✓ generation-headroom: decode cap is checked against dev reference lengths BEFORE training compute is spent

1 gate(s) would refuse — fix them first
```

Cuando todo esté en verde: `nmt-forge run config.json` (y, para el modelo libre de gemelos, `nmt-forge preflight run --config config-notwins.json && nmt-forge run config-notwins.json`).

Con el preajuste predeterminado `cpu-tiny`, esto se ejecuta en la CPU de una laptop común: sin GPU y sin descargas. Aun así, el entrenamiento es el único paso que **no** es una llamada instantánea a una herramienta, por lo que su agente debería ejecutarlo en segundo plano redirigiendo la salida a un archivo de registro y monitorear únicamente las líneas importantes (`refused`, `Error`, `wall-clock`, `RUN EXIT`) en lugar de consultar constantemente. Un panel en vivo con las curvas de pérdida y un botón para detener se abrirá para **usted** (en `http://127.0.0.1:8377` cuando ese puerto esté libre); es para usted, no para el agente. Al inicio de la ejecución, forge mide su velocidad y rechaza —en minutos, no en días— cualquier ejecución que no pueda terminar dentro del `model.time_budget_hours` de la configuración.

Las líneas de `[schedule-sanity]` muestran el **límite mínimo (floor)** de parada temprana que forge dedujo a partir de su combinación de datos, para que una ejecución con muchos datos sintéticos no se detenga a mitad de una época cuando la pérdida de dev real fluctúe (un modo de fallo real; consulte [Diagnosticar una ejecución de entrenamiento](/docs/network/getting-started/diagnosing-training)).

Al terminar, forge habrá **seleccionado un checkpoint en el conjunto dev aislado** (nunca en el conjunto de prueba), escrito un `run-manifest.json` e impreso las puntuaciones de dev —siempre con sus intervalos de confianza del 95 %—, seguido por el siguiente comando.

---

## Paso 5 — Puntuarlo una sola vez y empaquetarlo

**Usted dice:** *«Puntúa el modelo en el conjunto de prueba y empaquétalo para que podamos usarlo».*

**forge hace:**

```bash
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg all-data --out export/
```

Un solo comando:

- decodifica su conjunto de prueba con el checkpoint seleccionado por la ejecución y lo puntúa —rechazado sin el prerregistro, registrado en el libro de contabilidad (ledger) del espacio de trabajo, con intervalos de confianza del 95 % en cada cifra y una sección de **Diagnóstico y recomendaciones** en lenguaje sencillo;
- escribe el resultado como un **informe de mt-eval** en `export/evaluation/`, de modo que `mt-eval compare` coloque este modelo junto a cualquier cosa que haya medido con el entorno de pruebas (por ejemplo, los modelos alojados en el paso 3 de [Crear TA para su idioma](/docs/build-mt-for-your-language#3-measure-the-options));
- empaqueta un **modelo autocontenido** en `export/model/` (pesos y tokenizador, sin estado de entrenamiento), `forge-model.json` (qué es y cómo se midió), un manifiesto de plugin de champollion y `DEPLOY.md` con los comandos exactos. `export/model/` no contiene oraciones de prueba; es la única carpeta que se implementa.

**La puntuación** es el dato principal del entorno de pruebas: chrF++ a nivel de corpus con su intervalo de confianza del 95 %, escrito de la misma manera en todos los lugares donde forge lo muestra —por ejemplo, `chrF++ 31.2 [28.4, 34.0]`— con su firma de sacreBLEU en los registros completos (`forge-model.json`, el resumen de exportación, `DEPLOY.md`). BLEU, spBLEU y TER se muestran a su lado, nunca combinados con él; exact match y las demás métricas de la batería son de diagnóstico. Ninguna interfaz de forge muestra una puntuación compuesta ni una etiqueta de calidad: lo que vale el resultado es algo que los hablantes del idioma deben juzgar.

**Lo que matiza la puntuación viaja con ella.** El informe de mt-eval registra todo lo que limita el significado de la puntuación; por ejemplo, una *salida casi constante* (el modelo generó una de pocas oraciones para muchas entradas distintas, por lo que sus salidas no corresponden a sus entradas), salidas mucho más largas o más cortas que las referencias o copias del origen. `export` transmite cada una de estas advertencias en las propias palabras del entorno de pruebas: en su resumen (`score_caveats`), en `forge-model.json` y en `DEPLOY.md` justo debajo de la puntuación. `status`, `report`, `compare` y `lint` indican lo mismo. Una puntuación que incluya una salvedad nunca se ofrece como «la cifra para citar» sin ella.

Si algo falla, no se deja atrás ninguna exportación a medio escribir. Dos precauciones: `export/evaluation/` contiene sus oraciones de prueba; nunca lo copie junto con el modelo, manténgalo con el conjunto de prueba. (Cuando el conjunto de prueba está marcado como privado, cada archivo allí lleva la misma marca). Y un conjunto de prueba **sellado (sealed)** es de un solo uso: exportar lo agota, y una segunda exportación lo rechazará a menos que pase `--no-eval` (empaquetar el modelo sin volver a puntuar).

`nmt-forge evaluate <run-manifest>` es la mitad de solo puntuación de `export`, por si desea los números sin empaquetar (`--harness-out DIR` escribe el informe de mt-eval).

**Dos modelos en un solo conjunto de prueba** (por ejemplo, uno entrenado con todos los datos y otro con `--drop-test-twins`): una vez que el espacio de trabajo contiene una segunda ejecución, la línea `NEXT` de la ejecución y `nmt-forge status` nombran una carpeta por ejecución (`--out export-<run>/`). El orden no importa: cualquiera que sea el modelo que se exporte en segundo lugar, el archivo `DEPLOY.md` del modelo con todos los datos terminará citando la puntuación del modelo libre de gemelos. Con dos prerregistros en un solo conjunto de prueba, `nmt-forge status` y `nmt-forge report` indican cuál se aplica a qué ejecución (o que `--prereg <id>` debe decidir: export the twin-free model with `--prereg notwins`). `nmt-forge compare` compara ambos (A/B) en el conjunto de prueba e indica, por modelo, cuántas filas de prueba tienen un casi-gemelo en sus datos de entrenamiento: una ventaja por memorización se reporta como tal. Toma las hipótesis de cada modelo —`<export>/evaluation/battery-hyps.jsonl`, denominado `hypotheses` en el resumen de exportación— y transmite las salvedades de puntuación que mt-eval escribió para esa exportación. La puntuación libre de gemelos es la que se debe citar para oraciones nuevas únicamente junto con cualquier salvedad asociada: si la salida del modelo libre de gemelos es casi constante, su puntuación no es evidencia de que traduzca oraciones nuevas, y `DEPLOY.md` lo indica junto al número).

**Las lecturas realizadas por el entorno de pruebas cuentan.** Cuando forge registra un conjunto de prueba, inicia un pequeño registro de lecturas junto al archivo (`<file>.reads.jsonl`), y `mt-eval run` / `mt-eval compare` añaden una línea sin contenido (id de ejecución, propósito, el sha256 del archivo, una marca temporal) cada vez que puntúan ese archivo. forge lo lee: un prerregistro escrito después de dicha lectura se rechaza como postdicción (a menos que se use `--allow-after-reads`, lo cual revelará cada informe) —la razón por la que el Paso 3 va antes de las líneas base—, un conjunto sellado leído por `mt-eval` se agota, `status` y `ledger show --set` cuentan las lecturas, y `DEPLOY.md` indica cuándo la puntuación exportada no fue una primera mirada.

### Cómo leer el informe de battery-lint

El informe es una tabla de puntuaciones **por registro** (libro de texto, gubernamental, relato oral, …) —o un solo grupo, `all`, cuando las filas de prueba no especifican un registro—, cada uno con su intervalo de confianza, seguido del diagnóstico. El diagnóstico identifica sus **registros más débiles** y, para cada uno, la causa más probable y la **palanca** que conviene accionar a continuación:

| Si el diagnóstico dice… | Significa que… | La palanca |
|---|---|---|
| `R1-vocabulary-gap` | el registro obtiene una puntuación baja **y** las salidas están incompletas; al modelo le faltan palabras | **VOCABULARIO** — amplíe el léxico, luego vuelva a verificar el embudo |
| `R2-structure-gap` | las palabras se conocen, pero las *estructuras* de las oraciones no | **ESTRUCTURA** — añada las construcciones faltantes (plantillas/compositor) |
| `R3-mixed-convention` | las salidas mezclan convenciones ortográficas | **ORTOGRAFÍA** — normalice el corpus a una sola convención, reentrene |
| `R4-optimism-bound` | la puntuación «completa» está inflada por filas de prueba casi gemelas | **MEDICIÓN** — cite la puntuación estricta para la generalización |
| `R5-low-power` | el intervalo de confianza es amplio | **MEDICIÓN** — no tome medidas sobre diferencias menores que el IC; amplíe el conjunto de prueba |
| `R7-transfer-plateau` | excelente en sintético, estancado en texto real | **DATOS REALES** — retrotraduzca datos monolingües u obtenga oraciones paralelas reales |
| `R9-harness-score-caveat` | el informe de mt-eval matiza la puntuación (por ejemplo, una salida casi constante); `high` cuando mt-eval lo considera grave | **MEDICIÓN** — cite la puntuación únicamente con la salvedad y lea algunas salidas antes de calificarla como calidad de traducción |

Cada hallazgo incluye la evidencia sobre la que se activó. Para los hallazgos de `--json` en los que su agente puede actuar programáticamente: `nmt-forge lint
export/evaluation/battery-hyps-battery.json --json`.

---

## Paso 6 — Servirlo al CLI de champollion

**Usted dice:** *«Sirve el modelo exportado y traduce las cadenas de nuestra aplicación con él».*

**forge hace:**

```bash
nmt-forge serve export/model                               # http://127.0.0.1:8378
LOCAL_API_BASE=http://127.0.0.1:8378/v1 champollion sync --method local
```

`serve` responde de dos maneras: el contrato del **método de api** de champollion (`POST /translate`) y un `/v1/chat/completions` **compatible con OpenAI**, que es con lo que se comunica `champollion sync --method local`. `export/model/DEPLOY.md` contiene el fragmento de `champollion.config.json` para el método `api` (el que recomienda) y para el manifiesto del plugin. El servidor escucha únicamente en `127.0.0.1`; para exponerlo en una red debe proporcionarle un token (`--token` o `NMT_FORGE_SERVE_TOKEN`), ya que cualquiera que pueda acceder al puerto puede usar su modelo. El CLI no necesita clave para el servidor de loopback; un servidor iniciado con un token necesita el mismo valor en `CHAMPOLLION_API_KEY`.

Con dos modelos exportados, la decisión de cuál implementar es suya: `nmt-forge choose export-<run>/model` la registra y `nmt-forge status` indica entonces ese modelo. Servir uno para probarlo se registra como servido, no como una elección. Para ingresar el modelo en un concurso soberano en su lugar, `DEPLOY.md` §6 enumera los archivos que componen una entrada declarativa (Lane A) y el comando exacto de `mt-eval contest submit-model`.

Tenga claro lo que está implementando: un modelo de TA traduce texto; **no** sigue instrucciones, por lo que las guías de tono, los archivos de asesoramiento (coaching) y los glosarios que el CLI envía a los métodos basados en LLM se ignoran. Además, la traducción automática de un idioma con pocos recursos requiere la revisión de un hablante fluido antes de que nada llegue a los lectores.

---

## Lo que acaba de hacer

Ha entrenado un modelo en cuya puntuación realmente puede confiar: sin respuestas filtradas, un checkpoint elegido sin mirar el conjunto de prueba, barras de error en cada número, predicciones escritas antes de los resultados, un diagnóstico que indica la siguiente palanca en lugar de dejarlo adivinar, y un modelo empaquetado al que el CLI puede llamar y que se compara directamente con cualquier otro método que haya medido. De eso se trata todo: **el resultado honesto es el predeterminado, y no se necesitó experiencia en TA (ni una GPU) para llegar a él.**

Cuando los números decepcionen (lo harán, la primera vez: el modelo predeterminado es modesto por diseño), vaya a [Diagnosticar una ejecución de entrenamiento](/docs/network/getting-started/diagnosing-training); está organizado a partir de los síntomas, escrito exactamente para ese momento.
