---
sidebar_position: 3
title: "Trainieren Sie Ihr erstes Modell (mit Ihrem Agenten)"
description: "Eine schrittweise Anleitung zum Trainieren eines MT-Modells für ressourcenarme Sprachen durch Steuerung eines Coding-Agenten — was Sie sagen, was forge tut, wie eine Ablehnung aussieht und wie Sie die Diagnose lesen."
related:
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

Diese Seite beschreibt den gesamten Ablauf. Jeder Schritt ist formuliert als
**das, was Sie Ihrem Agenten mitteilen**, **was forge tut**, **wie eine
Verweigerung aussieht** (damit keiner von Ihnen in Panik gerät, wenn eine
ausgelöst wird — eine Verweigerung ist das Tool bei der Arbeit), und schließlich
**wie der Bericht zu lesen ist**.

:::tip Die eine Regel für Ihren Agenten
Teilen Sie ihm mit: *„Führe immer zuerst `nmt-forge status --json` aus, und nach jedem
Schritt. Tue, was das `next_command` sagt."* Diese eine Gewohnheit macht forge
zu einer Führungsschiene. Wenn Ihr Agent sich über MCP verbindet, ist derselbe
Ablauf das `forge_status`-Tool — siehe den [Agent Guide](/docs/network/getting-started/agent-guide).
:::

---

## Schritt 0 — Richten Sie Ihren Agenten auf Ihre Sprache aus

**Sie sagen:** *„Ich möchte ein Englisch→[Ihre Sprache]-Modell trainieren.
Beginne damit, herauszufinden, was forge darüber weiß. Der ISO-639-3-Code ist
`crk`"* (verwenden Sie den Code Ihrer Sprache).

**forge tut:** `nmt-forge discover crk` liest die Karte der Sprache — Schriften,
Wörterbücher, morphologische Analysatoren, vorhandene Korpora und
Evaluationssätze (mit etwaigen `do_not_train`-/Quarantäne-Markierungen) sowie
sprachspezifische Referee-Metriken. Es ordnet Ihre Sprache auf der
**Asset-Leiter** ein: (1) Paralleltext → abgesichertes Training; (2) +
monolingual → getaggte Rückübersetzung; (3) + Wörterbuch/Grammatik → belegte
synthetische Daten; (4) + Analysator → per Hin-und-Rück-Verfahren verifizierte
Synthese; (5) + eine Referee-Metrik → die eigene Metrik der Sprache bei der
Bewertung und Checkpoint-Auswahl.

**Ein leeres Feld bedeutet UNBEKANNT, niemals null.** Eine spärliche Karte
bedeutet nicht „diese Sprache hat nichts" — sie erfasst die Ressource
möglicherweise nur noch nicht. Sie können jederzeit Ihr eigenes paralleles
Korpus einbringen.

Dann: *„Erstelle das Projektgerüst."* → `nmt-forge init crk` schreibt einen
Arbeitsbereich, eine Startkonfiguration und ein `NEXT_STEPS`-Briefing.

---

## Schritt 1 — Erstellen Sie eine Aufteilung, die nicht schummeln kann

**Sie sagen:** *„Hier ist mein paralleles Korpus `corpus.jsonl`. Teile es in
Train/Dev/Test auf und registriere die Dev- und Test-Sätze."*

**forge tut:** `nmt-forge split corpus.jsonl --test 200 --dev 100 --seed 7
--out data/splits --register mypair`. Es erstellt eine **gruppendisjunkte**
Aufteilung: Zwei beliebige Satzpaare, die eine Quelle *oder* ein Ziel teilen,
landen auf **derselben** Seite. Dies ist die mit Abstand häufigste Art, wie
Low-Resource-Bewertungen aufgebläht werden — ein Lehrbuch ordnet viele
englische Übungen einem Zielwort zu, eine naive zufällige Aufteilung legt eine
Kopie in Train und ihren Zwilling in Test ab, und das Modell „übersetzt"
Antworten, die es sich eingeprägt hat.

**Wie eine Verweigerung aussieht:** Wenn Sie forge eine selbst erstellte
Aufteilung übergeben und diese nicht disjunkt ist, bricht `verify-split` mit
Nennung der gemeinsamen Schlüssel ab — *„diese Zeilen teilen ein kanonisches
Ziel zwischen Train und Test."* Lösung: Lassen Sie forge die Aufteilung
vornehmen.

---

## Schritt 2 — Prüfen Sie auf Leckage

**Sie sagen:** *„Bevor wir trainieren, prüfe das Trainingskorpus auf Leckage
gegenüber den Evaluationssätzen."*

**forge tut:** `nmt-forge leak-audit corpus.jsonl`. Es prüft Ihr Korpus gegen jeden registrierten
Dev-/Test-/versiegelten Satz:

- **Zielseitiges exaktes oder nahezu doppeltes Vorkommen** (die
  Referenzantwort befindet sich in Ihren Trainingsdaten) → **fatal**. Dies ist
  Antwortleckage.
- **Quellseitiges Beinahe-Duplikat mit einer *anderen* Antwort** →
  **informativ, beibehalten**. Dieselbe Eingabe mit einer anderen Übersetzung
  ist ein legitimes Minimalkontrast-Paar, keine Leckage — forge meldet es,
  löscht es aber nie. (Diese Unterscheidung war ein echter Fehler, den wir
  durch Dogfooding entdeckt haben: Eine frühere Version markierte 44 Zeilen als
  fatal, obwohl nur 17 echte Leckagen waren.)

**Wie eine Verweigerung aussieht:** *„Zeile 118: zielseitiges Beinahe-Duplikat
des Test-Satzes `mypair-test` (Jaccard 0,83) — Antwortleckage."* Lösung: Ihr
Agent führt `nmt-forge leak-audit corpus.jsonl --clean-to corpus.clean.jsonl` aus und trainiert mit den Überlebenden.

---

## Schritt 3 — Machen Sie Vorhersagen, bevor Sie hineinschauen

**Sie sagen:** *„Halte fest, was wir vom Modell erwarten, dann trainieren
wir."*

**forge tut:** `nmt-forge prereg new p1 --eval-set mypair-test --predictions
predictions.md`. Sie (oder Ihr Agent, laut ausgesprochen) legen falsifizierbare
Vorhersagen fest — welche Metrik, welche Richtung, wie groß — **bevor**
irgendein Test-Ergebnis existiert.

**Wie eine Verweigerung aussieht:** Wenn Ihr Agent versucht, den Test-Satz ohne
Präregistrierung zu bewerten, verweigert `score` dies: *„die Bewertung
eines Test-Satzes wird ohne eine Präregistrierung verweigert, die dem ersten
Bewertungszugriff vorausgeht."* Genau dies unterscheidet ein Ergebnis von
ergebnisorientiertem Geschichtenerzählen. Lösung: Präregistrieren Sie zuerst.

:::info Warum sich das wie zusätzliche Arbeit anfühlt
Es ist die Arbeit. Jede Absicherung hier ist ein Fehler, der bereits echte
Forscher getäuscht hat. Das Tool macht den ehrlichen Weg zum einfachen Weg und
den unehrlichen Weg zu dem, der Sie aufhält.
:::

---

## Schritt 4 — Prüfen Sie die Gates, dann trainieren Sie

**Sie sagen:** *„Wird der Trainingslauf alle seine Prüfungen bestehen? Wenn ja,
trainiere."*

**forge tut:** `nmt-forge preflight run` listet jedes Gate auf, das der Lauf durchlaufen
wird — Dev-Fence vorhanden, Leckage-Audit sauber, Zeitplan-Untergrenze
abgeleitet, Decode-Spielraum geprüft — jeweils mit ✓ oder ✗ und einer Lösung.
Wenn alles grün ist: `nmt-forge run config.json`.

Das Training ist der eine Schritt, der **kein** sofortiger Tool-Aufruf ist — es
verwendet eine GPU und dauert Minuten bis Stunden. Ihr Agent führt es in einem
Terminal aus und beobachtet die `[schedule-sanity]`-Zeilen. forge leitet die
**Untergrenze** für das Early Stopping aus Ihrer Datenmischung ab, sodass ein
synthetik-lastiger Lauf nicht nach einer halben Epoche abstirbt, wenn der
Real-Dev-Verlust schwankt (ein echter Fehlermodus — siehe
[Diagnose eines Trainingslaufs](/docs/network/getting-started/diagnosing-training)).

Wenn es abgeschlossen ist, hat forge **einen Checkpoint auf dem abgezäunten
Dev-Satz ausgewählt** (niemals auf dem Test-Satz) und ein `run-manifest.json`
geschrieben.

---

## Schritt 5 — Schließen Sie den Kreis: bewerten und diagnostizieren

**Sie sagen:** *„Bewerte das Modell an der Test-Batterie und sage mir, was ich
verbessern soll."*

**forge tut:** `nmt-forge evaluate .forge/runs/<run>/run-manifest.json --config
config.json`. Dies **schließt den Kreis** in einem Befehl: Es dekodiert die
Test-Batterie mit dem Checkpoint, den der Lauf ausgewählt hat, bewertet sie
(präreg-abgesichert, mit 95%-Konfidenzintervallen auf jeder Zahl) und hängt
einen Abschnitt **Diagnose & Empfehlungen** in einfacher Sprache an. (Bevor
dieser Befehl existierte, mussten Sie den Checkpoint per Symlink verknüpfen und
einen Decoder von Hand ausführen — genau da hatte sich ein Neuling verirrt.)

### Wie der Battery-Lint-Bericht zu lesen ist

Der Bericht ist eine Tabelle mit Bewertungen **nach Register** (Lehrbuch,
Behörde, mündliche Erzählung, …), jeweils mit ihrem Konfidenzintervall, gefolgt
von der Diagnose. Die Diagnose nennt Ihre **schwächsten Register** und für jedes
die wahrscheinlichste Ursache und den **Hebel**, der als Nächstes zu betätigen
ist:

| Wenn die Diagnose sagt… | Es bedeutet… | Der Hebel |
|---|---|---|
| `R1-vocabulary-gap` | das Register erzielt eine niedrige Bewertung **und** die Ausgaben sind unvollständig; dem Modell fehlen die Wörter | **VOCABULARY** — erweitern Sie das Lexikon, prüfen Sie dann den Trichter erneut |
| `R2-structure-gap` | die Wörter sind bekannt, aber die Satz-*Formen* nicht | **STRUCTURE** — fügen Sie die fehlenden Konstruktionen hinzu (Templates/Compositor) |
| `R3-mixed-convention` | die Ausgaben vermischen Schreibweisen | **ORTHOGRAPHY** — normalisieren Sie das Korpus auf eine Konvention, trainieren Sie neu |
| `R4-optimism-bound` | die „vollständige" Bewertung ist durch Beinahe-Zwillings-Evaluationszeilen aufgebläht | **MEASUREMENT** — geben Sie die strikte Bewertung für die Generalisierung an |
| `R5-low-power` | das Konfidenzintervall ist breit | **MEASUREMENT** — handeln Sie nicht bei Deltas, die kleiner als das CI sind; vergrößern Sie den Evaluationssatz |
| `R7-transfer-plateau` | großartig bei synthetischen Daten, stagnierend bei echtem Text | **REAL-DATA** — rückübersetzen Sie monolinguale Daten oder beschaffen Sie echte parallele Sätze |

Jeder Befund führt den Nachweis mit sich, auf dem er ausgelöst hat. Für die
`--json`-Befunde kann Ihr Agent programmatisch handeln: `nmt-forge lint <battery-manifest.json>`.

---

## Was Sie gerade getan haben

Sie haben ein Modell trainiert, dessen Bewertung Sie tatsächlich glauben
können: keine durchgesickerten Antworten, ein Checkpoint, der ohne Blick auf den
Test-Satz ausgewählt wurde, Fehlerbalken auf jeder Zahl, Vorhersagen, die vor
den Ergebnissen festgehalten wurden, und eine Diagnose, die den nächsten Hebel
nennt, statt Sie raten zu lassen. Genau darum geht es — **das ehrliche Ergebnis
ist die Voreinstellung, und es war kein MT-Fachwissen erforderlich, um dorthin
zu gelangen.**

Wenn die Zahlen enttäuschen (was sie beim ersten Mal tun werden), gehen Sie zu
[Diagnose eines Trainingslaufs](/docs/network/getting-started/diagnosing-training) —
sie ist symptomorientiert und genau für diesen Moment geschrieben.
