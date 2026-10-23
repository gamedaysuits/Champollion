---
title: "Die Rails über die Shell steuern"
slug: /agents/shell
description: "Jeder Rails-Schritt als gewöhnlicher Befehl: installieren, ein Projekt starten, Daten einbringen, deren Begriffe erfassen, ein Modell mit nmt-forge trainieren und testen, die Verbesserungsrunden durchführen, mit mt-eval übersetzen und bereitstellen — plus Offline-Modus, die Umgebungsvariablen, die die Werkzeuge lesen, und Exit-Codes."
---

# Die Rails über die Shell steuern

Jeder Schritt auf den Rails ist ein gewöhnlicher Befehl. Ein Agent ohne MCP – oder eine
Person an einem Terminal – durchläuft dieselben Rails mit drei Programmen:
`champollion`, `nmt-forge` und `mt-eval`. Sie müssen sich die Reihenfolge nie
merken: `champollion next` nennt den nächsten Schritt samt seinem Modus und dem
genauen Befehl, ausgelesen aus den Dateien des Projekts.

Die Regeln sind dieselben wie über MCP. Ein `confirm`-Schritt wird erst ausgeführt, nachdem
die Person zustimmt; die Antworten eines `ask_user`-Schritts gehören ihr
([der Vertrag](/docs/agents/contract)).

## Installation

```bash
npm install -g champollion                  # Node.js 20.11 or newer
uv tool install --python 3.12 nmt-forge     # brings mt-eval (mt-eval-harness) with it
```

**Hinweis.** Beide laden Pakete herunter: `confirm`-Modus – fragen Sie zuerst nach. Schlägt `uv
--version` fehl, installiert die Person uv von https://docs.astral.sh/uv/;
ein Agent lädt keine Installationsprogramme herunter. Das Training erfordert außerdem forges
Training-Extra (PyTorch und Hugging-Face-Transformers, mehrere hundert MB). Forge nennt
es, wenn es fehlt (Status `needs-training-extra`):

```bash
uv tool install --reinstall --python 3.12 'nmt-forge[hf]'
```

Die Rails benötigen `nmt-forge` 0.3.0 oder neuer; eine ältere Version wird zusammen mit ihrem
Upgrade-Befehl genannt (`uv tool install --upgrade --python 3.12 nmt-forge`).

## Die Schleife

```bash
champollion next              # the next step: what to say, why, the command, how to take it
champollion next --json       # the same, for a program (see the rails model page for the shape)
champollion next --write      # also rewrite NEXT.md, the person's copy
```

`How:` in der Ausgabe für Menschen ist der Modus: `run it` (`auto`), `zuerst nachfragen, dann
ausführen` (`confirm`), `die Person fragen, die die Daten hält – niemals an ihrer
Stelle antworten` (`ask_user`), `warten, dann erneut nachfragen` (`wait`), `dies tut eine Person`
(`human_only`). Führen Sie den genannten Befehl aus und fragen Sie dann erneut nach. Das Verlassen
der Rails ist völlig in Ordnung – führen Sie einen beliebigen Expertenbefehl aus, dann `champollion next`: Der nächste Schritt
wird aus den Dateien abgelesen.

## Start

```bash
champollion new family --from English --to qaa --target-name "Our language" --dry
champollion new family --from English --to qaa --target-name "Our language" --purpose "notes for the grandchildren"
cd family
```

Sprachen sind Codes oder Namen, die über die Sprachkarten aufgelöst werden. Eine Varietät
ohne Code erhält einen Code für den privaten Gebrauch (`qaa`–`qtz`) und den Namen, den ihre Gemeinschaft
ihr gibt (`--target-name`, `--source-name`). **Hinweis.** Wiederholen Sie die Sprachrichtung zur Bestätigung,
bevor das Projekt erstellt wird: `--dry` löst beide Sprachen auf und schreibt
nichts. Übergeben Sie jede Sprache genau so, wie die Person sie genannt hat.

## Daten sammeln und Bedingungen erfassen

```bash
champollion data add ../family-files/grandpa.xlsx                     # pairs → data/parallel/
champollion data add ../family-files/grandpa.xlsx --source-col A --target-col B --header
champollion data add ../family-files/words.lift --into lexicon        # a word list → data/lexicon/
champollion data add ../family-files/recording.eaf --source-col <number> --target-col <number>   # ELAN: tier numbers
```

`data add` liest `.xlsx`, `.ods`, `.csv`, `.tsv`, `.txt`, Word-`.docx`-Tabellen,
Toolbox- und LIFT-Wörterbücher, ELAN-`.eaf` und USFM
(`--usfm-source`). Es schreibt `<stem>.tsv` und dessen Sidecar-Datei, lässt das Original
unberührt und gibt Anzahlen, Spalten sowie die Zeilennummern aus, die seine Zeilenprüfung
benennt (Kopien, Wiederholungen, auffällige Längen, vertauschte oder verschobene Zeilen – nichts
wird entfernt) – niemals Sätze. Wenn es nicht erkennen kann, welche Spalte (oder ELAN-Tier,
nach Nummer, oder LIFT-Sprache) welche ist, verweigert es die Ausführung und fragt nach; fragen
Sie die Person. `--replace` liest dasselbe Original noch einmal mit anderen Spalten und behält
die Antworten der Datenhaltenden bei; `--name <stem>` fügt eine weitere Datei unter einem anderen Namen hinzu.
Siehe [Datenregeln](/docs/agents/data-rules#what-tools-print-and-never-print).

Anschließend die Bedingungen, Datei für Datei, anhand der Antworten der Person:

```bash
champollion data mark data/parallel/grandpa.tsv --speakers "grandpa" --speakers-agreed yes \
  --owner "our family" --training allowed --local-only
```

`--local-only` oder `--may-leave` ist für eine Datei erforderlich, die noch nicht rein lokal vorliegt.
Der terms-Schritt der Journey fragt jede Datei in `data/parallel/`,
`data/lexicon/`, `data/grammar/` und `data/monolingual/` ab, bis sowohl ihre
Trainings-Antwort als auch `--speakers-agreed` festgehalten sind. Jeder Wert stammt von den
Datenhaltenden – siehe [Datenregeln](/docs/agents/data-rules) dazu, was die einzelnen Werte bewirken
und was der Befehl verweigert.

## Den Testsatz schützen

```bash
champollion data add ../family-files/checked.tsv --into test
champollion data mark data/test/checked.tsv --role test --training not-allowed --local-only
```

## Ein Modell bauen und testen

Die Journey nennt diese der Reihe nach (wobei deren `{placeholders}` aus dem
Projekt befüllt wird):

```bash
nmt-forge init qaa --dir . --pair eng-qaa --no-card --name "Our language" --model auto
nmt-forge registry add project-test data/test/checked.tsv --role test
champollion data combine
nmt-forge leak-audit data/parallel/combined.tsv --clean-to data/clean/combined.clean.jsonl
nmt-forge prereg new first-model --eval-set project-test --expect "<their words>" --rationale "<their reason>"
nmt-forge split data/clean/combined.clean.jsonl --test 0 --dev 50 --seed 42 --near-dupe 0.6 --max-group 26 --out data/split --register project
nmt-forge floor data/lexicon/words.tsv
```

- `init --model auto` wählt anhand des Arbeitsspeichers das stärkste Modell aus, das dieser Computer in Stunden trainieren kann ([Training](/docs/agents/training#models)). Bei Vorliegen einer Sprachkarte entfällt `--no-card --name`.
- `data combine` wird nur ausgeführt, wenn `data/parallel/` mehr als eine Datei enthält. Es behält die strengsten Bedingungen der zusammengeführten Dateien bei und weist Dateien ab, deren Rechteinhaber noch nicht geantwortet haben – ob ein Modell daraus lernen darf und ob alle Personen zugestimmt haben, deren Worte darin enthalten sind.
- `prereg new` ist ein `ask_user`-Schritt: `--expect` und `--rationale` sind die Worte der Menschen, genau so, wie sie sie gesagt haben, festgehalten, bevor irgendeine Bewertung existiert. Die Frage legt keine Zahl nahe, und Sie tun es ebenfalls nicht.
- Der Dev-Umfang, den die Journey einträgt (`dev_n`), entspricht einem Zehntel der geprüften Paare, mindestens 50 und höchstens 500; bei weniger als 200 Paaren ist es stattdessen ein Viertel davon, sodass das meiste für das Training erhalten bleibt – und das sind unter 50.
  Folglich: 40 Dev-Sätze aus 160 Paaren, 50 bei 200 bis 500 Paaren, 160 aus 1.600, 500 ab 5.000 Paaren. Unter 50 kann keine Runde anhand des Dev-Sets beurteilt werden ([Messung](/docs/agents/measurement#comparing-two-models)).
  `--near-dupe 0.6` behält Fast-Duplikate auf einer Seite; `--max-group` ist die Hälfte des Dev-Umfangs, abgerundet, plus eins.
- `floor` gilt nur, wenn `data/lexicon/` eine Wortliste enthält.

Ab hier nennt forges eigener Berater jeden Schritt. `champollion next` leitet ihn weiter;
`nmt-forge status` gibt ihn direkt aus:

```bash
nmt-forge preflight run --config config.json && nmt-forge run config.json --detach
nmt-forge jobs                      # what is running
nmt-forge status                    # the next step, with what is ready and what blocks it
nmt-forge export <run-manifest.json> --prereg first-model --out export/
nmt-forge serve export/model --detach
nmt-forge tidy                      # earlier rounds' model weights nothing uses, and the space they take
```

Das Training ist `confirm` (es verbraucht Rechenleistung, Minuten bis Stunden); während ein abgetrennter Lauf trainiert, lautet der Schritt `wait`. `nmt-forge run` verweigert einen Lauf, für den der Speicherplatz nicht ausreicht, noch vor dem Start (`[disk-room]`) unter Angabe des freien Speicherplatzes, der Schätzung und dessen, was `nmt-forge tidy` freigeben würde; `nmt-forge tidy --yes` gibt diesen frei, und `--skip-disk-check` bei `run` startet trotzdem, was im Lauf vermerkt wird. Diese beiden Entscheidungen liegen bei der Person, nicht bei Ihnen ([Training](/docs/agents/training#disk-space)).
Der Export bewertet das Modell einmal auf dem Testset im Vergleich zur Vorhersage.
Die Auswahl unter mehreren Exporten obliegt der Person
(`nmt-forge choose <model folder>`). Nach einer Bewertung auf dem Testset beurteilen die Menschen ihre Vorhersage:

```bash
nmt-forge prereg verdict first-model --prediction 1 --held --by "grandma"
```

(`--missed`, wenn sie nicht zutraf; `--prediction` ist die Nummer der Vorhersage,
1 bei einer einzelnen `--expect`; `--by` nennt, wer geurteilt hat, genau wie gesagt.) Siehe
[Training](/docs/agents/training) für jeden forge-Befehl und jede Verweigerung.

## Die Verbesserungsrunden

Sobald ein Modell bereitgestellt ist, beginnen die Runden:

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

- `improve sheet`: Solange der Entwicklungsdatensatz (Übungsdatensatz) unter 200 Sätzen liegt, haben manche Zeilen keinen Entwurf – eine von zwei, solange er unter 50 liegt, eine von vier ab 50 –, und die sprechende Person verfasst sie. `improve marks` schreibt sie nach `data/dev/` und `improve prepare` fügt sie dem Entwicklungsdatensatz (`nmt-forge grow-dev`) hinzu, niemals dem Training. Zudem führt es `nmt-forge draft-newer` aus. Gibt es ein weiteres Modell – das neueste trainierte, wenn es nicht verwendet wird (nach seiner Runde nicht zum Einsatz gebracht: zu wenige Daten für eine Aussage, keine messbare Veränderung oder schlechter), oder nach einer Beförderung das Modell, welches das aktuell verwendete ersetzt hat –, so entwirft dieses Modell eine zufällige Hälfte der mit Entwürfen versehenen Zeilen, unmarkiert, und der Schlüssel verbleibt neben der Tabelle (`sheet-key.json`). `improve marks` zählt jedes Modell anschließend getrennt – der Blindvergleich, der nach einer Beförderung die Prüfung darstellt, die der Bericht benötigt, bevor er einen Anstieg als echten Fortschritt bezeichnet ([Messung](/docs/agents/measurement#the-speakers-marks)).
- `improve sheet`, ab Runde 2: Eine Zeile pro 10 neue Sätze (abgerundet) ist ein Entwurf, den die sprechende Person auf einer früheren Tabelle mit `Y` oder `N` bewertet hat, unmarkiert an einer zufälligen Stelle zurückgekehrt. Die erste Zeile der Tabelle besagt, dass einige Zeilen absichtlich wiederkehren, jedoch nie welche; `sheet-key.json` listet sie auf (`repeat_rows`). Der Befehl gibt aus, wie viele zurückgekehrt sind, *"(welche, ist nicht markiert)"*, und dass sie *"etwa 10 Sekunden pro Zeile, nie wieder darauf trainiert"* in Anspruch nehmen.
- `improve marks` bewertet eine erneut angezeigte Zeile nur im Abgleich mit der früheren Bewertung der sprechenden Person – niemals im Anteil der Runde, den Trainingspaaren oder dem Blindvergleich –, schreibt `repeats` in `marks.json` und gibt aus: *"Erneut angezeigte Zeilen: Die sprechende Person hat A von J so bewertet wie zuvor (P %) – W einmal falsch, jetzt richtig; R einmal richtig, jetzt falsch. Fließt nicht in den Anteil dieser Runde ein und wird nie wieder darauf trainiert."*
- `improve marks` erfasst die Zählwerte bei forge (nur Zählwerte, niemals einen Satz), wenn das andere Modell das neuere ist und die sprechende Person mindestens einen Entwurf von jedem bewertet hat:

  ```bash
  nmt-forge speaker-verdict --newer <run> --in-use <run> --newer-right <n> --newer-judged <n> --in-use-right <n> --in-use-judged <n> --json
  ```

  Hat die sprechende Person das neuere Modell deutlich häufiger als richtig bewertet, gibt es aus: *„forge hat es aufgezeichnet: es schlägt vor, das neuere Modell in Betrieb zu nehmen (die Menschen stimmen zuerst zu)“*; wenn forge nicht installiert ist oder die Ausführung verweigert, meldet es, dass die Bewertungen nicht aufgezeichnet wurden, und warum.
- `improve prepare` endet mit `nmt-forge round-plan`: Die Runde setzt das Training ausgehend vom aktuell genutzten Modell fort (4 Durchläufe über alle bisherigen Sätze) oder trainiert von Grund auf neu und begründet dies ([Training](/docs/agents/training#the-improve-rounds)).

Forge beurteilt das neue Modell anschließend im Vergleich zu dem aktuell verwendeten
(`nmt-forge compare-runs <in-use run-manifest.json> <new run-manifest.json>`,
`auto`) und bietet dessen Einsatz (`confirm`) nur dann an, wenn es messbar
besser ist – oder, falls die Datenmenge für ein klares Urteil zu gering war (unter 50 Dev-Sätze)
oder keine messbare Änderung vorlag, sobald die Blindbewertungen der Sprechenden es eindeutig
bevorzugt haben. Ein Urteil allein setzt nichts in Betrieb: Nur das Ja der Menschen (`nmt-forge export`
und `nmt-forge choose` dieses Schritts) tut dies. Die neuen Paare aus `improve marks` erhalten zuerst ihre eigenen Begriffe – danach
fragt die Reise. Wie der Bericht weitergegeben wird: [Coaching](/docs/agents/coaching).

## Übersetzen und bereitstellen mit mt-eval

`nmt-forge export` innerhalb eines Projekts schreibt `deploy/<name>.json` (deployment/1).
Dieselbe Datei misst, übersetzt und stellt bereit:

```bash
mt-eval translate --deployment deploy/<name>.json --source-file <input file> --out <output file>
mt-eval serve --deployment deploy/<name>.json      # http://127.0.0.1:8379 by default
mt-eval run --deployment deploy/<name>.json --corpus <dev or test file>
```

- **Hinweis.** `mt-eval run` auf einer Testdatei erfordert keine Vorabregistrierung – es protokolliert
  lediglich den Lesevorgang. Bewerten Sie den Testsatz über `nmt-forge export` (oder nachdem die
  Vorhersage niedergeschrieben wurde), niemals davor.
- `--gates gates/<chain>.json` fügt eine Gate-Kette zu `run`, `translate` oder
  `serve` hinzu (ohne `--deployment`); `run` und `test` verweigern eine Kette, die auf einen Fallback
  zurückgreift. Siehe [Methoden und Gates](/docs/agents/methods) sowie
  [Bereitstellung](/docs/agents/serving).

## Abseits der Rails: Was für eine Sprache existiert

```bash
champollion network card <code>                    # the cited language card
champollion network recommend <source> <target>    # methods that can run, with their evidence
mt-eval corpora --source <source> --target <target>   # registered test sets for the pair
nmt-forge discover <code>                          # what a training project can use
```

## Dateien prüfen und aktualisieren

```bash
champollion validate        # project file, sidecars, method.json, gates/, deploy/ — 0 ok, 1 invalid, 2 usage
champollion upgrade --dry   # what upgrading older sidecars to set/1 would change; drop --dry to write
```

## Offline

`CHAMPOLLION_OFFLINE=1` verhindert, dass die CLI `champollion` auf das Netzwerk zugreift:
Sprachkarten stammen ausschließlich aus dem gebündelten Satz und dem lokalen Cache (eine
Long-Tail-Karte wird nicht abgerufen), die tägliche Aktualisierung des Karten-Caches wird übersprungen und
`register-corpus` gleicht den Hash einer Datei nicht mit dem öffentlichen Katalog ab
(der Vergleich wird als nicht durchgeführt vermerkt). Dies ändert nichts daran, was eine Methode
sendet: Eine Methode, die einen Provider aufruft, benötigt weiterhin das Netzwerk, und die
Übertragungsregeln gelten unverändert.

`MT_EVAL_NO_REMOTE_REGISTRY=1` verhindert, dass `mt-eval` seine Datensatz-Registry
aus dem Internet abruft (für einen vom Netzwerk isolierten Rechner).

Was auf den Rails ungeachtet dessen das Netzwerk benötigt: die Installation der Werkzeuge, das
Training-Extra und das erste Herunterladen eines vortrainierten Modells (`byt5-small` oder
`byt5-small-lowmem`, etwa 1,2 GB; `cpu-tiny` lädt nichts herunter).

## Umgebungsvariablen

Vom Code gelesen, für eine betreibende Person gedacht. Provider-API-Schlüssel werden nur von
Methoden benötigt, die einen Provider aufrufen, niemals auf dem Standardpfad der Rails.

| Variable | Gelesen von | Wirkung |
|---|---|---|
| `CHAMPOLLION_MCP_PROFILE` | MCP-Server | `rails` (Standard) oder `full` |
| `CHAMPOLLION_CLI_BIN` | MCP-Server | Der auszuführende Einstiegspunkt für `champollion` |
| `NMT_FORGE_BIN` | `champollion`, MCP-Server | Die ausführbare Datei von `nmt-forge` |
| `UV_TOOL_BIN_DIR` | `champollion`, MCP-Server | Wo nach `nmt-forge` und `uv` nach `PATH` gesucht werden soll (Standard: `~/.local/bin`) |
| `CHAMPOLLION_OFFLINE` | `champollion` | `1`: kein Netzwerk für Karten oder Katalogabfragen |
| `CHAMPOLLION_CARDS_CACHE_DIR` | `champollion` | Der benutzerspezifische Karten-Cache (Standard: `~/.champollion/cards`) |
| `CHAMPOLLION_CARDS_TTL_HOURS` | `champollion` | Wie oft der Karten-Cache auf Aktualisierungen geprüft wird (Standard: 24) |
| `NMT_FORGE_AUTO_PRESET` | `nmt-forge init --model auto` | Legt das Preset fest, das `auto` auswählt (muss ein Preset-Name sein) |
| `NMT_FORGE_SERVE_PORT` | `nmt-forge serve` | Standard-Port (8378 ohne Angabe) |
| `NMT_FORGE_SERVE_TOKEN` | `nmt-forge serve` | Das Bearer-Token; außerhalb von Loopback erforderlich |
| `NMT_FORGE_NO_MONITOR` | `nmt-forge run` | `1`: kein Live-Trainings-Panel |
| `MT_EVAL_SERVE_TOKEN` | `mt-eval serve` | Das Bearer-Token (niemals als Befehlszeilenwert) |
| `CHAMPOLLION_SERVE_TOKEN` | `champollion serve` | Das Bearer-Token für den eigenen Server der CLI |
| `MT_EVAL_NO_REMOTE_REGISTRY` | `mt-eval` | `1`: kein Registry-Abruf |
| `MT_EVAL_DATA_ROOT` | `mt-eval` | Wo Pfade registrierter Datensätze zuerst aufgelöst werden |
| `OPENROUTER_API_KEY` | `champollion`, `mt-eval` | Der Schlüssel des Standard-Providers für gehostete Modelle |

## Ausgabe für Programme

| Werkzeug | Maschinenausgabe | Exit-Codes |
|---|---|---|
| `champollion` | `--json` bei den Rails-Befehlen (`new`, `next`, `data add`, `data mark`, `data combine`, `improve report`, `improve status`, `connect`, `upgrade`) | 0 ok · 1 verweigert · 2 Verwendung |
| `nmt-forge` | `--json` bei jedem Unterbefehl: ein JSON-Dokument auf stdout, alles andere auf stderr | 0 ok · 2 verweigert (`{"error": …}`) |
| `mt-eval` | `--json` und `--non-interactive` bei jedem Unterbefehl | 0 ok · ungleich Null: verweigert |

Formen der Verweigerung: [das Rails-Modell](/docs/agents/rails-model#refusal-shapes).

## Weiterführende Informationen

- [Die Befehlsreferenz zu `champollion`](/docs/reference/cli),
  [`nmt-forge`](/docs/network/getting-started/forge-command-reference) und
  [`mt-eval`](/docs/reference/mt-eval).
- [Das Rails-Modell](/docs/agents/rails-model) – die Journey und `next --json`.
- [Die Rails über MCP steuern](/docs/agents/mcp) – dieselben Schritte als sechs Werkzeuge.
- [Training mit nmt-forge](/docs/agents/training) und
  [Datenregeln](/docs/agents/data-rules).
