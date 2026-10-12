---
sidebar_position: 3
title: "Trainieren Sie Ihr erstes Modell (mit Ihrem Agenten)"
description: "Eine Schritt-für-Schritt-Anleitung für das Training eines MT-Modells für ressourcenarme Sprachen durch die Steuerung eines Coding-Agenten – installieren, Ihr Testset schützen, auf einer Laptop-CPU trainieren, einmal evaluieren und das Modell für die champollion CLI bereitstellen. Was Sie sagen, was forge tut, wie eine Ablehnung aussieht."
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
    note: "The whole journey — this page is the forge part of its steps 2 and 4"
  - label: "Train a Model Honestly"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The why behind every guard in this walkthrough"
  - label: "Diagnosing a Training Run"
    to: /docs/network/getting-started/diagnosing-training
    kind: guide
    note: "Symptom-first: what to do when the numbers disappoint"
  - label: "forge Command Reference"
    to: /docs/network/getting-started/forge-command-reference
    kind: reference
---

# Trainieren Sie Ihr erstes Modell (mit Ihrem Agenten)

Sie müssen nicht wissen, wie man ein neuronales maschinelles Übersetzungsmodell
trainiert. Sie müssen in der Lage sein, **einem Coding-Agenten mitzuteilen, was
Sie möchten** — Claude oder ein Modell der Sonnet-/Flash-Klasse oder ein
beliebiger Agent, der Shell-Befehle ausführen kann. **nmt-forge** ist so
konzipiert, dass der Agent es *mechanisch* steuern kann: Bei jedem Schritt teilt
das Tool dem Agenten genau mit, was als Nächstes zu tun ist, und verweigert —
laut und mit einer Lösung —, wenn ein Schritt Ihre Ergebnisse verfälschen würde.

Diese Seite beschreibt den gesamten Ablauf, von `pip install` bis hin zu einem Modell, das die Champollion-CLI aufrufen kann. Jeder Schritt ist gegliedert in: **Was Sie Ihrem Agenten mitteilen**, **was forge tut**, **wie eine Verweigerung aussieht** (damit niemand von Ihnen in Panik gerät, wenn eine ausgelöst wird – eine Verweigerung zeigt, dass das Werkzeug funktioniert) und am Ende **wie der Bericht zu lesen ist**. Dies ist der forge-Teil der Schritte 2 und 4 von [MT für Ihre Sprache erstellen](/docs/build-mt-for-your-language), worin behandelt wird, was davor geschieht (Ermitteln vorhandener Ressourcen), dazwischen liegt (Messen der bestehenden Optionen) und danach folgt (Veröffentlichen, Kombinieren von Methoden).

**Die Reihenfolge ist entscheidend.** Registrieren Sie Ihren Testdatensatz, prüfen Sie Ihre Trainingsdaten daraufhin ab und halten Sie Ihre Vorhersagen schriftlich fest (Schritte 1–3), **bevor irgendetwas am Testdatensatz bewertet wird** – einschließlich der Baselines, die Schritt 3 des Leitfadens mit `mt-eval run` misst. Ein Benchmark ist ein Bewertungsvorgang (Scoring-Read): forge zählt ihn und verweigert Vorhersagen, die danach verfasst wurden. Teilen Sie die Daten erst danach auf und trainieren Sie (Schritt 4).

:::tip Die wichtigste Regel für Ihren Agenten
Sagen Sie ihm: *„Führe immer zuerst und nach jedem Schritt `nmt-forge status --json` aus. Folge genau den Anweisungen in `next_command`.“* Diese eine Gewohnheit verwandelt forge in eine verlässliche Richtschnur. Jeder forge-Befehl akzeptiert `--json`: genau ein JSON-Dokument auf stdout, und eine Verweigerung wird als `{"error": {…, "why", "fix"}}` mit dem Exit-Code 2 zurückgegeben. Wenn sich Ihr Agent über MCP verbindet, entspricht derselbe Ablauf dem `forge_status`-Tool (`{ "project_dir": "<dir>" }`) – siehe den [Agenten-Leitfaden](/docs/network/getting-started/agent-guide).
:::

---

## Schritt 0 – Installieren und Ihren Agenten auf Ihre Sprache ausrichten

**Sie sagen:** *„Installiere nmt-forge mit dem Training-Extra. Ich möchte ein Englisch→[Ihre Sprache]-Modell trainieren. Finde zunächst heraus, was forge darüber weiß. Der ISO-639-3-Code lautet `crk`“* (verwenden Sie den Code Ihrer Sprache).

```bash
python3 -m pip install 'nmt-forge[hf]'      # Python 3.11+; brings mt-eval-harness (the scorer)
```

Das Extra `[hf]` fügt die Trainingsbibliotheken (torch, transformers, accelerate, tokenizers, sentencepiece, peft) hinzu. Für das Standardmodell genügen CPU-only-Wheels. Ein reines `python3 -m pip install nmt-forge` bietet Ihnen die Schutzmechanismen, Aufteilungen, Prüfungen und Bewertungen ohne Training.

**forge tut Folgendes:** `nmt-forge discover crk` liest die Sprachkarte (Language Card) – Schriften, Wörterbücher, morphologische Analysatoren, bestehende Korpora und Evaluierungsdatensätze (mit etwaigen `do_not_train`- / Quarantäne-Flags) sowie sprachspezifische Schiedsrichter-Metriken (Referee Metrics). Sie benötigen keine Kopie des Champollion-Repositorys: Karten werden in einem von Ihnen angegebenen Verzeichnis (`--cards-dir`), einem lokalen Checkout oder `node_modules/champollion` oder im öffentlichen Kartenindex gefunden (gecached, sodass es anschließend offline funktioniert). forge stuft Ihre Sprache anschließend auf der **Ressourcenleiter** ein: (1) paralleler Text → geschütztes Training; (2) + monolingual → getaggte Rückübersetzung; (3) + Wörterbuch/Grammatik → zitierte synthetische Daten; (4) + Analysator → Round-Trip-verifizierte Synthese; (5) + Schiedsrichter-Metrik → spracheigene Metrik bei Bewertung und Checkpoint-Auswahl.

**Ein leeres Feld bedeutet UNBEKANNT, niemals null.** Eine spärliche Karte
bedeutet nicht „diese Sprache hat nichts" — sie erfasst die Ressource
möglicherweise nur noch nicht. Sie können jederzeit Ihr eigenes paralleles
Korpus einbringen.

Anschließend: *„Erstelle das Projektgerüst.“*

```bash
nmt-forge init crk --dir school-mt && cd school-mt
```

Dadurch werden ein Arbeitsbereich (`.forge/`), eine Starter-`config.json` und ein `NEXT_STEPS.md`-Briefing mit der genauen Befehlsreihenfolge erstellt. **Führen Sie jeden späteren Befehl aus dem Projektverzeichnis heraus aus** – die Pfade in der Konfiguration sind relativ dazu.

Die Starter-Konfiguration verwendet die Modell-Voreinstellung **`cpu-tiny`**, sofern Sie keine andere wählen:

| `--model` | Beschreibung | Voraussetzungen | Erwartung |
|---|---|---|---|
| `cpu-tiny` (Standard) | ein kleiner Transformer (~6 Mio. Parameter), der von Grund auf auf Ihren Paaren trainiert wird; sein Vokabular wird ausschließlich aus Ihren Trainingszeilen gelernt | eine CPU, kein Download | schwach: bei 1.000–2.000 Paaren ein chrF++ von etwa 5–30 (das obere Ende nur bei stark schablonenhaften Daten). Es lernt Phrasen und Muster Ihrer Daten, nicht die Sprache im Allgemeinen |
| `cpu-finetune --base <hf-id>` | führt ein Fine-Tuning eines kleinen vorab trainierten Marian/opus-mt-Modells durch, das Sie angeben (wählen Sie eines für ein *verwandtes* Sprachpaar) | eine CPU, ~300 MB Download | meist besser als `cpu-tiny`, wenn ein verwandtes Sprachpaar existiert – messen Sie es auf Ihrem Dev-Datensatz, verlassen Sie sich nicht auf Vermutungen |
| `nllb-600m` | NLLB-200 distilled 600M mit LoRA | eine GPU, ~2,5 GB Download | der stärkste Ausgangspunkt; die Laufzeitprüfung von forge verweigert dies auf einer CPU innerhalb von Minuten |

Die Voreinstellung wird als explizite Zahlenwerte in `config.json` → `model` festgehalten, sodass nichts verborgen bleibt und die Änderung eines Werts einen neuen, separat gehashten Durchlauf erzeugt.

**Keine Karte für Ihre Sprache vorhanden?** `nmt-forge init <code> --no-card --name "<name>"`
erstellt dennoch ein Projektgerüst; alles, was eine Karte angegeben hätte, wird als unbekannt erfasst, und nichts wird hinzuerfunden.

---

## Schritt 1 – Testdatensatz beiseitelegen und registrieren {#step-1--set-your-test-set-aside-then-split}

**Sie sagen:** *„Hier ist mein paralleles Korpus und, separat davon, der von Lehrkräften geprüfte Testdatensatz. Halte den Testdatensatz aus dem Training heraus und registriere ihn, bevor irgendetwas daran bewertet wird.“*

Dateien können `.tsv` (Quelle, ein TAB, dann die Übersetzung, ein Paar pro Zeile; Zeilen, die mit `# ` beginnen, sind Kommentare) oder `.jsonl` (`{"source": …, "target": …}` pro Zeile) sein. Wenn der Testdatensatz vertraulich ist, markieren Sie ihn als lokal beschränkt (local-only), **bevor** irgendetwas ihn liest – einschließlich Ihres Agenten:
`echo '{"transmission": "local-only"}' > ~/teacher-test.tsv.champollion.json`.
forge gibt dessen Sätze dann zu keinem Zeitpunkt aus.

**forge tut Folgendes – falls Sie einen eigenen Testdatensatz haben** (der Regelfall bei einer Schule oder einer Klinik):

```bash
nmt-forge registry add project-test ~/teacher-test.tsv --role test
```

Die Registrierung startet das **Lese-Protokoll** der Datei (`<file>.reads.jsonl`): Von nun an wird jede Bewertung dieser Datei – durch forge oder durch `mt-eval run` / `mt-eval compare` – gezählt. Deshalb erfolgt die Registrierung zuerst: Ein davor durchgeführter Benchmark-Lauf wird bei der Registrierung zwar aufgeführt, aber nicht gezählt.

**Wenn Sie keinen separaten Testdatensatz haben**, schneiden Sie stattdessen einen aus dem Korpus heraus –
`nmt-forge split pairs.tsv --test 150 --dev 100 --seed 42 --out data/split
--register project` registers `project-test` and `project-dev` in einem einzigen Schritt
(Schritt 4 erläutert die Aufteilung) – und fahren Sie mit Schritt 3 fort.

`nmt-forge status` benennt nun den nächsten Schritt: die Vorhersagen (Schritt 3) vor jeglichem Benchmark – prüfen Sie zuvor Ihr Korpus (Schritt 2).

---

## Schritt 2 — Prüfen Sie auf Leckage

**Sie sagen:** *„Prüfe vor dem Training das Korpus gegen den Testdatensatz und sage mir, was du verwerfen würdest und warum.“*

```bash
nmt-forge leak-audit ~/pairs.tsv --clean-to pairs.clean.jsonl
```

**forge tut Folgendes:** Es prüft jede Zeile gegen jeden registrierten Dev-, Test- und versiegelten Datensatz. Dasselbe Korpus und dieselben registrierten Datensätze liefern stets dasselbe Ergebnis. Es erklärt, was es **verwerfen** würde:

- **Identischer Prompt** – Der Quellsatz der Zeile stimmt mit dem Quellsatz einer Testzeile überein (unter Ignorierung von Groß-/Kleinschreibung, Zeichensetzung und Leerzeichen). Wird verworfen, **selbst wenn die Übersetzung der Zeile abweicht**: Das Modell hätte dennoch am exakten Test-Prompt trainiert.
- **Identische Antwort** – Das Zielsegment der Zeile entspricht einer Testreferenz.
- **Beinahe doppelte Antwort (Near-Duplicate)** – Das Zielsegment der Zeile teilt mindestens 60 % seiner Wörter mit einer Testantwort (Akzente vereinheitlicht, Rechtschreibvarianten zählen also mit) **und** enthält entweder die gesamte Antwort, ist ein Fragment davon oder ist zu mindestens 90 % identisch. Dem Modell würde der Großteil der Antwort vorab gezeigt.

… und was es **absichtlich behält**, ausgewiesen, aber niemals entfernt:

- **Schablonen-Geschwister (Template Siblings)** – Die Zeile teilt ein Satzgerüst mit einer Testantwort, tauscht jedoch jeweils ein Wort aus (*„Ich sehe den Hund“* / *„Ich sehe die Katze“*). Das Modell muss weiterhin das Wort erzeugen, das es in diesem Gerüst noch nie gesehen hat. Korpora aus Lehrbüchern und Schulen sind voll davon. forge listet die Testzeilen auf, die ein Geschwisterelement im Training haben; da die Starter-Konfiguration `eval.near_dupe_corpus` setzt, zeigt der Abschlussbericht neben der Gesamtbewertung einen **„(strict)“**-Wert für die Zeilen ohne solche Übereinstimmungen.
- **Ähnlicher Prompt, andere Antwort** – Die Quelle ist ein Beinahe-Duplikat (keine identische Kopie) einer Testquelle, die Übersetzung unterscheidet sich jedoch: ein legitimer Minimalkontrast, kein Datenleck.

Hier ist der Bericht für ein 12-zeiliges Beispielkorpus, das gegen einen 3-zeiligen Testdatensatz geprüft wurde (gekürzt; die Beispielsätze sind englisch mit französischartigem Ziel):

```
leak-audit: pairs.tsv — 12 rows screened against project-test [test, 3 rows]

DROPPED by --clean-to: 4 row(s) — the model would see an eval answer (or prompt)
  • identical PROMPT: the row's source equals an eval row's source ...
      project-test (test): 2
      e.g. line 2 "The library opens at nine." → project-test row 2
      e.g. line 3 "The library opens at nine!" → project-test row 2
  • identical ANSWER: the row's target equals an eval row's reference ...
      project-test (test): 1
  • near-duplicate ANSWER: the row's target overlaps an eval answer and only adds/removes words ...
      project-test (test): 1
      e.g. line 6 "ou est la grande grange rouge maintenant?" → project-test row 3 (contains the whole answer; overlap 0.86)

KEPT on purpose (reported, never removed): 1 row(s)
  • template sibling: shares a sentence frame with an eval answer but swaps a word each way ...
      e.g. line 1 "je vois le chat dans la maison." → project-test row 1 (swaps word(s); overlap 0.75)

Cleaned: 8 row(s) kept → pairs.clean.jsonl (audit manifest: pairs.clean.audit.json)
```

Zeile 3 hat eine *andere* Übersetzung als die Testzeile und wird dennoch verworfen: Ihr Prompt entspricht dem Test-Prompt.

Beispiele zitieren Zeilen **Ihres Korpus** anhand der Zeilennummer; der eigentliche Text der Testdatei wird niemals ausgegeben, und eine Zeile, die mit einem **versiegelten** Datensatz übereinstimmte, wird nur mit der Zeilennummer angezeigt. (Wenn eine Korpuszeile identisch mit einer Testzeile ist oder diese enthält, zeigt das Zitieren der Korpuszeile auch diesen Testsatz – übergeben Sie `--no-examples`, falls die Ausgabe geteilt wird.)

`--clean-to pairs.clean.jsonl` schreibt die verbleibenden Zeilen sowie einen inhaltsfreien Prüfdatensatz daneben (`pairs.clean.audit.json`). Prüfen Sie das Korpus, **bevor** Sie es aufteilen (Schritt 4 teilt die bereinigte Datei auf). Prüfen Sie nicht das gesamte Korpus erneut, nachdem Sie einen Dev-Datensatz daraus herausgelöst haben – die Dev-Zeilen würden mit sich selbst übereinstimmen und verworfen werden. Prüfen Sie jegliche *zusätzlichen* Daten (aus dem Web gecrawlt, monolingualer Text) auf dieselbe Weise, bevor Sie sie dem Training hinzufügen.

**Die Überprüfung verbraucht Ihren Testdatensatz nicht.** leak-audit liest den Testdatensatz, um Zeilen zu vergleichen, und forge erfasst dies als *Prüf*-Lesevorgang (Audit-Read), niemals als Bewertungsvorgang: Es steht den Vorhersagen, die Sie in Schritt 3 festhalten, nicht im Wege.

**Lesen Sie zuerst das Urteil** (die Zeile `VERDICT:`; bei `--json` der Schlüssel `verdict`). Wenn es besagt, dass die meisten Testzeilen einen Beinahe-Zwilling in Ihrem Korpus haben, wird ein Modell, das auf allen Daten trainiert wurde, eher das Wiederabrufen von Trainingsphrasen als Übersetzungsfähigkeit bewerten. Bei einem festen Testdatensatz (von Lehrkräften oder Pflegepersonal geprüft) trainieren Sie dann in der Regel **zwei Modelle**: eines auf allen Daten – üblicherweise das nützlichere für den Einsatz – und ein zwillingsfreies Modell, dessen Bewertung zeigt, wie der Ansatz mit neuen Sätzen umgeht. Das zwillingsfreie Korpus wird erzeugt mit `--drop-test-twins`:

```bash
nmt-forge leak-audit ~/pairs.tsv --clean-to pairs.notwins.jsonl --drop-test-twins
```

Es entfernt die Trainingszeilen, die Beinahe-Zwillinge von Testzeilen sind, gibt die strikte Teilmenge vor und nach der Bereinigung an, verweigert den Vorgang, falls nichts mehr zum Trainieren übrigbliebe – und speichert die Konfiguration des zwillingsfreien Modells neben Ihrer ab: **`config-notwins.json`**: dieselbe Konfiguration mit eigenem `run_name` und `data.gold` / `eval.near_dupe_corpus` auf die zwillingsfreie Datei gesetzt (`--companion-config <file>` benennt eine andere Datei; eine bestehende Datei wird niemals überschrieben). Es gibt den Befehl aus, der das Modell trainiert. Bis der Dev-Datensatz registriert ist (Schritt 4), weist es darauf hin, diesen zuerst herauszulösen und dieses Audit erneut auszuführen, damit auch die Dev-Zeilen aus der zwillingsfreien Datei entfernt werden. `nmt-forge status` behält das Urteil – und danach das untrainierte zwillingsfreie Modell – so lange in seinen Warnungen, bis Sie darauf reagieren.

**Wie eine Verweigerung aussieht:** Sie müssen nicht selbst daran denken, es auszuführen – `nmt-forge run` prüft jede Trainingsdatei gegen Ihre Test- und versiegelten Datensätze und verweigert die Ausführung bei einem Datenleck: *„[leak-audit] corpus leaks into 1 test/sealed set(s) — project-test: 0 identical prompt(s), 3 identical answer(s), 1 near-duplicate answer(s) — plus 12 template sibling(s) … which are KEPT“*. Lösung: `nmt-forge leak-audit <file> --clean-to <file.clean.jsonl>` und mit der bereinigten Datei trainieren.

---

## Schritt 3 — Machen Sie Vorhersagen, bevor Sie hineinschauen

**Sie sagen:** *„Halte schriftlich fest, welche Ergebnisse wir für jedes Modell auf dem Testdatensatz erwarten – bevor wir irgendetwas daran messen.“*

**forge tut Folgendes:** Eine Vorab-Registrierung (Preregistration) pro Modell, das Sie trainieren möchten, benannt nach dem Modell:

```bash
nmt-forge prereg template --out predictions.json    # then EDIT it
nmt-forge prereg new all-data --eval-set project-test --predictions predictions.json
nmt-forge prereg new notwins --eval-set project-test --predictions predictions-notwins.json   # only with a twin-free model
```

Eine Vorhersagedatei ist ein JSON-Array von Vorhersagen. Jede benennt eine Metrik und eine Ein-Satz-Begründung sowie entweder eine Tendenz gegenüber einer Baseline (`"direction": "increase", "baseline_score": 0, "margin": 5`) – die später automatisch überprüft wird – oder eine Freitext-Erwartung (`"expect": "between 10 and 30"`), die eine Person überprüft. Sie (oder Ihr Agent explizit) legen diese fest, **bevor** irgendein Testergebnis existiert – **und vor jedem Benchmark eines bestehenden Modells auf dem Testdatensatz**: Die Baselines in Schritt 3 von [MT für Ihre Sprache erstellen](/docs/build-mt-for-your-language#3-measure-the-options) folgen *nach* diesem Schritt. Beim Exportieren gibt `--prereg <id>` an, welche Vorhersage welches Modell bewertet. Oder heften Sie eine Vorhersage jetzt an die Konfiguration ihres Modells an: `--config-hash <hash>` in `prereg new` mit dem vollständigen Hash, den `nmt-forge preflight run --config config-notwins.json` ausgibt. Jede spätere Bearbeitung dieser Konfiguration (etwa ein Zeitbudget) ändert den Hash und hebt die Anheftung auf; die Angabe der Preregistration beim Export ist daher der einfachere Weg.

**Wie eine Verweigerung aussieht:** Vier Varianten, denen Sie hier begegnen können.

- Die unbearbeitete Vorlage wird verweigert: Ihre `REPLACE`-Platzhalter sagen nichts voraus. Formulieren Sie Ihre eigene Erwartung und Begründung.
- Eine Markdown- oder Fließtextdatei wird unter Angabe des Formats und des Vorlagenbefehls verweigert. Es gibt nur ein zulässiges Format: das JSON-Array.
- Eine Vorab-Registrierung, die verfasst wurde, nachdem der Testdatensatz bereits bewertet wurde, wird verweigert: *„[preregister] eval set 'project-test' was already read for scoring … before this preregistration“*. Ein Benchmark zählt mit. `--allow-after-reads` existiert nur für Vorhersagen, die nachweislich vor diesen Lesevorgängen festgehalten wurden (beispielsweise auf Papier); dies wird protokolliert, und jeder Bericht, jeder Export, `DEPLOY.md` und `nmt-forge status` weisen anschließend darauf hin, dass die Vorhersagen erst nach N Bewertungsvorgängen erfolgten.
- Die Bewertung eines Testdatensatzes ohne Vorab-Registrierung wird verweigert: *„[preregister] no preregistration for eval set 'project-test' … why: results looked at without written-down expectations become post-hoc stories“*. Genau dies unterscheidet ein echtes Ergebnis von nachträglicher Ergebniskonstruktion.

:::info Warum sich das wie zusätzliche Arbeit anfühlt
Es ist die Arbeit. Jede Absicherung hier ist ein Fehler, der bereits echte
Forscher getäuscht hat. Das Tool macht den ehrlichen Weg zum einfachen Weg und
den unehrlichen Weg zu dem, der Sie aufhält.
:::

Messen Sie nun die vorhandenen Optionen auf dem Testdatensatz – Schritt 3 von [MT für Ihre Sprache erstellen](/docs/build-mt-for-your-language#3-measure-the-options) – und kehren Sie zum Trainieren hierher zurück.

---

## Schritt 4 – Aufteilen, Prüfkriterien prüfen und trainieren {#step-4--check-the-gates-then-train}

**Sie sagen:** *„Teile das bereinigte Korpus in Train und Dev auf. Wird der Trainingslauf alle Prüfungen bestehen? Wenn ja, trainiere.“*

**forge tut Folgendes – die Aufteilung:**

```bash
nmt-forge split pairs.clean.jsonl --test 0 --dev 100 --seed 42 \
    --out data/split --register project
```

`--test 0` schneidet nur Train und Dev heraus, da Ihr Testdatensatz bereits als eigene registrierte Datei existiert (bei einem herausgelösten Testdatensatz wurde die Aufteilung bereits in Schritt 1 vorgenommen). `--register project` erfasst `project-dev` im Arbeitsbereich – die Bezeichnung, auf die die Starter-Konfiguration bereits verweist.

Die Aufteilung ist **gruppen-disjunkt**: Zwei beliebige Satzpaare, die dieselbe Quelle *oder* dasselbe Ziel teilen, landen auf **derselben** Seite. Dies ist die häufigste Ursache für künstlich überhöhte Scores bei ressourcenarmen Sprachen – ein Lehrbuch ordnet viele englische Übungen einem einzigen Zielwort zu, eine naive Zufallsaufteilung platziert eine Kopie in Train und ihren Zwilling in Test, und das Modell „übersetzt“ Antworten, die es schlicht auswendig gelernt hat. Die Ausgabe zeigt, was geschehen ist:

```
split pairs.clean.jsonl: 1580 rows in 1544 share-groups (largest 4)
  train 1480 · dev 100 · test 0  → data/split/
  verified: 0 shared canonical source/target keys across sides
  test side: none (--test 0) — your test set is a separate file; ...
  registered project-dev (role=dev)
```

Ist bereits ein Testdatensatz registriert, prüft `split` die neuen Train- und Dev-Dateien sofort dagegen ab und warnt, falls eine Zeile später verweigert werden würde.

**Schablonenhafte Korpora (Sprachführer, Übungen).** `--near-dupe 0.6` behält auch *Beinahe*-Duplikate – Sätze, die auf demselben Gerüst aufbauen – auf einer Seite, sodass eine Dev- oder Testzeile niemals einen Schablonen-Zwilling im Training hat. Bei einem stark schablonenhaften Korpus können sich die Gerüste zu einer riesigen Gruppe verketten (*„Tut Ihr Arm weh?“* ~ *„Tut Ihr Bein weh?“* ~ *„Ihr Bein sieht geschwollen aus“* …), und eine Gruppe kann nur als Ganzes auf eine Seite wandern. Würde dies einer Seite weit mehr Zeilen zuweisen als angefordert – mehr als das **1,5-Fache** der Anfrage – oder dem Training weniger als die Hälfte dessen belassen, was die Anfrage übrigließe, verweigert `split` die Ausführung und schreibt nichts: *„[split-guard] split refused — nothing was written: the carve does not match the request (dev: asked for 100 rows, the carve put 663 there (6.63×); training keeps 210 of the 773 rows the request leaves it)“*, gefolgt von der Begründung (die Verkettung mit der Größe der größten Gruppe) und den funktionierenden Lösungswegen: ein höherer Schwellenwert, eine Obergrenze für die Gruppengröße (`--near-dupe 0.6 --max-group 51` – Verknüpfungen von Beinahe-Duplikaten oberhalb der Grenze bleiben ungetrennt, und der Split zählt sie mit), das Entfernen der Zwillinge eines festen Testdatensatzes mit `leak-audit --drop-test-twins` oder unabhängig vom Trainingsmaterial verfasste Dev-/Testsätze. forge prüft die Verkettung selbst: Bei einem solchen Korpus rät die Beinahe-Zwilling-Empfehlung (hier, in preflight und im DEPLOY.md des Exports) von `--near-dupe 0.6` ab.

**Wie eine Verweigerung aussieht:** Wenn Sie forge eine selbst erstellte Aufteilung übergeben, verweigert `nmt-forge verify-split train.jsonl dev.jsonl test.jsonl` die Ausführung, sobald sich Seiten überschneiden – *„[split-guard] 3 shared canonical source keys and 1 shared target keys between 'train' and 'test'“* – mit der Lösung: Schneiden Sie die Daten mit `split` neu zu; löschen Sie die betreffenden Zeilen nicht manuell.

**Zwei Modelle?** Da der Dev-Datensatz nun registriert ist, führen Sie das Audit für zwillingsfreie Daten aus Schritt 2 erneut aus (die Dev-Zeilen werden ebenfalls aus der zwillingsfreien Datei entfernt); das dabei erzeugte `config-notwins.json` trainiert das zweite Modell weiter unten.

**forge tut Folgendes – die Prüfkriterien (Gates):** `nmt-forge preflight run --config config.json` listet jedes Prüfkriterium auf, das der Lauf durchlaufen wird, mit ✓ oder ✗, jedes ✗ mit dem entsprechenden Lösungsweg – einschließlich der Frage, ob das Training-Extra installiert ist:

```
preflight: nmt-forge run

  ✓ config: config.json parses (config hash 9a85524275ff)
  ✓ dev-fence: config data.dev = 'project-dev': registered, role=dev
  ✓ training-data: 1 gold + 0 synthetic file(s) present
  ✗ backend-installed: backend 'hf-scratch' needs accelerate — not installed (the run would refuse)
      fix: python3 -m pip install 'nmt-forge[hf]'
  ✓ leak-audit: every gold and synthetic lane in the config will be audited ...
  ✓ schedule-sanity: regime, early-stop floor and eval cadence are derived from the config's data mix ...
  ✓ generation-headroom: decode cap is checked against dev reference lengths BEFORE training compute is spent

1 gate(s) would refuse — fix them first
```

Sobald alles grün ist: `nmt-forge run config.json` (und für das zwillingsfreie Modell:
`nmt-forge preflight run --config config-notwins.json && nmt-forge run
config-notwins.json`).

Mit der standardmäßigen `cpu-tiny`-Voreinstellung läuft dies auf einer gewöhnlichen Laptop-CPU – ohne GPU, ohne Download. Das Training ist dennoch der einzige Schritt, der **kein** verzögerungsfreier Tool-Aufruf ist. Ihr Agent sollte ihn daher im Hintergrund ausführen, die Ausgabe in eine Protokolldatei leiten und nur auf die relevanten Zeilen achten (`refused`, `Error`, `wall-clock`, `RUN EXIT`), anstatt fortlaufend abzufragen (Polling). Ein Live-Dashboard mit den Verlustkurven (Loss Curves) und einer Stopp-Schaltfläche öffnet sich für **Sie** (unter `http://127.0.0.1:8377`, sofern der Port frei ist) – es ist für Sie bestimmt, nicht für den Agenten. Zu Beginn des Laufs misst forge die Geschwindigkeit und bricht Läufe, die nicht innerhalb des in der Konfiguration definierten `model.time_budget_hours` abgeschlossen werden können, nach wenigen Minuten – statt nach Tagen – verweigernd ab.

Die Zeilen von `[schedule-sanity]` zeigen die Early-Stopping-**Untergrenze** (Floor), die forge aus Ihrem Datenmix abgeleitet hat, damit ein Durchlauf mit hohem Anteil synthetischer Daten nicht schon nach einer halben Epoche abbricht, wenn der Verlust auf den echten Dev-Daten schwankt (ein reales Fehlerszenario – siehe [Einen Trainingslauf diagnostizieren](/docs/network/getting-started/diagnosing-training)).

Nach Abschluss hat forge **einen Checkpoint auf dem isolierten Dev-Datensatz ausgewählt** (niemals auf dem Testdatensatz), ein `run-manifest.json` geschrieben und die Dev-Scores ausgegeben – stets mit ihren 95%-Konfidenzintervallen – gefolgt vom nächsten Befehl.

---

## Schritt 5 – Einmalig bewerten und paketieren

**Sie sagen:** *„Bewerte das Modell auf dem Testdatensatz und paketiere es, damit wir es verwenden können.“*

**forge tut Folgendes:**

```bash
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg all-data --out export/
```

Ein einziger Befehl:

- dekodiert Ihren Testdatensatz mit dem vom Trainingslauf ausgewählten Checkpoint und bewertet ihn – ohne Vorab-Registrierung verweigert, im Protokollbuch (Ledger) des Arbeitsbereichs festgehalten, 95%-Konfidenzintervalle für jeden Wert und ein leicht verständlicher Abschnitt **Diagnose & Empfehlungen**;
- speichert das Ergebnis als **mt-eval-Bericht** in `export/evaluation/`, sodass `mt-eval compare` dieses Modell neben alles stellt, was Sie mit der Testumgebung (Harness) gemessen haben (beispielsweise die gehosteten Modelle in Schritt 3 von [MT für Ihre Sprache erstellen](/docs/build-mt-for-your-language#3-measure-the-options));
- schnürt ein **in sich geschlossenes Modellpaket** in `export/model/` (Gewichte und Tokenizer, kein Trainingszustand), `forge-model.json` (was es ist und wie es gemessen wurde), ein Champollion-Plugin-Manifest und `DEPLOY.md` mit den genauen Befehlen. `export/model/` enthält keine Testsätze; es ist der einzige Ordner, den Sie bereitstellen.

**Der Score** ist die Hauptmetrik der Testumgebung: Korpus-chrF++ mit seinem 95%-Konfidenzintervall, überall dort gleich formatiert, wo forge ihn ausgibt – beispielsweise `chrF++ 31.2 [28.4, 34.0]` – zusammen mit seiner sacreBLEU-Signatur in den vollständigen Datensätzen (`forge-model.json`, die Export-Zusammenfassung, `DEPLOY.md`). BLEU, spBLEU und TER werden daneben aufgeführt, niemals damit vermischt; Exakte Übereinstimmung (Exact Match) und die weiteren Prüfbahnen dienen der Diagnose. Keine forge-Oberfläche gibt einen zusammengesetzten Score oder ein Qualitätsurteil aus: Welchen Wert die Ausgabe hat, müssen die Sprecherinnen und Sprecher der Sprache selbst beurteilen.

**Einschränkungen der Bewertung reisen immer mit ihr.** Der mt-eval-Bericht protokolliert alles, was die Aussagekraft des Scores einschränkt – beispielsweise eine *nahezu konstante Ausgabe* (das Modell hat bei vielen verschiedenen Eingaben nur einen von wenigen Standardsätzen ausgegeben, sodass die Ausgaben den Eingaben nicht folgen), Ausgaben, die deutlich länger oder kürzer als die Referenzen sind, oder bloße Kopien der Quelle. `export` gibt jeden dieser Punkte im Wortlaut der Testumgebung weiter: in der Zusammenfassung (`score_caveats`), in `forge-model.json` und in `DEPLOY.md` direkt unter dem Score. `status`, `report`, `compare` und `lint` weisen auf dasselbe hin. Ein Score, der mit Vorbehalten versehen ist, wird niemals isoliert als „die zu zitierende Kennzahl“ dargestellt.

Sollte ein Fehler auftreten, bleiben keine unvollständigen Exporte zurück. Zwei Vorsichtsmaßnahmen: `export/evaluation/` enthält Ihre Testsätze – kopieren Sie diesen Ordner keinesfalls zusammen mit dem Modell; bewahren Sie ihn beim Testdatensatz auf. (Wenn der Testdatensatz als vertraulich markiert ist, trägt jede Datei darin dieselbe Markierung.) Und ein **versiegelter** Testdatensatz kann nur einmal verwendet werden: Der Export verbraucht ihn, und ein zweiter Export wird verweigert, es sei denn, Sie übergeben `--no-eval` (Modell ohne erneute Bewertung paketieren).

`nmt-forge evaluate <run-manifest>` ist der reine Bewertungsanteil von `export`, falls Sie nur die Zahlenwerte ohne Paketierung wünschen (`--harness-out DIR` schreibt den mt-eval-Bericht).

**Zwei Modelle auf einem Testdatensatz** (beispielsweise eines auf allen Daten trainiert und eines mit `--drop-test-twins`): Sobald der Arbeitsbereich einen zweiten Lauf enthält, benennen die Zeile `NEXT` des Laufs und `nmt-forge status` einen Ordner pro Lauf (`--out export-<run>/`). Die Reihenfolge spielt keine Rolle: Ganz gleich, welches Modell als zweites exportiert wird – `DEPLOY.md` des Modells mit allen Daten zitiert am Ende den Score des zwillingsfreien Modells. Bei zwei Vorab-Registrierungen auf einem Testdatensatz geben `nmt-forge status` und `nmt-forge report` an, welche für welchen Lauf gilt (oder dass `--prereg <id>` entscheiden muss – export the twin-free model with `--prereg notwins`). `nmt-forge compare` vergleicht beide per A/B-Test auf dem Testdatensatz und weist pro Modell aus, wie viele Testzeilen einen Beinahe-Zwilling in dessen Trainingsdaten haben: Ein Vorteil durch reines Auswendiglernen (Recall) wird auch als solcher ausgewiesen. Es übernimmt die Hypothesen jedes Modells – `<export>/evaluation/battery-hyps.jsonl`, in der Export-Zusammenfassung als `hypotheses` bezeichnet – und gibt die Bewertungsvorbehalte weiter, die mt-eval für diesen Export erfasst hat. Der zwillingsfreie Score ist derjenige, der für neue Sätze herangezogen werden sollte – jedoch stets nur zusammen mit den dazugehörigen Vorbehalten: Wenn die Ausgabe des zwillingsfreien Modells nahezu konstant ist, ist sein Score kein Beleg dafür, dass es neue Sätze übersetzt, und `DEPLOY.md` weist direkt neben dem Wert darauf hin.

**Lesevorgänge durch die Testumgebung zählen mit.** Wenn forge einen Testdatensatz registriert, legt es ein kleines Lese-Protokoll neben der Datei an (`<file>.reads.jsonl`), und `mt-eval run` / `mt-eval compare` hängen jedes Mal, wenn sie diese Datei bewerten, eine inhaltsfreie Zeile an (Run-ID, Verwendungszweck, SHA-256 der Datei, Zeitstempel). forge liest dieses Protokoll aus: Eine Vorab-Registrierung, die nach einem solchen Lesevorgang verfasst wurde, wird als nachträgliche Vorhersage (Postdiction) abgewiesen (außer bei `--allow-after-reads`, was dann in jedem Bericht offengelegt wird) – dies ist der Grund, warum Schritt 3 vor den Baselines liegt. Ein von `mt-eval` gelesener versiegelter Datensatz gilt als verbraucht, `status` und `ledger show --set` zählen die Lesevorgänge, und `DEPLOY.md` weist darauf hin, wenn der exportierte Score kein Erstblick war.

### Wie der Battery-Lint-Bericht zu lesen ist

Der Bericht besteht aus einer Tabelle von Scores **nach Sprachregister** (Lehrbuch, Behördentext, mündliche Überlieferung, …) – oder einer einzelnen Gruppe, `all`, falls Ihre Testzeilen kein Register benennen –, jeweils mit zugehörigem Konfidenzintervall, gefolgt von der Diagnose. Die Diagnose benennt Ihre **schwächsten Register** und für jedes die wahrscheinlichste Ursache sowie den **Hebel**, den Sie als Nächstes ansetzen sollten:

| Wenn die Diagnose lautet… | Bedeutet das… | Der Hebel |
|---|---|---|
| `R1-vocabulary-gap` | das Register erzielt niedrige Scores **und** Ausgaben sind unvollständig; dem Modell fehlen die Wörter | **VOKABULAR** – Wortschatz erweitern, dann den Trichter erneut prüfen |
| `R2-structure-gap` | die Wörter sind bekannt, aber Satz*strukturen* nicht | **STRUKTUR** – fehlende Konstruktionen hinzufügen (Templates/Compositor) |
| `R3-mixed-convention` | Ausgaben mischen Schreibweisen | **ORTHOGRAFIE** – Korpus auf eine einheitliche Konvention normalisieren, neu trainieren |
| `R4-optimism-bound` | der „vollständige“ Score ist durch Beinahe-Zwillinge im Testset künstlich überhöht | **MESSUNG** – für Generalisierbarkeit den Strict-Score zitieren |
| `R5-low-power` | das Konfidenzintervall ist breit | **MESSUNG** – nicht auf Abweichungen reagieren, die kleiner als das KI sind; Testdatensatz vergrößern |
| `R7-transfer-plateau` | hervorragend bei synthetischen Daten, stagniert bei echtem Text | **ECHTE DATEN** – monolinguale Daten rückübersetzen oder echte Parallelsätze beschaffen |
| `R9-harness-score-caveat` | der mt-eval-Bericht schränkt den Score ein (beispielsweise nahezu konstante Ausgabe); `high`, wenn mt-eval dies als schwerwiegend einstuft | **MESSUNG** – den Score nur mit dem Vorbehalt zitieren und einige Ausgaben manuell prüfen, bevor von Übersetzungsqualität gesprochen wird |

Jeder Befund enthält die Belege, auf deren Grundlage er ausgelöst wurde. Bei den `--json`-Befunden kann Ihr Agent programmatisch handeln: `nmt-forge lint
export/evaluation/battery-hyps-battery.json --json`.

---

## Schritt 6 – Für die Champollion-CLI bereitstellen

**Sie sagen:** *„Stelle das exportierte Modell bereit und übersetze die Strings unserer App damit.“*

**forge tut Folgendes:**

```bash
nmt-forge serve export/model                               # http://127.0.0.1:8378
LOCAL_API_BASE=http://127.0.0.1:8378/v1 champollion sync --method local
```

`serve` antwortet auf zwei Arten: über die Champollion-**api method**-Schnittstelle (`POST /translate`) und über einen **OpenAI-kompatiblen** `/v1/chat/completions`, mit dem `champollion sync --method local` kommuniziert. `export/model/DEPLOY.md` enthält den `champollion.config.json`-Codeausschnitt für die `api`-Methode (die empfohlene Variante) sowie für das Plugin-Manifest. Der Server lauscht ausschließlich auf `127.0.0.1`; um ihn über ein Netzwerk zugänglich zu machen, müssen Sie ein Token zuweisen (`--token` oder `NMT_FORGE_SERVE_TOKEN`), da jeder, der den Port erreichen kann, Ihr Modell nutzen kann. Die CLI benötigt keinen Schlüssel für den Loopback-Server; ein mit Token gestarteter Server erfordert denselben Wert in `CHAMPOLLION_API_KEY`.

Bei zwei exportierten Modellen liegt die Entscheidung bei Ihnen, welches bereitgestellt werden soll: `nmt-forge choose export-<run>/model` erfasst dies, und `nmt-forge status` benennt anschließend dieses Modell. Die Bereitstellung zu Testzwecken wird als „bereitgestellt“ (served) erfasst, nicht als getroffene Auswahl. Um das Modell stattdessen in einem Sovereign Contest einzureichen, führt `DEPLOY.md` §6 die Dateien auf, die einen deklarativen Beitrag (Lane A) ausmachen, zusammen mit dem genauen Befehl `mt-eval contest submit-model`.

Seien Sie sich bewusst, was Sie bereitstellen: Ein NMT-Modell übersetzt Text; es befolgt **keine** Anweisungen (Prompts), daher werden Tonalitätsvorgaben (Tone Guidance), Coaching-Dateien und Glossare, die die CLI an LLM-Methoden sendet, ignoriert. Und maschinelle Übersetzung einer ressourcenarmen Sprache erfordert stets die Überprüfung durch eine fließend sprechende Person, bevor irgendetwas an Leserschaft gelangt.

---

## Was Sie gerade getan haben

Sie haben ein Modell trainiert, dessen Score Sie tatsächlich vertrauen können: keine durchgesickerten Antworten, ein Checkpoint, der ohne Spicken auf den Testdatensatz ausgewählt wurde, Fehlerbalken für jeden Wert, vor den Ergebnissen festgehaltene Vorhersagen, eine Diagnose, die den nächsten Hebel benennt, statt Sie raten zu lassen – und ein fertiges Modellpaket, das die CLI aufrufen kann und das sich direkt mit jeder anderen Methode vergleichen lässt, die Sie gemessen haben. Genau darum geht es: **Das ehrliche Ergebnis ist der Standard, und es war kein Fachwissen über maschinelle Übersetzung (und keine GPU) nötig, um dorthin zu gelangen.**

Wenn die Zahlen enttäuschen (das werden sie beim ersten Mal – das Standardmodell ist absichtlich minimalistisch ausgelegt), lesen Sie [Einen Trainingslauf diagnostizieren](/docs/network/getting-started/diagnosing-training) – dieser Leitfaden setzt an den Symptomen an und ist genau für diesen Moment geschrieben.
