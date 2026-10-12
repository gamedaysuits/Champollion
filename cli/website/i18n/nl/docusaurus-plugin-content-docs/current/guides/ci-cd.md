---
sidebar_position: 3
title: "CI/CD"
---

# CI/CD-integratie

Automatiseer vertalingen in uw build-pipeline.

De champollion CLI is source-available onder de [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE): gratis te gebruiken, te wijzigen en te delen voor niet-commerciële doeleinden. Gebruik voor een commercieel doel wordt niet gedekt door deze licentie ([wie dit mag gebruiken](/docs/getting-started/who-may-use-this)).

## GitHub Actions: vertalingen gesynchroniseerd houden

Een complete workflow: vertaal wat gewijzigd is, controleer het resultaat en commit het
terug. Het werkt voor elk project — met of zonder Node (Django, Flutter, Hugo).

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
          npx --yes champollion@0.5 sync $SYNC_FLAGS ${{ inputs.redo_gaps && '--redo gaps' || '' }}
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
        run: npx --yes champollion@0.5 verify --strict
```

**Waarom de workflow zo is opgebouwd.** `actions/cache` slaat de cache op zichzelf alleen op
wanneer de hele job slaagt, en `sync` sluit af met `2` zodra er een sleutel
wordt geweigerd — een gedeeltelijke run sloeg dus vroeger zowel de commit als het opslaan van de cache over,
waardoor de volgende run opnieuw betaalde voor dezelfde vertalingen. Hier wordt de cache
hersteld en opgeslagen in twee stappen (`actions/cache/restore`, vervolgens
`actions/cache/save` met `if: always()`), registreert de sync-stap zijn afsluitcode
in plaats van te falen op `2`, worden de vertaalde bestanden gecommit, en pas daarna
faalt de job — in een eigen stap, vóór `verify`, zodat de falende stap vermeldt
waarom (een `--max-cost`-stop, of sleutels die de synchronisatie niet kon vertalen) in plaats van dat
`verify` een ontbrekende sleutel meldt. De laatste stap is `verify --strict`: standaard
`verify` sluit af met code 0 bij waarschuwingen (waaronder een extra of ontbrekende meervoudsvorm), en
`--strict` laat de job hierop falen. Een sleutel die door de quality gate is geweigerd, wordt onthouden: de volgende run
stuurt deze niet opnieuw naar hetzelfde model (dat zou voor hetzelfde antwoord factureren) —
het sync-logboek vermeldt de sleutel en het `--redo keys:`-commando om het opnieuw te vragen.

**Eén cachekopie per wijziging, niet per run.** De herstelstap haalt de
nieuwste cache van de branch terug (de exacte sleutel ervan, `…-newest`, wordt nooit opgeslagen, dus
kiest `restore-keys` de meest recente). De opslagstap baseert de cachesleutel op een
hash van zijn eigen bestanden (`hashFiles('.champollion/**')`): een run die iets heeft vertaald
— zelfs een gedeeltelijke run, of een waarvan de push is mislukt — heeft de cache gewijzigd,
krijgt dus een nieuwe sleutel en wordt opgeslagen; een run die niets heeft toegevoegd (niets om
te vertalen, alles uit de cache, een `--max-cost`-stop) heeft de sleutel die
hersteld is, waardoor het opslaan wordt overgeslagen en er geen nieuwe kopie wordt bewaard. Sleutelen op het run-ID
sloeg bij elke run een volledige kopie op; sleutelen op het lock- en de bronbestanden zou
na een run met een geweigerde push een oudere kopie herstellen via een exacte match,
omdat het gecommitte lockbestand de wijzigingen van die run nooit heeft gekregen.

In een Node-project kunt u `champollion` toevoegen als dev dependency en in plaats daarvan
`npx champollion sync` aanroepen; de hierboven vastgezette `champollion@0.5` werkt in elke
repository en kiest nooit onverwachts een andere versie. De job moet
deze vervolgens installeren: op een nieuwe runner haalt `npx champollion` zonder geïnstalleerde pakketten
de nieuwste versie op, niet degene die uw lockbestand vastzet. En de installatie
schrijft `node_modules/`, wat door `git add --all` wordt gecommit tenzij uw `.gitignore`
dit vermeldt (degene die door `champollion init` wordt aangemaakt, vermeldt alleen `.champollion/`);
stage daarom de locale-bestanden en de lock op naam, zoals de onderstaande Django-workflow doet:

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

**Commit de lockbestanden.** `.champollion.lock` en `.champollion-content.lock`
leggen vast op basis van welke brontekst elke vertaling is gemaakt. Daardoor weet de
volgende run dat een string gewijzigd is. Een runner die deze bestanden nooit ziet, kan een
bewerkte string niet onderscheiden van een onaangeraakte. **Commit `.champollion/` niet** — dit is
de cache per machine; `champollion init` voegt dit toe aan `.gitignore`.

**`--max-cost`** stopt een run voordat deze meer kost dan u verwacht; stel dit in op
wat wijzigingen op een normale dag u kosten. Wanneer het een run stopt, is er niets
vertaald of weggeschreven en sluit sync af met code `2`: er valt niets te committen,
en de stap "Stop when the sync was partial" laat de job falen met die reden. Een methode zonder gepubliceerde prijs (een self-hosted
endpoint op een andere machine) kan niet worden geschat, waardoor `--max-cost` stopt
zodra er iets te vertalen valt — laat dit voor die methoden uitgeschakeld. Een model
dat op de runner zelf wordt gedraaid (`local` op `localhost`/`127.0.0.1`) wordt berekend
tegen $0 aan API-kosten.

**Alleen pushes die een bronstring wijzigen, starten de job.** Het `paths:`-filter
vermeldt uw bronlocale-bestanden en `champollion.config.json`: een push
die alleen code wijzigt, of alleen vertalingen en de lockbestanden, heeft niets
om te vertalen en start dus geen job. Pas de twee locale-paden aan naar de bestanden die uw
configuratie noemt (`messages/en.json`, `lib/l10n/app_en.arb`, …); voeg uw
`contentDir`-map toe wanneer sync ook Markdown vertaalt. **Run workflow** (de
`workflow_dispatch`-trigger) voert het nog steeds handmatig uit.

**De eigen commit van de job start deze nooit opnieuw** — en het `paths:`-filter is
niet wat dit tegenhoudt. De commit-stap pusht met het `GITHUB_TOKEN` van de workflow,
en een push uitgevoerd met `GITHUB_TOKEN` triggert nooit een workflow-run (een regel
van GitHub, zodat een workflow zichzelf niet kan starten). Daarom kan de onderstaande Django-workflow
luisteren naar `locale/**`, wat door elke commit van de bot wordt gewijzigd.
Pusht u in plaats daarvan met een personal access token of een GitHub App-token (om bijvoorbeeld
andere workflows te starten op de commit van de bot), dan start die push deze
workflow wel opnieuw; in dat geval is het `paths:`-filter doorslaggevend. Het bovenstaande filter
laat de vertaalde bestanden en de lockbestanden buiten beschouwing, zodat de commit van de bot
geen run start. Het `locale/**` van het Django-filter omvat de catalogi die de bot
commit, waardoor elk van zijn commits nog één run start — die niets vindt om te
vertalen en niets commit. Beperk dit bij een dergelijk token tot de broncatalogus
(`locale/en/**`) en voeg talen toe via de configuratie.

**De providersleutel is nodig bij elke run die start**, ook wanneer er niets
vertaald hoeft te worden: sync controleert of de methode kan worden uitgevoerd voordat er naar de
wijzigingen wordt gekeken. Een run die handmatig is gestart zonder bronwijziging faalt nog steeds zonder
het `OPENROUTER_API_KEY`-secret (of de sleutel van uw methode). `local` heeft geen sleutel nodig, maar
een runner heeft geen modelserver: een project dat op de computer van een ontwikkelaar met `local`
vertaalt, specificeert in CI een gehoste methode (`--method` / `--model` — de
uitgecommentarieerde regel `SYNC_FLAGS` in de bovenstaande workflow). Om te controleren of het secret
de stap bereikt, zonder iets te vertalen, waarschuwt `sync --dry` wanneer de
echte run zou stoppen en noemt het de ontbrekende variabele (het sluit nog steeds af met code 0 — een dry-run
is een voorbeeldweergave). Het controleert of de variabele is **ingesteld**, niet of de sleutel
**werkt**: het verzendt niets, dus elke niet-lege waarde slaagt — ook een tijdelijke aanduiding (placeholder).
Een onjuiste of ingetrokken sleutel blijkt bij het eerste verzoek van een echte run (de foutmelding
bevat het antwoord van de provider, zoals HTTP 401). Om de job te laten falen bij een ontbrekende
sleutel voordat er iets draait, voegt u [de controle vóór de synchronisatie](#check-before-sync) toe.

**De cache wordt per methode bijgehouden.** Een vertaling wordt gecachet onder de methode,
de tone-of-voice (register) en het coaching-bestand waarmee deze is gemaakt (een ander model van dezelfde
methode hergebruikt deze — model carry-over). Een ontwikkelaar die vertaalt met `local`
en CI die vertaalt met een gehost model delen daarom nooit cache-items —
en de cache van CI is sowieso gescheiden (`.champollion/` wordt niet gecommit). Dat
betekent niet dat CI het project opnieuw vertaalt: wat al in de locale-bestanden staat,
met een gecommit lockbestand, geldt als voltooid. CI betaalt het gehoste model voor
de strings die nieuw of gewijzigd zijn sinds de laatste commit — inclusief strings die een
ontwikkelaar lokaal heeft vertaald maar niet heeft gecommit — en niets voor de rest.
Het hele project opnieuw vertalen met het gehoste model (`--redo all`) brengt
elke string eenmalig in rekening.

**Volgens een schema** in plaats van bij een push: vervang het `on:`-blok door
`schedule: [{ cron: '0 6 * * *' }]`.

### Controle vóór de synchronisatie: laat de job vroegtijdig falen {#check-before-sync}

Een dry-run sluit af met `0`, ongeacht wat er wordt aangetroffen — het is een voorbeeldweergave — dus `sync --dry
--max-cost 5` waarschuwt dat de echte run zou stoppen bij de limiet en slaagt
alsnog als CI-stap. Om een job te laten falen wanneer de echte run zou stoppen (een ontbrekende sleutel, of
`--max-cost`), leest u de samenvatting van `sync --dry --json`. Die uitvoer bestaat uit
één JSON-object per regel (NDJSON), elk met een `level` — `info`-, `ok`- en
`event`-regels op stdout, `warn`- en `error`-regels op stderr — en de laatste
stdout-regel is de samenvatting, `{"level": "summary", "command": "sync", …}`.
Selecteer deze op basis van het niveau. **Voer het uit met dezelfde flags als de sync**: zonder
deze vlaggen controleert het de methode die in de configuratie wordt genoemd, dus voor een project waarvan de configuratie
`local` aangeeft, zou het de lokale methode controleren — niet het gehoste model dat de job
uitvoert — en slagen op een runner zonder sleutel. Als stap in de bovenstaande workflow,
vóór "Sync translations", leest het dezelfde `SYNC_FLAGS`:

```yaml
      - name: Check the sync can run (translates nothing)
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        # The JSON lines go to $out; the warnings (stderr) stay in the log.
        # When the check fails, the step prints why: the summary's
        # realRun.reasons, or its error when sync could not run at all
        # (that exit code is not fatal here — the summary is read instead).
        run: |
          out=$(npx --yes champollion@0.5 sync --dry $SYNC_FLAGS --json) || true
          if ! printf '%s\n' "$out" | jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)' > /dev/null; then
            printf '%s\n' "$out" | jq -r 'select(.level == "summary") | "::error::" + (.error // "A real sync would exit \(.realRun.exitCode): \(.realRun.reasons | join("; "))")'
            exit 1
          fi
```

Of in een shell, met de flags voluit geschreven — dezelfde als op de sync-regel:

```bash
SYNC_FLAGS="--method llm --model google/gemini-3.8-flash --max-cost 5"
out=$(npx --yes champollion@0.5 sync --dry $SYNC_FLAGS --json)
printf '%s\n' "$out" | jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)' > /dev/null \
  || printf '%s\n' "$out" | jq -r 'select(.level == "summary") | .error // "A real sync would exit \(.realRun.exitCode): \(.realRun.reasons | join("; "))"'
```

`preflight.ready` is `false` wanneer een sleutel die de methode vereist ontbreekt (niet ingesteld of
leeg — niet wanneer deze onjuist is), ongeacht of er iets vertaald moet worden: een
gehoste methode is nooit gereed zonder sleutel. `maxCost.wouldStop` (aanwezig bij
`--max-cost`) is `true` wanneer de echte run zou stoppen bij de limiet. `jq -e` sluit af
met code 1 bij elk van beide, en de stap toont vervolgens de reden in het joblogboek — bijvoorbeeld
`A real sync would exit 1: it would stop before translating: No OpenRouter API
key (OPENROUTER_API_KEY) for en:fr`, or `A real sync would exit 2: --max-cost
would stop it before any API call (Estimated translation cost exceeds the
--max-cost cap: estimate ~$7.1200, cap $5.0000)`. Wanneer sync helemaal niet kan worden uitgevoerd
(een beschadigde configuratie), toont de stap in plaats daarvan `error` van de samenvatting. De stap
stuurt stderr niet naar `/dev/null`, zodat de waarschuwingen ook in het logboek blijven staan. De
`realRun.exitCode` van de samenvatting geeft aan waarmee de echte run zou afsluiten,
voor zover een voorbeeldweergave dat kan bepalen: `1` wanneer de preflight-controle het zou stoppen, `2`
wanneer `--max-cost` dat zou doen, of wanneer het gedeeltelijk zou eindigen — achtergehouden sleutels, of
meervoudsberichten op schijf zonder een vorm die de taal gebruikt (`realRun.reasons`
geeft aan welke). Een weigering door de quality gate, die pas tijdens de echte run wordt ontdekt, kan
een `0` alsnog veranderen in een `2`. Om de controle ook te laten falen bij een voorspelde gedeeltelijke run,
plaatst u `.realRun.exitCode == 0` in plaats van `.preflight.ready and (.maxCost.wouldStop | not)`.

### Een beveiligde main-branch: stel een pull request voor

De bovenstaande workflow pusht de vertalingen rechtstreeks naar `main`. Als `main`
beveiligd is (vereiste reviews of statuscontroles), wordt die push geweigerd — nadat
de synchronisatie is uitgevoerd, waardoor de vertalingen al zijn betaald. Ze worden niet opnieuw
betaald: de cache wordt opgeslagen vóór de commit-stap, zelfs wanneer een stap faalt,
dus het opnieuw uitvoeren van de job of de volgende push (die beide de nieuwste
cache van de branch herstellen via `restore-keys`) levert ze vanuit de cache. De
lockbestanden hebben `main` nooit bereikt, dus de volgende run vindt dezelfde gewijzigde
strings en schrijft ze opnieuw — vanuit de cache, zonder kosten.

Commit op een beveiligde `main` naar een branch die eigendom is van de bot en open (of update) in
plaats daarvan een pull request. Behoud de bovenstaande workflow en wijzig twee dingen: de
permissies en de commit-stap.

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

**Wanneer gebruikt u wat.** Push naar `main` wanneer de workflow daarheen mag pushen: geen
branchbeveiliging, of een regel waarmee GitHub Actions deze mag omzeilen. Open een pull
request wanneer `main` beveiligd is, of wanneer een persoon — een spreker van de taal
— de vertalingen moet controleren voordat ze worden uitgebracht.

- De branch is eigendom van de bot. Totdat de pull request is gemerged, bevatten de lockbestanden van
  `main` de vertalingen niet, waardoor elke run de volledige set opnieuw voorstelt
  — vanuit de cache, dus alleen strings die sindsdien zijn gewijzigd, worden in rekening gebracht. Wijzigingen
  die naar die branch worden gepusht, worden overschreven door de volgende run: beoordeel in het pull
  request, merge, en bewerk vervolgens op `main` (een latere bulk-hervertaling behoudt de
  bewerking van een mens).
- De repository moet toestaan dat Actions pull requests opent: Settings → Actions →
  General → "Allow GitHub Actions to create and approve pull requests".
- Een pull request dat is geopend met `GITHUB_TOKEN` van de workflow start geen andere
  workflow, waardoor vereiste statuscontroles er nooit op worden uitgevoerd. Als `main` deze
  vereist, open het dan met een GitHub App-token of een fine-grained token dat is opgeslagen als
  secret (`GH_TOKEN: ${{ secrets.<name> }}`), of gebruik een action zoals
  `peter-evans/create-pull-request`, die commit, de branch bijwerkt en
  het openstaande pull request voor u aanpast (geef het token op dezelfde manier mee).

### gettext (Django, Babel) en Flutter

Sync vertaalt de catalogi die bestaan; het extraheert geen strings uit
uw code. Een Django-project werkt de catalogi bij vóór de sync-stap,
controleert na afloop of ze compileren en commit alleen de catalogi.

`makemessages` en `compilemessages` importeren beide uw instellingen, dus de job
stelt eenmalig in wat ze nodig hebben, voor elke stap: elke variabele die uw settings-module
uitleest bij het importeren (`SECRET_KEY`, `DATABASE_URL`, …). Geen van beide commando's raakt de
database aan, dus een tijdelijke waarde (placeholder) is daarvoor voldoende. `DJANGO_SETTINGS_MODULE`
is uitgecommentarieerd gelaten: de `manage.py` die door `startproject` wordt geschreven, stelt dit
zelf in, en een in de job ingestelde waarde overschrijft die waarde — een onjuiste modulenaam
breekt `makemessages`. Stel dit alleen in wanneer uw `manage.py` dat niet doet.

Het `paths:`-filter verschilt van de bovenstaande workflow: de bronstrings bevinden zich in
uw Python-code en templates, en `makemessages` extraheert ze tijdens de job, waardoor
een codewijziging een nieuwe string kan introduceren. Beperk de patronen tot uw apps
(`myapp/**.py`) als elke push Python raakt. Het filter bewaakt ook `locale/**`:
een nieuwe taal verschijnt als een nieuwe catalogusmap (`makemessages -l <code>`). De
eigen commit van de bot wijzigt die catalogi, maar start geen run, omdat deze wordt
gepusht met `GITHUB_TOKEN` (zie **De eigen commit van de job start deze nooit opnieuw**
hierboven — en wat u moet inperken wanneer u met een ander token pusht).

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
          npx --yes champollion@0.5 sync $SYNC_FLAGS ${{ inputs.redo_gaps && '--redo gaps' || '' }}
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
        run: npx --yes champollion@0.5 verify --strict
```

`--all` werkt elke catalogus bij die al bestaat; voeg een taal eenmalig toe met
`makemessages -l <code>` (of `champollion init --langs <code>`).
`makemessages` wordt eenmaal per domein uitgevoerd: `django` voor Python en templates,
`djangojs` (`-d djangojs`) voor JavaScript. Sync vertaalt de catalogus van elk domein
dat het aantreft. De laatste stap voert `verify --strict` uit. Een Russisch meervoudsitem
waarvan de vertaling de vorm `few` of `many` mist, wordt geschreven met de vorm `other`
en gemarkeerd als `# champollion:`. Elke synchronisatie sluit af met `2` zolang een dergelijk item
in een catalogus staat — zowel degene die het schrijft als elke volgende, net als bij een achtergehouden
sleutel — en de samenvatting noemt het item en het commando om het opnieuw te vragen; de
verificatielijn na de synchronisatie geeft dan aan dat de run onvolledig is in plaats van `[OK]`.
Daarom laat de stap "Stop when the sync was partial" de job falen na de commit
totdat de vormen zijn geschreven. Als los commando is het een waarschuwing: standaard `verify`
sluit erop af met code 0, terwijl `--strict` faalt. `audit` telt dezelfde items als
onvolledig.

`compilemessages` voert `msgfmt --check-format` uit, dat ook controleert of elke
`%(name)s` zijn type behoudt — maar alleen bij items die zijn gemarkeerd met `#, python-format`.
`makemessages` voegt die vlag toe aan de items die het extraheert met een `%`-placeholder;
een handmatig gemaakte catalogus mist deze mogelijk, waardoor de items ervan niet
worden gecontroleerd. `champollion
verify` vergelijkt de printf-placeholders (naam en typeletter) van elk item,
ongeacht de vlaggen, en sync behoudt de vlaggen van het bron-item op elk item dat het
vertaalt. De commit-stap staget `*.po` en
`.champollion.lock` op naam (en het replaced-edits-bestand wanneer dat
aanwezig is); als uw project wel `.mo`-bestanden bijhoudt, voeg dan `'*.mo'` daaraan toe. De
cache-stappen, de geregistreerde afsluitcode en de `git pull --rebase` zijn er om
dezelfde redenen als in de bovenstaande workflow. Babel: `pybabel extract` + `pybabel update --no-wrap` vóór
de synchronisatie, `pybabel compile` erna.

Flutter heeft geen extra stap nodig in deze job: sync schrijft de `app_<locale>.arb`-bestanden,
en `flutter gen-l10n` (of `flutter build`, dat dit uitvoert) is de
eigen buildstap van uw app, waarin deze worden omgezet naar Dart.

#### Meervoudsvormen die een model heeft weggelaten {#plural-gaps}

Een gemarkeerd item is geen vertaling, dus laat sync dit niet aan een persoon
alleen over:

- **Een andere methode of een ander model vraagt het vanzelf opnieuw.** Een sync waarvan de configuratie
  (methode, model, register, coaching) dat item nog niet heeft beantwoord, stuurt het
  opnieuw naar het model — niet naar de cache, die het onvolledige
  antwoord bevat. Dus wanneer het lokale model van een ontwikkelaar de vormen heeft weggelaten, vraagt het
  gehoste model van de job (`SYNC_FLAGS`) er bij de volgende run om, en de schatting
  berekent de prijs daarvan. De lock (`.champollion.lock`, onder `gaps`) legt elke configuratie
  vast die zonder de vormen heeft geantwoord, zodat een lokale run en een CI-run nooit om de
  beurt betalen voor hetzelfde onvolledige antwoord.
- **`sync --redo gaps` vraagt elk dergelijk item opnieuw aan**, ongeacht wie het heeft achtergelaten — vink in de
  bovenstaande workflows `redo_gaps` aan onder **Run workflow**. Voeg `--model` toe aan
  `SYNC_FLAGS` voor een krachtiger model.
- **Als het nieuwe antwoord de vormen ook mist, blijft het item gemarkeerd** en sluit de
  run af met `2`, net als voorheen. Schrijf de vormen dan handmatig en verwijder de
  `# champollion:`-regel.

Een dry-run (`sync --dry`) vermeldt de items die opnieuw zouden worden opgevraagd en berekent de
kosten daarvan; de samenvatting in `--json` telt de items waarbij dat niet gebeurt (`totalPluralGaps`)
en meldt dat de echte run erdoor zou afsluiten met `2` (`realRun.exitCode`).

## Andere methoden

De onderstaande codefragmenten tonen de sleutel die elke methode nodig heeft en het bijbehorende `sync`-commando.
Gebruik ze **binnen** de stap "Sync translations" van de bovenstaande workflow: vervang
de `env` ervan, plaats de getoonde flags (`--method openai`, …) in de regel
`SYNC_FLAGS` van de workflow — zodat de dry-run-controle dezelfde methode uitvoert — en behoud de
rest van de stap (`id: sync` en de regels die de afsluitcode registreren), zodat een
gedeeltelijke run alsnog commit wat er vertaald is en de cache opslaat.

## Google Translate-methode

Als u de ingebouwde Google Translate-methode gebruikt in plaats van OpenRouter:

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx --yes champollion@0.5 sync
```

## Directe LLM-providers

Als u de methoden `openai`, `anthropic` of `gemini` rechtstreeks gebruikt:

```yaml
# OpenAI
- name: Sync translations
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: npx --yes champollion@0.5 sync --method openai

# Anthropic
- name: Sync translations
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: npx --yes champollion@0.5 sync --method anthropic

# Gemini (free tier available)
- name: Sync translations
  env:
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  run: npx --yes champollion@0.5 sync --method gemini
```

## DeepL

```yaml
- name: Sync translations
  env:
    DEEPL_API_KEY: ${{ secrets.DEEPL_API_KEY }}
  run: npx --yes champollion@0.5 sync --method deepl
```

## Externe vertaal-API

Als u een extern vertaaleindpunt gebruikt (bijv. een gehoste vertaalservice):

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx --yes champollion@0.5 sync
```

## Een gate vóór u deployt

Om een build te laten falen wanneer een locale onvolledig of beschadigd is, zonder iets
te vertalen, voert u de controles afzonderlijk uit.

:::warning[Voer de gate uit na de synchronisatie, niet ervoor]
Als vertaling alleen na het mergen wordt uitgevoerd (de bovenstaande workflow), heeft een pull request dat
een string toevoegt daar nog geen vertaling voor, en falen `audit`/`verify` bij elke
dergelijke PR. Voer de gate uit waar de vertalingen al bestaan: op `main` na
de sync-job (`needs: sync`, of `on: workflow_run` van de sync-workflow). Een
`push`-trigger wordt niet geactiveerd op de eigen commits van de sync-bot — deze worden gepusht
met `GITHUB_TOKEN`, wat geen workflow start (zie hierboven). Voer bij pull requests
alleen `lint` uit, of voer de sync-job eerst uit op de PR-branch.
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
      - run: npx --yes champollion@0.5 lint
      # 2. Every key present, nothing empty or left as an [EN] fallback
      - run: npx --yes champollion@0.5 audit
      # 3. Placeholders, ICU plurals, markup and scripts intact. --strict:
      #    warnings fail the build too (an extra or missing plural form, a
      #    source echo, an out-of-date translation pass plain verify).
      - run: npx --yes champollion@0.5 verify --strict
```

| Controle | Commando | Faalt wanneer |
|---|---|---|
| **Lint** | `lint` | Broncode strings bevat die niet in een locale-bestand staan — of wanneer er geen bronbestanden zijn gevonden om te controleren (het vermeldt de mappen waarin gezocht is; verwijs naar een andere locatie met `--src <dir>`) |
| **Audit** | `audit` | Een sleutel ontbreekt, leeg is, of nog een `[EN]`-fallback is — of een vertaling **verouderd** is: gemaakt op basis van een oudere brontekst dan de huidige (een bronwijziging waarvan de hervertaling is mislukt) — of een meervoudsbericht een vorm mist die de taal gebruikt voor alledaagse tellingen (Russisch `few`/`many`; de items waarop `verify --strict` faalt), met het commando om het opnieuw te vragen |
| **Verify** | `verify` | Een vertaling een placeholder, ICU-meervoudsvorm, opmaak (een tag die anders is geopend, gesloten of genest) of script heeft beschadigd — of een sleutel ontbreekt — of één tekst dienstdoet voor verschillende bronstrings (een model dat een uit het hoofd geleerde zin herhaalt) — of wanneer er niets gevonden is om te controleren (het bronbestand of de locales-map staat niet waar de configuratie naar verwijst) |
| **Verify, strict** | `verify --strict` | Een van de bovenstaande situaties, of een willekeurige waarschuwing |

`verify` sluit af met `1` bij elke fout en met `0` in andere gevallen. Waarschuwingen worden getoond, maar laten
de job niet falen: een bronecho, twee locales met identieke tekst, een
vertaling die verouderd is, een vertaling waarin het afsluitende `?` of `!` van de bron ontbreekt (sommige talen markeren een vraag in plaats daarvan met een partikel),
en de onderstaande meervoudswaarschuwingen. Eén tekst die voor verschillende bronstrings
is geschreven, is een fout: twee duidelijk verschillende meerwoordige strings die beantwoord zijn
met dezelfde tekst van vier of meer woorden, of drie of meer in andere gevallen. Dit wordt geteld
over sleutelwaarden, elke meervoudstak en de Markdown-pagina's van de locale, volgens de
regel waarmee de gate van `sync` het weigert. `verify --strict` verandert elke waarschuwing in
een fout. Gebruik dit wanneer bijvoorbeeld Russische meervoudsvormen die het model heeft weggelaten
een deployment moeten blokkeren. Verouderde vertalingen zijn een waarschuwing in `verify` (de
structuur is intact) en een fout in `audit` (de volledigheids-gate), die
het commando toont om ze opnieuw te vertalen.

Bevindingen over meervoudsvormen hangen af van hoe het formaat meervouden opslaat:

| Formaat | Fout (`verify` sluit af met 1) | Waarschuwing (faalt alleen met `--strict`) |
|---|---|---|
| i18next-sleutels met achtervoegsel (`count_one`, `count_other`, …) | Een vorm die de locale nodig heeft ontbreekt (Frans `count_many`): dit is een ontbrekende sleutel. | Een sleutel voor een vorm die de locale niet heeft (Frans of Spaans `count_two`). `verify` toont het commando om precies die sleutels te verwijderen, `sync --prune plural-extras`; sync verwijdert ze nooit zonder dit commando. |
| ICU-berichten (`{count, plural, …}` in next-intl, ARB, i18next ICU) | De meervoudsstructuur is beschadigd (een vertaalde variabele, trefwoord of selector, een verloren gegane `#`). | Een tak die de locale gebruikt voor alledaagse tellingen ontbreekt (Russisch `few`, `many`). Een ontbrekende vorm die alleen voor grote getallen wordt gebruikt (Frans `many`, voor 1 000 000) wordt niet gerapporteerd. |
| gettext (`msgid_plural`) | Een item zonder vertaling (leeg of `fuzzy`): dit is een ontbrekende sleutel. | `msgstr[]`-vormen die de `other`-vorm herhalen waar de taal een eigen vorm heeft voor alledaagse tellingen (gemarkeerd met een `# champollion:`-opmerking). Meer `msgstr[]`-regels dan de `nplurals` van de catalogus. Meervoudsvormen worden geteld aan de hand van de eigen `Plural-Forms`-header van de catalogus. |

Een i18next-vorm die is vertaald op basis van de tekst van een andere vorm, kan exact de
tekst van die vorm bevatten (Frans `count_many` gelijk aan `count_other`). In het Frans kunnen
beide hetzelfde worden geschreven, dus dit is nooit een waarschuwing. Wanneer sync het model om een vorm vraagt,
legt het dat vast in `.champollion.lock`, met een vingerafdruk (fingerprint) van het antwoord. `verify`
leest alleen die registratie, zodat elke kloon van een commit hetzelfde resultaat krijgt. De
cache van uw laptop en een nieuwe CI-runner kunnen daardoor niet van mening verschillen. Een waarde zonder registratie
(handmatig geschreven, door een andere tool, door een machinevertalingsengine waaraan de vorm niet
kan worden doorgegeven, of door een oudere versie) krijgt een info-regel met het commando
om het opnieuw te vragen. `--strict` faalt hier niet op.
Verify controleert de structuur, niet de betekenis: een geslaagde controle betekent dat de sleutels, placeholders,
meervoudsvormen, markup en scripts intact zijn, niet dat de tekst inhoudelijk correct is.

---

## Zie ook

- [CLI-referentie](/docs/reference/cli) — volledige opdrachtreference
- [Hoe synchronisatie werkt](/docs/concepts/how-sync-works) — inzicht in incrementele synchronisatie
- [Vertaalgeheugen](/docs/concepts/translation-memory) — caching en kostenbesparingen
- [Vertaalmethoden](/docs/guides/translation-methods) — methodeselectie per taalpaar
- [Kwaliteitspoort](/docs/concepts/quality-gate) — wat er gebeurt wanneer vertalingen mislukken
- [Configuratie](/docs/getting-started/configuration) — configuratiereference
