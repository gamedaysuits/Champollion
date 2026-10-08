---
sidebar_position: 5
title: "Die Abdeckungslücke: Wie wir sie schätzen"
description: "Wie Champollion die Zahl von „mehr als einer Milliarde Menschen“ rechtfertigt — die Methode, die beiden zugrunde liegenden Ermessensentscheidungen und warum die Website absichtlich eine konservative Untergrenze angibt. Korrekturen und Diskussionen sind willkommen."
---

# Die Abdeckungslücke: Wie wir sie schätzen

> **Zusammenfassung.** Die Startseite von Champollion besagt, dass *mehr als eine Milliarde* heute lebender Menschen keine maschinelle Übersetzung in ihre Erstsprache erhalten können. Diese Seite zeigt die Arithmetik hinter dieser Aussage, benennt die beiden Ermessensentscheidungen, die diese Zahl beeinflussen, und erklärt, warum wir eine konservative Untergrenze anstelle der größeren unbereinigten Gesamtzahl veröffentlichen. Champollion ist ein Index, keine Autorität — jede hier genannte Zahl lässt sich aus dem öffentlichen Build ableiten, und Korrekturen sind willkommen.

## Die Frage, die wir eigentlich stellen

Nicht "wie vielen Sprachen fehlt maschinelle Übersetzung (MT)", sondern **wie viele Menschen können keine maschinelle Übersetzung in ihre Erstsprache erhalten.** Die Erstsprache (L1) einer Person ist diejenige, in der sie denkt und in der sie am liebsten die Nachrichten lesen würde. Zweisprachigkeit schließt niemanden aus dieser Zählung aus: Eine quechua-spanisch zweisprachige Person, deren Erstsprache Quechua ist, kann eine Webseite immer noch nicht *auf Quechua* lesen. Die Zielgruppe ist also: jeder, dessen L1 eine der lebenden Sprachen ist, die von keiner dedizierten MT-Engine bedient wird.

## Wie diese Zahl berechnet wird

Zwei Bestandteile, beide im Repository:

1. **Welche lebenden Sprachen über MT verfügen.** Der Build bildet die Schnittmenge aus der Vereinigung der Sprachlisten von neun erfassten Engines (Google, Microsoft, DeepL, LibreTranslate, NLLB-200, OPUS-MT, M2M-100, MADLAD-400, Tilde — `shared/catalogue/method-coverage.json`, jede Liste zitiert und datiert) mit den *individuellen lebenden* Sprachen nach ISO 639-3 (`isoType: 'L'`) in `data/tc-index.json`. Ergebnis: **552 lebende Sprachen abgedeckt, 6.525 nicht abgedeckt**, von insgesamt **7.077** lebenden Sprachen (`stats.coverage.dedicatedLiving` / `uncoveredLiving`).
2. **Wie viele Menschen die nicht abgedeckten Sprachen sprechen.** Für jede nicht abgedeckte lebende Sprache nehmen wir ihre `speakerCount` (entnommen aus den zitierten Schätzungen der Sprachkarte) und summieren diese. Der Build gibt dies als `stats.coverageGap` aus. Die unbereinigte Summe über alle 6.525 nicht abgedeckten Sprachen beträgt etwa **2,9 Milliarden** (`uncoveredSpeakerSumRaw` ≈ 2.974.871.273).

Diese 2,9 Milliarden sind eine **ungefähre Obergrenze**, und das sagen wir auch ganz deutlich.

### Warum die unbereinigte Summe nicht exakt ist

`speakerCount` vermischt Erstsprachler (L1) und Gesamtzahl der Sprecher (L1+L2), je nachdem, was die jeweilige Quelle angibt, und eine mehrsprachige Person kann bei mehr als einer Sprache mitgezählt werden. Das Indiz dafür: Die Summierung von `speakerCount` über *alle* 7.082 lebenden Sprachen ergibt rund **10,8 Milliarden** — mehr als die ~8,1 Milliarden lebenden Menschen (UN World Population Prospects). Ein sauberer L1-Zensus kann die Weltbevölkerung nicht übersteigen; dieser tut es, was beweist, dass das Feld nicht rein L1 ist.

## Zwei Ermessensentscheidungen (jede beeinflusst die Zahl)

**(a) Nur L1 vs. Gesamtzahlen.** Eine Beschränkung auf Erstsprachler würde die Schätzung verringern — L2-Sprecher sind konstruktionsbedingt Menschen, die über eine *andere* Sprache verfügen. L1-Zahlen pro Sprache sind jedoch in den von uns zitierten Quellen nicht einheitlich verfügbar, sodass wir nicht überall eine Nur-L1-Regel anwenden können, ohne Zahlen zu erfinden. Die Verwendung der vermischten Zählung treibt die Schätzung nach *oben*.

**(b) Die 777 nicht abgedeckten Sprachen ohne gemeldete Zählung.** Von den 6.525 nicht abgedeckten lebenden Sprachen **weisen 5.748 eine Sprecherzahl auf und 777 nicht** (`uncoveredWithCount` / `uncoveredNoCount`). Diese 777 beiseitezulassen — was bei der unbereinigten Summe geschieht — führt zu einer *Untererfassung*, da es sich um reale Sprachen mit realen (ungemessenen) Sprechern handelt, von denen die meisten klein und bedroht sind.

Die beiden Fehler weisen also in entgegengesetzte Richtungen: Die L1/L2-Vermischung bläht die Zahl auf, und die Gruppe der 777 Sprachen verringert sie.

## Warum wir eine Untergrenze von "mehr als einer Milliarde" angeben

Die plausible Spanne reicht von einer Untergrenze nahe **1 Milliarde** bis zu den unbereinigten **~2,9 Milliarden**. Selbst nach starkem Abzug für L2-Doppelzählungen *und* dem Beiseitelassen der gesamten ungemessenen Gruppe der 777 Sprachen bleibt die Erstsprachen-Bevölkerung der nicht abgedeckten Sprachen bequem über einer Milliarde. Anstatt die größere, ungenauere Zahl in den Vordergrund zu stellen, gibt die Website das konservative Ende an. "Mehr als eine Milliarde" ist die Aussage, von der wir am meisten überzeugt sind, dass sie einer genauen Prüfung standhält.

## Was dies ändern könnte

Eine genauere Schätzung erfordert **L1-Sprecherzahlen pro Sprache, jeweils mit einer Quellenangabe**, damit wir L1 direkt summieren könnten, anstatt der L1/L2-Vermischung, und eine vertretbare Schätzung für die 777 derzeit nicht gezählten Sprachen abgeben könnten. Wenn Engines Sprachen hinzufügen, steigt die Zahl 552 und die Lücke wird kleiner; wenn Sprachkarten besser belegte Zählungen erhalten, wird die Summe präziser. Dies ist eine **fortlaufende Schätzung**, die bei jedem Build neu berechnet wird — kein feststehender Fakt.

## Korrekturen und Diskussionen willkommen

Wenn Sie bessere Daten haben, der Meinung sind, dass eine Entscheidung hier falsch ist, oder Quellen für die fehlenden 777 nennen können, teilen Sie uns dies mit. Genau darum geht es. Eröffnen Sie ein Issue unter [github.com/gamedaysuits/Champollion/issues](https://github.com/gamedaysuits/Champollion/issues) oder senden Sie eine E-Mail an [info@champollion.dev](mailto:info@champollion.dev).

---

## Quellen

- **Abdeckung** — `cli/shared/catalogue/method-coverage.json` (neun Engines, jede Liste zitiert und datiert) ∩ individuelle lebende Sprachen nach ISO 639-3 in `cli/website/data/tc-index.json`; ausgegeben als `stats.coverage.dedicatedLiving` / `uncoveredLiving`. Von Champollion abgeleitet.
- **Sprechersummen** — `speakerCount` in `tc-index.json` Zeilen (aus der zitierten `speakerEstimates` jeder Sprachkarte), vom Build summiert in `stats.coverageGap` (`uncoveredSpeakerSumRaw`, `uncoveredWithCount`, `uncoveredNoCount`). Von Champollion abgeleitet; vermischt L1/L2 je nach Quelle.
- **Weltbevölkerung** — rund 8,1 Milliarden (Vereinte Nationen, *World Population Prospects*), wird nur als Plausibilitätsgrenze für die Sprechersummen verwendet.

## Wohin dies auf dieser Website führt

Diese Zahlen verdeutlichen das Ausmaß des Problems. Die Antwort der Website darauf beginnt
unter [Was Champollion ist](/docs/what-is-champollion); die Methodik hinter
der Aufteilung in abgedeckt/nicht abgedeckt findet sich unter
[Wie die Abdeckung gezählt wird](/docs/network/context/coverage-counting), und die
Sprachen auf der falschen Seite der Grenze — geordnet danach, wer am
plausibelsten als Nächstes ein Evaluierungsset erstellen könnte — werden in der
[Korpus-Wunschliste](https://champollion.dev/corpus-wishlist.json) veröffentlicht.
