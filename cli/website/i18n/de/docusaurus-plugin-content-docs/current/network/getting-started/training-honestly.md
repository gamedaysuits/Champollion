---
sidebar_position: 2
title: "Ein Modell ehrlich trainieren (nmt-forge)"
related:
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

**Die 30-Sekunden-Version:** Die meisten „Verbesserungen“ bei ressourcenarmer MT
scheitern bei erneuter Prüfung — das Testset ist ins Training gesickert, das Testset
hat den Checkpoint ausgewählt, oder der Zugewinn war Rauschen ohne Fehlerbalken.
**nmt-forge** ist eine Trainings-Suite, die solche Fehler strukturell erschwert:
Ihre normalen Pfade tun das Richtige, und die falschen Pfade verweigern sich mit
einer Meldung, die sagt, *was* passiert ist, *warum* es Ergebnisse verfälscht, und
die genaue *Behebung*. Sie trainiert; das [Eval-Harness](/docs/network/specifications/harness)
bewertet. Jeder Schutzmechanismus darin mechanisiert einen Fehler, den wir beim
Aufbau der Plains-Cree-Übersetzung tatsächlich gemacht, gemessen und dokumentiert haben.

```bash
$ nmt-forge score --eval-set textbook-test --hyps decoded.txt

[preregister] no preregistration for eval set 'textbook-test'
  why: results looked at without written-down expectations become
       post-hoc stories
  fix: write one FIRST: nmt-forge prereg new ... — then score
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
{"verified": "0 shared canonical source/target keys across sides", ...}
```

Jeder andere Schutzmechanismus hat dieselbe Form — ein echter Fehler, wegmechanisiert:

| Schutzmechanismus | der Fehler, den er ausschaltet |
|---|---|
| **split-guard** | Testantworten, die sich über geteilte Quellen/Ziele im Training verstecken |
| **dev-fence** | das Testset, das Ihren Checkpoint auswählt (das Training verweigert den Start ohne ein registriertes Dev-Set) |
| **leak-audit** | Training auf Eval-Text — exakt, umformuliert (Jaccard) oder die gesamte Datei |
| **funnel-audit** | stiller Pipeline-Schwund (ein Orthographiezeichen löschte einmal 1.375 Wörterbuchverben, unsichtbar, wochenlang) |
| **convention-lint** | Training auf gemischten Schreibkonventionen (das Modell mischt sie dann mitten im Satz) |
| **coverage-map** | eine Million synthetischer Paare ohne Imperative, ohne Fragen, ohne Besitz — Volumen, das strukturelle Lücken verbirgt |
| **sample-strata** | zwei Vorlagentypen, die die Hälfte des Trainingssignals für sich beanspruchen |
| **ci-scoring** | Bewertungen ohne Fehlerbalken (jede Zahl wird mit ihrem 95%-Bootstrap-KI dargestellt — es gibt keine Ausgabe nackter Bewertungen) |
| **schedule-sanity** | frühes Stoppen, das einen synthetiklastigen Lauf bei einer halben Epoche abbricht: Bei 97 % synthetischen Daten und einem ehrlichen *echten* Dev-Set erreicht der Dev-Loss früh seinen Tiefpunkt und driftet nach oben — das ist das Modell, das die synthetische Masse anpasst, keine Konvergenz. Die Stoppschwelle wird automatisch aus Ihrer Mischung abgeleitet, und jeder Eingriff erklärt sich selbst anhand der Dev-Loss-Trajektorie. Dieser Fall wurde *durch* ein sauberes Protokoll gefunden — ehrliche Aufbauten bringen echte Fehler ans Licht |
| **eval-ledger** | unsichtbare adaptive Nutzung von Eval-Daten (jeder Lesevorgang wird protokolliert; versiegelte Sets sind einmalig) |
| **preregister** | Postdiktionen, als Vorhersagen verkleidet (keine Vorabregistrierung → keine Vergleichstabelle) |

## Jede Sprache, jede Ressource — beginnen Sie mit der Karte

nmt-forge ist ein einziges Werkzeug für alle ~8.700 Sprachen in Champollions Index, und
es beginnt damit, den Index abzufragen, worüber eine Sprache tatsächlich verfügt:

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

`nmt-forge init <code>` gerüstet dann ein Projekt aus der Karte: einen Arbeitsbereich,
eine Startkonfiguration und ein `NEXT_STEPS.md`-Briefing, das für Sie *und Ihren
Agenten* geschrieben ist — endend bei [Eine Methode
einreichen](/docs/network/getting-started/submit-a-method), sobald Sie
etwas Testenswertes haben.

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

- **Neu beim Vokabular?** [MT-Training in einfacher
  Sprache](/docs/network/context/mt-training-concepts) definiert jeden Begriff —
  Trainings- vs. Eval-Daten, Loss vs. Decoding, Leakage, chrF++, Rückübersetzung,
  das Plateau — mit einem durchgearbeiteten Beispiel, geschrieben für null Vorwissen.
- **Bereit zum Bauen?** [Sie wollen also Ihr eigenes Modell
  trainieren](/docs/network/tutorials/train-your-own-model) ist die
  schrittweise, agentenorientierte Anleitung: Sprache wählen → Daten sammeln →
  synthetisieren → aufteilen → trainieren → evaluieren → iterieren → einreichen,
  wobei jede Schutzvorrichtung gezeigt wird, wie sie ihren Fehler abfängt.
- **Trainieren, dann einreichen:** Ein ehrlich trainiertes Modell wird über
  [Eine Methode einreichen](/docs/network/getting-started/submit-a-method) zu
  einem Netzwerkeintrag.
- **Die Fehlerbalken:** [Statistische
  Signifikanzprüfung](/docs/network/specifications/significance) ist die Mathematik,
  die forge standardmäßig anwendet.
- **Welcher Metrik zu vertrauen ist:** Prüfen Sie
  [Metrik-Zuverlässigkeit](/docs/network/specifications/metric-reliability), bevor
  Sie Checkpoints anhand einer automatischen Metrik auswählen.
- **Das vollständige Design** — die gemessene Hintergrundgeschichte jedes
  Schutzmechanismus, die Paketschnittstelle, die Voreinstellungen der
  Trainingsschleife — lebt beim Code im Repository (`forge/DESIGN.md`).
