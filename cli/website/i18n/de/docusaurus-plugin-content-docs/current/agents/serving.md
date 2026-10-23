---
title: "Auslieferung und Bereitstellung"
slug: /agents/serving
description: "Bringen Sie ein gemessenes Modell zum Einsatz: die deployment/1-Datei, die nmt-forge export schreibt, mt-eval translate und serve, nmt-forge serve und seine Seite zum Ausprobieren, der service-api/1-/translate-Vertrag, champollion connect und durch einen Agenten gesteuertes champollion sync – samt dem, was rein lokale Ausgaben tun dürfen und was nicht."
---

# Bereitstellung und Deployment

**Ein Deployment ist die Mess-Pipeline auf reinen Quelltexteingaben.** Eine
deployment/1-Datei benennt die Methode, ihr Modell, ihre Gates und das Sprachpaar.
Dieselbe Datei wird anhand eines Testsets geprüft, auf eine Datei angewendet und bereitgestellt, sodass genau das ausgeliefert wird, was gemessen wurde. Diese Seite bildet das Agenten-Gegenstück zu
[In die Praxis umsetzen](/docs/put-it-to-work).

Durchgehend gilt: Ein Modell, das anhand von Sätzen trainiert wurde, die als „local-only“ markiert sind, kann diese wiederholen, weshalb **seine Ausgabe ebenfalls „local-only“ ist**. Jedes unten aufgeführte Werkzeug behält diese Ausgabe auf diesem Computer, es sei denn, die Rechteinhaber der Daten haben etwas anderem zugestimmt, und
`--holders-agreed-by` zeichnet auf, wer zugestimmt hat. **Hinweis:** Übergeben Sie dieses Flag nur mit
dem Namen, den die Person Ihnen genannt hat, nachdem sie bestätigt hat, dass die Rechteinhaber zugestimmt haben.

## deployment/1

`$schema` `https://champollion.dev/schemas/deployment/1.json`. Erforderlich: `id`,
`pair` (`source`, `target`, optional `target_script`), `method` (`method`,
optional `model`). Optional: `gates` (eine gate-chain/1-Datei) und `serve`
(`host`, Standardwert `127.0.0.1`; `port`). Pfade sind relativ zum Projektstammverzeichnis angegeben,
in dem die Rails-Befehle ausgeführt werden. Es nennt keinen Score.

**Wer es schreibt.** `nmt-forge export` schreibt, wenn sich der Export innerhalb eines Rails-Projekts
befindet (ein `champollion.project.json` darüber),
`deploy/<name>.json` – `<name>` ist `--name` in Kebab-Case, andernfalls
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

Es schreibt keines (und meldet `no deployment file: …`), wenn sich der Export außerhalb
eines Rails-Projekts befindet, wenn das Modell unter einem Decode-Hook ausgewählt wurde (nur
`nmt-forge serve` führt die Hooks von Forge aus), wenn die Konfiguration kein Sprachpaar benennt, wenn das
Dokument nicht validieren würde oder wenn `deploy/<name>.json` bereits
ein anderes Modell einsetzt (wird niemals ersetzt).

**Wer es liest.**

```bash
mt-eval run --deployment deploy/<name>.json --corpus <test set>          # measure exactly what it serves
mt-eval translate --deployment deploy/<name>.json --source-file <input> --out <output>
mt-eval serve --deployment deploy/<name>.json
```

**Sperren.** Mit `--deployment` weisen `run` und `translate` die Optionen `--method`,
`-m`/`--model`, `--gates` und `--target-script` ab (*„--deployment … gibt die
Methode, ihr Modell, ihre Gates und das Zielskript an; entfernen Sie … (oder ändern Sie die
Datei)“*); `serve` weist außerdem `--pair` ab. Eine Eingabe in einem anderen Sprachpaar wird abgewiesen
(`deployment <id> translates from <src>; this input is in <x>`). Ein
Deployment, dessen Gate-Kette ein Fallback nutzt, kann übersetzt und bereitgestellt werden, jedoch nicht
gemessen werden: `mt-eval run` weist eine Kette ab, die auf ein Fallback zurückgreift
([Methoden und Gates](/docs/agents/methods#gate-chains)).

## Was ein Export enthält

`nmt-forge export <run-manifest.json> --prereg <id> --out <dir>` schreibt:

| Pfad | Bedeutung |
|---|---|
| `<dir>/model/` | Der bereitzustellende Ordner: Gewichte und Tokenizer, `forge-model.json` (woran trainiert wurde, `trained_on.terms`), `DEPLOY.md` |
| `<dir>/model/champollion-plugin/method.json` | method/1, Art `nmt-checkpoint`, `service.endpoint` `http://127.0.0.1:<port>/translate` (Port 8378, sofern nicht `--port`), `card.commercial_ready: false`, `evidence` mit dem chrF++ des Testsets, seinem Intervall und n |
| `<dir>/evaluation/` | Die Testset-Nachweise. Niemals zusammen mit dem Modell kopieren |
| `<dir>/input-words.json` | Die Wörter der Eingangsseite der Trainingssätze, jedes genau einmal, sortiert (`words`, `english`, `sentences`, `from` und `notes`, das eine Trainingsdatei benennt, die nicht so gelesen werden konnte, wie der Lauf sie gelesen hat). Neben `model/`, niemals darin: Es sind Wörter aus den Daten der Gemeinschaft. Wird geschrieben, wenn der Export das Modell enthält und dessen Trainingsdateien sich auf diesem Computer befinden; andernfalls meldet die Zusammenfassung des Exports `input_words.written: false` mit `why`. `nmt-forge serve` liest dies, um die Wörter zu benennen, die das Modell nie gesehen hat ([unten](#words-the-model-never-saw)) |
| `<dir>/README.md` | Was der Export darstellt |

## `mt-eval translate`

Die Pipeline über eine Datei, ohne Bewertung. `--out` akzeptiert `.jsonl` (eine Zeile pro
Segment: `id`, `source`, `output`, `error` und mit Gates `gates`,
`shipped_from`, `fallback`) oder `.tsv` (Quelle, Tabulator, Ausgabe). Ohne `--out`
schreibt es `<run id>.translations.jsonl` in den Ausgabeordner (`-o`). Die
Ausgabe enthält die Bedingungen der Eingabe – und die des Modells – in einer set/1-Sidecar-Datei.

**Sperre.** Wenn die Ausgabe der Methode „local-only“ ist (oder die des Fallbacks
ihrer Gate-Kette), wird ein Zielort außerhalb des Projekts abgewiesen, bevor überhaupt etwas
übersetzt wird: *„Verweigere das Schreiben nach …: Was diese Methode ausgibt, ist local-only
(…), und das liegt außerhalb von … – einem Ort, den die Rechteinhaber der Daten nicht gewählt haben. Nur
sie können dem zustimmen – fragen Sie sie; wenn sie zustimmen: --holders-agreed-by "<who
agreed>" (in der Sidecar-Datei erfasst; bleibt als local-only markiert). Oder
schreiben Sie es innerhalb des Projekts“*. Liegt die Zustimmung vor, zeichnet die Sidecar-Datei
`holders_agreed: {by, date}` auf; die Datei bleibt für jedes Werkzeug als „local-only“ gekennzeichnet.

`--json` gibt `translated`, `errors`, `out`, `run_id`, `marked`,
`holders_agreed` und `output_gates` aus. Exit-Code 1, wenn jede Zeile fehlgeschlagen ist. `--publish`
wird abgewiesen: Es gibt keinen Score.

## `mt-eval serve`

| | |
|---|---|
| Standardadresse | `127.0.0.1:8379` (`--host`, `--port` oder der `serve`-Block des Deployments) |
| Was bereitgestellt wird | Nur eine Methode, die in diesem Prozess läuft: `lexicon`, `local-model` oder ein Plugin, dessen method.json `dependency_class` `S` oder `O` deklariert. Ein LLM oder eine gehostete Engine wird abgewiesen |
| Token | `MT_EVAL_SERVE_TOKEN`, ausschließlich aus der Umgebung. Erforderlich, um auf einer anderen Adresse als `127.0.0.1`, `::1` oder `localhost` zu lauschen; wenn gesetzt, bei jedem `POST` erforderlich (auch auf Loopback). `GET /health` benötigt es nie |
| Grenzwerte | 1.000.000-Byte-Body, 500 Schlüssel, 20.000 Zeichen pro Zeichenkette – eine Überschreitung führt zu `413` |
| Gates | `--gates <chain>` (oder `gates` des Deployments). Das Plugin jedes Gates muss ohne Referenzen bewerten, andernfalls startet es nicht. Ein Fallback ist hier zulässig und muss in diesem Prozess laufen |

**Sperre – außerhalb von Loopback.** Ohne Token: *„Lauschen auf … ohne
Token wird verweigert – jeder, der den Port erreichen kann, könnte die Methode nutzen“*. Bei „local-only“-Ausgabe
und fehlender Zustimmung: *„Bereitstellung auf … wird verweigert: Was diese Methode schreibt, ist
local-only (…), und über eine Adresse, die andere Rechner erreichen können, gelangt es von diesem Rechner
fort. Nur die Rechteinhaber der Daten können dem zustimmen – fragen Sie sie; wenn sie zustimmen:
--holders-agreed-by "<who agreed>" (auf /health gemeldet) oder behalten Sie --host
127.0.0.1 bei“*. Die Ausgabe ist „local-only“, wenn eine Wörterbuch-Sidecar-Datei dies besagt (oder
nicht gelesen werden kann) oder das `forge-model.json` eines Modellordners „local-only“-Trainingsbedingungen
verzeichnet oder gar keine verzeichnet; bei einem Plugin oder einem Modellordner ohne `forge-model.json` wird sie
als nicht bekannt (`null`) gemeldet.

`/health` antwortet mit `status`, `method`, `model`, `pair`, `deployment` (`id`,
`sha256`), `runs` (in diesem Prozess – es wird nichts irgendwohin gesendet), `scored`
(nichts), `output_gates` und `gates` (Ketten-ID, Fingerprint, Gates, Fallback),
`output_local_only`, `output_local_only_why`, `holders_agreed_by`, `license`
(`AGPL-3.0-or-later`), `source` (das Repository) und `version`.

Mit Gates wird ein abgewiesenes Segment so zurückgegeben, wie sein Gate es vorgibt: `drop` – der Schlüssel
unter `errors`; `keep-source` – die Quelle; `flag` – die Ausgabe, der in
`meta.gates.flagged` genannte Schlüssel; `fallback` – die Übersetzung des Fallbacks, sofern die
Gates sie akzeptieren. Ohne Gates wird nichts von dem geprüft, was zurückgegeben wird.

## `nmt-forge serve`

```bash
nmt-forge serve <export>/model --detach        # a supervised background job
nmt-forge serve <export>/model --choose        # also record it as the people's choice
nmt-forge jobs                                 # list jobs
nmt-forge jobs stop <name> --wait 120
```

| | |
|---|---|
| Standardadresse | `127.0.0.1`, Port `NMT_FORGE_SERVE_PORT` oder 8378 |
| Token | `--token` oder `NMT_FORGE_SERVE_TOKEN`; außerhalb von Loopback erforderlich. `--detach` übernimmt es ausschließlich aus der Umgebung |
| Routen | `GET /` – eine Ausprobierseite für den Menschen (kein Token; fordert eines an, wenn eines gesetzt ist); `GET /health`; `POST /translate` (service-api/1); `POST /v1/chat/completions` (OpenAI-kompatibel); `GET /v1/models` |
| `--detach` | Kehrt zurück, sobald `/health` antwortet; wird gestoppt, wenn dies nicht innerhalb von 120 s geschieht. Wird abgewiesen, wenn der Port bereits antwortet |
| `--no-hook` | Bereitstellung ohne den Decode-Hook des Laufs (angezeigt auf `/health` und in `meta`) |
| `--allow-locale` | Auch diese Locale-Codes akzeptieren (wiederholbar) |
| `--device` | `auto` (Standard) oder `cpu`. Mit `auto` nutzt ein Server, der gestartet wird, während ein Trainingsauftrag desselben Projekts läuft, die CPU, anstatt die GPU zu teilen, und `/health` meldet dies (`device_note`) |
| Grenzwerte | 1.000.000-Byte-Body, 500 Schlüssel, 20.000 Zeichen pro Zeichenkette, 5.000 Modell-Arbeitsschritte pro Anfrage – eine Überschreitung führt zu `413`. Das Modell wird mit jeweils 32 Schritten gleichzeitig angefragt, sodass ein Satz aus einer anderen Anfrage auf einen Block wartet, niemals auf eine gesamte Anfrage. Eine Anfrage, die nach 600 s noch läuft, wird vollständig abgewiesen – `503`, *„senden Sie weniger Teile auf einmal“* – und niemals nur teilweise beantwortet |
| Dekodierung | Beam-Search mit dem `num_beams` des Exports, wenn der Export `beams_applied` verzeichnet (so wie das Modell gemessen wurde); Greedy für einen älteren Export. Gesendeter Text wird wie die Trainingsdaten nach NFC normalisiert |

**Sperre.** Außerhalb von Loopback wird ein Modell, dessen Ausgabe „local-only“ ist – trainiert an
„local-only“-Sätzen oder ohne Aufzeichnung darüber, woran es trainiert wurde –, ohne
`--holders-agreed-by` abgewiesen. `/health` meldet `pair`, `accepts`,
`decode_hook`, `run`, die Entwicklungs- und Testberichte, `score_caveats`, `caveats`,
`trained_on`, `output_local_only`, `holders_agreed_by`, `device_note`,
`limits` (`pieces_per_request`, `pieces_per_turn`, `request_seconds`),
`unseen_words_check`, `text_pipeline` und `output_gates`. Jede `/translate`-Antwort eines
„local-only“-Modells enthält `meta.output_local_only: true`, und jede
`/v1/chat/completions`-Antwort enthält `meta.output_local_only` (true oder false).
Wenn die Längenbegrenzungen in einer Anfrage etwas abschneiden, zählt deren `meta.cut` die
bereits beim Eingang gekürzten Sätze (`inputs`) und die Übersetzungen, die an der
Obergrenze stoppten (`outputs`) ([Training](/docs/agents/training#the-guarded-loop)).

**Hinweis.** Die Ausprobierseite ist für den Menschen gedacht. `try_translation` (MCP) verweist
bei einem „local-only“-Modell dorthin; rufen Sie `/translate` niemals selbst auf, um dessen
Ausgabe zu lesen ([Vertrag](/docs/agents/contract) §1).

### Wörter, die das Modell nie gesehen hat

Ein Satz, der ein Wort enthält, das das Modell im Training nie gesehen hat, ist sehr wahrscheinlich
falsch übersetzt, ganz gleich, wie flüssig er sich liest. Bei der erfundenen Testsprache wurde ein
zurückgehaltener Satz mit einem Inhaltswort, das das Modell nicht gesehen hatte, in 0 von 358 Fällen
richtig übersetzt (ByT5-small bei 1.600, 6.400 und 25.600 Trainingspaaren)
und fiel in 32 %, 55 % und 83 % der Fälle mit trügerischer Sicherheit falsch aus – flüssig,
jedes Wort eine reale Form, die Bedeutung jedoch falsch: Je besser das Modell, desto
überzeugender die Mutmaßung. Daher benennt der Server diese Wörter.

- **`/health`** gibt an, ob dies möglich ist: `unseen_words_check` ist `{on: true,
  words_seen: <count of words in input-words.json>, notes}` or `{on: false,
  why}`.
- **`/translate`** fügt, ausschließlich wenn eine Anfrage solche Wörter enthält,
  `meta.unseen_words` (Schlüssel → die Wörter des Textes dieses Schlüssels, die das Modell nie
  gesehen hat, jeweils einmal, in Reihenfolge) und `meta.unseen_note` hinzu. **`/v1/chat/completions`**
  fügt dasselbe hinzu, aufgeschlüsselt nach der Anfrage: `SEG_<id>` pro Segment im Blockmodus,
  `page` für eine Seite, die eigenen Schlüssel des JSON-Objekts oder `text`.
- **Keine Aufzeichnung, auf jeder Antwort angegeben.** Der Server liest `input-words.json`
  aus dem Ordner über dem Modellordner, den er bereitstellt. Wenn dort keine vorhanden ist – ein
  export made before 2026-10-13, one made without its training files on this
  Computer oder ein aus seinem Export wegkopierter Modellordner –, gibt `meta.unseen_check` jeder Antwort
  an, dass nicht geprüft werden kann und warum. Nutzen Sie für die Bereitstellung des Modells dessen
  export, or export it again.
- **Die Ausprobierseite** markiert die Zeile: *„Im Training nie gesehen: … – diese Zeile ist
  sehr wahrscheinlich falsch, wie flüssig sie sich auch liest.“*

Ein Wort ist eine Folge von Buchstaben in beliebiger Schrift (Apostrophe im Wortinneren bleiben erhalten),
in Kleinbuchstaben, in NFC. Wenn die Eingangsseite Englisch ist, zählt eine einfache englische Endung
in beiden Richtungen als gesehen (`walk` gesehen → `walked` zählt; `walked`
gesehen → `walk` zählt).

## service-api/1 – der `/translate`-Vertrag

`$schema` `https://champollion.dev/schemas/service-api/1.json`, gebunden an
`shared/test-fixtures/framework/service-api-vectors.json` (ausgeführt gegen
`mt-eval serve` und `nmt-forge serve`).

- **Anfrage** `POST /translate`: `keys` (Schlüssel → Quell-Zeichenkette; erforderlich),
  optional `source_locale`, `target_locale`, `method`, `text_format`
  (`"markdown"` für Dokumententext), `instructions` (Schlüssel → Notiz; wird nur an einen
  Server gesendet, der deklariert, diese zu berücksichtigen, `accepts_instructions`). Ein Feld, das ein Server
  nicht verwendet, wird ignoriert, niemals abgewiesen.
- **Antwort:** `200` `{translations, meta}` – `meta` ist erforderlich; `207` ergänzt
  `errors` (Schlüssel → `{message}`). Fehler sind `{error: {message}}`: `400` eine
  Anfrage, die er nicht annehmen kann, `401` ein fehlendes oder falsches Token, `404` eine unbekannte
  Route, `413` zu groß, `500` die Methode ist fehlgeschlagen – niemals eine unvollständige Antwort.
  (`nmt-forge serve` antwortet bei einer Anfrage, die das Limit von 600 s überschreitet, ebenfalls mit `503`.)
- **`meta`:** `method`, `model`, `output_gates`, `output_local_only`
  (true, false oder null), `cost_usd`; Server dürfen Felder hinzufügen.
- **`GET /health`** erfordert `status` (`ok`), `pair`, `output_gates` und
  `output_local_only`; optional `output_local_only_why`, `holders_agreed_by`,
  `model`, `method`.
- **Die Regel:** Ein Server, dessen `/health` `output_local_only: true` angibt, setzt
  `output_local_only: true` in das `meta` jeder Antwort, und ein Client schreibt
  solche Ausgaben nur dorthin, wo die Rechteinhaber der Daten zugestimmt haben.

## `champollion connect`

```bash
champollion connect <export>/model --app <app folder>
champollion connect <export>/model --app <app folder> --holders-agreed-by "<who agreed>"
```

Es findet die `method.json` (die benannte Datei oder `method.json`,
`champollion-plugin/method.json`, `model/champollion-plugin/method.json` im
Ordner), installiert sie im `.champollion/methods/` der App und verweist
mit jedem ihrer Sprachpaare (`<inputLocale>:<target>`) als `methodPlugin` darauf, wobei
der Rest des Sprachpaars erhalten bleibt. Der App-Ordner benötigt `champollion.config.json`, und die
Methode muss aus der `inputLocale` der App übersetzen.

**Sperre.** Ein Modell, dessen Ausgabe „local-only“ ist – bekannt aus seinem
`forge-model.json` (ein fehlendes zählt ebenso) oder aus dem `/health` seines Dienstes –,
wird ohne `--holders-agreed-by` abgewiesen: Was es in die Locale-Dateien
der App schreibt, wird mit der App veröffentlicht. Liegt dieses vor, verzeichnet jedes Sprachpaar
`holdersAgreed: {by, date, method, what}`. Es warnt, ohne abzubrechen, wenn
am Endpunkt nichts antwortet (`nmt-forge serve <dir> --detach` startet ihn)
oder wenn `/health` service-api/1 nicht befolgt. `--json` gibt `method`,
`kind`, `pairs`, `endpoint`, `answering`, `health_problems`,
`holders_agreed_by` aus.

## `champollion sync`, gesteuert durch einen Agenten

`sync` übersetzt die Locale-Dateien einer App oder Website mit den Methoden, die ihre
`champollion.config.json` benennt. Es stellt keine interaktiven Rückfragen.

```bash
champollion sync --dry-run --json      # what would be sent, and its estimated cost
champollion sync --max-cost 2 --json   # stop before any call if the estimate is over $2, or unknown
champollion verify                     # placeholders, scripts, key parity
```

**Die `--json`-Ausgabe** ist ein JSON-Objekt pro Zeile. Auf stdout: `{level: "info" |
"ok", message}`, events `{level: "event", event: "cost" | "file" | "verify" |
"request", …}`, and last `{level: "summary", command: "sync", …}` mit
`dryRun`, `totalProcessed`, `totalFailed`, `totalHeld`, `tmHits`,
`sentToModel`, `verify` (`ran`, `errors`, `warnings`), `failedPairs`,
`locales`, `costEstimate` und mehr; ein Probelauf ergänzt `preflight`, `realRun`
(`exitCode`, `wouldStop`, `reasons`) und `maxCost`. Auf stderr: `{level: "warn"
| "error", message}`. A hard error prints a summary with `ok: false` und
`error`.

| Exit-Code | Bedeutung |
|---|---|
| 0 | Fehlerfrei |
| 1 | Ein `--redo`- oder `--force-keys`-Name stimmte mit keinem Schlüssel überein; Fehlschläge, bei denen nichts verarbeitet wurde; ein Fehler |
| 2 | `--max-cost` hat den Vorgang vor jedem Aufruf gestoppt (oder die Schätzung war unbekannt); oder unvollständig: Etwas ist fehlgeschlagen, Schlüssel wurden zurückgehalten, Pluralformen fehlen oder die Überprüfung hat Fehler gefunden |

Ein Probelauf sendet und schreibt nichts, führt keine Überprüfung durch und beendet mit Exit-Code 0, es sei denn, ein
benannter Schlüssel stimmte mit nichts überein oder es trat ein Fehler auf. Die Überprüfung läuft nach einem echten Sync,
sofern nicht `--no-verify` angegeben ist.

**Sperre – „local-only“-Antworten.** Bei einer `api`-Methode wird ein Batch, dessen
`meta.output_local_only` `true` ist, nicht geschrieben, es sei denn, das `holdersAgreed`
des Sprachpaars nennt diese Methode; `sync` meldet dies einmalig und nennt den Aufruf
`champollion connect … --holders-agreed-by`. Diese Schlüssel bleiben
unübersetzt (oder gehen an das Fallback des Sprachpaars).

**Sperre – die `local`-Methode.** Die `local`-Methode (ein OpenAI-kompatibler
Endpunkt) fragt einmalig das `/health` des Servers ab. Wenn dieses
`output_local_only: true` meldet – wie es `nmt-forge serve` für ein Modell tut, das an
„local-only“-Sätzen trainiert wurde –, wird nichts von diesem Server geschrieben, es sei denn, das
`holdersAgreed` des Sprachpaars nennt `local`: *„Das Modell unter … meldet, dass seine Ausgaben
local-only sind … es wurde nichts davon geschrieben“*, gefolgt vom Aufruf
von `champollion connect <the model> --holders-agreed-by "<who agreed>"`. Ein
Server, dessen `/health` nicht antwortet oder nicht `true` meldet (beispielsweise ein Ollama- oder
LM-Studio-Server), wird wie zuvor verwendet.

**Hinweis.** Binden Sie ein Forge-Modell mit `champollion connect` an (die `api`-Route):
Dies liest die eigene Aufzeichnung des Modells darüber, woran es trainiert wurde, und erfasst
die Zustimmung der Rechteinhaber für das Sprachpaar unter der von ihm installierten Methode.

**Wörter, die das Modell nie gesehen hat.** Wenn ein Forge-Server Schlüssel in
`meta.unseen_words` benennt, warnen die Methoden `local` und `api` mit den Schlüsseln –
niemals mit dem Text oder den Wörtern: *„<API batch N | Local method>: <n> Schlüssel enthalten
Wörter, die das Modell im Training nie gesehen hat – sehr wahrscheinlich falsch übersetzt, wie
flüssig auch immer; lassen Sie sie von einer sprechenden Person prüfen: <up to 20 keys>“* (dann *„und <n> weitere“*).
Die Übersetzungen werden dennoch geschrieben; die Warnung informiert die Gemeinschaft darüber, welche
zu überprüfen sind ([Coaching](/docs/agents/coaching)).

**Hinweis.** Geben Sie jede `warn`-Zeile weiter. Maschinell übersetzte Zeichenketten sind Entwürfe,
bis eine sprechende Person sie überprüft; bezeichnen Sie sie niemals als korrekt.

## `champollion serve`

Ein anderer Server: Er stellt den eigens konfigurierten Übersetzungs-Stack eines **App-Projekts**
(Methode, Coaching, Translation Memory, Quality Gate) für
andere Projekte bereit. Standardmäßig `127.0.0.1`, Port 1822. Er erfordert ein Bearer-Token
selbst auf Loopback (`--token` oder `CHAMPOLLION_SERVE_TOKEN`, mindestens 12
Zeichen), außer bei `--no-auth`, was nur bei einer Loopback-Bindung akzeptiert wird.
`--emit-manifest` schreibt ein method/1-Manifest der Art `service` für Consumer.
Sein `/health` ist `{ok, service, version}`, nicht das Health-Dokument von service-api/1,
weshalb `champollion connect` Statusprobleme dafür meldet.

## Weiterführende Informationen

- [In die Praxis umsetzen](/docs/put-it-to-work) – die Version für die Gemeinschaft.
- [Methoden und Gates](/docs/agents/methods) – method/1 und gate-chain/1.
- [Daten- und Übertragungsregeln](/docs/agents/data-rules) – local-only und
  `holders_agreed`.
- [Das Rails-Modell](/docs/agents/rails-model) – die eine Pipeline.
- [`mt-eval`-Referenz](/docs/reference/mt-eval) und
  [`nmt-forge`-Referenz](/docs/network/getting-started/forge-command-reference).
- Übersetzung von Apps und Websites: [CI/CD](/docs/guides/ci-cd),
  [Fehlerbehebung](/docs/guides/troubleshooting).
