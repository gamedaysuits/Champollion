---
sidebar_position: 2
title: "Ein Modell ehrlich trainieren (nmt-forge)"
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
    note: "The whole journey; training is its step 4"
  - label: "MT Training in Plain Language"
    to: /docs/network/context/mt-training-concepts
    kind: doc
    note: "Zero-background glossary — read this if the vocabulary is new"
  - label: "So You Want to Train Your Own Model"
    to: /docs/network/tutorials/train-your-own-model
    kind: tutorial
    note: "The hands-on, agent-forward walkthrough"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Where an honestly-trained model goes next"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
    note: "The math behind the error bars forge insists on"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "Metric Reliability Specification"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Know which metric to believe before you select checkpoints on it"
---

# Ein Modell ehrlich trainieren (nmt-forge)

**Die 30-Sekunden-Zusammenfassung:** Die meisten „Verbesserungen“ bei Low-Resource-MÜ halten einer Überprüfung nicht stand – der Testsatz sickerte in die Trainingsdaten ein, der Testsatz bestimmte den Checkpoint, oder der Zugewinn war bloßes Rauschen ohne Fehlerbalken. **nmt-forge** ist eine Trainings-Suite, die solche Fehler strukturell erschwert: Ihre Standardpfade tun das Richtige, und fehlerhafte Pfade verweigern die Ausführung mit einer Meldung, die angibt, *was* passiert ist, *warum* es die Ergebnisse verfälscht, und wie die genaue *Lösung* aussieht. Es trainiert; das [Evaluierungs-Harness](/docs/network/specifications/harness) bewertet. Jeder Schutzmechanismus darin mechanisiert die Abwehr eines Fehlers, den wir bei der Entwicklung der Übersetzung für Plains Cree tatsächlich gemacht, gemessen und dokumentiert haben. Die Installation erfolgt über `python3 -m pip install 'nmt-forge[hf]'`, und das Standardmodell trainiert auf einer Laptop-CPU.

```bash
$ nmt-forge score --eval-set textbook-test --hyps decoded.txt

[preregister] no preregistration for eval set 'textbook-test' at its current content hash
  why: results looked at without written-down expectations become
       post-hoc stories; ...
  fix: write one FIRST: ... — then score
```

Das ist die gesamte Persönlichkeit der Suite in einer einzigen Verweigerung.

## Die Fünf-Minuten-Geschichte

Hier ist das Versagen, aus dem die Suite entstanden ist. Ein Cree-Lehrbuch bildet viele
englische Übungen auf ein Ziel ab: *„Feed him“* und *„Feed her“* werden beide zu
`asam` übersetzt. Eine standardmäßige zufällige Aufteilung platzierte eine Kopie im
Training und ihr Gegenstück im Testset — sodass das Modell buchstäblich 17 von 54
„Test“-Antworten gesehen hatte, und diese Zeilen erzielten 83 chrF++ gegenüber 44 bei
sauberen. Alles Nachgelagerte (das „Champion“-Modell, die darauf aufbauenden
Erkenntnisse) musste verworfen werden.

Der Splitter von nmt-forge macht das **konstruktionsbedingt** unmöglich: Paare, die
eine Quelle *oder* ein Ziel teilen, werden gruppiert, ganze Gruppen landen auf einer
Seite, und nach jeder Zerlegung läuft eine Überprüfung auf Nullüberlappung:

```bash
$ nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
      --out data/split --register textbook
split corpus.jsonl: 1240 rows in 1187 share-groups (largest 4)
  train 1048 · dev 42 · test 150  → data/split/
  verified: 0 shared canonical source/target keys across sides
```

(Wenn Ihr Testsatz bereits eine separate, registrierte Datei ist – ein von Lehrkräften geprüfter Datensatz, den Sie privat halten –, trennt `--test 0` nur Trainings- und Dev-Daten ab.)

Jeder weitere Schutzmechanismus folgt demselben Muster – ein realer Fehler, der systematisch eliminiert wurde. Zusammen bilden sie die **Trainings-Leitplanken**: Lesen Sie diese, bevor Sie Daten aufteilen (`nmt-forge init` und `nmt-forge status` verweisen bei diesem Schritt hierher; Agenten erhalten dieselben Regeln samt dem gemessenen Fehler dahinter über das MCP-Tool `get_training_guardrails`).

| Schutzmechanismus | Der Fehler, der eliminiert wird |
|---|---|
| **split-guard** | Testantworten verbergen sich im Training durch geteilte Ausgangs-/Zieltexte |
| **dev-fence** | Der Testsatz wählt Ihren Checkpoint aus (das Training verweigert den Start ohne einen registrierten Dev-Satz) |
| **leak-audit** | Training auf Evaluierungstexten – ein identischer Prompt (selbst mit abweichender Übersetzung), eine identische oder nahezu duplizierte Antwort oder die gesamte Datei. Es gibt zudem an, was es absichtlich *behält* und warum: Vorlagengeschwister, die lediglich ein Wort austauschen (*„Ich sehe den Hund“* / *„Ich sehe die Katze“*), sind Übung, nicht die Lösung, und werden gemeldet, nicht entfernt – es sei denn, jede Testzeile besitzt ein solches Pendant; in diesem Fall entfernt `--clean-to … --drop-test-twins` die Trainings-Zwillinge eines festen Testsatzes. Deterministisch: gleicher Korpus, gleiches Ergebnis |
| **funnel-audit** | Stiller Datenverlust in der Pipeline (ein einzelnes Orthographie-Zeichen löschte einst wochenlang unbemerkt 1.375 Wörterbuch-Verben) |
| **convention-lint** | Training mit gemischten Rechtschreibkonventionen (das Modell vermischt diese anschließend mitten im Satz) |
| **coverage-map** | Eine Million synthetische Paare ohne Imperative, ohne Fragen, ohne Besitzanzeigen – schiere Menge verdeckt strukturelle Lücken |
| **sample-strata** | Zwei Vorlagenarten beanspruchen die Hälfte des Trainingssignals für sich |
| **ci-scoring** | Scores ohne Fehlerbalken (jeder Wert wird mit seinem 95%-Bootstrap-KI dargestellt – es gibt keine Ausgabe reiner Scores ohne Konfidenzintervall) |
| **schedule-sanity** | Early Stopping bricht einen synthetiklastigen Durchlauf nach einer halben Epoche ab: Bei 97 % synthetischen Daten und einem ehrlichen, *echten* Dev-Satz erreicht der Dev-Loss früh einen Tiefststand und steigt danach an – das Modell passt sich der synthetischen Masse an, statt zu konvergieren. Die Abbruchgrenze wird automatisch aus Ihrer Mischung abgeleitet, und jeder Eingriff erklärt sich anhand des Dev-Loss-Verlaufs. Dieser Fall wurde *durch* ein sauberes Protokoll aufgedeckt – ehrliche Setups bringen echte Fehler ans Licht |
| **eval-ledger** | Unsichtbare adaptive Nutzung von Evaluierungsdaten (jeder Lesevorgang wird protokolliert; versiegelte Datensätze sind einmalig nutzbar) |
| **preregister** | Als Vorhersagen getarnte Postdiktionen (keine Vorabregistrierung → kein Test-Score, keine Vergleichstabelle; ein einziges Vorhersageformat, ein JSON-Array – `nmt-forge prereg template` erstellt eine Vorlage zum Bearbeiten) |
| **score caveats** | Zitieren eines Scores, den das Evaluierungs-Harness einschränkt – eine *nahezu konstante Ausgabe* (einer von wenigen Sätzen wird auf viele verschiedene Eingaben ausgegeben: Die Ausgaben folgen nicht den Eingaben), Ausgaben, die viel länger oder kürzer als die Referenzen sind, Kopien der Quelle. forge berechnet nichts davon selbst; es gibt jeden Vorbehalt, den das Harness formuliert hat, im Wortlaut des Harness neben dem Score weiter – in der Export-Zusammenfassung, `forge-model.json`, `DEPLOY.md`, `status`, `report`, `compare` und `lint` – und stellt niemals einen eingeschränkten Score als „den zu zitierenden Wert“ ohne den zugehörigen Vorbehalt dar |

## Jede Sprache, jede Ressource — beginnen Sie mit der Karte

nmt-forge ist ein Werkzeug für alle rund 8.700 Sprachen im Index von Champollion. Zu Beginn prüft es im Index, was für eine Sprache tatsächlich vorhanden ist:

```bash
$ nmt-forge discover nav        # Navajo — a sparse card
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  note: no analyzer on the card → synthesis is off the menu until one
  exists; every guard and the training loop work regardless
```

Die `?`-Markierungen zeigen, dass das Werkzeug ehrlich ist: Abwesenheit auf einer
Karte bedeutet **unbekannt**, niemals „diese Sprache hat nichts“. Jede Sprache
erklimmt dieselbe **Ressourcenleiter** — (1) allein Paralleltext ermöglicht bereits
die vollständige geschützte Trainingsschleife; (2) einsprachiger Text fügt
Rückübersetzung hinzu; (3) ein Wörterbuch plus eine veröffentlichte Grammatik macht
ein zitiertes Vorlagenpaket lohnenswert; (4) ein morphologischer Analyzer schaltet
verifizierte Synthese frei; (5) ein LYSS-Schiedsrichter bringt die sprachureigene
Metrik in die Bewertung und Checkpoint-Auswahl. Eine reichhaltige Karte
(Plains Cree) verdrahtet die Stufen 4–5 automatisch — Eval-Sets treffen mit dem
Flag `NEVER TRAIN ON THIS` ein, und die Plugin-Bahnen des Schiedsrichters kommen einfügefertig.

`nmt-forge init <code>` erstellt anschließend ein Projektgerüst anhand der Karte: einen Arbeitsbereich, eine Startkonfiguration und ein `NEXT_STEPS.md`-Briefing, das für Sie *und Ihren Agenten* mit der exakten Befehlsreihenfolge verfasst ist. Dies funktioniert ausgehend von einem einfachen `pip install` – Karten werden aus einem von Ihnen angegebenen Verzeichnis, einem lokalen Checkout oder dem öffentlichen Kartenindex (für die Offline-Nutzung zwischengespeichert) gelesen – und auch eine Sprache, für die es noch keine Karte gibt, erhält ein Projekt (`--no-card --name "<name>"`), wobei jeder Kartenfakt als unbekannt statt erfunden erfasst wird.

## Vom Laptop zum bereitgestellten Modell

Der ehrliche Zyklus benötigt keine GPU. `init` schreibt eines von drei Modell-Presets als explizite Zahlenwerte in die Konfiguration:

| Preset | Voraussetzungen | Was zu erwarten ist |
|---|---|---|
| `cpu-tiny` (Standard) – ein kleiner, von Grund auf trainierter Transformer, dessen Vokabular ausschließlich aus Ihren Trainingszeilen gelernt wird | eine Laptop-CPU, kein Download | konstruktionsbedingt schwach: bei 1.000–2.000 Paaren chrF++ etwa 5–30 – Phrasen und Muster Ihrer Daten, keine allgemeine Übersetzung |
| `cpu-finetune --base <hf-id>` – ein kleines vortrainiertes Marian-/opus-mt-Modell Ihrer Wahl für ein verwandtes Sprachpaar | eine CPU, ca. 300 MB Download | meist besser als `cpu-tiny`, sofern ein verwandtes Paar existiert – messen Sie es nach |
| `nllb-600m` – NLLB-200 distilled 600M mit LoRA | eine GPU | der stärkste Ausgangspunkt |

`cpu-tiny` existiert, um den *gesamten* Zyklus vom ersten Tag an Realität werden zu lassen – die Begrenzung (Fence), die Audits, den vorab registrierten Test und ein Modell, das die CLI aufrufen kann –, damit ein besseres Modell später nahtlos in dasselbe Projekt eingefügt und auf dieselbe Weise gemessen wird. Nach dem Training schließen zwei Befehle den Vorgang ab:

```bash
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg <id> --out export/
nmt-forge serve export/model     # http://127.0.0.1:8378
```

`export` bewertet den Testsatz einmalig (Vorabregistrierung erforderlich, 95%-Konfidenzintervalle; `--prereg <id>` benennt die für dieses Modell mit `nmt-forge prereg new <id>` erstellte Vorabregistrierung – bei zwei Modellen auf einem Testsatz, die jeweils nach ihrer eigenen bewertet werden, verweigert der Export das Raten), schreibt das Ergebnis als mt-eval-Bericht, den `mt-eval compare` liest, und schnürt ein in sich geschlossenes Modellpaket mit einem champollion-Plugin-Manifest und einer `DEPLOY.md`. `serve` beherrscht den champollion-api-method-Vertrag sowie einen OpenAI-kompatiblen Endpunkt, sodass `champollion sync --method local` damit übersetzen kann; es lauscht standardmäßig nur auf localhost, sofern Sie ihm kein Token zuweisen. Jeder Befehl akzeptiert `--json` für Agenten (ein einzelnes JSON-Dokument auf stdout; Ablehnungen als `{"error": {…, "why", "fix"}}`, Exit-Code 2). Die vollständige Anleitung finden Sie unter [Ihr erstes Modell trainieren](/docs/network/getting-started/train-your-first-model); sobald Sie ein testwürdiges Ergebnis haben, wird es über [Eine Methode einreichen](/docs/network/getting-started/submit-a-method) zu einem Network-Eintrag.

## Synthetische Daten, die Sie verteidigen können

Für Sprachen mit morphologischen Analyzern (FSTs) fertigt forge Trainingsdaten
durch **Sprachpakete** — und erzwingt ein *Emissionsgesetz*, aus dem kein Paket
aussteigen kann: Jedes generierte Wort muss durch den Analyzer hin- und zurücklaufen
(generieren → analysieren → dieselbe Analyse), jede Vorlage zitiert die
veröffentlichte Grammatik, die sie transkribiert, jeder Plausibilitätsfilter wird
benannt und gezählt, und jede Zeile wird mit `synthetic: true` gestempelt. Dieser Stempel
ist tragend: Die Registry **verweigert synthetische Zeilen in Testsets**. Tests
enthalten ausschließlich echte Daten.

forge selbst liefert keine Sprachpakete aus — es ist ein Allzweckwerkzeug. Pakete
leben bei ihren Sprachen und werden über Modulpfad oder Einstiegspunkt eingebunden
(das Plains-Cree-Paket lebt im crk-translate-Projekt):

```bash
nmt-forge synth nmt_forge_crk.pack:get_pack --out data/synth.jsonl
```

Analyzer und Wörterbücher bleiben separate, vom Nutzer beschaffte Werkzeuge unter
ihren eigenen Lizenzen — niemals gebündelt, niemals weiterverteilt.

## Der eigene Schiedsrichter Ihrer Sprache, in der Schleife

LYSS-Bewertungsstandards (sprachspezifische Linter, die etwa wissen, dass sich zwei
Cree-Schreibweisen nur durch eine dokumentierte Langvokal-Konvention unterscheiden)
werden in jede Bewertungsfläche eingebunden — und in die Checkpoint-Auswahl, sodass
das Modell, das gewinnt, dasjenige ist, das *der Schiedsrichter der Sprache*
bevorzugt, nicht nur chrF++:

```bash
nmt-forge score --eval-set textbook-test --hyps decoded.txt \
    --plugin champollion_lyss.crk.metrics:CrkLinterMetric

  chrf++                            46.02  [43.11, 48.87] 95% CI
  crk_linter:equivalent_match_rate   0.31  [ 0.24,  0.38] 95% CI
```

Jede Plugin-Zahl erhält ein Konfidenzintervall; ein Schiedsrichter, dessen
Voraussetzungen fehlen, meldet *nicht verfügbar* statt einer erfundenen Bewertung.

Dasselbe gilt für den **vollständigen Harness-Metrik-Stack** — nmt-forge spricht
alles, was das [Eval-Harness](/docs/network/specifications/harness) spricht,
einschließlich der neuronalen Metriken (COMET, COMET-QE, MetricX), wobei die
Inferenz einmal ausgeführt und Konfidenzintervalle aus zwischengespeicherten
Bewertungen pro Eintrag gebootstrappt werden. Bevor Sie Checkpoints anhand einer
automatischen Metrik auswählen, zeigt `discover` die [gemessene
Zuverlässigkeit](/docs/network/specifications/metric-reliability) jeder Metrik für
Ihre Sprachfamilie — für Inuktitut folgt BLEU dem menschlichen Urteil kaum
(r=0,16), während COMET dies tut (r=0,86); für die meisten ressourcenarmen Familien
lautet die ehrliche Antwort *ungemessen*. Das Werkzeug sagt Ihnen, welcher Zahl Sie
glauben sollen, bevor Sie darauf hin optimieren.

## Wo Sie tiefer einsteigen können

- **Neu beim Fachvokabular?** [MÜ-Training in einfacher Sprache](/docs/network/context/mt-training-concepts) definiert jeden Begriff – Trainings- vs. Evaluierungsdaten, Loss vs. Decoding, Leakage, chrF++, Backtranslation, das Plateau – anhand eines durchgearbeiteten Beispiels, verfasst für Einsteiger ohne Vorkenntnisse.
- **Bereit zum Entwickeln?** [Sie möchten Ihr eigenes Modell trainieren](/docs/network/tutorials/train-your-own-model) ist die schrittweise, agentenorientierte Anleitung: Sprache wählen → Daten sammeln → synthetisieren → aufteilen → trainieren → evaluieren → iterieren → bereitstellen und einreichen, wobei jede Leitplanke beim Abfangen ihres Fehlers gezeigt wird. [MÜ für Ihre Sprache entwickeln](/docs/build-mt-for-your-language) stellt das Training in den Kontext des gesamten Prozesses – bestehende Ressourcen finden, Optionen messen, bereitstellen.
- **Trainieren, dann einreichen:** Ein ehrlich trainiertes Modell wird über [Eine Methode einreichen](/docs/network/getting-started/submit-a-method) zu einem Network-Eintrag.
- **Die Fehlerbalken:** [Statistische Signifikanztests](/docs/network/specifications/significance) beschreibt die Mathematik, die forge standardmäßig anwendet.
- **Welcher Metrik vertraut werden kann:** Prüfen Sie [Zuverlässigkeit von Metriken](/docs/network/specifications/metric-reliability), bevor Sie Checkpoints anhand einer automatischen Metrik auswählen.
- **Jeder Befehl und jedes Flag:** die [forge-Befehlsreferenz](/docs/network/getting-started/forge-command-reference), direkt aus dem Werkzeug generiert.
- **Die Fehlertaxonomie** – jeder Fehler, ein konkretes Beispiel und der Schutzmechanismus, der ihn abfängt – ist im Quellcode von nmt-forge enthalten. Agenten erhalten denselben Regelsatz über das Tool `get_training_guardrails` des MCP-Servers (optional `topic`), und jede Verweigerung liefert ihre eigene Erklärung (Was/Warum/Lösung).
