---
sidebar_position: 3
title: "Entrene su primer modelo (con su agente)"
description: "Un recorrido paso a paso para entrenar un modelo MT de bajo recurso dirigiendo un agente de codificación — qué dice usted, qué hace forge, cómo se ve un rechazo y cómo leer el diagnóstico."
related:
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

Esta página es el bucle completo. Cada paso está escrito como **lo que le dice a su agente**, **lo que forge hace**, **cómo se ve un rechazo** (para que ninguno de ustedes entre en pánico cuando ocurra — un rechazo es la herramienta funcionando), y, al final, **cómo leer el informe**.

:::tip La única regla para su agente
Dígale: *"Siempre ejecute `nmt-forge status --json` primero, y después de cada paso.
Haga lo que su `next_command` diga."* Ese único hábito convierte forge en un carril guiado. Si su agente se conecta a través de MCP, el mismo bucle es la herramienta `forge_status` — vea la [Guía del agente](/docs/network/getting-started/agent-guide).
:::

---

## Paso 0 — Apunte su agente a su idioma

**Usted dice:** *"Quiero entrenar un modelo English→[su idioma]. Comience descubriendo qué sabe forge al respecto. El código ISO 639-3 es `crk`"* (use el código de su idioma).

**forge hace:** `nmt-forge discover crk` lee la tarjeta del idioma — scripts, diccionarios, analizadores morfológicos, corpus existentes y conjuntos de evaluación (con cualquier marca `do_not_train` / cuarentena), y métricas de árbitro por idioma. Coloca su idioma en la **escalera de activos**: (1) texto paralelo → entrenamiento protegido; (2) + monolingüe → retrotraducción etiquetada; (3) + diccionario/gramática → datos sintéticos citados; (4) + analizador → síntesis verificada de viaje redondo; (5) + métrica de árbitro → la métrica propia del idioma en puntuación y selección de puntos de control.

**Un campo en blanco significa DESCONOCIDO, nunca cero.** Una tarjeta dispersa no significa "este idioma no tiene nada" — simplemente puede no registrar el recurso aún. Siempre puede traer su propio corpus paralelo.

Luego: *"Andamie el proyecto."* → `nmt-forge init crk` escribe un espacio de trabajo, una configuración inicial, y un `NEXT_STEPS` breve.

---

## Paso 1 — Cree una división que no pueda hacer trampa

**Usted dice:** *"Aquí está mi corpus paralelo `corpus.jsonl`. Divídalo en train/dev/test y registre los conjuntos dev y test."*

**forge hace:** `nmt-forge split corpus.jsonl --test 200 --dev 100 --seed 7
--out data/splits --register mypair`. Hace una división **disjunta por grupo**: cualquier par de oraciones que compartan una fuente *o* un objetivo caen en el **mismo** lado. Esta es la forma más común en que las puntuaciones de recursos bajos se inflan — un libro de texto mapea muchos ejercicios en inglés a una palabra objetivo, una división aleatoria ingenua coloca una copia en train y su gemela en test, y el modelo "traduce" respuestas que memorizó.

**Cómo se ve un rechazo:** si le entrega a forge una división que hizo usted mismo y no es disjunta, `verify-split` falla con las claves compartidas nombradas — *"estas filas comparten un objetivo canónico entre train y test."* Solución: deje que forge haga la división.

---

## Paso 2 — Detecte fugas

**Usted dice:** *"Antes de entrenar, verifique el corpus de entrenamiento para detectar fugas contra los conjuntos de evaluación."*

**forge hace:** `nmt-forge leak-audit corpus.jsonl`. Verifica su corpus contra cada conjunto dev/test/sellado registrado:

- **Duplicado exacto o casi exacto del lado objetivo** (la respuesta de referencia está en sus datos de entrenamiento) → **fatal**. Esta es fuga de respuesta.
- **Casi duplicado del lado fuente con una respuesta *diferente*** → **informativo, mantenido**. Mismo prompt, traducción diferente es un par de contraste mínimo legítimo, no una fuga — forge lo reporta pero nunca lo elimina. (Esta distinción fue un error real que atrapamos al usar la herramienta: una versión anterior marcaba 44 filas como fatales cuando solo 17 eran fugas genuinas.)

**Cómo se ve un rechazo:** *"fila 118: casi duplicado del lado objetivo del conjunto test `mypair-test` (Jaccard 0.83) — fuga de respuesta."* Solución: su agente ejecuta `nmt-forge leak-audit corpus.jsonl --clean-to corpus.clean.jsonl` y entrena en los sobrevivientes.

---

## Paso 3 — Prediga antes de mirar

**Usted dice:** *"Escriba lo que esperamos que el modelo haga, luego entrenaremos."*

**forge hace:** `nmt-forge prereg new p1 --eval-set mypair-test --predictions
predictions.md`. Usted (o su agente, en voz alta) se compromete con predicciones falsables — qué métrica, qué dirección, qué tamaño — **antes** de que exista ninguna puntuación de test.

**Cómo se ve un rechazo:** si su agente intenta puntuar el conjunto de test sin preregistro, `score` se rehúsa: *"puntuar un conjunto de test se rechaza sin un preregistro que sea anterior a la primera lectura de puntuación."* Esto es lo que separa un resultado de la narración de resultados primero. Solución: preregistre primero.

:::info Por qué esto se siente como trabajo extra
Es el trabajo. Cada guardia aquí es un error que ha engañado a investigadores reales. La herramienta hace que el camino honesto sea el camino fácil y el camino deshonesto sea el que lo detiene.
:::

---

## Paso 4 — Verifique las compuertas, luego entrene

**Usted dice:** *"¿Pasará la ejecución de entrenamiento todas sus verificaciones? Si es así, entrene."*

**forge hace:** `nmt-forge preflight run` lista cada compuerta que la ejecución golpeará — dev-fence presente, auditoría de fuga limpia, piso de horario derivado, espacio de decodificación verificado — cada ✓ o ✗ con una solución. Cuando todo está en verde:
`nmt-forge run config.json`.

El entrenamiento es el único paso que **no** es una llamada de herramienta instantánea — usa una GPU y toma minutos a horas. Su agente la ejecuta en una terminal y observa las líneas `[schedule-sanity]`. forge deriva el **piso** de parada temprana de su mezcla de datos, por lo que una ejecución pesada en síntesis no muere a media época cuando la pérdida real-dev se tambalea (un modo de fallo real — vea [Diagnosticando una ejecución de entrenamiento](/docs/network/getting-started/diagnosing-training)).

Cuando termina, forge ha **seleccionado un punto de control en el conjunto dev cercado** (nunca en el conjunto de test) y escrito un `run-manifest.json`.

---

## Paso 5 — Cierre el bucle: evalúe y diagnostique

**Usted dice:** *"Puntúe el modelo en la batería de test y dígame qué mejorar."*

**forge hace:** `nmt-forge evaluate .forge/runs/<run>/run-manifest.json --config
config.json`. Esto **cierra el bucle** en un comando: decodifica la batería de test con el punto de control que la ejecución seleccionó, lo puntúa (con compuerta prereg, con intervalos de confianza del 95% en cada número), y añade una sección **Diagnóstico y Recomendaciones** en lenguaje natural. (Antes de que existiera este comando, tenía que crear un enlace simbólico al punto de control y ejecutar un decodificador a mano — exactamente donde un novato se perdía.)

### Cómo leer el informe de battery-lint

El informe es una tabla de puntuaciones **por registro** (libro de texto, gobierno, historia oral, …), cada una con su intervalo de confianza, seguida del diagnóstico. El diagnóstico nombra sus **registros más débiles** y, para cada uno, la causa más probable y el **mecanismo** a activar a continuación:

| Si el diagnóstico dice… | Significa… | El mecanismo |
|---|---|---|
| `R1-vocabulary-gap` | el registro puntúa bajo **y** las salidas están incompletas; al modelo le faltan las palabras | **VOCABULARIO** — haga crecer el léxico, luego vuelva a verificar el embudo |
| `R2-structure-gap` | las palabras se conocen pero las *formas* de oración no | **ESTRUCTURA** — agregue las construcciones faltantes (plantillas/compositor) |
| `R3-mixed-convention` | las salidas mezclan ortografías | **ORTOGRAFÍA** — normalice el corpus a una convención, reentrenamiento |
| `R4-optimism-bound` | la puntuación "completa" se infla por filas de evaluación casi gemelas | **MEDICIÓN** — cite la puntuación estricta para generalización |
| `R5-low-power` | el intervalo de confianza es amplio | **MEDICIÓN** — no actúe en deltas más pequeños que el IC; haga crecer el conjunto de evaluación |
| `R7-transfer-plateau` | excelente en sintético, estancado en texto real | **DATOS REALES** — retrotraduza datos monolingües u obtenga oraciones paralelas reales |

Cada hallazgo lleva la evidencia en la que se disparó. Para los hallazgos `--json` en los que su agente puede actuar programáticamente: `nmt-forge lint <battery-manifest.json>`.

---

## Lo que acaba de hacer

Entrenó un modelo cuya puntuación realmente puede creer: sin respuestas filtradas, un punto de control elegido sin mirar el conjunto de test, barras de error en cada número, predicciones escritas antes de resultados, y un diagnóstico que nombra el próximo mecanismo en lugar de dejarlo adivinar. Ese es el punto completo — **el resultado honesto es el predeterminado, y no requirió experiencia en MT para llegar allí.**

Cuando los números decepcionen (lo harán, la primera vez), vaya a [Diagnosticando una ejecución de entrenamiento](/docs/network/getting-started/diagnosing-training) — está orientado por síntomas, escrito para exactamente ese momento.
