---
sidebar_position: 3
title: "CI/CD"
---

# CI/CD-Integration

Automatisieren Sie Übersetzungen in Ihrer Build-Pipeline.

Die champollion-CLI ist quelloffen („source-available“) unter der [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) verfügbar: frei zur Nutzung, Änderung und Weitergabe für nicht-kommerzielle Zwecke. Die Nutzung für kommerzielle Zwecke wird von dieser Lizenz nicht abgedeckt ([wer dies nutzen darf](/docs/getting-started/who-may-use-this)).

## GitHub Actions: Übersetzungen synchron halten

Ein vollständiger Workflow: geänderte Inhalte übersetzen, das Ergebnis prüfen und
zurückcommitten. Er funktioniert für jedes Projekt – ob Node oder nicht (Django, Flutter, Hugo).

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

**Warum der Workflow so aufgebaut ist.** `actions/cache` speichert den
Cache von sich aus nur dann, wenn der gesamte Job erfolgreich ist, und `sync` bricht mit `2` ab,
sobald ein Schlüssel abgelehnt wird – ein unvollständiger Durchlauf übersprang daher
früher sowohl den Commit als auch das Speichern des Caches, und der nächste Durchlauf bezahlte
erneut für dieselben Übersetzungen. Hier wird der Cache in zwei Schritten wiederhergestellt
und gespeichert (`actions/cache/restore`, dann `actions/cache/save` mit `if: always()`), der
Synchronisationsschritt erfasst seinen Exit-Code, anstatt bei `2` fehlzuschlagen, die
übersetzten Dateien werden committet, und erst danach schlägt der Job fehl – in einem
eigenen Schritt, vor `verify`, sodass der fehlschlagende Schritt den Grund nennt
(ein `--max-cost`-Stopp oder Schlüssel, die die Synchronisation nicht übersetzen konnte), anstatt dass
`verify` einen fehlenden Schlüssel benennt. Der letzte Schritt ist `verify --strict`: einfaches
`verify` beendet mit 0 bei Warnungen (darunter eine überzählige oder fehlende Pluralform), und
`--strict` lässt den Job bei diesen fehlschlagen. Ein Schlüssel, den das Quality Gate abgelehnt hat,
wird gespeichert: Der nächste Durchlauf sendet ihn nicht erneut an dasselbe Modell (was dieselbe Antwort
in Rechnung stellen würde) – das Synchronisationsprotokoll nennt ihn und den `--redo keys:`-Befehl, um
ihn erneut anzufragen.

**Eine Cache-Kopie pro Änderung, nicht pro Durchlauf.** Der Wiederherstellungsschritt lädt den
neuesten Cache des Branches zurück (sein genauer Schlüssel, `…-newest`, wird nie gespeichert, sodass
`restore-keys` den aktuellsten auswählt). Der Speicherschritt schlüsselt den Cache anhand eines
Hashs seiner eigenen Dateien (`hashFiles('.champollion/**')`): Ein Durchlauf, der etwas übersetzt hat – selbst ein
unvollständiger Durchlauf oder einer, dessen Push fehlgeschlagen ist –, hat den Cache geändert, erhält
also einen neuen Schlüssel und wird gespeichert; ein Durchlauf, der nichts hinzugefügt hat (nichts zu
übersetzen, alles aus dem Cache, ein `--max-cost`-Stopp), besitzt den Schlüssel, den er wiederhergestellt hat,
sodass das Speichern übersprungen und keine neue Kopie abgelegt wird. Die Schlüsselung nach der
Run-ID speicherte bei jedem Durchlauf eine vollständige Kopie; die Schlüsselung nach der Lock-Datei und
den Quelldateien würde nach einem Durchlauf, dessen Push abgewiesen wurde, eine ältere Kopie durch exakte
Übereinstimmung wiederherstellen, weil das committete Lock die Änderungen dieses Durchlaufs nie erhalten hat.

In einem Node-Projekt können Sie `champollion` als Dev-Dependency hinzufügen und stattdessen
`npx champollion sync` aufrufen; das oben angeheftete `champollion@0.5` funktioniert in jedem
Repository und übernimmt nie unerwartet eine andere Version. Der Job muss es
dann installieren: Auf einem frischen Runner ruft `npx champollion` ohne vorinstallierte Pakete
die neueste Version ab, nicht diejenige, die Ihre Lock-Datei festschreibt. Und die Installation
schreibt `node_modules/`, was von `git add --all` committet wird, es sei denn, Ihre `.gitignore`
führt es auf (die von `champollion init` erstellte führt nur `.champollion/` auf); stagen Sie die
Locale-Dateien und das Lock daher namentlich, wie es der Django-Workflow unten tut:

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

**Committen Sie die Lock-Dateien.** `.champollion.lock` und `.champollion-content.lock`
zeichnen auf, aus welchem Quelltext jede Übersetzung erstellt wurde. Anhand dieser
Dateien erkennt der nächste Durchlauf, dass sich eine Zeichenkette geändert hat. Ein Runner,
der sie nie zu Gesicht bekommt, kann eine bearbeitete Zeichenkette nicht von einer unberührten
unterscheiden. **Committen Sie `.champollion/` nicht** – es ist der maschinenspezifische
Cache; `champollion init` fügt ihn zu `.gitignore` hinzu.

**`--max-cost`** stoppt einen Durchlauf, bevor mehr ausgegeben wird, als Sie erwarten; setzen Sie es
auf den Betrag, den die Änderungen eines normalen Tages kosten. Wenn es einen Durchlauf stoppt, wurde nichts
übersetzt oder geschrieben und die Synchronisation beendet mit Code `2`: Es gibt nichts zu committen,
und der Schritt „Stop when the sync was partial“ lässt den Job mit entsprechendem Hinweis fehlschlagen. Eine Methode
ohne veröffentlichte Preise (ein selbstgehosteter Endpunkt auf einem anderen Rechner) kann nicht geschätzt werden,
weshalb `--max-cost` jedes Mal stoppt, wenn etwas zu übersetzen ist – lassen Sie es für solche Methoden
deaktiviert. Ein Modell, das auf dem Runner selbst bereitgestellt wird (`local` unter `localhost`/`127.0.0.1`),
wird mit 0 $ API-Kosten veranschlagt.

**Nur Pushes, die einen Quelltext ändern, starten den Job.** Der `paths:`-Filter
führt Ihre Quell-Locale-Dateien und `champollion.config.json` auf: Ein Push, der nur Code oder nur
Übersetzungen und die Lock-Dateien ändert, enthält nichts zu Übersetzendes und startet daher
keinen Job. Passen Sie die beiden Locale-Pfade an die Dateien an, die Ihre Konfiguration benennt
(`messages/en.json`, `lib/l10n/app_en.arb`, …); fügen Sie Ihren `contentDir`-Ordner hinzu, wenn die
Synchronisation auch Markdown übersetzt. **Run workflow** (der `workflow_dispatch`-Trigger)
führt ihn weiterhin manuell aus.

**Der eigene Commit des Jobs startet ihn nie erneut** – und der `paths:`-Filter ist
nicht das, was ihn daran hindert. Der Commit-Schritt pusht mit dem `GITHUB_TOKEN` des Workflows,
und ein mit `GITHUB_TOKEN` durchgeführter Push löst nie einen Workflow-Durchlauf aus (eine
GitHub-Regel, damit ein Workflow sich nicht selbst starten kann). Aus diesem Grund kann der
unten stehende Django-Workflow `locale/**` überwachen, was jeder einzelne Commit des Bots ändert.
Wenn Sie stattdessen mit einem Personal Access Token oder einem GitHub-App-Token pushen (beispielsweise
um andere Workflows auf den Commit des Bots hin zu starten), startet dieser Push den Workflow erneut;
dann entscheidet der `paths:`-Filter. Der obige Filter schließt die übersetzten Dateien und die
Lock-Dateien aus, sodass der Commit des Bots keinen Durchlauf startet. Das `locale/**` des
Django-Filters erfasst die Kataloge, die der Bot committet, sodass jeder seiner Commits einen weiteren
Durchlauf startet – der nichts zu übersetzen findet und nichts committet. Grenzen Sie dies bei
Verwendung eines solchen Tokens auf den Quellkatalog ein (`locale/en/**`) und fügen Sie Sprachen
über die Konfiguration hinzu.

**Der Provider-Schlüssel wird bei jedem gestarteten Durchlauf benötigt**, auch wenn
nichts übersetzt werden muss: Die Synchronisation prüft, ob die Methode ausgeführt werden kann,
bevor sie nachsieht, was sich geändert hat. Ein manuell gestarteter Durchlauf ohne Quelländerung
schlägt ohne das Secret `OPENROUTER_API_KEY` (oder den Schlüssel Ihrer Methode) dennoch fehl.
`local` benötigt keinen Schlüssel, aber ein Runner verfügt über keinen Modell-Server: Ein
Projekt, das auf dem Rechner eines Entwicklers mit `local` übersetzt, benennt in CI eine
gehostete Methode (`--method` / `--model` – die auskommentierte Zeile `SYNC_FLAGS` im
obigen Workflow). Um zu überprüfen, ob das Secret den Schritt erreicht, ohne etwas zu übersetzen,
warnt `sync --dry`, wenn der echte Durchlauf anhalten würde, und nennt die fehlende Variable (es
beendet dennoch mit 0 – ein Probelauf ist eine Vorschau). Es prüft, ob die Variable **gesetzt**
ist, nicht ob der Schlüssel **funktioniert**: Es sendet nichts, sodass jeder nicht-leere Wert genügt –
auch ein Platzhalter. Ein falscher oder widerrufener Schlüssel zeigt sich bei der ersten Anfrage eines
echten Durchlaufs (der Fehler nennt die Antwort des Providers, etwa HTTP 401). Um den Job bei einem
fehlenden Schlüssel fehlschlagen zu lassen, bevor irgendetwas ausgeführt wird, fügen Sie
[die Prüfung vor der Synchronisation](#check-before-sync) hinzu.

**Der Cache wird pro Methode geführt.** Eine Übersetzung wird unter der Methode, dem
Sprachregister und der Coaching-Datei zwischengespeichert, mit denen sie erstellt wurde (ein anderes
Modell derselben Methode verwendet sie wieder – Modellübertragbarkeit). Ein Entwickler, der mit
`local` übersetzt, und eine CI, die mit einem gehosteten Modell übersetzt, teilen sich daher nie
Cache-Einträge – und der Cache der CI ist ohnehin separat (`.champollion/` wird nicht committet). Das
bedeutet nicht, dass die CI das Projekt neu übersetzt: Was sich bereits in den Locale-Dateien befindet
und wessen Lock-Datei committet ist, gilt als erledigt. Die CI bezahlt das gehostete Modell für die
Zeichenketten, die seit dem letzten Commit neu sind oder geändert wurden – einschließlich derjenigen, die
ein Entwickler lokal übersetzt, aber nicht committet hat – und nichts für den Rest. Das erneute
Übersetzen des gesamten Projekts mit dem gehosteten Modell (`--redo all`) stellt jede Zeichenkette
einmal in Rechnung.

**Zeitgesteuert** statt bei Push: Ersetzen Sie den Block `on:` durch `schedule: [{ cron: '0 6 * * *' }]`.

### Prüfung vor der Synchronisation: den Job frühzeitig abbrechen {#check-before-sync}

Ein Probelauf beendet mit `0`, unabhängig davon, was er vorfindet – es ist eine Vorschau –, sodass `sync --dry
--max-cost 5` warnt, dass der echte Durchlauf an der Obergrenze stoppen würde, und dennoch als
CI-Schritt erfolgreich durchläuft. Um einen Job fehlschlagen zu lassen, wenn der echte Durchlauf anhalten würde (ein
fehlender Schlüssel oder `--max-cost`), lesen Sie die Zusammenfassung von `sync --dry --json`. Diese Ausgabe
besteht aus einem JSON-Objekt pro Zeile (NDJSON), jeweils mit einem `level` – Zeilen mit `info`, `ok` und
`event` auf stdout, Zeilen mit `warn` und `error` auf stderr – und die letzte stdout-Zeile
ist die Zusammenfassung, `{"level": "summary", "command": "sync", …}`.
Wählen Sie sie anhand ihres Levels aus. **Führen Sie den Befehl mit denselben Flags wie die Synchronisation aus**: Ohne
diese prüft er die Methode, die in der Konfiguration angegeben ist; bei einem Projekt, dessen Konfiguration
`local` besagt, würde er also die lokale Methode prüfen – nicht das gehostete Modell, das der Job
ausführt – und auf einem Runner ohne Schlüssel erfolgreich durchlaufen. Als Schritt im obigen Workflow vor
„Sync translations“ liest er dieselbe `SYNC_FLAGS`:

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

Oder in einer Shell, mit ausgeschriebenen Flags – denselben wie in der sync-Zeile:

```bash
SYNC_FLAGS="--method llm --model google/gemini-3.8-flash --max-cost 5"
out=$(npx --yes champollion@0.5 sync --dry $SYNC_FLAGS --json)
printf '%s\n' "$out" | jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)' > /dev/null \
  || printf '%s\n' "$out" | jq -r 'select(.level == "summary") | .error // "A real sync would exit \(.realRun.exitCode): \(.realRun.reasons | join("; "))"'
```

`preflight.ready` ist `false`, wenn ein von der Methode benötigter Schlüssel fehlt (nicht gesetzt oder
leer – nicht, wenn er falsch ist), unabhängig davon, ob etwas übersetzt werden muss: Eine gehostete Methode
ist ohne ihren Schlüssel niemals betriebsbereit. `maxCost.wouldStop` (vorhanden bei `--max-cost`) ist
`true`, wenn der echte Durchlauf an der Obergrenze stoppen würde. `jq -e` beendet bei beiden
mit 1, und der Schritt gibt dann den Grund im Job-Protokoll aus – zum Beispiel
`A real sync would exit 1: it would stop before translating: No OpenRouter API
key (OPENROUTER_API_KEY) for en:fr`, or `A real sync would exit 2: --max-cost
would stop it before any API call (Estimated translation cost exceeds the
--max-cost cap: estimate ~$7.1200, cap $5.0000)`. Wenn sync überhaupt nicht ausgeführt werden
kann (eine fehlerhafte Konfiguration), gibt der Schritt stattdessen `error` der Zusammenfassung aus. Der Schritt
leitet stderr nicht nach `/dev/null` weiter, sodass die Warnungen ebenfalls im Protokoll verbleiben. Das Feld
`realRun.exitCode` der Zusammenfassung gibt an, mit welchem Exit-Code der echte Durchlauf enden würde, soweit
eine Vorschau dies ermitteln kann: `1`, wenn der Preflight ihn stoppen würde, `2`,
wenn `--max-cost` dies täte oder wenn er unvollständig enden würde – zurückgehaltene Schlüssel oder
Plural-Nachrichten auf der Festplatte ohne eine von der Sprache verwendete Form (`realRun.reasons`
gibt an, welche). Eine Ablehnung durch das Quality Gate, die erst der echte Durchlauf feststellt, kann aus einer
`0` dennoch eine `2` machen. Um die Prüfung auch bei einem vorhergesagten unvollständigen Durchlauf fehlschlagen zu lassen,
setzen Sie `.realRun.exitCode == 0` anstelle von `.preflight.ready and (.maxCost.wouldStop | not)` ein.

### Ein geschützter Main-Branch: Einen Pull Request vorschlagen

Der obige Workflow pusht die Übersetzungen direkt nach `main`. Wenn `main` geschützt ist
(erforderliche Reviews oder Statusprüfungen), wird dieser Push abgewiesen – nachdem die Synchronisation
gelaufen ist, sodass die Übersetzungen bereits bezahlt sind. Sie werden nicht erneut bezahlt: Der Cache
wird vor dem Commit-Schritt gespeichert, selbst wenn ein Schritt fehlschlägt. Ein erneuter Durchlauf des
Jobs oder der nächste Push (beide stellen über `restore-keys` den neuesten Cache des Branches wieder her)
bedient sie daher aus dem Cache. Die Lock-Dateien haben `main` nie erreicht, sodass der nächste
Durchlauf dieselben Zeichenketten als geändert vorfindet und sie erneut schreibt – aus dem Cache, ohne Kosten.

Committen Sie auf einem geschützten `main` stattdessen in einen Branch, der dem Bot gehört, und öffnen
(oder aktualisieren) Sie einen Pull Request. Behalten Sie den obigen Workflow bei und ändern Sie zwei Dinge:
die Berechtigungen und den Commit-Schritt.

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

**Wann was verwendet werden sollte.** Pushen Sie nach `main`, wenn der Workflow dorthin pushen darf:
kein Branch-Schutz oder eine Regel, die GitHub Actions das Umgehen gestattet. Öffnen Sie einen Pull Request,
wenn `main` geschützt ist oder wenn eine Person – ein Muttersprachler bzw. Sprecher der Sprache –
die Übersetzungen vor der Veröffentlichung gegenlesen soll.

- Der Branch gehört dem Bot. Bis der Pull Request gemergt wird, enthalten die Lock-Dateien von `main`
  dessen Übersetzungen nicht, sodass jeder Durchlauf das gesamte Set erneut vorschlägt – aus dem Cache,
  sodass nur die seitdem geänderten Zeichenketten in Rechnung gestellt werden. Änderungen, die auf diesen
  Branch gepusht werden, werden durch den nächsten Durchlauf ersetzt: Überprüfen Sie im Pull Request,
  mergen Sie und bearbeiten Sie anschließend auf `main` (eine spätere Massen-Neuerstellung behält
  manuelle Bearbeitungen durch Personen bei).
- Das Repository muss Actions das Öffnen von Pull Requests gestatten: Settings → Actions →
  General → „Allow GitHub Actions to create and approve pull requests“.
- Ein mit dem `GITHUB_TOKEN` des Workflows geöffneter Pull Request startet keinen anderen Workflow,
  sodass erforderliche Statusprüfungen darauf nie ausgeführt werden. Wenn `main` diese erfordert,
  öffnen Sie ihn mit einem GitHub-App-Token oder einem als Secret hinterlegten feingranularen Token
  (`GH_TOKEN: ${{ secrets.<name> }}`), oder verwenden Sie eine Action wie `peter-evans/create-pull-request`, die für Sie committet, den Branch
  aktualisiert und den offenen Pull Request bearbeitet (übergeben Sie ihr das Token auf dieselbe Weise).

### gettext (Django, Babel) und Flutter

Sync übersetzt die bestehenden Kataloge; es extrahiert keine Zeichenketten aus
Ihrem Code. Ein Django-Projekt aktualisiert die Kataloge vor dem Synchronisationsschritt,
prüft danach, ob sie kompilieren, und committet ausschließlich die Kataloge.

`makemessages` und `compilemessages` importieren beide Ihre Settings, daher setzt der Job
alles, was sie benötigen, einmalig für jeden Schritt: jede Variable, die Ihr Settings-Modul
beim Import liest (`SECRET_KEY`, `DATABASE_URL`, …). Keiner der Befehle greift auf die
Datenbank zu, daher reicht für diese ein Platzhalterwert aus. `DJANGO_SETTINGS_MODULE`
bleibt auskommentiert: Das `manage.py`, das `startproject` schreibt, setzt dies
selbst, und ein im Job gesetzter Wert überschreibt diesen – ein falscher Modulname
führt zu Fehlern in `makemessages`. Setzen Sie es nur, wenn Ihre `manage.py` dies nicht tut.

Sein `paths:`-Filter unterscheidet sich vom obigen Workflow: Die Quell-Zeichenketten befinden sich in
Ihrem Python-Code und Ihren Templates, und `makemessages` extrahiert sie im Job, sodass
eine Code-Änderung eine neue Zeichenkette mit sich bringen kann. Grenzen Sie die Muster auf Ihre Apps
(`myapp/**.py`) ein, falls jeder Push Python-Code betrifft. Er überwacht auch `locale/**`:
Eine neue Sprache trifft als neuer Katalogordner ein (`makemessages -l <code>`). Der
eigene Commit des Bots ändert diese Kataloge, startet aber keinen Durchlauf, da er
mit `GITHUB_TOKEN` gepusht wird (siehe **Der eigene Commit des Jobs startet ihn nie erneut**
oben – und was einzugrenzen ist, wenn Sie mit einem anderen Token pushen).

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

`--all` aktualisiert jeden Katalog, der bereits existiert; fügen Sie eine Sprache einmalig mit
`makemessages -l <code>` hinzu (oder `champollion init --langs <code>`).
`makemessages` wird einmal pro Domäne ausgeführt: `django` für Python und Templates,
`djangojs` (`-d djangojs`) für JavaScript. Sync übersetzt den Katalog jeder Domäne,
die es findet. Der letzte Schritt führt `verify --strict` aus. Ein russischer Pluraleintrag,
dessen Übersetzung die Form `few` oder `many` fehlt, wird mit der Form `other`
geschrieben und als `# champollion:` markiert. Jedes sync beendet mit `2`, solange sich ein solcher Eintrag
in einem Katalog befindet – der Durchlauf, der ihn schreibt, und jeder nachfolgende, wie bei einem zurückgehaltenen
Schlüssel –, und seine Zusammenfassung nennt den Eintrag sowie den Befehl zur erneuten Abfrage; die
Verifizierungszeile nach der Synchronisation meldet dann, dass der Durchlauf unvollständig ist, statt `[OK]`.
Somit lässt der Schritt „Stop when the sync was partial“ den Job nach dem Commit fehlschlagen,
bis die Formen geschrieben sind. Isoliert betrachtet ist dies eine Warnung: einfaches `verify`
beendet dabei mit 0, während `--strict` fehlschlägt. `audit` zählt dieselben Einträge als
unvollständig.

`compilemessages` führt `msgfmt --check-format` aus, was auch prüft, ob jedes
`%(name)s` seinen Typ behält – jedoch nur bei Einträgen mit dem Flag `#, python-format`.
`makemessages` fügt dieses Flag den Einträgen hinzu, die es mit einem `%`-Platzhalter
extrahiert; einem manuell erstellten Katalog fehlt es möglicherweise, und seine Einträge werden dann
nicht geprüft. `champollion verify` vergleicht die printf-Platzhalter jedes Eintrags (Name und Typbuchstabe)
unabhängig von seinen Flags, und sync übernimmt die Flags des Quelleintrags in jeden Eintrag,
den es übersetzt. Der Commit-Schritt staged `*.po` und
`.champollion.lock` namentlich (sowie den Datensatz ersetzter Bearbeitungen, sofern vorhanden);
falls Ihr Projekt seine `.mo`-Dateien nachverfolgt, fügen Sie `'*.mo'` hinzu. Die
Cache-Schritte, der erfasste Exit-Code und das `git pull --rebase` sind aus denselben Gründen
vorhanden wie im obigen Workflow. Babel: `pybabel extract` + `pybabel update --no-wrap` vor
der Synchronisation, `pybabel compile` danach.

Flutter benötigt keinen zusätzlichen Schritt in diesem Job: sync schreibt die `app_<locale>.arb`-Dateien,
und `flutter gen-l10n` (oder `flutter build`, das diesen ausführt) ist der eigene
Build-Schritt Ihrer App, in dem sie in Dart umgewandelt werden.

#### Pluralformen, die ein Modell ausgelassen hat {#plural-gaps}

Ein markierter Eintrag ist keine Übersetzung, daher überlässt sync ihn nicht
einer Person allein:

- **Eine andere Methode oder ein anderes Modell fragt von selbst erneut an.** Ein sync-Durchlauf, dessen Konfiguration
  (Methode, Modell, Register, Coaching) diesen Eintrag noch nicht beantwortet hat, sendet
  ihn erneut an das Modell – nicht an den Cache, der die unvollständige
  Antwort enthält. Wenn also das lokale Modell eines Entwicklers die Formen ausgelassen hat, fragt das gehostete
  Modell des Jobs (`SYNC_FLAGS`) diese bei seinem nächsten Durchlauf an, und die Schätzung
  berücksichtigt dies im Preis. Das Lock (`.champollion.lock`, unter `gaps`) erfasst jede Konfiguration,
  die ohne die Formen geantwortet hat, sodass ein lokaler Durchlauf und ein CI-Durchlauf sich nie
  dabei abwechseln, für dieselbe unvollständige Antwort zu bezahlen.
- **`sync --redo gaps` fragt jeden solchen Eintrag erneut an**, unabhängig davon, wer ihn ausgelassen hat – aktivieren Sie
  in den obigen Workflows `redo_gaps` unter **Run workflow**. Fügen Sie `--model` zu
  `SYNC_FLAGS` für ein leistungsstärkeres Modell hinzu.
- **Fehlen der neuen Antwort ebenfalls die Formen, bleibt der Eintrag markiert** und der
  Durchlauf beendet mit `2` wie zuvor. Tragen Sie die Formen in diesem Fall manuell ein und löschen Sie die
  `# champollion:`-Zeile.

Ein Probelauf (`sync --dry`) nennt die Einträge, die er erneut anfragen würde, und kalkuliert
deren Kosten; seine `--json`-Zusammenfassung zählt diejenigen, bei denen dies nicht der Fall ist (`totalPluralGaps`),
und gibt an, dass der echte Durchlauf ihretwegen mit `2` beenden würde (`realRun.exitCode`).

## Andere Methoden

Die folgenden Snippets zeigen den Schlüssel, den jede Methode benötigt, und ihren `sync`-Befehl.
Verwenden Sie diese **innerhalb** des Schritts „Sync translations“ des obigen Workflows: Tauschen Sie
dessen `env` aus, tragen Sie die gezeigten Flags (`--method openai`, …) in die Zeile
`SYNC_FLAGS` des Workflows ein – damit die Probelauf-Prüfung dieselbe Methode ausführt – und behalten Sie den
Rest des Schritts bei (`id: sync` sowie die Zeilen, die den Exit-Code aufzeichnen), damit ein
unvollständiger Durchlauf dennoch committet, was übersetzt wurde, und den Cache speichert.

## Google-Translate-Methode

Wenn Sie die integrierte Google-Translate-Methode anstelle von OpenRouter verwenden:

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx --yes champollion@0.5 sync
```

## Direkte LLM-Anbieter

Wenn Sie die Methoden `openai`, `anthropic` oder `gemini` direkt verwenden:

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

## Remote-Übersetzungs-API

Wenn Sie einen Remote-Übersetzungsendpunkt verwenden (z. B. einen gehosteten Übersetzungsdienst):

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx --yes champollion@0.5 sync
```

## Ein Gate vor dem Deployment

Um einen Build fehlschlagen zu lassen, wenn ein beliebiges Locale unvollständig oder beschädigt ist, ohne etwas zu
übersetzen, führen Sie die Prüfungen isoliert aus.

:::warning[Führen Sie das Gate nach der Synchronisation aus, nicht davor]
Wenn die Übersetzung erst nach dem Merge ausgeführt wird (der obige Workflow), verfügt ein Pull Request, der
eine Zeichenkette hinzufügt, noch über keine Übersetzung dafür, und `audit`/`verify` schlagen bei jedem
solchen PR fehl. Führen Sie das Gate dort aus, wo die Übersetzungen bereits vorhanden sind: auf `main` nach
dem Synchronisationsjob (`needs: sync` oder `on: workflow_run` des Synchronisations-Workflows). Ein
`push`-Trigger wird bei den eigenen Commits des Synchronisations-Bots nicht ausgelöst – diese werden
mit `GITHUB_TOKEN` gepusht, was keinen Workflow startet (siehe oben). Führen Sie bei Pull Requests
nur `lint` aus, oder führen Sie den Synchronisationsjob zuerst auf dem PR-Branch aus.
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

| Prüfung | Befehl | Schlägt fehl, wenn |
|-------|---------|------------|
| **Lint** | `lint` | Der Quellcode Zeichenketten enthält, die sich in keiner Locale-Datei befinden – oder keine Quelldateien zur Prüfung gefunden wurden (die durchsuchten Ordner werden genannt; verweisen Sie mit `--src <dir>` auf andere Ordner) |
| **Audit** | `audit` | Ein Schlüssel fehlt, leer ist oder noch ein `[EN]`-Fallback ist – oder eine Übersetzung **veraltet** ist: aus einem älteren Quelltext erstellt als dem aktuellen (eine Quellbearbeitung, deren Neuübersetzung fehlgeschlagen ist) – oder einer Plural-Nachricht eine Form fehlt, die die Sprache für alltägliche Zählungen verwendet (russisch `few`/`many`; die Einträge, bei denen `verify --strict` fehlschlägt), zusammen mit dem Befehl zur erneuten Abfrage |
| **Verify** | `verify` | Eine Übersetzung einen Platzhalter, ICU-Plural, Markup (ein Tag unterschiedlich geöffnet, geschlossen oder verschachtelt) oder Skript beschädigt hat – oder ein Schlüssel fehlt – oder ein einzelner Text für mehrere unterschiedliche Quell-Zeichenketten steht (ein Modell wiederholt einen auswendig gelernten Satz) – oder nichts zur Prüfung gefunden wurde (die Quelldatei oder der Locales-Ordner befindet sich nicht dort, wohin die Konfiguration zeigt) |
| **Verify, strict** | `verify --strict` | Einer der obigen Fälle eintritt oder eine beliebige Warnung vorliegt |

`verify` beendet bei jedem Fehler mit `1` und andernfalls mit `0`. Warnungen werden ausgegeben,
lassen den Job aber nicht fehlschlagen: ein Source-Echo, zwei Locales mit identischem Text, eine
veraltete Übersetzung, eine Übersetzung, die das schließende `?` oder `!` der Quelle ausgelassen hat
(manche Sprachen kennzeichnen eine Frage stattdessen mit einer Partikel),
sowie die unten stehenden Plural-Warnungen. Ein einzelner Text, der für mehrere unterschiedliche
Quell-Zeichenketten ausgegeben wurde, gilt als Fehler: zwei eindeutig unterschiedliche Mehrwort-Zeichenketten,
die mit demselben Text von vier oder mehr Wörtern beantwortet wurden, oder andernfalls drei oder mehr Wörtern. Dies wird
über Schlüsselwerte, jeden Pluralzweig und die Markdown-Seiten des Locales hinweg gezählt, nach derselben
Regel, mit der das Gate von `sync` dies ablehnt. `verify --strict` wandelt jede Warnung in
einen Fehler um. Verwenden Sie dies, wenn beispielsweise vom Modell ausgelassene russische Pluralformen
ein Deployment blockieren müssen. Veraltete Übersetzungen sind in `verify` eine Warnung (die
Struktur ist intakt) und in `audit` ein Fehler (das Vollständigkeits-Gate), welches
den Befehl zu deren erneuter Übersetzung ausgibt.

Plural-Befunde hängen davon ab, wie das Format Plurale speichert:

| Format | Fehler (`verify` beendet mit 1) | Warnung (schlägt nur mit `--strict` fehl) |
|--------|--------------------------|--------------------------------------|
| i18next-Schlüssel mit Suffix (`count_one`, `count_other`, …) | Eine vom Locale benötigte Form fehlt (französisches `count_many`): Es handelt sich um einen fehlenden Schlüssel. | Ein Schlüssel für eine Form, die das Locale nicht hat (französisches oder spanisches `count_two`). `verify` gibt den Befehl aus, der genau diese Schlüssel entfernt, `sync --prune plural-extras`; sync löscht sie niemals ohne diesen Befehl. |
| ICU-Nachrichten (`{count, plural, …}` in next-intl, ARB, i18next ICU) | Die Pluralstruktur ist beschädigt (eine übersetzte Variable, ein Schlüsselwort oder Selektor, ein verlorenes `#`). | Ein Zweig, den das Locale für alltägliche Zählungen verwendet, fehlt (russisches `few`, `many`). Eine fehlende Form, die nur für große Zahlen verwendet wird (französisches `many` für 1 000 000), wird nicht gemeldet. |
| gettext (`msgid_plural`) | Ein Eintrag ohne Übersetzung (leer oder `fuzzy`): Es handelt sich um einen fehlenden Schlüssel. | `msgstr[]`-Formen, die die `other`-Form wiederholen, wo die Sprache über eine eigene Form für alltägliche Zählungen verfügt (gekennzeichnet mit einem `# champollion:`-Kommentar). Mehr `msgstr[]`-Zeilen als im `nplurals` des Katalogs. Pluralformen werden anhand des katalogeigenen `Plural-Forms`-Headers gezählt. |

Eine i18next-Form, die aus dem Text einer anderen Form übersetzt wurde, kann genau den
Text dieser Form enthalten (französisches `count_many` identisch mit `count_other`). Im Französischen
können beide gleich geschrieben werden, daher ist dies nie eine Warnung. Wenn sync das Modell nach einer Form fragt,
zeichnet es dies in `.champollion.lock` auf, zusammen mit einem Fingerprint der Antwort. `verify`
liest ausschließlich diesen Eintrag, sodass jeder Klon eines Commits dasselbe Ergebnis erhält. Der Cache Ihres
Laptops und ein frischer CI-Runner können nicht voneinander abweichen. Ein Wert ohne Eintrag
(manuell verfasst, durch ein anderes Tool, durch eine maschinelle Übersetzungs-Engine, der die Form nicht
mitgeteilt werden kann, oder durch eine ältere Version) erhält eine Info-Zeile mit dem Befehl
zur erneuten Abfrage. `--strict` schlägt dabei nicht fehl.
Verify prüft die Struktur, nicht die Bedeutung: Ein erfolgreicher Durchlauf besagt, dass Schlüssel, Platzhalter,
Plurale, Markup und Skript intakt sind, nicht, dass der Text inhaltlich korrekt ist.

---

## Siehe auch

- [CLI-Referenz](/docs/reference/cli) — vollständige Befehlsreferenz
- [Wie die Synchronisierung funktioniert](/docs/concepts/how-sync-works) — die inkrementelle Synchronisierung verstehen
- [Translation Memory](/docs/concepts/translation-memory) — Zwischenspeicherung und Kosteneinsparungen
- [Übersetzungsmethoden](/docs/guides/translation-methods) — Methodenauswahl pro Sprachpaar
- [Quality Gate](/docs/concepts/quality-gate) — was passiert, wenn Übersetzungen fehlschlagen
- [Konfiguration](/docs/getting-started/configuration) — Konfigurationsreferenz
