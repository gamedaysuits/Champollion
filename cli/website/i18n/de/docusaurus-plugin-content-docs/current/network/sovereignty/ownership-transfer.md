---
sidebar_position: 2
title: "Eigentum & Bedingungen"
---

# Eigentum & Bedingungen

> **Zusammenfassung.** Champollion hat bewusst keine universelle Vereinbarung.
> Die Bedingungen werden pro Korpus, pro Sprache und pro Preis von dem Verwalter
> festgelegt, dem die Daten gehören — die Aufgabe der Plattform besteht darin,
> diese Bedingungen zu respektieren, welche auch immer es sind. Diese Seite
> beschreibt die Dimensionen, die ein Konditionenblatt abdeckt, sowie die
> **Community Transfer Template**, den standardmäßigen Ausgangspunkt für
> gesponserte Preise auf Korpora indigener Sprachen.

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
| **Korpus-Exposure** | Welche Lane — öffentlich, ausschließlich Forschung oder privat? Werden Referenzen jemals angezeigt? |
| **Methodeneigentum** | Wenn ein Preis gewonnen wird, wem gehört die gewinnende Methode — dem Entwickler, der Gemeinschaft oder gemeinsam? |
| **Bereitstellung** | Wer darf die Methode bereitstellen, wo und unter welchen Bedingungen? |
| **Self-Hosting** | Muss die Methode vollständig auf von der Gemeinschaft kontrollierter Infrastruktur laufen? |
| **Geheimhaltung** | Ist der Testsatz versiegelt? Wer hält die Schlüssel? Wer autorisiert jeden Evaluierungslauf? |
| **Vergütung** | Was wird an Builder, Validatoren und Reviewer gezahlt? (Veröffentlichte Standardwerte: [Wie Sprecher bezahlt werden](/docs/network/perspectives/how-speakers-get-paid)) |

Keine dieser Fragen hat von der Plattform vorgegebene Antworten. Die
nachstehenden Standardwerte sind eine Vorlage, keine Regel.

## Die Community Transfer Template

Für gesponserte Preise auf Korpora indigener Sprachen funktioniert die
Standardvorlage — angeboten als Ausgangspunkt, den das Governance-Gremium einer
Gemeinschaft überarbeiten kann — folgendermaßen:

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

:::note[Status: Vorlage, keine Erfolgsbilanz]
Es wurde noch kein Preis ausgeschrieben und noch keine Übertragung vorgenommen — die Bestenliste
enthält derzeit keine veröffentlichten Durchläufe. Diese Vorlage wird dokumentiert, damit die vorgesehenen
Bedingungen transparent sind, bevor jemand Aufwand investiert, und damit das Governance-Gremium einer
Gemeinschaft einen konkreten Entwurf zur Reaktion hat statt einer leeren Seite.
Erst ein unterzeichnetes Dokument, das mit einem Rechtsbeistand für die konkreten Parteien ausgearbeitet wird,
würde dies alles verbindlich machen.
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

- [Datenverwaltung](/docs/network/sovereignty/data-sovereignty) — die Position, die diese Bedingungen umsetzen
- [Wie die Arbeit finanziert wird](/docs/network/sovereignty/economic-model) — wohin Geld fließt und was Champollion nimmt (nichts)
- [Korpora registrieren](/docs/network/sovereignty/registering-corpora) — Exposure-Lanes und Fetch-from-Source
- [Preisspezifikation](/docs/network/specifications/prizes) — Schwellenwertbedingungen und Anspruchsverfahren
