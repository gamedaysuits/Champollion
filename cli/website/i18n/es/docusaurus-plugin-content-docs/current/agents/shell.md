---
title: "Manejar los rieles desde la terminal"
slug: /agents/shell
description: "Cada paso de los rieles como un comando común: instalar, iniciar un proyecto, incorporar datos, registrar sus términos, entrenar y probar un modelo con nmt-forge, ejecutar las rondas de mejora, traducir y servir con mt-eval — además del modo sin conexión, las variables de entorno que leen las herramientas y los códigos de salida."
---

# Conducir los rieles desde la terminal

Cada paso en los rieles es un comando común y corriente. Un agente sin MCP —o una
persona frente a una terminal— recorre los mismos rieles con tres programas:
`champollion`, `nmt-forge` y `mt-eval`. No hace falta recordar el orden:
`champollion next` indica el siguiente paso, con su modo y el comando
exacto, leídos a partir de los archivos del proyecto.

Las reglas son las mismas que mediante MCP. Un paso `confirm` se ejecuta solo después de que
la persona dé su confirmación; las respuestas de un paso `ask_user` le pertenecen a ella
([el contrato](/docs/agents/contract)).

## Instalación

```bash
npm install -g champollion                  # Node.js 20.11 or newer
uv tool install --python 3.12 nmt-forge     # brings mt-eval (mt-eval-harness) with it
```

**Nota.** Ambos descargan paquetes: modo `confirm` —pregunte primero. Si `uv
--version` falla, la persona instala uv desde https://docs.astral.sh/uv/;
un agente no descarga instaladores. El entrenamiento también necesita el extra de
entrenamiento de forge (PyTorch y Hugging Face transformers, varios cientos de MB). Forge lo
indica cuando falta (estado `needs-training-extra`):

```bash
uv tool install --reinstall --python 3.12 'nmt-forge[hf]'
```

Los rieles necesitan `nmt-forge` 0.3.0 o más reciente; si hay una versión anterior, se indica junto con su
comando de actualización (`uv tool install --upgrade --python 3.12 nmt-forge`).

## El ciclo

```bash
champollion next              # the next step: what to say, why, the command, how to take it
champollion next --json       # the same, for a program (see the rails model page for the shape)
champollion next --write      # also rewrite NEXT.md, the person's copy
```

`How:` en la salida para humanos es el modo: `run it` (`auto`), `pregunte primero, luego
ejecútelo` (`confirm`), `pregúntele a la persona titular de los datos —nunca responda por
ella` (`ask_user`), `espere, luego pregunte de nuevo` (`wait`), `esto lo hace una persona`
(`human_only`). Ejecute el comando que indique y luego pregunte de nuevo. Salirse de los
rieles está bien: ejecute cualquier comando experto y luego `champollion next`; el siguiente paso
se lee desde los archivos.

## Comenzar

```bash
champollion new family --from English --to qaa --target-name "Our language" --dry
champollion new family --from English --to qaa --target-name "Our language" --purpose "notes for the grandchildren"
cd family
```

Los idiomas son códigos o nombres, resueltos mediante las tarjetas de idioma. Una variedad
sin código adopta un código de uso privado (`qaa`–`qtz`) y el nombre que su pueblo
le da (`--target-name`, `--source-name`). **Nota.** Repita la dirección
antes de crear el proyecto: `--dry` resuelve ambos idiomas y no escribe
nada. Pase cada idioma exactamente como la persona lo nombró.

## Recopilar y registrar términos

```bash
champollion data add ../family-files/grandpa.xlsx                     # pairs → data/parallel/
champollion data add ../family-files/grandpa.xlsx --source-col A --target-col B --header
champollion data add ../family-files/words.lift --into lexicon        # a word list → data/lexicon/
champollion data add ../family-files/recording.eaf --source-col <number> --target-col <number>   # ELAN: tier numbers
```

`data add` lee `.xlsx`, `.ods`, `.csv`, `.tsv`, `.txt`, tablas de
Word `.docx`, diccionarios Toolbox y LIFT, `.eaf` de ELAN y USFM
(`--usfm-source`). Escribe `<stem>.tsv` y su sidecar, deja el original
intacto y muestra recuentos, columnas y los números de fila que su revisión de filas
señala (copias, repeticiones, longitudes inusuales, filas intercambiadas o desplazadas; no
se elimina nada) —nunca oraciones. Cuando no puede determinar qué columna (o capa de ELAN,
por número, o idioma de LIFT) es cuál, se rehúsa y pregunta; pregúntele a la
persona. `--replace` lee de nuevo el mismo original con otras columnas, conservando
las respuestas de las personas titulares; `--name <stem>` añade otro archivo con otro nombre.
Consulte las [reglas de datos](/docs/agents/data-rules#what-tools-print-and-never-print).

Luego los términos, un archivo a la vez, a partir de las respuestas de la persona:

```bash
champollion data mark data/parallel/grandpa.tsv --speakers "grandpa" --speakers-agreed yes \
  --owner "our family" --training allowed --local-only
```

Se requiere `--local-only` o `--may-leave` en un archivo que aún no sea de solo uso local.
El paso de términos del recorrido pregunta sobre cada archivo en `data/parallel/`,
`data/lexicon/`, `data/grammar/` y `data/monolingual/` hasta que tanto su
respuesta sobre entrenamiento como `--speakers-agreed` queden registradas. Cada valor pertenece a los
titulares; consulte las [reglas de datos](/docs/agents/data-rules) para saber qué hace cada uno y
qué rehúsa el comando.

## Proteger el conjunto de prueba

```bash
champollion data add ../family-files/checked.tsv --into test
champollion data mark data/test/checked.tsv --role test --training not-allowed --local-only
```

## Construir y probar un modelo

El recorrido indica estos pasos en orden (con su `{placeholders}` completado a partir del
proyecto):

```bash
nmt-forge init qaa --dir . --pair eng-qaa --no-card --name "Our language" --model auto
nmt-forge registry add project-test data/test/checked.tsv --role test
champollion data combine
nmt-forge leak-audit data/parallel/combined.tsv --clean-to data/clean/combined.clean.jsonl
nmt-forge prereg new first-model --eval-set project-test --expect "<their words>" --rationale "<their reason>"
nmt-forge split data/clean/combined.clean.jsonl --test 0 --dev 50 --seed 42 --near-dupe 0.6 --max-group 26 --out data/split --register project
nmt-forge floor data/lexicon/words.tsv
```

- `init --model auto` elige el modelo más potente que esta computadora puede entrenar en
  cuestión de horas, según su memoria ([entrenamiento](/docs/agents/training#models)). Con una
  ficha de idioma, `--no-card --name` se omite.
- `data combine` se ejecuta solo cuando `data/parallel/` contiene más de un archivo.
  Conserva los términos más estrictos de los archivos que une y rechaza un archivo cuyos
  titulares aún no han respondido — sobre si un modelo puede aprender de él y
  si todas las personas cuyas palabras contiene estuvieron de acuerdo.
- `prereg new` es un paso de `ask_user`: `--expect` y `--rationale` son las
  palabras de las personas, exactamente como las dijeron, escritas antes de que exista puntuación alguna.
  La pregunta no sugiere ningún número, y usted tampoco.
- El tamaño de dev que completa el trayecto (`dev_n`) es uno de cada diez
  pares filtrados, al menos 50 y como máximo 500; con menos de 200 pares es una
  cuarta parte de ellos en su lugar, para que el entrenamiento conserve la mayoría — y eso es menos de 50.
  Por lo tanto: 40 oraciones de dev a partir de 160 pares, 50 de 200 a 500 pares, 160 de
  1,600, 500 de 5,000 o más. Con menos de 50, ninguna ronda se puede evaluar en el conjunto de dev
  ([medición](/docs/agents/measurement#comparing-two-models)).
  `--near-dupe 0.6` mantiene las casi copias de un solo lado; `--max-group` es la mitad del
  tamaño de dev, redondeada hacia abajo, más uno.
- `floor` se aplica solo cuando `data/lexicon/` contiene una lista de palabras.

A partir de aquí, el propio asesor de forge indica cada paso. `champollion next` lo retransmite;
`nmt-forge status` lo dice directamente:

```bash
nmt-forge preflight run --config config.json && nmt-forge run config.json --detach
nmt-forge jobs                      # what is running
nmt-forge status                    # the next step, with what is ready and what blocks it
nmt-forge export <run-manifest.json> --prereg first-model --out export/
nmt-forge serve export/model --detach
nmt-forge tidy                      # earlier rounds' model weights nothing uses, and the space they take
```

El entrenamiento es `confirm` (consume cómputo, de minutos a horas); mientras una ejecución
desasociada entrena, el paso es `wait`. `nmt-forge run` rechaza antes de comenzar una ejecución que el
disco no puede albergar (`[disk-room]`), indicando el espacio libre, su estimación y
lo que liberaría `nmt-forge tidy`; `nmt-forge tidy --yes` lo libera, y
`--skip-disk-check` en `run` inicia de todos modos, registrado en la ejecución. Esas dos decisiones
le corresponden a la persona, no a usted ([entrenamiento](/docs/agents/training#disk-space)).
La exportación evalúa el modelo una vez en el conjunto de prueba, frente a la predicción.
Elegir entre varias exportaciones le corresponde a la persona
(`nmt-forge choose <model folder>`). Tras la puntuación del conjunto de prueba, las personas evalúan
su predicción:

```bash
nmt-forge prereg verdict first-model --prediction 1 --held --by "grandma"
```

(`--missed` cuando no se cumplió; `--prediction` es el número de la predicción,
1 para un solo `--expect`; `--by` indica quién la evaluó, tal como lo dijo). Consulte
[entrenamiento](/docs/agents/training) para conocer cada comando y rechazo de forge.

## Las rondas de mejora

Una vez que se sirve un modelo, comienzan las rondas:

```bash
champollion improve time --per-week "about 30 sentences" --total "maybe 800"
champollion improve wishlist        # improve/round-<k>/wishlist.md, a printable sheet
# the people write 20 or more sentences in improve/round-<k>/to-translate.txt
champollion improve sheet           # the model in use drafts them → improve/round-<k>/review.csv
# the speaker marks the Right? column: Y, N (and how it is said), or ?
champollion improve marks           # counts the marks; fixes and confirmed drafts become pairs
champollion improve report          # the round's report
champollion improve prepare         # grows the dev set, screens, points config.json at the round's file, plans the training
nmt-forge preflight run --config config.json && nmt-forge run config.json --detach
champollion improve status          # the rounds so far: marks, and each verdict in the round report's words
```

- `improve sheet`: mientras el conjunto de desarrollo (práctica) tenga menos de 200 oraciones, algunas
  filas no tienen borrador — una de cada dos mientras tenga menos de 50, una de cada cuatro a partir de 50
  — y la persona hablante las escribe. `improve marks` las escribe en `data/dev/`
  y `improve prepare` las añade al conjunto de desarrollo (`nmt-forge grow-dev`),
  nunca al de entrenamiento. También ejecuta `nmt-forge draft-newer`. Cuando hay
  otro modelo — el más nuevo que haya sido entrenado cuando no está en uso (no se puso en
  uso tras su ronda: muy pocas para saberlo, ningún cambio medible o peor), o,
  tras una promoción, el modelo al que reemplazó el que está en uso —, ese modelo redacta una
  mitad aleatoria de las filas con borrador, sin marcar, y la clave queda junto a la
  hoja (`sheet-key.json`). `improve marks` luego cuenta cada modelo por separado —
  la comparación a ciegas, que tras una promoción es la comprobación que necesita el informe
  antes de considerar que una subida es un progreso real
  ([medición](/docs/agents/measurement#the-speakers-marks)).
- `improve sheet`, a partir de la ronda 2: una fila por cada 10 oraciones nuevas
  (redondeando hacia abajo) es un borrador que la persona hablante marcó como `Y` o `N` en una
  hoja anterior, que vuelve sin marcar en un lugar aleatorio. La primera línea de la hoja dice que unas
  pocas filas vuelven a propósito, nunca cuáles; `sheet-key.json` las enumera
  (`repeat_rows`). El comando imprime cuántas volvieron, *"(cuáles no está marcado)"*,
  y que toman *"unos 10 segundos por fila, nunca se vuelve a entrenar con ellas"*.
- `improve marks` evalúa una fila mostrada de nuevo únicamente frente a la marca anterior
  de la persona hablante — nunca en la cuota de la ronda, los pares de entrenamiento o la
  comparación a ciegas —, escribe `repeats` en `marks.json` e imprime *"Filas
  mostradas de nuevo: la persona hablante marcó A de J del mismo modo que antes (P%) — W
  antes incorrectas ahora correctas, R antes correctas ahora incorrectas. No se cuentan en la cuota de
  esta ronda y no se vuelve a entrenar con ellas."*
- `improve marks`, cuando el otro modelo es el más nuevo y la persona hablante
  evaluó al menos un borrador de cada uno, registra los conteos con forge (solo
  conteos, nunca una oración):

  ```bash
  nmt-forge speaker-verdict --newer <run> --in-use <run> --newer-right <n> --newer-judged <n> --in-use-right <n> --in-use-judged <n> --json
  ```

  Cuando el hablante marcó el modelo más nuevo como correcto con clara mayor frecuencia,
  imprime *"forge lo registró: ofrece poner en uso el modelo más nuevo (las personas dicen que sí primero)"*;
  cuando forge no está instalado o se rehúsa, indica que las marcas no se registraron y por qué.
- `improve prepare` termina con `nmt-forge round-plan`: la ronda continúa
  desde el modelo en uso (4 pasadas sobre todas las oraciones hasta ahora) o entrena
  desde el principio, y explica por qué ([entrenamiento](/docs/agents/training#the-improve-rounds)).

Luego, Forge evalúa el nuevo modelo frente al que está en uso
(`nmt-forge compare-runs <in-use run-manifest.json> <new run-manifest.json>`,
`auto`) y ofrece ponerlo en uso (`confirm`) solo si es mediblemente
mejor — o, donde fueron muy pocas para determinarlo (menos de 50 oraciones de desarrollo)
o no hubo un cambio medible, una vez que las calificaciones a ciegas del hablante lo prefirieron
claramente. Un veredicto por sí solo no pone nada en uso: solo el sí de las personas (el
`nmt-forge export` y `nmt-forge choose` de ese paso) lo hace. Los nuevos pares de `improve marks` reciben primero sus propios términos — el
recorrido lo consulta. Cómo transmitir el informe: [orientación](/docs/agents/coaching).

## Traducir y servir con mt-eval

`nmt-forge export` dentro de un proyecto escribe `deploy/<name>.json` (deployment/1).
El mismo archivo mide, traduce y sirve:

```bash
mt-eval translate --deployment deploy/<name>.json --source-file <input file> --out <output file>
mt-eval serve --deployment deploy/<name>.json      # http://127.0.0.1:8379 by default
mt-eval run --deployment deploy/<name>.json --corpus <dev or test file>
```

- **Nota.** `mt-eval run` en un archivo de prueba no requiere prerregistro; solo
  registra la lectura. Evalúe el conjunto de prueba mediante `nmt-forge export` (o después de que
  se haya escrito la predicción), nunca antes.
- `--gates gates/<chain>.json` añade una cadena de compuertas a `run`, `translate` o
  `serve` (sin `--deployment`); `run` y `test` rechazan una cadena que recurra a un
  respaldo. Consulte [métodos y compuertas](/docs/agents/methods) y
  [servicio](/docs/agents/serving).

## Fuera de los rieles: qué existe para un idioma

```bash
champollion network card <code>                    # the cited language card
champollion network recommend <source> <target>    # methods that can run, with their evidence
mt-eval corpora --source <source> --target <target>   # registered test sets for the pair
nmt-forge discover <code>                          # what a training project can use
```

## Verificar y actualizar los archivos

```bash
champollion validate        # project file, sidecars, method.json, gates/, deploy/ — 0 ok, 1 invalid, 2 usage
champollion upgrade --dry   # what upgrading older sidecars to set/1 would change; drop --dry to write
```

## Modo sin conexión

`CHAMPOLLION_OFFLINE=1` evita que la CLI de `champollion` use la red:
las tarjetas de idioma provienen únicamente del conjunto incluido y de la caché local (no
se obtiene una tarjeta de cola larga), se omite la actualización diaria de la caché de tarjetas, y
`register-corpus` no compara el hash de un archivo con el catálogo público
(registra la comparación como no realizada). No cambia lo que envía un método:
un método que llama a un proveedor aún necesita la red y las
reglas de transmisión siguen aplicando.

`MT_EVAL_NO_REMOTE_REGISTRY=1` evita que `mt-eval` obtenga su registro de conjuntos de datos
desde la web (para una computadora aislada de la red).

Lo que de todos modos necesita red en los rieles: instalar las herramientas, el
extra de entrenamiento y la primera descarga de un modelo preentrenado (`byt5-small` o
`byt5-small-lowmem`, cerca de 1.2 GB; `cpu-tiny` no descarga nada).

## Variables de entorno

Leídas por el código, para un operador. Las claves de API de los proveedores solo son necesarias
para métodos que llaman a un proveedor, nunca en la ruta predeterminada de los rieles.

| Variable | Leída por | Efecto |
|---|---|---|
| `CHAMPOLLION_MCP_PROFILE` | Servidor MCP | `rails` (predeterminado) o `full` |
| `CHAMPOLLION_CLI_BIN` | Servidor MCP | El punto de entrada `champollion` a ejecutar |
| `NMT_FORGE_BIN` | `champollion`, servidor MCP | El ejecutable de `nmt-forge` |
| `UV_TOOL_BIN_DIR` | `champollion`, servidor MCP | Dónde buscar `nmt-forge` y `uv` después de `PATH` (predeterminado `~/.local/bin`) |
| `CHAMPOLLION_OFFLINE` | `champollion` | `1`: sin red para tarjetas o consultas del catálogo |
| `CHAMPOLLION_CARDS_CACHE_DIR` | `champollion` | La caché de tarjetas por usuario (predeterminado `~/.champollion/cards`) |
| `CHAMPOLLION_CARDS_TTL_HOURS` | `champollion` | Con qué frecuencia se revisa la caché de tarjetas en busca de actualizaciones (predeterminado 24) |
| `NMT_FORGE_AUTO_PRESET` | `nmt-forge init --model auto` | Fija el preajuste que `auto` elige (debe ser el nombre de un preajuste) |
| `NMT_FORGE_SERVE_PORT` | `nmt-forge serve` | Puerto predeterminado (8378 sin ella) |
| `NMT_FORGE_SERVE_TOKEN` | `nmt-forge serve` | El token bearer; obligatorio fuera de loopback |
| `NMT_FORGE_NO_MONITOR` | `nmt-forge run` | `1`: sin panel de entrenamiento en vivo |
| `MT_EVAL_SERVE_TOKEN` | `mt-eval serve` | El token bearer (nunca un valor de línea de comandos) |
| `CHAMPOLLION_SERVE_TOKEN` | `champollion serve` | El token bearer para el servidor propio de la CLI |
| `MT_EVAL_NO_REMOTE_REGISTRY` | `mt-eval` | `1`: sin obtención del registro |
| `MT_EVAL_DATA_ROOT` | `mt-eval` | Dónde se resuelven primero las rutas de los conjuntos de datos registrados |
| `OPENROUTER_API_KEY` | `champollion`, `mt-eval` | La clave del proveedor de modelos alojados predeterminado |

## Salida para programas

| Herramienta | Salida para máquinas | Códigos de salida |
|---|---|---|
| `champollion` | `--json` en los comandos de los rieles (`new`, `next`, `data add`, `data mark`, `data combine`, `improve report`, `improve status`, `connect`, `upgrade`) | 0 correcto · 1 rechazado · 2 uso |
| `nmt-forge` | `--json` en cada subcomando: un documento JSON en stdout, todo lo demás en stderr | 0 correcto · 2 rechazado (`{"error": …}`) |
| `mt-eval` | `--json` y `--non-interactive` en cada subcomando | 0 correcto · distinto de cero rechazado |

Formatos de rechazo: [el modelo de los rieles](/docs/agents/rails-model#refusal-shapes).

## Para profundizar

- [Referencia de comandos de `champollion`](/docs/reference/cli),
  [`nmt-forge`](/docs/network/getting-started/forge-command-reference) y
  [`mt-eval`](/docs/reference/mt-eval).
- [El modelo de los rieles](/docs/agents/rails-model) — el recorrido y `next --json`.
- [Conducir los rieles a través de MCP](/docs/agents/mcp) — los mismos pasos presentados como seis herramientas.
- [Entrenamiento con nmt-forge](/docs/agents/training) y
  [reglas de datos](/docs/agents/data-rules).
