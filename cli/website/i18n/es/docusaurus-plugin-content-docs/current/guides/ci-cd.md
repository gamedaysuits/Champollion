---
sidebar_position: 3
title: "CI/CD"
---

# Integración de CI/CD

Automatice las traducciones en su pipeline de compilación.

La CLI de champollion es de código disponible bajo la [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE): libre de usar, modificar y compartir para fines no comerciales. Su uso con fines comerciales no está cubierto por esta licencia ([quién puede usar esto](/docs/getting-started/who-may-use-this)).

## GitHub Actions: mantenga las traducciones sincronizadas

Un flujo de trabajo completo: traduzca lo que cambió, verifique el resultado y confírmelo
de vuelta. Funciona para cualquier proyecto — sea de Node o no (Django, Flutter, Hugo).

```yaml title=".github/workflows/i18n-sync.yml"
name: Sync translations
on:
  push:
    branches: [main]
    # Run only when something sync reads changed: the SOURCE locale files
    # (edit these to the files your config's "localesDir"/"localesPattern"
    # names) and the config. A push that changes neither has nothing to
    # translate, so it starts no job and needs no key.
    paths:
      - 'locales/en.json'       # one file per language
      - 'locales/en/**'         # or one folder per language (i18next: public/locales/en/**)
      - 'champollion.config.json'
  # Run workflow (by hand). The box asks again for plural forms a model
  # left out (--redo gaps; see "Plural forms a model left out" below).
  workflow_dispatch:
    inputs:
      redo_gaps:
        description: 'Ask again for plural forms a model left out (--redo gaps)'
        type: boolean
        default: false

permissions:
  contents: write          # lets the job push the translated files back

# One sync at a time per branch: two quick pushes would otherwise race to
# commit the same files. Queued, not cancelled — a cancelled run may have
# translated (and paid for) work it never committed.
concurrency:
  group: i18n-sync-${{ github.ref }}
  cancel-in-progress: false

# The flags of every `champollion sync` in this job — the sync step below,
# and the dry-run check further down this page, read this one line, so the
# check tests the method this job runs. The config's method runs as it is.
# A runner has no model server: if your config says "local" (a model on
# your machine), name a hosted model here instead, for these runs only
# (the config file is not changed):
#   SYNC_FLAGS: --method llm --model google/gemini-3.8-flash --max-cost 5
env:
  SYNC_FLAGS: --max-cost 5

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24   # a current LTS; champollion needs Node 20.11 or newer
      # The Translation Memory is a per-machine cache, so a fresh runner
      # starts empty. Restoring it means text translated before is served
      # free instead of billed again. No cache is saved under this exact
      # key: restore-keys brings back the branch's newest one.
      - name: Restore the translation cache
        id: cache
        uses: actions/cache/restore@v4
        with:
          path: .champollion
          key: champollion-tm-${{ github.ref_name }}-newest
          restore-keys: champollion-tm-${{ github.ref_name }}-
      - name: Sync translations
        id: sync
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        # Exit 2 = partial: some keys were translated, some were not (refused
        # by the quality gate, held back, a plural form the model left out, or
        # --max-cost stopped the run). What WAS translated is committed below,
        # then the job fails with the reason. Any other non-zero code stops here.
        #
        # $SYNC_FLAGS: the job's flags (env: above). The redo_gaps box of
        # "Run workflow" adds --redo gaps.
        run: |
          set +e
          npx --yes champollion@0.6 sync $SYNC_FLAGS ${{ inputs.redo_gaps && '--redo gaps' || '' }}
          code=$?
          echo "code=$code" >> "$GITHUB_OUTPUT"
          if [ "$code" -ne 0 ] && [ "$code" -ne 2 ]; then exit "$code"; fi
      # Saved even when a step failed: the translations this run paid for
      # stay cached, so the next run does not pay for them again. The key is
      # a hash of the cache's own files, so a run that added nothing to it
      # has the key it restored and skips the save (no new copy). Skipped too
      # when there is no cache folder (a push with nothing to translate on a
      # fresh runner creates none; saving it would log a path warning).
      - name: Save the translation cache
        if: always() && hashFiles('.champollion/**') != '' && steps.cache.outputs.cache-matched-key != format('champollion-tm-{0}-{1}', github.ref_name, hashFiles('.champollion/**'))
        uses: actions/cache/save@v4
        with:
          path: .champollion
          key: champollion-tm-${{ github.ref_name }}-${{ hashFiles('.champollion/**') }}
      - name: Commit updated translations
        run: |
          git config user.name "champollion"
          git config user.email "bot@example.com"
          # The translated files AND the lock files (.champollion.lock,
          # .champollion-content.lock), whatever your locale folders are called
          # — and .champollion-replaced-edits.jsonl when a sync wrote one.
          # .champollion/ (the cache) is in .gitignore — `champollion init` adds it.
          # (gettext: build steps write .mo files — stage only the catalogs; see below.)
          git add --all
          git diff --staged --quiet || git commit -m "chore: sync translations"
          # Someone may have pushed while this job ran: put this commit on
          # top of theirs, so the push does not fail (and waste the spend).
          git pull --rebase origin "$GITHUB_REF_NAME"
          git push origin "HEAD:$GITHUB_REF_NAME"
      # Right after the commit, before verify: on a partial run verify would
      # fail first on the missing keys, and the red step would name a key
      # while the reason sat in a green step.
      - name: Stop when the sync was partial
        if: steps.sync.outputs.code == '2'
        run: |
          echo "::error::champollion sync exit 2: the run stopped at --max-cost before translating, or some keys were not translated (refused by the quality gate, held back, or a plural form left out). What was translated is committed. The 'Sync translations' step's log says which."
          exit 1
      # --strict: a warning fails the job too. Plain verify passes on warnings
      # — an extra or missing plural form, a source echo, an out-of-date
      # translation — so they would ship with a green build.
      - name: Check every locale is complete and intact
        run: npx --yes champollion@0.6 verify --strict
```

**Por qué el flujo de trabajo tiene esta estructura.** `actions/cache` por sí solo guarda la
caché únicamente cuando todo el trabajo tiene éxito, y `sync` sale con `2` cada vez que cualquier clave
es rechazada — de modo que una ejecución parcial solía omitir tanto la confirmación como el guardado de la caché,
y la siguiente ejecución volvía a pagar por las mismas traducciones. Aquí la caché se
restaura y guarda en dos pasos (`actions/cache/restore`, luego
`actions/cache/save` con `if: always()`), el paso de sincronización registra su código de salida
en lugar de fallar en `2`, los archivos traducidos se confirman y solo entonces
falla el trabajo — en su propio paso, antes de `verify`, para que el paso fallido indique
el motivo (una detención por `--max-cost`, o claves que la sincronización no pudo traducir) en lugar de que
`verify` nombre una clave faltante. El último paso es `verify --strict`: un
`verify` normal sale con 0 ante advertencias (una forma plural adicional o faltante entre ellas), y
`--strict` hace fallar el trabajo ante ellas. Una clave que el control de calidad rechazó se recuerda: la siguiente ejecución
no la vuelve a enviar al mismo modelo (facturaría la misma respuesta) —
el registro de sincronización la nombra junto con el comando `--redo keys:` para volver a solicitarla.

**Una copia de caché por cambio, no por ejecución.** El paso de restauración recupera la
caché más reciente de la rama (su clave exacta, `…-newest`, nunca se guarda, por lo que
`restore-keys` elige la más reciente). El paso de guardado indexa la caché según un
hash de sus propios archivos (`hashFiles('.champollion/**')`): una ejecución que tradujo
algo —incluso una parcial, o una cuyo push falló— modificó la caché,
por lo que obtiene una clave nueva y se guarda; una ejecución que no agregó nada (nada que
traducir, todo desde la caché, una detención por `--max-cost`) tiene la clave que
restauró, por lo que el guardado se omite y no se almacena ninguna copia nueva. Indexar por el ID
de ejecución guardaba una copia completa en cada ejecución; indexar por los archivos de bloqueo y de origen
restauraría una copia más antigua por coincidencia exacta tras una ejecución cuyo push fue rechazado,
porque el bloqueo confirmado nunca recibió los cambios de esa ejecución.

En un proyecto de Node puede agregar `champollion` como dependencia de desarrollo y llamar
a `npx champollion sync` en su lugar; la versión fijada de `champollion@0.6` mostrada arriba funciona en cualquier
repositorio y nunca toma una versión diferente por sorpresa. El trabajo debe
instalarla entonces: en un ejecutor nuevo, `npx champollion` sin nada instalado
obtiene la versión más reciente, no la que fija su archivo de bloqueo. Además, la instalación
escribe `node_modules/`, que `git add --all` confirma a menos que su `.gitignore`
lo incluya (el que crea `champollion init` solo incluye `.champollion/`), por lo que debe
preparar los archivos de configuración regional y el archivo de bloqueo por nombre, como hace el flujo de trabajo de Django a continuación:

```yaml title=".github/workflows/i18n-sync.yml (dev dependency)"
# … checkout and setup-node as above; then install the version your
# package-lock.json pins:
      - run: npm ci
# … the cache restore as above. In "Sync translations" and in the last step,
# the installed CLI replaces the pinned one (SYNC_FLAGS as above):
#   npx champollion sync $SYNC_FLAGS ${{ inputs.redo_gaps && '--redo gaps' || '' }}
#   npx champollion verify --strict
# … the cache save as above; then:
      - name: Commit updated translations
        run: |
          git config user.name "champollion"
          git config user.email "bot@example.com"
          # The locale files and the lock file only: not node_modules/ (npm ci
          # just wrote it) and not .champollion/ (the cache). Name your locale
          # folder (messages, public/locales, …); when sync translates Markdown
          # too, add the folders it writes and .champollion-content.lock.
          git add -- locales .champollion.lock
          # A replaced hand edit is recorded here — the only copy of that wording.
          if [ -f .champollion-replaced-edits.jsonl ]; then git add -- .champollion-replaced-edits.jsonl; fi
          git diff --staged --quiet || git commit -m "chore: sync translations"
          git pull --rebase origin "$GITHUB_REF_NAME"
          git push origin "HEAD:$GITHUB_REF_NAME"
```

**Confirme los archivos de bloqueo.** `.champollion.lock` y `.champollion-content.lock`
registran a partir de qué texto de origen se realizó cada traducción. Son el medio por el cual la
siguiente ejecución sabe que una cadena cambió. Un ejecutor que nunca los ve no puede distinguir una
cadena editada de una sin cambios. **No confirme `.champollion/`** — es
la caché por máquina; `champollion init` lo agrega a `.gitignore`.

**`--max-cost`** detiene una ejecución antes de que gaste más de lo previsto; establézcalo en
lo que le cuestan los cambios de un día normal. Cuando detiene una ejecución, no se ha
traducido ni escrito nada y sync sale con el código `2`: no hay nada que confirmar,
y el paso "Stop when the sync was partial" hace fallar el trabajo, indicándolo así. Un método sin precio publicado (un
endpoint autohospedado en otra máquina) no se puede estimar, por lo que `--max-cost` se detiene
siempre que haya algo que traducir — desactívelo para esos casos. Un modelo
servido en el propio ejecutor (`local` en `localhost`/`127.0.0.1`) tiene un costo de API
tasado en $0.

**Solo los pushes que cambian una cadena de origen inician el trabajo.** El filtro
`paths:` enumera sus archivos de configuración regional de origen y `champollion.config.json`: un push
que solo cambie código, o solo traducciones y los archivos de bloqueo, no tiene nada
que traducir, por lo que no inicia ningún trabajo. Edite las dos rutas de configuración regional hacia los archivos que
su configuración indica (`messages/en.json`, `lib/l10n/app_en.arb`, …); agregue su
carpeta `contentDir` cuando sync también traduzca Markdown. **Run workflow** (el
disparador `workflow_dispatch`) todavía permite ejecutarlo manualmente.

**El propio commit del trabajo nunca vuelve a iniciarlo** — y el filtro `paths:` no
es lo que lo detiene. El paso de confirmación hace push con el `GITHUB_TOKEN` del flujo de trabajo,
y un push realizado con `GITHUB_TOKEN` nunca activa la ejecución de un flujo de trabajo (regla de
GitHub para que un flujo de trabajo no pueda iniciarse a sí mismo). Es por eso que el flujo de trabajo de Django
mostrado más abajo puede vigilar `locale/**`, el cual cambia con cada commit del bot.
Si en su lugar hace push con un token de acceso personal o un token de GitHub App (para iniciar
otros flujos de trabajo con el commit del bot, por ejemplo), ese push sí vuelve a iniciar este
flujo de trabajo; en ese caso, el filtro `paths:` es lo que decide. El filtro anterior
excluye los archivos traducidos y los archivos de bloqueo, de modo que el commit del bot
no inicia ninguna ejecución. El `locale/**` del filtro de Django incluye los catálogos que el bot
confirma, por lo que cada uno de sus commits inicia una ejecución adicional —que no encuentra nada que
traducir y no confirma nada—. Con dicho token, limítelo al catálogo
de origen (`locale/en/**`) y agregue idiomas a través de la configuración.

**La clave del proveedor es necesaria en cada ejecución que se inicia**, incluso cuando no hay nada
que traducir: sync comprueba que el método pueda ejecutarse antes de revisar qué
cambió. Una ejecución iniciada a mano sin cambios de origen igual fallará sin el
secreto `OPENROUTER_API_KEY` (o la clave de su método). `local` no necesita clave, pero
un ejecutor no tiene servidor de modelos: un proyecto que traduce con `local` en la
computadora de un desarrollador designa un método alojado en CI (`--method` / `--model` — la
línea comentada `SYNC_FLAGS` en el flujo de trabajo anterior). Para comprobar que el secreto
llegue al paso, sin traducir nada, `sync --dry` advierte cuando la
ejecución real se detendría y nombra la variable faltante (aun así sale con 0 — una ejecución
de prueba es una vista previa). Comprueba que la variable esté **definida**, no que la clave
**funcione**: no envía nada, por lo que cualquier valor no vacío pasa —incluso un marcador de posición—.
Una clave incorrecta o revocada se muestra en la primera solicitud de una ejecución real (el error
indica la respuesta del proveedor, como HTTP 401). Para hacer fallar el trabajo ante una clave faltante
antes de que se ejecute nada, agregue [la verificación previa a la sincronización](#check-before-sync).

**La caché se mantiene por método.** Una traducción se almacena en caché bajo el método,
registro y archivo de coaching que la generó (un modelo distinto del mismo
método la reutiliza — traspaso de modelo). Por lo tanto, un desarrollador que traduce con `local`
y un entorno de CI que traduce con un modelo alojado nunca comparten entradas de caché —
y la caché de CI es propia de todos modos (`.champollion/` no se confirma). Eso no
significa que CI vuelva a traducir el proyecto: lo que ya está en los archivos de configuración regional,
con su archivo de bloqueo confirmado, cuenta como terminado. CI paga al modelo alojado por
las cadenas nuevas o modificadas desde la última confirmación —incluyendo cualquiera que un
desarrollador haya traducido localmente pero no haya confirmado— y nada por el resto.
Volver a traducir todo el proyecto con el modelo alojado (`--redo all`) factura
cada cadena una vez.

**De forma programada** en lugar de en cada push: reemplace el bloque `on:` por
`schedule: [{ cron: '0 6 * * *' }]`.

### Verificación previa a la sincronización: haga fallar el trabajo a tiempo {#check-before-sync}

Una ejecución de prueba sale con `0` sin importar lo que encuentre —es una vista previa—, de modo que `sync --dry
--max-cost 5` advierte que la ejecución real se detendría en el límite y aun así pasa
como paso de CI. Para hacer fallar un trabajo cuando la ejecución real se detendría (una clave faltante o
`--max-cost`), lea el resumen de `sync --dry --json`. Esa salida es
un objeto JSON por línea (NDJSON), cada uno con un `level` —líneas `info`, `ok` y
`event` en stdout, líneas `warn` y `error` en stderr— y la última
línea de stdout es el resumen, `{"level": "summary", "command": "sync", …}`.
Selecciónelo por su nivel. **Ejecútelo con las mismas opciones que la sincronización**: sin
ellas revisa el método que la configuración indica, por lo que para un proyecto cuya configuración
dice `local` verificaría el método local —no el modelo alojado que ejecuta el
trabajo— y pasaría exitosamente en un ejecutor sin clave. Como un paso en el flujo de trabajo anterior,
antes de "Sync translations", lee el mismo `SYNC_FLAGS`:

```yaml
      - name: Check the sync can run (translates nothing)
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        # The JSON lines go to $out; the warnings (stderr) stay in the log.
        # When the check fails, the step prints why: the summary's
        # realRun.reasons, or its error when sync could not run at all
        # (that exit code is not fatal here — the summary is read instead).
        run: |
          out=$(npx --yes champollion@0.6 sync --dry $SYNC_FLAGS --json) || true
          if ! printf '%s\n' "$out" | jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)' > /dev/null; then
            printf '%s\n' "$out" | jq -r 'select(.level == "summary") | "::error::" + (.error // "A real sync would exit \(.realRun.exitCode): \(.realRun.reasons | join("; "))")'
            exit 1
          fi
```

O en una shell, con las opciones detalladas —las mismas que en la línea de sincronización:

```bash
SYNC_FLAGS="--method llm --model google/gemini-3.8-flash --max-cost 5"
out=$(npx --yes champollion@0.6 sync --dry $SYNC_FLAGS --json)
printf '%s\n' "$out" | jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)' > /dev/null \
  || printf '%s\n' "$out" | jq -r 'select(.level == "summary") | .error // "A real sync would exit \(.realRun.exitCode): \(.realRun.reasons | join("; "))"'
```

`preflight.ready` es `false` cuando falta una clave que el método necesita (no definida o
vacía — no cuando es incorrecta), haya o no algo que traducir: un
método alojado nunca está listo sin su clave. `maxCost.wouldStop` (presente con
`--max-cost`) es `true` cuando la ejecución real se detendría en el límite. `jq -e` sale con
1 en cualquiera de los dos casos, y el paso imprime entonces el motivo en el registro del trabajo — por ejemplo
`A real sync would exit 1: it would stop before translating: No OpenRouter API
key (OPENROUTER_API_KEY) for en:fr`, or `A real sync would exit 2: --max-cost
would stop it before any API call (Estimated translation cost exceeds the
--max-cost cap: estimate ~$7.1200, cap $5.0000)`. Cuando sync no puede ejecutarse en
absoluto (una configuración dañada), el paso imprime en su lugar el `error` del resumen. El paso
no envía stderr a `/dev/null`, por lo que las advertencias también permanecen en el registro. El
`realRun.exitCode` del resumen indica con qué código saldría la ejecución real,
hasta donde una vista previa puede predecir: `1` cuando la comprobación previa la detendría, `2`
cuando lo haría `--max-cost`, o cuando terminaría parcial —claves retenidas, o
mensajes plurales en disco sin una forma que el idioma utiliza (`realRun.reasons`
indica cuál)—. Un rechazo por parte del control de calidad, que solo la ejecución real detecta, aún
puede convertir un `0` en un `2`. Para hacer fallar la verificación ante una ejecución parcial prevista también,
coloque `.realRun.exitCode == 0` en lugar de `.preflight.ready and (.maxCost.wouldStop | not)`.

### Una rama main protegida: proponga una pull request

El flujo de trabajo anterior hace push de las traducciones directamente a `main`. Si `main` está
protegida (revisiones obligatorias o comprobaciones de estado), ese push es rechazado —después
de que la sincronización se haya ejecutado, por lo que las traducciones ya están pagadas—. No se pagan
de nuevo: la caché se guarda antes del paso de confirmación, incluso si un paso falla,
por lo que volver a ejecutar el trabajo o el siguiente push (cada uno restaura la caché más nueva de la rama,
mediante `restore-keys`) las entrega desde la caché. Los
archivos de bloqueo nunca llegaron a `main`, así que la siguiente ejecución encuentra modificadas las mismas
cadenas y las vuelve a escribir —desde la caché, sin costo alguno—.

En una rama `main` protegida, confirme en una rama perteneciente al bot y abra (o actualice) una
pull request en su lugar. Conserve el flujo de trabajo anterior y cambie dos cosas: los
permisos y el paso de confirmación.

```yaml title=".github/workflows/i18n-sync.yml (pull request)"
permissions:
  contents: write          # pushes the bot's branch
  pull-requests: write     # opens the pull request

# … checkout, setup-node, cache restore, "Sync translations" and the cache
# save as above; then, in place of "Commit updated translations":
      - name: Open or update the translations pull request
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          git config user.name "champollion"
          git config user.email "bot@example.com"
          branch=champollion/translations
          git switch -C "$branch"
          # Django: stage the catalogs and the lock by name, as in the
          # Django workflow below, instead of --all.
          git add --all
          if git diff --staged --quiet; then
            echo "Nothing to propose: the translations on $GITHUB_REF_NAME are up to date."
            exit 0
          fi
          git commit -m "chore: sync translations"
          # The branch is rebuilt from the latest $GITHUB_REF_NAME on every
          # run, so a force-push replaces the last proposal.
          git push --force origin "$branch"
          if [ -z "$(gh pr list --head "$branch" --base "$GITHUB_REF_NAME" --state open --json number --jq '.[].number')" ]; then
            gh pr create --head "$branch" --base "$GITHUB_REF_NAME" \
              --title "chore: sync translations" \
              --body "Translations and lock files from champollion sync (run $GITHUB_RUN_ID). Merge them together."
          fi
# "Stop when the sync was partial" and the verify --strict step stay as they
# are, after this one.
```

**Cuándo usar cuál.** Haga push a `main` cuando el flujo de trabajo tenga permiso para hacerlo: sin
protección de ramas, o con una regla que permita a GitHub Actions omitirla. Abra una pull
request cuando `main` esté protegida, o cuando una persona —un hablante del idioma—
deba leer las traducciones antes de que se publiquen.

- La rama pertenece al bot. Hasta que la pull request se fusione, los archivos de bloqueo
  de `main` no contienen sus traducciones, por lo que cada ejecución vuelve a proponer el conjunto
  completo —desde la caché, de modo que solo se facturan las cadenas modificadas desde entonces—. Las ediciones
  enviadas mediante push a esa rama son reemplazadas por la siguiente ejecución: revise en la pull
  request, fusione y luego edite en `main` (una regeneración masiva posterior conservará la
  edición de una persona).
- El repositorio debe permitir que Actions abra pull requests: Settings → Actions →
  General → "Allow GitHub Actions to create and approve pull requests".
- Una pull request abierta con el `GITHUB_TOKEN` del flujo de trabajo no inicia ningún otro
  flujo de trabajo, por lo que las comprobaciones de estado requeridas nunca se ejecutan en ella. Si `main` las
  requiere, ábrala con un token de GitHub App o un token detallado (fine-grained) guardado como
  secreto (`GH_TOKEN: ${{ secrets.<name> }}`), o use una acción como
  `peter-evans/create-pull-request`, que confirma, actualiza la rama y
  edita la pull request abierta por usted (pásele el token de la misma forma).

### gettext (Django, Babel) y Flutter

Sync traduce los catálogos que existen; no extrae cadenas de
su código. Un proyecto de Django actualiza los catálogos antes del paso de sincronización,
verifica que compilen después de este y confirma únicamente los catálogos.

Tanto `makemessages` como `compilemessages` importan su configuración, por lo que el trabajo
establece lo que necesitan, una sola vez, para cada paso: cualquier variable que su módulo de configuración
lea al importarse (`SECRET_KEY`, `DATABASE_URL`, …). Ninguno de los dos comandos toca la
base de datos, por lo que un valor provisional es suficiente para ellas. `DJANGO_SETTINGS_MODULE`
se deja comentado: el `manage.py` que escribe `startproject` lo establece
por sí mismo, y un valor configurado en el trabajo sobrescribe ese —un nombre de módulo incorrecto
rompe `makemessages`—. Establézcalo solo cuando su `manage.py` no lo haga.

Su filtro `paths:` difiere del flujo de trabajo anterior: las cadenas de origen residen en
su código de Python y en sus plantillas, y `makemessages` las extrae en el trabajo, de modo que
un cambio de código puede traer una cadena nueva. Acote los patrones a sus aplicaciones
(`myapp/**.py`) si cada push modifica Python. También vigila `locale/**`:
un nuevo idioma llega como una nueva carpeta de catálogo (`makemessages -l <code>`). El
propio commit del bot modifica esos catálogos pero no inicia ninguna ejecución, porque se envía
con `GITHUB_TOKEN` (consulte **El propio commit del trabajo nunca vuelve a iniciarlo**
más arriba — y qué acotar cuando haga push con otro token).

```yaml title=".github/workflows/i18n-sync.yml (Django)"
name: Sync translations
on:
  push:
    branches: [main]
    # makemessages finds new strings in your code and templates, so a code
    # change can bring a string to translate: watch those, the catalogs
    # and the config. A push that touches none of them starts no job.
    paths:
      - '**.py'
      - '**.html'
      - '**.txt'                # templates for emails and the like
      - '**.js'                 # djangojs strings; drop it if you have none
      - 'locale/**'
      - 'champollion.config.json'
  # Run workflow (by hand): the box asks again for plural forms a model left
  # out — Russian few/many marked "# champollion:" (--redo gaps).
  workflow_dispatch:
    inputs:
      redo_gaps:
        description: 'Ask again for plural forms a model left out (--redo gaps)'
        type: boolean
        default: false

permissions:
  contents: write

concurrency:
  group: i18n-sync-${{ github.ref }}
  cancel-in-progress: false

jobs:
  sync:
    runs-on: ubuntu-latest
    # For every step: makemessages and compilemessages both import your
    # settings, so set what your settings read at import (see above).
    # Placeholders are enough: neither command uses the database.
    env:
      # DJANGO_SETTINGS_MODULE: myproject.settings   # only if your manage.py does not set it
      SECRET_KEY: makemessages-only
      # The flags of every `champollion sync` in this job (the dry-run check
      # above reads them too). A runner has no model server: if your config
      # uses "local" (a model on your machine), a hosted method runs here,
      # for these runs only — the config file is not changed.
      SYNC_FLAGS: --method llm --model google/gemini-3.8-flash --max-cost 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      # A fresh runner's package index is empty: update it first, or the
      # install fails. gettext brings msgmerge and msgfmt, used below.
      - run: sudo apt-get update && sudo apt-get install -y gettext
      - run: python -m pip install -r requirements.txt   # the Python setup-python just installed
      - name: Restore the translation cache
        id: cache
        uses: actions/cache/restore@v4
        with:
          path: .champollion
          key: champollion-tm-${{ github.ref_name }}-newest
          restore-keys: champollion-tm-${{ github.ref_name }}-
      - name: Extract new strings into the catalogs
        # --no-wrap: champollion writes each msgstr on one line; without it
        # msgmerge re-wraps those lines at 79 columns on the next run, and
        # every sync commits whitespace-only changes. The second line
        # refreshes the JavaScript catalogs (djangojs.po); drop it if your
        # project has none.
        run: |
          python manage.py makemessages --all --no-wrap
          python manage.py makemessages --all --no-wrap -d djangojs
      - name: Sync translations
        id: sync
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        # $SYNC_FLAGS: the job's flags (env: above); the redo_gaps box of
        # "Run workflow" adds --redo gaps. Exit 2 (partial) is recorded, not
        # fatal: what was translated is committed, then the job fails.
        run: |
          set +e
          npx --yes champollion@0.6 sync $SYNC_FLAGS ${{ inputs.redo_gaps && '--redo gaps' || '' }}
          code=$?
          echo "code=$code" >> "$GITHUB_OUTPUT"
          if [ "$code" -ne 0 ] && [ "$code" -ne 2 ]; then exit "$code"; fi
      - name: Save the translation cache
        if: always() && hashFiles('.champollion/**') != '' && steps.cache.outputs.cache-matched-key != format('champollion-tm-{0}-{1}', github.ref_name, hashFiles('.champollion/**'))
        uses: actions/cache/save@v4
        with:
          path: .champollion
          key: champollion-tm-${{ github.ref_name }}-${{ hashFiles('.champollion/**') }}
      - name: Check the catalogs compile (placeholder types included)
        run: python manage.py compilemessages
      - name: Commit updated catalogs
        run: |
          git config user.name "champollion"
          git config user.email "bot@example.com"
          # The catalogs and the lock file only: not the .mo files
          # compilemessages just wrote, and not .champollion/ (the cache).
          git add -- '*.po' .champollion.lock
          # A replaced hand edit is recorded here — the only copy of that wording.
          if [ -f .champollion-replaced-edits.jsonl ]; then git add -- .champollion-replaced-edits.jsonl; fi
          # makemessages (msgmerge) writes a new POT-Creation-Date into every
          # catalog on each run: commit only when something else changed
          # (git diff -I needs git 2.30 or newer; GitHub's runners have it).
          if git diff --staged --quiet -I '^"POT-Creation-Date:'; then
            echo "Nothing to commit: only the catalogs' POT-Creation-Date changed."
          else
            git commit -m "chore: sync translations"
            git pull --rebase origin "$GITHUB_REF_NAME"
            git push origin "HEAD:$GITHUB_REF_NAME"
          fi
      # Right after the commit, before verify: on a partial run verify would
      # fail first on the missing keys, and the red step would name a key
      # while the reason sat in a green step.
      - name: Stop when the sync was partial
        if: steps.sync.outputs.code == '2'
        run: |
          echo "::error::champollion sync exit 2: the run stopped at --max-cost before translating, or some keys were not translated (refused by the quality gate, held back, or a plural form left out). What was translated is committed. The 'Sync translations' step's log says which."
          exit 1
      # --strict: a plural entry where the model left out a form the
      # language uses for everyday counts (Russian few/many) is a warning,
      # and plain verify passes on warnings. Strict fails on it, so wrong
      # plurals never ship with a green build.
      - name: Check every catalog is complete and intact
        run: npx --yes champollion@0.6 verify --strict
```

`--all` actualiza cada catálogo que ya existe; agregue un idioma con
`makemessages -l <code>` una vez (o `champollion init --langs <code>`).
`makemessages` se ejecuta una vez por dominio: `django` para Python y plantillas,
`djangojs` (`-d djangojs`) para JavaScript. Sync traduce el catálogo de cada dominio
que encuentre. El último paso ejecuta `verify --strict`. Una entrada plural en ruso
cuya traducción carezca de la forma `few` o `many` se escribe con la forma `other`
y se marca como `# champollion:`. Cada sincronización sale con `2` mientras dicha entrada permanezca
en un catálogo —la que la escribe y todas las posteriores, al igual que con una clave
retenida— y su resumen nombra la entrada y el comando para volver a solicitarla; la
línea de verificación posterior a la sincronización indica entonces que la ejecución está incompleta en lugar de `[OK]`.
Por lo tanto, el paso "Stop when the sync was partial" hace fallar el trabajo tras la confirmación
hasta que se escriban las formas. De manera aislada, es una advertencia: un `verify` normal
sale con 0 ante ella, mientras que `--strict` falla. `audit` cuenta las mismas entradas como
incompletas.

`compilemessages` ejecuta `msgfmt --check-format`, que también verifica que cada
`%(name)s` conserve su tipo —pero solo en entradas marcadas con `#, python-format`—.
`makemessages` añade esa marca a las entradas que extrae con un marcador
de posición `%`; un catálogo hecho a mano podría no tenerla, y sus entradas no
se verificarían entonces. `champollion
verify` compara los marcadores de posición printf de cada entrada (nombre y letra de tipo)
sin importar sus marcas, y sync mantiene las marcas de la entrada de origen en cada entrada que
traduce. El paso de confirmación prepara `*.po` y
`.champollion.lock` por nombre (y el registro de ediciones reemplazadas cuando
lo haya); si su proyecto rastrea sus archivos `.mo`, agréguele `'*.mo'`. Los
pasos de caché, el código de salida registrado y `git pull --rebase` están ahí por
las mismas razones que en el flujo de trabajo anterior. Babel: `pybabel extract` + `pybabel update --no-wrap` antes
de la sincronización, `pybabel compile` después de ella.

Flutter no necesita ningún paso adicional en este trabajo: sync escribe los archivos
`app_<locale>.arb`, y `flutter gen-l10n` (o `flutter build`, que lo ejecuta) es el
propio paso de compilación de su aplicación, donde los convierte a Dart.

#### Formas plurales que un modelo omitió {#plural-gaps}

Una entrada marcada no es una traducción, por lo que sync no se la deja únicamente
a una persona:

- **Otro método o modelo vuelve a preguntar por sí mismo.** Una sincronización cuya configuración
  (método, modelo, registro, coaching) aún no haya respondido a esa entrada la vuelve
  a enviar al modelo —no a la caché, que conserva la respuesta
  incompleta—. Así, cuando el modelo local de un desarrollador omitió las formas, el modelo
  alojado del trabajo (`SYNC_FLAGS`) las solicita en su siguiente ejecución, y la estimación
  lo cotiza. El bloqueo (`.champollion.lock`, bajo `gaps`) registra cada configuración
  que respondió sin las formas, para que una ejecución local y una de CI nunca se turnen
  para pagar por la misma respuesta incompleta.
- **`sync --redo gaps` solicita cada una de esas entradas**, sin importar quién la haya dejado —en los
  flujos de trabajo anteriores, marque `redo_gaps` bajo **Run workflow**. Agregue `--model` a
  `SYNC_FLAGS` para usar un modelo más potente.
- **Si la nueva respuesta también carece de las formas, la entrada permanece marcada** y la
  ejecución sale con `2`, como antes. En ese caso, escriba las formas a mano y elimine la
  línea `# champollion:`.

Una ejecución de prueba (`sync --dry`) nombra las entradas que volvería a solicitar y las
cotiza; su resumen `--json` cuenta las que no solicitaría (`totalPluralGaps`)
e indica que la ejecución real saldría con `2` debido a ellas (`realRun.exitCode`).

## Otros métodos

Los fragmentos siguientes muestran la clave que necesita cada método y su comando `sync`.
Úselos **dentro** del paso "Sync translations" del flujo de trabajo anterior: cambie
su `env`, coloque las opciones mostradas (`--method openai`, …) en la línea
`SYNC_FLAGS` del flujo de trabajo —para que la verificación de prueba ejecute el mismo método— y conserve el
resto del paso (`id: sync` y las líneas que registran el código de salida), de modo que una
ejecución parcial aún confirme lo que tradujo y guarde la caché.

## Método de Google Translate

Si utiliza el método integrado de Google Translate en lugar de OpenRouter:

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx --yes champollion@0.6 sync
```

## Proveedores directos de LLM

Si utiliza los métodos `openai`, `anthropic` o `gemini` directamente:

```yaml
# OpenAI
- name: Sync translations
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: npx --yes champollion@0.6 sync --method openai

# Anthropic
- name: Sync translations
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: npx --yes champollion@0.6 sync --method anthropic

# Gemini (free tier available)
- name: Sync translations
  env:
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  run: npx --yes champollion@0.6 sync --method gemini
```

## DeepL

```yaml
- name: Sync translations
  env:
    DEEPL_API_KEY: ${{ secrets.DEEPL_API_KEY }}
  run: npx --yes champollion@0.6 sync --method deepl
```

## API de traducción remota

Si utiliza un endpoint de traducción remota (p. ej., un servicio de traducción alojado):

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx --yes champollion@0.6 sync
```

## Un control de calidad antes del despliegue

Para hacer fallar una compilación cuando cualquier configuración regional esté incompleta o dañada, sin traducir
nada, ejecute las verificaciones por separado.

:::warning[Ejecute el control después de la sincronización, no antes]
Si la traducción solo se ejecuta después de la fusión (el flujo de trabajo anterior), una pull request que
agregue una cadena todavía no tiene traducción para ella, y `audit`/`verify` hacen fallar cada
PR de ese tipo. Ejecute el control donde las traducciones ya existan: en `main` después
del trabajo de sincronización (`needs: sync`, o `on: workflow_run` del flujo de trabajo de sincronización). Un
disparador `push` no se activa con los propios commits del bot de sincronización —se envían
con `GITHUB_TOKEN`, que no inicia ningún flujo de trabajo (ver más arriba)—. En pull requests,
ejecute solo `lint`, o ejecute primero el trabajo de sincronización en la rama de la PR.
:::

```yaml
jobs:
  i18n-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      # 1. Hardcoded strings that never reached a locale file (web projects)
      - run: npx --yes champollion@0.6 lint
      # 2. Every key present, nothing empty or left as an [EN] fallback
      - run: npx --yes champollion@0.6 audit
      # 3. Placeholders, ICU plurals, markup and scripts intact. --strict:
      #    warnings fail the build too (an extra or missing plural form, a
      #    source echo, an out-of-date translation pass plain verify).
      - run: npx --yes champollion@0.6 verify --strict
```

| Verificación | Comando | Falla cuando |
|---|---|---|
| **Lint** | `lint` | El código fuente contiene cadenas que no están en un archivo de configuración regional —o no encontró archivos de origen para verificar (indica las carpetas en las que buscó; apúntelo a otra ubicación con `--src <dir>`)— |
| **Audit** | `audit` | Falta una clave, está vacía o sigue siendo una alternativa de `[EN]` —o una traducción está **desactualizada**: creada a partir de un texto de origen más antiguo que el actual (una edición de origen cuya retraducción falló)— o a un mensaje plural le falta una forma que el idioma usa para conteos cotidianos (ruso `few`/`many`; las entradas en las que falla `verify --strict`), con el comando para volver a solicitarla |
| **Verify** | `verify` | Una traducción dañó un marcador de posición, plural ICU, marcado (una etiqueta abierta, cerrada o anidada de forma diferente) o script —o falta una clave— o un mismo texto reemplaza varias cadenas de origen diferentes (un modelo que repite una oración memorizada) —o no encontró nada que verificar (el archivo de origen o la carpeta de configuraciones regionales no está donde apunta la configuración)— |
| **Verify, estricto** | `verify --strict` | Cualquiera de las situaciones anteriores, o cualquier advertencia |

`verify` sale con `1` ante cualquier error y con `0` en caso contrario. Las advertencias se imprimen pero no
hacen fallar el trabajo: un eco del origen, dos configuraciones regionales con texto idéntico, una
traducción desactualizada, una traducción que omitió el `?` o `!` de cierre
del origen (algunos idiomas marcan una pregunta con una partícula en su lugar)
y las advertencias de plurales que figuran abajo. Un mismo texto escrito para varias cadenas
de origen diferentes es un error: dos cadenas con varias palabras claramente diferentes respondidas con
el mismo texto de cuatro o más palabras, o de tres o más en otros casos. Se contabiliza
sobre valores de clave, cada rama plural y las páginas de Markdown de la configuración regional, según la
regla con la que el control de calidad de `sync` lo rechaza. `verify --strict` convierte cada advertencia en
un fallo. Utilícelo cuando, por ejemplo, las formas plurales en ruso que el modelo omitió deban
bloquear un despliegue. Las traducciones desactualizadas son una advertencia en `verify` (la
estructura está intacta) y un fallo en `audit` (el control de integridad), el cual
imprime el comando para volver a traducirlas.

Los hallazgos de plurales dependen de cómo almacena los plurales cada formato:

| Formato | Error (`verify` sale con 1) | Advertencia (falla solo con `--strict`) |
|---|---|---|
| Claves con sufijo de i18next (`count_one`, `count_other`, …) | Falta una forma que la configuración regional necesita (francés `count_many`): es una clave faltante. | Una clave para una forma que la configuración regional no tiene (francés o español `count_two`). `verify` imprime el comando que elimina exactamente esas claves, `sync --prune plural-extras`; sync nunca las elimina sin él. |
| Mensajes ICU (`{count, plural, …}` en next-intl, ARB, i18next ICU) | La estructura del plural está dañada (una variable, palabra clave o selector traducidos, un `#` perdido). | Falta una rama que la configuración regional usa para conteos cotidianos (ruso `few`, `many`). Una forma faltante que se usa únicamente para números grandes (francés `many`, para 1 000 000) no se reporta. |
| gettext (`msgid_plural`) | Una entrada sin traducción (vacía o `fuzzy`): es una clave faltante. | Formas `msgstr[]` que repiten la forma `other` donde el idioma tiene su propia forma para conteos cotidianos (marcadas con un comentario `# champollion:`). Más líneas `msgstr[]` que las de `nplurals` del catálogo. Las formas plurales se contabilizan según el encabezado `Plural-Forms` propio del catálogo. |

Una forma de i18next traducida a partir del texto de otra forma puede contener exactamente el
texto de esa forma (francés `count_many` igual a `count_other`). El francés puede escribir
las dos iguales, por lo que esto nunca es una advertencia. Cuando sync solicita una forma al modelo,
lo registra en `.champollion.lock` con una huella digital de la respuesta. `verify`
lee únicamente ese registro, de modo que cada clon de un commit obtiene el mismo resultado. La
caché de su computadora y un ejecutor nuevo de CI no pueden discrepar. Un valor sin registro
(escrito a mano, por otra herramienta, por un motor de traducción automática al que no se le
puede indicar la forma, o por una versión más antigua) recibe una línea informativa con el comando
para volver a solicitarlo. `--strict` no falla ante esto.
Verify comprueba la estructura, no el significado: una aprobación indica que las claves, marcadores de posición,
plurales, marcado y script están intactos, no que el texto diga lo correcto.

---

## Consulte también

- [Referencia de la CLI](/docs/reference/cli) — referencia completa de comandos
- [Cómo funciona Sync](/docs/concepts/how-sync-works) — comprensión de la sincronización incremental
- [Memoria de traducción](/docs/concepts/translation-memory) — almacenamiento en caché y ahorro de costos
- [Métodos de traducción](/docs/guides/translation-methods) — selección de métodos por par
- [Control de calidad](/docs/concepts/quality-gate) — qué sucede cuando las traducciones fallan
- [Configuración](/docs/getting-started/configuration) — referencia de configuración
