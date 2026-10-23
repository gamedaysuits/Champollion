---
title: "Entrenamiento con nmt-forge"
slug: /agents/training
description: "Cómo nmt-forge entrena y prueba un modelo sobre rieles: las preconfiguraciones de modelos y lo que --model auto elige según la memoria, el bucle protegido comando por comando, los límites de decodificación y longitud, las tareas en segundo plano y la cola de un solo entrenamiento a la vez, el espacio en disco (puntos de control conservados, la comprobación de disco, tidy), exportar y servir, las rondas de mejora (el veredicto de la ronda, el veredicto de la persona hablante) y la oferta de un modelo más potente, datos sintéticos, una tabla verificada de síntoma → causa → solución y la taxonomía de fallas."
---

# Entrenamiento con nmt-forge

`nmt-forge` entrena un modelo con los pares de la comunidad, dentro de barandillas de seguridad:
rechaza lo que corrompería un resultado, y cada rechazo indica qué ocurrió, por qué y cuál es
la solución. No implementa ninguna métrica propia: cada puntuación proviene del
motor de evaluación (`mt-eval`), el mismo código que evalúa todo lo demás.

En los rieles rara vez escribirá estos comandos: `champollion next` los nombra,
y a partir del paso `forge` transmite el propio asesor de forge
(`nmt-forge status`). Esta página describe lo que hacen esos pasos.

## Modelos

`nmt-forge init --model <preset>` escribe una configuración predefinida en `config.json` como
números explícitos (incorporados en el hash de identidad de cada ejecución: una versión posterior de forge
nunca cambia las ejecuciones de un proyecto existente). `nmt-forge use-model <preset>`
cambia de proyecto.

| Preajuste | Qué es | Requisitos | Qué indica forge que se puede esperar |
|---|---|---|---|
| `cpu-tiny` | Un transformer pequeño entrenado desde cero con los pares, con un vocabulario de 4,000 piezas aprendido de las filas de entrenamiento | Solo CPU · sin descargas | "en ~1–2k pares: chrF++ aproximadamente de 5 a 30 (el extremo superior solo para datos con muchas plantillas) — frases memorizadas y plantillas de sus datos, no traducción general" |
| `byt5-small` | ByT5-small de Google (300M parámetros, lee bytes; sin vocabulario que ajustar), con ajuste fino | Descarga de ~1.2 GB · se recomienda Apple silicon o una GPU CUDA | "en las propias pruebas de forge aprendió mucho más de los mismos pares que cpu-tiny; aun así, mídalo frente a su modelo en uso en su conjunto de desarrollo" |
| `byt5-small-lowmem` | El mismo modelo, tasa de aprendizaje y límites de longitud, configurado para una computadora con 8–15 GB de memoria: Adafactor, puntos de control de gradiente y lotes de 4 pares acumulados 4 veces (los mismos 16 pares por paso); menos memoria por paso, más tiempo. Aún no se ha medido en una computadora de 8 GB | igual que `byt5-small` | igual que `byt5-small` |
| `cpu-finetune` | Un modelo Marian/opus-mt pequeño preentrenado, ajustado en CPU. Usted indica la base (`--base`); nunca se adivina | Solo CPU · descarga de ~300 MB | "depende de qué tan emparentado esté el idioma de destino de la base; mídalo frente a cpu-tiny en su conjunto de desarrollo" |
| `nllb-600m` | NLLB-200 destilado de 600M con LoRA | una GPU CUDA (8 GB+) · descarga de ~2.5 GB | "el más potente de los tres cuando NLLB cubre un idioma emparentado; aun así, mídalo: nunca lo asuma" |

Cada preajuste entrena con el complemento de entrenamiento de forge (`nmt-forge[hf]`), con semilla 42.
Ningún preajuste define un presupuesto de tiempo: ese número le corresponde a la comunidad.

- **Sin `--model`**, `init` escribe `cpu-tiny`.
- **`--model auto`** (lo que pasan los rieles) lee la memoria de la GPU en la que forge
  puede entrenar: en una Mac con Apple silicon, la memoria de la computadora (compartida
  con la GPU); con `nvidia-smi` en `PATH`, la de la tarjeta NVIDIA más grande:
  16 GB o más (o memoria que no puede leer) → `byt5-small`; 8–15 GB →
  `byt5-small-lowmem`; menos de 8 GB → `cpu-tiny`. Sin ninguna GPU, `cpu-tiny`.
  El motivo, junto con la memoria encontrada, se imprime (`chosen: …`) y se devuelve
  como `model_choice` en `--json`. No comprueba que la GPU funcione.
  `NMT_FORGE_AUTO_PRESET` lo anula (debe indicar un preajuste).
- **El modelo más potente que ofrecen las rondas** se destina únicamente a un proyecto cuyo modelo
  en uso sea `cpu-tiny`: `byt5-small-lowmem` donde `--model auto` lo elegiría,
  y de lo contrario `byt5-small`; también en una computadora donde `auto` elegiría
  `cpu-tiny`; el `why` de la oferta indica lo que necesita.

**Nota.** Nunca describa la expectativa de un preajuste como una promesa. Mida en el
conjunto de desarrollo.

## El ciclo protegido

Cada comando acepta `--json`; `--workspace <dir>` (por defecto `.forge`) va
antes del subcomando. Forge rechaza opciones abreviadas.

| Paso | Comando | Qué hace | Qué rechaza |
|---|---|---|---|
| Taller | `nmt-forge init <code> --dir . --pair <src>-<tgt> --model auto` | Escribe `.forge/`, `config.json`, `NEXT_STEPS.md` | Un `--pair` ilegible; `cpu-finetune` sin `--base` |
| Conjunto de prueba | `nmt-forge registry add project-test <file> --role test` | Fija el sha256 del archivo; inicia su registro de lectura | Filas sintéticas en un conjunto de prueba o sellado; un nombre ya registrado con otro contenido (a menos que se use `--allow-rotate`) |
| Filtrado | `nmt-forge leak-audit <corpus> --clean-to <clean.jsonl>` | Comprueba cada par con respecto a cada conjunto de desarrollo, prueba y sellado registrado; escribe una copia limpia | Sobrescribir un archivo en uso (a menos que se use `--overwrite`); un resultado sin datos de entrenamiento restantes |
| Predicción | `nmt-forge prereg new <id> --eval-set <set> --expect "…" --rationale "…"` | Escribe la predicción de la comunidad antes de cualquier puntuación | Un id existente; escribir después de cualquier lectura de puntuación del conjunto, ya sea por forge o por `mt-eval` (a menos que se use `--allow-after-reads`, registrado en el libro mayor) |
| Conjunto de desarrollo | `nmt-forge split <clean.jsonl> --test 0 --dev <n> --seed 42 --near-dupe 0.6 --max-group <m> --out data/split --register project` | Una división de desarrollo sin superposición de grupos, registrada como `project-dev`. El `<n>` de las vías: uno de cada diez pares filtrados, al menos 50, como máximo 500 — una cuarta parte de ellos por debajo de 200 pares ([shell](/docs/agents/shell#build-and-test-a-model)). `--near-dupe 0.6` mantiene las copias cercanas (superposición de palabras ≥ 0.6) de un solo lado, el umbral que aplica el filtrado de cada ronda posterior; las vías establecen `--max-group` en la mitad del tamaño de desarrollo más uno, para que un archivo escrito a partir de plantillas aun así se divida | Un lado que supere 1.5 veces lo solicitado, o un entrenamiento que conserve menos de la mitad de las filas |
| Línea base | `nmt-forge floor <word lists>` | Traduce el conjunto de desarrollo palabra por palabra a partir del diccionario y lo puntúa de la misma manera que la puntuación de desarrollo de una ejecución | No hay ningún conjunto de desarrollo registrado |
| Comprobación | `nmt-forge preflight run --config config.json` | Ejecuta cada control por el que pasará la ejecución, con soluciones; sale con código 2 si alguno falla | — |
| Entrenamiento | `nmt-forge run config.json --detach` | Entrena, elige el punto de control en desarrollo, elimina los demás puntos de control de la ejecución ([espacio en disco](#disk-space)), escribe `.forge/runs/<run name>-<8 hex>/` con `run-manifest.json`, `run-report.md`, `dev-outputs.jsonl` | Una ejecución que ya existe (misma configuración, archivos de entrenamiento y conjunto de desarrollo); un disco sin espacio para ella (`disk-room`, antes de escribir nada; `--skip-disk-check` lo anula); una ejecución en curso; filas de entrenamiento que se filtran a un conjunto de prueba o sellado; filas de desarrollo en el entrenamiento; datos marcados como do-not-train o en cuarentena; `terms.training: not-allowed`; datos sintéticos que superan su límite; un límite de decodificación demasiado corto para las referencias; claves de configuración desconocidas |
| Puntuación de prueba | `nmt-forge export <run-manifest.json> --prereg <id> --out export/` | Puntúa el conjunto de prueba una sola vez, frente a la predicción; empaqueta el modelo, con `input-words.json` junto a su carpeta — las palabras con las que fue entrenado, para que un servidor pueda nombrar las que nunca vio ([servicio](/docs/agents/serving#what-an-export-holds)) | Sin registro previo, o varios sin `--prereg`; un conjunto sellado agotado; un `--out` no vacío sin `--force` |
| Elección | `nmt-forge choose <export>/model` | Registra la elección de modelo de la comunidad | Una carpeta que no sea una exportación registrada con un modelo |
| Servir | `nmt-forge serve <export>/model --detach` | Lo sirve en esta computadora ([servicio](/docs/agents/serving#nmt-forge-serve)) | Fuera de loopback sin un token, o un modelo exclusivamente local sin `--holders-agreed-by` |

Todo lo importante se escribe en el libro mayor encadenado por hash
(`.forge/ledger.jsonl`): registros, lecturas con su propósito, predicciones,
puntuaciones, usos de conjuntos sellados, anulaciones, veredictos de auditoría, el piso de referencia, exportaciones,
elecciones, puestas en servicio, e inicios y salidas de trabajos. El manifiesto de ejecución es el registro de una
ejecución.

**Controles previos:** configuración (imprime el hash completo de configuración), coincidencia de espacio de trabajo, ninguna
ejecución en curso, barrera de desarrollo, datos de entrenamiento, backend instalado, complementos de
selección, gemelos cercanos de prueba y gemelos cercanos de desarrollo (advertencias), auditoría de filtraciones, mezcla de
entrenamiento, margen de generación, coherencia del cronograma.

**Decodificación.** La decodificación final de desarrollo, la lectura de prueba (`export`), un modelo en uso
traduciendo nuevamente el conjunto de desarrollo y el modelo en servicio utilizan búsqueda por haz con
`decode.num_beams` (4 a menos que `config.json` indique lo contrario); la selección
de puntos de control, que clasifica muchos puntos de control, decodifica de forma voraz. Una exportación
registra `beams_applied`, y `nmt-forge serve` decodifica de la forma en que se midió
el modelo: una exportación anterior que no lo incluya se sirve de forma voraz.

**Límites de longitud.** Un modelo aprende de como máximo `model.max_src` tókenes de una
oración de origen y `model.max_tgt` de su traducción, lee como máximo
`model.max_src` cuando traduce, y escribe como máximo
`decode.max_new_tokens` (`byt5-small`: 320 bytes cada uno — unas 320 letras de
una escritura latina, unas 100 de silabario; `cpu-tiny`: 256 piezas de entrada, 384 de salida).
Nada se recorta en silencio: el entrenamiento cuenta los pares que superan cualquiera de los límites antes
de recortarlos, y la decodificación final de desarrollo cuenta las oraciones recortadas al entrar y
las traducciones que se detuvieron en el límite máximo. Ambos se incluyen en el manifiesto de ejecución
(`length_limits`), y `status` advierte, con la solución: dividir las oraciones largas, o
aumentar `model.max_src` y `model.max_tgt` (y `decode.max_new_tokens`) en
`config.json`; en ese caso, el entrenamiento tardará más.

**Nota.** `nmt-forge run` en sí no requiere una predicción; los rieles la solicitan
primero. No entrene antes de completar el paso de predicción.

**Nota.** `export` es el paso que lee el conjunto de prueba. Ejecutarlo es un
hito, con la predicción de la comunidad ya registrada; nunca una verificación
de rutina.

## Trabajos en segundo plano

`run --detach` y `serve --detach` inician un trabajo supervisado y regresan.

```bash
nmt-forge jobs                          # every job: state, stage, step, time left, last sign of life
nmt-forge jobs stop <name> --wait 120   # stop it, and wait up to 120 s (at most 180) for it to exit
```

- Estados: `running`, `finished`, `refused`, `crashed`, `stalled`,
  `deadline`, `interrupted`, `lost`. `lost` es un trabajo cuyo supervisor finalizó
  sin dejar registro, incluso después de un reinicio, cuando su número de proceso ahora
  pertenece a otro proceso.
- **Un solo entrenamiento a la vez en esta computadora.** Los trabajos de entrenamiento se ponen en cola
  a nivel de toda la máquina, por orden de llegada (`~/.nmt-forge/machine/train-queue`),
  en todos los proyectos. Un trabajo en cola permanece como `running`, con `queued_behind`
  (el trabajo al que espera) en `nmt-forge jobs --json`; `status` es `training`
  e indica detrás de quién espera, e inicia por sí solo. Una detención mientras
  espera lo finaliza sin haberse iniciado (`interrupted`); una espera de 24 horas lo finaliza
  (`deadline`).
- **Límites** (trabajos de entrenamiento): sin señales de vida durante 15 minutos al iniciar
  (`--startup-minutes`); sin progreso durante el período que resulte mayor entre 10 minutos y 30 veces
  el tiempo mediano de paso (`--stall-minutes`); un plazo límite de `--deadline-hours`,
  de lo contrario el presupuesto de tiempo de la configuración × 1.25, o bien 24 horas. Un trabajo que supera un límite se
  detiene y se registra.
- **Detención**: la ejecución se detiene en su siguiente paso; el supervisor escala para
  terminar después de 60 s y forzar el cierre 10 s después.
- **El control de tiempo real** (backends de Hugging Face): tras el calentamiento, forge cronometra
  los pasos, proyecta la ejecución y rechaza la que no se ajuste al presupuesto
  (`wall-clock budget exceeded: …`). Si no se define un presupuesto, el límite es un
  techo de 24 horas.
- Mientras se ejecuta un trabajo de entrenamiento, `status` es `training` y el paso de los rieles es
  `wait`. Un trabajo que falló genera una advertencia en cada estado posterior.
- **Reanudación.** Cuando el último trabajo de entrenamiento finalizó en `lost`, `crashed`, `stalled`
  o `deadline` tras guardar un punto de control, `status` indica `nmt-forge preflight
  run --config config.json && nmt-forge run config.json --resume --detach`:
  una nueva ejecución que inicia desde el último punto de control de la ejecución interrumpida (sus
  pesos, un optimizador nuevo, las épocas que le quedaban), y cuyo manifiesto indica
  desde dónde se reanudó (`resumed_from`). Nunca se ofrece tras una detención
  manual.
- Los trabajos desacoplados son solo para POSIX (macOS, Linux).

## Espacio en disco

El entrenamiento escribe puntos de control: hasta `model.save_total_limit` de ellos a la vez
(4 a menos que `config.json` indique lo contrario), de unos 1.4 GB cada uno para ByT5-small.
Antes de estas reglas, cada ronda de mejora de un proyecto ByT5-small conservaba unos
5.6 GB, nada eliminaba el modelo de una ronda anterior, y un disco lleno interrumpía una
ejecución mientras se guardaba. El GB de forge equivale a 1024³ bytes.

- **Una ejecución terminada conserva únicamente su checkpoint seleccionado.** Todas las demás
  carpetas `checkpoint-*` de la ejecución se eliminan una vez que se elige el checkpoint:
  nada vuelve a leerlas (`export` copia el seleccionado; la siguiente ronda
  comienza a partir del modelo en uso). El manifiesto registra `checkpoints_pruned`
  (`removed`, `bytes`, `kept`). `"keep_checkpoints": "all"` en el bloque
  `model` de `config.json` los conserva todos. Cualquier otro valor se rechaza cuando se
  lee la configuración, antes de cualquier entrenamiento (`ConfigError`; aquí para el valor `x`):
  `config.model.keep_checkpoints is "selected" (the default: only the checkpoint the run picks stays) or "all", not 'x'`.
- **Bloqueo.** Una ejecución que el disco no puede albergar se rechaza antes de que se escriba
  nada (protección `disk-room`); una ejecución desacoplada se rechaza de inmediato, antes de que
  comience su tarea. La estimación: el tamaño de un checkpoint —el checkpoint conservado de una
  ejecución anterior de la misma base en este espacio de trabajo, o bien los propios archivos de
  pesos de la base (una carpeta local o la caché de Hugging Face)— multiplicado por
  `model.save_total_limit`, más 1 GB para terminar; nunca menos de 2 GB. El
  rechazo indica
  `[disk-room] this computer has <free> free; training this model needs about <need> (<n> checkpoints of about <size> each while it trains, and room to finish)`
  —o, cuando no se conoce ningún tamaño, *"(at least that much must stay free
  whatever the model)"*— luego
  `why: a disk that fills mid-training loses the run as it saves, and slows the whole computer`,
  y un `fix` que indica lo que `nmt-forge tidy` puede liberar aquí (cuando puede
  liberar algo), mover otros archivos fuera del disco y `--skip-disk-check`.
- `nmt-forge run … --skip-disk-check` (con o sin `--detach`) inicia
  de todos modos. El `disk_room` del manifiesto registra la verificación —`free_bytes`,
  `checkpoint_bytes` (`null` cuando se desconoce), `checkpoints_at_once`,
  `need_bytes`— o `{"skipped": "--skip-disk-check"}`. **Nota.** La
  estimación puede equivocarse; omitir o no la verificación es decisión de la persona.
- **`nmt-forge tidy`** enumera los pesos de los modelos de rondas anteriores que ya nada
  utiliza —cada ejecución con su tamaño, el total, el espacio libre— y no elimina
  nada. `nmt-forge tidy --yes` los elimina. Nunca elimina el modelo en
  uso, la ejecución más reciente ni el modelo que el actual reemplazó (la hoja de
  revisión a ciegas redacta borradores con él); la línea `Kept:` de la salida nombra cada uno, con
  su motivo. Una ejecución depurada conserva su registro —manifiesto, traducciones de desarrollo, informe—
  y su manifiesto recibe `model_removed` (`at`, `by`, `bytes`, `why`); el
  libro mayor recibe una entrada `tidy` (`runs`, `bytes`). Si a una ejecución depurada se le
  pide traducir (`compare-runs` volviendo a traducir el conjunto de desarrollo con ella), se rechaza:
  `run <name>'s model was removed by nmt-forge tidy on <time> to free disk space — its record stays, its weights do not`.
  **Nota.** `--yes` elimina archivos: muéstrele la lista a la persona y ejecútelo solo
  si ella da su confirmación.
- **`status` advierte** —una línea en `warnings`, transmitida por los rieles— cuando el
  disco que contiene el espacio de trabajo tiene menos de 10 GB libres, o tidy podría liberar 5 GB
  o más: *"esta computadora tiene X GB libres; los modelos de N ronda(s) anterior(es)
  que nada usa ocupan Y GB — `nmt-forge tidy` los enumera,
  `nmt-forge tidy --yes` libera el espacio (se conservan el modelo en uso, el más nuevo y
  el que este reemplazó)"* (la parte después del punto y coma solo cuando
  tidy liberaría algo).

## Las rondas de mejora

Una vez que un modelo está en uso, cada ronda entrena una nueva ejecución con más datos y el
mismo conjunto de desarrollo.

**Cómo entrena una ronda.** `champollion improve prepare` ejecuta `nmt-forge
round-plan --config config.json`, which rewrites `config.json` de una de dos
maneras y escribe el plan en el libro mayor (`round-plan`):

- **Continuando a partir del modelo en uso** (`init_from` su carpeta de modelo): 4 pasadas
  (épocas) sobre todas las oraciones acumuladas hasta ahora (las anteriores evitan que
  olvide) a la mitad de la tasa de aprendizaje. Mucho más corto que entrenar desde el
  inicio. Los ajustes completos esperan en `config.json` bajo `model_full`.
- **Desde el inicio**, restableciendo los ajustes completos, cuando todavía no hay ningún modelo en
  uso; cuando se cambió el modelo (`use-model`, lo que también descarta
  `model_full`); para `cpu-tiny`, cuyo vocabulario proviene de las oraciones
  de entrenamiento (se entrena en minutos); para un modelo de adaptador (LoRA); y cada
  4.ª ronda, para que tantas continuaciones breves no se desvíen.

`prepare` muestra el plan y su motivo, y registra `training` (`mode`,
`epochs`) en `improve/round-<k>/prepared.json`. De cualquier modo, la nueva ejecución se
juzga contra el modelo en uso sobre las mismas oraciones de desarrollo. Luego (1, 3 y
4 son estados que nombra el asesor de forge; 2 es registrado por las vías):

1. **`improve-compare`** (`auto`): `nmt-forge compare-runs <in-use
   run-manifest.json> <new run-manifest.json>` — los dos modelos, emparejados
   oración por oración en el conjunto de desarrollo. Con menos de 50 oraciones de desarrollo, el
   veredicto es **too-few**, sin importar las puntuaciones: *"muy pocas oraciones de desarrollo para
   determinarlo: por debajo de 50, una diferencia no se distingue del azar de manera confiable, sin importar
   su tamaño"*. A partir de 50: **better** únicamente cuando el p del test pareado < 0.05
   **y** el intervalo del 95% de la diferencia está por encima de cero; **worse** cuando
   p < 0.05 y está por debajo de cero; de lo contrario, **no-change**. Cada veredicto indica
   la diferencia más pequeña que su conjunto de desarrollo muestra de manera confiable. El conjunto de prueba nunca
   se lee. Se rechaza (`improve-loop`) en caso de ejecuciones sobre conjuntos de desarrollo distintos, una ejecución
   sin traducciones de desarrollo guardadas, o un conjunto de desarrollo modificado desde la nueva ejecución.
2. **El veredicto del hablante**, donde el conjunto de desarrollo no pudo decidir. El modelo de una
   ronda que no se puso en uso redacta la mitad de las filas con borrador de la siguiente hoja de revisión,
   a ciegas (`draft-newer`, más abajo), y `champollion improve marks`
   registra los recuentos del hablante con forge:
   `nmt-forge speaker-verdict --newer <run> --in-use <run> --newer-right <n> --newer-judged <n> --in-use-right <n> --in-use-judged <n> --json`.
   Forge actúa sobre esto solo después de un veredicto **too-few** o **no-change**. Una
   prueba agrupada de dos proporciones, bilateral al 5% (|z| > 1.96), produce `clear`:
   `newer`, `in-use` o `neither`; la entrada `improve-speaker` del libro mayor conserva
   los nombres de las dos ejecuciones, los cuatro recuentos, `z` y `clear` —únicamente recuentos.
   Rechaza recuentos inferiores a 0, más correctos que evaluados, y un modelo sin
   borradores evaluados. Su texto: *"Al evaluar a ciegas en la misma visita, el hablante
   marcó el modelo más nuevo como correcto en A de B oraciones nuevas (P%) y el modelo
   en uso en C de D (Q%)"*, luego *"el modelo más nuevo es claramente mejor en
   estas oraciones — forge ofrece ponerlo en uso"*, *"el modelo en uso es
   claramente mejor en estas oraciones — se queda"* o *"no hay una diferencia clara
   en estas oraciones — el modelo en uso se queda"*.
3. **`improve-promote`** (`confirm`), ante **better** —o ante **too-few** o
   **no-change** cuando el `speaker-verdict` más reciente sobre esa ejecución indica
   `clear: newer` (nunca ante **worse**). Es una propuesta: un veredicto por sí solo no pone
   nada en uso. Si la comunidad da el sí, exporta la nueva ejecución sin leer
   el conjunto de prueba (`--no-eval`), la registra como elegida (`choose`), detiene el
   servidor en ejecución y sirve el nuevo modelo en el mismo puerto. Solo ese
   `export` y `choose` cuentan como poner un modelo en uso: hasta entonces, el
   informe de la ronda indica *"mensurablemente mejor: no puesto en uso — la comunidad
   no lo ha elegido"*, y su progreso, proyección y verificación de sobreajuste dejan
   fuera al modelo. Con las calificaciones del hablante, su `why` añade sus recuentos y *"una
   diferencia clara: el modelo más nuevo es mejor en las oraciones que la familia
   necesita"*. En la siguiente hoja, la mitad de las filas con borrador provienen del modelo que
   reemplazó, para que el hablante verifique la promoción a ciegas (más abajo).
4. De lo contrario, el modelo en uso se mantiene y comienza la siguiente ronda —a menos que los
   dos últimos veredictos de ronda desde el último cambio de modelo sean ambos
   **no-change** o **worse**, con `cpu-tiny` en uso. El último cambio de
   modelo es la entrada más reciente `model-change` (un cambio de preajuste o un `not-now`) o
   `choose` en el libro mayor —cualquier modelo que la comunidad haya puesto en uso, incluida
   una promoción basada en las calificaciones del hablante. Una ronda **too-few** no es una ronda
   juzgada: cuando cualquiera de las dos últimas es too-few, no hay propuesta.
   Luego **`improve-stronger-model`** (`ask_user`):
   `nmt-forge use-model <preset> --config config.json --answer yes` (o
   `not-now`), el preajuste `byt5-small` o `byt5-small-lowmem`
   ([modelos](#models)). El campo de respuesta es `try_it`. `yes` reescribe el
   modelo de la configuración (manteniendo el presupuesto de tiempo de la comunidad) y el siguiente paso lo
   entrena; `not-now` no cambia nada. Ambos se escriben en el libro mayor
   (`model-change`), y la propuesta vuelve a aparecer solo después de otras dos rondas similares.
   A través de MCP, "not now" aquí corresponde a la respuesta `try_it: "not-now"`;
   `declined: true` se rechaza en este paso
   ([MCP](/docs/agents/mcp#not-now)). Su `why` nunca dice que más oraciones no
   estén ayudando: cuando el conjunto de desarrollo es demasiado pequeño para ver la mejora de una ronda, *"podría
   haber pequeñas mejoras ocultas"*; de lo contrario, las rondas aportaron *"ningún cambio
   apreciable con las oraciones de desarrollo (alrededor de X puntos de chrF++ o más): las rondas
   podrían estar sumando menos que eso, o nada"* —cerca de la cima de la curva, una ronda
   añade alrededor de medio punto de chrF++, por debajo de lo que muestran 200 oraciones de desarrollo.
   **Nota.** `--answer` toma `yes` de forma predeterminada: pase siempre la respuesta de la comunidad
   de manera explícita.

Las vías dirigen el resto de una ronda (`champollion improve …`): `nmt-forge
wishlist` escribe la hoja de lo que más ayudaría (40 consignas de forma predeterminada, dejando
al menos una cuarta parte abierta; las palabras que el modelo nunca ha visto piden dos o
tres oraciones cada una, diciendo algo diferente en cada caso —una palabra vista una sola vez en el
entrenamiento rara vez se aprende
([medición](/docs/agents/measurement#what-the-wishlist-steers-on))), `nmt-forge analyze` desglosa el chrF++ de desarrollo según el tipo
de oración, y `nmt-forge grow-dev` agrega las oraciones de práctica del hablante al
conjunto de desarrollo bajo el mismo nombre —nunca una fila que ya esté en desarrollo, nunca una
cuyo origen esté en un conjunto de prueba o sellado. Un tipo de oración orienta la
lista de deseos solo cuando su puntuación está claramente por debajo del resto
([medición](/docs/agents/measurement#what-the-wishlist-steers-on)).
`nmt-forge draft-newer` (ejecutado por `champollion improve sheet`) redacta al azar
la mitad de las filas de la siguiente hoja de revisión con el otro modelo, sin marcar, para que el
hablante juzgue ambos modelos a ciegas
([medición](/docs/agents/measurement#the-speakers-marks)): el modelo entrenado
más reciente cuando no es el que está en uso (su ronda no se puso en
uso) o, tras una promoción, el modelo al que reemplazó el que está en uso. Su `--json`
indica cuál (`relation`: `newer` o `replaced`, `null` cuando no hay otro
modelo y cada fila pertenece al modelo en uso), con `other`, `in_use`, los
pares de entrenamiento detrás de cada uno (`other_pairs`, `in_use_pairs`) y `n`; la
entrada `draft-newer` del libro mayor registra lo mismo. Cómo transmitir una ronda:
[acompañamiento](/docs/agents/coaching).

## Datos sintéticos y retrotraducción

- `nmt-forge synth <pack> --out <file>` ejecuta el generador de un paquete de idioma.
  Forge no incluye paquetes. Cada fila se verifica y se estampa con `synthetic: true`.
- Un archivo sintético se entrena como un carril etiquetado en `config.json`
  (`data.synthetic`, `{"path", "tag": "<synth>"}`). Si supera el 15% de un tipo, la ejecución
  se rechaza a menos que la configuración indique `mix.synthetic_sample`;
  `nmt-forge sample --cap 0.15 --key kind` extrae una muestra limitada.
- **La retrotraducción no tiene un comando propio.** Es una función de biblioteca
  (`nmt_forge.training.backtranslation.backtranslate`): usted suministra el
  modelo inverso; primero filtra el texto monolingüe contra cada conjunto registrado
  y etiqueta su salida con `<bt>`; luego la salida se entrena como un
  carril sintético. No se aplica ningún filtro de calidad sobre ella. `config.data.monolingual` se rechaza.
- **Nota.** El texto monolingüe son datos de la comunidad como cualquier otro: aplican los
  términos de su archivo asociado, y un modelo inverso que sea un LLM alojado lo envía a un proveedor
  ([reglas sobre datos](/docs/agents/data-rules)).

## Síntoma → causa → solución

| Síntoma | Causa probable | Solución |
|---|---|---|
| `cpu-tiny` puntúa entre 5 y 30 chrF++ en desarrollo | Es débil por diseño: un libro de frases para frases similares a sus datos de entrenamiento | Más pares reales; en Apple Silicon o una GPU, `byt5-small` (`nmt-forge use-model byt5-small`; `byt5-small-lowmem` donde la GPU tenga entre 8 y 15 GB) |
| "Bueno en plantillas, malo en texto real" | Regla R7 (meseta de transferencia): la pérdida en desarrollo tocó fondo antes del último punto de control y subió un 5% o más. Se activa con cualquier subida similar, sin importar lo que haya hecho el chrF++ de desarrollo — léala junto con las puntuaciones de desarrollo | Más pares reales. Mostrado por `nmt-forge lint <run-manifest.json>`, no por export |
| La puntuación parece demasiado buena | Copias o copias cercanas del conjunto de prueba en el entrenamiento; o la mayoría de las filas de prueba tienen un gemelo en el entrenamiento (R4-recall-not-translation, en la mitad o más) | `leak-audit --drop-test-twins` para un archivo sin gemelos; informe las puntuaciones con y sin los gemelos |
| Una pequeña diferencia entre dos modelos | El intervalo es amplio (R5-low-power, intervalo mayor a 8 puntos) | `nmt-forge compare` (prueba emparejada); para rondas, `compare-runs`. Amplíe el conjunto de desarrollo |
| Una ronda dice "too few dev sentences to tell" (`too-few`) | El conjunto de desarrollo contiene menos de 50 oraciones: ninguna comparación decide en ese caso | Nada que corregir: la siguiente hoja mezcla los borradores de ambos modelos a ciegas y las calificaciones del hablante deciden; una de cada dos filas de la hoja es una fila de práctica hasta que el conjunto de desarrollo contenga 50 |
| Una ronda dice "no measurable change" | El conjunto de desarrollo es demasiado pequeño para ver la ganancia de una ronda | Amplíelo a partir de las oraciones de práctica del hablante (`grow-dev`, impulsado por `champollion improve prepare`) |
| Entrenamiento rechazado: `[disk-room] this computer has … free` | El disco no puede albergar los puntos de control de la ejecución | `nmt-forge tidy` lista lo que liberarían los modelos de rondas anteriores; `nmt-forge tidy --yes` ante la confirmación de la persona; o libere espacio en otra parte. `--skip-disk-check` solo cuando la persona decida que la estimación es incorrecta |
| Una ejecución no supera el piso del diccionario | El entrenamiento no aprendió nada que la lista de palabras no proporcione | Más pares; compruebe la cobertura del piso; infórmeselo a la comunidad |
| El conjunto de desarrollo está saturado | El límite inferior del intervalo está al 99% del techo | Un conjunto de desarrollo más difícil; la puntuación no puede aumentar más |
| Rechazado antes de entrenar | Consulte la fila "Entrenamiento" anterior; `preflight run` nombra cada control que falla y su solución | Siga la solución. Un componente adicional de entrenamiento faltante: `uv tool install --reinstall --python 3.12 'nmt-forge[hf]'` (o `pip` en el propio Python de forge) |
| Detenido por el reloj de tiempo real | La ejecución proyectada excede el presupuesto (24 horas si no se define uno) | Un modelo más pequeño o menos épocas, o un presupuesto definido por la comunidad (`model.time_budget_hours`) |
| Falló una tarea en segundo plano | `nmt-forge jobs` muestra `crashed`, `stalled`, `deadline`, `lost` o `refused` | Lea su `stderr.log` en `.forge/jobs/<name>/` y corríjalo; luego vuelva a entrenar, o reanude desde su último punto de control cuando `status` indique `--resume` |
| El entrenamiento espera y no comienza | Hay otro entrenamiento ejecutándose en esta computadora; este se encuentra en cola detrás de él (`queued_behind`) | Espere: comenzará por sí solo. No inicie otro |
| Las oraciones largas salen cortadas | Los límites de longitud: `status` advierte con recuentos (pares cortados en el entrenamiento, oraciones de desarrollo cortadas al entrar, traducciones detenidas en el límite) | Divida las oraciones largas; o aumente `model.max_src`, `model.max_tgt` y `decode.max_new_tokens` (entrenamiento más largo) |
| Las palabras salen como fragmentos desconocidos (`cpu-tiny`) | El vocabulario se aprende únicamente a partir de las filas de entrenamiento | Más pares que utilicen esas palabras; o `byt5-small`, que lee bytes |

## La taxonomía de fallas

Forge se construyó a partir de un catálogo de formas en que un proyecto de entrenamiento se engaña a sí mismo. En
resumen — aplicado estrictamente significa que las herramientas lo rechazan:

| Familia | Fallas | En el código |
|---|---|---|
| Filtración | La respuesta en el conjunto de entrenamiento; copias cercanas; paráfrasis a ambos lados de la división; plantillas encadenadas | Aplicado estrictamente (auditoría de filtraciones, protección de división). Los elementos hermanos de plantilla se conservan y se cuentan |
| Contaminación de desarrollo/prueba | Elegir puntos de control en el conjunto de prueba; usar dos veces un conjunto sellado; una puntuación de prueba sin predicción; predecir después de leer | Aplicado estrictamente (barrera de desarrollo, libro mayor de evaluación, registro previo) |
| Tokenizador y ortografía | Un tokenizador que no puede escribir el sistema de escritura; convenciones ortográficas mixtas | No se verifica en los tokenizadores; las convenciones mixtas son lints, solo cuando la configuración las nombra |
| Datos sintéticos | Dominar la mezcla sintética; parada temprana que interrumpe una ejecución con muchos datos sintéticos; colapso; retrotraducción que se retroalimenta de sus propios errores | El piso de parada temprana se aplica estrictamente; el resto son lints o etiquetas |
| Cobertura | Palabras faltantes para el registro | Un lint, cuando un complemento informa la cobertura |
| Medición | Un delta menor que su intervalo; un solo número opaco; operaciones de métricas fuera del motor | Aplicado estrictamente: cada puntuación lleva su intervalo y proviene del motor |
| Decodificación | Salida truncada; puntos de control elegidos por pérdida en lugar de por salida | Aplicado estrictamente: margen de decodificación, selección por métrica de generación; los recortes de longitud se cuentan y se advierten |
| Proceso | Claves de configuración desconocidas; datos marcados como do-not-train; ejecuciones descontroladas | Aplicado estrictamente |

Brechas conocidas, aún sin código: cobertura del tokenizador, calidad de la retrotraducción,
truncamiento por registro, la proporción entre datos de referencia y sintéticos, varianza entre semillas.

## Salida para programas

`--json` coloca exactamente un documento JSON en stdout. Un rechazo es
`{"error": {"type", "guard", "message", "why", "fix", "how_to_get", "text"}}`
y salida 2 (se añade `details` para rechazos de división y barrera de desarrollo). La salida 1 es un
fallo inesperado. `nmt-forge run` finaliza con `RUN EXIT <code>` (0, 1, 2 o
130); `run --detach` devuelve 0 con el documento del trabajo. `nmt-forge status
--json` is `{"snapshot", "advice": {"state", "next_command", "why", "ready",
"blockers", "warnings", "answers"}}`.

## Para profundizar

- [Referencia de comandos de `nmt-forge`](/docs/network/getting-started/forge-command-reference)
  — cada subcomando y opción.
- [Reglas de medición](/docs/agents/measurement) — qué significan las puntuaciones.
- [Su primer traductor](/docs/your-first-translator) y
  [Mejórelo](/docs/make-it-better) — las versiones de la comunidad.
- [Puesta en servicio e implementación](/docs/agents/serving) — qué contiene una exportación.
