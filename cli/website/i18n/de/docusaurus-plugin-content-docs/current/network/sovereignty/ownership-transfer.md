---
sidebar_position: 2
title: "Eigentum & Bedingungen"
---

# Eigentum & Bedingungen

> **Kurzübersicht.** Champollion verfügt ganz bewusst über keine universelle Vereinbarung.
> Bedingungen werden pro Korpus, pro Sprache und pro Preis von der verwaltenden Stelle
> festgelegt, der die Daten gehören – die Aufgabe der Plattform besteht darin, die jeweils festgelegten Bedingungen zu achten. Diese
> Seite beschreibt die Dimensionen, die ein Konditionenblatt abdeckt, sowie die **Vorlage zur
> Gemeinschaftsübertragung**: ein Ausgangspunkt, den das Leitungsgremium einer Gemeinschaft
> übernehmen und anpassen kann, wenn es einen Preis auslobt und die Bedingung
> `pass_to_holders` wählt.

## Das Rahmenwerk der Bedingungen

Champollion ist so konzipiert, dass es bei seinen Bedingungen flexibel ist,
damit alle Lizenzen respektiert werden — und damit es neuartige Arrangements
unterstützen kann: geheime Korpora, von der Gemeinschaft gehaltene Testsätze und
souveräne Bereitstellungsanforderungen. Verschiedene Sprachen werden
unterschiedliche Vereinbarungen haben. Ein CC0-Korpus, ein ausschließlich der
Forschung dienendes Gemeinschaftskorpus und ein versiegelter Goldstandard-Satz,
der von einem Stammesrat verwaltet wird, können alle teilnehmen — jeweils zu
ihren eigenen Bedingungen.

Einheitlich ist die Maschinerie, die diese Bedingungen wahrt: Exposure-Lanes,
Lizenz-Gates, Quarantäne und die Fetch-from-Source-Registrierung (siehe
[Korpora registrieren](/docs/network/sovereignty/registering-corpora)).
*Niemals* einheitlich ist die Vereinbarung selbst.

Wenn ein Korpusverwalter Bedingungen festlegt — für die Teilnahme an einem
Benchmark, für einen gesponserten Preis oder für sonstige Zwecke — beantwortet
das Konditionenblatt eine kleine Reihe von Fragen:

| Dimension | Die Frage |
|---|---|
| **Freigabe des Korpus** | Welche Stufe – öffentlich, nur für die Forschung oder privat? Werden Referenzen jemals offengelegt? |
| **Eigentum an der Methode** | Wenn ein Preis gewonnen wird, wem gehört die siegreiche Methode – den Entwickelnden, der Gemeinschaft oder gemeinsam? |
| **Bereitstellung** | Wer darf die Methode bereitstellen, wo und unter welchen Bedingungen? |
| **Selbsthosting** | Muss die Methode vollständig auf einer von der Gemeinschaft kontrollierten Infrastruktur laufen? |
| **Geheimhaltung** | Ist der Testsatz versiegelt? Wer besitzt die Schlüssel? Wer autorisiert die einzelnen Evaluierungsläufe? |
| **Vergütung** | Was wird Entwickelnden, Validierenden und Prüfenden bezahlt? (Veröffentlichte Standardwerte: [Zusammenarbeit mit Sprechenden](/docs/working-with-speakers)) |

Keine dieser Fragen hat von der Plattform vorgegebene Antworten. Die
nachstehenden Standardwerte sind eine Vorlage, keine Regel.

## Die Community Transfer Template

Die ausrichtende Stelle eines versiegelten Wettbewerbs wählt eine von drei Preisbedingungen – `pass_to_holders`,
`retain_ip` oder `release_open` – und veröffentlicht diese, bevor jemand beitritt
([Preisspezifikation](/docs/network/specifications/prizes#condition-7-in-detail-the-term-is-one-choice-of-three)).
Ein Platz auf der offenen Bestenliste überträgt unter keiner dieser Bedingungen Rechte. Diese
Vorlage legt `pass_to_holders` für das Korpus einer indigenen Sprache dar und wird
dem Leitungsgremium einer Gemeinschaft als Ausgangspunkt für Anpassungen zur Verfügung gestellt. Sie
funktioniert wie folgt:

### 1. Methodenentwicklung
Ein Forscher, Student oder Entwickler baut eine Übersetzungsmethode — eine
FST-gesteuerte Pipeline, ein gecoachtes LLM, ein feinabgestimmtes Modell oder
einen beliebigen anderen Ansatz — unter Verwendung eigener Ressourcen und offen
lizenzierter Daten.

### 2. Netzwerkevaluierung
Die Methode wird über das [Eval-Harness](/docs/network/specifications/harness)
gebenchmarkt. Jede Einreichung wird per Fingerprint einem bestimmten Git-Commit
und einer bestimmten Datensatzversion zugeordnet. Die Bewertungen sind
reproduzierbar.

### 3. Community-Review
Die Ergebnisse werden von Sprachmitarbeitern der Gemeinschaft überprüft. Eine
hohe Platzierung in der Rangliste beweist, dass die Methode *funktioniert*; sie
beweist nicht, dass sie *angemessen* ist. Zweisprachige Sprecher validieren eine
Stichprobe der Ausgaben, und die Reviewer der Gemeinschaft können eine Methode
aus beliebigem Grund ablehnen.

### 4. Eigentumsübertragung
Wenn eine Methode die Preisschwelle erreicht (automatisierte Metriken **und**
menschliche Validierung), überträgt der Entwickler die Methode — Quellcode,
trainierte Gewichte, Konfiguration, Coaching-Daten — an die
Governance-Organisation der Gemeinschaft (einen Stammesrat, eine Sprachbehörde
oder ein ähnliches Gremium, das von der Gemeinschaft und niemals von Champollion
ausgewählt wird). Die Gemeinschaft besitzt das Artefakt uneingeschränkt: sie
kann es inspizieren, modifizieren, bereitstellen, einmotten oder lizenzieren,
ohne fortlaufenden Anspruch des Entwicklers oder von Champollion.

Bei Drittanbieterkomponenten, die dem Entwickler nicht gehören (ein
Open-Weight-Basismodell, ein AGPL-FST), kann das Eigentum nicht übertragen
werden — sie gehen unter ihren eigenen offenen Lizenzen an die Gemeinschaft
über, weshalb die Preiszulässigkeit erfordert, dass jede Abhängigkeit Rechte
trägt, die die Gemeinschaft tatsächlich empfangen kann. Siehe die
Abhängigkeitsklassen in der
[Method-Interface-Spezifikation](/docs/network/specifications/methods#method-validity-and-dependency-classes).

Der Entwickler behält, was Forschern zustehen sollte: das uneingeschränkte
Recht, den Ansatz und die Ergebnisse zu veröffentlichen, ihre Techniken überall
wiederzuverwenden, und die dauerhafte Nennung als Urheber der Methode.

### 5. Bereitstellung — ob und wie die Gemeinschaft es entscheidet
Die Gemeinschaft entscheidet, ob die Methode überhaupt bereitgestellt wird, von
wem und zu welchen Bedingungen. Eine unabhängige Bereitstellung ist
ausschließlich Angelegenheit der Gemeinschaft: **Champollion nimmt keinen Anteil
an dem, was eine Gemeinschaft mit einem ihr gehörenden Asset verdient**, und hält
keine eigenen Bereitstellungsrechte.

:::note[Status: Vorlage, keine bisherige Praxis]
Bislang wurde noch kein Preis ausgelobt und keine Übertragung durchgeführt. Diese Vorlage wird dokumentiert, damit die beabsichtigten
Bedingungen transparent sind, bevor jemand Mühe investiert, und damit das
Leitungsgremium einer Gemeinschaft einen konkreten Entwurf vor sich hat, anstatt vor einem leeren Blatt zu stehen.
Erst ein unterzeichnetes Dokument, das gemeinsam mit Rechtsberatung für die jeweiligen Parteien ausgearbeitet wurde,
macht all dies rechtsverbindlich.
:::

## Für Forscher

Wenn Sie eine Methode für eine indigene Sprache entwickeln:

1. **Bauen Sie eine Beziehung** zur Sprachgemeinschaft auf, bevor Sie beginnen
2. **Verwenden Sie offen lizenzierte Daten** für die Entwicklung (keine für die Gemeinschaft eingeschränkten Ressourcen)
3. **Dokumentieren Sie die Herkunft** in Ihrer [Run Card](/docs/network/specifications/run-card) — jede Ressource, ihre Lizenz und ihren Ursprung
4. **Lesen Sie die Bedingungen des Preises, bevor Sie dafür entwickeln** — wenn
   die Bedingungen eine Übertragung beinhalten, ist Ihr Beitrag die Architektur
   und Technik (die Sie veröffentlichen und wiederverwenden dürfen); der Beitrag
   der Gemeinschaft ist das linguistische Wissen, das sie für ihre Sprache zum
   Funktionieren bringt

## Siehe auch

- [Ihre Worte, Ihre Regeln](/docs/your-words-your-rules) – die Grundhaltung, die diese Bedingungen umsetzen
- [Wie die Arbeit finanziert wird](/docs/getting-started/who-may-use-this) – wohin Gelder fließen und was Champollion einbehält (nichts)
- [Korpora registrieren](/docs/network/sovereignty/registering-corpora) – Freigabestufen und Abruf von der Quelle
- [Preisspezifikation](/docs/network/specifications/prizes) – Schwellenwertbedingungen und Verfahren zur Inanspruchnahme
