---
title: "Die Rails über MCP steuern"
slug: /agents/mcp
description: "Verbinden Sie einen MCP-Client mit dem Rails-Profil von Champollion und durchlaufen Sie ein Sprachprojekt mit sechs Werkzeugen: Einrichtung pro Client, jedes Argument und jeder Rückgabewert, die Schleife, die Schrittmodi, Ablehnungen und die Erklärungsthemen."
---

# Die Rails über MCP steuern

Das Standardprofil des MCP-Servers sind die Rails: sechs Werkzeuge, die ein
Sprachprojekt von einem leeren Ordner bis hin zu einem evaluierten Modell auf dem
eigenen Computer der Person begleiten. Jedes Werkzeug führt das `champollion`-CLI als separaten,
abgegrenzten Prozess aus – dieselben Befehle, die eine Person eingibt. Der Server übergibt Ihrem Client
beim Verbindungsaufbau außerdem kurze Betriebsanweisungen (`instructions-rails.md`).

## Verbinden

Der Server kommuniziert über stdio per MCP und benötigt Node.js 20.11 oder neuer. Die
Konfiguration, die jeder dateibasierte Client akzeptiert:

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

| Client | Speicherort |
|---|---|
| Claude Desktop | Settings → Developer → Edit Config. Den Eintrag hinzufügen, speichern, die Anwendung neu starten |
| Claude Code | `claude mcp add champollion -- npx -y champollion-mcp-server` |
| Cursor | `mcp.json` im Ordner `.cursor` des Projekts oder in `.cursor` im Benutzerordner |

Andere Clients, die einen lokalen stdio-Server starten können, verwenden denselben Befehl; diese
Seite beschreibt nur die drei oben genannten.

**Werkzeugpfade.** Der Server findet das CLI, von dem er abhängt, selbstständig. Er sucht
`nmt-forge` in `PATH`, dann in `UV_TOOL_BIN_DIR` (Standard: `~/.local/bin`,
wo `uv tool install` es ablegt) – ein Client, der aus einer Desktop-Anwendung gestartet wird,
hat oft einen kürzeren `PATH` als ein Terminal. Überschreibungen als Umgebungsvariablen in
`env` des Server-Eintrags:

| Variable | Wirkung |
|---|---|
| `CHAMPOLLION_MCP_PROFILE` | `rails` (Standard) oder `full` |
| `CHAMPOLLION_CLI_BIN` | der `champollion`-CLI-Einstiegspunkt, der anstelle des gebündelten ausgeführt werden soll |
| `NMT_FORGE_BIN` | die ausführbare Datei von `nmt-forge` (die Journey des CLI berücksichtigt dieselbe Variable) |
| `UV_TOOL_BIN_DIR` | wo nach `nmt-forge` und `uv` nach `PATH` gesucht werden soll |

## Profile

| Profil | Auswählen mit | Was es ist |
|---|---|---|
| rails | Standard | Sechs Werkzeuge und kurze Anweisungen; ein Sprachprojekt von Anfang bis Ende |
| full | `--profile full` in `args` oder `CHAMPOLLION_MCP_PROFILE=full` | Jedes Werkzeug: Sprachkarten, Korpora, Benchmarks, die Warteschlange, Contests, Forge-Training, Veröffentlichung |

Jeder andere Wert stoppt den Server: `unknown MCP profile "<value>" (rails or
full)`. Das vollständige Set ist auf
[der Seite zum MCP-Server](/docs/network/getting-started/mcp-server) aufgeführt. Bleiben Sie für ein
Sprachprojekt beim Rails-Profil: Es ist dasjenige, dessen einzelne Schritte allesamt
aus den Dateien des Projekts gelesen werden.

## Die Schleife

1. Noch kein Projekt vorhanden → `start_project`. Dessen erster Aufruf erstellt nichts: Nennen Sie
   der Person dessen `ask_first` und führen Sie dann den Aufruf aus, den es für ihre Antwort angibt.
2. `project_status` → `step.mode`, `step.say`, `step.why` lesen.
3. Führen Sie aus, was der Modus besagt, mithilfe von `step.call` – dem genauen Aufruf, der den
   Schritt ausführt.
4. Zurück zu 2. Nach jeder Änderung, die Sie oder die Person von Hand vorgenommen haben, rufen Sie
   `project_status` erneut auf: Der nächste Schritt wird immer aus den Dateien gelesen.
5. `step: null` → Die Rails sind abgeschlossen. Teilen Sie der Person mit, was `finished` besagt.

| `step.mode` | Tun Sie dies | `step.call` |
|---|---|---|
| `auto` | Führen Sie es aus | `run_next_step` mit `project_dir`, `step_id` |
| `confirm` | Erklären Sie der Person, was es tut (Installationen, Training); fragen Sie nach Ja oder Nein; führen Sie es nur bei Ja aus. Bei „nicht jetzt“ vermerken Sie dies: Nichts wird ausgeführt | `run_next_step` mit nach dem Ja hinzugefügtem `confirmed: true`; `declined: true` bei „nicht jetzt“ |
| `ask_user` | Fragen Sie `step.question` in einfachen Worten; übergeben Sie die Antworten anhand der Schlüssel in `step.answers`. Bei „nicht jetzt“: Wenn `not-now` einer der eigenen `enum`-Werte eines Slots ist, handelt es sich um eine Antwort – übergeben Sie sie; andernfalls vermerken Sie dies: Nichts wird ausgeführt | `run_next_step` mit `answers` – jeder Slot als `<…>` geschrieben, zu ersetzen durch die Worte der Person; `declined: true` bei einem „nicht jetzt“, das keine der Antworten ist |
| `wait` | Etwas wird gerade ausgeführt | `project_status` mit `wait_seconds: 120`; wiederholen, solange der Modus `wait` bleibt |
| `use_tool` | Sie tun dies jetzt mit `step.tool`; geben Sie es nicht zurück | z. B. `add_data` mit `path: "<each file the person named, where it is>"` |
| `human_only` | Eine Person tut dies: Teilen Sie ihr `step.say` mit | keine |

`step.command` ist das, was die Rails ausführen – niemals der Name eines Werkzeugs. Ein `<…>` in einem Aufruf ist
ein Platzhalter für die Antwort oder Datei der Person; ein Platzhalter, der unverändert zurückgesendet wird, wird
abgewiesen.

## Die sechs Werkzeuge

### `start_project`

| Argument | Typ | Bedeutung |
|---|---|---|
| `folder` | Zeichenkette, erforderlich | Neuer Ordner für das Projekt, relativ zu `parent_dir` |
| `from` | Zeichenkette, erforderlich | Die Sprache, die eingegeben wird: ein Code oder ein Name |
| `to` | Zeichenkette, erforderlich | Die Sprache, die ausgegeben wird: ein Code oder ein Name |
| `target_name`, `source_name` | Zeichenkette | Der Name der Sprache, wie ihre Sprecher ihn nennen; erforderlich für einen Code zur privaten Nutzung (`qaa`–`qtz`) |
| `purpose` | Zeichenkette | Wofür die Übersetzungen gedacht sind, in den Worten der Person |
| `parent_dir` | Zeichenkette | Wo der Ordner erstellt werden soll (Standard: das Arbeitsverzeichnis des Servers) |
| `confirmed` | boolesch | `true` erst, nachdem die Person der Richtung zugestimmt hat |

Ohne `confirmed: true` führt es `champollion new --dry` aus und gibt
`made: false`, `ask_first` (ein Satz zum Vorlesen: *„Dieses Übersetzungssystem nimmt X und
gibt Y zurück – Sie geben X ein, und Y kommt heraus. Ist das die gewünschte
Richtung?“*), `if_yes` und `if_the_other_way` (jeweils ein vollständiger Aufruf) sowie
`languages` zurück – worauf jeder Name aufgelöst wurde, mit `matchedAs`, wenn das Wort
der Person ein anderer Name ist, den eine Karte verzeichnet, und `alsoNamed`, wenn dasselbe Wort
andere Sprachen bezeichnet. Geben Sie beides wieder. Mit `confirmed: true` erstellt es das Projekt
und gibt `project`, `languages` und `next` (den ersten Schritt) zurück.

Ein Name, den keine Karte enthält, und kein ähnlicher: Die Abweisung fügt
`if_it_has_no_code` hinzu, denselben Aufruf mit `to: "qaa"` und deren Namen als
`target_name`. Verwenden Sie dies nur für den Namen, den die Person angegeben hat.

### `project_status`

Argumente: `project_dir` (erforderlich); `wait_seconds` (0–120). Mit
`wait_seconds` liest es alle 5 Sekunden neu, solange der Schritt `wait` ist, und
kehrt zurück, wenn sich der Schritt ändert oder die Zeit abgelaufen ist.

Gibt `project`, `stage` (`"2/6 Gather your data"`), `step` (`id`, `mode`,
`say`, `why`, `call` sowie, sofern vorhanden, `question`, `answers`, `command`,
`tool`, `for_the_person`) zurück, und die folgenden Felder, sofern zutreffend:

| Feld | Was es ist | Was Sie tun |
|---|---|---|
| `true_now` | Die eigenen Aufzeichnungen von Forge in Sätzen: trainierte Modelle und deren bester dev-chrF++, das Urteil des Leak-Audits pro Testset, Testset-Werte, ob das Training läuft, ob ein Modell bereitgestellt wird und wo | Berichten Sie nur anhand dieser Zeilen, was getan wurde, niemals mehr |
| `waiting_for_agreement` | Dateien, deren Sprecher noch nicht zugestimmt haben (`speakers_agreed: not-yet`): jeweils mit `file`, `question`, `say` und eigenem `call` | Stellen Sie jede Frage einmal pro Sitzung, behutsam; führen Sie den Aufruf erst aus, wenn die Person sagt, dass alle zugestimmt haben |
| `files_not_added` | Dateien, die `add_data` in dieser Sitzung abgewiesen hat und die noch nicht im Projekt sind, jeweils mit ihrer Abweisung | Binden Sie jede ein (ihre Abweisung erklärt wie), oder teilen Sie der Person mit, welche ausgelassen wurde und warum |
| `model_in_use` | Sobald ein Modell bereitgestellt wird, neben den Schritten der Verbesserungsrunden: `say` (seine Testseite und wie sie verwendet wird) und `for_the_person` (der Befehl `champollion connect`, der es in deren App oder Website einbindet) | Teilen Sie es der Person einmal mit; sie führt connect aus, wenn sie es wünscht |
| `blockers`, `warnings` | Von Forge, wortwörtlich | Geben Sie sie wortwörtlich weiter |
| `finished` | Wenn kein Schritt mehr übrig ist: Was die Beteiligten jetzt tun können (das Modell auf seiner Seite ausprobieren; eine App) | Teilen Sie es der Person mit |
| `error` | Warum kein Schritt benannt werden konnte | Weitergeben |

Ein Projektordner, der nicht existiert oder kein `champollion.project.json`
enthält, wird zusammen mit den in der Nähe gefundenen Projekten abgewiesen.

### `run_next_step`

| Argument | Typ | Bedeutung |
|---|---|---|
| `project_dir` | Zeichenkette, erforderlich | Der Projektordner |
| `step_id` | Zeichenkette, erforderlich | Die soeben zurückgegebene `step.id` (oder die ID eines `waiting_for_agreement`-Eintrags) |
| `answers` | Objekt aus Zeichenketten | `ask_user`: Die Antworten der Person anhand der Schlüssel in `step.answers` |
| `confirmed` | boolesch | `confirm`: `true` erst, nachdem die Person Ja gesagt hat. Ebenso: ein Schritt, der zweimal fehlgeschlagen ist, nur wenn die Person sagt, es solle unverändert noch einmal versucht werden |
| `declined` | boolesch | `true`, wenn die Person zu einem `confirm`-Schritt oder zu einer Frage ohne eigene `not-now`-Antwort „nicht jetzt“ gesagt hat: Nichts wird ausgeführt und es wird in dieser Sitzung nicht erneut gefragt. Wenn `not-now` eine der Antworten ist, übergeben Sie es in `answers` |

Es liest den nächsten Schritt erneut, bevor es irgendetwas ausführt. **Sperren:**

- Eine abweichende ID wird abgewiesen: `the project changed since that step was named
  — call project_status again`, with `current`.
- `human_only` wird abgewiesen (`a person does this step: …`); ein `human_only`-Schritt,
  den ein Agent mit einem Werkzeug ausführt, wird zusammen mit dem zu verwendenden Werkzeug abgewiesen.
- `wait` wird abgewiesen; `confirm` ohne `confirmed: true` wird abgewiesen (`ask the
  person first, then call again with confirmed: true`).
- `ask_user`: Jede Antwort ist erforderlich (`missing the answer "<key>" — ask the
  person who holds the data; never answer for them`); a `<…>`-Platzhalter wird
  abgewiesen; eine Antwort außerhalb eines `enum` wird abgewiesen.
- Es werden nur die eigenen Programme der Rails ausgeführt: `champollion`, `nmt-forge` und `uv tool
  install … nmt-forge`. A command using `|`, `;`, `<`, `>`, `` ` ``, `$` oder ein
  einzelnes `&` wird abgewiesen; `&&` verbindet Teile, die der Reihe nach ausgeführt werden und beim ersten
  Fehlschlag stoppen.
- Jeder Teil ist auf 10 Minuten begrenzt (die Installation von `uv` auf 15).
- `declined: true` bei einem Schritt, der weder `confirm` noch `ask_user` ist, wird
  abgewiesen: `this step does not wait on the person's yes (<mode>) — there is
  nothing to decline`.
- `declined: true` bei einem Schritt, dessen `answers` `not-now` enthält (derzeit
  `try_it` des Angebots für ein stärkeres Modell), wird abgewiesen, und die Abweisung enthält
  `answers` des Schritts: `"not now" is one of this step's own answers — pass it in
  answers (try_it: "not-now"): it is recorded, and this comes back only after
  more rounds; declined would ask again next session`.

Gibt `ran` zurück – pro Teil: `command`, `exit_code`, `timed_out`, falls zutreffend, und
die letzten 40 Zeilen von `output` – sowie `next`, den nächsten Schritt im
Format von `project_status`.

#### „Nicht jetzt“

Es gibt zwei Möglichkeiten, dies zu erfassen, und der Schritt entscheidet, welche:

| Der Schritt | „Nicht jetzt“ ist | Was es erfasst | Wann es wiederkehrt |
|---|---|---|---|
| Ein `ask_user`-Schritt, dessen `answers` `not-now` enthält (das Angebot für ein stärkeres Modell: `try_it`, `yes` oder `not-now`) | Eine Antwort: `answers: {"try_it": "not-now"}` | Das Journal von Forge (`model-change`, `answer: "not-now"`); sonst ändert sich nichts | Nach zwei weiteren Runden, die das Dev-Set als **no-change** oder **worse** beurteilt hat – sitzungsübergreifend |
| Ein `confirm`-Schritt (Training, eine Installation, Inbetriebnahme eines Modells) oder eine Frage, die die Person noch nicht beantworten kann | `declined: true` | Nur im Speicher dieses Servers | Wenn der Server neu startet (in der nächsten Sitzung) |

`declined: true` führt nichts aus und gibt `declined` (die Schritt-ID), `ran: []`,
`say` (*„Es wurde nichts ausgeführt. Es wird in dieser Sitzung nicht erneut gefragt; wenn die Person es anspricht
und Ja sagt, führen Sie es dann aus.“*) und `next` zurück. Die Ablehnung bleibt für die
Lebensdauer des Servers bestehen – eine Sitzung; ein neu gestarteter Server hat sie vergessen. Solange sie
besteht, kehrt dieser Schritt von `project_status` und `run_next_step` mit
`declined_this_session` (wann, als ISO-Zeitangabe) zurück, und sein `say` beginnt mit *„Dazu
wurde ‚nicht jetzt‘ (HH:MM UTC) gesagt: …“* und endet mit *„In dieser Sitzung nicht
erneut fragen – nichts, was ein Ja erfordert, wird ausgeführt. Wenn die Person es von sich aus anspricht
und Ja sagt, führen Sie es mit confirmed: true (oder ihren Antworten) aus.“* Ein späteres
`confirmed: true` oder Antworten führt den Schritt aus und hebt die Ablehnung auf.
**Hinweis.** Fragen Sie in dieser Sitzung nicht erneut und umgehen Sie den Schritt nicht; wenn
die Person ihn selbst anspricht und Ja sagt, führen Sie ihn dann aus.

#### Wenn ein Schritt fehlschlägt

**Sperre.** Ein Schritt, der zweimal hintereinander fehlgeschlagen ist (Exit-Code ungleich null oder Timeout,
gezählt über die Lebensdauer des Servers), wird beim dritten Mal abgewiesen, es sei denn, `confirmed: true` ist gesetzt,
zusammen mit `last_output`. **Hinweis.** Dieses Flag liegt bei Ihnen: Teilen Sie der Person mit,
was ausgegeben wurde, und entweder behebt sie den Fehler (ein korrigierter Befehl, der im Terminal ausgeführt wird,
ist in Ordnung – rufen Sie danach `project_status` auf) oder sie bittet darum, es unverändert noch einmal zu versuchen.

### `add_data`

| Argument | Typ | Bedeutung |
|---|---|---|
| `project_dir` | Zeichenkette, erforderlich | Der Projektordner |
| `path` | Zeichenkette, erforderlich | Die Datei an ihrem Speicherort: absolut oder relativ zum Projektordner oder zum Startverzeichnis des Servers |
| `into` | `parallel` (Standard) · `test` · `lexicon` | Satzpaare zum Lernen; die geprüften Testsätze; eine Wortliste |
| `source_col`, `target_col` | Zeichenkette | Eine Spalte als Buchstabe (`A`), eine Zahl oder deren Kopfzeile; bei ELAN die Tier-Nummer, die die Abweisung auflistet (oder eine genaue Tier-ID, die die Person eingegeben hat); bei LIFT ein Sprachcode |
| `sheet` | Zeichenkette | Welches Tabellenblatt oder welche Tabelle, falls mehrere vorhanden sind |
| `header` | boolesch | `true`: die erste Zeile ist eine Kopfzeile; `false`: sie enthält Daten |
| `usfm_source` | Zeichenkette | Nur bei USFM-Schrifttexten: der Text der anderen Sprache (eine Datei oder ein Ordner für `.usfm`) |
| `replace` | boolesch | Eine bereits hinzugefügte Datei erneut einlesen (andere Kopfzeile oder Spalten); die Antworten ihrer Rechteinhaber bleiben erhalten |

Es führt `champollion data add` aus. Rufen Sie es zuerst nur mit dem Pfad auf: Eine Kopfzeile,
die die Sprachen des Paares nennt, bestimmt die Spalten; andernfalls fragt es nach, und Sie
fragen die Person – entscheiden Sie niemals anhand des Inhalts. Es liest Tabellendokumente
(`.xlsx`, `.ods`, `.csv`), `.tsv` und `.txt`, Tabellen in Word `.docx`, Toolbox-
und LIFT-Wörterbücher, ELAN-`.eaf`-Dateien und USFM.

Gibt `result` zurück (den Bericht des CLI: Anzahlen, Spalten, ELAN-Tiers nach Nummer und
die Zeilennummern, die die Zeilenprüfung beanstandet – Duplikate, Wiederholungen, auffällige Längen,
vertauschte oder verschobene Zeilen, nichts entfernt – niemals Sätze), `read_from`, wenn
die Datei vom Startordner des Servers aus gefunden wurde, und `also`, wenn die
Datei mehr enthält (die Beispielsätze eines Wörterbuchs als Paare oder seine Glossen als
Wortliste) – jeder Eintrag ein vollständiger `add_data`-Aufruf. Führen Sie ihn aus, es sei denn, die
Bedingungen der Person für diese Datei schließen dies aus. Leiten Sie die Zeilenprüfung unverändert weiter: Die
Person sieht sich diese Zeilen in ihrer eigenen Datei an
([Datenregeln](/docs/agents/data-rules#what-tools-print-and-never-print)).
Bitten Sie die Person niemals, eine Datei zu verschieben; `inbox/` ist nur ein Ort, an dem sie
eine ablegen kann.

### `try_translation`

Argumente: `project_dir`; `text` – bis zu 10 Zeilen, maximal 2.000 Zeichen,
ein Satz pro Zeile, Worte, die die Person Ihnen übergeben hat.

Es sucht das Modell, das dieses Projekt bereitstellt (den neuesten fehlerfreien `serve`-Job in
`nmt-forge jobs --json`), ausschließlich auf diesem Computer, und liest dessen `/health`.

- **Sperre.** Wenn `output_local_only` nicht `false` ist (true oder unknown), gibt
  es keine Übersetzung zurück: `shown_to_person_only: true`, `open` (die eigene
  Seite des Modells) und `say`. Verweisen Sie die Person dorthin; bitten Sie sie nicht darum, deren
  Übersetzungen an Sie zurückzukopieren.
- Ein Server, der ein Token verlangt, wird abgewiesen: Tokens werden niemals an einen
  Agenten übergeben.
- Andernfalls gibt es `model`, `pair`, `translations` (`source`,
  `translation` pro Zeile), `errors` (falls vorhanden) und `say` zurück: Leiten Sie diese unverändert
  weiter; der Server prüft nichts von dem, was er zurückgibt.

### `explain`

Argument: `topic`. Texte in einfacher Sprache zum Weitergeben:

| `topic` | Behandelt |
|---|---|
| `rails` | Den Projektordner und die Reihenfolge der Schritte |
| `privacy` | Was die Sidecar-Datei bedeutet; warum Sie die Dateien niemals öffnen |
| `quality` | Was ein Score verspricht und was nicht |
| `modes` | Wie jede Art von Schritt ausgeführt wird |
| `improve` | Die Runden, nachdem ein Modell im Einsatz ist: etwa jede zehnte Review-Zeile *„stammt absichtlich aus einer früheren Tabelle (in der Tabelle steht …)“*; ein besseres Modell wird zur Nutzung angeboten und die Beteiligten stimmen zu (*„ein Urteil allein ändert nichts“*); das „Zu wenige“-Urteil; das Angebot für ein stärkeres Modell nach *„zwei Runden in Folge, die das Dev-Set beurteilen konnte und die keinen Zuwachs zeigen (gezählt ab dem zuletzt in Betrieb genommenen Modell)“* |
| `off_rails` | Die Rails verlassen: Führen Sie einen Expertenbefehl aus und rufen Sie anschließend `project_status` auf |

## Hinweise für die gesamte Sitzung

- **Hinweis.** Alles, was Sie lesen, gelangt zu Ihrem Modellanbieter. `add_data`,
  `project_status` und `run_next_step` melden Zählwerte, Spalten und Status, niemals
  Sätze; belassen Sie es dabei. Öffnen Sie die Dateien nicht selbst.
- **Hinweis.** Die Antworten zu `ask_user`, `confirmed: true` und das
  Ja zu `waiting_for_agreement` stammen von der Person. Die Werkzeuge prüfen, ob eine Antwort
  vorhanden und wohlgeformt ist; nur Sie können sicherstellen, dass sie von der Person stammt.
- **Hinweis.** Geben Sie `blockers`, `warnings` und jeden Vorbehalt wortwörtlich weiter,
  sowie jede Zahl mit ihrer Einheit und dem Set, auf dem sie gemessen wurde
  ([Coaching](/docs/agents/coaching)).

## Vertiefung

- [Der Betriebsvertrag](/docs/agents/contract) – Sperren und Hinweise.
- [Das Rails-Modell](/docs/agents/rails-model) – die Journey, die Modi und die
  Schritt-IDs, die diese Werkzeuge lesen.
- [Die Rails über die Shell steuern](/docs/agents/shell) – dieselben Schritte als
  Befehle.
- [Der MCP-Server](/docs/network/getting-started/mcp-server) – beide Profile
  und der vollständige Werkzeugkatalog.
