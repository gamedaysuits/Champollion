---
sidebar_position: 8
title: "Sprecher:innen-Validierungsprotokoll"
slug: '/network/specifications/speaker-validation'
---

# Protokoll zur Validierung durch Sprecher

> **Zweck.** Dieses Dokument definiert genau, was wir von zweisprachigen Cree-Englisch-Sprechenden benötigen, um die LYSS-Evaluierungsmetriken zu validieren. Ohne diese Validierung sind unsere automatisierten Bewertungen lediglich technische Schätzungen und keine nachgewiesenen Qualitätsmessungen. Dies ist die wichtigste Lücke im Projekt.
>
> **Zielgruppe.** Community-Partner, potenzielle Kooperationspartner, Gutachter von Förderanträgen und das Projektteam.


---

## 1. Warum wir Sprecher benötigen

Das LYSS-Evaluationsframework (Linguistically-informed Yield & Structural Scoring) berechnet automatisierte Qualitätsbewertungen für Übersetzungen vom Englischen ins Plains Cree. Es verwendet drei zentrale Signale:

- **LYSS-fst**: Enthält die Ausgabe gültige Cree-Wörter? (geprüft durch den GiellaLT Finite-State-Transducer)
- **LYSS-eq**: Ist die Ausgabe eine akzeptable Variante der Referenzübersetzung? (geprüft durch die Äquivalenzklassen des Linters)
- **LYSS-sem**: Bewahrt die Ausgabe die Bedeutung des Quelltextes? (geprüft durch den semantischen Validator)

Diese Metriken erzeugen Zahlen. **Wir wissen nicht, ob diese Zahlen etwas bedeuten.** Der FST kann gültige Wörter ablehnen, die er nicht erkennt (Lehnwörter, Neologismen, Eigennamen). Der Linter kann gültige Äquivalenzen übersehen oder ungültige akzeptieren. Der semantische Validator kann die Bedeutung falsch einschätzen. Solange zweisprachige Sprecher uns nicht mitteilen, ob unsere automatisierten Bewertungen ihrer menschlichen Beurteilung der Übersetzungsqualität entsprechen, raten wir nur.

Jede bedeutende MT-Evaluationsmetrik (BLEU, COMET, chrF++) wurde validiert, indem automatisierte Bewertungen mit Tausenden menschlicher Qualitätsbeurteilungen verglichen wurden. Wir benötigen dasselbe – in geringerem Umfang, da unsere Ressourcen begrenzt sind, aber mit derselben Stringenz.

---

## 2. Was wir benötigen: Drei Aufgaben

### Aufgabe A: Bewertung der Übersetzungsqualität (Primär – ~8 Stunden insgesamt)

**Was:** Bewertung von 200 maschinell erzeugten Übersetzungen vom Englischen ins Cree anhand von zwei Skalen.

**Wer:** mindestens 3 zweisprachige Plains-Cree-Englisch-Sprecher mit Lesefertigkeit in SRO (Standard Roman Orthography).

**Wie es funktioniert:**

1. Wir stellen eine Tabelle oder ein Webformular mit 200 Zeilen bereit. Jede Zeile enthält:
   - Den englischen Quellsatz
   - Eine maschinell erzeugte Cree-Übersetzung
   - (Optional) eine Cree-Referenzübersetzung zum Vergleich

2. Für jede Übersetzung bewertet der Sprecher zwei Aspekte:

   **Adäquatheit** (sagt sie das Richtige aus?):
   | Score | Bezeichnung | Bedeutung |
   |-------|-------|---------|
   | 1 | Keine | Die Übersetzung hat nichts mit dem Quelltext zu tun |
   | 2 | Wenig | Einige Wörter stimmen überein, aber die Gesamtbedeutung ist falsch |
   | 3 | Viel | Die Kernbedeutung ist vorhanden, aber wichtige Teile fehlen oder sind falsch |
   | 4 | Größtenteils | Fast alles ist korrekt, geringfügige Bedeutungslücken |
   | 5 | Vollständig | Die Übersetzung vermittelt die Bedeutung des Quelltextes vollständig |

   **Flüssigkeit** (klingt sie wie echtes Cree?):
   | Score | Bezeichnung | Bedeutung |
   |-------|-------|---------|
   | 1 | Unverständlich | Dies ist kein Cree |
   | 2 | Unflüssig | Einzelne Wörter mögen Cree sein, aber der Satz ist fehlerhaft |
   | 3 | Nicht muttersprachlich | Verständlich, aber eindeutig nicht so, wie ein Cree-Sprecher es ausdrücken würde |
   | 4 | Gut | Natürlich klingend mit geringfügigen Unbeholfenheiten |
   | 5 | Einwandfrei | Ein Cree-Sprecher hätte dies schreiben können |

3. Optional kann der Sprecher eine Freitextanmerkung hinzufügen, die seine Bewertung erläutert (z. B. „falsche Kongruenz von belebt/unbelebt beim Verb“, „dies ist th-Dialekt, aber ich bewerte auf Grundlage des y-Dialekts“).

**Zeitschätzung:** ~2,5 Minuten pro Übersetzung × 200 Übersetzungen = ~8 Stunden. Kann auf mehrere Sitzungen aufgeteilt werden (z. B. 4 × 2-stündige Sitzungen über 2 Wochen).

**Vergütung:** 50–65 CAD/Stunde (entsprechend den Vergütungssätzen für Sprecher in BENCHMARK_SPEC §10.3). Gesamtsumme pro Sprecher: 400–520 CAD. Für 3 Sprecher: **1.200–1.560 CAD**.

**Was wir damit tun:** Wir berechnen die Korrelation zwischen unseren automatisierten LYSS-Bewertungen und den Sprecherbewertungen. Wenn LYSS-fst mit den Flüssigkeitsbewertungen und LYSS-sem mit den Adäquatheitsbewertungen korreliert, sind die Metriken validiert. Falls nicht, wissen wir, wo wir sie korrigieren müssen.

---

### Aufgabe B: Validierung der Linter-Äquivalenzen (~2 Stunden)

**Was:** Überprüfung von 50 Paaren von Cree-Übersetzungen, die unser Linter als „äquivalent“ klassifiziert, und Beurteilung, ob sie tatsächlich dasselbe bedeuten.

**Wer:** 1–2 zweisprachige Sprecher (können dieselben Sprecher wie in Aufgabe A sein).

**Wie es funktioniert:**

1. Wir stellen 50 Paare bereit. Jedes Paar enthält:
   - Den englischen Quelltext
   - Übersetzung A (die Referenz)
   - Übersetzung B (eine Variante, die unser Linter als äquivalent bezeichnet)
   - Den Äquivalenzgrund (z. B. „Permutation der Wortstellung“, „orthografische Variante“, „optionaler Partikel entfernt“)

2. Für jedes Paar beantwortet der Sprecher:
   - **Gleiche Bedeutung?** Ja / Nein / Hängt vom Kontext ab
   - **Beide natürlich?** Ja / A ist besser / B ist besser / Keine ist natürlich
   - **Anmerkungen** (optionaler Freitext)

**Zeitschätzung:** ~2 Minuten pro Paar × 50 Paare = ~2 Stunden.

**Vergütung:** 50–65 CAD/Stunde × 2 Stunden = **100–130 CAD pro Sprecher**.

**Was wir damit tun:** Wir berechnen die Präzision jeder Äquivalenzklasse. Wenn Sprecher angeben, dass 90 % der Äquivalenzen vom Typ „Wortstellung“ tatsächlich äquivalent sind, ist diese Klasse validiert. Wenn sie angeben, dass 40 % der Äquivalenzen vom Typ „Lemma-Synonym“ falsch sind, wissen wir, dass wir diese Klasse korrigieren oder entfernen müssen.

---

### Aufgabe C: Überprüfung von FST-Falschablehnungen (~1,5 Stunden)

**Was:** Überprüfung von 100 Cree-Wörtern, die der FST-Analysator ablehnt (als ungültige Cree-Wörter einstuft), und Beurteilung, ob sie tatsächlich gültig sind.

**Wer:** 1 zweisprachiger Sprecher mit fundierten Kenntnissen des Cree-Wortschatzes.

**Wie es funktioniert:**

1. Wir führen den FST-Analysator auf unserem EdTeKLA-Entwicklungskorpus mit 436 Einträgen (`textbook_dev.json`) aus und erfassen jedes Wort, das er ablehnt.
2. Wir legen der sprechenden Person bis zu 100 abgelehnte Wörter mit ihrem Satzkontext vor.
3. Für jedes Wort antwortet die sprechende Person:
   - **Ist dies ein gültiges Cree-Wort?** Ja / Nein / Unsicher
   - **Wenn ja, welcher Art?** Etabliertes Wort / Lehnwort / Name / Dialektale Form / Neologismus / Sonstiges
   - **Anmerkungen** (optional)

**Zeitschätzung:** ~1 Minute pro Wort × 100 Wörter = ~1,5 Stunden.

**Vergütung:** 50–65 CAD/Stunde × 1,5 Stunden = **75–100 CAD**.

**Was wir damit tun:** Wir berechnen die Falschablehnungsrate des FST. Wenn der FST 50 Wörter ablehnt und Sprecher angeben, dass 30 davon gültig sind, beträgt die Falschablehnungsrate 60 % – inakzeptabel hoch und erfordert eine Allowlist für Lehnwörter/Ausnahmen. Wenn Sprecher angeben, dass nur 5 gültig sind, beträgt die Falschablehnungsrate 10 % – die Metrik ist zuverlässig.

---

## 3. Gesamter Zeitaufwand der Sprecher

| Aufgabe | Benötigte Sprecher | Stunden pro Sprecher | Kosten pro Sprecher | Gesamtkosten |
|------|----------------|-------------------|-----------------|------------|
| A: Qualitätsbewertung | 3 | ~8 Stunden | 400–520 $ | 1.200–1.560 $ |
| B: Linter-Validierung | 2 | ~2 Stunden | 100–130 $ | 200–260 $ |
| C: FST-Überprüfung | 1 | ~1,5 Stunden | 75–100 $ | 75–100 $ |
| **Gesamt** | **3 Sprecher** | **~11,5 Stunden (max. pro Sprecher)** | **575–750 $ (max.)** | **1.475–1.920 $** |

Wenn dieselben 3 Sprecher alle Aufgaben übernehmen: **jeweils ~11,5 Stunden über 2–4 Wochen, jeweils 575–750 $**.

Ein einzelner Sprecher, der nur Aufgabe A bearbeitet, würde **~8 Stunden über 2 Wochen für 400–520 $** aufwenden.

---

## 4. Qualifikationen der Sprecher

**Erforderlich:**
- Zweisprachigkeit in Plains Cree und Englisch
- Lesefertigkeit in SRO (Standard Roman Orthography)
- Bereitschaft, Übersetzungen anhand einer strukturierten Skala zu bewerten

**Bevorzugt:**
- Erfahrung mit dem y-Dialekt (der in unserem Referenzkorpus von EDTeKLA verwendete Dialekt)
- Lehr- oder Übersetzungserfahrung (liefert eine kalibrierte Qualitätsbeurteilung)
- Vertrautheit mit verschiedenen Registern (formell, bildungsbezogen, umgangssprachlich)

**Nicht erforderlich:**
- Technische oder NLP-Kenntnisse (wir stellen alle Werkzeuge und den Kontext bereit)
- Computerkenntnisse (die Bewertungsoberfläche wird eine einfache Tabelle oder ein Webformular sein)
- Vorherige Beteiligung am Champollion-Projekt

---

## 5. Datenverwaltung {#5-data-governance}

Alle Beiträge der Sprechenden unterliegen den souveränitätsanstrebenden Datenrichtlinien des Projekts:

- **Eigentum:** Die Qualitätsbewertungen der Sprecher bleiben ihr geistiger Beitrag. Sie werden in jeder Veröffentlichung namentlich (oder auf eigenen Wunsch anonym) genannt.
- **Kontrolle:** Sprecher können ihre Bewertungen jederzeit zurückziehen. Der Rückzug entfernt ihre Daten aus allen Analysen.
- **Zugang:** Bewertungsdaten werden auf einer Infrastruktur gespeichert, die von der Governance-Organisation der Gemeinschaft (sobald eingerichtet) kontrolliert wird, oder auf der vom Sprecher bevorzugten Plattform.
- **Besitz:** Rohbewertungsdaten werden niemals veröffentlicht. In Veröffentlichungen erscheinen ausschließlich aggregierte Statistiken (Korrelationen, Interannotator-Übereinstimmung).
- **Vergütung:** Sprecher werden für ihre Zeit bezahlt, unabhängig davon, ob wir ihre Bewertungen verwenden. Die Bezahlung ist nicht an Ergebnisse gebunden.

---

## 6. Was Sprecher erhalten {#6-what-speakers-get}

Über die Vergütung hinaus:

- **Mitautorschaft** an jeder Veröffentlichung, die ihre Bewertungen verwendet (auf Wunsch)
- **Danksagung** in der gesamten Projektdokumentation
- **Früher Zugang** zu den Evaluationswerkzeugen und -ergebnissen
- **Mitsprache** bei der Verwendung der Metriken – wenn ein Sprecher sagt: „Ihr Linter liegt bei X falsch“, korrigieren wir den Linter
- **Vetorecht** gegen die Veröffentlichung von Ergebnissen, die sie als problematisch empfinden

---

## 7. Wie man beginnt {#7-how-to-get-started}

Wenn Sie ein zweisprachiger Cree-Englisch-Sprecher sind und an einer Teilnahme interessiert sind, oder wenn Sie jemanden kennen, der infrage kommen könnte:

1. **Kontaktieren Sie uns** unter [project email/contact] – keine Verpflichtung erforderlich, nur ein Gespräch
2. **Wir erklären die Aufgaben** in einfacher Sprache (ohne Fachjargon)
3. **Sie wählen, welche Aufgaben** Sie interessieren (A, B, C oder eine beliebige Kombination)
4. **Wir vereinbaren einen Zeitplan**, der zu Ihnen passt (2-Stunden-Blöcke, flexible Termine)
5. **Sie bewerten Übersetzungen** über eine Tabelle oder ein Webformular – von überall, in Ihrer eigenen Zeit
6. **Wir zahlen umgehend** – innerhalb von 2 Wochen nach Abschluss jedes Aufgabenblocks

---

## 8. Was danach geschieht

Mit Validierungsdaten von Sprechern können wir:

1. **Die Metrik-Korrelationen veröffentlichen** – um zu belegen (oder zu widerlegen), dass LYSS-Bewertungen die menschliche Beurteilung widerspiegeln
2. **Die Metriken neu kalibrieren** – durch Anpassung von Gewichtungen, Schwellenwerten und Äquivalenzklassen auf Grundlage des Feedbacks der Sprecher
3. **Den Linter korrigieren** – durch Entfernen falscher Äquivalenzen und Hinzufügen fehlender
4. **Die FST-Allowlist korrigieren** – durch Hinzufügen gültiger Wörter, die der FST fälschlicherweise ablehnt
5. **Bei einem akademischen Veranstaltungsort einreichen** – mit Sprechern als Mitautoren, wodurch LYSS als validierte Metrik für die MT-Evaluation polysynthetischer Sprachen etabliert wird

Ohne Validierung durch Sprecher bleibt LYSS ein technisches Werkzeug. Mit ihr wird LYSS zu einer wissenschaftlich fundierten Evaluationsmetrik. Das ist der Unterschied zwischen „Wir haben etwas gebaut“ und „Wir haben bewiesen, dass es funktioniert“.

## Wohin dies auf dieser Website führt

Die Sprechervalidierung ist eine Phase einer größeren Pipeline: Der Workflow
[Korpus-Partnerschaft](/docs/network/specifications/corpus-partnership)
zeigt, wie sich diese Aufgaben in den Aufbau eines Evaluierungskorpus einfügen, und
[Wie Sprechende bezahlt werden](/docs/network/perspectives/how-speakers-get-paid)
ist die leicht verständliche Version der oben genannten Sätze und Bedingungen.
