---
title: "El modelo de rieles"
slug: /agents/rails-model
description: "Cómo se construye un proyecto sobre los rieles de Champollion: el árbol del proyecto, los seis formatos validados mediante esquemas que lee cada herramienta, la canalización única desde la entrada admitida hasta la salida medida, el recorrido como datos y la forma de cada rechazo."
---

# El modelo sobre rieles

Un proyecto sobre rieles es una carpeta de archivos simples. Cada herramienta —la
CLI de `champollion`, `nmt-forge`, `mt-eval` y el servidor MCP— lee los mismos
archivos de forma nativa, según los mismos esquemas, con los mismos veredictos. El siguiente
paso siempre se lee desde los archivos, nunca se recuerda de memoria. (Dos cosas viven
fuera del proyecto: el servidor MCP cuenta los fallos de un paso durante su propio
tiempo de vida, y nmt-forge mantiene una cola de entrenamiento para toda la máquina en
`~/.nmt-forge`). Cambie un archivo a mano, luego pregunte por el siguiente paso, y la respuesta
reflejará el cambio.

Esta página es el mapa. Las reglas operativas están en
[el contrato](/docs/agents/contract); las llamadas a herramientas están en
[MCP](/docs/agents/mcp) y [la terminal](/docs/agents/shell).

## Las herramientas

| Herramienta | Instalación | Qué hace sobre rieles |
|---|---|---|
| `champollion` | npm (Node 20.11+) | Inicia proyectos, incorpora datos, registra sus términos, nombra el siguiente paso, ejecuta las rondas de mejora, conecta un modelo a una aplicación |
| `nmt-forge` | PyPI (`uv tool install --python 3.12 nmt-forge`) | Entrena, filtra, divide, registra predicciones, puntúa modelos en el conjunto de prueba y los exporta, los sirve; mantiene el libro de registro |
| `mt-eval` | viene con `nmt-forge` (el paquete `mt-eval-harness`) | Ejecuta un método sobre un conjunto de prueba, un archivo o una solicitud; aplica compuertas; puntúa |
| `champollion-mcp-server` | npx | Controla la CLI de `champollion` como procesos secundarios acotados; el perfil de rieles son seis herramientas |

Cada herramienta se ejecuta como su propio proceso. El servidor MCP ejecuta los mismos comandos que
una persona escribe (su `run_next_step` rechaza cualquier programa que no sea
`champollion`, `nmt-forge` y `uv tool install … nmt-forge`).

## El árbol del proyecto

`champollion new <folder> --from <language> --to <language>` escribe:

```text
<folder>/
  champollion.project.json   project/1 — the decisions (kind, name, pair, purpose, defaults)
  README.md                  what goes where, for the people
  NEXT.md                    the next step, as a page (rewritten by `champollion next --write`)
  AGENTS.md                  the operating contract, for an AI agent working in the folder (an existing one is kept)
  .gitignore                 keeps data/, inbox/, consent/, models/, runs/, export*/, .forge/runs/, .champollion/ out of git
  inbox/                     files as the people have them
  data/parallel/             sentence pairs to learn from
  data/test/                 sentences a fluent speaker checked — never learned from
  data/lexicon/              word lists and dictionaries
  data/grammar/              grammar notes
  data/monolingual/          one-language text (kept; kept; not used for training)
  consent/                   notes recording who agreed to what, and when
```

Rechaza una carpeta que ya contenga un proyecto (exit 1) o cualquier
archivo no oculto (exit 1), y un `kind` distinto de `language`: los proyectos `task` y
`service` aún no están sobre rieles. `--dry` resuelve los idiomas
y no escribe nada.

Los pasos añaden el resto a medida que se ejecutan:

| Ruta | Escrito por | Contiene |
|---|---|---|
| `<file>.champollion.json` | `champollion data add`, `data mark`, `data combine`, `improve marks` | set/1 — los términos del archivo a su lado |
| `data/combined-from/` | `champollion data combine` | los originales que combine unió (movidos, nunca eliminados) |
| `data/not-for-training/` | `champollion data combine` | archivos cuyos titulares indicaron que ningún modelo puede aprender de ellos |
| `.forge/` | `nmt-forge init` | el taller: `eval-registry.json`, `ledger.jsonl`, prerregistros, `runs/` |
| `config.json`, `NEXT_STEPS.md` | `nmt-forge init` | la configuración de entrenamiento (un ajuste preestablecido de modelo expandido a números explícitos) |
| `data/clean/` | `nmt-forge leak-audit --clean-to` | los pares de entrenamiento filtrados |
| `data/split/` | `nmt-forge split`, `champollion improve prepare` | el conjunto de desarrollo; el archivo de entrenamiento de cada ronda |
| `data/dev/practice-round-<k>.tsv` | `champollion improve marks` | oraciones que la persona hablante escribió para el conjunto de desarrollo — rol `dev`, solo local, nunca usado para entrenar |
| `improve/time.json` | `champollion improve time` | el tiempo de la persona hablante, en sus palabras |
| `improve/round-<k>/` | los pasos de improve | `wishlist.md`, `to-translate.txt`, `review.csv`, `sheet-key.json` (qué filas redactó el otro modelo —uno más nuevo que no está en uso, o el que reemplazó una promoción: números de fila, nombres de ejecución, la relación y el recuento de pares de entrenamiento de cada modelo— y, a partir de la ronda 2, `repeat_rows`: las filas mostradas de nuevo, cada `row`, `from_round`, `from_row` y el `mark` anterior), `marks.json` (los recuentos, la proporción correcta con su intervalo, `blind` y `repeats`: `shown`, `judged`, `agreed`, `agreement`, `wrong_to_right`, `right_to_wrong`, `wrong_before`, `rounds_apart_wrong_before`), `prepared.json`, `report.json` |
| `export*/` | `nmt-forge export` | un modelo exportado y su method.json |
| `deploy/<name>.json` | `nmt-forge export` (dentro de un proyecto rails) | deployment/1 — lo que se despliega |
| `gates/*.json` | personas | gate-chain/1 — verificaciones entre la salida y lo que se entrega |
| `methods/<id>/method.json` | personas | method/1 (también escrito por `nmt-forge export` en una carpeta de modelo, `mt-eval export` y `champollion serve --emit-manifest`) |

## Los formatos

Seis esquemas del marco de trabajo residen en `shared/schemas/framework/`. Cada documento
indica su esquema en `$schema`. Se rechazan las claves desconocidas; una clave propia
va bajo `x-`.

| Formato | `$schema` | Dónde | Qué es |
|---|---|---|---|
| project/1 | `https://champollion.dev/schemas/project/1.json` | `champollion.project.json` | Solo decisiones: `kind`, `name`, `pair`, `purpose`, `defaults`, `created_with` |
| set/1 | `https://champollion.dev/schemas/set/1.json` | `<file>.champollion.json` | Términos de un archivo de datos: `transmission`, `role`, `kind`, `pair`, `fields`, `terms`, campos de registro, `derived_from`, `holders_agreed` |
| method/1 | `https://champollion.dev/schemas/method/1.json` | `method.json` | Un método: `id`, `name`, `kind` y la configuración única de ese tipo, `pairs`, `decode`, `card`, `evidence` |
| gate-chain/1 | `https://champollion.dev/schemas/gate-chain/1.json` | `gates/*.json` | Compuertas ordenadas de `metric-threshold` y un `fallback` opcional |
| deployment/1 | `https://champollion.dev/schemas/deployment/1.json` | `deploy/*.json` | Un método, sus compuertas, un par; host y puerto `serve` opcionales |
| service-api/1 | `https://champollion.dev/schemas/service-api/1.json` | el contrato de `/translate` | Documentos de solicitud, respuesta, error y `/health` |

`project.defaults`: lo que reciben los datos añadidos al proyecto cuando nadie indica
lo contrario. `champollion new` escribe `{"transmission": "local-only",
"training": "ask", "share_scores": "ask"}`. The values: `transmission`
`local-only` o `ask`; `training` `allowed`, `not-allowed` o `ask`;
`share_scores` `never` o `ask`. `ask` hace que las herramientas se detengan y pregunten; los rieles
nunca inventan una respuesta.

Dos registros más no son esquemas del marco de trabajo pero forman parte del modelo:

- **El libro de registro de forge**, `.forge/ledger.jsonl`: de solo adición y encadenado por hashes
  (cada entrada incorpora el hash de la anterior; `nmt-forge ledger verify`
  falla ante cualquier edición). Registra registros, cada lectura de un
  conjunto registrado, prerregistros, puntuaciones, consumos de conjuntos sellados, anulaciones,
  veredictos de auditoría de fugas, el umbral mínimo del diccionario, exportaciones, elecciones, puestas en servicio, veredictos de rondas
  (`improve-compare`: `better`, `worse`, `no-change` o `too-few` con menos de 50
  oraciones de desarrollo), cómo entrena cada ronda (`round-plan`), los
  borradores del otro modelo para una hoja de revisión (`draft-newer`: nombres de ejecuciones, `relation`, la
  cantidad de pares de entrenamiento de cada modelo y un conteo de borradores), el veredicto ciego
  del hablante sobre un modelo más nuevo (`improve-speaker`: nombres de ejecuciones, cuatro conteos, `z`,
  `clear`), cambios de modelo (`model-change`, incluido un `not-now`) y lo que
  `nmt-forge tidy` eliminó (`tidy`: ejecuciones y bytes). Conteos, hashes y
  rutas — nunca una oración. Es una contabilidad
  con detección de manipulación, no seguridad criptográfica.
- **La ficha de ejecución**: lo que `mt-eval run` registra para una ejecución evaluada, y lo que
  acompaña a un resultado publicado. Consulte la [especificación de la ficha de ejecución](/docs/network/specifications/run-card).

**Bloqueo.** `champollion validate [folder]` comprueba el archivo del proyecto, cada
sidecar, cada `method.json` (en la raíz, en `methods/*/` y
`.champollion/methods/*/`), `gates/*.json` y `deploy/*.json` contra estos
esquemas. El entorno de evaluación lee los mismos archivos con los mismos veredictos. Exit 0 = sin
errores, 1 = un documento no es válido, 2 = error de uso. Solo abre estos
archivos JSON, nunca un archivo de datos.

`champollion upgrade [folder]` reescribe los sidecars escritos antes de set/1 (sin
`$schema`) como set/1, conservando cada valor (una clave que set/1 no conoce se mueve
bajo `x-<key>`). Deja intacto un sidecar no válido y lista un
`method.json` anterior sin modificarlo: todas las herramientas aún lo leen, como method/0,
con una advertencia.

## La canalización única

Cada forma en que un método se encuentra con el texto es una sola canalización en el motor de evaluación:

1. **Admisión.** Se leen los términos de la entrada (el sidecar set/1,
   un sobre JSON, la entrada del registro) y se resuelve y aplica su política de transmisión
   antes de traducir nada. Un canal que la política no permita
   se rechaza aquí (consulte las [reglas de datos](/docs/agents/data-rules)).
2. **Método.** Un método traduce (tipos de method/1: `llm`, `llm-coached`,
   `mt-api`, `local-model`, `nmt-checkpoint`, `lexicon`, `python`, `service`,
   `human`).
3. **Compuertas.** Si se nombra una cadena de compuertas, se juzga cada segmento; la primera compuerta
   que rechace decide qué se envía (`drop`, `keep-source`, `flag`,
   `fallback`). Consulte [métodos y compuertas](/docs/agents/methods).
4. **Salidas.** Se escribe el registro de ejecución; los archivos extraídos a partir de una entrada marcada llevan
   sus términos en un sidecar a su lado.
5. **Métricas.** Solo cuando existen referencias: la puntuación principal califica lo que se envió,
   la puntuación sin compuertas se sitúa a su lado. Consulte [medición](/docs/agents/measurement).

Los modos son la misma canalización sobre entradas diferentes:

| Modo | Comando | Entrada | Métricas |
|---|---|---|---|
| Medir | `mt-eval run` (`mt-eval test` vuelve a puntuar un registro de ejecución) | un conjunto de prueba o de desarrollo | sí |
| Traducir un archivo | `mt-eval translate --out <file>` | solo fuente | no |
| Servir | `mt-eval serve` | una solicitud a la vez | no |

**Un despliegue es la canalización de medición sobre una entrada de solo fuente.** Se prueba
un archivo deployment/1 (`mt-eval run --deployment`), se ejecuta sobre un archivo
(`mt-eval translate --deployment`) y se sirve (`mt-eval serve --deployment`),
de modo que lo que se midió sea lo que se envíe. Con `--deployment`, se rechazan las opciones
que decide el archivo (`--method`, `-m`/`--model`, `--gates`, `--target-script`).
Un despliegue no especifica ninguna puntuación: un número medido es el resultado de una ejecución, conservado con la
ejecución. Consulte [servir](/docs/agents/serving).

## El recorrido, como datos

El orden del trabajo es un archivo: `shared/journeys/language.json`. El
evaluador, `cli/lib/framework/journey.js`, es el único lector;
`champollion next`, el perfil de rieles de MCP y `NEXT.md` le hacen la misma
pregunta. **El primer paso que no esté completado es el siguiente paso.** Solo lee
sidecars, el archivo del proyecto y el registro y libro de registro de forge —nunca el texto de un archivo
de datos— y no ejecuta nada excepto `nmt-forge --version` (limitado a
30 s) para el paso de instalación y `nmt-forge status --json` (limitado a 60 s)
una vez que el trabajo llega al entrenamiento.

**Etapas.** `start` → `gather` → `protect` → `tools` → `build` → `improve`.

**Un paso** tiene un `id`, una `stage`, un `mode`, palabras sencillas para explicárselo a la persona
(`say`) y por qué importa (`why`), y por lo general un `command`. Campos opcionales:

| Campo | Significado |
|---|---|
| `done_when` | La comprobación que indica que el paso está completado. Obligatorio (excepto en un paso de delegación) |
| `when` | Una comprobación que debe cumplirse para que el paso sea aplicable (el piso de diccionario solo aplica cuando `data/lexicon/` contiene un archivo) |
| `question`, `answers` | La pregunta de un paso `ask_user` y sus casillas de respuesta: `{"enum": [...]}` o `{"type": "string", "say": "…"}` |
| `agent`, `agent_tool` | Lo que un agente hace por sí mismo para el paso de una persona (incorporar los archivos indicados con `add_data`) |
| `outdated` | Una variante utilizada cuando la comprobación detecta que la herramienta es demasiado antigua |
| `delegate` | `"nmt-forge"`: ceder el control al propio asesor de forge |

Los `{placeholders}` en `say`, `question` y `command` se rellenan a partir del archivo del proyecto
y los archivos encontrados.

Las **comprobaciones** son un conjunto cerrado; el evaluador genera un error si encuentra una desconocida:
`project_valid`, `data_files`, `every_data_file_has_terms`,
`protected_test_set`, `tool_on_path` (con `min_version`), `path_exists`,
`forge_test_registered`, `single_file`, `forge_role_registered`,
`forge_ledger_event`, `screened_rows`, `lines_in_file`, `review_marked`,
`improve_prepared`, `forge_trained_on_current`.

**Modos:**

| Modo | Quién actúa | Qué permiten los rieles |
|---|---|---|
| `auto` | el agente | ejecutar el comando |
| `confirm` | el agente, tras un sí | instalaciones, entrenamiento, cualquier cosa que gaste o publique; ejecutar solo después de que la persona diga que sí |
| `ask_user` | la persona responde | pregunte `question`; pase sus respuestas mediante las claves en `answers`; nunca responda por ellos |
| `wait` | nadie | algo se está ejecutando; vuelva a preguntar más tarde |
| `human_only` | una persona | reunir frases, marcar borradores, elegir |
| `use_tool` | el agente, con su propia herramienta | solo MCP: un paso `human_only` con un campo `agent` se muestra como `use_tool` con `step.tool` |

**Delegación.** En el paso `forge`, el recorrido consulta `nmt-forge status
--json` y toma el estado de forge como el paso. Los estados de forge se corresponden con los modos:
`training` → `wait`; `ready-to-train` y `needs-training-extra` → `confirm`;
`missing-preregistration` → `ask_user`; `choose-export` → `human_only`;
`improve-compare` → `auto`; `improve-promote` → `confirm`;
`improve-stronger-model` → `ask_user`. Cualquier otro estado es `auto` cuando forge
indica un comando, `human_only` cuando no lo hace. Un estado de `serving` finaliza la
etapa de construcción y comienza la etapa de mejora.

Dos tipos de pasos provienen de fuera de la lista de pasos:

- **Juzgar la predicción.** Tras una exportación puntuada en el conjunto de prueba, una
  predicción que las personas escribieron en sus propias palabras espera su veredicto: un
  paso `ask_user` con `answers` `verdict` (`held` o `missed`) y `by` (quién
  lo juzgó), que ejecuta `nmt-forge prereg verdict`.
- **Esperar el acuerdo.** Cada archivo cuyo sidecar indique `speakers_agreed:
  not-yet` becomes its own `ask_user` question in `waiting`, se responde mediante su
  propio identificador de paso siempre que la persona tenga la respuesta. Nunca detiene el resto
  de los rieles.

**El identificador del paso** es `<journey step id>:<8 hex characters>`: un hash del paso
y de su comando rellenado. Si el proyecto cambia, el identificador cambia, y una llamada a
`run_next_step` con el identificador anterior se rechaza (`the project changed since that
step was named`).

**Lo que devuelve `champollion next --json`:** `project`, `kind`, `stage` (`n`,
`of`, `id`, `title`), `done` (identificadores de paso), `step` (`id`, `mode`, `say`, `why`,
y donde esté presente `command`, `question`, `answers`, `agent`, `agent_tool`,
`file`, `source`), `now` (hechos de forge: lo que es verdad en este momento), `waiting`,
`forge` (`state`, `blockers`, `warnings`), `finished` (cuando no queda ningún paso)
y `error`. Exit 1 cuando hay un error y no hay ningún paso.

## Formatos de rechazo

Cada rechazo dice qué ocurrió, y la mayoría indica por qué y la solución.

| Herramienta | Salida legible para personas | Salida de máquina | Salida (exit) |
|---|---|---|---|
| `nmt-forge` | `[guard] message`, luego `  why: …` y `  fix: …` | `--json`: `{"error": {"type", "guard", "message", "why", "fix", "how_to_get", "text"}}` en stdout | 2 rechazado |
| `champollion` | `[ERR] message` en stderr | `--json` donde el comando lo admita | 1 rechazado, 2 de uso |
| Herramientas de rieles de MCP | — | `{"refused": "<reason>", …}` con `isError: true`, más el reintento donde exista (`if_it_has_no_code`, `current`, `last_output`, `question`, `answers`) | — |

`type` en el error de forge es la clase de excepción (`UsageError` para argumentos
incorrectos — forge rechaza banderas abreviadas en lugar de adivinar). Los nombres
de las protecciones de forge incluyen `split-guard`, `dev-fence`, `leak-audit`, `preregister`,
`eval-ledger`, `ci-scoring`, `registry`, `improve-loop` y `disk-room` (una
ejecución de entrenamiento que el disco no puede albergar). Cuando un error
citaría una oración de un corpus retenido, la oración muestra
`[sentence withheld]` y el objeto agrega `text_withheld`.

Transmita un rechazo con palabras sencillas y siga su solución, o vuelva a preguntar por el siguiente paso.
Un paso que haya fallado dos veces no se vuelve a ejecutar hasta que la persona lo decida
([MCP](/docs/agents/mcp#when-a-step-fails)).

## Para profundizar

- [El contrato operativo](/docs/agents/contract) — las reglas, bloqueos y notas.
- [Controlar los rieles mediante MCP](/docs/agents/mcp) y [desde la terminal](/docs/agents/shell).
- [Reglas de datos y transmisión](/docs/agents/data-rules) — set/1 en detalle.
- [Métodos y compuertas](/docs/agents/methods) y [servir](/docs/agents/serving) — method/1, gate-chain/1, deployment/1, service-api/1.
- [La especificación de la tarjeta de ejecución](/docs/network/specifications/run-card) y la
  [especificación del entorno de evaluación](/docs/network/specifications/harness).
- [Referencia de comandos de `mt-eval`](/docs/reference/mt-eval) y la
  [referencia de comandos de `nmt-forge`](/docs/network/getting-started/forge-command-reference).
