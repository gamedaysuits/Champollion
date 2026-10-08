---
slug: /build-mt-for-your-language
title: "MT für Ihre Sprache entwickeln"
description: "Von „Wie fangen wir an?“ bis hin zu einem getesteten Übersetzungs-Workflow: Finden Sie heraus, was bereits existiert, schützen Sie Ihren Testdatensatz, evaluieren Sie die Optionen, entwickeln Sie etwas Besseres, erbringen Sie den Nachweis und stellen Sie es bereit – mit den genauen Befehlen und MCP-Tool-Aufrufen für jeden Schritt."
---

# Maschinelle Übersetzung für Ihre Sprache aufbauen

Diese Seite führt Sie von *„Wir möchten Übersetzungen für unsere Sprache – wie fangen wir an?“* zu einem Übersetzungsworkflow, den Sie **an Ihren eigenen Sätzen gemessen** und in Betrieb genommen haben. Sie richtet sich an Menschen sowie an KI-Agenten: Jeder Schritt nennt den auszuführenden Befehl und – sofern vorhanden – das [MCP-Tool](/docs/network/getting-started/mcp-server), das ein Agent stattdessen aufruft.

Zwei durchgehende Beispiele:

- **Eine Schule** benötigt Englisch → Plains Cree für ihren Newsletter und eine kleine App. Lehrkräfte haben einige hundert Sätze geprüft und möchten, dass diese privat bleiben.
- **Ein Krankenhaus** benötigt Englisch → eine Sprache, die der Index kaum abdeckt, für ein Sprachbuch am Krankenbett. Seine Testsätze enthalten klinische Formulierungen und dürfen niemals an einen externen KI-Dienst gesendet werden.

Am Ende verfügen Sie über: ein privates Testset, Bewertungen mehrerer Methoden darauf, eine bessere Methode (ein angeleitetes oder von Ihnen trainiertes Modell) und diese Methode über die CLI bereitgestellt – wobei jede Kennzahl bis zu ihrem Ursprung nachvollziehbar ist.

:::info[Was dies nicht leistet]
Nichts hier macht eine Übersetzung automatisch korrekt. Bewertungen zeigen Ihnen, welche Option *bei Ihren Sätzen weniger falsch* ist; eine Person mit muttersprachlicher Kompetenz entscheidet weiterhin, was verwendbar ist. Lesen Sie [Ehrliche Einschränkungen](/docs/network/honest-limitations), bevor Sie sich auf irgendeine Kennzahl verlassen.
:::

:::warning[Agenten: Bevor Sie Dateien des Benutzers öffnen]
Falls ein Testset privat sein könnte (von Lehrkräften geprüft, von Pflegepersonal geprüft, alles, was eine Sprachgemeinschaft nicht veröffentlicht hat), lesen Sie es nicht – kein `cat`, `head` oder Vorschau, nicht einmal um dessen Format einzusehen. Was Sie lesen, geht an Ihren Modellanbieter. Fragen Sie den Benutzer und kennzeichnen Sie es zuerst als rein lokal ([Schritt 2](#2-gather-your-data--and-protect-your-test-set)).
:::

## 0. Installieren

```bash
npm install -g champollion        # translate + deploy        (Node 20.11+)
python3 -m pip install mt-eval-harness       # measure                   (Python 3.11+)
python3 -m pip install 'nmt-forge[hf]'       # train a model (optional; a CPU is enough to start)
```

Fügen Sie für einen Agenten den MCP-Server zu dessen Konfiguration hinzu:

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

## 1. Herausfinden, was existiert

Was über die Sprache bereits bekannt ist – Wörterbücher, Grammatiken, Korpora, Analysatoren (FSTs), Modelle, veröffentlichte Ergebnisse, Dienste – und woher jede Information stammt.

```bash
champollion network card crk                 # the cited language card
champollion network recommend eng crk        # methods you can run, with the evidence for each
mt-eval corpora --source eng --target crk   # registered test sets for the pair
nmt-forge discover crk               # what a training project can use
```

**Agent:** `search_languages { "query": "Atya" }` findet den Code selbst bei einem Schreibfehler (nächstgelegene Namen nach Editierdistanz). Jedes Ergebnis zeigt nur dann an, wo die Sprache gesprochen wird, wenn deren Sprachkarte eine Quelle dafür angibt, und zeigt diese Quelle an, damit der Benutzer zwischen Sprachen mit ähnlichen Namen wählen kann. Ein Ort ohne Quellenangabe wird niemals angezeigt: Die Zeile weist darauf hin und verlinkt stattdessen den Glottolog-Eintrag der Sprache, wo die Kandidaten an der Quelle verglichen werden können. Bei einer npm-Installation wird eine Sprache außerhalb des gebündelten Kernsatzes aus den veröffentlichten Kartentabellen von champollion.dev ergänzt; diese enthalten derzeit noch keine Quellen pro Feld (sie werden mit dem nächsten Upload der Tabellen bereitgestellt), sodass die Zeile den Glottolog-Link anstelle eines Ortes enthält. Wenn keine der angezeigten Informationen die Kandidaten unterscheidet, entscheiden die Sprecher (siehe unten). Anschließend liefert `language_overview { "code": "<code>" }` eine Übersichtsseite: was existiert, welche Benchmarks und Ergebnisse vorliegen sowie nummerierte nächste Schritte. Jedes Tool, das eine Sprache akzeptiert, nimmt diese auch als `language` entgegen.

Lesen Sie die Karte so, wie sie verfasst ist: **Fehlen bedeutet unbekannt, nicht null.** Eine Karte, die kein Wörterbuch auflistet, bedeutet, dass der Index keines erfasst hat – nicht, dass keines existiert. Wo Quellen uneins sind (bei Sprecherzahlen häufig der Fall), zeigt die Karte alle an.

Falls Ihre Sprache überhaupt keine Karte hat, können Sie dennoch alles Nachfolgende ausführen; die Tools wissen lediglich weniger darüber (`nmt-forge init <code> --no-card --name <name>` startet dennoch ein Trainingsprojekt).

### Wenn die Varietät noch nicht bestätigt ist

Ein Name kann auf mehrere Sprachen zutreffen. „Ayta“ passt beispielsweise zu sechs Ayta-Sprachen der Philippinen, jede mit eigenem Code. **Fragen Sie zuerst die Sprecher.** Die Sprachgemeinschaft weiß, welche Varietät sie spricht, und ein für sie ausgewählter Code ist eine Festlegung über sie.

Wenn Sie beginnen müssen, bevor eine Antwort vorliegt, verwenden Sie einen Code für die private Nutzung: ISO 639 hält `qaa` bis `qtz` genau dafür bereit. Vergeben Sie einen Anzeigenamen, damit Prompts und Berichte die Sprache benennen:

```bash
champollion init --yes --langs qaa --name qaa="Ayta (variety not yet confirmed)"
```

was Folgendes in `champollion.config.json` schreibt:

```json
"languages": { "qaa": { "name": "Ayta (variety not yet confirmed)" } }
```

`init` weist darauf hin, dass es sich um einen Code für den privaten Gebrauch ohne Sprachkarte handelt (Sie werden nicht aufgefordert, die Schreibweise zu überprüfen).

`init`, `sync`, `verify` und `network register-corpus` akzeptieren alle einen Code für die private Nutzung. Was Sie das kostet, bis der echte Code ihn ersetzt:

- **Keine Fakten aus der Karte.** Keine Register-Voreinstellungen, Pluralregeln oder Schriftsysteme aus einer Sprachkarte. Sync verwendet allgemeine Einstellungen; überprüfen Sie die ersten Ergebnisse daher mit einer Person mit Sprachkompetenz.
- **Kein FST.** Einem Code für die private Nutzung ist kein morphologischer Analysator zugeordnet, daher wird nichts Wort für Wort geprüft.
- **Keine früheren Ergebnisse.** Veröffentlichte Benchmarks und die Warteschlange sind nach echten Codes indiziert, sodass `recommend` und `corpora` dazu nichts anzeigen können.

Sobald die Sprachgemeinschaft die Varietät bestätigt, wechseln Sie zu deren Code:

1. Ersetzen Sie in `champollion.config.json` `qaa` durch den Code (und entfernen Sie `name`, falls der Name der Karte passt).
2. Benennen Sie die Locale-Dateien um (`messages/qaa.json` → `messages/ayt.json`). Die Übersetzungen bleiben gültig: Das nächste `champollion sync` behält sie bei und übersetzt nur Neues.
3. Registrieren Sie das Testset erneut unter dem echten Paar:
   `champollion network register-corpus --pair "eng>ayt" --data <file> --role test …`.
   Der Befehl gibt das zu übergebende `--id` aus, da eine registrierte Datei ihre ID behält, sofern Sie keine neue wählen. (`--pair` akzeptiert hier und in `nmt-forge init` `eng-ayt` oder `"eng>ayt"`; setzen Sie die Form `>` in Anführungszeichen, da eine Shell ein einzelnes `>` als „in eine Datei schreiben“ interpretiert.)

## 2. Daten sammeln – und das Testset schützen

**Trennen Sie das Testset zuerst ab.** Legen Sie die Sätze beiseite, an denen Sie alles messen werden (die von Lehrkräften geprüften, die von Pflegepersonal geprüften), bevor Sie etwas trainieren oder anpassen, und trainieren Sie niemals darauf.

Ein Testset ist eine TSV-Datei: ein Satzpaar pro Zeile, Quelle, ein TAB, dann die Referenzübersetzung. Zeilen, die mit `# ` beginnen, sind Kommentare.

```text
# teacher-checked, 2026 term 1
The library opens at nine.	<the teacher's translation>
```

Entscheiden Sie dann, wie weit es übertragen werden darf:

| Sie möchten… | Tun Sie dies |
|---|---|
| Nichts verlässt diese Maschine – kein externer KI-Dienst darf diese Sätze jemals sehen | Platzieren Sie eine Marker-Datei daneben (siehe unten). Nur ein Modell auf Ihrer eigenen Maschine kann damit getestet werden. |
| Andere können sehen, dass das Testset existiert, aber niemals dessen Inhalte | `champollion network register-corpus --tier private --role test …` registriert ausschließlich Metadaten |
| Einen Wettbewerb darauf ausrichten, ausgeführt auf einer von Ihnen kontrollierten, möglicherweise isolierten (air-gapped) Maschine | `--tier sealed` zusammen mit dem [souveränen Knoten](/docs/network/sovereignty/sovereign-eval-node) |
| Es ist öffentlich und frei lizenziert | `--tier public` verweist auf dessen Speicherort; wir hosten es dennoch niemals |

Der Marker für „verlässt niemals diese Maschine“:

```bash
echo '{"transmission": "local-only"}' > data/nurse_checked_test.tsv.champollion.json
```

Wenn dieser vorhanden ist, verweigert `mt-eval run` jeden Remote-Anbieter für diese Datei und läuft ausschließlich gegen ein Modell auf Loopback. Details:
[Korpora registrieren](/docs/network/sovereignty/registering-corpora).

**Welche Lizenz-ID.** Die Registrierung fragt nach `--license`: den Bedingungen, die die Eigentümer der Daten tatsächlich gewähren, niemals nach einem Platzhalter. Fragen Sie diese und wählen Sie dann die ID, die dies ausdrückt: eine SPDX-ID, falls der Text bereits darunter veröffentlicht wird; `community-eval-grant-nc` für „nur zur Bewertung von Systemen, niemals trainieren, niemals teilen, keine bezahlte Bewertung“; `community-eval-grant` für dasselbe mit erlaubter bezahlter Bewertung; `proprietary` für alle Rechte vorbehalten; oder `LicenseRef-<name>` für eigene Bedingungen. Die letzten vier sind `LicenseRef-…`-IDs, individuelle Freigaben: Eine Remote-Evaluierung dagegen wird verweigert, bis der Verwalter die Erlaubnis hinterlegt hat. Bis zur Bestätigung durch den Verwalter erfassen Sie Ihre Wahl als vorläufig. Rein lokal bleibt lokal, unabhängig von der Lizenz: Der Marker, nicht die Lizenz, entscheidet darüber, wohin die Sätze gelangen.
[Welche Lizenz-ID für ein privates Testset](/docs/network/sovereignty/registering-corpora#which-licence-id-for-a-private-test-set).

**Agenten: Lesen Sie keine rein lokale Testdatei.** Kein `cat`, `head` oder Öffnen, um nachzusehen. Was Sie lesen, geht an Ihren Modellanbieter – also dorthin, wohin diese Sätze laut Marker keinesfalls gelangen dürfen. Das müssen Sie auch nicht: Die Tools halten deren Sätze aus ihren Ausgaben heraus (`mt-eval compare` zeigt stattdessen Eintrags-IDs und Bewertungen an), und `--show-text` ist ausschließlich für eine Person am Terminal gedacht.

**Agent:** `language_overview { "code": "<code>" }` listet die Schutzoptionen für die Sprache auf; `run_benchmark` beachtet den Marker und gibt eine Verweigerung (mit Begründung) zurück, anstatt geschützte Sätze nach außen zu senden.

### Falls Sie später ein Modell trainieren möchten: registrieren, prüfen, vorhersagen – vor jeder Bewertung

Führen Sie diese drei Schritte jetzt aus, genau in dieser Reihenfolge, bevor Schritt 3 irgendetwas am Testset misst. Forge zählt jeden Zugriff auf ein Testset, und ein Benchmark (Schritt 3) ist ein bewertender Lesezugriff: Eine danach verfasste Vorabregistrierung wird verweigert. Die Reihenfolge ist entscheidend; es später zu tun, ist nicht dasselbe.

1. **Registrieren Sie das Testset bei NMT Forge.** Dessen Leseprotokoll beginnt hier, sodass jeder spätere Lesevorgang gezählt wird (ein Bewertungsauslesen vor der Registrierung wird aufgelistet, aber nicht gezählt).
2. **Prüfen Sie Ihr Trainingskorpus daraufhin ab** (`leak-audit`). Dies liest das Testset für ein Audit, niemals für eine Bewertung, und zählt daher nicht gegen Ihre Vorhersagen. Lesen Sie dessen Urteil: Wenn die meisten Testzeilen einen Fast-Zwilling in Ihrem Korpus haben, bewertet ein auf allen Daten trainiertes Modell den Abruf von Trainingsphrasen, nicht die Übersetzung. Sie werden dann üblicherweise zwei Modelle trainieren: eines auf allen Daten und ein zwillingsfreies (`--drop-test-twins` schreibt dessen Korpus und dessen Konfiguration, `config-notwins.json`).
3. **Halten Sie Ihre Erwartungen schriftlich fest, eine Vorabregistrierung pro geplantem Modell**, benannt nach dem Modell. Anhand dieser Vorhersagen werden die Testbewertungen später beurteilt: Beim Export wird jedes Modell mit dem verglichen, das Sie mit `--prereg <id>` angeben (bei zweien auf einem Testset verweigert das System das Raten). Sie können eine Vorhersage stattdessen mit `--config-hash <hash>` an die Konfiguration ihres Modells binden, dem vollständigen Hash, den `nmt-forge preflight run --config config-notwins.json` ausgibt. Jede spätere Bearbeitung dieser Konfiguration (etwa ein Zeitbudget) ändert den Hash und hebt die Bindung auf; daher ist die Benennung der Vorabregistrierung beim Export der einfachere Weg.

```bash
nmt-forge init crk --dir school-crk
cd school-crk
nmt-forge registry add project-test ../data/test.tsv --role test
nmt-forge leak-audit ../data/corpus.tsv --clean-to corpus.clean.jsonl
nmt-forge prereg template --out predictions.json      # edit it: what you expect, and why
nmt-forge prereg new all-data --eval-set project-test --predictions predictions.json
cd ..                                                 # step 3 runs from here
```

War das Urteil SEVERE, fügen Sie das zwillingsfreie Modell und dessen eigene Vorhersagen hinzu (in `school-crk/`):

```bash
nmt-forge leak-audit ../data/corpus.tsv --clean-to corpus.notwins.jsonl --drop-test-twins
nmt-forge prereg new notwins --eval-set project-test --predictions predictions-notwins.json  # your edited copy
```

Das zwillingsfreie Korpus erhält eine eigene Datei. `corpus.clean.jsonl` bleibt das Gesamtkorpus: leak-audit weigert sich, eine Datei zu überschreiben, die von einer Konfiguration, einem Lauf oder einem Split gelesen wird oder die von einem anderen Audit geschrieben wurde (`--overwrite` ersetzt eine Datei gezielt). Dessen `--json`-Antwort listet die ersten paar Zeilennummern jeder Liste auf; die `.audit.json`-Datei neben dem bereinigten Korpus behält sie alle.

`--allow-after-reads` existiert nur für Vorhersagen, die nachweislich vor den Lesezugriffen festgehalten wurden (beispielsweise auf Papier). Dies wird protokolliert, und jeder Bericht,
export and DEPLOY.md then says the predictions came after the scores.

**Agent:** `forge_init { "code": "<code>", "dir": "<dir>" }`, dann `forge_register_eval { "name": "project-test", "path": "../data/test.tsv", "role": "test", "project_dir": "<dir>" }`, `forge_leak_audit { "corpus": "../data/corpus.tsv", "clean_to": "corpus.clean.jsonl", "project_dir": "<dir>" }` (Pfade werden aus `project_dir` gelesen, da die obigen Befehle innerhalb des Projekts ausgeführt werden; ein absoluter Pfad funktioniert überall), dann `forge_prereg_template` → `forge_prereg { id, eval_set, predictions }` gemeinsam mit dem Benutzer, eines pro Modell, jeweils nach seinem Modell benannt (`forge_export` nimmt diese ID dann als `prereg` entgegen; `config_hash` bei `forge_prereg` bindet eine Vorhersage stattdessen an ihre Konfiguration). `forge_status` nennt diesen Schritt, sobald ein Testset registriert ist. Schritt 4 trainiert im selben Projekt. `language_overview` listet diese Schritte ebenfalls in dieser Reihenfolge auf.

## 3. Die Optionen messen

Führen Sie jeden Kandidaten gegen **Ihr** Testset aus (zuerst registriert, geprüft und bei Forge vorab registriert, falls Sie später trainieren möchten – [Schritt 2](#2-gather-your-data--and-protect-your-test-set)). Das Testframework bewertet jedes Modell auf die gleiche Weise, wie MT-Evaluierungen im Fachbereich berichtet werden: Der Hauptwert ist Korpus-chrF++ mit seinem 95%-Konfidenzintervall, daneben BLEU, spBLEU und TER (niemals zu einem einzigen Wert vermischt). Exakte Übereinstimmungen und Verhaltensprüfungen (Ausgabe im falschen Schriftsystem, Halluzinationssignale) werden als Diagnosedaten berichtet, zusammen mit Kosten und Geschwindigkeit. Verfügt das Framework über einen für die Sprache hinterlegten morphologischen Analysator, ergänzt es die FST-Akzeptanz und morphologische Genauigkeit als Diagnostik; `mt-eval setup --status` listet diese Sprachen auf, und `mt-eval setup --comet` ergänzt COMET, wo anwendbar.

```bash
# a hosted model (needs OPENROUTER_API_KEY); --max-cost stops before spending more
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider openrouter --model google/gemini-3.8-flash \
  --max-cost 1 -n gemini-3.8-flash -o results

# a model on your own machine (Ollama, llama.cpp, vLLM — anything OpenAI-compatible)
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider local --base-url http://127.0.0.1:11434/v1 \
  --model llama3.1 -n local-llama -o results

mt-eval compare results/*_report.json --significance
```

`compare` gibt an, ob ein Unterschied echt oder statistisches Rauschen ist (paarweise approximative Randomisierung). Ein Unterschied innerhalb der Konfidenzintervalle ist keine Rangfolge. Das Tool schreibt `comparison-<hash>.json`, benannt nach den verglichenen Läufen, neben die Berichte, wenn sie denselben Ordner teilen, oder in einen übergeordneten Ordner `comparisons/`, wenn dies nicht der Fall ist – niemals in den Ordner eines einzelnen Laufs. Ein weiterer Vergleich überschreibt diese Datei niemals.

**Evaluierungspakete.** Einige Sprachen deklarieren zusätzliche Tools, die ihre Metriken benötigen (für Plains Cree etwa einen morphologischen Analysator). Das erste `mt-eval run` nennt Fehlendes. Ein fehlender Analysator stoppt den Lauf niemals: Die FST-Akzeptanz wird als nicht berechnet markiert, `mt-eval setup --lang crk` installiert ihn (einmal pro Maschine), und `mt-eval test <run log>` fügt die Bewertung anschließend hinzu, ohne erneut zu übersetzen.

**Agent:** `run_benchmark { "corpus": "data/test.tsv", "provider": "local",
"base_url": "http://127.0.0.1:11434/v1", "model": "llama3.1",
"target_language": "crk" }` plans first and runs only with `confirm: true`;
`get_run_status { "job_id": "<id>" }` liefert die Ergebnisse zurück. Es wird nichts veröffentlicht, es sei denn, Sie übergeben `publish: true`. Ein Code als `target_language` wird anhand seiner Sprachkarte benannt („Plains Cree“), bevor er den Prompt erreicht, und der Plan zeigt den Prompt, den das Modell erhalten wird. Eine Coaching-Datei ersetzt diesen Prompt, worauf der Plan hinweist. Wenn die Karte zwei Schriftsysteme auflistet und Sie kein `script` übergeben, liest der Plan aus, welches Schriftsystem die Referenzen verwenden (Buchstaben werden auf Ihrer Maschine gezählt, kein Satz wird offengelegt), und fragt dieses an. Seine Berichte landen neben der Testdatei in `data/results/mcp-run-<id>/`, mit dem Übersetzungscache des Testframeworks in `data/results/cache/`. `get_run_status` gibt den `mt-eval compare`-Befehl dafür aus, und für Läufe auf einer registrierten Korpus-ID listet es die Berichte nach Pfad auf. Ein `local-model`-Plan gibt zuerst an, wie viel beim Bestätigen heruntergeladen wird und wohin.

**Welcher Metrik zu vertrauen ist**, hängt von der Sprache ab:
`get_metric_reliability { "language": "<code>" }` (MCP) berichtet, ob für diese Sprache jemals eine automatische Metrik mit menschlichen Urteilen validiert wurde. Für die meisten ressourcenarmen Sprachen ist dies nicht der Fall, daher ist chrF++ die Konvention – betrachten Sie den Wert als Vergleich zwischen Methoden auf demselben Testset, nicht als Schulnote.

## 4. Etwas Besseres aufbauen

Zwei Wege. Messen Sie beide auf dieselbe Weise wie in Schritt 3.

**Ein allgemeines Modell anleiten (Coaching).** Geben Sie ihm ein Glossar und Anweisungen mit und führen Sie dann Schritt 3 mit dem Coaching erneut aus:

```bash
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider openrouter --model google/gemini-3.8-flash \
  --coaching-file coaching.json -n gemini-coached -o results
```

`--coaching-file` akzeptiert Markdown, Plain Text oder JSON; der vollständige Text der Datei dient als Anweisung für das Modell und wird genau wie geschrieben übermittelt.

Um die Terminologie zu bewerten (wird jeder gelistete Begriff wie gefordert übersetzt?), übergeben Sie jedem verglichenen Lauf dieselbe Begriffsliste mit `--glossary terms.json` (`{"blood pressure": "…"}` oder eine Liste akzeptierter Formen pro Begriff). Das Glossar wird ausschließlich für die Bewertung verwendet; es wird niemals an das Modell gesendet, sodass ein einfacher Lauf und ein angeleiteter Lauf anhand derselben Begriffe bewertet werden. Ohne `--glossary` wird stattdessen `dictionary` einer JSON-Coaching-Datei (die Form des [angeleiteten Promptings](/docs/network/tutorials/coached-llm-prompting): `grammar_rules`, `dictionary`, `style_notes`) verwendet. In diesem Fall wird der Lauf gegen sein eigenes Coaching bewertet, worauf die Ausgabe hinweist. Eine Markdown-Coaching-Datei leitet auf die gleiche Weise an, liefert jedoch kein Glossar mit.

Siehe [Angeleitetes Prompting](/docs/network/tutorials/coached-llm-prompting) und [Wörterbuch-gestütztes Prompting](/docs/network/tutorials/dictionary-augmented-llm).

**Eigenes Modell trainieren** mit NMT Forge, das die Fehler unterbindet, die Ergebnisse bei kleinen Datenmengen besser aussehen lassen, als sie sind (durchgesickerte Testsätze, fehlerhafte Splits, Auswahl des Checkpoints anhand des Testsets, Interpretation von Rauschen als Fortschritt):

```bash
cd school-crk     # after step 2: registered, screened, preregistered
nmt-forge split corpus.clean.jsonl --test 0 --dev 100 --seed 42 --out data/split --register project
nmt-forge preflight run --config config.json          # every check run makes, with fixes
nmt-forge run config.json
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg all-data --out export/
```

`preflight run` führt dieselben Prüfungen durch wie `run` vor dem Training – das Dev-Set, das Leak-Audit jeder Trainingsdatei, die Dekodierlänge –, sodass ein Lauf, der diese Prüfung besteht, nicht zu Beginn abgebrochen wird. `config.json` liest den Split aus `data/split/`; ein an anderer Stelle geschriebener Split gibt an, welche Zeilen zu ändern sind.

Trainingspaare liegen wie das Testset in einer TSV-Datei (oder JSONL mit `source` und `target`); `leak-audit` (Schritt 2) hat alle Paare entfernt, die das Testset in das Training einfließen lassen würden, und jedes einzelne begründet. Zwei Modelle? Führen Sie nach dem Split das zwillingsfreie Leak-Audit aus Schritt 2 erneut aus (bei registriertem Dev-Set werden dessen Zeilen ebenfalls aus der zwillingsfreien Datei entfernt), dann `nmt-forge run config-notwins.json` und export it to its own folder with `--prereg notwins`. `nmt-forge status` names jederzeit den nächsten Befehl. Das Standardmodell trainiert auf einer CPU in wenigen Minuten; bei 1.000–2.000 Satzpaaren ist mit einem chrF++-Wert um 5–30 zu rechnen – es lernt Phrasen und Muster Ihrer Daten, nicht die Sprache im Allgemeinen. `export` bewertet das Testset einmalig und schreibt einen mt-eval-Bericht, sodass das trainierte Modell mit allen Ergebnissen aus Schritt 3 vergleichbar ist. Vollständige Anleitung: [Trainieren Sie Ihr erstes Modell](/docs/network/getting-started/train-your-first-model).

**Agent:** `forge_status { "project_dir": "<dir>" }` zuerst und nach jedem Schritt; nach Schritt 2 mit `forge_init`, `forge_register_eval`, `forge_leak_audit` und `forge_prereg`: `forge_split { corpus, test, seed, out }`, `forge_preflight { "target": "run" }`, dann – nach `nmt-forge run` im Terminal – `forge_export { run_manifest, out, prereg }`. Rufen Sie `get_training_guardrails` einmal vor `forge_split` auf: Es listet jede Regel auf, die Forge erzwingt, sowie den Fehler, den die Regel verhindert. `register` von `forge_split` akzeptiert ein Präfix oder `true` (`project`), und `out` ist standardmäßig `data/split`. Jedes Forge-Tool nach `forge_init` übernimmt das zurückgegebene `project_dir`. `get_training_guardrails` (optional `topic`) erklärt jede Regel. Alle Argumente jedes Tools: [MCP-Server](/docs/network/getting-started/mcp-server#arguments).

## 5. Belegen – privat oder öffentlich

Ihre Bewertungen gehören Ihnen. Nichts wird veröffentlicht, sofern Sie sich nicht dafür entscheiden.

```bash
mt-eval publish results/<run-id>_report.json --dry-run   # shows exactly what would leave, and what is withheld
mt-eval publish results/<run-id>_report.json --scores-only --prod
```

Ein privates oder rein lokales Testset lädt seine Sätze niemals hoch; `--dry-run` bestätigt dies Zeile für Zeile. Damit andere sich an Ihrem Testset messen können, ohne es jemals zu sehen, richten Sie einen Wettbewerb auf einer von Ihnen kontrollierten Maschine aus: Teilnehmende übergeben ihre Methode, diese läuft auf Ihrem Knoten und nur Bewertungen werden ausgegeben. Neue Wettbewerbe verbergen alle Bewertungen bis zum Ende des Wettbewerbs, sodass niemand auf Ihr Testset hin optimieren kann.
Siehe [Einen souveränen Wettbewerb ausrichten](/docs/network/sovereignty/run-a-sovereign-contest).
Um ein von Ihnen trainiertes Modell in den Wettbewerb eines anderen einzureichen, nennt `DEPLOY.md` §6 im Export die Dateien, die den Beitrag bilden, sowie den exakten Befehl `mt-eval contest submit-model`.

**Agent:** `list_contests { "language": "<code>" }`, `get_contest { id }`; `get_results { "target_language": "<code>" }` und `get_run_card { id }` für die öffentliche Bestenliste.

## 6. Das Beste kombinieren

**Wählen Sie zuerst unter Ihren eigenen Messungen aus.** Alles, was Sie auf Ihrem Testset bewertet haben, liegt als mt-eval-Bericht vor: die Baselines und angeleiteten Läufe aus den Schritten 3 und 4 sowie der Export jedes trainierten Modells (`evaluation/runlog_report.json` in seinem export folder). A terminal run with `-o results` writes to `results/*_report.json`; ein mit dem MCP-Befehl `run_benchmark` gestarteter Lauf schreibt neben die Testdatei in `data/results/mcp-run-<id>/`). Vergleichen Sie alle auf einmal – das erste Glob-Muster für Terminal-Läufe, das zweite für Agenten-Läufe (verwenden Sie dasjenige, das zu Ihren Läufen passt; die zsh bricht bei einem Glob ab, der auf nichts zutrifft):

```bash
mt-eval compare results/*_report.json school-crk/export*/evaluation/runlog_report.json --significance
mt-eval compare data/results/mcp-run-*/*_report.json school-crk/export*/evaluation/runlog_report.json --significance
```

Ein Unterschied innerhalb der Konfidenzintervalle ist keine Rangfolge, und ein trainiertes Modell, dessen Testzeilen Fast-Zwillinge in den Trainingsdaten aufweisen, wurde anhand des Abrufs bewertet: Geben Sie dessen zwillingsfreien Wert daneben an (DEPLOY.md und `nmt-forge report` nennen diesen), zusammen mit jedem **Bewertungsvorbehalt**, den mt-eval für diesen Wert vermerkt hat. Ein Vorbehalt bezüglich *nahezu konstanter Ausgaben* (einer von wenigen Sätzen wird für viele verschiedene Testsätze ausgegeben) bedeutet, dass die Ausgaben den Eingaben nicht folgen, unabhängig vom Score; Forge gibt dies neben der Bewertung in `export`, `DEPLOY.md`, `status`, `report`, `compare` und `lint` aus. Bei mehreren exportierten Modellen listet `nmt-forge status` jedes mit seiner Bewertung, der zwillingsfreien Bewertung und Vorbehalten auf und fordert Sie auf, das bereitzustellende Modell zu wählen. Erfassen Sie die Wahl mit `nmt-forge choose <export>/model` (oder `nmt-forge serve <export>/model --choose`). Das Bereitstellen eines Modells zum Ausprobieren wird als bereitgestellt erfasst, nicht als Ihre Wahl, weshalb `status` weiter nachfragt, bis Sie eine Wahl treffen.

**Agent:** `forge_status { "project_dir": "<dir>" }` – zeigen Sie dem Benutzer im Status `choose-export` `result.advice.exports`, die Bewertung jedes Exports mit seinem `score_caveats`, und fragen Sie, welches Modell bereitgestellt werden soll; die Antwort des Benutzers wird mit `nmt-forge choose` in einem Terminal erfasst. Ein provisorisches Bereitstellen beantwortet die Frage nicht. `forge_compare { eval_set, hyps_a, hyps_b }` vergleicht zwei Forge-Modelle im A/B-Test mit dem Fast-Zwillings-Vorbehalt und den mt-eval-Bewertungsvorbehalten jedes Modells neben dem Gewinner; die Hypothesendatei jedes Modells ist der Pfad `hypotheses`, den `forge_export` zurückgibt (`<export>/evaluation/battery-hyps.jsonl`).

Blicken Sie dann über Ihre eigenen Läufe hinaus. Unterschiedliche Methoden schneiden bei verschiedenen Sprachpaaren und Textarten am besten ab. Das [Network](/docs/network/) listet existierende Methoden und Dienste sowie die Belege für jede auf – was veröffentlicht wurde, nicht was Sie gemessen haben:

```bash
champollion network recommend eng crk               # runnable methods + cited evidence for the pair
champollion network leaderboard --pair "eng>crk"     # published results for the pair
```

Eine auf der Bestenliste veröffentlichte Methode kann samt ihrer Konfiguration exakt so installiert werden, wie sie bewertet wurde: `champollion network leaderboard --install <method> --apply` fügt sie Ihrem Projekt für dieses Sprachpaar hinzu. Die CLI konfiguriert eine Methode **pro Sprachpaar**, sodass der Newsletter für Cree Ihr trainiertes Modell nutzen kann, während Französisch ein gehostetes Modell verwendet. Das Verketten von Methoden (z. B. ein Modell gefolgt von einer Prüfroutine) wird unter [Verkettete Modelle](/docs/network/tutorials/chained-models) behandelt.

## 7. Verwenden

Stellen Sie die Methode bereit, die Sie gemessen haben – keine andere.

```bash
nmt-forge serve export/model                     # your trained model on http://127.0.0.1:8378
LOCAL_API_BASE=http://127.0.0.1:8378/v1 champollion sync --method local
```

Während es läuft, zeigt `nmt-forge status` `serving` an (es prüft, ob der Server noch antwortet); nach dem Stoppen des Servers nennt es den Befehl `serve` erneut, auf demselben Port.

Oder tragen Sie für ein angeleitetes gehostetes Modell dieses für das Sprachpaar in `champollion.config.json` ein. So oder so:

```bash
champollion init --langs crk     # detects your app's locale files
champollion sync                 # translates only what changed
champollion verify               # placeholders, scripts, key parity
```

**Was Ihr eigenes Modell noch nicht kann.** Ein kleines, auf wenigen tausend Sätzen trainiertes Modell lernt deren Phrasen. Es beschädigt häufig Platzhalter (`{name}`), Pluralformen und Markup oder verwandelt eine kurze Beschriftung wie „Home“ in einen ganzen Satz. Das Quality-Gate weist solche Ausgaben zurück; Beschädigtes wird nicht geschrieben. Vergeben Sie für das Paar einen **Fallback**, und diese Zeichenketten werden innerhalb desselben Synchronisationslaufs an eine zweite Methode weitergeleitet:

```json
"pairs": {
  "en:crk": {
    "method": "api",
    "endpoint": "http://127.0.0.1:8378/translate",
    "fallback": { "method": "llm-coached", "model": "google/gemini-3.8-flash" }
  }
}
```

Falls kein Text Ihre Maschinen verlassen darf, definieren Sie als Fallback ein Modell, das Sie ebenfalls lokal ausführen: `"fallback": { "method": "local", "model": "<your local model>" }` sendet an einen OpenAI-kompatiblen Server auf dieser Maschine (Ollama, llama.cpp, vLLM) bei $0 API-Kosten. Ein gehostetes Modell bietet meist die stärkere Zweitmeinung; nutzen Sie es, wenn der Text an dessen Anbieter übermittelt werden darf.

Ihr Modell übersetzt alles, was es kann. Der Fallback erhält nur das, was das Quality-Gate abgewiesen hat, sowie ausgelassene oder beschädigte Markdown-Blöcke; dessen Ausgabe durchläuft dasselbe Quality-Gate. `sync` gibt pro Paar eine Zeile `[FALLBACK]` mit den Anzahlen aus, und `champollion verify` listet alles auf, was keine der beiden Methoden übersetzen konnte. Siehe [Fallback-Methode](/docs/getting-started/configuration#fallback).

Für eine einmalige Ausnahme können Sie genau diese Zeichenketten auf andere Weise übersetzen:

```bash
champollion sync --method llm-coached --redo keys:nav.home,greeting
```

…oder von Hand oder über eine prüfende Person mit `champollion xliff export`. Und nehmen Sie die Strings der App selbst in Ihr Testset auf: Ein Modell, das bei Sätzen von Lehrkräften gut abschneidet, kann bei „Wo tut es weh?“ dennoch falsch liegen.

**Schriftsysteme.** Wird die Sprache in mehr als einer Schrift geschrieben (Plains Cree: Standard Roman Orthography und Silbenschrift), fordert die CLI Sie vor dem Übersetzen zur Auswahl auf. Setzen Sie `"script"` für diese Sprache in der Konfiguration; die Meldung listet die Optionen auf.

Dank des Translation Memorys wird für einen unveränderten Satz nie zweimal gezahlt, und ein Modellwechsel führt nicht dazu, dass alles neu übersetzt wird. Binden Sie es mit dem [CI/CD-Leitfaden](/docs/guides/ci-cd) in Ihre CI ein. `export/model/DEPLOY.md` (aus Schritt 4) enthält die genaue Konfiguration für ein trainiertes Modell, einschließlich der `api`-Methode und Hinweisen zur sicheren Freigabe im Netzwerk.

**Agent:** `translate { texts, source_language, target_language }` leitet Zeichenketten durch dieselbe Pipeline. Fügen Sie `method: "local"` und `base_url` bzw. `method: "api"` und `endpoint` für ein selbst bereitgestelltes Modell hinzu, und `script` für eine Sprache mit mehreren Schriftsystemen.

## Entscheidungen auf dem Weg

| Entscheidung | Wählen Sie… | Wann |
|---|---|---|
| Wo das Testset verbleibt | rein lokal (local-only) | Es ist vertraulich oder Sie haben die Autoren nicht gefragt |
| | privat / versiegelt | Andere sollen wissen, dass es existiert, oder sich daran messen, ohne es einzusehen |
| Anleiten oder Trainieren | Gehostetes Modell anleiten | Sie haben ein Glossar, wenig Paralleltext und externe Dienste sind akzeptabel |
| | Mit Forge trainieren | Sie haben einige tausend Paare oder mehr, oder die Daten müssen auf Ihren Maschinen bleiben |
| Veröffentlichen | Nur Bewertungen | Standard für alles, was Sie nicht selbst verfasst haben |
| | Nichts | Immer zulässig – Messungen sind auch privat nützlich |

## Kosten

- Die Tools sind für nicht-kommerzielle Zwecke kostenlos: Schulen, öffentliche Krankenhäuser oder Kliniken, gemeinnützige Organisationen oder Forschungsprojekte sind abgedeckt (CLI, nmt-forge und der MCP-Server stehen unter PolyForm Noncommercial 1.0.0; das Evaluierungs-Framework ist Open Source unter AGPL-3.0-or-later). [Wer dies nutzen darf](/docs/getting-started/who-may-use-this).
- Ein gehostetes Modell kostet das, was sein Anbieter berechnet; `--max-cost` stoppt einen Lauf, bevor mehr ausgegeben wird, als Sie erlauben, und der Bericht weist die Kosten pro Satz aus. Ein lokales Modell kostet lediglich die Rechenzeit Ihrer Maschine.
- Das Training des Standard-Forge-Modells erfordert eine CPU und wenige Minuten; größere Voreinstellungen erfordern eine GPU.
