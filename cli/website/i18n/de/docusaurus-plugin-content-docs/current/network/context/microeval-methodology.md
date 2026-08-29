---
sidebar_position: 4
title: "Microeval: Sprachspezifische Evaluierung für maschinelle Übersetzung"
slug: '/network/context/microeval-methodology'
---

# Microeval: Sprachspezifische Evaluationsmetriken für die maschinelle Übersetzung

***Eine Methodik zur Entwicklung von Evaluationsmetriken, die mithilfe von FSTs, Wörterbüchern und von Linguisten kuratierten Äquivalenzregeln auf einzelne Sprachen zugeschnitten sind — und warum dieses Forschungsfeld sie benötigt***

---

> *„Die Grenzen meiner Sprache bedeuten die Grenzen meiner Welt."*
> — Ludwig Wittgenstein, *Tractatus Logico-Philosophicus* (1921)

---

## Einführung

Die Gemeinschaft der Evaluationsforschung im Bereich der maschinellen Übersetzung hat zwei Jahrzehnte mit der Suche nach universellen Metriken verbracht — Maßstäben für Übersetzungsqualität, die über alle Sprachen, alle Domänen und alle Typologien hinweg funktionieren. Diese Suche hat bemerkenswerte Werkzeuge hervorgebracht: BLEU (Papineni et al., 2002), chrF++ (Popović, 2017), COMET (Rei et al., 2020), MetricX (Juraska et al., 2023). Für die ~20 Sprachen, die die WMT-Shared-Tasks dominieren, funktionieren diese Werkzeuge.

Für die übrigen ~7.000 Sprachen funktionieren sie nicht.

Dieses Papier argumentiert, dass **die Suche nach universellen Metriken bei Anwendung auf ressourcenarme und morphologisch komplexe Sprachen nicht nur unvollständig — sondern das falsche Paradigma ist**. Wir schlagen **microeval** vor: eine Methodik zur Entwicklung von Evaluationsmetriken, die mithilfe der besten verfügbaren linguistischen Werkzeuge — endlicher Zustandstransduktoren (Finite-State-Transduktoren), zweisprachiger Wörterbücher, morphologischer Analysatoren und von Linguisten kuratierter Äquivalenzregeln — auf einzelne Sprachen zugeschnitten sind.

Microeval ist keine Metrik. Es ist eine *Praxis* — ein systematischer Prozess zur Konstruktion einer Evaluationsinfrastruktur, die sprachspezifisches Wissen kodiert. Diese Praxis bringt Metriken hervor, die wir unter dem Rahmenwerk-Namen **LYSS** (Linguistically-informed Yield & Structural Scoring) zusammenfassen. Der Beitrag liegt jedoch in der Methodik, nicht in einer bestimmten Metrik, die sie hervorbringt.

Dieses Dokument ist ein Begleitdokument zu:
- [Measuring the Immeasurable](/docs/network/context/mt-evaluation-landscape) — der Überblicksstudie zur Evaluationslandschaft, die LYSS unter den bestehenden Metriken einordnet
- [The Scoring Specification](/docs/network/specifications/scoring) — der technischen Spezifikation für Metrikdefinitionen, Gewichtungen und zusammengesetzte Bewertung (composite scoring)
- [The Corpus Partnership Strategy](/docs/network/specifications/corpus-partnership) — dem praktischen Arbeitsablauf zur Einrichtung von Evaluationskorpora

Diese Dokumente beschreiben, *was* LYSS ist und *wo* es einzuordnen ist. Das vorliegende Dokument behandelt die tiefergehenden Fragen: *Warum* ist sprachspezifische Evaluation notwendig? *Wie* entwickeln Sie sie für eine neue Sprache? Und *wer* entscheidet, was als „korrekt" gilt?

---

## Teil 1: Warum universelle Metriken bei ressourcenarmen Sprachen versagen

### 1.1 Die Universalitätsannahme

Jede bedeutende MT-Evaluationsmetrik seit BLEU beruht auf einer impliziten Annahme: dass die *Mechanismen* der Übersetzungsqualität sprachunabhängig sind, auch wenn die *Parameter* sich unterscheiden. BLEU zählt N-Gramm-Überschneidungen. chrF++ zählt Zeichen-N-Gramm-Überschneidungen. COMET trainiert ein Regressionsmodell auf der Grundlage menschlicher Bewertungen. Alle gehen davon aus, dass die Signalstruktur — das, was eine Übersetzung „gut" macht — durch einen sprachunabhängigen Algorithmus erfasst werden kann, der möglicherweise auf sprachspezifischen Daten feinabgestimmt wurde.

Für ressourcenreiche europäische Sprachpaare hält diese Annahme hinreichend gut stand. WMT-Shared-Tasks für Metriken belegen eine hohe Korrelation mit menschlichen Urteilen für Englisch↔Deutsch, Englisch↔Tschechisch, Englisch↔Chinesisch. Die Metriken sind sich bei Grenzfällen uneinig, stimmen jedoch in der Verteilung der Qualität überein.

Für polysynthetische Sprachen wie Plains Cree (nêhiyawêwin) bricht die Annahme auf mehreren Ebenen zusammen:

**Morphologische Opazität.** Ein einzelnes Cree-Verb kann ebenso viel Information enthalten wie ein ganzer englischer Teilsatz. Das Wort *nikî-wîcihâw* („Ich habe ihm/ihr geholfen") kodiert Person, Numerus, Belebtheit, Richtung und Tempus in einer einzigen flektierten Form. Eine N-Gramm-Metrik sieht ein Token; ein morphologischer Analysator sieht sechs Morpheme. Oberflächenmetriken können nicht zwischen einem korrekt flektierten Verb und einer plausibel aussehenden Halluzination unterscheiden, die die Belebtheitskongruenz verletzt — beide sind einzelne Tokens ähnlicher Zeichenlänge.

**Freie Wortstellung.** Cree hat eine pragmatisch freie Wortstellung (Wolfart, 1973, §3.2). Die Sätze *atim niwâpamâw* und *niwâpamâw atim* („Ich sehe den Hund") sind beide grammatisch korrekt — die Wahl ist pragmatischer, nicht syntaktischer Natur. Jede Metrik, die eine Abweichung der Wortstellung von einer Referenzübersetzung bestraft, erzeugt bei jedem solchen Paar falsch-negative Ergebnisse.

**Morphologische Äquivalenz.** Cree verfügt über mehrere gültige orthografische Darstellungen desselben Wortes (SRO-Varianten, progressive/Vokallängen-Alternationen). Die Übersetzungen *nikî-atoskân* und *nikî-atoskên* können dialektal äquivalent sein. Eine String-Match-Metrik sieht zwei verschiedene Zeichenketten; ein Linguist sieht dasselbe Wort.

**Fehlende Trainingsdaten.** Neuronale Metriken wie COMET benötigen Trainingsdaten — menschliche Qualitätsurteile zu Übersetzungspaaren —, um zu lernen, was „gut" bedeutet. Für Cree existieren diese Daten nicht. COMET kann zwar weiterhin Werte erzeugen (es greift auf seinen mehrsprachigen Encoder zurück), doch diese Werte wurden nie gegen das Qualitätsurteil eines Cree-sprechenden Menschen validiert. Es handelt sich um Extrapolationen aus europäischen Sprachmustern, die auf eine Sprache mit grundlegend anderer Struktur angewendet werden.

### 1.2 Das Paradoxon der Evaluation ressourcenarmer Sprachen

Daraus ergibt sich ein Paradoxon:

> Die Sprachen, die am dringendsten maschinelle Übersetzung benötigen, sind genau jene Sprachen, bei denen die besten Evaluationswerkzeuge am wenigsten zuverlässig sind.

Wenn wir die Übersetzungsqualität für diese Sprachen nicht messen können, können wir Folgendes nicht tun:
- Übersetzungsmethoden objektiv vergleichen
- Erkennen, wann ein Modell plausibel aussehenden Unsinn halluziniert
- Verfolgen, ob das Forschungsfeld Fortschritte macht
- Anbieter von MT-Systemen für Qualitätsansprüche zur Rechenschaft ziehen

Das Ergebnis ist ein **kaskadierendes Versagen**: keine Trainingsdaten → keine Encoder-Abdeckung → keine validierte Evaluation → kein messbarer Fortschritt → kein Investitionsanreiz → keine Trainingsdaten.

Um diesen Kreislauf zu durchbrechen, sind Evaluationsmethoden erforderlich, die nicht von den Ressourcen abhängen, die wir nicht haben (Trainingsdaten, menschliche Urteile in großem Umfang, feinabgestimmte neuronale Encoder). Es sind Methoden erforderlich, die die Ressourcen nutzen, die wir *haben*.

### 1.3 Was wir haben

Für viele ressourcenarme Sprachen haben jahrzehntelange linguistische Feldforschungen Werkzeuge und Ressourcen hervorgebracht, die die MT-Evaluationsgemeinschaft weitgehend ignoriert hat:

| Ressource | Was sie bereitstellt | Abdeckung |
|----------|-----------------|----------|
| **Endliche Transduktoren (FSTs)** | Vollständige morphologische Analyse — jede gültige Wortform in der Sprache | ~100+ Sprachen über GiellaLT, Apertium, NRC |
| **Zweisprachige Wörterbücher** | Zuordnungen von Lemmata zu Glossen | Hunderte von Sprachen (Wolvengrey 2001 für Cree: etwa 18.000–22.000 Einträge, abhängig von Ausgabe und Zählmethode) |
| **Morphologische Analysatoren** | Part-of-Speech-Tagging, Lemmatisierung, Generierung von Flexionsparadigmen | Dutzende von Sprachen mit unterschiedlicher Abdeckung |
| **Deskriptive Grammatiken** | Regeln für Kongruenz, Wortstellung, Belebtheit, Obviation | Verfügbar für die meisten dokumentierten Sprachen |
| **Linguistische Expertise** | Community-Mitglieder, die korrekte von inkorrekten Übersetzungen unterscheiden können | Existiert per Definition für jede lebende Sprache |

Diese Ressourcen wurden über Jahrzehnte von Computerlinguisten, Feldlinguisten und Sprachgemeinschaften aufgebaut — oft ohne Verbindung zur MT-Evaluationsgemeinschaft. Der FST für Plains Cree wurde an der University of Alberta von Antti Arppe und Kollegen als Werkzeug zur Sprachdokumentation entwickelt, nicht als Evaluationsmetrik. Die GiellaLT-Infrastruktur an der UiT wurde für die Sprachtechnologie von Minderheitensprachen entwickelt, nicht für WMT-Shared-Tasks.

**Microeval ist die Praxis, diese vorhandenen Ressourcen in Evaluationsmetriken umzuwandeln.**

---

## Teil 2: Die Microeval-Methodik

### 2.1 Definition

**Microeval** ist eine systematische Methodik zur Entwicklung von Evaluationsmetriken für die maschinelle Übersetzung, die mithilfe sprachspezifischer linguistischer Werkzeuge und Ressourcen auf eine bestimmte Sprache zugeschnitten sind. Eine Microeval-Suite:

1. **Kodiert sprachspezifisches Wissen**, das von sprachunabhängigen Metriken nicht erfasst werden kann
2. **Nutzt vorhandene linguistische Infrastruktur** (FSTs, Wörterbücher, Grammatiken), anstatt neue Trainingsdaten zu erfordern
3. **Erzeugt deterministische, interpretierbare Werte** — jeder Wert lässt sich auf ein bestimmtes linguistisches Urteil zurückführen
4. **Wird von Linguisten entworfen**, nicht nur von Ingenieuren — die Variantenklassen, Äquivalenzregeln und Validierungslogik spiegeln linguistische Expertise wider
5. **Ergänzt universelle Metriken, statt sie zu ersetzen** — microeval füllt die Lücken, nicht den gesamten Raum

### 2.2 Die dreischichtige Architektur

Eine vollständige Microeval-Suite arbeitet auf drei Analyseebenen, von der Oberfläche bis zur Semantik:

| Schicht | Beantwortete Frage | Verwendetes Werkzeug | LYSS-Komponente |
|-------|------------------|-----------|----------------|
| **Morphologische Gültigkeit** | „Ist jedes Wort eine gültige Form in dieser Sprache?" | Finite-State-Transduktor (FST) | LYSS-fst |
| **Linguistische Äquivalenz** | „Ist diese Übersetzung eine akzeptable Variante der Referenz?" | Deterministischer Linter mit von Linguisten kuratierten Variantenklassen | LYSS-eq |
| **Semantische Treue** | „Bewahrt diese Übersetzung die Bedeutung des Ausgangstextes?" | FST-Lemmatisierung + Wörterbuch-Glossen + Überschneidung von Inhaltswörtern | LYSS-sem |

Diese Schichten sind **kumulativ, nicht alternativ**. Eine Übersetzung muss alle drei bestehen, um als vollständig korrekt zu gelten. Ein halluziniertes Wort scheitert in Schicht 1. Eine dialektale Variante, die korrekt ist, aber von der Referenz abweicht, wird in Schicht 2 erfasst. Eine Übersetzung, die gültige Wörter in gültiger Reihenfolge verwendet, aber etwas anderes bedeutet, wird in Schicht 3 erfasst.

### 2.3 So entwickeln Sie eine Microeval-Suite für eine neue Sprache

Dieser Abschnitt beschreibt den Schritt-für-Schritt-Prozess. Wir verwenden Plains Cree (CRK) als durchgearbeitetes Beispiel und verallgemeinern, wo möglich.

#### Schritt 1: Verfügbare Ressourcen bewerten

Bevor Sie etwas entwickeln, inventarisieren Sie das, was vorhanden ist:

| Ressource | Erforderlich für | Wie sie zu finden ist | Mindestqualität |
|----------|-------------|----------------|-----------------|
| FST | Schicht 1 (LYSS-fst) | GiellaLT-, Apertium-, NRC-Kataloge prüfen | Muss >90 % der gültigen Wortformen in einem Testkorpus akzeptieren |
| Zweisprachiges Wörterbuch | Schicht 3 (LYSS-sem) | Sprachdokumentationsprojekte, Wiktionary, Gemeinschaftsressourcen prüfen | >5.000 Einträge mit Lemma-zu-Glosse-Zuordnungen |
| Deskriptive Grammatik | Schicht 2 (LYSS-eq) | Veröffentlichte Grammatiken, Dissertationen, von der Gemeinschaft verfasste Referenzwerke | Muss die zentralen morphologischen Paradigmen dokumentieren |
| Zweisprachige Sprecher | Alle Schichten (Validierung) | Gemeinschaftskontakte, universitäre Sprachprogramme | Mindestens 3 Sprecher für Validierungsexperimente |

**Falls kein FST existiert:** Überspringen Sie Schicht 1. Die Suite arbeitet nur auf den Schichten 2–3 oder greift auf universelle Metriken zurück (Profil B in der LYSS-Bewertung). Dies ist nicht ideal, aber besser als nichts.

**Falls kein Wörterbuch existiert:** Überspringen Sie Schicht 3 oder verwenden Sie eine reduzierte Version mit dem verfügbaren Vokabular. Ein Wörterbuch mit 500 Einträgen ist weniger nützlich als eines mit 18.000 Einträgen, liefert aber dennoch ein Signal.

#### Schritt 2: Das morphologische Gültigkeitstor konfigurieren (LYSS-fst)

Falls ein FST verfügbar ist:

1. **Installieren Sie den FST** mithilfe der Analysator-Binärdatei der Sprache (HFST `.hfstol`-Format für GiellaLT)
2. **Führen Sie einen Abdeckungstest** an einem repräsentativen Korpus durch: Wie viel Prozent der Tokens erkennt der FST?
3. **Erstellen Sie eine Erlaubnisliste** für erwartete FST-Lücken: Lehnwörter, Eigennamen, Neologismen, Abkürzungen
4. **Berechnen Sie die Baseline-Falschablehnungsrate** — den Prozentsatz gültiger Wörter, die der FST fälschlicherweise ablehnt
5. **Legen Sie den Bewertungsschwellenwert fest** — unterhalb welcher FST-Akzeptanzrate kennzeichnen wir eine Übersetzung als morphologisch verdächtig?

Die zentrale Metrik ist `fst_acceptance_rate`: der Anteil der Ausgabewörter, die der FST erkennt. Eine Rate von 0,85 bedeutet, dass 85 % der Wörter eine gültige Cree-Morphologie aufweisen; 15 % sind entweder ungültig, Lehnwörter oder FST-Abdeckungslücken.

**Kritische Entwurfsentscheidung:** Das Problem der Falschablehnung. Ein FST, der auf formaler Literatursprache trainiert wurde, lehnt gültige umgangssprachliche Formen ab. Ein FST mit unvollständiger Paradigmenabdeckung lehnt gültige, aber seltene Flexionen ab. Die Erlaubnisliste mildert dies ab, kann es aber nicht beseitigen. *Aus diesem Grund ist LYSS-fst allein nicht ausreichend* — es muss mit den Schichten 2 und 3 kombiniert werden.

#### Schritt 3: Die Variantenklassen entwerfen (LYSS-eq)

Dies ist der linguistisch anspruchsvollste Schritt, und er kann nicht automatisiert werden. Ein Linguist mit Expertise in der Zielsprache muss Folgendes identifizieren:

**Welche Arten von Unterschieden zwischen einer Kandidatenübersetzung und einer Referenzübersetzung sollten als „akzeptabel" gelten?**

Für Plains Cree haben wir sechs Variantenklassen identifiziert:

| Variantenklasse | Linguistische Grundlage | Beispiel |
|--------------|-----------------|----------|
| `WORD_ORDER` | Pragmatisch freie Wortstellung (Wolfart 1973 §3.2) | *atim niwâpamâw* ≡ *niwâpamâw atim* |
| `ORTHOGRAPHIC` | SRO-Schreibvarianten, Vokallängen-Alternation | *nikî-atoskân* ≡ *nikî-atoskên* |
| `OPTIONAL_PARTICLE` | Grammatisch optionale Diskurspartikeln | *êkwa nikî-atoskân* ≡ *nikî-atoskân* |
| `LEMMA_SYNONYM` | Wörterbuchbelegte Synonyme | *wâpamêw* ≡ *kanawâpamêw* (für „sieht") |
| `PROGRESSIVE_AMBIGUITY` | Mehrere gültige progressive Formen | *ê-atoskêt* ≡ *atoskêw* |
| `INCLUSIVE_EXCLUSIVE` | Erste-Person-Plural-Unterscheidung, die im Englischen nicht existiert | *ki-wîcihânaw* ≡ *ni-wîcihânân* |

**Diese Klassen sind sprachspezifisch.** Eine andere Sprache hätte andere Klassen — Türkisch könnte Klassen für Vokalharmonie-Varianten haben, Japanisch für Alternationen im Höflichkeitsregister, Inuktitut für dialektale Suffixvariation.

**Der Entwurfsprozess:**
1. Sammeln Sie 100+ Übersetzungspaare (Ausgangstext + Referenz + Kandidat)
2. Identifizieren Sie alle Fälle, in denen der Kandidat von der Referenz abweicht, ein zweisprachiger Sprecher ihn jedoch als korrekt erachten würde
3. Kategorisieren Sie die Unterschiede — suchen Sie nach Mustern, die über mehrere Paare hinweg wiederkehren
4. Formalisieren Sie jedes Muster als deterministische Regel (Regex, Mengenoperation oder FST-Transduktion)
5. Validieren Sie mit 3+ zweisprachigen Sprechern: Sind sie sich für jede Variantenklasse einig, dass sie akzeptabel ist?
6. Iterieren Sie: Manche Klassen müssen verfeinert werden, andere müssen aufgeteilt oder zusammengeführt werden

#### Schritt 4: Den semantischen Validator entwickeln (LYSS-sem)

Der semantische Validator beantwortet die Frage: „Bedeutet diese Übersetzung dasselbe wie die Referenz?" Er arbeitet in vier Phasen:

1. **Lemmatisieren Sie beide Übersetzungen** mithilfe des FST (Wortstämme extrahieren, Flexion entfernen)
2. **Ordnen Sie Lemmata Glossen zu** mithilfe des zweisprachigen Wörterbuchs (Cree-Lemma → englische Glosse)
3. **Vergleichen Sie die Glossenmengen** — überschneiden sich die Glossen des Kandidaten mit denen der Referenz?
4. **Prüfen Sie strukturelle Einschränkungen** — verletzt der Kandidat bekannte Grammatikregeln (Belebtheitskongruenz, Verbform, Personenmarkierung)?

Der Validator erzeugt Urteile: `EXACT_MATCH`, `VALID`, `GRAMMAR_ISSUES`, `PARTIAL`, `INCOMPLETE`, `WRONG`, `NO_OUTPUT`. Jedes Urteil ist deterministisch und nachvollziehbar — Sie können erklären, *warum* eine Übersetzung ein bestimmtes Urteil erhalten hat, indem Sie untersuchen, welche Phase es gekennzeichnet hat.

**Minimal funktionsfähige Version:** Wenn Sie über einen FST und ein Wörterbuch verfügen, können Sie einen vereinfachten semantischen Validator entwickeln, der nur die Lemma-Glosse-Überschneidung durchführt (Phasen 1–3). Phase 4 (Grammatikprüfung) erfordert mehr linguistisches Engineering, bietet aber für morphologisch komplexe Sprachen einen erheblichen Mehrwert.

#### Schritt 5: Integration in das Evaluations-Harness

Die Microeval-Suite wird als eine Reihe von Metrik-Plugins gebündelt, die in das Evaluations-Harness eingebunden werden:

1. Jede Metrik implementiert das `MetricPlugin`-Protokoll: `compute(entry) → dict`, `aggregate(results) → dict`
2. Das Plugin-Erkennungssystem erkennt sprachspezifische Plugins automatisch anhand des Zielsprachencodes
3. Die Werte werden der zusammengesetzten Bewertungsfunktion (composite scoring function) zugeführt, die Microeval-Metriken mit universellen Metriken unter Verwendung sprachspezifischer Gewichtungsprofile kombiniert

### 2.4 Minimal funktionsfähige Microeval

Nicht jede Sprache benötigt sofort alle drei Schichten. Hier die minimal nützliche Konfiguration auf jeder Ebene:

| Konfiguration | Was Sie benötigen | Was Sie erhalten | Zeitaufwand für die Entwicklung |
|--------------|--------------|-------------|---------------|
| **Nur LYSS-fst** | FST + Erlaubnisliste | Morphologisches Gültigkeitstor — erkennt halluzinierte Wortformen | 1–2 Wochen |
| **LYSS-fst + LYSS-eq** | FST + 3–6 Variantenklassen + Linguistenzeit | Gültigkeitstor + Äquivalenzerkennung — reduziert falsch-negative Ergebnisse | 4–8 Wochen |
| **Vollständiges LYSS** | FST + Variantenklassen + Wörterbuch + semantischer Validator | Vollständige sprachspezifische Evaluation | 8–16 Wochen |

Die Empfehlung lautet, mit LYSS-fst zu beginnen (schnell, hohe Wirkung, erfordert nur einen FST, der wahrscheinlich bereits existiert) und schrittweise weitere Schichten hinzuzufügen.

---

## Teil 3: Das Problem der Falschablehnung

### 3.1 Was es ist

Jede Microeval-Metrik weist eine Falschablehnungsrate auf: die Wahrscheinlichkeit, dass eine korrekte Übersetzung als inkorrekt bewertet wird.

Bei LYSS-fst tritt eine Falschablehnung auf, wenn:
- Der FST eine gültige Wortform nicht abdeckt (unvollständige Paradigmentabellen)
- Die Übersetzung ein Lehnwort enthält, das der FST nicht erkennt
- Die Übersetzung einen Neologismus oder Markennamen verwendet
- Die Übersetzung eine dialektale Form verwendet, die nicht im Lexikon des FST enthalten ist
- Die Übersetzung einen Eigennamen enthält, der nicht in der Erlaubnisliste steht

Bei LYSS-eq tritt eine Falschablehnung auf, wenn:
- Die Übersetzung eine akzeptable Variante verwendet, die von keiner Variantenklasse abgedeckt wird
- Eine neue Variantenklasse benötigt, aber noch nicht identifiziert wurde

Bei LYSS-sem tritt eine Falschablehnung auf, wenn:
- Ein Lemma nicht im Wörterbuch enthalten ist
- Eine gültige Übersetzung eine Paraphrasierungsstrategie verwendet, die nicht auf die Lemmamenge der Referenz abgebildet wird

### 3.2 Warum sie schwerer wiegt als Falschannahme

In der Evaluation ist eine Falschablehnung schlimmer als eine Falschannahme. Eine Falschablehnung bedeutet, dass eine *korrekte* Übersetzung als *falsch* bewertet wird — dies entmutigt Entwickler, die gute Arbeit leisten, und untergräbt das Vertrauen in die Metrik. Eine Falschannahme bedeutet, dass eine *falsche* Übersetzung als *korrekt* bewertet wird — das ist schlecht, wird aber von anderen Metriken im Verbund erfasst.

Falschablehnungen verstärken sich gegenseitig: Wenn LYSS-fst eine Falschablehnungsrate von 10 % pro Wort aufweist und ein Satz 5 Wörter umfasst, beträgt die Wahrscheinlichkeit, dass mindestens ein Wort fälschlicherweise abgelehnt wird, ~41 %. Dies bedeutet, dass bei fast der Hälfte aller Sätze die FST-Akzeptanzrate um mindestens ein Wort verringert wird — nicht weil die Übersetzung falsch ist, sondern weil der FST unvollständig ist.

### 3.3 Strategien zur Abmilderung

| Strategie | Mechanismus | Wirksamkeit |
|----------|----------|---------------|
| **Erlaubnislisten** | Bekannte Lehnwörter, Eigennamen und Abkürzungen auf eine Whitelist setzen | Hoch bei bekannten Lücken, null bei unbekannten Lücken |
| **Fuzzy-Matching** | Wörter innerhalb der Editierdistanz 1 zu einer bekannten Form akzeptieren | Erfasst Tippfehler und geringfügige orthografische Varianten |
| **Konfidenzbewertung** | FST-Ergebnisse nach Paradigmenvollständigkeit gewichten | Erfordert Metadaten zur Paradigmenabdeckung |
| **Kategoriespezifische Schwellenwerte** | Unterschiedliche Schwellenwerte für verschiedene Domänen (medizinische können mehr Lehnwörter enthalten) | Erfordert domänenmarkierte Korpora |
| **Von der Gemeinschaft gepflegte Erlaubnislisten** | Sprecher reichen Wörter ein, die der FST akzeptieren sollte | Langfristig am nachhaltigsten; erfordert Infrastruktur zur Einbindung der Gemeinschaft |

### 3.4 Die Rate messen

Die Falschablehnungsrate muss empirisch an einem repräsentativen Korpus gemessen werden:

1. Nehmen Sie ein Korpus von 500+ bekanntermaßen gültigen Cree-Sätzen (Lehrbücher, geprüfte Übersetzungen)
2. Lassen Sie jedes Wort durch den FST laufen
3. Lassen Sie für jedes vom FST abgelehnte Wort einen zweisprachigen Sprecher es klassifizieren: gültiges Wort, das der FST übersehen hat, oder tatsächlich ungültig?
4. `false_rejection_rate = valid_but_rejected / total_valid_words`

Diese Messung ist eines der erforderlichen Validierungsexperimente (Scoring-Spezifikation §1.6).

---

## Teil 4: Wer entscheidet, was „korrekt" ist?

### 4.1 Die politische Dimension der Evaluation

Evaluationsmetriken sind keine neutralen Instrumente. Jede Metrik bettet eine Theorie darüber ein, was „korrekte Übersetzung" bedeutet, und diese Theorie hat Konsequenzen:

- Ein FST, der aus literarischem Cree entwickelt wurde, bestraft umgangssprachliches Cree. Dies ist eine *politische* Entscheidung darüber, welches Register der Sprache wertgeschätzt wird.
- Eine Variantenklasse, die eine dialektale Form akzeptiert, eine andere jedoch nicht, standardisiert die Sprache implizit. Standardisierung ist ein politischer Akt mit einer langen kolonialen Geschichte.
- Ein semantischer Validator, der eine exakte Lemmaüberschneidung verlangt, bestraft kreative Paraphrasierung — eine wichtige Übersetzungsstrategie, die geschickte Übersetzer bewusst einsetzen.

Microeval macht diese Entscheidungen *explizit*. Jede Variantenklasse, jeder Erlaubnislisteneintrag, jede semantische Äquivalenzregel ist eine diskrete, dokumentierte, überprüfbare Entscheidung. Dies ist ein Merkmal, kein Fehler: Es bedeutet, dass die Gemeinschaft die Regeln, die bestimmen, wie ihre Sprache evaluiert wird, prüfen, infrage stellen und ändern kann.

### 4.2 Gemeinschaftliche Governance der Evaluationsregeln

Speziell für indigene Sprachen müssen Evaluationsentscheidungen von der Sprachgemeinschaft gesteuert werden, nicht von externen Forschern oder Ingenieuren. Dies ist nicht nur ein ethisches Prinzip (obwohl es das ist) — es ist eine Korrektheitsanforderung. Nur fließend sprechende Personen können bestimmen, ob eine Variante akzeptabel ist.

Das Governance-Modell:

1. **Forscher schlagen** Variantenklassen, Erlaubnislisteneinträge und semantische Regeln auf der Grundlage linguistischer Analyse vor
2. **Sprecher prüfen** jeden Vorschlag und genehmigen, lehnen ihn ab oder ändern ihn
3. **Genehmigte Regeln** werden mit Sprecherzuschreibung in die Codebasis übernommen
4. **Strittige Regeln** werden zur gemeinschaftlichen Diskussion gekennzeichnet — sie werden bis zur Klärung von der Bewertung ausgeschlossen
5. **Die Gemeinschaft kann** jede Regel jederzeit widerrufen, indem sie sie aus der genehmigten Menge entfernt

Dieses Modell erfordert Infrastruktur (das Evaluations-Harness, Versionskontrolle, das Sprechervalidierungsprotokoll) und Beziehungen (Vertrauen zwischen Forschern und Gemeinschaftsmitgliedern). Der Aufbau dieser Infrastruktur ist Teil der Microeval-Methodik.

### 4.3 Dialektale Variation

Die schwierigste Governance-Frage: Wenn zwei Dialekte einer Sprache hinsichtlich einer Form uneinig sind, welcher ist „korrekt"?

Microevals Antwort: **Beide sind korrekt.** Dialektale Varianten werden als zusätzliche Variantenklassen mit Dialekt-Tags dargestellt. Der zusammengesetzte Wert kann je nach dem, was die Evaluation messen soll, pro Dialekt oder dialektübergreifend berechnet werden.

Dies erfordert, dass das Korpus dialektmarkiert und die Variantenklassen dialektbewusst sind. Es erfordert außerdem, dass Sprecher aus mehreren Dialekten an der Validierung teilnehmen. Das Dokument zur Corpus Partnership Strategy behandelt diese Anforderungen.

---

## Teil 5: Verhältnis zum Stand der Technik

### 5.1 Was Microeval NICHT ist

| Aussage, die wir NICHT treffen | Warum nicht |
|------------------------|---------|
| „Universelle Metriken sind nutzlos" | Sie liefern wesentliche Baselines und sprachübergreifende Vergleichbarkeit. Microeval ergänzt, statt zu ersetzen. |
| „Neuronale Metriken können für ressourcenarme Sprachen nicht funktionieren" | Sie können es — mit Feinabstimmung auf sprachspezifischen Daten. Doch diese Daten existieren selten. Microeval funktioniert *jetzt*. |
| „FST-basierte Evaluation ist neuartig" | FSTs werden seit Jahrzehnten in der NLP eingesetzt. Das Neuartige liegt in ihrem systematischen Einsatz als MT-Evaluationsmetriken. |
| „LYSS ist besser als COMET" | Das wissen wir nicht — wir haben die Korrelationsstudie mit menschlichen Urteilen nicht durchgeführt. Wir glauben, dass LYSS für polysynthetische Sprachen *informativer* ist, können aber nicht behaupten, dass es *genauer* ist, solange wir keine Belege haben. |

### 5.2 Engster Stand der Technik

| Arbeit | Verhältnis zu Microeval |
|------|--------------------------|
| **MorphEval** (Sánchez-Cartagena & Toral, 2024) | Kontrastive Tests für morphologische Phänomene — komplementär. MorphEval testet, ob Systeme Morphologie *erzeugen können*; LYSS testet, ob sie es *getan haben*. |
| **CheckList** (Ribeiro et al., 2020) | Methodik für Verhaltenstests in der NLP — analoges Paradigma. CheckList ist eine Methodik; Microeval ist ebenfalls eine Methodik, jedoch auf Evaluation statt auf Tests angewendet. |
| **HyTER** (Dreyer & Marcu, 2012) | Bedeutungsäquivalente Gitter — die engste konzeptionelle Parallele zu LYSS-eq. HyTER zählt Paraphrasen auf; LYSS-eq zählt morphologische Varianten auf. HyTER erfordert eine manuelle Gitterkonstruktion pro Satz; LYSS-eq-Regeln gelten korpusweit. |
| **Apertium-Abdeckung** | Verwendet FST-Abdeckung als Proxy für die Qualität der MT-Ausgabe — nimmt LYSS-fst unmittelbar vorweg. Nicht als Metrik formalisiert oder in ein Bewertungsrahmenwerk integriert. |
| **FUSE** (AmericasNLP 2025) | Merkmalsbasierte Evaluation für indigene amerikanische Sprachen — dem Geiste nach am ähnlichsten. FUSE schlägt linguistische Merkmale als Evaluationsdimensionen vor; LYSS implementiert spezifische Merkmale für spezifische Sprachen. Ein direkter Vergleich ist erforderlich. |
| **AfriCOMET** (Wang & Adelani, 2024) | Feinabgestimmtes COMET für afrikanische Sprachen — belegt, dass neuronale Metriken angepasst werden *können*. Microeval ist das regelbasierte Pendant für Sprachen, für die keine Feinabstimmungsdaten existieren. |

### 5.3 Die zentrale Unterscheidung

Der gesamte Stand der Technik in der morphologiebewussten Evaluation tut entweder:
1. **Schlägt ein allgemeines Rahmenwerk vor**, ohne es für bestimmte Sprachen zu implementieren (FUSE, CheckList)
2. **Implementiert für ressourcenreiche Sprachen**, für die Trainingsdaten existieren (MorphEval konzentriert sich auf europäische Paare)
3. **Stimmt neuronale Metriken fein ab**, was die Daten erfordert, die wir nicht haben (AfriCOMET)

Microeval ist speziell für den Fall konzipiert, in dem:
- Linguistische Werkzeuge (FSTs, Wörterbücher) existieren
- Trainingsdaten für die Feinabstimmung neuronaler Metriken nicht existieren
- Die morphologische Komplexität der Sprache Oberflächenmetriken überfordert
- Die Evaluation *jetzt* einsatzfähig sein muss, nicht erst nach einer Datenerhebungskampagne

---

## Teil 6: Offene Fragen und ehrliche Einschränkungen

### 6.1 Ungeklärte Fragen

1. **Korrelieren LYSS-Metriken mit menschlichen Qualitätsurteilen?** Das wissen wir nicht. Die erforderliche Korrelationsstudie mit menschlichen Urteilen (200+ Satzpaare, 3+ zweisprachige Sprecher) wurde nicht durchgeführt. Solange dies nicht geschehen ist, sind LYSS-Werte technische Schätzungen, keine validierten Qualitätsmessungen.

2. **Wie verhalten sich LYSS-Metriken, wenn sich Sprachen verändern?** Lebende Sprachen entwickeln sich weiter — neue Lehnwörter, sich verschiebende Dialekte, aufkommende Neologismen. FSTs und Variantenklassen müssen gepflegt werden. Wie hoch ist der Wartungsaufwand? Das wissen wir nicht.

3. **Welche FST-Mindestqualität ist für ein nützliches LYSS-fst erforderlich?** Wenn ein FST nur 60 % des Lexikons abdeckt, ist LYSS-fst dann noch nützlich, oder überwältigt das Rauschen das Signal? Wir benötigen empirische Belege.

4. **Kann Microeval bei nicht-morphologischen Herausforderungen funktionieren?** Sprachen mit tonalen Unterscheidungen, Klicklauten oder logografischen Schriften stellen Evaluationsherausforderungen dar, die FSTs nicht adressieren. Microeval ist möglicherweise nicht anwendbar — oder erfordert andere Werkzeuge.

5. **Wie gehen wir mit dem Kaltstartproblem um?** Die Entwicklung einer Microeval-Suite erfordert linguistische Expertise. Für Sprachen ohne aktive computerlinguistische Gemeinschaft: Wer leistet die Arbeit?

### 6.2 Ehrliche Einschränkungen von LYSS

| Einschränkung | Schweregrad | Abmilderung |
|-----------|----------|-----------|
| Keine Daten zur Korrelation mit menschlichen Urteilen | 🔴 Kritisch | Erforderliches Validierungsexperiment Nr. 1 |
| FST-Falschablehnungsrate nicht gemessen | 🔴 Kritisch | Erforderliches Validierungsexperiment Nr. 2 |
| Nur für eine Sprache implementiert (CRK) | 🟡 Erheblich | Portierung auf eine zweite Sprache (Nordsamisch) geplant |
| Variantenklassen möglicherweise unvollständig | 🟡 Erheblich | Gemeinschaftliche Überprüfung + laufende Ergänzung |
| Semantischer Validator erfordert spaCy | 🟡 Erheblich | Optionale Abhängigkeit; sanfte Degradation |
| Wörterbuchabdeckung beeinflusst LYSS-sem-Qualität | 🟡 Erheblich | Mindestanforderungen an die Wörterbuchgröße dokumentiert |
| Kann Flüssigkeit oder Natürlichkeit nicht erkennen | 🟡 Erheblich | Erfordert menschliche Evaluation oder neuronale Metriken |
| Erfordert linguistische Expertise zur Erweiterung | 🟡 Erheblich | Methodikdokumentation (dieses Papier) senkt die Hürde |

### 6.3 Der Weg nach vorn

> *"Wenn wir uns nur auf das konzentrieren, was verallgemeinerbar ist, werden wir zwangsläufig vergessen, wo es das nicht ist — und diese Sprachen mit all ihrem Wissen und ihrer Weisheit verlieren."*

Microeval ist keine Lösung für das Evaluationsproblem. Es ist eine Praxis — eine Disziplin der Aufmerksamkeit für das, was jede Sprache unterschiedlich macht, und der Kodierung dieser Aufmerksamkeit in funktionierendem Code. Diese Praxis ist mühsam, sprachspezifisch und niemals abgeschlossen. Doch sie bringt etwas hervor, was das Paradigma der universellen Metriken nicht kann: eine Evaluation, die die Sprache spricht, die sie evaluiert.

---

## Anhang A: Wichtige Arbeiten {#appendix-a-key-papers}

| Veröffentlichung | Jahr | Beitrag | Relevanz |
|-------|------|-------------|----------|
| Papineni et al., „BLEU" | 2002 | Grundlegende N-Gramm-Metrik | Universelle Baseline-Metrik |
| Popović, „chrF++" | 2017 | Zeichen-N-Gramm-Metrik | Beste Oberflächenmetrik für morphologisch reiche Sprachen |
| Rei et al., „COMET" | 2020 | Neuronales Evaluationsrahmenwerk | Universelle neuronale Metrik |
| Dreyer & Marcu, „HyTER" | 2012 | Bedeutungsäquivalente Semantik | Konzeptioneller Vorläufer von LYSS-eq |
| Burlot & Yvon, „MorphEval" | 2017 | Morphologische Evaluation | Kontrastive morphologische Tests |
| Ribeiro et al., „CheckList" | 2020 | Verhaltenstests für NLP | Methodisches Paradigma |
| Sánchez-Cartagena & Toral, „MorphEval" | 2024 | Evaluation morphologischer Fähigkeiten | Engste diagnostische Ergänzung |
| Wang & Adelani, „AfriCOMET" | 2024 | Angepasste neuronale Metrik für afrikanische Sprachen | Belegt die Notwendigkeit sprachspezifischer Evaluation |
| Lindén et al., „HFST" | 2011 | Rahmenwerk für Finite-State-Morphologie | Infrastruktur für LYSS-fst |
| Wolfart, „Plains Cree" | 1973 | Maßgebliche Cree-Grammatik | Linguistische Autorität für CRK-Microeval |
| Wolvengrey, „Cree: Words" | 2001 | Plains-Cree-Wörterbuch | Ressource, die LYSS-sem zugrunde liegt |
| Carroll et al., „CARE Principles" | 2020 | Governance indigener Daten | Governance-Rahmenwerk für Microeval |

## Anhang B: Zusammenfassung der LYSS-Komponenten

| Komponente | Metrikname | Was sie misst | Erforderliche Ressourcen | Implementierungsstatus |
|-----------|------------|------------------|-------------------|-----------------------|
| LYSS-fst | `fst_acceptance_rate` | Morphologische Gültigkeit der Ausgabewörter | GiellaLT FST | ✅ Einsatzfähig (CRK) |
| LYSS-eq | `equivalent_match_rate` | Erkennung akzeptabler Varianten | Von Linguisten kuratierte Variantenklassen | ✅ Einsatzfähig (CRK, 6 Klassen) |
| LYSS-sem | `semantic_score` | Bedeutungserhaltung über Lemma-Glosse-Überschneidung | FST + zweisprachiges Wörterbuch + spaCy | ✅ Einsatzfähig (CRK, erfordert spaCy) |

## Anhang C: Sprachen mit GiellaLT-FST-Abdeckung

Für die folgenden Sprachen sind FSTs über GiellaLT verfügbar, und sie sind Kandidaten für eine LYSS-fst-Integration:

<!-- This list should be populated with actual GiellaLT coverage data. -->
<!-- See: https://github.com/giellalt -->

| Sprache | ISO 639-3 | FST-Reifegrad | LYSS-fst-Machbarkeit |
|----------|-----------|-------------|---------------------|
| Plains Cree | crk | Produktion | ✅ Einsatzfähig |
| Nordsamisch | sme | Produktion | 🟡 Geplant (erste Portierung) |
| Südsamisch | sma | Produktion | 🟡 Kandidat |
| Lulesamisch | smj | Produktion | 🟡 Kandidat |
| Inarisamisch | smn | Produktion | 🟡 Kandidat |
| Skoltsamisch | sms | Produktion | 🟡 Kandidat |
| Finnisch | fin | Produktion | 🟡 Kandidat |
| Inuktitut | iku | Beta | 🟡 Bewertung erforderlich |
| Baskisch | eus | Beta | 🟡 Bewertung erforderlich |
| Walisisch | cym | Beta | 🟡 Bewertung erforderlich |
