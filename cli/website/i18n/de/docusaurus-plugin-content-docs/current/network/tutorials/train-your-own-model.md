---
sidebar_position: 0
title: "Sie möchten also Ihr eigenes Modell trainieren"
description: "Ein agentenzentrierter, durchgängiger Leitfaden zum Trainieren eines Übersetzungsmodells für ressourcenarme Sprachen mit nmt-forge – von python3 -m pip install bis hin zu einem Modell, das für die champollion-CLI bereitgestellt wird. Sie leiten einen Coding-Agenten an; die Leitplanken fangen Anfängerfehler automatisch ab."
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
    note: "The whole journey: find what exists, measure, build, prove, deploy"
  - label: "MT Training in Plain Language"
    to: /docs/network/context/mt-training-concepts
    kind: doc
    note: "Read this first if any word below is unfamiliar"
  - label: "Train a Model Honestly (nmt-forge)"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The guardrail catalogue, one page"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Where a finished model goes"
  - label: "Metric Reliability"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Know which score to trust before you optimize"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
---

# Sie möchten also Ihr eigenes Modell trainieren

Dies ist eine vollständige Anleitung zum Trainieren eines maschinellen Übersetzungsmodells für eine
ressourcenarme Sprache – von „Ich spreche diese Sprache und es gibt kaum Daten“
bis hin zu einem Modell, über das Sie ehrlich Bericht erstatten, das Sie über die
champollion-CLI für Ihre eigene Anwendung bereitstellen und beim [Netzwerk](/docs/network/) einreichen können. Das Training ist ein
Schritt auf einem längeren Weg (herausfinden, was existiert, die Optionen evaluieren, etwas
Besseres entwickeln, es belegen, es bereitstellen); [MÜ für Ihre
Sprache entwickeln](/docs/build-mt-for-your-language) bietet die Gesamtübersicht.
Diese Anleitung richtet sich an Neulinge und setzt die moderne Arbeitsweise voraus:
**Sie steuern einen Coding-Agenten** (Claude Code, OpenAI Codex, Cursor, OpenCode,
Google Antigravity oder ähnliche), und der Agent führt die Werkzeuge aus.

Jeder Schritt unten hat also dieselbe Form:

- 🗣️ **Weisen Sie Ihren Agenten an** — worum Sie in einfacher Sprache bitten sollen.
- 🛠️ **Was das Werkzeug tut** — was [nmt-forge](/docs/network/getting-started/training-honestly)
  in Ihrem Auftrag ausführt und welches **Schutzgeländer** den klassischen Fehler abfängt,
  bevor er Sie etwas kosten kann.
- 👀 **Wie Sie das Ergebnis lesen** — wie „gut" aussieht und worüber Sie sich Sorgen machen sollten.

:::info[Zunächst das Vokabular]
Wenn Ihnen Begriffe wie *dev set*, *decoding*, *chrF++*, *leakage* oder *round-trip
verification* noch nicht in Fleisch und Blut übergegangen sind, lesen Sie zuerst
[**MT-Training in einfacher Sprache**](/docs/network/context/mt-training-concepts) —
dort wird jedes hier verwendete Wort mit einem durchgearbeiteten Beispiel definiert. Diese Seite
stützt sich auf alle davon.
:::

:::note[Ehrlichkeit ist das Feature, nicht die Reibung]
Das Werkzeug ist absichtlich eigensinnig. Seine Schutzgeländer mechanisieren echte, gemessene
Fehler, die ein echtes Projekt gemacht hat — sodass der ehrliche Weg die Voreinstellung ist und die
unehrlichen Abkürzungen **mit einer Meldung verweigern, die die Lösung benennt**. Wo Sie in dieser
Anleitung eine Verweigerung sehen, macht das Werkzeug nur seine Arbeit. Und das ist gut so.
:::

---

## Was Sie brauchen, bevor Sie beginnen

- **Ein Coding-Agent** mit Terminal- und Dateisystemzugriff. Das ist der Treiber.
- **Einige echte übersetzte Sätze** für Ihr Sprachpaar – schon einige
  hundert von Menschen erstellte Paare sind ein tragfähiger Anfang. Zweisprachige Lehrbücher,
  Gemeindearchive, übersetzte öffentliche Dokumente, Lehrmaterialien. Qualität vor
  Quantität.
- **Optional, aber wirkungsvoll:** einsprachiger Text in Ihrer Zielsprache, ein
  zweisprachiges Wörterbuch, eine veröffentlichte Referenzgrammatik und ein morphologischer
  Analysator (FST). Sie benötigen **nicht** all dies zu Beginn – das Werkzeug teilt
  Ihnen genau mit, was vorhanden ist und was welche Funktionen freischaltet.
- **Rechenleistung:** ein Laptop. Die Sicherheitsvorkehrungen (Guardrails), Aufteilung (Splitting), Synthese, Prüfung (Auditing) und
  Bewertung (Scoring) laufen alle auf einer CPU, ebenso wie das Training des Standardmodells (ein kleiner,
  von Grund auf trainierter Transformer). Eine GPU ist nur relevant, wenn Sie das
  größte Preset wählen (`nllb-600m`) – siehe [Schritt 5](#step-5--train).

> 🗣️ **Sagen Sie Ihrem Agenten:** *„Installiere nmt-forge mit dem Trainings-Extra
> (`python3 -m pip install 'nmt-forge[hf]'`) und verifiziere, dass der Befehl `nmt-forge` ausgeführt werden kann.
> Wir werden ein Englisch → \<your language\>-Übersetzungsmodell trainieren,
> und zwar nachprüfbar ehrlich.“*

```bash
python3 -m pip install 'nmt-forge[hf]'     # Python 3.11+; brings mt-eval-harness, the scorer
```

Das Extra `[hf]` umfasst den Trainings-Stack (torch, transformers, accelerate,
tokenizers, sentencepiece, peft); reine CPU-Wheels genügen. Mehr ist nicht
erforderlich – kein Klonen des Champollion-Repositorys. Jeder Befehl akzeptiert `--json`
(ein JSON-Dokument auf stdout; eine Verweigerung wird als `{"error": {…, "why",
"fix"}}` with exit code 2), and `nmt-forge status` zurückgegeben) und nennt zu jedem
Zeitpunkt den nächsten Befehl.

Ihr Agent kann das Tool `get_training_guardrails` des Champollion-MCP-Servers aufrufen (keine Argumente; optional `topic`),
um das vollständige Regelwerk – die zehn Schutzmaßnahmen und die Fehler, die sie jeweils unterbinden –
in seinen eigenen Kontext zu laden, bevor er Befehle schreibt. Wenn Sie einen Agenten steuern,
bitten Sie ihn, dies zuerst zu tun.

---

## Schritt 1 — Wählen Sie eine Sprache und sehen Sie, was tatsächlich existiert

Jedes Projekt beginnt damit, den Index ehrlich zu fragen, was die Sprache *hat*.

> 🗣️ **Weisen Sie Ihren Agenten an:** *„Führe `nmt-forge discover` für den
> ISO-639-3-Code meiner Zielsprache aus und fasse zusammen, welche Daten existieren und was fehlt."*

```bash
nmt-forge discover nav        # Navajo, as an example
```

🛠️ **Was das Werkzeug tut.** Es liest die Champollion-**Karte** (Card) der Sprache – die
zentrale verlässliche Quelle (Single Source of Truth) für alles, was über diese Sprache bekannt ist – und gibt die
Schriftsysteme, morphologischen Analysatoren, Wörterbücher, Korpora und Evaluierungsdatensätze an,
die darin verzeichnet sind, und stuft die Sprache dann auf der **Ressourcenleiter** (Asset Ladder) ein. (Karten stammen aus einem
Verzeichnis, das Sie mit `--cards-dir` angeben, einem lokalen Checkout oder
`node_modules/champollion` oder dem öffentlichen Kartenindex – zwischengespeichert, sodass es
nach dem ersten Abruf offline funktioniert. Offline ohne Cache exportieren Sie die Karte mit
`champollion network card <code> --json` in ein Verzeichnis und übergeben `--cards-dir`.)

```
THE ASSET LADDER — what this language can do TODAY:
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 3: dictionary (+ grammar) → a cited template pack is worth building
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  ? rung 5: LYSS referee → the language's own metric in selection
```

👀 **Wie das Ergebnis zu lesen ist.** Die Markierungen `✓` zeigen, was Sie jetzt tun können; die Markierungen `?`
sind Sprossen, die auf eine Ressource warten. Entscheidend ist: **Fehlen auf einer Karte bedeutet
*unbekannt*, niemals „diese Sprache hat nichts“.** Eine spärliche Karte ist eine Einladung,
Ihr Wissen hinzuzufügen, keine Sackgasse – und selbst eine leere Karte ermöglicht Ihnen den vollständigen
abgesicherten Trainingszyklus auf Sprosse 1. Eine reichhaltige Karte (wie Plains Cree) schaltet die oberen
Sprossen automatisch frei: Ihre Evaluierungsdatensätze sind mit **NEVER TRAIN ON THIS** gekennzeichnet, und
ihr sprachspezifischer Referee ist sofort einsatzbereit. Sprosse 5 ist nur dann abgehakt, wenn
das Paket dieses Referees hier installiert ist; andernfalls steht dort ✗ *UNAVAILABLE*
mit dem Installationsbefehl – und der Referee wird für rein lokale oder
versiegelte Testdatensätze niemals geladen, da er Wörter bei einem externen Dienst nachschlagen kann.

Erstellen Sie dann das Gerüst eines Projekts:

> 🗣️ **Weisen Sie Ihren Agenten an:** *„Erstelle mit `nmt-forge init` ein Projektgerüst für dieses
> Sprachenpaar und lies mir die `NEXT_STEPS.md` vor, die dabei erzeugt wird."*

```bash
nmt-forge init nav --dir my-nav-mt --pair eng-nav
cd my-nav-mt                     # run every later command from here
```

🛠️ Dies erstellt einen Arbeitsbereich (ein Verzeichnis `.forge/`, das von jeder Schutzmaßnahme
konsultiert wird), eine **Starter-Konfiguration** und ein Briefing `NEXT_STEPS.md`, das für *Sie
und Ihren Agenten* verfasst wurde – die Befehlsreihenfolge, die Ressourcenleiter für Ihre Sprache und
die unverhandelbaren Grundregeln. Es ist die Roadmap für alles Nachfolgende. Die Pfade der Konfiguration sind
relativ, führen Sie forge also aus dem Projektverzeichnis heraus aus.

`init` wählt auch das **Modell** aus, das Sie trainieren werden (`--model`, ausformuliert als
explizite Zahlen in `config.json`): standardmäßig `cpu-tiny`, `cpu-finetune --base
<hf-id>`, or `nllb-600m`. [Schritt 5](#step-5--train) erklärt die Auswahl. Falls für Ihre
Sprache noch keine Karte existiert, erstellt `nmt-forge init <code> --no-card --name "<name>"`
dennoch das Grundgerüst des Projekts – jeder Faktenwert der Karte wird als unbekannt erfasst, nichts
wird erfunden.

---

## Schritt 2 — Auf einen Analysator und ein Wörterbuch verweisen (falls Sie welche haben)

In diesem Schritt geht es um die **Sprossen 3–4** der Leiter. Wenn Ihre Sprache keinen
Analysator hat, springen Sie zu [Schritt 4](#step-4--split-your-real-data-safely) — Sie trainieren
dann allein auf echten (und rückübersetzten) Daten, was ein völlig legitimer Weg ist.

Wenn ein Analysator und ein Wörterbuch *doch* existieren, schalten sie die Fähigkeit frei,
verifizierte Trainingsdaten zu *fertigen* — der mit Abstand größte Hebel für eine Sprache
mit wenig parallelem Text.

> 🗣️ **Weisen Sie Ihren Agenten an:** *„Die Karte listet einen morphologischen Analysator und ein
> Wörterbuch für diese Sprache auf. Hole sie gemäß den Installationsanweisungen auf der
> Karte, richte das Language Pack über die dokumentierten Umgebungsvariablen darauf aus und
> bestätige, dass der Analysator bei einigen bekannten Wörtern round-trippt."*

🛠️ **Was das Werkzeug tut — und eine Grenze, die es nicht überschreitet.** Analysatoren (FSTs)
und Wörterbücher sind **separate, vom Nutzer beschaffte Werkzeuge unter ihren eigenen Lizenzen**.
Die Suite **bündelt oder verbreitet sie niemals** — sie verweist Sie darauf, woher sie
kommen und welche Lizenz sie haben, und Sie beschaffen sie. Das ist keine
Bürokratie: viele Sprachressourcen tragen echte Erlaubnis- und Souveränitätseinschränkungen,
und das Werkzeug respektiert sie von Grund auf.

Das Bindegewebe ist ein **Language Pack**: ein kleines Plugin, das *Ihren*
Analysator, Ihr Wörterbuch, Ihre Orthographieregeln und Ihre grammatik-belegten Satzvorlagen an die
Engine anpasst. Die Suite liefert **keine** Packs selbst mit — Packs leben bei ihren
Sprachen (das Plains-Cree-Pack etwa lebt in seinem eigenen Projekt und
klinkt sich per Modulpfad ein).

👀 **Wie Sie das Ergebnis lesen.** Sie wollen, dass der Analysator **round-trippt**: eine
Form buchstabieren, die Schreibweise zurückgeben, dieselben grammatischen Markierungen erhalten. Wenn das nicht klappt,
braucht der **Canonicalizer** des Packs — die eine Funktion, die die Schreibweise überall dort normalisiert, wo
zwei Komponenten aufeinandertreffen — wahrscheinlich eine Regel. Das richtig hinzubekommen ist wichtig: ein
einzelnes nicht abgeglichenes Zeichen (`ý` vs. `y`) hat einmal wochenlang stillschweigend 1.375 Verben
aus einer Generierungspipeline gelöscht. Das **Funnel-Audit** des Werkzeugs zählt
Überlebende in jeder Phase, genau damit ein solcher stiller Ausfall sich nicht verbergen kann.

---

## Schritt 3 — Trainingsdaten aus Grammatikregeln synthetisieren

Mit einem Analysator + Wörterbuch + einem Pack grammatik-belegter Vorlagen können Sie
Hunderttausende verifizierter Paare fertigen.

> 🗣️ **Weisen Sie Ihren Agenten an:** *„Generiere synthetische Trainingsdaten mit
> `nmt-forge synth` unter Verwendung unseres Language Packs und zeige mir dann den Abdeckungsbericht."*

```bash
nmt-forge synth my_pack.module:get_pack --out data/synth.jsonl
```

🛠️ **Was das Werkzeug tut — das Emit-Gesetz.** Jede Zeile, die die Ausgabe erreicht,
muss Regeln erfüllen, aus denen sich kein Pack ausklinken kann:

- **Round-trip-verifiziert** — jedes generierte Wort besteht *generieren → analysieren →
  gleiche Analyse*, andernfalls wird die Zeile verworfen. Keine unverifizierte Form wird jemals ausgegeben.
- **Grammatik-belegt** — jede Vorlagenart zitiert die veröffentlichte Grammatik, die sie
  transkribiert. Unbelegte Vorlagen existieren nicht; der Code verweigert deren Laden.
- **Abdeckungsgeprüft** — Vorlagen werden gegen eine Checkliste erforderlicher grammatischer
  Phänomene abgerechnet (Imperative, Fragen, Besitz, inverse
  Formen …). Wenn ein *erforderliches* Phänomen null Beispiele hat, schlägt der Build fehl. Das
  ist die Absicherung gegen die Falle „eine Million Sätze, alle in denselben paar
  Formen" — Volumen, das strukturelle Lücken verbirgt.
- **Herkunfts-gestempelt** — jede synthetische Zeile wird mit `synthetic: true` markiert.
  Dieser Stempel ist tragend: die Registry wird es **verweigern**, synthetische Zeilen
  als Testsatz zu registrieren. Tests bestehen ausschließlich aus echten Daten.

👀 **Wie Sie das Ergebnis lesen.** Achten Sie im Abdeckungsbericht auf **erforderliche Punkte mit
Null-Abdeckung** (ein Grammatikphänomen, das Ihre Vorlagen nie erzeugt haben) und auf die
**Artenverteilung** — wenn zwei Vorlagenformen dominieren, wird die Obergrenze des Samplers pro Art
(Standard 15 %) sie neu ausbalancieren, sodass kein einzelnes Muster zur Hälfte der
Erfahrung des Modells wird.

:::tip[Kein Analysator? Nutzen Sie stattdessen Rückübersetzung (Backtranslation)]
Wenn Sie nicht anhand von Regeln synthetisieren können, aber über **einsprachigen** zielsprachlichen
Text verfügen, bitten Sie Ihren Agenten, die **Backtranslation**-Spur zu nutzen: Sie übersetzt Ihren
einsprachigen Text maschinell mit einem von Ihnen bereitgestellten Rückübersetzungsmodell *ins* Englische und stellt
jedem Ergebnis den **echten** Zielsatz gegenüber. Die Zielsprachseite bleibt authentisch.
Es handelt sich um einen Python-Bibliotheksaufruf (`nmt_forge.training.backtranslation.backtranslate`),
nicht um einen CLI-Unterbefehl: Ihr Agent schreibt ein kurzes Skript darum herum und fügt die
getaggte Ausgabedatei den `data.synthetic`-Spuren der Konfiguration hinzu. Der Aufruf
**prüft den einsprachigen Text zuerst auf Datenlecks (Leak-Audit)** – denn dieser Text könnte unbemerkt
Ihre Evaluierungsdaten enthalten. Siehe das
[Backtranslation-Cookbook](/docs/network/tutorials/back-translation).
:::

---

## Schritt 4 — Teilen Sie Ihre echten Daten sicher auf

Nehmen Sie nun Ihre **echten** Paare und legen Sie die Sätze beiseite, anhand derer
Sie alles beurteilen werden. Hier lauert der fehlerhafteste, ergebniszerstörende Fallstrick
bei ressourcenarmer MÜ, und hier zahlt sich die Schutzmaßnahme aus.

Ihre Dateien können im Format `.tsv` (Quelle, ein TAB, dann die Übersetzung, ein Paar pro
Zeile; Zeilen, die mit `# ` beginnen, sind Kommentare) oder `.jsonl` (`{"source": …,
"target": …}` pro Zeile) vorliegen.

**Wenn Sie bereits einen Testdatensatz haben** – von Lehrkräften oder medizinischem Personal geprüft, vertraulich –,
behalten Sie ihn als separate Datei, registrieren Sie ihn, prüfen Sie das Korpus daraufhin ab und teilen
Sie nur Trainings- und Dev-Daten ab:

> 🗣️ **Sagen Sie Ihrem Agenten:** *„Registriere unseren Testdatensatz, führe ein Leak-Audit des Korpus
> dagegen durch und teile das bereinigte Korpus dann mit
> `nmt-forge split` gruppendisjunkt und mit einem festen Seed in Trainings- und Dev-Daten auf.“*

```bash
nmt-forge registry add project-test ~/teacher-test.tsv --role test
nmt-forge leak-audit ~/corpus.tsv --clean-to corpus.clean.jsonl
nmt-forge split corpus.clean.jsonl --test 0 --dev 100 --seed 42 \
    --out data/split --register project
```

**Falls Sie keinen haben**, spalten Sie den Testdatensatz im selben Schritt aus dem Korpus ab:

```bash
nmt-forge split corpus.tsv --test 150 --dev 100 --seed 42 \
    --out data/split --register project
```

🛠️ **Was das Werkzeug tut – der Split-Schutz.** Es führt eine **gruppendisjunkte
Aufteilung** durch: Jedes Paar, das eine Quelle *oder* ein Ziel teilt, wird in einer Gruppe zusammengefasst,
und jede ganze Gruppe landet vollständig auf einer Seite. Anschließend **verifiziert es eine Überschneidung von null**
und verweigert die Fortsetzung, falls Überschneidungen existieren:

```
split corpus.clean.jsonl: 1580 rows in 1544 share-groups (largest 4)
  train 1480 · dev 100 · test 0  → data/split/
  verified: 0 shared canonical source/target keys across sides
  registered project-dev (role=dev)
```

Dies verhindert das **„Feed him“ / „Feed her“-Datenleck**: Ein Lehrbuch ordnet beide englischen
Übungen demselben Zielwort zu (`asam`); ein naiver Zufalls-Split legt eine Kopie in Train
und ihren Zwilling in Test, sodass das Modell die Prüfung rein durch Auswendiglernen „besteht“. In einem realen Projekt leckten
auf diese Weise 17 von 54 Testzeilen und erzielten einen Score von 83 gegenüber 44 bei sauberen Zeilen – und jede
Erkenntnis, die auf dieser Zahl aufbaute, war hinfällig. `--register project` erfasst das Dev-Set
(und das Test-Set, sofern abgespalten) als `project-dev` / `project-test` – die
Namen, auf die die Starter-Konfiguration bereits verweist –, sodass jeder spätere Befehl weiß, dass es
sich um *Evaluierungsdatensätze handelt, auf denen niemals trainiert werden darf*. Wenn ein Testdatensatz bereits
registriert ist, prüft `split` die neuen Train- und Dev-Dateien zudem direkt dagegen ab.

🛠️ **Und das Leak-Audit.** `leak-audit` prüft Zeilen gegen jeden registrierten
Evaluierungsdatensatz und gibt anhand von Beispielen aus Ihrem eigenen Korpus an, was es **verwerfen** würde –
eine Zeile, deren Quelle identisch mit einem Test-Prompt ist (selbst wenn sich die Übersetzung
unterscheidet), eine Zeile, deren Ziel identisch mit einer Test-Antwort ist, und eine Zeile, deren
Ziel ein Fast-Duplikat einer Test-Antwort ist (sie enthält die Antwort, ist ein
Fragment davon oder zu mindestens 90 % identisch bei normalisierten Akzenten) – und was es
**absichtlich behält**: *Template-Geschwister*, die ein Satzgerüst teilen, aber ein
Wort austauschen (*„I see the dog“* / *„I see the cat“*), sowie Fast-Duplikat-Prompts mit
einer anderen Antwort. Die Testzeilen, die ein Template-Geschwister im Training haben, werden
aufgelistet, und – da die Starter-Konfiguration `eval.near_dupe_corpus` auf Ihre
Trainingsdatei setzt – bewertet der Abschlussbericht die Testzeilen *ohne* Geschwister
separat als „(strict)“-Score, sodass der optimistische Effekt der Geschwister
sichtbar wird. Wenn die meisten Testzeilen ein Geschwister haben und das Test-Set fest vorgegeben ist,
entfernt `--clean-to <file> --drop-test-twins` auch diese Trainingszwillinge (es
berichtet über die strikte Teilmenge vor und nach der Bereinigung und verweigert die Leerung des Trainingssets).
Geben Sie ihm eine eigene Datei (`corpus.notwins.jsonl`): Sie ist das zwillingsfreie
Korpus des Modells neben dem Gesamtdatenkorpus, und das Leak-Audit verweigert das
Überschreiben einer Datei, die bereits von einer Konfiguration, einem Durchlauf oder einem Split gelesen wird.
Das Ergebnis ist deterministisch, und der Text der
Testdatei selbst wird niemals ausgegeben.

👀 **Wie Sie das Ergebnis lesen.** Sie wollen die Zeile **verified: 0 shared** sehen.
Wenn Sie stattdessen ein `SplitLeakageError` erhalten, löschen Sie keine Zeilen von Hand — das
mischt das Problem nur neu. Führen Sie die gruppendisjunkte Aufteilung erneut aus; das ist die Lösung, und die
Fehlermeldung sagt das.

:::danger[Trainieren Sie niemals auf einem Benchmark]
Wenn Sie einen Evaluationsdatensatz aus der geteilten Registry ziehen (`nmt-forge registry
add-harness`), stempelt das Werkzeug ihn und behandelt ihn als tabu für das Training —
**jeder** Registry-Benchmark ist als *nicht-trainieren* gekennzeichnet. Führen Sie ein Fine-Tuning auf allem durch,
was Sie legitim können; nur niemals auf dem Testsatz. Dies ist
[die eine Regel](/docs/network/leaderboard/rules) des gesamten Networks.
:::

---

## Schritt 5 — Trainieren

Eine einzige Konfigurationsdatei beschreibt den gesamten Durchlauf; ein einziger Befehl führt ihn
reproduzierbar aus. `nmt-forge init` hat sie bereits erstellt.

> 🗣️ **Sagen Sie Ihrem Agenten:** *„Lies `config.json`, füge unsere synthetische Spur hinzu, falls wir
> eine erstellt haben, führe `nmt-forge preflight run --config config.json` aus, behebe alles, was dort
> beanstandet wird, führe dann `nmt-forge run config.json` aus und beobachte die Ablaufplan-Diagnose
> (Schedule Diagnostics).“*

Ein Auszug aus der Starter-Konfiguration mit dem standardmäßigen `cpu-tiny`-Modell und einer
hinzugefügten synthetischen Spur:

```jsonc
{
  "run_name": "nav-baseline",
  "workspace": ".forge",
  "data": {
    "gold": ["data/split/train.jsonl"],
    "synthetic": [{"path": "data/synth.jsonl", "tag": "<synth>"}],
    "dev": "project-dev"              // registry name, role=dev — the fence
  },
  "mix": {"gold_upweight": 20, "kind_cap": 0.15, "seed": 42},
  "regime": "auto",
  "model": {"backend": "hf-scratch", "device": "cpu", "d_model": 256,
            "layers": 3, "epochs": 60, ...},   // no time_budget_hours: init writes none
  "selection": {"metric": "generation:chrf++", "top_k": 3},
  "decode": {"max_new_tokens": 384, "headroom_factor": 1.5},
  "eval": {"battery": "project-test", "metrics": ["chrf++"],
           "near_dupe_corpus": "data/split/train.jsonl"}
}
```

**Welches Modell?** Wählen Sie es bei der Ausführung von `init` (`--model`); jede Zahl landet in
`config.json`:

| Preset | Beschreibung | Voraussetzungen | Ehrliche Erwartungshaltung |
|---|---|---|---|
| `cpu-tiny` (Standard) | ein kleiner Transformer (~6 Mio. Parameter), der von Grund auf trainiert wird; sein Vokabular wird ausschließlich aus Ihren **Trainings**zeilen gelernt | eine Laptop-CPU, kein Download | schwach: bei 1.000–2.000 Paaren liegt chrF++ ungefähr bei 5–30 (das obere Ende nur bei stark template-basierten Daten) – lernt Phrasen und Muster Ihrer Daten, keine allgemeine Übersetzung |
| `cpu-finetune --base <hf-id>` | feinabstimmt ein kleines vorab trainiertes Marian/opus-mt-Modell, das Sie angeben – wählen Sie eines für ein *verwandtes* Sprachpaar | eine CPU, ~300 MB Download | meist besser als `cpu-tiny`, wenn ein verwandtes Paar existiert – messen Sie es auf dev, mutmaßen Sie nicht |
| `nllb-600m` | NLLB-200 distilled 600M mit LoRA | eine GPU, ~2,5 GB Download | der stärkste Einstieg; auf einer CPU bricht die Laufzeitprüfung (Wall-Clock Check) innerhalb von Minuten ab |

Der Sinn von `cpu-tiny` liegt nicht in seinem Score. Es erweckt den **gesamten** Zyklus zum Leben –
die Abgrenzung (Fence), die Audits, den vorab registrierten Test, ein Modell, das die CLI aufrufen kann –,
sodass ein späteres, besseres Modell direkt in dasselbe Projekt eingesetzt und auf dieselbe Weise gemessen werden kann.

`preflight` listet jedes Prüfgate auf, das der Durchlauf durchlaufen wird, mit ✓ oder ✗, samt Behebung für jedes ✗
– einschließlich der Prüfung, ob das Trainings-Extra installiert ist
(`✗ backend-installed: … fix: python3 -m pip install 'nmt-forge[hf]'`).

```bash
nmt-forge preflight run --config config.json
nmt-forge run config.json
```

🛠️ **Was das Werkzeug tut — vier Schutzgeländer auf einmal.**

- **Leak-Audit vor dem Training.** *Jede* Spur – Gold, synthetisch und jeglicher
  rückübersetzte Text – wird gegen *jeden* registrierten Test- und versiegelten
  Datensatz geprüft. Antwortlecks (identische Prompts oder Antworten, Fast-Duplikate von Antworten) und
  Übereinstimmungen ganzer Dateien führen zum Abbruch; Template-Geschwister werden beibehalten und gemeldet
  (`--drop-test-twins` entfernt sie bei einem festen Test-Set).
  Es wird nichts trainiert, bis der Datenmix sauber ist.
- **Dev-Fence.** Das Training **verweigert den Start ohne ein registriertes Dev-Set** und
  wird Checkpoints ausschließlich auf diesem Dev-Set auswählen – niemals auf dem Test-Set.
  (Es gleicht sogar den Inhalt der Dev-Zeilen mit den Testdatensätzen ab, um den
  Trick `cp test.jsonl dev.jsonl` zu verhindern.) Die Checkpoint-Auswahl kann den Dev-**Loss** oder
  eine Dev-**Generierungsmetrik** verwenden – das Dev-Set dekodieren und die tatsächliche Ausgabe bewerten,
  was das ehrlichere Signal darstellt (die Starter-Konfiguration verwendet chrF++ auf dekodierter Dev-Ausgabe).
- **Ablaufplan-Plausibilität (Schedule-Sanity).** Wenn Ihr Datenmix stark synthetisch geprägt ist, *leitet* das Werkzeug
  eine Abbruchuntergrenze aus der Größe Ihres Mixes ab und hält das Training über das
  **Plateau** hinweg aufrecht – die Phase, in der das Modell das einfache synthetische
  Lernen abgeschlossen hat, der Transfer zu echter Qualität aber noch nicht erfolgt ist. Dies verhindert den
  „Halb-Epochen-Tod“, bei dem naives Early Stopping bereits nach einem Zwanzigstel des
  Plans abbricht. Wie oft das Dev-Set evaluiert wird, wird ebenfalls aus der Größe des Durchlaufs abgeleitet,
  sodass auch ein kleiner Durchlauf evaluiert wird. Jeder Eingriff gibt den Verlauf des Dev-Loss
  und die Begründung in verständlicher Sprache aus.
- **Expositions-Mathematik + getaggte synthetische Daten.** Gold-Daten werden höher gewichtet (wiederholt), damit
  die wenigen echten Daten nicht untergehen; das Manifest dokumentiert die **effektive
  Exposition pro eindeutigem Satz**, damit ein A/B-Test fair bleibt. Synthetische Quellen tragen ein
  Tag; Gold-Daten bleiben ungetaggt, sodass sie den Ausgabestil verankern.

Das Training ist der einzige Schritt, der einige Zeit in Anspruch nimmt. Ihr Agent sollte es im
Hintergrund mit Ausgabe in eine Logdatei ausführen und auf die relevanten Zeilen achten
(`refused`, `Error`, `wall-clock`, `RUN EXIT`), anstatt regelmäßig abzufragen (Polling). Ein Live-Panel
mit den Verlustkurven und einer Stop-Schaltfläche öffnet sich für **Sie** (unter
`http://127.0.0.1:8377`, sofern dieser Port frei ist). In den ersten Minuten misst forge die Trainingsgeschwindigkeit
und gibt eine Laufzeitprognose aus: zunächst eine frühe Schätzung, dann eine
für den stabilen Zustand. `init` setzt kein Zeitbudget, denn ein Budget ist Ihre Vorgabe,
nicht eine, die das Werkzeug erfindet. Lesen Sie die Prognose, entscheiden Sie, wie lange Sie warten möchten,
und fügen Sie `"time_budget_hours": <hours>` zu `config.json` unter `model` hinzu. Ab
diesem Zeitpunkt bricht forge jeden Durchlauf ab, der nicht innerhalb dieses Zeitfensters abgeschlossen werden kann, sodass falsch dimensionierte Durchläufe
frühzeitig fehlschlagen. Bis Sie ein Budget festlegen, gilt nur die Sicherheitsgrenze von forge: Sie bricht
einen Durchlauf ab, der Tage dauern würde, und jede Prognose gibt dies als „no budget set;
… ceiling“ aus, nicht als ein gewähltes Budget.

👀 **Wie das Ergebnis zu lesen ist.** Der Durchlauf gibt einen **Dev-Bericht mit Konfidenzintervallen**
aus – es gibt keine Ausgabe reiner Einzelwerte – und anschließend den nächsten Befehl (die
nachstehenden Zahlen dienen der Veranschaulichung):

```
dev report (95% CIs — there is no bare-score rendering):
n=100 · set=project-dev
  chrf++       21.40  [18.95, 23.90] 95% CI

NEXT: nmt-forge export .forge/runs/nav-baseline-…/run-manifest.json --out export/
```

Wenn Sie eine `schedule-sanity`-Meldung sehen, die erklärt, dass es das Training über einen
vorzeitigen Stopp hinaus *gehalten* hat, ist das der Plateau-Schutz bei der Arbeit — gut. Der Lauf schreibt außerdem
ein **Manifest**: Konfigurations-Hash, Datei-Hashes der Daten, Seeds und den abgeleiteten Zeitplan, sodass
der gesamte Lauf reproduzierbar ist.

---

## Schritt 6 — Ehrlich evaluieren

Sie haben ein Modell. Bevor Sie es auf dem Testsatz bewerten, schreiben Sie auf, was Sie
erwarten — *zuerst*.

> 🗣️ **Sagen Sie Ihrem Agenten:** *„Schreibe eine Vorregistrierung (Preregistration) für das Scoring des Test-Sets –
> unsere vorhergesagte Metrik, Richtung und Spanne, mit einer einzeiligen Begründung – und
> exportiere dann den Durchlauf, wodurch das Test-Set einmalig bewertet wird.“*

```bash
# 1. Predict BEFORE you peek — the one format is a JSON array; edit the template
nmt-forge prereg template --out predictions.json
nmt-forge prereg new run1 --eval-set project-test --predictions predictions.json

# 2. Score the test set once against that prediction, and package the model
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg run1 --out export/
```

`--prereg` benennt die Vorregistrierung, anhand derer dieses Modell beurteilt wird. Existiert nur eine für das
Test-Set, findet export sie selbstständig; bei einem zweiten Modell und einer eigenen
Vorregistrierung für dasselbe Test-Set rät export nicht, geben Sie also jede explizit an.

(Die Vorregistrierung kann jederzeit vor dem ersten Test-Scoring erfolgen – `nmt-forge
status` fordert sie bereits vor dem Training an.)

🛠️ **Was das Werkzeug tut — die Anti-Geschichtenerzähl-Schutzgeländer.**

- **Vorregistrierung (Preregistration).** Die Bewertung eines registrierten **Test**-Sets erfordert eine
  Vorregistrierung, die *vor* dem ersten Einblick verfasst wurde. Eine Vorhersagedatei ist ein JSON-Array:
  Jede Vorhersage nennt eine Metrik und eine Begründung sowie entweder eine Richtung
  im Vergleich zu einer Baseline (automatisch geprüft durch `nmt-forge prereg check`) oder eine
  Freitext-Erwartung, die von einer Person geprüft wird. Das unbearbeitete Template, Markdown und
  Fließtext werden unter Angabe des Formats und der Korrektur abgelehnt. Ohne Vorregistrierung
  wird die Bewertung schlichtweg **verweigert**:

  ```
  [preregister] no preregistration for eval set 'project-test' at its current content hash
    why: results looked at without written-down expectations become
         post-hoc stories; ...
    fix: write one FIRST: ... — then score
  ```

  Dies ist der Schutz davor, nachträgliche Erklärungen („natürlich hat es sich bei
  mündlichen Überlieferungen verbessert“) als Vorhersagen auszugeben. Das Festhalten der Annahmen, die *fehlschlagen*,
  macht diejenigen, die zutreffen, erst vertrauenswürdig.
- **Konfidenzintervalle, immer.** Jeder Score wird mit seinem 95%-Bootstrap-CI
  dargestellt; es gibt keine Ausgabe ohne CI. Ein Anstieg bei `+0.5`, dessen Intervalle sich überschneiden, ist kein
  Erfolg.
- **Das Evaluierungs-Journal (Eval-Ledger).** Jeder Lesezugriff auf jeden Evaluierungsdatensatz wird protokolliert (Append-only,
  manipulationssicher). Fragen Sie `nmt-forge ledger show --set project-test`, wie „verbraucht“ ein
  Datensatz ist. **Versiegelte** Datensätze (Sealed Sets) sind einmalig – sie werden einmal bewertet und dann geschlossen (ein zweiter
  Aufruf von `export` wird verweigert; `--no-eval` paketiert ohne erneute Bewertung).

`export` dekodiert das Test-Set mit dem über Dev ausgewählten Checkpoint, bewertet es und
hängt einen verständlichen Abschnitt **Diagnose & Empfehlungen** an. Es schreibt
das Ergebnis außerdem als **mt-eval-Bericht** (`export/evaluation/`), sodass `mt-eval
compare` Ihr Modell neben jede andere Methode stellt, die mit der Testumgebung auf
demselben Test-Set gemessen wurde, und paketiert das Modell selbst (Schritt 8) in `export/model/`,
das keinen einzigen Testsatz enthält. `export/evaluation/` enthält Ihre Testsätze:
Kopieren Sie es niemals zusammen mit dem Modell und belassen Sie es beim Testdatensatz. `nmt-forge evaluate <run-manifest>` ist der reine Bewertungsanteil,
falls Sie kein Paket erstellen möchten.

👀 **Wie das Ergebnis zu lesen ist.** Lesen Sie die Zahl **zusammen mit ihrem Intervall und nach
Sprachregister**, prüfen Sie den „(strict)“-Score, falls Ihre Trainingsdaten Satz-Templates
mit dem Testdatensatz teilen, und prüfen Sie, **welcher Metrik zu vertrauen ist**, bevor Sie
vorschnell feiern. Um die Ausgabedatei eines anderen Systems auf demselben registrierten Datensatz
mit weiteren Metriken zu bewerten:

```bash
nmt-forge score --eval-set project-test --hyps decoded.txt \
    --metric chrf++ --metric comet --target-lang nav
```

`nmt-forge discover` zeigt die **gemessene Zuverlässigkeit** jeder Metrik für Ihre
Sprachfamilie (aus den WMT-Meta-Evaluationen). Für manche Familien folgt eine Metrik wie
BLEU dem menschlichen Urteil kaum, während COMET es tut; für viele ressourcenarme
Familien lautet die ehrliche Antwort *ungemessen* — in diesem Fall ist das Urteil von
Muttersprachlern, nicht irgendeine automatische Zahl, das echte Signal. Siehe
[Metrik-Zuverlässigkeit](/docs/network/specifications/metric-reliability).

:::tip[Der eigene Schiedsrichter Ihrer Sprache]
Wenn Ihre Sprache einen LYSS-Evaluationsstandard hat (einen Linter, der etwa weiß, dass sich zwei
Schreibweisen nur durch eine dokumentierte Langvokal-Konvention unterscheiden), binden Sie ihn mit
`--plugin` ein, und er bewertet neben chrF++ — und kann sogar Checkpoints *auswählen*,
sodass das Modell, das gewinnt, dasjenige ist, das der Schiedsrichter der Sprache selbst bevorzugt. Jede
Plugin-Zahl bekommt ebenfalls ein Konfidenzintervall.
:::

---

## Schritt 7 — Iterieren

Jetzt verbessern Sie — und jede Verbesserung wird auf dieselbe ehrliche Weise gemessen.

> 🗣️ **Sagen Sie Ihrem Agenten:** *„Ändere genau eine Sache – füge einen Template-Typ / mehr
> rückübersetzte Daten / ein anderes Modell-Preset hinzu –, trainiere erneut und führe einen A/B-Test gegen
> den vorherigen Durchlauf auf dem Dev-Set durch, inklusive Signifikanzprüfung.“*

Jeder Durchlauf gibt seinen Dev-Score bereits mit einem Konfidenzintervall aus. Für einen gepaarten
Test dekodieren Sie das Dev-Set mit jedem Durchlauf – `nmt-forge evaluate <run-manifest>
--config dev-eval.json --out-hyps run1-dev.jsonl`, where `dev-eval.json` ist eine
Kopie Ihrer Konfiguration, deren `eval.battery` auf `project-dev` gesetzt ist – und führen dann Folgendes aus:

```bash
nmt-forge compare --eval-set project-dev \
    --hyps-a run1-dev.jsonl --hyps-b run2-dev.jsonl --metric chrf++
```

🛠️ **Was das Werkzeug tut.** `compare` führt einen **gepaarten Signifikanztest** durch, nicht
nur eine Subtraktion, sodass „B schlägt A" eine Behauptung ist, die die Statistik stützt — kein
Rauschen. Iterieren Sie auf dem **Dev**-Satz (dafür ist er da); behalten Sie den **Test**-Satz
für seltene, präregistrierte Prüfungen; behalten Sie jeden **versiegelten** Satz für das allerletzte Ende.

👀 **Wie Sie das Ergebnis lesen.** Eine echte Verbesserung überwindet ihr Konfidenzintervall
*und* den Signifikanztest. Wenn nicht, haben Sie trotzdem etwas gelernt — dieser Hebel ist schwächer als
Sie gehofft haben, was zu wissen sich lohnt. Die Plateau-/Abdeckungs-/Leckage-Schutzgeländer bedeuten,
dass die Zahlen, die Sie vergleichen, vertrauenswürdig sind, sodass Sie Ihrer eigenen Iterationsschleife
tatsächlich glauben können.

Häufige nächste Hebel, grob nach Ertrag geordnet für eine datenarme Sprache:

1. **Mehr echte Paare** – bei wenigen tausend Sätzen zählt jedes zusätzliche echte
   Paar mehr als jede Einstellung.
2. **Höhere Abdeckung** bei der Synthese – ergänzen Sie die fehlenden Grammatikphänomene, die
   im Abdeckungsbericht beanstandet wurden.
3. **Rückübersetzung (Backtranslation)** – wandeln Sie einsprachigen Zieltext in weitere Trainingspaare um.
4. **Ein stärkerer Ausgangspunkt** – `cpu-finetune` mit einem Basismodell für ein
   verwandtes Paar oder `nllb-600m` auf einer GPU – gemessen gegen `cpu-tiny` auf
   demselben Dev-Set.
5. **Curriculum-Training** – vortrainieren auf synthetischen Daten, anschließend feinabstimmen auf den echten Paaren.

---

## Schritt 8 – Setzen Sie es ein und bringen Sie es ins Netzwerk

Ein ehrlich und gewissenhaft trainiertes Modell können Sie bereits heute produktiv einsetzen – und genau darauf ist das
[Champollion-Netzwerk](/docs/network/) ausgelegt.

**Setzen Sie es selbst ein.** `export` hat das Modell bereits paketiert: ein in sich geschlossenes Modellverzeichnis,
`forge-model.json` (was es ist und wie es gemessen wurde), ein
champollion-Plugin-Manifest (`method.json`) und `DEPLOY.md` mit den exakten
Befehlen.

> 🗣️ **Sagen Sie Ihrem Agenten:** *„Stelle das exportierte Modell bereit und verwende es, um
> die Strings unserer App mit der champollion-CLI zu übersetzen.“*

```bash
nmt-forge serve export/model                               # http://127.0.0.1:8378
LOCAL_API_BASE=http://127.0.0.1:8378/v1 champollion sync --method local
```

`serve` erfüllt den champollion-Vertrag für **api-Methoden** (`POST /translate`) und
einen **OpenAI-kompatiblen** `/v1/chat/completions` – Letzteren verwendet
`--method local`; `DEPLOY.md` enthält das `champollion.config.json`-Snippet für
Ersteren. Es lauscht ausschließlich auf `127.0.0.1`; eine Freigabe im Netzwerk erfordert ein
Token (`--token` oder `NMT_FORGE_SERVE_TOKEN`). Ein NMT-Modell übersetzt Text und
ignoriert Anweisungen; Tonfall-Prompts, Coaching-Dateien und Glossare, die die CLI
an LLM-Methoden sendet, haben daher keine Auswirkung darauf – und die Ausgabe bedarf der
Prüfung durch eine Person mit muttersprachlicher Kompetenz, bevor sie Leser erreicht.

**Bringen Sie es ins Netzwerk.**

> 🗣️ **Weisen Sie Ihren Agenten an:** *„Verpacke dieses Modell als Methode und reiche es beim
> Leaderboard für unser Sprachenpaar ein."*

- **[Eine Methode einreichen](/docs/network/getting-started/submit-a-method)** verwandelt
  Ihr Modell in einen Network-Eintrag, bewertet auf öffentlichen Referenzkorpora und
  Ihnen zugeschrieben.
- Weil Ihre Evaluation sauber war — gruppendisjunkt, dev-gezäunt, leckage-auditiert,
  mit CIs versehen, präregistriert — übersteht Ihre Einreichung die Prüfung, an der die meisten
  ressourcenarmen MT-Behauptungen scheitern. Die Anti-Manipulations-Architektur (geheime, gemeinschaftseigene
  Testsätze, Reproduzierbarkeitsprüfungen, Muttersprachler-Validierung) ist kein
  Hindernis für ein so gebautes Modell; sie ist ein Gütesiegel der Glaubwürdigkeit.
- Wenn ein **Preis** für Ihre Sprache offen ist, ist eine dauerhafte, besser-als-Baseline-
  Methode, die ehrlich gebaut wurde, genau das, was ein gesponserter Pool belohnt. Und wenn eine
  Methode für eine indigene Sprache funktioniert, **kann das Eigentum an die
  Gemeinschaft übergehen** — Sie bauen es hier und sie setzen es ein, zu ihren Bedingungen. Siehe die
  [Preis-Spezifikation](/docs/network/specifications/prizes) und den
  [Eigentumsübergang](/docs/network/sovereignty/ownership-transfer).

---

## Der gesamte Bogen, in einem Atemzug

1. **Ermitteln Sie**, was für die Sprache vorhanden ist (`discover`, `init`) – Fehlen bedeutet unbekannt, nicht null.
2. **Verweisen Sie** auf einen Analysator + Wörterbuch, falls vorhanden (Sprossen 3–4), unter Beachtung ihrer Lizenzen.
3. **Synthetisieren Sie** verifizierte, zitierte und abdeckungsgeprüfte Trainingsdaten (`synth`) – oder **rückübersetzen Sie** einsprachigen Text.
4. **Teilen Sie** echte Daten gruppendisjunkt auf, prüfen Sie sie gegen Ihr Test-Set und registrieren Sie die Evaluierungsdatensätze (`registry add`, `leak-audit`, `split`).
5. **Trainieren Sie** eine einzige Konfiguration – standardmäßig auf einer CPU – dev-abgesichert, leak-geprüft und plateau-bewusst (`preflight`, `run`).
6. **Evaluieren Sie** mit vorab verfassten Vorhersagen, stets mit Konfidenzintervallen und der passenden Metrik (`prereg`, `export`).
7. **Iterieren Sie** mit signifikanzgeprüften A/B-Tests (`compare`).
8. **Nutzen Sie** das Modell über die CLI (`serve`) und **reichen Sie es beim Netzwerk ein** – wo ehrliche Arbeit im Mittelpunkt steht.

Sie mussten sich nie die zehn Arten merken, auf die ressourcenarme MT-Ergebnisse schiefgehen. Das
Werkzeug hat den ehrlichen Weg zur Voreinstellung gemacht und die Abkürzungen mit einer
Erklärung verweigert. Das ist die ganze Idee: **die Schutzgeländer fangen die Anfängerfehler ab,
sodass Sie sich auf die Sprache konzentrieren können.**

## Weiter geht's

- [**MT-Training in einfacher Sprache**](/docs/network/context/mt-training-concepts) — jeder Begriff hier, mit einem Beispiel definiert.
- [**Ein Modell ehrlich trainieren**](/docs/network/getting-started/training-honestly) — die zehn Schutzgeländer auf einer Seite, jedes mit seiner gemessenen Vorgeschichte.
- [**Feineingestelltes Modell**](/docs/network/tutorials/fine-tuned-model) und [**Rückübersetzung**](/docs/network/tutorials/back-translation) — tiefergehende Kochbücher zu bestimmten Techniken.
- [**Korpuserstellung**](/docs/network/tutorials/corpus-creation) — der Aufbau der echten Daten, auf denen alles andere ruht.
