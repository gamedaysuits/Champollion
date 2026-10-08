---
slug: /build-mt-for-your-language
title: "Construya traducción automática para su idioma"
description: "Desde «¿por dónde empezamos?» hasta un flujo de trabajo de traducción probado: encuentre lo que existe, proteja su conjunto de pruebas, evalúe las opciones, construya algo mejor, demuéstrelo e impleméntelo, con los comandos exactos y las llamadas a herramientas MCP para cada paso."
---

# Construya traducción automática para su idioma

Esta página le lleva de *"queremos traducción para nuestro idioma, ¿cómo
empezamos?"* a un flujo de trabajo de traducción que ha **medido en sus propias
oraciones** y puesto a funcionar. Está escrita tanto para personas como para agentes de IA: cada
paso indica el comando a ejecutar y, cuando existe, la
[herramienta MCP](/docs/network/getting-started/mcp-server) a la que un agente llama en su lugar.

Dos ejemplos continuos:

- **Una escuela** quiere inglés → Plains Cree para su boletín y una pequeña aplicación.
  Los profesores han revisado unos cientos de oraciones y desean mantenerlas privadas.
- **Un hospital** quiere inglés → un idioma que el índice apenas cubre, para una
  guía de frases de cabecera. Sus oraciones de prueba contienen redacción clínica y nunca
  deben enviarse a un servicio externo de IA.

Terminará con: un conjunto de prueba privado, puntuaciones de varios métodos en él, un
método mejor (un modelo guiado o uno que usted mismo entrenó) y ese método desplegado
mediante la CLI, con cada cifra trazable a lo que la produjo.

:::info[Lo que esto no hace]
Nada de lo que aquí se muestra hace que una traducción sea correcta. Las puntuaciones le dicen qué opción es
*menos errónea en sus oraciones*; un hablante fluido sigue decidiendo qué es apto para
su uso. Lea [Limitaciones honestas](/docs/network/honest-limitations) antes de
confiar en cualquier cifra.
:::

:::warning[Agentes: antes de abrir cualquiera de los archivos del usuario]
Si un conjunto de prueba pudiera ser privado (revisado por profesores, revisado por enfermeros, cualquier contenido que
una comunidad no haya publicado), no lo lea: nada de `cat`, `head` ni vista previa,
ni siquiera para ver su formato. Lo que usted lee se envía a su proveedor de modelos. Pregunte
al usuario y márquelo primero como solo local ([paso 2](#2-gather-your-data--and-protect-your-test-set)).
:::

## 0. Instalación

```bash
npm install -g champollion        # translate + deploy        (Node 20.11+)
python3 -m pip install mt-eval-harness       # measure                   (Python 3.11+)
python3 -m pip install 'nmt-forge[hf]'       # train a model (optional; a CPU is enough to start)
```

Para un agente, agregue el servidor MCP a su configuración:

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

## 1. Averigüe qué existe

Qué se sabe ya sobre el idioma: diccionarios, gramáticas, corpus,
analizadores (FST), modelos, resultados publicados, servicios, y de dónde
proviene cada dato.

```bash
champollion network card crk                 # the cited language card
champollion network recommend eng crk        # methods you can run, with the evidence for each
mt-eval corpora --source eng --target crk   # registered test sets for the pair
nmt-forge discover crk               # what a training project can use
```

**Agente:** `search_languages { "query": "Atya" }` encuentra el código incluso a partir de un
error ortográfico (nombres más cercanos por distancia de edición). Cada resultado muestra dónde se
habla el idioma solo cuando su ficha cita una fuente para ello, y muestra dicha
fuente, de modo que el usuario pueda elegir entre idiomas con nombres similares. Nunca se
muestra una ubicación sin fuente: la línea lo indica y, en su lugar, enlaza al registro del idioma
en Glottolog, donde los candidatos pueden compararse directamente en la fuente.
Desde una instalación de npm, un idioma fuera del conjunto principal incluido se completa a partir
de las tablas de fichas publicadas en champollion.dev, las cuales aún no incluyen fuentes por campo
(llegarán con la próxima actualización de las tablas), por lo que su línea contiene el enlace a Glottolog
en vez de una ubicación. Cuando nada de lo mostrado permite distinguir a los candidatos,
los hablantes deciden (más adelante). Luego, `language_overview { "code": "<code>" }` ofrece una
sola página: qué existe, qué evaluaciones comparativas (benchmarks) y resultados hay, y los siguientes
pasos numerados. Cualquier herramienta que acepte un idioma también lo admite como `language`.

Lea la ficha tal como está escrita: **la ausencia significa desconocido, no cero.** Una
ficha que no incluya ningún diccionario significa que el índice no ha registrado ninguno, no que
no exista ninguno. Donde las fuentes discrepan (el número de hablantes suele hacerlo), la ficha muestra
todas ellas.

Si su idioma no tiene ficha en absoluto, aun así puede hacer todo lo que se describe a continuación; las
herramientas simplemente sabrán menos sobre él (`nmt-forge init <code> --no-card --name <name>`
inicia un proyecto de entrenamiento de todos modos).

### Cuando la variedad aún no está confirmada

Un nombre puede corresponder a varios idiomas. "Ayta", por ejemplo, coincide con seis
idiomas ayta de Filipinas, cada uno con su propio código. **Pregunte primero a los hablantes.**
La comunidad sabe qué variedad habla, y un código elegido por ellos constituye una afirmación sobre ellos.

Si debe comenzar antes de que puedan responder, use un código de uso privado: ISO 639
reserva de `qaa` a `qtz` exactamente para esto. Asígnele un nombre para mostrar, para que los prompts e
informes nombren el idioma:

```bash
champollion init --yes --langs qaa --name qaa="Ayta (variety not yet confirmed)"
```

lo cual escribe, en `champollion.config.json`:

```json
"languages": { "qaa": { "name": "Ayta (variety not yet confirmed)" } }
```

`init` indica que el código es de uso privado y no tiene ficha de idioma (no
le pide verificar la ortografía).

`init`, `sync`, `verify` y `network register-corpus` aceptan un
código de uso privado. Lo que esto le cuesta, hasta que el código real lo reemplace:

- **Sin datos de la ficha.** Sin ajustes preestablecidos de registro, reglas de plural ni sistema de escritura de una
  ficha de idioma. Sync utiliza configuraciones genéricas, así que revise los primeros resultados con un
  hablante.
- **Sin FST.** No hay ningún analizador morfológico asociado a un código de uso privado, por lo que
  nada se verifica palabra por palabra.
- **Sin resultados previos.** Las evaluaciones comparativas publicadas y la cola se indexan mediante códigos
  reales, por lo que `recommend` y `corpora` no tienen nada que mostrar al respecto.

Cuando la comunidad confirme la variedad, cambie a su código:

1. En `champollion.config.json`, reemplace `qaa` por el código (y elimine la línea
   `name` si el nombre de la ficha encaja).
2. Cambie el nombre de los archivos de configuración regional (`messages/qaa.json` → `messages/ayt.json`). Las
   traducciones siguen siendo válidas: la siguiente ejecución de `champollion sync` las conserva y
   traduce solo lo que sea nuevo.
3. Registre nuevamente el conjunto de prueba con el par real:
   `champollion network register-corpus --pair "eng>ayt" --data <file> --role test …`.
   El comando imprime el `--id` a pasar, ya que un archivo registrado conserva su
   id a menos que elija uno nuevo. (`--pair` acepta `eng-ayt` o `"eng>ayt"`
   aquí y en `nmt-forge init`; entrecomille la forma `>`, ya que una shell interpreta un
   `>` sin entrecomillar como "escribir en un archivo").

## 2. Reúna sus datos y proteja su conjunto de prueba

**Separe primero el conjunto de prueba.** Aparte las oraciones con las que
juzgará todo (las revisadas por profesores, las revisadas por enfermeros) antes de
entrenar o ajustar nada, y nunca entrene con ellas.

Un conjunto de prueba es un archivo TSV: un par de oraciones por línea, fuente, un TAB y luego la
traducción de referencia. Las líneas que comienzan con `# ` son comentarios.

```text
# teacher-checked, 2026 term 1
The library opens at nine.	<the teacher's translation>
```

Luego decida hasta dónde puede circular:

| Si usted desea… | Haga esto |
|---|---|
| Que nada salga de esta máquina: ningún servicio externo de IA puede ver jamás estas oraciones | Coloque un archivo marcador junto a él (más abajo). Solo se podrá probar contra él un modelo en su propia máquina. |
| Que otros puedan ver que el conjunto de prueba existe, pero nunca su contenido | `champollion network register-corpus --tier private --role test …` registra únicamente los metadatos |
| Una competencia sobre él, ejecutada en una máquina que usted controla, posiblemente aislada (air-gapped) | `--tier sealed` junto con el [nodo soberano](/docs/network/sovereignty/sovereign-eval-node) |
| Que sea público y con licencia abierta | `--tier public` apunta a su ubicación; aun así, nunca lo alojamos nosotros |

El marcador para "nunca sale de esta máquina":

```bash
echo '{"transmission": "local-only"}' > data/nurse_checked_test.tsv.champollion.json
```

Con este en su lugar, `mt-eval run` rechaza cualquier proveedor remoto para ese archivo
y se ejecuta únicamente contra un modelo en loopback. Detalles:
[Registro de corpus](/docs/network/sovereignty/registering-corpora).

**Qué id de licencia.** El registro solicita `--license`: los términos que los
propietarios de los datos realmente otorgan, nunca un valor provisional. Pregúnteles y luego elija el id que
lo exprese: un id de SPDX si ya publican el texto bajo una;
`community-eval-grant-nc` para "solo para puntuar sistemas, nunca entrenar, nunca
compartir, sin evaluación de pago"; `community-eval-grant` para lo mismo con evaluación
de pago permitida; `proprietary` para todos los derechos reservados; o
`LicenseRef-<name>` para términos propios de ellos. Los últimos cuatro son ids
`LicenseRef-…`, concesiones a medida: la evaluación remota contra ellos se rechaza hasta que el
administrador de datos (steward) registre el permiso. Hasta que el administrador
lo confirme, registre su elección como provisional. Solo local sigue siendo local sin importar
la licencia: el marcador, no la licencia, decide a dónde van las oraciones.
[Qué id de licencia usar para un conjunto de prueba privado](/docs/network/sovereignty/registering-corpora#which-licence-id-for-a-private-test-set).

**Agentes: no lean un archivo de prueba marcado como solo local.** Nada de `cat`, `head` ni abrirlo
para echar un vistazo. Lo que usted lee va a su proveedor de modelos, que es
el lugar al que el marcador indica que estas oraciones no deben ir. No es necesario: las
herramientas excluyen sus oraciones de lo que imprimen (`mt-eval compare` muestra ids de entradas
y puntuaciones en su lugar), y `--show-text` está allí solo para una persona en la
terminal.

**Agente:** `language_overview { "code": "<code>" }` enumera las opciones de protección para el idioma;
`run_benchmark` respeta el marcador y devuelve un rechazo (con el motivo)
en lugar de enviar oraciones protegidas fuera.

### Si piensa entrenar un modelo más adelante: registre, filtre y prediga antes de obtener cualquier puntuación

Haga estas tres cosas ahora, en este orden, antes de que el paso 3 mida cualquier cosa en
el conjunto de prueba. Forge cuenta cada acceso a un conjunto de prueba, y una evaluación comparativa (paso 3)
es una lectura de puntuación: un preregistro escrito después de una es rechazado. El orden
importa; hacerlo más tarde no es lo mismo.

1. **Registre el conjunto de prueba con NMT Forge.** Su registro de lecturas comienza aquí, por lo que
   cada lectura posterior se contabiliza (una lectura de puntuación antes del registro se lista,
   pero no se contabiliza).
2. **Filtre su corpus de entrenamiento contra él** (`leak-audit`). Esto lee el
   conjunto de prueba para una auditoría, nunca para una puntuación, por lo que no cuenta para sus
   predicciones. Lea su veredicto: si la mayoría de las filas de prueba tienen una casi idéntica (near-twin) en su
   corpus, un modelo entrenado con todos los datos puntuará memorización de frases de entrenamiento,
   no traducción. En ese caso, por lo general entrenará dos modelos: uno con todos los
   datos y otro libre de duplicados (`--drop-test-twins` escribe su corpus y su
   configuración, `config-notwins.json`).
3. **Ponga por escrito lo que espera, un preregistro por modelo que planee
   entrenar**, nombrado según el modelo. Estas predicciones son contra las que se
   juzgarán las puntuaciones de prueba más adelante: la exportación juzga cada modelo frente al
   que usted especifique con `--prereg <id>` (si hay dos en un mismo conjunto de prueba, se niega
   a adivinar). En su lugar, puede vincular una predicción a la configuración de su modelo con
   `--config-hash <hash>`, el hash completo que imprime
   `nmt-forge preflight run --config config-notwins.json`. Cualquier edición
   posterior de esa configuración (por ejemplo, un límite de tiempo) cambia el hash y elimina la
   vinculación, por lo que nombrar el preregistro al exportar es el camino más simple.

```bash
nmt-forge init crk --dir school-crk
cd school-crk
nmt-forge registry add project-test ../data/test.tsv --role test
nmt-forge leak-audit ../data/corpus.tsv --clean-to corpus.clean.jsonl
nmt-forge prereg template --out predictions.json      # edit it: what you expect, and why
nmt-forge prereg new all-data --eval-set project-test --predictions predictions.json
cd ..                                                 # step 3 runs from here
```

Si el veredicto fue SEVERE, agregue el modelo libre de duplicados y sus propias predicciones
(en `school-crk/`):

```bash
nmt-forge leak-audit ../data/corpus.tsv --clean-to corpus.notwins.jsonl --drop-test-twins
nmt-forge prereg new notwins --eval-set project-test --predictions predictions-notwins.json  # your edited copy
```

El corpus libre de duplicados obtiene su propio archivo. `corpus.clean.jsonl` sigue siendo el
corpus con todos los datos: leak-audit se niega a sobrescribir un archivo que lea una configuración, una
ejecución o una división (split), o que otra auditoría haya escrito (`--overwrite` reemplaza
uno a propósito). Su respuesta en `--json` enumera los primeros números de fila de
cada lista; el archivo `.audit.json` junto al corpus limpio los conserva todos.

`--allow-after-reads` existe solo para predicciones que realmente se asentaron por
escrito antes de las lecturas (en papel, por ejemplo). Queda registrado, y cada informe,
export and DEPLOY.md then says the predictions came after the scores.

**Agente:** `forge_init { "code": "<code>", "dir": "<dir>" }`, luego
`forge_register_eval { "name": "project-test", "path": "../data/test.tsv", "role": "test", "project_dir": "<dir>" }`,
`forge_leak_audit { "corpus": "../data/corpus.tsv", "clean_to": "corpus.clean.jsonl", "project_dir": "<dir>" }`
(las rutas se leen desde `project_dir`, ya que los comandos anteriores se ejecutan desde
dentro del proyecto; una ruta absoluta funciona en cualquier lugar),
luego `forge_prereg_template` → `forge_prereg { id, eval_set, predictions }`
con el usuario, una por modelo, cada una nombrada según su modelo (`forge_export`
luego toma ese id como `prereg`; `config_hash` en `forge_prereg` vincula una a
su configuración en su lugar). `forge_status` indica este paso tan pronto como se
registra un conjunto de prueba. El paso 4 entrena en el mismo proyecto.
`language_overview` enumera estos pasos también en este orden.

## 3. Mida las opciones

Ejecute cada candidato contra **su** conjunto de prueba (registrado, filtrado y
preregistrado primero con forge, si piensa entrenar más adelante;
[paso 2](#2-gather-your-data--and-protect-your-test-set)). El entorno de evaluación (harness) puntúa cada uno de la
misma manera, del modo en que el campo reporta la evaluación de traducción automática: la métrica principal es
chrF++ de corpus con su intervalo de confianza del 95 %, junto con BLEU, spBLEU y TER
(nunca combinados en una sola cifra). La coincidencia exacta y las comprobaciones de comportamiento
(salida en alfabeto erróneo, señales de alucinación) se notifican como diagnósticos,
junto con el costo y la velocidad. Donde el entorno tenga un analizador morfológico
fijado para el idioma, agrega la aceptación por FST y la precisión morfológica como
diagnósticos;
`mt-eval setup --status` enumera esos idiomas, y `mt-eval setup --comet`
agrega COMET donde corresponda.

```bash
# a hosted model (needs OPENROUTER_API_KEY); --max-cost stops before spending more
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider openrouter --model google/gemini-3.8-flash \
  --max-cost 1 -n gemini-3.8-flash -o results

# a model on your own machine (Ollama, llama.cpp, vLLM — anything OpenAI-compatible)
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider local --base-url http://127.0.0.1:11434/v1 \
  --model llama3.1 -n local-llama -o results

mt-eval compare results/*_report.json --significance
```

`compare` indica si una diferencia es real o está dentro del ruido (aleatorización aproximada pareada).
Una diferencia dentro de los intervalos de confianza no constituye una clasificación.
Escribe `comparison-<hash>.json`, nombrado según las ejecuciones que compara, junto a los informes
cuando comparten una carpeta, o en una carpeta `comparisons/` superior cuando no lo hacen,
nunca dentro de la carpeta propia de una ejecución. Otra comparación jamás lo sobrescribe.

**Paquetes de evaluación.** Algunos idiomas declaran herramientas adicionales que sus métricas necesitan
(para Plains Cree, un analizador morfológico). El primer `mt-eval run` indica
lo que falta. Un analizador faltante nunca detiene la ejecución: la aceptación por FST se
marca como no calculada, `mt-eval setup --lang crk` lo instala (una vez por
máquina) y luego `mt-eval test <run log>` agrega la puntuación sin
volver a traducir.

**Agente:** `run_benchmark { "corpus": "data/test.tsv", "provider": "local",
"base_url": "http://127.0.0.1:11434/v1", "model": "llama3.1",
"target_language": "crk" }` plans first and runs only with `confirm: true`;
`get_run_status { "job_id": "<id>" }` devuelve las puntuaciones. No publica nada
a menos que usted pase `publish: true`. Un código como `target_language` se nombra a partir de su
ficha de idioma ("Plains Cree") antes de llegar al prompt, y el plan muestra
el prompt que recibirá el modelo. Un archivo de entrenamiento guiado (coaching) reemplaza ese prompt, y el
plan lo indica. Cuando la ficha enumera dos sistemas de escritura y usted no pasa ningún `script`, el
plan lee qué sistema de escritura usan las referencias (letras contadas en su máquina,
sin mostrar oraciones) y solicita ese. Sus informes se guardan junto al archivo de
prueba, en `data/results/mcp-run-<id>/`, con la caché de traducción del entorno en
`data/results/cache/`. `get_run_status` imprime el comando `mt-eval compare`
para ellos, y para ejecuciones sobre un id de corpus registrado lista los informes por
ruta. Un plan de `local-model` indica primero cuánto descargará la confirmación y
dónde.

**En qué métrica confiar** depende del idioma:
`get_metric_reliability { "language": "<code>" }` (MCP) informa si alguna métrica automática ha sido
validada alguna vez frente a juicios humanos para dicho idioma. Para la mayoría de los
idiomas de bajos recursos ninguna lo ha sido, por lo que chrF++ es la convención: interprételo como una comparación
entre métodos sobre el mismo conjunto de prueba, no como una calificación.

## 4. Construya algo mejor

Dos caminos. Mida ambos de la misma manera que en el paso 3.

**Guíe un modelo general.** Proporciónele un glosario y directrices, y luego vuelva a ejecutar el paso 3
con la guía:

```bash
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider openrouter --model google/gemini-3.8-flash \
  --coaching-file coaching.json -n gemini-coached -o results
```

`--coaching-file` acepta Markdown, texto plano o JSON; el texto completo del archivo son
las instrucciones del modelo, enviadas tal como están escritas.

Para puntuar la terminología (¿aparece cada término listado con su traducción
requerida?), proporcione a cada ejecución que compare la misma lista de términos con
`--glossary terms.json` (`{"blood pressure": "…"}`, o una lista de formas aceptadas
por término). El glosario solo se utiliza para la puntuación; nunca se envía al
modelo, por lo que una ejecución básica y una guiada se puntúan sobre los mismos términos.
Sin `--glossary`, se utiliza en su lugar el `dictionary` de un archivo de guía en JSON
(el formato de [prompting guiado](/docs/network/tutorials/coached-llm-prompting):
`grammar_rules`, `dictionary`, `style_notes`). En
ese caso, la ejecución se puntúa contra su propia guía, y la salida lo
indica. Un archivo de guía en Markdown orienta de la misma manera pero no proporciona ningún glosario.

Consulte [prompting guiado](/docs/network/tutorials/coached-llm-prompting) y
[prompting aumentado con diccionario](/docs/network/tutorials/dictionary-augmented-llm).

**Entrene su propio modelo** con NMT Forge, que rechaza los errores que hacen que los
resultados con pocos datos parezcan mejores de lo que son (filtración de oraciones de prueba, malas
divisiones, elección del punto de control sobre el conjunto de prueba, interpretar el ruido como progreso):

```bash
cd school-crk     # after step 2: registered, screened, preregistered
nmt-forge split corpus.clean.jsonl --test 0 --dev 100 --seed 42 --out data/split --register project
nmt-forge preflight run --config config.json          # every check run makes, with fixes
nmt-forge run config.json
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg all-data --out export/
```

`preflight run` realiza las comprobaciones que `run` hace antes de entrenar: el conjunto de desarrollo (dev),
la auditoría de filtraciones de cada archivo de entrenamiento, la longitud de decodificación; de modo que una ejecución
que apruebe no sea rechazada al inicio. `config.json` lee la división desde
`data/split/`; una división escrita en otra parte indica qué líneas cambiar.

Los pares de entrenamiento van en un TSV como el conjunto de prueba (o JSONL con `source` y
`target`); `leak-audit` (paso 2) descartó cualquiera que pudiera filtrar el conjunto de prueba
al entrenamiento y explicó cada uno. ¿Dos modelos? Después de la división, ejecute de nuevo la auditoría
de filtraciones libre de duplicados del paso 2 (con el conjunto de desarrollo registrado, sus filas
también salen del archivo libre de duplicados), luego `nmt-forge run config-notwins.json` y
export it to its own folder with `--prereg notwins`. `nmt-forge status` names
el comando siguiente en cualquier momento. El modelo predeterminado
se entrena en una CPU en cuestión de minutos; con 1–2 mil pares de oraciones, espere un chrF++
en torno a 5–30: aprende las frases y patrones de sus datos, no el
idioma en general. `export` puntúa el conjunto de prueba una vez y genera un informe de mt-eval,
de modo que el modelo entrenado se compara con todo lo del paso 3. Guía paso a
paso completa: [Entrene su primer modelo](/docs/network/getting-started/train-your-first-model).

**Agente:** `forge_status { "project_dir": "<dir>" }` primero y después de cada
paso; después de `forge_init`, `forge_register_eval`, `forge_leak_audit`
y `forge_prereg` del paso 2: `forge_split { corpus, test, seed, out }`,
`forge_preflight { "target": "run" }`, luego, tras `nmt-forge run` en una
terminal, `forge_export { run_manifest, out, prereg }`. Llame a
`get_training_guardrails` una vez antes de `forge_split`: enumera cada regla
que forge aplica y el error que dicha regla previene. El parámetro `register`
de `forge_split` acepta un prefijo o `true` (`project`), y `out` toma por defecto
`data/split`. Cada herramienta de forge posterior a
`forge_init` acepta el `project_dir` que esta devuelve. `get_training_guardrails`
(`topic` opcional) explica cada regla. Todos los argumentos de cada herramienta:
[Servidor MCP](/docs/network/getting-started/mcp-server#arguments).

## 5. Demuéstrelo: en privado o abiertamente

Sus puntuaciones son suyas. Nada se publica a menos que decida hacerlo.

```bash
mt-eval publish results/<run-id>_report.json --dry-run   # shows exactly what would leave, and what is withheld
mt-eval publish results/<run-id>_report.json --scores-only --prod
```

Un conjunto de prueba privado o solo local nunca sube sus oraciones; `--dry-run`
lo indica línea por línea. Para permitir que otros compitan en su conjunto de prueba sin
verlo jamás, organice una competencia en una máquina que usted controle: los participantes entregan su
método, este se ejecuta en su nodo y solo salen las puntuaciones. Las nuevas competencias ocultan todas
las puntuaciones hasta que la competencia cierra, para que nadie pueda ajustarse a su conjunto de prueba.
Consulte [Organizar una competencia soberana](/docs/network/sovereignty/run-a-sovereign-contest).
Para inscribir un modelo que usted entrenó en la competencia de otra persona, `DEPLOY.md` §6 en
su exportación nombra los archivos que componen la inscripción y el comando exacto
`mt-eval contest submit-model`.

**Agente:** `list_contests { "language": "<code>" }`, `get_contest { id }`;
`get_results { "target_language": "<code>" }` y `get_run_card { id }` para
la tabla pública.

## 6. Combine lo mejor

**Elija primero entre sus propias mediciones.** Todo lo que puntuó en su
conjunto de prueba es un informe de mt-eval: las líneas base y las ejecuciones guiadas de los pasos 3
y 4, y la exportación de cada modelo entrenado (`evaluation/runlog_report.json` en su
export folder). A terminal run with `-o results` writes to
`results/*_report.json`; una ejecución iniciada con el MCP `run_benchmark` escribe
junto al archivo de prueba, en `data/results/mcp-run-<id>/`). Compárelos todos a
la vez: el primer patrón glob para ejecuciones en terminal, el segundo para ejecuciones de agentes (use el
que coincida con sus ejecuciones; zsh se detiene ante un glob que no coincida con nada):

```bash
mt-eval compare results/*_report.json school-crk/export*/evaluation/runlog_report.json --significance
mt-eval compare data/results/mcp-run-*/*_report.json school-crk/export*/evaluation/runlog_report.json --significance
```

Una diferencia dentro de los intervalos de confianza no constituye una clasificación, y un
modelo entrenado cuyas filas de prueba tengan duplicados cercanos en sus datos de entrenamiento puntuó por
memorización: cite su cifra libre de duplicados a su lado (DEPLOY.md y
`nmt-forge report` indican cuál), junto con cualquier **advertencia de puntuación** (score caveat) que mt-eval
haya asociado a esa cifra. Una advertencia de *salida casi constante* (near-constant output, es decir, una entre pocas oraciones
asignada a muchas oraciones de prueba diferentes) significa que las salidas no se corresponden con las
entradas, cualquiera que sea la puntuación; forge la imprime junto a la puntuación en `export`,
`DEPLOY.md`, `status`, `report`, `compare` y `lint`. Con varios modelos exportados,
`nmt-forge status` enumera cada uno con su puntuación, puntuación libre de duplicados y advertencia,
y le pide elegir cuál desplegar. Registre la elección con
`nmt-forge choose <export>/model` (o `nmt-forge serve <export>/model
--choose`). Servir un modelo para probarlo se registra como servido, no como su
elección, por lo que `status` seguirá preguntando hasta que elija.

**Agente:** `forge_status { "project_dir": "<dir>" }` — en el
estado `choose-export`, muestre al usuario `result.advice.exports`, la puntuación
de cada exportación con su `score_caveats` y pregunte qué modelo desplegar; la respuesta del usuario se registra con `nmt-forge choose` en una
terminal. Un despliegue de prueba (provisional serve) no responde la pregunta. `forge_compare { eval_set, hyps_a, hyps_b }` compara en A/B dos
modelos de forge con la advertencia de duplicados cercanos de cada uno y las advertencias de puntuación de mt-eval junto al ganador;
el archivo de hipótesis de cada modelo es la ruta `hypotheses` que `forge_export` devuelve
(`<export>/evaluation/battery-hyps.jsonl`).

Luego mire más allá de sus propias ejecuciones. Diferentes métodos ganan para diferentes pares
y diferentes tipos de texto. La sección [Red](/docs/network/) enumera los
métodos y servicios que existen y la evidencia de cada uno: lo que se ha
publicado, no lo que usted midió:

```bash
champollion network recommend eng crk               # runnable methods + cited evidence for the pair
champollion network leaderboard --pair "eng>crk"     # published results for the pair
```

Un método publicado en la tabla de clasificación con su configuración puede instalarse
exactamente como fue evaluado: `champollion network leaderboard --install <method>
--apply` lo añade a su proyecto para ese par. La CLI configura un método
**por par de idiomas**, de modo que el cree del boletín
pueda usar su modelo entrenado mientras que el francés usa uno alojado. El encadenamiento de
métodos (por ejemplo, un modelo seguido de un verificador) se explica en
[modelos encadenados](/docs/network/tutorials/chained-models).

## 7. Úselo

Despliegue el método que midió, no uno diferente.

```bash
nmt-forge serve export/model                     # your trained model on http://127.0.0.1:8378
LOCAL_API_BASE=http://127.0.0.1:8378/v1 champollion sync --method local
```

Mientras se ejecuta, `nmt-forge status` muestra `serving` (verifica que el servidor
siga respondiendo); una vez que el servidor se detiene, vuelve a indicar el comando `serve`,
en el mismo puerto.

O, en el caso de un modelo alojado con guía, configúrelo en el par dentro de
`champollion.config.json`. De cualquier modo:

```bash
champollion init --langs crk     # detects your app's locale files
champollion sync                 # translates only what changed
champollion verify               # placeholders, scripts, key parity
```

**Lo que su propio modelo aún no puede hacer.** Un modelo pequeño entrenado con unos pocos
miles de oraciones aprende sus frases. A menudo daña marcadores de posición
(`{name}`), formas de plural y marcado, o convierte una etiqueta corta como "Inicio" en
una oración. La barrera de calidad (quality gate) rechaza esas salidas; no se escribe
nada dañado. Asigne al par un **método de reserva (fallback)** y esas cadenas pasarán a un segundo
método en la misma sincronización:

```json
"pairs": {
  "en:crk": {
    "method": "api",
    "endpoint": "http://127.0.0.1:8378/translate",
    "fallback": { "method": "llm-coached", "model": "google/gemini-3.8-flash" }
  }
}
```

Si ningún texto debe salir de sus máquinas, configure el fallback como un modelo que ejecute allí
también: `"fallback": { "method": "local", "model": "<your local model>" }` envía
a un servidor compatible con OpenAI en esta máquina (Ollama, llama.cpp, vLLM), con
un costo de API de $0. Un modelo alojado suele ser una segunda opinión más sólida; úselo
cuando el texto pueda enviarse a su proveedor.

Su modelo traduce todo lo que puede. El fallback recibe únicamente lo que la barrera
rechazó de él y los bloques de Markdown que omitió o dañó, y su
salida pasa por la misma barrera. `sync` imprime una línea `[FALLBACK]` por par con
los recuentos, y `champollion verify` lista cualquier cosa que ninguno de los métodos haya podido
traducir. Consulte [Método de reserva (fallback)](/docs/getting-started/configuration#fallback).

En cambio, para un caso puntual, traduzca solo esas cadenas de otra manera:

```bash
champollion sync --method llm-coached --redo keys:nav.home,greeting
```

…o a mano, o mediante un revisor con `champollion xliff export`. Y coloque
las cadenas propias de la aplicación en su conjunto de prueba: un modelo que puntúa bien en oraciones
de profesores aún puede equivocarse en "¿Dónde le duele?".

**Sistemas de escritura.** Si el idioma se escribe en más de un sistema de escritura
(Plains Cree: ortografía romana estándar y silábico), la CLI le pide que
elija antes de traducir. Establezca `"script"` para ese idioma en la configuración;
el mensaje enumera las opciones.

La memoria de traducción garantiza que una oración sin cambios nunca se pague dos veces,
y cambiar de modelo no vuelve a traducir todo. Intégrelo en su CI con
la [guía de CI/CD](/docs/guides/ci-cd). `export/model/DEPLOY.md` (del paso 4) contiene
la configuración exacta para un modelo entrenado, incluido el método `api` y
cómo exponerlo en una red de forma segura.

**Agente:** `translate { texts, source_language, target_language }` pasa
las cadenas por la misma canalización (pipeline). Agregue `method: "local"` y `base_url`, o
`method: "api"` y `endpoint`, para un modelo que usted mismo aloje, y `script`
para un idioma que se escriba en más de un sistema de escritura.

## Decisiones a lo largo del camino

| Decisión | Elija… | Cuándo |
|---|---|---|
| Dónde reside el conjunto de prueba | local-only | Es sensible o aún no ha consultado a las personas que lo redactaron |
| | private / sealed | Quiere que otros sepan que existe o compitan en él, sin ver su contenido |
| Guiar o entrenar | Guiar un modelo alojado | Tiene un glosario y poco texto paralelo, y los servicios externos son aceptables |
| | Entrenar con forge | Tiene algunos miles de pares o más, o los datos deben permanecer en sus máquinas |
| Publicar | Solo puntuaciones | Por defecto para cualquier cosa que usted no haya escrito directamente |
| | Nada | Siempre permitido: la medición es útil en privado |

## Cuánto cuesta

- Las herramientas son gratuitas para uso no comercial: una escuela, un hospital o
  clínica pública, una organización benéfica o un proyecto de investigación están cubiertos (la CLI, nmt-forge y el
  servidor MCP cuentan con licencia PolyForm Noncommercial 1.0.0; el entorno de evaluación es de código
  abierto, AGPL-3.0-or-later). [Quién puede usar esto](/docs/getting-started/who-may-use-this).
- Un modelo alojado cuesta lo que cobre su proveedor; `--max-cost` detiene una ejecución
  antes de que gaste más de lo que usted permita, y el informe muestra el costo por
  oración. Un modelo local no cuesta nada salvo el tiempo de su máquina.
- Entrenar el modelo predeterminado de forge solo requiere una CPU y unos minutos; los ajustes preestablecidos más grandes
  requieren una GPU.
