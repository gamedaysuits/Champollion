---
title: "Servicio y despliegue"
slug: /agents/serving
description: "Ponga a trabajar un modelo medido: el archivo deployment/1 que escribe nmt-forge export, mt-eval translate y serve, nmt-forge serve y su página de prueba, el contrato service-api/1 /translate, champollion connect y champollion sync dirigidos por un agente — junto con lo que las salidas solo locales pueden y no pueden hacer."
---

# Servicio y despliegue

**Un despliegue es el pipeline de medición sobre entradas que solo contienen la fuente.** Un
archivo deployment/1 nombra el método, su modelo, sus compuertas y el par. El
mismo archivo se prueba en un conjunto de prueba, se ejecuta sobre un archivo y se sirve, de modo que lo que se
midió es lo que se entrega. Esta página es la mitad para agentes de
[Poner a trabajar](/docs/put-it-to-work).

En todo momento: un modelo que aprendió de oraciones marcadas como local-only puede repetirlas,
por lo que **su salida también es local-only**. Cada herramienta a continuación mantiene esa salida
en esta computadora a menos que los titulares de los datos hayan acordado lo contrario, y
`--holders-agreed-by` registra quién dio el acuerdo. **Nota.** Pase esa bandera únicamente con
el nombre que la persona le dio, después de que haya dicho que los titulares estuvieron de acuerdo.

## deployment/1

`$schema` `https://champollion.dev/schemas/deployment/1.json`. Obligatorio: `id`,
`pair` (`source`, `target`, opcional `target_script`), `method` (`method`,
opcional `model`). Opcional: `gates` (un archivo gate-chain/1) y `serve`
(`host`, por defecto `127.0.0.1`; `port`). Las rutas son relativas a la raíz del proyecto,
donde los rails ejecutan comandos. No nombra ninguna puntuación.

**Quién lo escribe.** `nmt-forge export`, cuando la exportación se encuentra dentro de un proyecto
de rails (un `champollion.project.json` arriba de ella), escribe
`deploy/<name>.json` — `<name>` es `--name` en kebab case, de lo contrario
`nmt-forge-<run>`:

```json
{
  "$schema": "https://champollion.dev/schemas/deployment/1.json",
  "id": "nmt-forge-<run>",
  "description": "nmt-forge <backend> model <run> (<src>→<tgt>), written by nmt-forge export <version>",
  "pair": { "source": "<src>", "target": "<tgt>" },
  "method": { "method": "local-model", "model": "<export>/model" }
}
```

No escribe ninguno (y dice `no deployment file: …`) cuando la exportación está fuera
de un proyecto de rails, cuando el modelo fue seleccionado bajo un gancho de decodificación (solo
`nmt-forge serve` ejecuta los ganchos de forge), cuando la configuración no nombra ningún par, cuando el
documento no se validaría, o cuando `deploy/<name>.json` ya despliega
otro modelo (nunca se reemplaza).

**Quién lo lee.**

```bash
mt-eval run --deployment deploy/<name>.json --corpus <test set>          # measure exactly what it serves
mt-eval translate --deployment deploy/<name>.json --source-file <input> --out <output>
mt-eval serve --deployment deploy/<name>.json
```

**Bloqueos.** Con `--deployment`, `run` y `translate` rechazan `--method`,
`-m`/`--model`, `--gates` y `--target-script` (*"--deployment … says the
method, its model, its gates and the target script; drop … (or change the
file)"*); `serve` también rechaza `--pair`. Se rechaza una entrada en otro par
(`deployment <id> translates from <src>; this input is in <x>`). Un
despliegue cuya cadena de compuertas recurre a un fallback se puede traducir y servir, pero no
medir: `mt-eval run` rechaza una cadena que tiene fallback
([métodos y compuertas](/docs/agents/methods#gate-chains)).

## Qué contiene una exportación

`nmt-forge export <run-manifest.json> --prereg <id> --out <dir>` escribe:

| Ruta | Qué es |
|---|---|
| `<dir>/model/` | La carpeta a desplegar: pesos y tokenizador, `forge-model.json` (con qué se entrenó, `trained_on.terms`), `DEPLOY.md` |
| `<dir>/model/champollion-plugin/method.json` | method/1, tipo `nmt-checkpoint`, `service.endpoint` `http://127.0.0.1:<port>/translate` (puerto 8378 a menos que `--port`), `card.commercial_ready: false`, `evidence` con el chrF++ del conjunto de prueba, su intervalo y n |
| `<dir>/evaluation/` | La evidencia del conjunto de prueba. Nunca la copie junto con el modelo |
| `<dir>/input-words.json` | Las palabras del lado de entrada de las oraciones de entrenamiento, una de cada una, ordenadas (`words`, `english`, `sentences`, `from` y `notes` nombrando un archivo de entrenamiento que no se pudo leer como lo leyó la ejecución). Al lado de `model/`, nunca dentro de ella: son palabras de los datos de la comunidad. Se escribe cuando la exportación incluye el modelo y sus archivos de entrenamiento están en esta computadora; de lo contrario, el resumen de la exportación dice `input_words.written: false` con `why`. `nmt-forge serve` lo lee para nombrar las palabras que el modelo nunca vio ([más abajo](#words-the-model-never-saw)) |
| `<dir>/README.md` | Qué es la exportación |

## `mt-eval translate`

El pipeline sobre un archivo, sin puntuación. `--out` toma `.jsonl` (una fila por
segmento: `id`, `source`, `output`, `error`, y con compuertas `gates`,
`shipped_from`, `fallback`) o `.tsv` (fuente, tabulación, salida). Sin `--out`
escribe `<run id>.translations.jsonl` en la carpeta de salida (`-o`). La
salida lleva los términos de la entrada —y los del modelo— en un sidecar set/1.

**Bloqueo.** Cuando la salida del método es local-only (o lo es la del fallback
de su cadena de compuertas), se rechaza un destino fuera del proyecto antes de que
se traduzca nada: *"refusing to write …: what this method writes is local-only
(…), and that is outside … — a place the data's holders did not choose. Only
they can agree to that — ask them; if they do: --holders-agreed-by "<who
agreed>" (recorded in the file's sidecar; it stays marked local-only). Or
write it inside the project"*. Con el acuerdo, el sidecar registra
`holders_agreed: {by, date}`; el archivo permanece como local-only para todas las herramientas.

`--json` imprime `translated`, `errors`, `out`, `run_id`, `marked`,
`holders_agreed` y `output_gates`. Sale con código 1 cuando fallaron todas las filas. Se rechaza
`--publish`: no hay puntuación.

## `mt-eval serve`

| | |
|---|---|
| Dirección por defecto | `127.0.0.1:8379` (`--host`, `--port` o el bloque `serve` del despliegue) |
| Qué sirve | Solo un método que se ejecute en este proceso: `lexicon`, `local-model` o un complemento cuyo method.json declare `dependency_class` `S` o `O`. Se rechaza un LLM o un motor alojado |
| Token | `MT_EVAL_SERVE_TOKEN`, únicamente desde el entorno. Obligatorio para escuchar en cualquier dirección que no sea `127.0.0.1`, `::1` o `localhost`; cuando se establece, es obligatorio en cada `POST` (también en loopback). `GET /health` nunca lo necesita |
| Límites | Cuerpo de 1.000.000 bytes, 500 claves, 20.000 caracteres por cadena — superar cualquiera de ellos da `413` |
| Compuertas | `--gates <chain>` (o el `gates` del despliegue). El complemento de cada compuerta debe juzgar sin referencias, o no se inicia. Aquí se permite un fallback, y debe ejecutarse en este proceso |

**Bloqueo — fuera de loopback.** Sin un token: *"refusing to listen on … without a
token — anyone who can reach the port could use the method"*. Con salida
local-only y sin acuerdo: *"refusing to serve on …: what this method writes is
local-only (…), and an address other machines can reach sends it off this
one. Only the data's holders can agree to that — ask them; if they do:
--holders-agreed-by "<who agreed>" (reported on /health), or keep --host
127.0.0.1"*. La salida es local-only cuando el sidecar de un diccionario lo indica (o
no se puede leer), o cuando el `forge-model.json` de una carpeta de modelo registra términos de
entrenamiento local-only o no registra ninguno; se reporta como desconocida (`null`) para un
complemento o una carpeta de modelo sin `forge-model.json`.

`/health` responde a `status`, `method`, `model`, `pair`, `deployment` (`id`,
`sha256`), `runs` (en este proceso — no se envía nada a ningún sitio), `scored`
(nada), `output_gates` y `gates` (id de cadena, huella digital, compuertas, fallback),
`output_local_only`, `output_local_only_why`, `holders_agreed_by`, `license`
(`AGPL-3.0-or-later`), `source` (el repositorio) y `version`.

Con compuertas, un segmento rechazado regresa según lo indique su compuerta: `drop` — la clave
bajo `errors`; `keep-source` — la fuente; `flag` — la salida, la clave
nombrada en `meta.gates.flagged`; `fallback` — la traducción del fallback si las
compuertas la aceptan. Sin compuertas no comprueba nada de lo que devuelve.

## `nmt-forge serve`

```bash
nmt-forge serve <export>/model --detach        # a supervised background job
nmt-forge serve <export>/model --choose        # also record it as the people's choice
nmt-forge jobs                                 # list jobs
nmt-forge jobs stop <name> --wait 120
```

| | |
|---|---|
| Dirección por defecto | `127.0.0.1`, puerto `NMT_FORGE_SERVE_PORT` u 8378 |
| Token | `--token` o `NMT_FORGE_SERVE_TOKEN`; obligatorio fuera de loopback. `--detach` lo toma únicamente del entorno |
| Rutas | `GET /` — una página de prueba para la persona (sin token; solicita uno cuando se ha configurado); `GET /health`; `POST /translate` (service-api/1); `POST /v1/chat/completions` (compatible con OpenAI); `GET /v1/models` |
| `--detach` | Regresa en cuanto `/health` responda; se detiene si no lo hace en 120 s. Se rechaza cuando el puerto ya responde |
| `--no-hook` | Servir sin el gancho de decodificación de la ejecución (se indica en `/health` y en `meta`) |
| `--allow-locale` | Aceptar también estos códigos de configuración regional (repetible) |
| `--device` | `auto` (por defecto) o `cpu`. Con `auto`, un servidor iniciado mientras se ejecuta un trabajo de entrenamiento del mismo proyecto usa la CPU en vez de compartir la GPU, y `/health` así lo indica (`device_note`) |
| Límites | Cuerpo de 1.000.000 bytes, 500 claves, 20.000 caracteres por cadena, 5.000 unidades de trabajo de modelo por solicitud — superar cualquiera de ellos da `413`. Al modelo se le solicitan 32 unidades a la vez, de modo que una oración de otra solicitud espera por un fragmento, nunca por una solicitud completa. Una solicitud que continúe ejecutándose tras 600 s se rechaza por completo — `503`, *"send fewer pieces at a time"* — nunca se responde en parte |
| Decodificación | Búsqueda por haces (beam search) con el `num_beams` de la exportación cuando la exportación registra `beams_applied` (tal como se midió el modelo); voraz (greedy) para una exportación más antigua. El texto enviado se normaliza a NFC, al igual que los datos de entrenamiento |

**Bloqueo.** Fuera de loopback, un modelo cuya salida sea local-only —entrenado con
oraciones local-only, o sin registro de aquello de lo que aprendió— se rechaza
sin `--holders-agreed-by`. `/health` informa `pair`, `accepts`,
`decode_hook`, `run`, los informes de dev y test, `score_caveats`, `caveats`,
`trained_on`, `output_local_only`, `holders_agreed_by`, `device_note`,
`limits` (`pieces_per_request`, `pieces_per_turn`, `request_seconds`),
`unseen_words_check`, `text_pipeline` y `output_gates`. Cada respuesta de `/translate` de un
modelo local-only lleva `meta.output_local_only: true`, y cada
respuesta de `/v1/chat/completions` lleva `meta.output_local_only` (true o false).
Cuando los límites de longitud recortan algo en una solicitud, su `meta.cut` cuenta las
oraciones recortadas al entrar (`inputs`) y las traducciones que se detuvieron en el
límite máximo (`outputs`) ([entrenamiento](/docs/agents/training#the-guarded-loop)).

**Nota.** La página de prueba es para la persona. `try_translation` (MCP) la remite
allí para un modelo local-only; nunca llame a `/translate` usted mismo para leer su
salida ([contrato](/docs/agents/contract) §1).

### Palabras que el modelo nunca vio

Una oración que contiene una palabra que el modelo nunca vio durante el entrenamiento tiene muchas probabilidades
de estar mal traducida, por muy fluida que se lea. En el idioma de prueba inventado, una
oración reservada con una palabra de contenido léxico que el modelo no había visto se tradujo
correctamente 0 veces de 358 (ByT5-small con 1.600, 6.400 y 25.600 pares de entrenamiento),
y resultó equivocada con total seguridad —fluida, cada palabra una forma real, el significado
erróneo— el 32 %, 55 % y 83 % de las veces: cuanto mejor es el modelo, más
convincente resulta la conjetura. Por eso el servidor nombra esas palabras.

- **`/health`** indica si puede hacerlo: `unseen_words_check` es `{on: true,
  words_seen: <count of words in input-words.json>, notes}` or `{on: false,
  why}`.
- **`/translate`** añade, únicamente cuando una solicitud contiene tales palabras,
  `meta.unseen_words` (clave → las palabras del texto de esa clave que el modelo nunca
  vio, una vez cada una, en orden) y `meta.unseen_note`. **`/v1/chat/completions`**
  añade lo mismo, organizado según lo solicitado: `SEG_<id>` por segmento en modo
  bloque, `page` para una página, las propias claves del objeto JSON o `text`.
- **Sin registro, indicado en cada respuesta.** El servidor lee `input-words.json`
  de la carpeta situada encima de la carpeta del modelo que sirve. Si no hay ninguno allí —una
  export made before 2026-10-13, one made without its training files on this
  computadora, o una carpeta de modelo copiada fuera de su exportación—, el
  `meta.unseen_check` de cada respuesta dice que no puede verificar, y por qué. Sirva el modelo desde su
  export, or export it again.
- **La página de prueba** marca la línea: *"Never seen in training: … — this line is
  very likely wrong, however fluent it reads."*

Una palabra es una secuencia de letras en cualquier sistema de escritura (conservando los apóstrofes internos),
en minúsculas, en NFC. Cuando el lado de entrada es inglés, una terminación común en inglés
se considera vista en cualquier sentido (`walk` vista → `walked` cuenta; `walked`
vista → `walk` cuenta).

## service-api/1 — el contrato de `/translate`

`$schema` `https://champollion.dev/schemas/service-api/1.json`, sujeto a
`shared/test-fixtures/framework/service-api-vectors.json` (ejecutado contra
`mt-eval serve` y `nmt-forge serve`).

- **Solicitud** `POST /translate`: `keys` (clave → cadena de origen; obligatorio),
  opcional `source_locale`, `target_locale`, `method`, `text_format`
  (`"markdown"` para texto de documentos), `instructions` (clave → nota; enviado solo a un
  servidor declarado para seguirlas, `accepts_instructions`). Un campo que el servidor
  no use se ignora, nunca se rechaza.
- **Respuesta:** `200` `{translations, meta}` — `meta` es obligatorio; `207` añade
  `errors` (clave → `{message}`). Los errores son `{error: {message}}`: `400` para una
  solicitud que no puede aceptar, `401` para un token faltante o incorrecto, `404` para una
  ruta desconocida, `413` para tamaño excesivo, `500` para falla del método — nunca una respuesta parcial.
  (`nmt-forge serve` también responde `503` para una solicitud que supera su límite de 600 s).
- **`meta`:** `method`, `model`, `output_gates`, `output_local_only`
  (true, false o null), `cost_usd`; los servidores pueden añadir campos.
- **`GET /health`** requiere `status` (`ok`), `pair`, `output_gates` y
  `output_local_only`; opcional `output_local_only_why`, `holders_agreed_by`,
  `model`, `method`.
- **La regla:** un servidor cuyo `/health` indique `output_local_only: true` coloca
  `output_local_only: true` en el `meta` de cada respuesta, y un cliente escribe
  dicha salida únicamente donde los titulares de los datos hayan acordado.

## `champollion connect`

```bash
champollion connect <export>/model --app <app folder>
champollion connect <export>/model --app <app folder> --holders-agreed-by "<who agreed>"
```

Encuentra el `method.json` (el archivo nombrado, o `method.json`,
`champollion-plugin/method.json`, `model/champollion-plugin/method.json` en
la carpeta), lo instala en el `.champollion/methods/` de la aplicación y apunta
cada uno de sus pares (`<inputLocale>:<target>`) hacia él como `methodPlugin`, conservando
el resto del par. La carpeta de la aplicación necesita `champollion.config.json` y el
método debe traducir desde el `inputLocale` de la aplicación.

**Bloqueo.** Un modelo cuya salida es local-only —sabido por su
`forge-model.json` (la ausencia de uno cuenta), o por el `/health` de su servicio—
se rechaza sin `--holders-agreed-by`: lo que escribe en los archivos
de configuración regional de la aplicación se publica con la aplicación. Con él, cada par registra
`holdersAgreed: {by, date, method, what}`. Advierte, sin fallar, cuando
nada responde en el endpoint (`nmt-forge serve <dir> --detach` lo inicia)
o cuando `/health` no sigue service-api/1. `--json` imprime `method`,
`kind`, `pairs`, `endpoint`, `answering`, `health_problems`,
`holders_agreed_by`.

## `champollion sync`, impulsado por un agente

`sync` traduce los archivos de configuración regional de una aplicación o sitio web con los métodos que nombra su
`champollion.config.json`. No pregunta nada de forma interactiva.

```bash
champollion sync --dry-run --json      # what would be sent, and its estimated cost
champollion sync --max-cost 2 --json   # stop before any call if the estimate is over $2, or unknown
champollion verify                     # placeholders, scripts, key parity
```

**La salida de `--json`** es un objeto JSON por línea. En stdout: `{level: "info" |
"ok", message}`, events `{level: "event", event: "cost" | "file" | "verify" |
"request", …}`, and last `{level: "summary", command: "sync", …}` con
`dryRun`, `totalProcessed`, `totalFailed`, `totalHeld`, `tmHits`,
`sentToModel`, `verify` (`ran`, `errors`, `warnings`), `failedPairs`,
`locales`, `costEstimate` y más; una ejecución de prueba (dry run) añade `preflight`, `realRun`
(`exitCode`, `wouldStop`, `reasons`) y `maxCost`. En stderr: `{level: "warn"
| "error", message}`. A hard error prints a summary with `ok: false` y
`error`.

| Salida | Significado |
|---|---|
| 0 | Limpio |
| 1 | Un nombre de `--redo` o `--force-keys` no coincidió con ninguna clave; fallas sin nada procesado; un error |
| 2 | `--max-cost` lo detuvo antes de cualquier llamada (o la estimación era desconocida); o parcial: algo falló, se retuvieron claves, faltan formas plurales o verify encontró errores |

Una ejecución de prueba (dry run) no envía ni escribe nada, no verifica y sale con código 0 a menos que una
clave nombrada no haya coincidido con nada o haya habido un error. Verify se ejecuta después de una sincronización real
a menos que `--no-verify`.

**Bloqueo — respuestas local-only.** Para un método `api`, un lote cuyo
`meta.output_local_only` sea `true` no se escribe a menos que el
`holdersAgreed` del par nombre ese método; `sync` lo indica una vez y nombra la
llamada a `champollion connect … --holders-agreed-by`. Esas claves quedan
sin traducir (o pasan al fallback del par).

**Bloqueo — el método `local`.** El método `local` (un endpoint
compatible con OpenAI) consulta el `/health` del servidor una vez. Cuando este dice
`output_local_only: true` —como hace `nmt-forge serve` para un modelo entrenado con
oraciones local-only—, no se escribe nada proveniente de ese servidor a menos que el
`holdersAgreed` del par nombre a `local`: *"the model at … says what it writes is
local-only … nothing from it was written"*, seguido de la
llamada a `champollion connect <the model> --holders-agreed-by "<who agreed>"`. Un
servidor cuyo `/health` no responde o no dice `true` (por ejemplo, un servidor de Ollama o
LM Studio) se usa como antes.

**Nota.** Conecte un modelo de forge con `champollion connect` (la ruta
`api`): este lee el registro propio del modelo sobre aquello de lo que aprendió y registra
el acuerdo de los titulares en el par bajo el método que instala.

**Palabras que el modelo nunca vio.** Cuando un servidor de forge nombra claves en
`meta.unseen_words`, los métodos `local` y `api` advierten indicando las claves —
nunca el texto ni las palabras—: *"<API batch N | Local method>: <n> key(s) hold
words the model never saw in training — very likely mistranslated, however
fluent; have a speaker check them: <up to 20 keys>"* (luego *"and <n> more"*).
Las traducciones aún se escriben; la advertencia es la forma en que la gente sabe cuáles
revisar ([asesoramiento](/docs/agents/coaching)).

**Nota.** Transmita cada línea de `warn`. Las cadenas traducidas por máquina son borradores
hasta que un hablante las revise; nunca las llame correctas.

## `champollion serve`

Un servidor diferente: sirve la pila de traducción configurada de un **proyecto de aplicación**
(método, asesoramiento, memoria de traducción, compuerta de calidad) a
otros proyectos. Por defecto `127.0.0.1`, puerto 1822. Requiere un token bearer
incluso en loopback (`--token` o `CHAMPOLLION_SERVE_TOKEN`, al menos 12
caracteres) a menos que `--no-auth`, lo cual solo se acepta en un enlace de loopback.
`--emit-manifest` escribe un manifiesto method/1 de tipo `service` para los consumidores.
Su `/health` es `{ok, service, version}`, no el documento de estado (health) de service-api/1,
por lo que `champollion connect` informa problemas de estado para él.

## Para profundizar

- [Poner a trabajar](/docs/put-it-to-work) — la versión para la comunidad.
- [Métodos y compuertas](/docs/agents/methods) — method/1 y gate-chain/1.
- [Reglas de datos y transmisión](/docs/agents/data-rules) — local-only y
  `holders_agreed`.
- [El modelo de rails](/docs/agents/rails-model) — el pipeline único.
- [Referencia de `mt-eval`](/docs/reference/mt-eval) y
  [referencia de `nmt-forge`](/docs/network/getting-started/forge-command-reference).
- Traducción de aplicaciones y sitios web: [CI/CD](/docs/guides/ci-cd),
  [resolución de problemas](/docs/guides/troubleshooting).
