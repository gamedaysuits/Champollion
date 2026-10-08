---
sidebar_position: 5
title: "Referencia de comandos forge"
description: "Cada subcomando de nmt-forge, sus argumentos y qué protege — generado desde el parser de CLI para que nunca se desincronice."
---

<!-- GENERADO por forge/scripts/gen_command_reference.py — no editar manualmente.
     Vuelva a ejecutar el generador después de cualquier cambio en la CLI. -->

# Referencia de Comandos forge

Cada subcomando `nmt-forge`, generado directamente desde el analizador de CLI para que esta página no pueda desviarse de la herramienta. Para entender el *por qué* detrás de cada guardia, consulte [Entrenar un Modelo Honestamente](/docs/network/getting-started/training-honestly); para impulsar forge desde un agente, consulte [Entrene su Primer Modelo (con su agente)](/docs/network/getting-started/train-your-first-model).

**La bandera global:** `--workspace <dir>` (predeterminado `./.forge`) precede a cada subcomando y nombra el proyecto en el que está operando.

Agentes: llame a `nmt-forge status --json` primero — le indica cuál de estos ejecutar a continuación.


## `discover`

¿qué tiene este idioma? (lee la ficha de idioma a través del sistema de resolución del harness de evaluación; ausencia = desconocido, nunca cero)

**Argumentos:**

- `code` — código ISO 639-3 (p. ej. crk, fra, nav, arb)

**Opciones:**

- `--json` — imprime exactamente un documento JSON en stdout (otra salida → stderr); errores como {"error": …}, salida 2
- `--cards-dir` — un directorio de fichas de idioma <code>.json (p. ej., exportadas con `champollion network card <code> --json`). Valor predeterminado: $MT_EVAL_CARDS_DIR / $CHAMPOLLION_CARDS_DIR, un checkout o node_modules/champollion arriba del directorio de trabajo; de lo contrario, el índice público de fichas (en caché; reutilizado sin conexión)
- `--no-registry` — omite la verificación cruzada en el registro mt-eval de conjuntos de datos de evaluación

## `init`

andamiar un proyecto desde una tarjeta de idioma: espacio de trabajo + configuración inicial + NEXT_STEPS.md

**Argumentos:**

- `code` — código ISO 639-3 del idioma DESTINO

**Opciones:**

- `--json` — imprime exactamente un documento JSON en stdout (otra salida → stderr); errores como {"error": …}, salida 2
- `--dir` — directorio del proyecto (predeterminado .)
- `--pair` — par de idiomas: eng-crk, o 'eng>crk' (escriba entre comillas la forma con > — un > sin comillas es una redirección de shell) (predeterminado eng-<code>)
- `--cards-dir` — un directorio de fichas de idioma <code>.json (consulte `discover --help`)
- `--model` (uno de: cpu-finetune, cpu-tiny, nllb-600m) — preset del modelo (predeterminado cpu-tiny) — cpu-tiny: transformador diminuto entrenado desde cero con sus pares — CPU, sin descargas, minutos; débil por diseño, bucle honesto; cpu-finetune: ajusta con precisión un modelo pequeño preentrenado Marian/opus-mt en CPU — descarga de ~300 MB; por lo general más potente que cpu-tiny cuando existe un par RELACIONADO (usted define la base); nllb-600m: NLLB-200 distilled 600M con LoRA — el punto de partida más potente, requiere una GPU (descarga de ~2.5 GB)
- `--no-card` — genera la estructura inicial para un idioma que el índice de fichas aún no tiene (todo lo que diría una ficha se considera desconocido)
- `--name` — el nombre del idioma (con --no-card)
- `--base` — modelo preentrenado para --model cpu-finetune (un id de Hugging Face o un directorio local, p. ej., un modelo opus-mt para un par RELACIONADO); anulación opcional para nllb-600m

## `status`

¿dónde estoy? tabla de estado + EL próximo comando (agentes: llame esto primero, use --json)

**Opciones:**

- `--json` — imprime exactamente un documento JSON en stdout (otra salida → stderr); errores como {"error": …}, salida 2

## `preflight`

¿rechazará <command>? cada guardia que golpeará, con correcciones (salida 2 si alguna guardia falla)

**Argumentos:**

- `target` — comando para verificación previa (preflight): run|evaluate|export|serve|score|split|prereg|leak-audit

**Opciones:**

- `--json` — imprime exactamente un documento JSON en stdout (otra salida → stderr); errores como {"error": …}, salida 2
- `--config` — configuración de ejecución para run/evaluate/export (predeterminado ./config.json) — comprueba que se pueda analizar sintácticamente, su conjunto dev, sus archivos de datos y que el extra del backend esté instalado

## `lint`

diagnostica un manifiesto de batería: registros débiles → causa más probable → palanca a accionar a continuación; cada advertencia que mt-eval registró en el TestReport de la misma lectura (una salida casi constante, longitud, copias) es un hallazgo

**Argumentos:**

- `manifest` — json del manifiesto de batería (control: ci-scoring/battery); el de una exportación es `<export>/evaluation/battery-hyps-battery.json`

**Opciones:**

- `--json` — imprime exactamente un documento JSON en stdout (otra salida → stderr); errores como {"error": …}, salida 2
- `--run-manifest` — manifiesto de ejecución para señales de schedule/transfer-plateau

## `registry`

registro de conjunto de evaluación

### `registry add`

**Argumentos:**

- `name` — 
- `path` — 

**Opciones:**

- `--json` — imprime exactamente un documento JSON en stdout (otra salida → stderr); errores como {"error": …}, salida 2
- `--role` *(obligatorio)* (uno de: dev, test, sealed) — 
- `--source-field` — 
- `--target-field` — 
- `--note` — 
- `--allow-rotate` — reemplaza un conjunto ya registrado con NOMBRE por otro contenido/rol — registrado en el ledger junto con lo que reemplazó y con qué frecuencia se leyó ese contenido

### `registry list`

**Opciones:**

- `--json` — imprime exactamente un documento JSON en stdout (otra salida → stderr); errores como {"error": …}, salida 2

### `registry add-harness`

**Argumentos:**

- `dataset_id` — 

**Opciones:**

- `--json` — imprime exactamente un documento JSON en stdout (otra salida → stderr); errores como {"error": …}, salida 2
- `--role` (uno de: dev, test, sealed) — 
- `--yes` — acepta las solicitudes de obtención (fetch) del harness de forma no interactiva

## `split`

división de entrenamiento/desarrollo/prueba disjunta por grupo

**Argumentos:**

- `corpus` — 

**Opciones:**

- `--json` — imprime exactamente un documento JSON en stdout (otra salida → stderr); errores como {"error": …}, salida 2
- `--test` *(obligatorio)* — filas de prueba (test) a extraer (≥ 0). Utilice 0 cuando su conjunto de prueba sea un archivo SEPARADO (revisado por docentes o hablantes, privado): regístrelo con `registry add <name> <file> --role test` y extraiga solo train/dev
- `--dev` — filas de desarrollo (dev) a extraer (la selección de checkpoints se ejecuta en estas; el entrenamiento se rehúsa sin un conjunto dev)
- `--seed` *(obligatorio)* — 
- `--out` *(obligatorio)* — 
- `--source-field` — 
- `--target-field` — 
- `--register` — también registra PREFIX-test / PREFIX-dev en el espacio de trabajo
- `--allow-rotate` — con --register: reemplaza PREFIX-dev / PREFIX-test cuando ya están registrados con otro contenido (p. ej., al volver a dividir después de leak-audit --clean-to). La rotación se registra en el ledger junto con lo que reemplazó y con qué frecuencia se leyó ese contenido; sin la bandera, se rechaza una división en conflicto antes de escribir cualquier archivo
- `--near-dupe` — también mantiene los CASI duplicados en un solo lado (p. ej., 0.6): las filas cuyas palabras de origen o destino se superponen en ≥ este Jaccard se agrupan, de modo que las oraciones construidas sobre la misma plantilla/estructura nunca queden divididas entre train y test. Utilícelo cuando la división reporte filas de prueba con un casi gemelo en entrenamiento. Las plantillas pueden encadenarse en un único grupo enorme en un corpus pequeño basado en plantillas: cuando un lado recibiría muchas más filas de las solicitadas (más de 1.5x), split se rehúsa e indica qué hacer
- `--max-group` — con --near-dupe: limita los grupos compartidos de casi duplicados a N filas (los enlaces más fuertes primero), para que las plantillas que se encadenan no puedan formar un grupo gigante. Los grupos de duplicados exactos nunca se limitan. Los enlaces casi duplicados que queden sin cortar se contabilizan, y la verificación de casi gemelos de la división reporta los gemelos que cruzan de un lado a otro

## `verify-split`

verificación de cero superposición en archivos existentes

**Argumentos:**

- `sides` — archivos de entrenamiento/desarrollo/prueba (cualquier subconjunto)

**Opciones:**

- `--json` — imprime exactamente un documento JSON en stdout (otra salida → stderr); errores como {"error": …}, salida 2
- `--source-field` — 
- `--target-field` — 

## `leak-audit`

analiza un corpus frente a evaluaciones registradas — explica qué descartaría (respuestas exactas / casi duplicadas) y qué conserva a propósito (hermanos de plantilla; un prompt CASI duplicado con una respuesta diferente — un prompt IDÉNTICO se descarta), con ejemplos; determinista. Con un conjunto de prueba fijo, --drop-test-twins también descarta las filas de entrenamiento que sean casi gemelas de este

**Argumentos:**

- `corpus` — 

**Opciones:**

- `--json` — imprime exactamente un documento JSON en stdout (otra salida → stderr); errores como {"error": …}, salida 2
- `--strict` — falla de inmediato ante coincidencias en test/sealed
- `--clean-to` — escribe las filas sobrevivientes aquí (además de un manifiesto de auditoría junto a él)
- `--drop-test-twins` — con --clean-to: TAMBIÉN descarta las filas de entrenamiento que sean casi gemelas de una fila registrada en test/sealed (idéntica, o una superposición de palabras — Jaccard — ≥ 0.6 en el lado de origen o de destino: la métrica que utiliza la verificación de casi gemelos del puntaje de prueba), incluidos los hermanos de plantilla. Para un conjunto de prueba FIJO (escrito por docentes o hablantes, registrado — no extraído por split, por lo que split --near-dupe no puede ayudar) cuyas filas tienen en su mayoría una gemela en el entrenamiento: sin esto, el puntaje de prueba mide la memorización (recall) de frases de entrenamiento. Indica cuántas filas descarta y en qué se convierte el subconjunto estricto; se rehúsa a dejar el entrenamiento sin datos. También escribe la configuración del modelo libre de gemelos (--companion-config) e indica el comando que lo entrena
- `--companion-config` — con --drop-test-twins: dónde escribir la configuración del modelo libre de gemelos (predeterminado: config-notwins.json junto al config.json del proyecto) — la misma configuración con sus propios run_name, data.gold y eval.near_dupe_corpus establecidos en el archivo de --clean-to. Nunca se sobrescribe un archivo existente
- `--manifest` — ruta del manifiesto de auditoría sin contenido (predeterminado con --clean-to: <clean-to>.audit.json)
- `--overwrite` — permite que --clean-to reemplace un archivo que esté en uso: uno con el que se entrena la configuración de un proyecto (data.gold, un carril sintético, eval.near_dupe_corpus), uno con el que se entrenó una ejecución, el corpus del cual se extrajo una división registrada o la salida de una auditoría diferente (el corpus limpio con todos los datos frente al que no tiene gemelos). Se rechaza sin esta bandera
- `--full-indices` — --json: imprime cada lista de índices de fila completa (de forma predeterminada, cada lista con más de 5 muestra su recuento y los primeros 5; el archivo de auditoría escrito junto a --clean-to siempre los conserva completos)
- `--target-field` — 
- `--no-examples` — no cita las filas del corpus en la salida legible para humanos
- `--show-text` — imprime las oraciones del corpus incluso cuando el corpus (o el conjunto de evaluación con el que coincidió una fila) sea solo local, sellado (sealed) o requiera consentimiento; de lo contrario, se imprimen números de línea, identificadores y puntajes en su lugar. Solo para una persona en la terminal: un agente de IA que lea esta salida la enviará a su proveedor de modelos. La salida --json nunca incluye oraciones

## `sample`

muestra de depósito limitada por tipo

**Argumentos:**

- `corpus` — 

**Opciones:**

- `--json` — imprime exactamente un documento JSON en stdout (otra salida → stderr); errores como {"error": …}, salida 2
- `--n` *(obligatorio)* — 
- `--cap` — 
- `--key` — 
- `--seed` *(obligatorio)* — 
- `--out` *(obligatorio)* — 

## `ledger`

inspección de libro mayor de evaluación

### `ledger show`

**Opciones:**

- `--json` — imprime exactamente un documento JSON en stdout (otra salida → stderr); errores como {"error": …}, salida 2
- `--set` — reporte de gasto para un conjunto

### `ledger verify`

**Opciones:**

- `--json` — imprime exactamente un documento JSON en stdout (otra salida → stderr); errores como {"error": …}, salida 2

## `prereg`

preregistro

### `prereg template`

**Opciones:**

- `--json` — imprime exactamente un documento JSON en stdout (otra salida → stderr); errores como {"error": …}, salida 2
- `--out` — escribe la plantilla aquí
- `--force` — 

### `prereg new`

**Argumentos:**

- `id` — 

**Opciones:**

- `--json` — imprime exactamente un documento JSON en stdout (otra salida → stderr); errores como {"error": …}, salida 2
- `--eval-set` *(obligatorio)* — 
- `--predictions` *(obligatorio)* — un archivo .json que contiene un ARREGLO JSON de objetos de predicción — consulte `nmt-forge prereg template`
- `--author` — 
- `--config-hash` — vincula esta predicción a UNA configuración de ejecución: su hash completo de 16 caracteres (`nmt-forge preflight run --config <file>` lo imprime; el config_hash del manifiesto de ejecución). Solo una ejecución de exactamente esa configuración la vincula — cualquier edición de la configuración cambia el hash. Si no está vinculada, asigne a la prereg el nombre de su modelo y pase --prereg en export
- `--consequences` — 
- `--allow-after-reads` — prerregistra un NUEVO experimento en un conjunto de evaluación que ya tiene lecturas puntuadas (predicciones delta frente a líneas base conocidas). La anulación queda registrada en el ledger — nunca en silencio.

### `prereg check`

**Argumentos:**

- `id` — 

**Opciones:**

- `--json` — imprime exactamente un documento JSON en stdout (otra salida → stderr); errores como {"error": …}, salida 2
- `--results` — un directorio de exportación (lo que escribió `export`), su manifiesto de batería (eval/*-battery.json), su TestReport de mt-eval o un ScoreReport (score --json-out). Predeterminado: la exportación evaluada más reciente en el ledger que fue JUZGADA FRENTE A ESTA prereg (nunca simplemente la exportación más reciente de su conjunto de evaluación — con dos ejecuciones en un conjunto, ese sería el otro modelo)

### `prereg verdict`

**Argumentos:**

- `id` — el id de prerregistro

**Opciones:**

- `--json` — imprime exactamente un documento JSON en stdout (otra salida → stderr); errores como {"error": …}, salida 2
- `--prediction` *(obligatorio)* — el número de la predicción tal como lo imprime `prereg check` (#1 → 1), o su propio "id"
- `--held` — el resultado observado coincide con lo predicho
- `--missed` — el resultado observado no coincide con la predicción
- `--by` — quién juzgó (predeterminado: su nombre de usuario de inicio de sesión, registrado como tal)
- `--note` — por qué — p. ej., 'predicted 15-60, observed 100.00'
- `--revise` — reemplaza un veredicto anterior sobre esta predicción (ambos permanecen en el ledger; se muestra el más reciente)

## `score`

calificar hipótesis en un conjunto registrado (ICs siempre)

**Opciones:**

- `--json` — imprime exactamente un documento JSON en stdout (otra salida → stderr); errores como {"error": …}, salida 2
- `--eval-set` — 
- `--config` — ruta de run-config: controla la batería desde su bloque eval (batería registrada, agrupación, complementos, canonicalizador, vinculación de prereg) — un solo archivo, toda la evaluación
- `--hyps` *(obligatorio)* — 
- `--config-hash` — 
- `--metric` — carril a evaluar (repetible): chrf++, bleu, exact_match, comet, comet-qe, metricx (predeterminado: chrf++/bleu/exact_match)
- `--target-lang` — código de destino ISO 639-3 — resuelve el modelo de métrica neuronal correcto y su advertencia de bajos recursos
- `--plugin` — complemento de métrica con protocolo LYSS, 'module.path:ClassName' (repetible); sus agregados numéricos se convierten en carriles con CI
- `--card-plugins` — ejecuta la detección de complementos del harness para este idioma (evalMetrics de la ficha + validez FST + linters de comportamiento)
- `--override-respend` — 
- `--prereg` — el prerregistro contra el que se juzga esta ejecución (un id de `nmt-forge status`). Necesario cuando varios preregs vinculan el conjunto de prueba para esta ejecución (p. ej., dos modelos en un conjunto de prueba fijo): forge se rehúsa a adivinar. Sin él: el único prereg válido; de lo contrario, aquel al que se vinculó la primera lectura de prueba de esta ejecución; de lo contrario, el vinculado al config hash de esta ejecución
- `--json-out` — 
- `--show-text` — muestra las oraciones del corpus dentro de los mensajes de error (p. ej., el error de un complemento de métrica que cita una fila) incluso para corpus solo locales, sellados (sealed) o que requieren consentimiento; de lo contrario dicen [sentence withheld]. Este comando no imprime oraciones en ningún otro caso. Solo para una persona en la terminal: un agente de IA que lea esta salida la enviará a su proveedor de modelos

## `compare`

A/B en un conjunto registrado (restringido por prereg) — con la advertencia de casi gemelos de cada sistema (una victoria por memorización de frases de entrenamiento se reporta como tal) y las advertencias de puntaje que mt-eval registró en la exportación que produjo sus hipótesis

**Opciones:**

- `--json` — imprime exactamente un documento JSON en stdout (otra salida → stderr); errores como {"error": …}, salida 2
- `--eval-set` *(obligatorio)* — 
- `--hyps-a` *(obligatorio)* — hipótesis del sistema A: la de una exportación es `<export>/evaluation/battery-hyps.jsonl` (el `hypotheses` del resumen de exportación)
- `--hyps-b` *(obligatorio)* — hipótesis del sistema B (igual que --hyps-a)
- `--label-a` — 
- `--label-b` — 
- `--run-a` — el run-manifest.json del modelo del sistema A: sus archivos de entrenamiento se comprueban en busca de casi gemelos del conjunto de evaluación (la métrica que reporta export), para que una victoria por memorización se reporte como tal. Sin él, las hipótesis que escribió una exportación (<export>/evaluation/battery-hyps.jsonl) se hacen coincidir con la lectura de esa exportación; cualquier otra cosa se reporta como no verificada
- `--run-b` — lo mismo para el sistema B
- `--config-hash` — 
- `--metric` — carril a comparar (repetible; predeterminado chrf++) — incl. comet/comet-qe/metricx
- `--target-lang` — 
- `--plugin` — complemento de métrica con protocolo LYSS (repetible)
- `--card-plugins` — detección de complementos del harness para este idioma
- `--override-respend` — 
- `--prereg` — el prerregistro contra el que se juzga esta ejecución (un id de `nmt-forge status`). Necesario cuando varios preregs vinculan el conjunto de prueba para esta ejecución (p. ej., dos modelos en un conjunto de prueba fijo): forge se rehúsa a adivinar. Sin él: el único prereg válido; de lo contrario, aquel al que se vinculó la primera lectura de prueba de esta ejecución; de lo contrario, el vinculado al config hash de esta ejecución
- `--show-text` — muestra las oraciones del corpus dentro de los mensajes de error (p. ej., el error de un complemento de métrica que cita una fila) incluso para corpus solo locales, sellados (sealed) o que requieren consentimiento; de lo contrario dicen [sentence withheld]. Este comando no imprime oraciones en ningún otro caso. Solo para una persona en la terminal: un agente de IA que lea esta salida la enviará a su proveedor de modelos

## `synth`

ejecutar la síntesis de un paquete de idioma

**Argumentos:**

- `pack` — una especificación 'module.path:get_pack' (p. ej. nmt_forge_crk.pack:get_pack) o el nombre del punto de entrada de un paquete instalado (p. ej. crk)

**Opciones:**

- `--json` — imprime exactamente un documento JSON en stdout (otra salida → stderr); errores como {"error": …}, salida 2
- `--out` *(obligatorio)* — 
- `--seed` — 
- `--limit` — 

## `run`

ejecución de entrenamiento reproducible de un solo comando

**Argumentos:**

- `config` — 

**Opciones:**

- `--json` — imprime exactamente un documento JSON en stdout (otra salida → stderr); errores como {"error": …}, salida 2
- `--show-text` — muestra las oraciones del corpus dentro de los mensajes de error (p. ej., el error de un complemento de métrica que cita una fila) incluso para corpus solo locales, sellados (sealed) o que requieren consentimiento; de lo contrario dicen [sentence withheld]. Este comando no imprime oraciones en ningún otro caso. Solo para una persona en la terminal: un agente de IA que lea esta salida la enviará a su proveedor de modelos

## `evaluate`

cerrar el bucle: decodificar la batería de la configuración con el punto de control SELECCIONADO de la ejecución, calificarlo (ICs, controlado por preregistro) y autodiagnosticar — sin decodificación manual

**Argumentos:**

- `run_manifest` — run-manifest.json escrito por `nmt-forge run`

**Opciones:**

- `--json` — imprime exactamente un documento JSON en stdout (otra salida → stderr); errores como {"error": …}, salida 2
- `--config` — ruta de run-config (de forma predeterminada, la configuración incrustada en el manifiesto de ejecución); debe contener un bloque eval
- `--out-hyps` — dónde escribir las hipótesis de batería decodificadas (predeterminado: junto al manifiesto de ejecución)
- `--harness-out` — también escribe un RunLog + TestReport de mt-eval aquí (generados por el harness a partir de esta misma lectura; contienen el texto del conjunto de evaluación)
- `--glossary` — un glosario de evaluación para la métrica de terminología del reporte de mt-eval: JSON {"source term": "translation" o ["accepted", "forms"]} (o el "dictionary" de un archivo de coaching) — lo que acepta `mt-eval run --glossary`. Es únicamente una entrada de puntuación: el modelo nunca lo ve. Anula eval.glossary de la configuración
- `--prereg` — el prerregistro contra el que se juzga esta ejecución (un id de `nmt-forge status`). Necesario cuando varios preregs vinculan el conjunto de prueba para esta ejecución (p. ej., dos modelos en un conjunto de prueba fijo): forge se rehúsa a adivinar. Sin él: el único prereg válido; de lo contrario, aquel al que se vinculó la primera lectura de prueba de esta ejecución; de lo contrario, el vinculado al config hash de esta ejecución
- `--show-text` — muestra las oraciones del corpus dentro de los mensajes de error (p. ej., el error de un complemento de métrica que cita una fila) incluso para corpus solo locales, sellados (sealed) o que requieren consentimiento; de lo contrario dicen [sentence withheld]. Este comando no imprime oraciones en ningún otro caso. Solo para una persona en la terminal: un agente de IA que lea esta salida la enviará a su proveedor de modelos

## `export`

evalúa la ejecución en su batería de prueba (restringido por prereg) Y empaquétela: model/ (en el directorio --out) es el modelo desplegable — pesos, tokenizador, forge-model.json, DEPLOY.md, manifiesto de complemento de champollion, sin oraciones de prueba; evaluation/ junto a él contiene el reporte de batería y el RunLog + TestReport de mt-eval — sus oraciones de prueba, nunca desplegadas

**Argumentos:**

- `run_manifest` — run-manifest.json escrito por `nmt-forge run`

**Opciones:**

- `--json` — imprime exactamente un documento JSON en stdout (otra salida → stderr); errores como {"error": …}, salida 2
- `--out` *(obligatorio)* — directorio de exportación (nuevo/vacío); recibe model/ y evaluation/
- `--config` — ruta de run-config (predeterminado a la configuración incrustada)
- `--no-eval` — empaqueta sin puntuar la batería de prueba (p. ej., un conjunto sellado ya agotado)
- `--no-model` — escribe solo la evaluación y el reporte de mt-eval
- `--glossary` — un glosario de evaluación para la métrica de terminología del reporte de mt-eval: JSON {"source term": "translation" o ["accepted", "forms"]} (o el "dictionary" de un archivo de coaching) — lo que acepta `mt-eval run --glossary`. Es únicamente una entrada de puntuación: el modelo nunca lo ve. Anula eval.glossary de la configuración
- `--endpoint` — URL a la que apunta el manifiesto del complemento de champollion (predeterminado http://127.0.0.1:<port>/translate)
- `--port` — 
- `--name` — nombre del complemento/modelo (en kebab-case; predeterminado nmt-forge-<run>)
- `--force` — reemplaza un directorio --out que no esté vacío
- `--prereg` — el prerregistro contra el que se juzga esta ejecución (un id de `nmt-forge status`). Necesario cuando varios preregs vinculan el conjunto de prueba para esta ejecución (p. ej., dos modelos en un conjunto de prueba fijo): forge se rehúsa a adivinar. Sin él: el único prereg válido; de lo contrario, aquel al que se vinculó la primera lectura de prueba de esta ejecución; de lo contrario, el vinculado al config hash de esta ejecución
- `--show-text` — muestra las oraciones del corpus dentro de los mensajes de error (p. ej., el error de un complemento de métrica que cita una fila) incluso para corpus solo locales, sellados (sealed) o que requieren consentimiento; de lo contrario dicen [sentence withheld]. Este comando no imprime oraciones en ningún otro caso. Solo para una persona en la terminal: un agente de IA que lea esta salida la enviará a su proveedor de modelos

## `serve`

sirve un modelo exportado: contrato de API de champollion (POST /translate) + /v1/chat/completions compatible con OpenAI; se vincula a 127.0.0.1

**Argumentos:**

- `export_dir` — el directorio del modelo que escribió `nmt-forge export` (model/ en su directorio --out), o el propio directorio de exportación

**Opciones:**

- `--json` — imprime exactamente un documento JSON en stdout (otra salida → stderr); errores como {"error": …}, salida 2
- `--host` — dirección de enlace (bind address) (cualquiera que no sea de bucle invertido/loopback requiere un token)
- `--port` — puerto en el que escuchar (predeterminado 8378); si está en uso, elija otro y apunte el endpoint de champollion hacia él
- `--token` — token de portador (bearer token) que los clientes deben enviar (predeterminado $NMT_FORGE_SERVE_TOKEN; obligatorio fuera de loopback)
- `--device` (uno de: auto, cpu) — 
- `--no-hook` — sirve SIN el hook de decodificación de la ejecución (reportado en /health y en cada respuesta)
- `--allow-locale` — también acepta este código de configuración regional (repetible) — p. ej., --allow-locale en:crk cuando la exportación no pudo resolver los alias de la ficha sin conexión
- `--choose` — también registra esta exportación como la opción de despliegue del USUARIO (como lo hace `nmt-forge choose`). Sin esto, una instancia de serve se registra como servida — una prueba — nunca como la elección

## `choose`

registra la elección de despliegue del usuario entre varias exportaciones — la que luego nombra `nmt-forge status`. Servir un modelo nunca la registra

**Argumentos:**

- `model_dir` — el directorio del modelo de la exportación elegida (model/ en su directorio --out)

**Opciones:**

- `--json` — imprime exactamente un documento JSON en stdout (otra salida → stderr); errores como {"error": …}, salida 2
- `--note` — motivo (conservado en el ledger), p. ej., 'chosen by the clinical lead, 2026-10-04'

## `monitor`

conecta la interfaz gráfica (GUI) orientada a personas a un directorio de ejecución en curso (o finalizada): curvas de pérdida + piso + un botón de detención llamativo; de solo lectura en caso contrario (las nuevas ejecuciones la abren automáticamente)

**Argumentos:**

- `run_dir` — el directorio de ejecución bajo <ws>/runs/

**Opciones:**

- `--json` — imprime exactamente un documento JSON en stdout (otra salida → stderr); errores como {"error": …}, salida 2
- `--pid` — id del proceso de entrenamiento — permite que el botón de detención elimine realmente una ejecución acoplada
- `--log` — el registro de stdout del entrenador — hace que el panel funcione en vivo desde el minuto uno (pérdida en cada paso de registro + tasa/ETA) en lugar de esperar al primer volcado de checkpoints
- `--port` — 
- `--no-browser` — 

## `report`

re-renderizar el informe en lenguaje natural desde un manifiesto de ejecución o batería

**Argumentos:**

- `manifest` — 

**Opciones:**

- `--json` — imprime exactamente un documento JSON en stdout (otra salida → stderr); errores como {"error": …}, salida 2
