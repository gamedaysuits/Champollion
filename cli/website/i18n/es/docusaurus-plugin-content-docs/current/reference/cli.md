---
sidebar_position: 1
title: "Referencia de CLI"
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# Referencia de CLI

## Comandos

```
champollion init              Interactive setup wizard (--yes for quick defaults)
champollion sync              Translate & sync all locale files
champollion watch             Auto-sync when the source file changes
champollion audit             List untranslated and out-of-date translations (CI completeness gate)
champollion lint              Scan source code for hardcoded strings
champollion wrap              Auto-wrap hardcoded strings in t() calls (with undo)
champollion seo <sub>         Generate hreflang, sitemap.xml, or JSON-LD schema
champollion integrity         Audit locale files for format/encoding issues
champollion repair-script     Restore romanization where script conversion was unwanted
champollion verify            Verify translations are present and correct (CI gate)
champollion status            Show pair configuration, plugins, and benchmark scores
champollion provenance        Audit translation resource licensing
champollion plugin <sub>      Manage method plugins (install, remove, list)
champollion fonts <sub>       Download web fonts for PUA script converters
champollion tm <sub>          Manage Translation Memory cache (stats, clear, seed, prune)
champollion xliff <sub>       Export/import XLIFF 1.2 for professional review
champollion models            List available models from a provider (--method <provider>)
champollion doctor            System health check (cards, config, FSTs, API keys, methods)
```

Los comandos que funcionan con el índice compartido y la tabla de clasificación, en lugar de su
proyecto, están agrupados bajo `champollion network`. Cada uno también funciona sin el
prefijo:

```
champollion network card <code>        What the index knows about a language (--json for raw output)
champollion network recommend <s> <t>  Methods you can run for a pair, with the evidence for each, and open models that declare the target (or one pair: eng-crk)
champollion network leaderboard        Published results; install a proven method (--install, --apply)
champollion network register-corpus    Register a test set without handing it over (local-only/private/public/sealed)
champollion network seal-corpus <sub>  Sealed-tier crypto verbs: keygen / seal / open (organizer-node bridge)
champollion network submit             Propose an index entry (review-gated): prints a pre-filled GitHub issue
```

Ejecute `champollion <command> --help` para obtener ayuda detallada sobre cualquier comando
(`champollion network` lista los comandos de red).

## Opciones globales

```
--help, -h              Show help (global or per-command)
--version, -v           Print version and exit
--yes, -y               Skip interactive prompts, use defaults
--config <path>         Custom config file path
--dir <path>            Override locales directory
--content-dir <path>    Folder of Markdown/MDX to translate (a Hugo content/ or any folder); each translation is written beside its source as <name>.<locale>.md
--source <code>         Override source locale (default: en)
--model <model>         Translation model for this run only (an exact model slug; aliases and floating "-latest" ids are refused); the config is not changed — to switch for good, edit "model" in champollion.config.json
--method <method>       Translation method for this run only: llm, llm-coached, local, openai, anthropic, gemini, google-translate, deepl, … Overrides the config, including a pair's own method (sync says which); scope with --pair. To switch for good, edit "defaultMethod" (or the pair's "method")
--temperature <n>       LLM temperature (0.0–2.0, default: 0.3)
--coaching-file <path>  Path to free-text coaching prompt file (injected into system prompt)
--format <fmt>          Locale file format: json, toml, yaml, po, arb, or auto
--dry, --dry-run        Preview changes without writing files
--list-keys             With --dry: name every queued key per reason
--concurrency <n>       Max parallel API calls (sets both JSON and content, default: 48)
--json-concurrency <n>  Max parallel locale translations for JSON keys (default: 200)
--content-concurrency <n> Max parallel API calls for content translation (default: 48)
--redo <scope>          Translate again: all | keys:<k1,k2> | content | files:<glob> (repeatable). Cached text is still served, so a redo is cheap. gaps: every plural message on disk without a form its language uses for ordinary counts — asked from the model, not the cache
--prune plural-extras   sync: remove i18next plural keys for a form the language does not have (Spanish count_two) — only those, each one listed; never without this flag
--fresh                 Don't use the cache for what is queued — it is billed again
--files <glob>          Only these content files this run (repeatable; e.g. docs/intro.md, "posts/**")
--force                 Same as --redo all (whole-locale rebuild; scope with --pair)
--force-keys <keys>     Same as --redo keys:<keys> (namespace::key for one file of a multi-file language; \, for a comma inside a key; ctx\x04msgid — or ctx␄msgid — for a gettext entry with a context)
--force-content         Same as --redo content
--retranslate <glob>    Same as --redo files:<glob> --fresh (bypasses the lock and the cache — billed — and replaces paragraphs a person edited in the named files)
--no-tm                 Same as --fresh
--fresh-on-model-change Don't reuse the previous model's cached translations for what this run translates; with --redo all, the new model translates what an earlier model wrote
--pair <src:tgt>        Only these pairs this run, comma-separated (e.g. en:fr,en:de; en>fr and en-fr work too); unknown pairs fail loud (sync, verify, serve)
--max-cost <usd>        sync: stop before any API call if the estimated cost is over this USD cap, or unknown (exit 2, nothing spent)
--no-verify             Skip post-sync verification pass
--strict                verify: warnings fail the check too (exit 1)
--script <choice>       init: writing system of a language with two real orthographies, e.g. crk=Cans
--name <code=name>      init: display name of a language with no card (a private-use code), e.g. qaa="Ayta (variety not yet confirmed)"
--locale <code>         Target locale (xliff export, tm clear)
--quiet                 Errors and warnings only — suppress banner, progress bar, and info lines
--json                  Machine-readable NDJSON output — one JSON object per event
```

### Cómo escribir un par de idiomas

Un par de proyecto se escribe de la forma en que `champollion.config.json` lo indexa: `en:fr`. `sync`, `verify` y `serve` también leen `en>fr` y `en-fr`, y `en-pt-BR` se compara con los pares que usted configuró. Los comandos de red (`network register-corpus`, `leaderboard`, `recommend`, `submit`) escriben un par como `eng>crk`, el formato que la tabla de clasificación almacena y `mt-eval` utiliza, y leen `eng-crk` y `eng:crk` de la misma manera. Con guiones únicamente, un par consta de dos códigos de dos o tres letras (`eng-crk`). Un código que ya contiene un guion necesita `>`: `--pair "eng>pt-BR"`. `eng-pt-BR` se rechaza, nunca se adivina. Ponga entre comillas la forma `>` en un shell: sin comillas, `--pair eng>crk` envía la salida a un archivo llamado `crk`.

---

## init

Asistente de configuración interactivo que crea `champollion.config.json`. Guía a través de la configuración de locale de origen, idiomas de destino, formato de archivo y modelo de traducción.

```bash
champollion init                          # interactive wizard
champollion init --yes                    # skip wizard, use defaults
champollion init --yes --langs fr,de,ja   # quick setup with specific languages
champollion init --source en --dir ./i18n # overrides with defaults
champollion init --yes --langs crk --content-dir newsletters  # also translate a folder of Markdown
champollion init --yes --langs abc --method api --endpoint http://127.0.0.1:8378/translate --accepts-instructions false
```

**Opción `--content-dir`**: Una carpeta de archivos Markdown/MDX para traducir además de sus archivos de configuración regional (escrita como `contentDir`). La carpeta debe existir; `init` se detiene sin escribir nada si no existe.

**Un proyecto con un archivo local-only usa por defecto `local`**: El método predeterminado es `llm` (OpenRouter, un servicio alojado). Cuando un archivo en cualquier lugar del proyecto se marca como solo local (local-only) —un `<file>.champollion.json` junto a él con `"transmission": "local-only"`, tal como escribe `champollion network register-corpus --data <file> --tier local-only`—, `init` (también con `--yes`) adopta de forma predeterminada el método `local`: un modelo alojado en esta máquina (el `http://localhost:11434/v1` predeterminado de Ollama, o el servidor que indica `LOCAL_API_BASE`). Indica el motivo, nombrando el archivo marcado, y explica cómo elegir deliberadamente un método alojado: `champollion init --force --method llm --model <model>`. Una opción `--method` explícita siempre tiene prioridad; `init` entonces anota el archivo marcado junto al destino del texto.

**Ejecutar `init` de nuevo (`--force`)**: Sin `--force`, `init` se detiene cuando `champollion.config.json` ya existe. Con ella, `init` comienza a partir de ese archivo y reescribe solo lo que especifican los flags: `--langs` define la lista de idiomas destino (un idioma que ya esté allí conserva su entrada: registro, escritura, nombre), `--method` el método predeterminado (y el modelo asociado, a menos que `--model` especifique uno), `--model`, `--temperature`, `--source`, `--dir`, `--format`, `--content-dir`, `--script`, `--name` y `--method api` los pares que indica. Vuelve a detectar la estructura de configuración regional solo cuando el archivo ya no encuentra sus archivos fuente (o `--dir` especifica otra carpeta). Cualquier otra configuración —`batchSize`, `pairs`, `glossary`, alternativas (fallbacks), registros que haya elegido— se mantiene tal como estaba. Imprime cada campo que modificó y los que conservó, y copia primero el archivo anterior a `champollion.config.json.bak` (cuando esa copia de respaldo ya contiene un archivo más antiguo, la siguiente es `.bak.2`, `.bak.3` …; una copia de respaldo más antigua nunca se sobrescribe). Un archivo que no sea JSON válido no se puede conservar: se respalda y se escribe uno nuevo. Para cambiar una sola configuración, edítela directamente en el archivo; `init` nunca necesita ejecutarse de nuevo para eso.

**Cómo encontrar sus archivos de configuración regional**: `init` busca el archivo de su idioma de origen antes de escribir nada. Primero verifica la carpeta habitual de su framework (next-intl `messages/`, i18next `public/locales/<lang>/` y luego `locales/<lang>/`, vue-i18n `src/locales/`, Hugo `i18n/`), luego `locales`, `messages`, `i18n`, `lang`, `translations`, `public/locales`, `src/locales` y `src/i18n`, e imprime lo que encontró. Nunca escribe un `localesDir` que no exista. Consulte [Estructuras de archivos de configuración regional](/docs/getting-started/configuration#locale-layouts).

**Opción `--langs`**: Lista separada por comas de códigos de idiomas destino. Omite la solicitud interactiva de idiomas y aplica el ajuste predeterminado de registro de cada idioma —escrito en la configuración para que la elección sea visible y editable: `"languages": { "fr": "formal-vous", "es": "neutral-latam" }` (cámbielo por otro ajuste predeterminado o por sus propias palabras que describan el tono; un idioma sin ajustes predeterminados se escribe como `{}`). También crea los archivos destino vacíos en su estructura (`fr.json`, o `fr/common.json` para cada espacio de nombres). Combínela con `--yes` para una configuración completamente no interactiva.

**`--method api --endpoint <url>`**: Un servidor que implementa el contrato de API de champollion —por ejemplo, un modelo que usted entrenó, servido por `nmt-forge serve`. `init` escribe un par por destino, la misma entrada que el `DEPLOY.md` junto al modelo: `"pairs": { "en:abc": { "method": "api", "endpoint": "http://127.0.0.1:8378/translate", "acceptsInstructions": false } }`. `--accepts-instructions true|false` indica si el endpoint sigue instrucciones por clave (un modelo entrenado con nmt-forge no lo hace); sin él, `init` toma el valor de un manifiesto de plugin instalado para el mismo endpoint (`.champollion/methods/<name>/method.json`), o lo deja sin especificar. Requiere `--langs` (el endpoint se define por par), y una clave solo para un endpoint fuera de esta máquina (`CHAMPOLLION_API_KEY`). Agregue manualmente un método `fallback` al par, como muestra `DEPLOY.md`.

**Opción `--script`**: Algunos idiomas se escriben en más de una ortografía real —cree de las llanuras (`crk`: `Latn` = Standard Roman Orthography, `Cans` = silabario), serbio (`sr`: `Latn`, `Cyrl`). Champollion no elige una por una comunidad: `sync` se rehúsa a traducir dicho idioma hasta que la configuración especifique una. El asistente lo pregunta; con `--yes`, pase `--script crk=Cans` (varias: `--script crk=Cans,sr=Latn`; con un solo idioma destino, `--script Cans` es suficiente), lo cual escribe `"languages": { "crk": { "script": "Cans" } }`. Sin ella, `init --yes` indica qué idiomas necesitan una elección, enumera las opciones e imprime la línea `"script"` para agregar a la entrada de ese idioma en la configuración.

**Opción `--name`**: Un código de uso privado (`qaa`–`qtz`, para una variedad sin un código confirmado) no tiene ficha de idioma, por lo que `init` lo indica en lugar de pedirle que verifique la ortografía. `--name qaa="Ayta (variety not yet confirmed)"` le asigna el nombre para mostrar que usan los prompts y los reportes, escrito como `"languages": { "qaa": { "name": "Ayta (variety not yet confirmed)" } }` (varios: `--name "qaa=…;qab=…"`). Junto a cada registro, `init` también imprime la guía de género que los prompts de LLM incluyen para el idioma ([Guía de género](/docs/getting-started/configuration#gender-guidance)).

**Presets de idioma**: Cuando se le solicite idiomas de destino, puede escribir nombres de presets:
- `european` → fr, de, es, it, pt, nl
- `asian` → ja, zh, ko
- `global` → fr, es, de, ja, zh, ko, pt, ar
- `nordic` → da, fi, nb, sv

Mezcle presets y códigos individuales: `european, ja` → fr, de, es, it, pt, nl, ja

---

## sync

Traduce claves faltantes y obsoletas en todos los archivos de locale. Ejecuta verificación post-sync de forma predeterminada.

```bash
champollion sync                                   # translate everything
champollion sync --dry-run                         # preview only
champollion sync --dry --list-keys                 # preview AND name every queued key
champollion sync --redo keys:hero.title            # translate one key again (cache still serves)
champollion sync --redo "keys:a.title,a.subtitle"   # several keys
champollion sync --redo 'keys:Welcome\, %(name)s'  # a key with a comma in it (gettext)
champollion sync --pair en:tlh --redo all           # rebuild one whole locale
champollion sync --pair en:tlh --redo all --fresh   # ...bypassing a suspect cache (billed)
champollion sync --redo content                     # re-process all Markdown/MDX (cached text is free; reviewers' edits are kept)
champollion sync --files "docs/guides/**"           # only these content files
champollion sync --redo files:docs/intro.md --fresh # translate one file from scratch (billed)
champollion sync --redo gaps                        # ask again for plural forms a model left out
champollion sync --prune plural-extras              # remove plural keys for forms a language does not have
champollion sync --content-dir ./newsletters       # include a folder of Markdown (Hugo content/ or any folder)
champollion sync --method google-translate          # force Google Translate
champollion sync --concurrency 20                  # 20 parallel API calls (both phases)
champollion sync --json-concurrency 30              # 30 parallel locale translations (JSON)
champollion sync --content-concurrency 8            # 8 parallel content translations
champollion sync --no-verify                        # skip post-sync verification
champollion sync --no-tm                            # skip cache, fresh API calls
```

**Memoria de traducción**: Por defecto, `sync` carga `.champollion/tm.json` y entrega traducciones en caché para valores de origen que no hayan cambiado. Cambiar de modelo no descarta eso: el texto ya traducido con el modelo anterior se reutiliza sin costo alguno, y sync lo indica antes de la estimación de costos. Para que el nuevo modelo los traduzca en su lugar: `--redo all --fresh-on-model-change` —envía las claves que un modelo anterior tradujo, y lo que el nuevo modelo ya tradujo sigue proviniendo de la caché (por sí solo, `--fresh-on-model-change` solo afecta las claves que la ejecución traduce de todos modos). Utilice `--no-tm` para omitir la caché por completo (útil al depurar la calidad). Consulte [Memoria de traducción](/docs/concepts/translation-memory).

**Estimación de costos y `--max-cost`**: La estimación cotiza solo lo que la ejecución facturará. Las claves, campos de front-matter y bloques de Markdown que ya están en la memoria de traducción se cotizan en $0, y la tabla muestra lo que la caché ahorra. Un modelo servido en esta máquina (`local`, o un endpoint de `api`, en `localhost`/`127.0.0.1`/`::1`) muestra `$0 (local)` —sin factura de API; su hardware y consumo eléctrico no se contabilizan. `--max-cost` se compara con esa cifra. Si se supera el límite máximo (cap), o sin una estimación (un método sin precio publicado, como `local` apuntando a otra máquina), sync se detiene antes de cualquier llamada a la API y sale con código `2`; no se traduce ni se escribe nada. La línea final indica cuántas claves se enviaron al modelo y cuántas provinieron de la caché.

Debajo de la tabla, una línea indica la tarifa con la que se calculó la cifra y de dónde provino: para un modelo alojado, el precio por 1M de tokens de entrada y salida de la lista de precios pública de OpenRouter, y cuándo se consultó (`Rate: google/gemini-3.8-flash $0.30 input / $2.50 output per 1M tokens — OpenRouter's price list, read 2026-10-04 14:02 UTC`); para un proveedor directo (`openai`, `anthropic`, `gemini`), la misma lista sustituye el precio propio del proveedor, y cuando la lista no se puede leer (o no tiene un precio para el modelo), se utiliza una copia conservada en champollion, con la fecha en que se verificó por última vez y el motivo; DeepL, Google y Microsoft a partir de su precio publicado por carácter, con su fecha. Es una estimación: la línea indica cuántos tokens (o caracteres) por clave asume, y la factura depende de las longitudes reales. Con `--json`, la estimación incluye el detalle: el `rate` de cada par y el `rates` de la ejecución (`inputPerMillion`, `outputPerMillion` o `perMillionChars`, `tokensPerKey`, `from`, `url`, `fetchedAt` o `verified`).

**Visualizar la solicitud**: `sync --dry --show-prompt [key]` imprime la solicitud exacta que se enviaría al método del par —los mensajes de sistema y de usuario (o, para un endpoint `api`, el cuerpo de la solicitud), generados por el propio código del método, con las claves de API censuradas— y no envía nada. Con una clave (nombrada tal como `--redo keys:` la nombra: `verb␄Open`, `common::nav.home`; un msgid de gettext con una coma puede proporcionarse completo), muestra la solicitud de esa clave independientemente de si está en cola o no. Cuando una ejecución real no enviaría nada para ella (está al día, proviene de la caché o está retenida), lo indica y menciona el comando `--redo keys:<key> --fresh` que la enviaría. Sin una clave, muestra el primer lote que enviaría cada archivo, o indica que no se enviaría nada. Así es como se verifica que un `msgctxt` de gettext, un comentario de `#.` o una descripción de ARB lleguen al modelo. A los motores de traducción automática (DeepL, Google…) solo se les envía el texto de origen; la vista previa así lo indica. Con `--json`, cada solicitud es una línea `{"level": "event", "event": "request", …}`.

**Ejecuciones de prueba (dry runs)**: `--dry` no traduce nada ni escribe nada, pero comprueba primero lo que la ejecución real verificaría: cuando falta una clave que el método necesita (`OPENROUTER_API_KEY`, `DEEPL_API_KEY`, …), advierte que la ejecución real se detendría y menciona el nombre de la variable. Comprueba que la clave esté configurada, no que funcione: no se envía nada, por lo que un marcador de posición pasa la prueba. Aun así, sale con código `0` —una vista previa nunca falla (consulte [códigos de salida](#sync-exit-codes)). Lo mismo ocurre con `--max-cost`: una ejecución de prueba no se detiene en el límite máximo, pero cuando la estimación lo supera (o es desconocida), indica, una vez al final, que la ejecución real se detendría allí y saldría con código `2`. Con `--json`, cada línea es un objeto JSON con un `level` (`info`, `ok`, `event` en stdout; `warn`, `error` en stderr), y la última línea de stdout es el resumen, `{"level": "summary", "command": "sync", …}`, que incluye `preflight: { ready, failures }`, con un límite `maxCost: { cap, estimatedCost, wouldStop, exitCode }` y `realRun: { exitCode, wouldStop, reasons }` —el código de salida con el que terminaría la ejecución real, hasta donde una vista previa puede determinar (consulte [códigos de salida](#sync-exit-codes)). Ejecútelo con los flags que utiliza el sync real (`--method`, `--model`): sin ellos, comprueba el método que especifica la configuración. El código de salida propio de una ejecución de prueba nunca hace fallar un paso de CI, por lo que su advertencia `--max-cost` indica cómo condicionar uno: lea `maxCost.wouldStop` (o `realRun.exitCode`) del resumen de `--json` —por ejemplo `jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)'`. El [paso de verificación de la guía de CI](/docs/guides/ci-cd#check-before-sync) hace eso y, cuando falla, imprime el motivo (`realRun.reasons`) en lugar de un simple `false`. El `totalPluralGaps` de la ejecución de prueba cuenta los mensajes en plural en disco que carecen de una forma que el idioma utiliza y que la ejecución real no volvería a solicitar, y `verify` es `{ "ran": false }` (no se escribió nada, por lo que no se verificó nada).

**Traducir de nuevo**: `--redo` indica *qué* traducir de nuevo y `--fresh` indica *si se debe pagar por ello*. Sin `--fresh`, todo lo que la caché ya contiene se recupera sin costo (y aun así pasa el filtro de calidad); con él, todo lo que esté en cola se traduce de nuevo y se factura. Los flags anteriores (`--force`, `--force-keys`, `--force-content`, `--retranslate`, `--no-tm`) siguen funcionando y significan exactamente lo que indica la tabla.

**Delimitar el alcance a archivos**: `--files` limita el paso de contenido a los archivos que coincidan, y `--redo files:<glob> --fresh` fuerza traducciones nuevas para los archivos coincidentes (el único gasto deliberado repetido). Los patrones coinciden con las rutas que sync imprime (relativas a `contentDir`, `2026-10.md`) y con la misma ruta desde la raíz del proyecto (`newsletter/2026-10.md`): `*` se mantiene dentro de una carpeta y `**` cruza carpetas. Ambos flags pueden repetirse. Un patrón que no coincida con ningún archivo detiene la ejecución antes de incurrir en algún gasto. El paso de clave-valor ya es incremental y se ejecuta como de costumbre.

**Fallos**: El fallo de un archivo de contenido no detiene a los demás. Los archivos que tuvieron éxito se registran y sus traducciones se guardan en caché, y la ejecución finaliza con una lista de los archivos fallidos y en qué estado quedó cada uno. Una línea de archivo nunca muestra `[OK]` cuando las claves en él no fueron traducidas. El resumen de fallos indica, por clave, qué hará el siguiente sync: preguntar de nuevo (no hubo respuesta utilizable), preguntar una vez más (pendiente de un redo) o retenerla (rechazada por el filtro de calidad). Los bloques de Markdown y los campos de front-matter que el filtro rechazó se retienen de la misma forma, por página; `--redo files:<page>` o `--redo content` vuelve a preguntar ([Filtro de calidad](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields)). El código de salida es `0` (todo correcto), `2` (parcial: se realizó parte del trabajo, algo falló, fue retenido o no se verificó, un mensaje en plural se escribió sin una forma que el idioma utiliza para recuentos ordinarios —o se detuvo por `--max-cost` antes de gastar nada) o `1` (nada tuvo éxito).

**Detección de cambios**: champollion almacena hashes SHA-256 en `.champollion.lock`. Cuando los valores de origen cambian, el siguiente sync vuelve a traducir automáticamente esas claves. Haga commit del archivo lock para que todos los desarrolladores compartan la misma línea base. El archivo lock también registra, por configuración regional de destino, una huella digital de cada valor que sync escribió (de modo que un valor editado por una persona sea reconocido y conservado durante los redos masivos — [Edición de traducciones](/docs/guides/professional-translators#editing-key-value-files)), las claves que un redo no pudo terminar (**pending**: el siguiente sync las solicitará una vez más) y las claves que el filtro de calidad rechazó (**held back**: no se reenvían al mismo modelo en un sync normal — [Filtro de calidad](/docs/concepts/quality-gate#refused-keys-are-held-back)).

**Ediciones manuales y repeticiones (redos)**: `--redo all`, `--force` y un cambio de modelo conservan los valores que una persona editó e indican cuáles; `--redo keys:<key>` especificando una clave la reemplaza; una clave cuyo origen cambió se traduce de nuevo. Una edición reemplazada se imprime y se añade a `.champollion-replaced-edits.jsonl` (con seguimiento: haga commit de él junto con el lock).

**Claves gettext con contexto**: una clave es `msgctxt` + U+0004 + `msgid`. Los reportes imprimen el separador como `␄`, el cual `--redo keys:` y `--force-keys` aceptan; para escribir una, introduzca `\x04`: `--redo 'keys:django::verb\x04Open'` (las comillas simples conservan la barra invertida). Ambas grafías funcionan. Los comandos de reparación imprimen la forma `␄`, seguida de un comentario de shell que indica `\x04`.

**Una clave especificada que no coincide con nada**: `--redo keys:` / `--force-keys` con un nombre que ninguna clave de origen tiene (un error tipográfico o un msgid que solo existe con contexto) falla con código de salida 1. El error enumera las claves más cercanas, incluida cada variante de contexto de ese msgid, en ambas grafías. Cuando ninguno de los nombres coincide, no se ejecuta nada. Cuando algunos coinciden, esos se rehacen y luego la ejecución falla nombrando el resto.

**Una clave especificada servida desde la caché**: sin `--fresh`, un redo entrega lo que contiene la caché (verificado de nuevo, sin costo) y así lo indica, junto con el comando `--fresh` que vuelve a consultar al modelo y su costo.

**Paralelismo**: Tanto la traducción de claves JSON como la traducción de contenido se ejecutan en paralelo. Los locales JSON se traducen simultáneamente (predeterminado: 200 locales concurrentes), con lotes dentro de cada locale también paralelizados (4 lotes concurrentes). La traducción de contenido (Markdown, MDX, publicaciones de blog) se ejecuta en un grupo de elementos de trabajo plano (predeterminado: 48 llamadas API concurrentes). Anule con `--json-concurrency`, `--content-concurrency`, o `--concurrency` (establece ambos).

**Salida**: Sync muestra un banner de versión, detección de formato/framework, estimación de costo y barras de progreso por locale:

```
champollion v0.1.0

[INFO] Detected format: json (auto)
[INFO] Source: en.json (2,847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl

[INFO] es-MX.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 5,694 keys total.
```

Las barras de progreso se actualizan in situ después de cada lote (~80 claves). Utilice `--quiet` únicamente para errores/advertencias, o `--json` para una salida NDJSON legible por máquina. Ambos suprimen la barra de progreso y el banner. Con `--json`, llega un evento `cost` antes del filtro `--max-cost`, llega un evento `file` por cada archivo de contenido y configuración regional, y un `summary` cierra cada ejecución.

### Códigos de salida {#sync-exit-codes}

| Código | Una ejecución real | Una ejecución de prueba (`--dry`) |
|------|------------|---------------------|
| `0` | Todo lo que estaba en cola fue traducido y verificado, o no había nada en cola. | Se ejecutó — incluso si indica que la ejecución real se detendría. |
| `2` | Parcial: se realizó parte del trabajo, pero algo falló, fue retenido o no se verificó, o un mensaje en plural se escribió sin una forma que el idioma utiliza para recuentos ordinarios. También: `--max-cost` detuvo la ejecución antes de enviar nada. | Nunca. |
| `1` | Nada tuvo éxito o la ejecución no pudo comenzar: falta una clave que el método necesita, un servidor de modelos requerido no responde, una clave especificada para un redo no coincide con nada, un patrón `--files` no coincide con ningún archivo o la configuración no es válida. | La ejecución de prueba misma no pudo ejecutarse: una clave especificada para un redo no coincide con nada, un patrón `--files` no coincide con ningún archivo o la configuración no es válida. |

Una ejecución de prueba sale con código `0` a propósito: es la vista previa que usted ejecuta antes de decidir, y un paso de CI que solo observa no debe fallar. Lo que haría la ejecución real se encuentra en las últimas líneas de la ejecución de prueba y en su resumen `--json`: `preflight.ready: false` significa que la ejecución real se detendría antes de traducir y saldría con código `1` (`preflight.failures` explica por qué); `maxCost.wouldStop: true` significa que se detendría en el límite máximo y saldría con código `2` (`maxCost.exitCode: 2`); `maxCost.exitCode: 1`, con `maxCost.stopsEarlier`, significa que la verificación previa la detendría antes de comprobar el límite. `realRun.exitCode` los reúne junto con aquello que dejaría la ejecución real en estado parcial: claves retenidas, o mensajes en plural en disco sin una forma que el idioma utiliza y que no volvería a solicitar (`2`; `realRun.reasons` los enumera, y la última línea de la ejecución de prueba así lo indica). Un rechazo por parte del filtro de calidad o una verificación fallida, que solo la ejecución real puede detectar, aún puede convertir un `0` previsto en un `2`. El [paso de verificación de la guía de CI](/docs/guides/ci-cd#check-before-sync) los convierte en un paso de CI fallido que imprime la razón.

---

## watch

Sincronización automática cuando cambia el archivo de locale de origen. Se ejecuta hasta que se interrumpe con `Ctrl+C`.

```bash
champollion watch
```

---

## audit

El filtro de completitud. Enumera cada clave que no está traducida —faltante, vacía o que aún es un fallback de `[EN]`— y cada traducción que está **desactualizada** (**out of date**): generada a partir de un texto de origen anterior al actual (según `.champollion.lock`; una edición en el origen cuya retraducción falló deja exactamente esto). Cada lista de traducciones desactualizadas termina con el comando que la vuelve a traducir. Sale con código 1 si se encuentra alguna; utilícelo como filtro de CI para hacer fallar compilaciones con traducciones incompletas u obsoletas.

```bash
champollion audit
champollion audit --json   # summary carries untranslatedKeys and outOfDateKeys per locale
```

---

## verify

Vuelve a leer todos los archivos de locale del disco y verifica que las traducciones estén realmente presentes y sean correctas. Esta es la misma verificación que se ejecuta automáticamente al final de cada `sync` (a menos que se pase `--no-verify`).

```bash
champollion verify                    # verify all locale files
champollion verify --warn-only        # non-blocking
champollion verify --strict           # warnings fail too
champollion verify && echo "All good" # CI gate
champollion verify --json             # one "verify" record per locale (NDJSON)
```

**Qué comprueba:**
- Paridad de claves — todas las claves de origen presentes en cada destino (para claves de plurales en i18next, las claves de las propias formas de plural de CLDR de la configuración regional: el francés también necesita `count_many`)
- Marcadores de fallback `[EN]` de ejecuciones anteriores
- Traducciones vacías
- Cumplimiento de sistema de escritura (script) — una configuración regional no latina no debe contener texto exclusivamente en alfabeto latino; las letras se clasifican por script de Unicode, por lo que el latín acentuado y de ancho completo cuentan como latín. Las letras latinas de ancho completo son un error en cualquier configuración regional fuera de la tipografía CJK
- Marcadores de posición, donde cada hallazgo se identifica por la sintaxis involucrada — estructura de ICU MessageFormat (`ICU structure error`: un argumento `{name}`, una palabra clave o selector de plural/select traducido, un `#` perdido), conversiones printf (`printf/python-format placeholder mismatch`: `%s`, `%d`, `%(name)s` — un `%(name)s` perdido en un catálogo gettext se clasifica como printf, no ICU), interpolación de i18next (`i18next {{…}} placeholder mismatch`: `{{name}}`, incluyendo `{{name}}` escrito como `{name}`, que i18next imprime tal cual) y un `{name}` con una sola llave fuera de un mensaje ICU (`{…} placeholder mismatch`)
- Marcado (markup) — por cada nombre de etiqueta, las mismas etiquetas de apertura, cierre y autocierre que el origen, anidadas de la misma manera (un `</strong>` perdido es un error)
- Problemas de codificación — marcas BOM, caracteres invisibles
- Ecos del origen — valores idénticos al origen (advertencia)
- Formas de plural — un mensaje en plural sin una forma que el idioma utiliza para recuentos ordinarios (ruso `few`/`many`), una entrada de gettext cuyas formas solo repiten `other` (sync las marca con un comentario `# champollion:`), una clave i18next o `msgstr[n]` para una forma que el idioma no posee (advertencias)
- Configuraciones regionales idénticas — dos configuraciones regionales de destino con el mismo texto para la mayoría de las claves: una probablemente esté en el idioma de la otra (advertencia)
- Mismo texto, orígenes diferentes — un mismo texto generado para varias cadenas de origen distintas (un modelo que repite una oración memorizada): dos cadenas multipalabra claramente distintas respondidas con el mismo texto de cuatro o más palabras, o de tres o más en otros casos; una oración que un sync previo detectó que el modelo repetía cuenta incluso una sola vez. Se contabiliza sobre los valores de las claves, cada rama de plural/select de ICU (las ramas de un mismo plural cuentan como un solo origen) y las páginas de Markdown de la configuración regional (campos de front-matter y bloques; dejando de lado `# ` y la puntuación final), bajo la misma regla con la que el filtro de `sync` lo rechaza (error)
- Desactualizado — una traducción realizada a partir de un texto de origen anterior al actual (advertencia aquí; `audit` falla por esto)
- Signo de interrogación o exclamación omitido — el origen termina en `?` o `!` y la traducción no termina ni con eso ni con el equivalente del sistema de escritura de destino (`？`, `؟`, griego `;`, …). Es una advertencia: algunos idiomas marcan una pregunta con una palabra o partícula en su lugar

Comprueba la estructura, no el significado: una validación exitosa indica que las claves, los marcadores de posición, los plurales,
el marcado y el sistema de escritura están intactos, no que el texto diga lo correcto; solicite
la revisión de un hablante antes de depender de él.

**Qué configuraciones regionales.** `verify` comprueba todas las configuraciones regionales; `verify --pair en:fr` comprueba
únicamente el francés. Después de `sync --pair en:fr`, la comprobación posterior a sync cubre los pares
que se ejecutaron, ningún otro. Una verificación delimitada lo indica en su línea de cierre — `Verification
passed for fr: … intact (only en:fr was synced; champollion verify checks every
locale)` — and never "in every locale"; with `--json` esa línea incluye
`checked` (las configuraciones regionales comprobadas) y `scope`.

**Cobertura de plurales.** El bloque de cada configuración regional tiene una línea por cada tipo de plural que
contienen sus archivos —claves con sufijo de i18next, mensajes en plural de ICU, entradas
`msgid_plural` de gettext—, indicando las formas que se espera que tenga la configuración regional
(las categorías de plural de CLDR para ella; en un catálogo gettext, aquellas para las que su
`Plural-Forms` tiene un espacio) y si cada plural cuenta con ellas:

```text
  ── fr ──────────────────────────────────────
  [OK] 7/7 keys present
  Plural forms (CLDR fr): one, many, other ✓ — 2 i18next plural key group(s), every form present
```

`✗` nombra los plurales que carecen de una forma. Una forma que solo utilizan números mayores a 1000 o
fracciones (`many` en francés en un mensaje ICU) se menciona por separado: la forma `other`
la sustituye, lo cual no constituye un hallazgo. La línea es un resumen —una
forma faltante también es un hallazgo anterior a ella (una clave faltante, una advertencia de plural).

**`--json`** escribe un objeto JSON por línea. Cada configuración regional recibe un registro en
stdout — `{"level": "event", "event": "verify", "locale": "fr", …}` — con
`ok`, `keys` (`expected`, `present`, `missing`, `extra`), su `errors`,
`warnings` y `infos`, `placeholders` (cada hallazgo con su `syntax`: `icu`,
`printf`, `i18next`, `brace` o `markup`) y `plurals` (por clase y tipo:
`categories`, `total`, `complete`, `incomplete`). Los hallazgos también son
líneas `error`/`warn` en stderr, y la línea de cierre conserva su nivel y
mensaje (`ok` en stdout cuando la comprobación es exitosa, `error` en stderr cuando no lo
es) y contiene los recuentos de `errors` y `warnings`. Después de un sync, los mismos
registros aparecen antes del resumen propio de sync. (Los registros de un proyecto Docusaurus
no contienen `keys` ni `plurals`: sus cadenas de interfaz de usuario se comprueban archivo por archivo).

```bash
npx champollion verify --json 2>/dev/null | jq -c 'select(.event == "verify") | {locale, plurals}'
```

**Código de salida:** `1` cuando encontró un error —o cuando no pudo comprobar absolutamente
nada (el archivo fuente o la carpeta de configuraciones regionales no está donde apunta la configuración;
la línea de error indica la ruta y la configuración)—, `0` en caso contrario. Las advertencias no
hacen que falle a menos que pase `--strict`, el cual sale con código `1` ante cualquier advertencia (una integración continua que
no debe desplegar, por ejemplo, plurales en ruso sin sus formas `few`/`many`) y termina
con una línea `[FAIL]`, nunca una `[OK]`; `--warn-only` hace que los errores salgan con `0`
también. Una configuración regional cuyo recuento de claves no coincida lo indica en lugar de `[OK]`:
`8 expected, 9 present (1 extra: count_two)`.

---

## lint

Escanea el código fuente en busca de cadenas de cara al usuario codificadas que deberían usar llamadas de traducción i18n. Detecta automáticamente su framework (next-intl, react-i18next, vue-i18n, Hugo).

```bash
champollion lint                    # exits 1 if issues found (or no source files were found)
champollion lint --warn-only        # always exits 0
champollion lint --src ./app        # custom source directory
champollion lint --min-length 4     # minimum string length to flag
```

**Lo que detecta:**
- Cadenas codificadas en texto JSX, `placeholder`, `alt`, `aria-label`, `title`
- Archivos con contenido de cara al usuario pero sin importación de framework i18n
- Claves muertas — claves de locale que ningún archivo de origen referencia
- Puntuación de cobertura — porcentaje de cadenas que pasan por i18n

**Exclusiones**: Cree `.champollionignore` en la raíz de su proyecto (patrones glob, como `.gitignore`).

**No tener nada que analizar es un fallo**: cuando ningún archivo de origen coincide (las carpetas predeterminadas del framework —`src/`, `app/`, `pages/`, `components/` para proyectos web— o su `--src`), lint sale con código `1` e indica las carpetas y extensiones que buscó. Un lint que no comprobó nada no debe pasar un filtro de CI; apúntelo a su código con `--src <dir>` o `"lint": { "srcDir": "<dir>" }`.

---

## wrap

Envuelve automáticamente cadenas codificadas detectadas por `lint` en llamadas `t()`. Crea copias de seguridad automáticas antes de modificar archivos.

```bash
champollion wrap                    # auto-wrap with backup
champollion wrap --dry              # preview wrapping changes
champollion wrap --undo             # restore from .champollion-backup/
```

**Puertas de seguridad:**
1. Verificación de limpieza de Git (omitida en ejecución en seco)
2. Copia de seguridad automática a `.champollion-backup/`
3. Vista previa de diferencias antes de cada escritura de archivo
4. Soporte `--undo` para restaurar desde copia de seguridad

---

## seo

Genere artefactos SEO para sitios multilingües.

```bash
champollion seo hreflang                                        # print hreflang tags
champollion seo sitemap --base-url https://example.com --out sitemap.xml
champollion seo jsonld --base-url https://example.com           # JSON-LD schema
```

| Subcomando | Salida |
|------------|--------|
| `hreflang` | Etiquetas `<link rel="alternate" hreflang>` |
| `sitemap` | `sitemap.xml` multilingüe |
| `jsonld` | Esquema JSON-LD WebSite de idioma |

---

## integrity

Detecta corrupción y desviación en archivos de locale traducidos.

```bash
champollion integrity               # exits 1 if issues found
champollion integrity --warn-only   # non-blocking
```

**Qué comprueba:**
- Corrupción de marcadores de posición (p. ej., `{name}` presente en el origen pero ausente en el destino)
- Problemas de codificación (mojibake, Unicode inválido)
- Copias sin traducir (valor de destino idéntico al origen) — las claves [`noTranslate`](/docs/getting-started/configuration#no-translate) están exentas, al igual que los ecos que la memoria de traducción confirma como generados por el pipeline y aprobados por el filtro. Lo que permanece marcado es exactamente lo que `sync` volvería a poner en cola —las dos herramientas no pueden discrepar sobre un archivo en buen estado
- Desviación de no-translate (una clave `noTranslate` que *no* es idéntica al origen) — se reporta con los valores esperado/real y los caracteres invisibles escapados; ejecute `champollion sync` para reparar
- PUA inesperada (puntos de código de Private Use Area en una configuración regional cuya [conversión de sistema de escritura](/docs/getting-started/configuration#script-conversion) está desactivada —se representa en blanco sin una fuente especial); ejecute `champollion repair-script` para reparar
- Valores vaciados (hollowed values: un destino que es su origen con las letras eliminadas —daño originado por un pipeline anterior al filtro de preservación de contenido); vuelva a traducir con `sync --force-keys <key>` o `sync --pair <pair> --force`
- Claves huérfanas (claves en el destino que no existen en el origen)
- Completitud de categorías de plural de ICU MessageFormat (p. ej., el árabe necesita 6 categorías) —bajo la misma regla que usan `sync` y `verify`: una forma faltante que los recuentos ordinarios alcanzan (ruso `few`/`many`) es una advertencia; una a la que solo llegan números superiores a 1000 o fracciones (francés `many`, usado para 1 000 000) es una nota, ya que allí se utiliza la forma `other`

---

## repair-script

Revierte la conversión de escritura que nunca debió haber ocurrido: los valores codificados en PUA (pIqaD, tengwar, kryptoniano) en configuraciones regionales cuya configuración indica que la conversión está desactivada se restauran a la romanización mediante la propia tabla inversa del conversor.

```bash
champollion repair-script --dry     # preview
champollion repair-script           # repair in place
```

| Opción | Efecto |
|--------|--------|
| `--dry` | Previsualizar las reparaciones sin escribir |
| `--locale <code>` | Reparar solo una configuración regional |
| `--json` | Salida JSON legible por máquina |
| `--warn-only` | Salir con código 0 incluso si queda PUA irreversible |

pIqaD se revierte de forma exacta. Las reversiones de tengwar y kryptoniano no pueden recuperar las mayúsculas (se marcan como con pérdida de mayúsculas/minúsculas). La memoria de traducción no necesita reparación: almacena valores previos a la conversión. Sale con código 1 cuando permanece PUA que ningún conversor registrado puede revertir.

---

## tm

Administre la caché de Memoria de traducción (`.champollion/tm.json`). TM almacena traducciones anteriores y las sirve en sincronizaciones posteriores en lugar de llamar a la API.

```bash
champollion tm stats                  # show cache statistics
champollion tm clear                  # clear cache (with confirmation)
champollion tm clear --yes            # clear without confirmation
champollion tm clear --locale fr      # clear only French entries
```

| Subcomando | Salida |
|------------|--------|
| `stats` | Recuento de entradas, tamaño de archivo, desglose por locale |
| `clear` | Eliminar archivo de caché (completo o por locale) |

| Opción | Efecto |
|--------|--------|
| `--locale <code>` | Borrar solo entradas para un locale |
| `--yes` | Omitir solicitud de confirmación |

Consulte [Memoria de traducción](/docs/concepts/translation-memory) para saber cómo funciona TM y cuándo borrarlo.

---

## xliff

Exporte e importe archivos XLIFF 1.2 para revisión de traductores profesionales. XLIFF es el formato de intercambio universal compatible con herramientas CAT como memoQ, SDL Trados y Phrase.

```bash
champollion xliff export --locale fr                   # export French XLIFF
champollion xliff export --locale ja --out ./review/   # custom output path
champollion xliff import .champollion/xliff/fr.xliff       # import reviewed file
champollion xliff import ./reviewed.xliff --dry        # preview import
```

| Subcomando | Salida |
|------------|--------|
| `export` | Genere `.xliff` desde archivos de locale de origen + destino |
| `import` | Combine traducciones `.xliff` revisadas en archivos de locale |

| Opción | Efecto |
|--------|--------|
| `--locale <code>` | Locale de destino para exportación (requerido) |
| `--out <path>` | Ruta o directorio de salida personalizado |
| `--dry` | Vista previa de importación sin escribir |

Consulte [Trabajar con traductores profesionales](/docs/guides/professional-translators) para el flujo de trabajo completo.

---

## status

Muestra la configuración de pares, los plugins instalados y las puntuaciones de benchmarks.

Un par cuya configuración define `qualityTier` (`standard`, `high`, `research` o
`verified`) lo muestra, presentándolo como lo que es: una etiqueta que usted eligió, no una
medición —sync traduce lo mismo independientemente de lo que diga, y `serve`
lo promociona. Un par que no define uno muestra none (`--json` todavía tiene
`qualityTier`, con `qualityTierSet: false`).

```bash
champollion status
```

Después de un cambio de modelo, también indica si los archivos de una configuración regional combinan texto de más
de un modelo (a partir de la memoria de traducción: qué modelo produjo cada valor
en disco), junto con el comando para que el modelo actual traduzca los que escribió
un modelo anterior — `sync --pair <pair> --redo all --fresh-on-model-change`.
Para un método que ejecuta un modelo que usted elija (`local`, `api`, `external`),
repite la nota de licencia que la primera sincronización imprimió una vez. Para un método
compatible con OpenAI (`local`, `openai`), muestra la dirección a la que van las solicitudes y el ajuste
que la eligió: `LOCAL_API_BASE` en el entorno o en `.env`, o el valor predeterminado
(Ollama, `http://localhost:11434/v1`). Con un `contentDir`, lista la carpeta de contenido
junto a los archivos de clave-valor, indicando cuántas páginas de origen contiene y,
por idioma, cuántas traducciones están al día, desactualizadas o pendientes.
Pendiente significa que aún no hay traducción, o que partes rechazadas por el control de calidad quedaron en el idioma de origen (el bloqueo de contenido indica `pending:<hash>`).
Debajo de cada registro, muestra las pautas de género que llevan los prompts del LLM y de dónde
provienen (el valor predeterminado de Champollion para el idioma, su configuración, o desactivado —
consulte [Pautas de género](/docs/getting-started/configuration#gender-guidance)).
Para un par con respaldo (fallback), cuenta cuántos valores en los archivos escribió
el respaldo y nombra los primeros.
`--json` incluye lo mismo que `requestsGoTo` (en un par o respaldo con dicho endpoint), `content`, `genderGuidance` y `fallback.valuesInFiles`.

---

## provenance

Audite licencias de recursos de traducción para todos los plugins instalados.

```bash
champollion provenance
```

---

## plugin

Administre plugins de método de traducción. Los plugins son recetas de traducción preempaquetadas instaladas en `.champollion/methods/`.

```bash
champollion plugin list                      # show installed plugins
champollion plugin install ./my-method/      # install from local directory
champollion plugin remove my-method          # remove a plugin
```

Consulte [Especificación de plugin](/docs/reference/plugin-spec) para el formato de manifiesto del plugin.

---

## leaderboard

`champollion network leaderboard` (también funciona como `champollion leaderboard`). Explore, busque e instale métodos de traducción desde la tabla de clasificación de Network. Los métodos instalados desde la tabla de clasificación incluyen puntuaciones de benchmarks y la MethodConfig canónica completa: la configuración exacta utilizada durante la evaluación.

```bash
champollion network leaderboard                       # show leaderboard
champollion network leaderboard --pair "eng>fra"      # filter by language pair (quote the >)
champollion network leaderboard --install 1           # install the method ranked 1 as a plugin
champollion network leaderboard --install 1 --apply   # install + patch config
```

| Opción | Efecto |
|--------|--------|
| `--pair <pair>` | Filtrar por par de idiomas, tal como lo escribe la tabla: `"eng>fra"` (ISO 639-3; entrecomille el `>`). `eng-fra` y `eng:fra` también funcionan, y se resuelve un código de 2 letras (`en` → `eng`) |
| `--install <rank>` | Instalar como plugin el método en esa posición (tal como aparece listado) |
| `--apply` | Tras la instalación, agregar automáticamente `methodPlugin` a `champollion.config.json` |

**Flujo de trabajo `--apply`**: Cuando instala con `--apply`, champollion escribe el plugin de método en `.champollion/methods/` **y** parcha su `champollion.config.json` para usarlo en el par relevante. Este es el camino más rápido desde "¿qué tiene la mejor puntuación?" a "Lo estoy usando en producción."

---

## fonts

Descarga y administra fuentes web PUA para convertidores de scripts de lenguajes construidos. Los idiomas que usan caracteres de Área de Uso Privado (Klingon, Sindarin, Kryptoniano) necesitan fuentes web personalizadas para renderizar sus scripts. Este comando las descarga desde repositorios de código abierto verificados.

```bash
champollion fonts list                           # show needed fonts
champollion fonts install                        # download all needed fonts
champollion fonts install --css                  # also generate CSS snippet
champollion fonts install --dir ./public/fonts   # custom output directory
```

| Subcomando | Salida |
|------------|--------|
| `list` | Muestra qué fuentes PUA se necesitan y su estado de instalación |
| `install` | Descarga fuentes para idiomas configurados |

| Opción | Efecto |
|--------|--------|
| `--dir <path>` | Anule el directorio de salida de fuentes (detectado automáticamente del tipo de proyecto) |
| `--css` | Genere un fragmento `conlang-fonts.css` junto con las fuentes |
| `--config <path>` | Ruta al archivo de configuración (se usa para detectar qué idiomas necesitan fuentes) |

**Detección automática:** El directorio de salida se deduce de su estructura de proyecto:
- **Docusaurus** → `static/fonts/` o `website/static/fonts/`
- **Hugo** → `static/fonts/`
- **Predeterminado** → `public/fonts/`

**Convertidores Unicode nativos** (`crk` → Sílabas Cree, `sr` → Cirílico serbio) NO requieren instalación de fuentes.

Consulte [Conlangs, Scripts y Ortografía](/docs/guides/conlangs-scripts-orthography) para detalles completos de fuentes PUA.

## Canalización de tres capas

Use `lint`, `sync` y `audit` juntos para i18n a prueba de balas:

```json title="package.json"
{
  "scripts": {
    "i18n:lint": "champollion lint",
    "i18n:sync": "champollion sync",
    "i18n:audit": "champollion audit"
  }
}
```

| Capa | Comando | Cuándo | Propósito |
|-------|---------|--------|---------|
| **Lint** | `lint` | Pre-commit | Bloquee commits con cadenas codificadas |
| **Sync** | `sync` | Post-commit / CI | Traduzca claves faltantes y cambiadas |
| **Verify** | `verify` | Post-sync / CI | Confirme que las traducciones estén presentes y sean correctas |
| **Audit** | `audit` | Paso de compilación | Falle la implementación si algún locale tiene marcadores `[EN]` |

---

## Consulte también

- [Configuración](/docs/getting-started/configuration) — referencia de archivo de configuración
- [Métodos de traducción](/docs/guides/translation-methods) — selección de método por par
- [Memoria de traducción](/docs/concepts/translation-memory) — caché y ahorros de costo
- [Trabajar con traductores profesionales](/docs/guides/professional-translators) — flujo de trabajo XLIFF
- [Especificación de plugin](/docs/reference/plugin-spec) — formato de manifiesto del plugin
- [Guía de CI/CD](/docs/guides/ci-cd) — automatización de comandos CLI en su canalización
- [Cómo funciona Sync](/docs/concepts/how-sync-works) — comprensión de la canalización de sincronización
- [Puerta de calidad](/docs/concepts/quality-gate) — cómo se validan las traducciones
