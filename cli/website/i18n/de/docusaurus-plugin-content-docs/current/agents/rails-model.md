---
title: "Das Schienenmodell"
slug: /agents/rails-model
description: "Wie ein Projekt auf Champollions Schienen aufgebaut ist: der Projektbaum, die sechs schemavalidierten Formate, die jedes Werkzeug liest, die eine Pipeline von der zugelassenen Eingabe zur gemessenen Ausgabe, der Weg als Daten und die Form jeder Ablehnung."
---

# Das Rails-Modell

Ein Projekt auf den Rails ist ein Ordner aus einfachen Dateien. Jedes Werkzeug – die
`champollion`-CLI, `nmt-forge`, `mt-eval` und der MCP-Server – liest dieselben
Dateien nativ, anhand derselben Schemas, mit denselben Urteilen. Der nächste
Schritt wird immer aus den Dateien gelesen, niemals gemerkt. (Zwei Dinge befinden sich
außerhalb des Projekts: Der MCP-Server zählt die Fehlschläge eines Schritts für seine eigene
Lebensdauer, und nmt-forge verwaltet eine maschinenweite Trainingswarteschlange in
`~/.nmt-forge`.) Ändern Sie eine Datei von Hand und fragen Sie dann nach dem nächsten Schritt – die Antwort
spiegelt die Änderung wider.

Diese Seite ist die Übersichtskarte. Die Betriebsregeln stehen im
[Vertrag](/docs/agents/contract); die Werkzeugaufrufe finden sich in
[MCP](/docs/agents/mcp) und in [der Shell](/docs/agents/shell).

## Die Werkzeuge

| Werkzeug | Installation | Was es auf den Rails tut |
|---|---|---|
| `champollion` | npm (Node 20.11+) | Startet Projekte, bindet Daten ein, erfasst deren Bedingungen, benennt den nächsten Schritt, führt die Verbesserungsrunden aus, verbindet ein Modell mit einer Anwendung |
| `nmt-forge` | PyPI (`uv tool install --python 3.12 nmt-forge`) | Trainiert, prüft, teilt auf, zeichnet Vorhersagen auf, bewertet Modelle auf dem Testdatensatz und exportiert sie, stellt sie bereit; führt das Hauptbuch |
| `mt-eval` | ist in `nmt-forge` enthalten (das Paket `mt-eval-harness`) | Führt eine Methode über einen Testdatensatz, eine Datei oder eine Anfrage aus; wendet Gates an; berechnet Bewertungen |
| `champollion-mcp-server` | npx | Steuert die `champollion`-CLI als begrenzte Kindprozesse; das Rails-Profil umfasst sechs Werkzeuge |

Jedes Werkzeug läuft als eigener Prozess. Der MCP-Server führt dieselben Befehle aus, die
ein Mensch eingibt (sein `run_next_step` verweigert jedes Programm außer
`champollion`, `nmt-forge` und `uv tool install … nmt-forge`).

## Der Projektbaum

`champollion new <folder> --from <language> --to <language>` schreibt:

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

Es verweigert einen Ordner, der bereits ein Projekt (Exit-Code 1) oder eine
nicht versteckte Datei (Exit-Code 1) enthält, sowie ein anderes `kind` als `language`: `task`- und
`service`-Projekte befinden sich noch nicht auf den Rails. `--dry` löst die Sprachen
auf und schreibt nichts.

Die Schritte fügen bei ihrer Ausführung den Rest hinzu:

| Pfad | Erstellt von | Enthält |
|---|---|---|
| `<file>.champollion.json` | `champollion data add`, `data mark`, `data combine`, `improve marks` | set/1 – die Bedingungen der Datei daneben |
| `data/combined-from/` | `champollion data combine` | die Originale, die von combine zusammengeführt wurden (verschoben, nie gelöscht) |
| `data/not-for-training/` | `champollion data combine` | Dateien, deren Rechteinhaber festgelegt haben, dass kein Modell daraus lernen darf |
| `.forge/` | `nmt-forge init` | die Werkstatt: `eval-registry.json`, `ledger.jsonl`, Vorregistrierungen, `runs/` |
| `config.json`, `NEXT_STEPS.md` | `nmt-forge init` | die Trainingskonfiguration (eine Modellvoreinstellung, aufgelöst in explizite Zahlen) |
| `data/clean/` | `nmt-forge leak-audit --clean-to` | die geprüften Trainingspaare |
| `data/split/` | `nmt-forge split`, `champollion improve prepare` | das Dev-Set; die Trainingsdatei jeder Runde |
| `data/dev/practice-round-<k>.tsv` | `champollion improve marks` | Sätze, die die sprechende Person für das Dev-Set verfasst hat – Rolle `dev`, nur lokal, niemals für das Training verwendet |
| `improve/time.json` | `champollion improve time` | die Zeit der sprechenden Person, in ihren eigenen Worten |
| `improve/round-<k>/` | die improve-Schritte | `wishlist.md`, `to-translate.txt`, `review.csv`, `sheet-key.json` (welche Zeilen das andere Modell entworfen hat – ein neueres, das nicht verwendet wird, oder jenes, das durch eine Hochstufung ersetzt wurde: Zeilennummern, Durchlaufnamen, die Beziehung und die Anzahl der Trainingspaare jedes Modells – und ab Runde 2 `repeat_rows`: die erneut angezeigten Zeilen, jeweils `row`, `from_round`, `from_row` und das frühere `mark`), `marks.json` (die Anzahlen, der Anteil der korrekten mit seinem Intervall, `blind` und `repeats`: `shown`, `judged`, `agreed`, `agreement`, `wrong_to_right`, `right_to_wrong`, `wrong_before`, `rounds_apart_wrong_before`), `prepared.json`, `report.json` |
| `export*/` | `nmt-forge export` | ein exportiertes Modell und seine method.json |
| `deploy/<name>.json` | `nmt-forge export` (innerhalb eines Rails-Projekts) | deployment/1 – was bereitgestellt ist |
| `gates/*.json` | Menschen | gate-chain/1 – Prüfungen zwischen der Ausgabe und dem, was ausgeliefert wird |
| `methods/<id>/method.json` | Menschen | method/1 (wird auch von `nmt-forge export` in einen Modellordner geschrieben, `mt-eval export` und `champollion serve --emit-manifest`) |

## Die Formate

Sechs Framework-Schemas befinden sich in `shared/schemas/framework/`. Jedes Dokument
nennt sein Schema in `$schema`. Unbekannte Schlüssel werden abgewiesen; ein
eigener Schlüssel gehört unter `x-`.

| Format | `$schema` | Wo | Was es ist |
|---|---|---|---|
| project/1 | `https://champollion.dev/schemas/project/1.json` | `champollion.project.json` | Nur Entscheidungen: `kind`, `name`, `pair`, `purpose`, `defaults`, `created_with` |
| set/1 | `https://champollion.dev/schemas/set/1.json` | `<file>.champollion.json` | Bedingungen einer Datendatei: `transmission`, `role`, `kind`, `pair`, `fields`, `terms`, Registrierungsfelder, `derived_from`, `holders_agreed` |
| method/1 | `https://champollion.dev/schemas/method/1.json` | `method.json` | Eine Methode: `id`, `name`, `kind` und die eine Einstellung dieser Art, `pairs`, `decode`, `card`, `evidence` |
| gate-chain/1 | `https://champollion.dev/schemas/gate-chain/1.json` | `gates/*.json` | Geordnete `metric-threshold`-Gates und ein optionales `fallback` |
| deployment/1 | `https://champollion.dev/schemas/deployment/1.json` | `deploy/*.json` | Eine Methode, ihre Gates, ein Paar; optionaler Host und Port für `serve` |
| service-api/1 | `https://champollion.dev/schemas/service-api/1.json` | der `/translate`-Vertrag | Anfrage-, Antwort-, Fehler- und `/health`-Dokumente |

`project.defaults` – was Daten erhalten, die dem Projekt hinzugefügt werden, wenn niemand
etwas anderes festlegt. `champollion new` schreibt `{"transmission": "local-only",
"training": "ask", "share_scores": "ask"}`. The values: `transmission`
`local-only` oder `ask`; `training` `allowed`, `not-allowed` oder `ask`;
`share_scores` `never` oder `ask`. `ask` sorgt dafür, dass die Werkzeuge anhalten und nachfragen – die Rails
erfinden niemals eine Antwort.

Zwei weitere Datensätze sind keine Framework-Schemas, gehören aber zum Modell:

- **Das Forge-Hauptbuch**, `.forge/ledger.jsonl`: nur erweiterbar und hash-verkettet
  (jeder Eintrag bettet den Hash des vorherigen ein; `nmt-forge ledger verify`
  schlägt bei jeder Bearbeitung fehl). Es erfasst Registrierungen, jedes Lesen
  eines registrierten Datensatzes, Vorabregistrierungen, Punktwerte, Verbräuche
  versiegelter Datensätze, Überschreibungen, Urteile der Leck-Prüfung,
  die Wörterbuch-Untergrenze, Exporte, Auswahlen, Auslieferungen, Rundenurteile
  (`improve-compare`: `better`, `worse`, `no-change` oder `too-few` unter 50
  Entwicklungssätzen), wie jede Runde trainiert (`round-plan`), die Entwürfe
  des anderen Modells für einen Prüfbogen (`draft-newer`: Durchlaufnamen, `relation`,
  die Anzahl der Trainingspaare jedes Modells und eine Anzahl an Entwürfen), das Blindurteil
  der sprechenden Person über ein neueres Modell (`improve-speaker`: Durchlaufnamen,
  vier Zählwerte, `z`, `clear`), Modelländerungen (`model-change`,
  einschließlich eines `not-now`) und was `nmt-forge tidy` entfernt hat
  (`tidy`: Durchläufe und Bytes). Zählwerte, Hashes und
  Pfade – niemals ein Satz. Es ist eine manipulationserkennende
  Buchführung, keine kryptografische Sicherheit.
- **Die Durchlaufkarte**: was `mt-eval run` für einen bewerteten Durchlauf erfasst und was ein
  veröffentlichtes Ergebnis beinhaltet. Siehe die [Durchlaufkarten-Spezifikation](/docs/network/specifications/run-card).

**Lock.** `champollion validate [folder]` prüft die Projektdatei, jedes
Sidecar, jedes `method.json` (im Wurzelverzeichnis, in `methods/*/` und
`.champollion/methods/*/`), `gates/*.json` und `deploy/*.json` anhand dieser
Schemas. Das Harness liest dieselben Dateien mit denselben Urteilen. Exit 0 = keine
Fehler, 1 = ein Dokument ist ungültig, 2 = Anwendungsfehler. Es öffnet nur diese JSON-Dateien,
niemals eine Datendatei.

`champollion upgrade [folder]` schreibt Sidecars, die vor set/1 verfasst wurden (ohne
`$schema`), in set/1 um und behält jeden Wert bei (ein Schlüssel, den set/1 nicht kennt, wandert
unter `x-<key>`). Es lässt ein ungültiges Sidecar unberührt und listet ein älteres
`method.json` auf, ohne es zu ändern: Jedes Werkzeug liest es weiterhin als method/0
mit einer Warnung.

## Die einheitliche Pipeline

Jede Art und Weise, wie eine Methode auf Text trifft, ist eine einzige Pipeline in der Evaluierungs-Engine:

1. **Zulassung.** Die Bedingungen der Eingabe werden gelesen (das set/1-Sidecar,
   ein JSON-Envelope, der Registry-Eintrag), und ihre Übertragungsrichtlinie wird aufgelöst und
   durchgesetzt, bevor irgendetwas übersetzt wird. Ein Kanal, den die Richtlinie nicht
   erlaubt, wird hier abgewiesen (siehe [Datenregeln](/docs/agents/data-rules)).
2. **Methode.** Eine Methode übersetzt (method/1-Arten: `llm`, `llm-coached`,
   `mt-api`, `local-model`, `nmt-checkpoint`, `lexicon`, `python`, `service`,
   `human`).
3. **Gates.** Wenn eine Gate-Kette benannt ist, wird jedes Segment beurteilt; das erste Gate,
   das ablehnt, entscheidet darüber, was ausgeliefert wird (`drop`, `keep-source`, `flag`,
   `fallback`). Siehe [Methoden und Gates](/docs/agents/methods).
4. **Ausgaben.** Das Ausführungsprotokoll wird geschrieben; Dateien, die aus einer gekennzeichneten Eingabe herausgeschnitten wurden, tragen
   deren Bedingungen in einem Sidecar neben sich.
5. **Metriken.** Nur wenn Referenzen vorhanden sind: Die Hauptbewertung bewertet das, was ausgeliefert wurde,
   die Bewertung ohne Gates steht daneben. Siehe [Messung](/docs/agents/measurement).

Die Modi sind dieselbe Pipeline für unterschiedliche Eingaben:

| Modus | Befehl | Eingabe | Metriken |
|---|---|---|---|
| Messen | `mt-eval run` (`mt-eval test` bewertet ein Ausführungsprotokoll erneut) | ein Test- oder Entwicklungsdatensatz | ja |
| Eine Datei übersetzen | `mt-eval translate --out <file>` | nur Ausgangstext | nein |
| Bereitstellen | `mt-eval serve` | eine Anfrage nach der anderen | nein |

**Eine Bereitstellung ist die Mess-Pipeline auf Eingaben, die nur aus Ausgangstext bestehen.** Eine
deployment/1-Datei wird getestet (`mt-eval run --deployment`), über eine Datei ausgeführt
(`mt-eval translate --deployment`) und bereitgestellt (`mt-eval serve --deployment`),
sodass genau das ausgeliefert wird, was gemessen wurde. Bei `--deployment` werden die Flags, die die Datei
festlegt (`--method`, `-m`/`--model`, `--gates`, `--target-script`), abgewiesen.
Ein Deployment nennt keinen Score: Ein gemessener Wert ist ein Durchlaufergebnis, das beim
Durchlauf aufbewahrt wird. Siehe [Bereitstellung](/docs/agents/serving).

## Der Ablauf als Daten

Die Reihenfolge der Arbeit ist eine Datei: `shared/journeys/language.json`. Der
Evaluator, `cli/lib/framework/journey.js`, ist der einzige Leser;
`champollion next`, das Rails-Profil von MCP und `NEXT.md` stellen ihm alle dieselbe
Frage. **Der erste noch nicht erledigte Schritt ist der nächste Schritt.** Er liest nur
Sidecars, die Projektdatei sowie die Registry und das Hauptbuch von forge – niemals den Text einer Datendatei –
und führt nichts aus, außer `nmt-forge --version` (begrenzt auf
30 s) für den Installationsschritt und `nmt-forge status --json` (begrenzt auf 60 s),
sobald die Arbeit das Training erreicht.

**Phasen.** `start` → `gather` → `protect` → `tools` → `build` → `improve`.

**Ein Schritt** hat ein `id`, ein `stage`, ein `mode`, einfache Worte für die Person
(`say`) und warum es wichtig ist (`why`), und meistens ein `command`. Optionale Felder:

| Feld | Bedeutung |
|---|---|
| `done_when` | Die Prüfung, die besagt, dass der Schritt abgeschlossen ist. Erforderlich (außer bei einem delegierenden Schritt) |
| `when` | Eine Prüfung, die zutreffen muss, damit der Schritt überhaupt gilt (die Wörterbuch-Untergrenze gilt nur, wenn `data/lexicon/` eine Datei enthält) |
| `question`, `answers` | Die Frage eines `ask_user`-Schritts und seine Antwortfelder: `{"enum": [...]}` oder `{"type": "string", "say": "…"}` |
| `agent`, `agent_tool` | Was ein Agent bei einem Schritt der Person selbst übernimmt (die genannten Dateien mit `add_data` einbinden) |
| `outdated` | Eine Variante, die verwendet wird, wenn die Prüfung feststellt, dass das Werkzeug zu alt ist |
| `delegate` | `"nmt-forge"`: Übergabe an den eigenen Berater von forge |

`{placeholders}` in `say`, `question` und `command` werden aus der Projektdatei
und den gefundenen Dateien ausgefüllt.

**Prüfungen** sind eine geschlossene Menge; der Evaluator bricht bei einer unbekannten Prüfung mit einem Fehler ab:
`project_valid`, `data_files`, `every_data_file_has_terms`,
`protected_test_set`, `tool_on_path` (mit `min_version`), `path_exists`,
`forge_test_registered`, `single_file`, `forge_role_registered`,
`forge_ledger_event`, `screened_rows`, `lines_in_file`, `review_marked`,
`improve_prepared`, `forge_trained_on_current`.

**Modi:**

| Modus | Wer handelt | Was die Rails erlauben |
|---|---|---|
| `auto` | der Agent | den Befehl ausführen |
| `confirm` | der Agent, nach Zustimmung | Installationen, Training, alles, was verbraucht oder veröffentlicht; nur ausführen, nachdem die Person zugestimmt hat |
| `ask_user` | die Person antwortet | `question` fragen; Antworten über die Schlüssel in `answers` übergeben; niemals für die Person antworten |
| `wait` | niemand | etwas läuft gerade; später erneut nachfragen |
| `human_only` | eine Person | Sätze sammeln, Entwürfe markieren, auswählen |
| `use_tool` | der Agent, mit eigenem Werkzeug | nur MCP: Ein `human_only`-Schritt mit einem `agent`-Feld wird als `use_tool` mit `step.tool` angezeigt |

**Delegation.** Beim Schritt `forge` fragt der Ablauf `nmt-forge status
--json` ab und übernimmt den Status von forge als Schritt. Die Statuswerte von forge werden auf Modi abgebildet:
`training` → `wait`; `ready-to-train` und `needs-training-extra` → `confirm`;
`missing-preregistration` → `ask_user`; `choose-export` → `human_only`;
`improve-compare` → `auto`; `improve-promote` → `confirm`;
`improve-stronger-model` → `ask_user`. Jeder andere Status ist `auto`, wenn forge
einen Befehl nennt, und `human_only`, wenn dies nicht der Fall ist. Ein Status `serving` beendet die
Build-Phase, und die Verbesserungsphase beginnt.

Zwei Arten von Schritten stammen von außerhalb der Schrittliste:

- **Beurteilung der Vorhersage.** Nach einem Export, der auf dem Testdatensatz bewertet wurde, wartet
  eine Vorhersage, die die Personen in ihren eigenen Worten verfasst haben, auf ihr Urteil: ein
  `ask_user`-Schritt mit `answers` `verdict` (`held` oder `missed`) und `by` (wer
  darüber geurteilt hat), was `nmt-forge prereg verdict` ausführt.
- **Warten auf Zustimmung.** Jede Datei, deren Sidecar `speakers_agreed:
  not-yet` becomes its own `ask_user` question in `waiting` enthält, wird über ihre
  eigene Schritt-ID beantwortet, sobald die Person die Antwort hat. Sie hält niemals den Rest
  der Rails auf.

**Die Schritt-ID** ist `<journey step id>:<8 hex characters>` – ein Hash des Schritts
und seines ausgefüllten Befehls. Wenn sich das Projekt ändert, ändert sich die ID, und ein
`run_next_step` mit der alten ID wird abgewiesen (`the project changed since that
step was named`).

**Was `champollion next --json` zurückgibt:** `project`, `kind`, `stage` (`n`,
`of`, `id`, `title`), `done` (Schritt-IDs), `step` (`id`, `mode`, `say`, `why`
und, falls vorhanden, `command`, `question`, `answers`, `agent`, `agent_tool`,
`file`, `source`), `now` (die Fakten von forge – was aktuell zutrifft), `waiting`,
`forge` (`state`, `blockers`, `warnings`), `finished` (wenn kein Schritt mehr übrig ist)
und `error`. Exit-Code 1, wenn ein Fehler vorliegt und kein Schritt existiert.

## Formen der Verweigerung

Jede Verweigerung gibt an, was passiert ist, und die meisten nennen den Grund und die Lösung.

| Werkzeug | Ausgabe für Menschen | Ausgabe für Maschinen | Exit-Code |
|---|---|---|---|
| `nmt-forge` | `[guard] message`, dann `  why: …` und `  fix: …` | `--json`: `{"error": {"type", "guard", "message", "why", "fix", "how_to_get", "text"}}` auf stdout | 2 verweigert |
| `champollion` | `[ERR] message` auf stderr | `--json`, wo der Befehl dies unterstützt | 1 verweigert, 2 Bedienfehler |
| MCP-Rails-Werkzeuge | — | `{"refused": "<reason>", …}` mit `isError: true`, plus die Wiederholung, sofern vorhanden (`if_it_has_no_code`, `current`, `last_output`, `question`, `answers`) | — |

`type` im Fehler von Forge ist die Ausnahmeklasse (`UsageError` für ungültige
Argumente – Forge verweigert abgekürzte Flags, anstatt zu raten). Zu den Guard-Namen
von Forge gehören `split-guard`, `dev-fence`, `leak-audit`, `preregister`,
`eval-ledger`, `ci-scoring`, `registry`, `improve-loop` und `disk-room` (ein
Trainingsdurchlauf, den die Festplatte nicht fassen kann). Wenn ein Fehler
einen Satz aus einem zurückgehaltenen Korpus zitieren würde, lautet der Satz
`[sentence withheld]` und das Objekt fügt `text_withheld` hinzu.

Geben Sie eine Verweigerung in einfachen Worten wieder und folgen Sie dem Lösungsvorschlag, oder fragen Sie erneut nach dem nächsten Schritt. Ein Schritt, der zweimal fehlgeschlagen ist, wird erst wieder ausgeführt, wenn die Person dies entscheidet
([MCP](/docs/agents/mcp#when-a-step-fails)).

## Weiterführende Informationen

- [Der Betriebsvertrag](/docs/agents/contract) – die Regeln, Sperren und Hinweise.
- [Die Rails über MCP steuern](/docs/agents/mcp) und [über die Shell](/docs/agents/shell).
- [Daten- und Übertragungsregeln](/docs/agents/data-rules) – set/1 in voller Länge.
- [Methoden und Gates](/docs/agents/methods) und [Bereitstellung](/docs/agents/serving) – method/1, gate-chain/1, deployment/1, service-api/1.
- [Die Run-Card-Spezifikation](/docs/network/specifications/run-card) und die
  [Harness-Spezifikation](/docs/network/specifications/harness).
- [`mt-eval`-Befehlsreferenz](/docs/reference/mt-eval) und die
  [`nmt-forge`-Befehlsreferenz](/docs/network/getting-started/forge-command-reference).
