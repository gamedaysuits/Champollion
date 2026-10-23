---
sidebar_position: 3
title: "CI/CD"
---

# CI/CD-Integration

Automatisieren Sie Übersetzungen in Ihrer Build-Pipeline.

Die champollion-CLI ist source-available unter der [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE): frei zur Nutzung, Änderung und Weitergabe für nicht-kommerzielle Zwecke. Die Nutzung für kommerzielle Zwecke wird durch diese Lizenz nicht abgedeckt ([wer dies nutzen darf](/docs/getting-started/who-may-use-this)).

## GitHub Actions: Übersetzungen synchron halten

Ein vollständiger Workflow: Übersetzen Sie, was sich geändert hat, überprüfen Sie das Ergebnis und committen Sie es zurück. Dies funktioniert für jedes Projekt – ob Node oder nicht (Django, Flutter, Hugo).

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

**Warum der Workflow so aufgebaut ist.** `actions/cache` allein speichert den Cache nur, wenn der gesamte Job erfolgreich ist, und `sync` beendet sich mit `2`, wann immer ein Schlüssel verweigert wird – daher übersprang ein unvollständiger Durchlauf früher sowohl den Commit als auch das Speichern des Caches, und der nächste Durchlauf bezahlte erneut für dieselben Übersetzungen. Hier wird der Cache in zwei Schritten wiederhergestellt und gespeichert (`actions/cache/restore`, dann `actions/cache/save` mit `if: always()`), der Synchronisierungsschritt zeichnet seinen Exit-Code auf, anstatt bei `2` fehlzuschlagen, die übersetzten Dateien werden committet, und erst dann schlägt der Job fehl – in einem eigenen Schritt, vor `verify`, sodass der fehlschlagende Schritt den Grund nennt (ein `--max-cost`-Stopp oder Schlüssel, die der Sync nicht übersetzen konnte), anstatt dass `verify` einen fehlenden Schlüssel benennt. Der letzte Schritt ist `verify --strict`: ein einfaches `verify` beendet sich bei Warnungen mit 0 (darunter eine überzählige oder fehlende Pluralform), und `--strict` lässt den Job bei solchen Warnungen fehlschlagen. Ein Schlüssel, den das Quality Gate abgelehnt hat, wird vorgemerkt: Der nächste Durchlauf sendet ihn nicht erneut an dasselbe Modell (was dieselbe Antwort in Rechnung stellen würde) – das Sync-Protokoll benennt ihn sowie den Befehl `--redo keys:`, der erneut anfragt.

**Eine Cache-Kopie pro Änderung, nicht pro Durchlauf.** Der Wiederherstellungsschritt stellt den neuesten Cache des Branches wieder her (dessen exakter Schlüssel, `…-newest`, wird nie gespeichert, sodass `restore-keys` den aktuellsten auswählt). Der Speicherschritt versieht den Cache mit einem Schlüssel basierend auf einem Hash seiner eigenen Dateien (`hashFiles('.champollion/**')`): Ein Durchlauf, der etwas übersetzt hat – selbst ein unvollständiger Durchlauf oder einer, dessen Push fehlschlug –, hat den Cache verändert, erhält also einen neuen Schlüssel und wird gespeichert; ein Durchlauf, der nichts hinzugefügt hat (nichts zu übersetzen, alles aus dem Cache, ein `--max-cost`-Stopp), besitzt den Schlüssel, den er wiederhergestellt hat, sodass das Speichern übersprungen und keine neue Kopie abgelegt wird. Die Verwendung der Run-ID als Schlüssel speicherte bei jedem Durchlauf eine vollständige Kopie; die Verwendung der Lock- und Quelldateien als Schlüssel würde nach einem Durchlauf mit abgewiesenem Push per exakter Übereinstimmung eine ältere Kopie wiederherstellen, da das committete Lockfile die Änderungen jenes Durchlaufs nie erhalten hat.

In einem Node-Projekt können Sie `champollion` als Dev-Dependency hinzufügen und stattdessen `npx champollion sync` aufrufen; das oben festgepinnte `champollion@0.6` funktioniert in jedem Repository und übernimmt nie unerwartet eine andere Version. Der Job muss es dann installieren: Auf einem frischen Runner ruft `npx champollion` ohne vorinstallierte Pakete die neueste Version ab, nicht diejenige, die Ihre Lockdatei festschreibt. Zudem schreibt die Installation `node_modules/`, was von `git add --all` committet wird, sofern Ihre `.gitignore` dies nicht auflistet (die von `champollion init` erstellte führt nur `.champollion/` auf). Bereiten Sie die Locale-Dateien und die Lockdatei daher namentlich für das Staging vor, so wie es der nachfolgende Django-Workflow handhabt:

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

**Committen Sie die Lockdateien.** `.champollion.lock` und `.champollion-content.lock` zeichnen auf, aus welchem Quelltext jede Übersetzung erstellt wurde. Auf diese Weise erkennt der nächste Durchlauf, dass sich eine Zeichenkette geändert hat. Ein Runner, der sie nie zu Gesicht bekommt, kann eine bearbeitete Zeichenkette nicht von einer unberührten unterscheiden. **Committen Sie `.champollion/` nicht** – es ist der maschinenspezifische Cache; `champollion init` fügt ihn zu `.gitignore` hinzu.

**`--max-cost`** stoppt einen Durchlauf, bevor er mehr kostet, als Sie erwarten; setzen Sie ihn auf den Betrag, den die Änderungen eines normalen Tages verursachen. Wenn dies einen Durchlauf stoppt, wurde nichts übersetzt oder geschrieben, und Sync beendet sich mit dem Code `2`: Es gibt nichts zu committen, und der Schritt „Stop when the sync was partial“ lässt den Job mit entsprechendem Hinweis fehlschlagen. Eine Methode ohne veröffentlichte Preise (ein selbst gehosteter Endpunkt auf einer anderen Maschine) kann nicht geschätzt werden, weshalb `--max-cost` jedes Mal stoppt, wenn etwas zu übersetzen ist – lassen Sie die Option bei solchen Methoden deaktiviert. Ein Modell, das direkt auf dem Runner bereitgestellt wird (`local` unter `localhost`/`127.0.0.1`), wird mit 0 $ API-Kosten veranschlagt.

**Nur Pushes, die eine Quell-Zeichenkette ändern, starten den Job.** Der Filter `paths:` führt Ihre Quell-Locale-Dateien und `champollion.config.json` auf: Ein Push, der nur Code oder nur Übersetzungen und die Lockdateien ändert, enthält nichts zu Übersetzendes und startet daher keinen Job. Passen Sie die beiden Locale-Pfade an die Dateien an, die Ihre Konfiguration benennt (`messages/en.json`, `lib/l10n/app_en.arb`, …); fügen Sie Ihren `contentDir`-Ordner hinzu, falls Sync auch Markdown übersetzt. **Run workflow** (der `workflow_dispatch`-Trigger) führt ihn weiterhin manuell aus.

**Der eigene Commit des Jobs startet ihn niemals erneut** – und der Filter `paths:` ist nicht das, was ihn daran hindert. Der Commit-Schritt pusht mit dem `GITHUB_TOKEN` des Workflows, und ein mit `GITHUB_TOKEN` ausgeführter Push löst niemals einen Workflow-Durchlauf aus (eine GitHub-Regel, damit sich ein Workflow nicht selbst starten kann). Aus diesem Grund kann der nachstehende Django-Workflow `locale/**` überwachen, was durch jeden einzelnen Commit des Bots geändert wird. Wenn Sie stattdessen mit einem Personal Access Token oder einem GitHub-App-Token pushen (beispielsweise um andere Workflows durch den Commit des Bots zu starten), löst jener Push diesen Workflow sehr wohl erneut aus; in diesem Fall entscheidet der Filter `paths:`. Der obige Filter schließt die übersetzten Dateien und die Lockdateien aus, sodass der Commit des Bots keinen Durchlauf startet. Das `locale/**` des Django-Filters erfasst die Kataloge, die der Bot committet, sodass jeder seiner Commits einen weiteren Durchlauf startet – der jedoch nichts zu übersetzen findet und nichts committet. Beschränken Sie die Pfade bei Verwendung eines solchen Tokens auf den Quellkatalog (`locale/en/**`) und fügen Sie Sprachen über die Konfiguration hinzu.

**Der Provider-Schlüssel wird bei jedem gestarteten Durchlauf benötigt**, auch wenn nichts zu übersetzen ist: Sync prüft, ob die Methode ausgeführt werden kann, bevor geprüft wird, was sich geändert hat. Ein manuell gestarteter Durchlauf ohne Quelländerung schlägt ohne das Secret `OPENROUTER_API_KEY` (oder den Schlüssel Ihrer Methode) dennoch fehl. `local` benötigt keinen Schlüssel, aber ein Runner verfügt über keinen Modell-Server: Ein Projekt, das auf dem Rechner einer entwickelnden Person mit `local` übersetzt, benennt in CI eine gehostete Methode (`--method` / `--model` – die auskommentierte Zeile `SYNC_FLAGS` im obigen Workflow). Um zu überprüfen, ob das Secret den Schritt erreicht, ohne etwas zu übersetzen, warnt `sync --dry`, wenn der echte Durchlauf anhalten würde, und nennt die fehlende Variable (es beendet sich dennoch mit 0 – ein Probelauf ist eine Vorschau). Es prüft, ob die Variable **gesetzt** ist, nicht ob der Schlüssel **funktioniert**: Es sendet nichts, sodass jeder nicht-leere Wert akzeptiert wird – auch ein Platzhalter. Ein falscher oder widerrufener Schlüssel zeigt sich bei der ersten Anfrage eines echten Durchlaufs (der Fehler nennt die Antwort des Anbieters, etwa HTTP 401). Um den Job bei fehlendem Schlüssel fehlschlagen zu lassen, bevor irgendetwas ausgeführt wird, fügen Sie [die Prüfung vor dem Sync](#check-before-sync) hinzu.

**Der Cache wird pro Methode geführt.** Eine Übersetzung wird unter der Methode, dem Sprachebenen-Register und der Coaching-Datei zwischengespeichert, mit denen sie erstellt wurde (ein anderes Modell derselben Methode verwendet sie wieder – Modell-Übertrag). Eine Entwicklerin oder ein Entwickler, die oder der mit `local` übersetzt, und eine CI, die mit einem gehosteten Modell übersetzt, teilen sich daher niemals Cache-Einträge – und der Cache von CI ist ohnehin separat (`.champollion/` wird nicht committet). Das bedeutet nicht, dass CI das Projekt neu übersetzt: Was sich bereits in den Locale-Dateien befindet und wessen Lockdatei committet ist, gilt als erledigt. CI bezahlt das gehostete Modell für die Zeichenketten, die seit dem letzten Commit neu sind oder geändert wurden – einschließlich derer, die lokal übersetzt, aber nicht committet wurden – und nichts für den Rest. Das erneute Übersetzen des gesamten Projekts mit dem gehosteten Modell (`--redo all`) stellt jede Zeichenkette einmal in Rechnung.

**Nach Zeitplan** statt bei Push: Ersetzen Sie den Block `on:` durch `schedule: [{ cron: '0 6 * * *' }]`.

### Prüfung vor dem Sync: Den Job frühzeitig abbrechen {#check-before-sync}

Ein Probelauf („Dry Run“) beendet sich mit `0`, ganz gleich, was er vorfindet – es ist eine Vorschau –, sodass `sync --dry --max-cost 5` zwar warnt, dass der echte Durchlauf an der Obergrenze stoppen würde, als CI-Schritt jedoch dennoch erfolgreich durchläuft. Um einen Job fehlschlagen zu lassen, wenn der echte Durchlauf stoppen würde (ein fehlender Schlüssel oder `--max-cost`), werten Sie die Zusammenfassung von `sync --dry --json` aus. Diese Ausgabe besteht aus einem JSON-Objekt pro Zeile (NDJSON), jeweils mit einem `level` – `info`-, `ok`- und `event`-Zeilen auf stdout, `warn`- und `error`-Zeilen auf stderr – und die letzte stdout-Zeile ist die Zusammenfassung, `{"level": "summary", "command": "sync", …}`.
Wählen Sie diese anhand ihres Levels aus. **Führen Sie dies mit denselben Flags wie den Sync aus**: Ohne diese prüft der Befehl die in der Konfiguration angegebene Methode; bei einem Projekt, dessen Konfiguration `local` angibt, würde er also die lokale Methode prüfen – nicht das gehostete Modell, das der Job ausführt – und auf einem Runner ohne Schlüssel erfolgreich durchlaufen. Als Schritt im obigen Workflow vor „Sync translations“ liest er dasselbe `SYNC_FLAGS`:

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

Oder in einer Shell, mit den Flags ausgeschrieben – denselben wie in der Sync-Zeile:

```bash
SYNC_FLAGS="--method llm --model google/gemini-3.8-flash --max-cost 5"
out=$(npx --yes champollion@0.6 sync --dry $SYNC_FLAGS --json)
printf '%s\n' "$out" | jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)' > /dev/null \
  || printf '%s\n' "$out" | jq -r 'select(.level == "summary") | .error // "A real sync would exit \(.realRun.exitCode): \(.realRun.reasons | join("; "))"'
```

`preflight.ready` ist `false`, wenn ein von der Methode benötigter Schlüssel fehlt (nicht gesetzt oder leer – nicht, wenn er falsch ist), unabhängig davon, ob etwas zu übersetzen ist: Eine gehostete Methode ist ohne ihren Schlüssel niemals bereit. `maxCost.wouldStop` (vorhanden bei `--max-cost`) ist `true`, wenn der echte Durchlauf an der Obergrenze stoppen würde. `jq -e` beendet sich bei beiden Fällen mit 1, und der Schritt gibt dann den Grund im Job-Protokoll aus – zum Beispiel:
`A real sync would exit 1: it would stop before translating: No OpenRouter API
key (OPENROUTER_API_KEY) for en:fr`, or `A real sync would exit 2: --max-cost
would stop it before any API call (Estimated translation cost exceeds the
--max-cost cap: estimate ~$7.1200, cap $5.0000)`. Wenn Sync überhaupt nicht ausgeführt werden kann (eine fehlerhafte Konfiguration), gibt der Schritt stattdessen das `error` der Zusammenfassung aus. Der Schritt leitet stderr nicht nach `/dev/null` weiter, sodass die Warnungen ebenfalls im Protokoll verbleiben. Das `realRun.exitCode` der Zusammenfassung gibt an, mit welchem Exit-Code der echte Durchlauf enden würde, soweit eine Vorschau dies ermitteln kann: `1`, wenn der Preflight ihn stoppen würde, `2`, wenn `--max-cost` dies täte oder wenn er unvollständig enden würde – zurückgehaltene Schlüssel oder Plural-Nachrichten auf der Festplatte ohne eine von der Sprache verwendete Form (`realRun.reasons` gibt an, welche). Eine Verweigerung durch das Quality Gate, die erst der echte Durchlauf feststellt, kann ein `0` immer noch in ein `2` verwandeln. Um die Prüfung auch bei einem vorhergesagten unvollständigen Durchlauf fehlschlagen zu lassen, setzen Sie `.realRun.exitCode == 0` anstelle von `.preflight.ready and (.maxCost.wouldStop | not)` ein.

### Ein geschützter Main-Branch: Einen Pull-Request vorschlagen

Der obige Workflow pusht die Übersetzungen direkt nach `main`. Wenn `main` geschützt ist (erforderliche Reviews oder Statusprüfungen), wird dieser Push abgewiesen – und zwar nachdem der Sync gelaufen ist, sodass die Übersetzungen bereits bezahlt wurden. Sie werden jedoch nicht erneut bezahlt: Der Cache wird vor dem Commit-Schritt gespeichert, selbst wenn ein Schritt fehlschlägt. Ein erneuter Durchlauf des Jobs oder der nächste Push (beide stellen über `restore-keys` den neuesten Cache des Branches wieder her) bedient sie daher aus dem Cache. Die Lockdateien haben `main` nie erreicht, daher findet der nächste Durchlauf dieselben Zeichenketten als geändert vor und schreibt sie erneut – aus dem Cache, ohne Kosten.

Committen Sie auf einem geschützten `main` stattdessen in einen Branch, der dem Bot gehört, und öffnen (oder aktualisieren) Sie einen Pull-Request. Behalten Sie den obigen Workflow bei und ändern Sie zwei Dinge: die Berechtigungen und den Commit-Schritt.

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

**Wann was verwendet werden sollte.** Pushen Sie nach `main`, wenn der Workflow dorthin pushen darf: kein Branch-Schutz oder eine Regel, die GitHub Actions das Umgehen gestattet. Öffnen Sie einen Pull-Request, wenn `main` geschützt ist oder wenn eine Person – jemand, der die Sprache spricht – die Übersetzungen vor der Veröffentlichung prüfen soll.

- Der Branch gehört dem Bot. Bis der Pull-Request gemergt wird, enthalten die Lockdateien von `main` dessen Übersetzungen nicht, sodass jeder Durchlauf das gesamte Set erneut vorschlägt – aus dem Cache, sodass nur seitdem geänderte Zeichenketten abgerechnet werden. Bearbeitungen, die in diesen Branch gepusht werden, werden beim nächsten Durchlauf ersetzt: Prüfen Sie im Pull-Request, mergen Sie und bearbeiten Sie erst auf `main` (eine spätere Massen-Neuerstellung behält die Bearbeitung einer Person bei).
- Das Repository muss Actions das Öffnen von Pull-Requests erlauben: Settings → Actions → General → „Allow GitHub Actions to create and approve pull requests“.
- Ein mit dem `GITHUB_TOKEN` des Workflows geöffneter Pull-Request startet keinen anderen Workflow, sodass erforderliche Statusprüfungen darauf niemals ausgeführt werden. Wenn `main` diese vorschreibt, öffnen Sie ihn mit einem GitHub-App-Token oder einem feingranularen Token, das als Secret hinterlegt ist (`GH_TOKEN: ${{ secrets.<name> }}`), oder verwenden Sie eine Action wie `peter-evans/create-pull-request`, die für Sie committet, den Branch aktualisiert und den offenen Pull-Request bearbeitet (übergeben Sie das Token auf dieselbe Weise).

### gettext (Django, Babel) und Flutter

Sync übersetzt die bestehenden Kataloge; es extrahiert keine Zeichenketten aus Ihrem Code. Ein Django-Projekt aktualisiert die Kataloge vor dem Sync-Schritt, prüft danach deren Kompilierung und committet ausschließlich die Kataloge.

Sowohl `makemessages` als auch `compilemessages` importieren Ihre Einstellungen, sodass der Job einmalig für jeden Schritt festlegt, was benötigt wird: jede Variable, die Ihr Settings-Modul beim Import liest (`SECRET_KEY`, `DATABASE_URL`, …). Keiner der beiden Befehle greift auf die Datenbank zu, daher genügt hierfür ein Platzhalterwert. `DJANGO_SETTINGS_MODULE` bleibt auskommentiert: Die Datei `manage.py`, die `startproject` schreibt, setzt dies selbst, und ein im Job gesetzter Wert überschreibt diesen – ein falscher Modulname führt zu einem Fehler in `makemessages`. Setzen Sie ihn nur, wenn Ihre `manage.py` dies nicht tut.

Dessen Filter `paths:` unterscheidet sich vom obigen Workflow: Die Quell-Zeichenketten befinden sich in Ihrem Python-Code und Ihren Templates, und `makemessages` extrahiert sie im Job, sodass eine Code-Änderung eine neue Zeichenkette mit sich bringen kann. Grenzen Sie die Muster auf Ihre Apps ein (`myapp/**.py`), falls jeder Push Python-Dateien berührt. Er überwacht auch `locale/**`: Eine neue Sprache trifft als neuer Katalogordner ein (`makemessages -l <code>`). Der eigene Commit des Bots ändert diese Kataloge, startet jedoch keinen Durchlauf, da er mit `GITHUB_TOKEN` gepusht wird (siehe oben **Der eigene Commit des Jobs startet ihn niemals erneut** – und worauf Sie die Pfade eingrenzen sollten, wenn Sie mit einem anderen Token pushen).

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

`--all` aktualisiert jeden bereits existierenden Katalog; fügen Sie eine Sprache einmalig mit `makemessages -l <code>` (oder `champollion init --langs <code>`) hinzu.
`makemessages` wird einmal pro Domain ausgeführt: `django` für Python und Templates, `djangojs` (`-d djangojs`) für JavaScript. Sync übersetzt den Katalog jeder Domain, die es findet. Der letzte Schritt führt `verify --strict` aus. Ein russischer Pluraleintrag, dessen Übersetzung die Form `few` oder `many` vermissen lässt, wird mit der Form `other` geschrieben und als `# champollion:` markiert. Jeder Sync beendet sich mit `2`, solange sich ein solcher Eintrag in einem Katalog befindet – derjenige, der ihn schreibt, und jeder darauffolgende, genau wie bei einem zurückgehaltenen Schlüssel –, und seine Zusammenfassung nennt den Eintrag sowie den Befehl zur erneuten Abfrage; die Überprüfungszeile nach dem Sync meldet dann, dass der Durchlauf unvollständig ist, anstelle von `[OK]`. Daher lässt der Schritt „Stop when the sync was partial“ den Job nach dem Commit fehlschlagen, bis die Formen geschrieben sind. Isoliert betrachtet ist dies eine Warnung: Ein einfaches `verify` beendet sich dabei mit 0, während `--strict` fehlschlägt. `audit` zählt dieselben Einträge als unvollständig.

`compilemessages` führt `msgfmt --check-format` aus, was ebenfalls prüft, dass jedes `%(name)s` seinen Typ behält – jedoch nur bei Einträgen, die mit `#, python-format` gekennzeichnet sind. `makemessages` fügt dieses Flag den Einträgen hinzu, die es mit einem `%`-Platzhalter extrahiert; einem manuell erstellten Katalog fehlt dies möglicherweise, und seine Einträge werden dann nicht geprüft. `champollion verify` vergleicht die printf-Platzhalter jedes Eintrags (Name und Typbuchstabe) ungeachtet seiner Flags, und Sync behält die Flags des Quelleintrags bei jedem übersetzten Eintrag bei. Der Commit-Schritt stellt `*.po` und `.champollion.lock` namentlich für das Staging bereit (sowie das Protokoll ersetzter Bearbeitungen, sofern vorhanden); falls Ihr Projekt seine `.mo`-Dateien versioniert, fügen Sie `'*.mo'` hinzu. Die Cache-Schritte, der aufgezeichnete Exit-Code und das `git pull --rebase` sind aus denselben Gründen vorhanden wie im obigen Workflow. Babel: `pybabel extract` + `pybabel update --no-wrap` vor dem Sync, `pybabel compile` danach.

Flutter benötigt in diesem Job keinen zusätzlichen Schritt: Sync schreibt die `app_<locale>.arb`-Dateien, und `flutter gen-l10n` (oder `flutter build`, das dies ausführt) ist der eigene Build-Schritt Ihrer App, in dem sie in Dart umgewandelt werden.

#### Pluralformen, die ein Modell ausgelassen hat {#plural-gaps}

Ein markierter Eintrag ist keine Übersetzung, daher überlässt Sync dies nicht einer Person allein:

- **Eine andere Methode oder ein anderes Modell fragt selbstständig erneut an.** Ein Sync, dessen Konfiguration (Methode, Modell, Register, Coaching) jenen Eintrag noch nicht beantwortet hat, sendet ihn erneut an das Modell – nicht an den Cache, der die unvollständige Antwort enthält. Wenn also das lokale Modell einer Entwicklerin oder eines Entwicklers die Formen ausgelassen hat, fragt das gehostete Modell des Jobs (`SYNC_FLAGS`) sie beim nächsten Durchlauf an, und die Kostenschätzung preist dies ein. Die Lockdatei (`.champollion.lock` unter `gaps`) zeichnet jedes Setup auf, das ohne die Formen geantwortet hat, sodass ein lokaler Durchlauf und ein CI-Durchlauf sich niemals abwechselnd dafür bezahlen, dieselbe unvollständige Antwort zu erhalten.
- **`sync --redo gaps` fragt jeden solchen Eintrag an**, ganz gleich, wer ihn ausgelassen hat – setzen Sie in den obigen Workflows unter **Run workflow** ein Häkchen bei `redo_gaps`. Fügen Sie `--model` zu `SYNC_FLAGS` für ein leistungsstärkeres Modell hinzu.
- **Fehlen den Formen auch in der neuen Antwort, bleibt der Eintrag markiert** und der Durchlauf beendet sich wie zuvor mit `2`. Verfassen Sie die Formen in diesem Fall manuell und löschen Sie die Zeile `# champollion:`.

Ein Probelauf (`sync --dry`) nennt die Einträge, die er erneut anfragen würde, und schätzt deren Kosten; seine `--json`-Zusammenfassung zählt diejenigen, bei denen dies nicht der Fall wäre (`totalPluralGaps`), und weist darauf hin, dass sich der echte Durchlauf deswegen mit `2` beenden würde (`realRun.exitCode`).

## Weitere Methoden

Die folgenden Code-Ausschnitte zeigen den Schlüssel, den jede Methode benötigt, sowie ihren `sync`-Befehl. Verwenden Sie diese **innerhalb** des Schritts „Sync translations“ des obigen Workflows: Tauschen Sie dessen `env` aus, tragen Sie die angegebenen Flags (`--method openai`, …) in die Zeile `SYNC_FLAGS` des Workflows ein – damit die Probelauf-Prüfung dieselbe Methode ausführt – und behalten Sie den Rest des Schritts bei (`id: sync` und die Zeilen, die den Exit-Code aufzeichnen), damit ein unvollständiger Durchlauf dennoch committet, was er übersetzt hat, und den Cache speichert.

## Google-Translate-Methode

Bei Verwendung der integrierten Google-Translate-Methode anstelle von OpenRouter:

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx --yes champollion@0.6 sync
```

## Direkte LLM-Provider

Bei direkter Verwendung der Methoden `openai`, `anthropic` oder `gemini`:

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

## Remote Translation API

Bei Verwendung eines Remote-Übersetzungsendpunkts (z. B. eines gehosteten Übersetzungsdienstes):

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx --yes champollion@0.6 sync
```

## Ein Gate vor dem Deployment

Um einen Build fehlschlagen zu lassen, wenn ein beliebiges Locale unvollständig oder beschädigt ist, ohne etwas zu übersetzen, führen Sie die Prüfungen separat aus.

:::warning[Führen Sie das Gate nach dem Sync aus, nicht davor]
Wenn die Übersetzung erst nach dem Mergen ausgeführt wird (wie im obigen Workflow), besitzt ein Pull-Request, der eine Zeichenkette hinzufügt, noch keine Übersetzung dafür, und `audit`/`verify` lassen jeden solchen PR fehlschlagen. Führen Sie das Gate dort aus, wo die Übersetzungen bereits vorhanden sind: auf `main` nach dem Sync-Job (`needs: sync` oder `on: workflow_run` des Sync-Workflows). Ein `push`-Trigger wird bei den eigenen Commits des Sync-Bots nicht ausgelöst – diese werden mit `GITHUB_TOKEN` gepusht, was keinen Workflow startet (siehe oben). Führen Sie bei Pull-Requests nur `lint` aus, oder führen Sie den Sync-Job zuerst auf dem PR-Branch aus.
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

| Prüfung | Befehl | Schlägt fehl, wenn |
|---|---|---|
| **Lint** | `lint` | Quellcode Zeichenketten enthält, die in keiner Locale-Datei vorhanden sind – oder keine Quelldateien zur Prüfung gefunden wurden (die durchsuchten Ordner werden genannt; mit `--src <dir>` verweisen Sie auf andere Pfade) |
| **Audit** | `audit` | Ein Schlüssel fehlt, leer ist oder noch ein `[EN]`-Fallback ist – oder eine Übersetzung **veraltet** ist: basierend auf einem älteren Quelltext als dem aktuellen erstellt (eine Quelltextänderung, deren erneute Übersetzung fehlschlug) – oder einer Plural-Nachricht eine Form fehlt, die die Sprache für alltägliche Zählungen verwendet (russisch `few`/`many`; die Einträge, bei denen `verify --strict` fehlschlägt), zusammen mit dem Befehl zur erneuten Abfrage |
| **Verify** | `verify` | Eine Übersetzung einen Platzhalter, ICU-Plural, Markup (ein Tag anders geöffnet, geschlossen oder verschachtelt) oder Skript beschädigt hat – oder ein Schlüssel fehlt – oder ein einzelner Text für mehrere unterschiedliche Quell-Zeichenketten steht (ein Modell wiederholt einen auswendig gelernten Satz) – oder nichts zur Prüfung gefunden wurde (die Quelldatei oder der Locales-Ordner befindet sich nicht dort, wohin die Konfiguration verweist) |
| **Verify, strict** | `verify --strict` | Beliebiger der obigen Punkte zutrifft oder eine Warnung auftritt |

`verify` beendet sich bei jedem Fehler mit `1` und andernfalls mit `0`. Warnungen werden ausgegeben, lassen den Job jedoch nicht fehlschlagen: ein Quellecho, zwei Locales mit identischem Text, eine veraltete Übersetzung, eine Übersetzung, die das schließende `?` oder `!` der Quelle ausgelassen hat (manche Sprachen kennzeichnen eine Frage stattdessen mit einer Partikel), sowie die nachstehenden Plural-Warnungen. Ein einziger Text, der für mehrere verschiedene Quell-Zeichenketten geschrieben wurde, gilt als Fehler: zwei eindeutig verschiedene Mehrwort-Zeichenketten, die mit demselben Text aus vier oder mehr Wörtern beantwortet wurden, oder sonst aus drei oder mehr Wörtern. Dies wird über Schlüsselwerte, jeden Pluralzweig und die Markdown-Seiten des Locales hinweg nach der Regel gezählt, mit der das Gate von `sync` dies ablehnt. `verify --strict` verwandelt jede Warnung in einen Fehler. Verwenden Sie dies, wenn beispielsweise vom Modell ausgelassene russische Pluralformen ein Deployment blockieren müssen. Veraltete Übersetzungen sind in `verify` eine Warnung (die Struktur ist intakt) und in `audit` ein Fehler (das Vollständigkeits-Gate), welches den Befehl ausgibt, der sie erneut übersetzt.

Plural-Befunde hängen davon ab, wie das Format Plurale speichert:

| Format | Fehler (`verify` beendet sich mit 1) | Warnung (schlägt nur mit `--strict` fehl) |
|---|---|---|
| i18next-Schlüssel mit Suffix (`count_one`, `count_other`, …) | Eine vom Locale benötigte Form fehlt (französisches `count_many`): Es handelt sich um einen fehlenden Schlüssel. | Ein Schlüssel für eine Form, die das Locale nicht besitzt (französisches oder spanisches `count_two`). `verify` gibt den Befehl aus, der genau diese Schlüssel entfernt, `sync --prune plural-extras`; Sync löscht sie niemals ohne diesen. |
| ICU-Nachrichten (`{count, plural, …}` in next-intl, ARB, i18next ICU) | Die Pluralstruktur ist beschädigt (eine übersetzte Variable, ein übersetztes Schlüsselwort oder ein Selektor, ein verlorenes `#`). | Ein Zweig, den das Locale für alltägliche Zählungen verwendet, fehlt (russisches `few`, `many`). Eine fehlende Form, die nur für große Zahlen verwendet wird (französisches `many` für 1 000 000), wird nicht gemeldet. |
| gettext (`msgid_plural`) | Ein Eintrag ohne Übersetzung (leer oder `fuzzy`): Es handelt sich um einen fehlenden Schlüssel. | `msgstr[]`-Formen, die die `other`-Form wiederholen, obwohl die Sprache eine eigene Form für alltägliche Zählungen besitzt (gekennzeichnet mit einem `# champollion:`-Kommentar). Mehr `msgstr[]`-Zeilen als im `nplurals` des Katalogs. Pluralformen werden anhand des katalogeigenen `Plural-Forms`-Headers gezählt. |

Eine aus dem Text einer anderen Form übersetzte i18next-Form kann exakt den Text jener Form enthalten (französisches `count_many` identisch mit `count_other`). Im Französischen können beide gleich geschrieben werden, daher ist dies niemals eine Warnung. Wenn Sync das Modell nach einer Form fragt, zeichnet es dies in `.champollion.lock` mit einem Fingerabdruck der Antwort auf. `verify` liest ausschließlich diesen Datensatz, sodass jeder Klon eines Commits dasselbe Ergebnis erhält. Der Cache Ihres Laptops und ein frischer CI-Runner können nicht voneinander abweichen. Ein Wert ohne Datensatz (von Hand verfasst, von einem anderen Tool, von einer maschinellen Übersetzungs-Engine, der die Form nicht mitgeteilt werden kann, oder von einer älteren Version) erhält eine Info-Zeile mit dem Befehl zur erneuten Abfrage. `--strict` schlägt dabei nicht fehl.
Verify prüft die Struktur, nicht die Bedeutung: Ein erfolgreicher Durchlauf besagt, dass Schlüssel, Platzhalter, Plurale, Markup und Skript intakt sind, nicht, dass der Text inhaltlich das Richtige aussagt.

---

## Siehe auch

- [CLI-Referenz](/docs/reference/cli) – Vollständige Befehlsreferenz
- [Wie Sync funktioniert](/docs/concepts/how-sync-works) – Inkrementellen Sync verstehen
- [Translation Memory](/docs/concepts/translation-memory) – Caching und Kosteneinsparungen
- [Übersetzungsmethoden](/docs/guides/translation-methods) – Methodenauswahl pro Sprachpaar
- [Quality Gate](/docs/concepts/quality-gate) – Was geschieht, wenn Übersetzungen fehlschlagen
- [Konfiguration](/docs/getting-started/configuration) – Konfigurationsreferenz
