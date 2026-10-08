---
sidebar_position: 1
title: "Für Sprachgemeinschaften"
---

# Für Sprachgemeinschaften

> **Zusammenfassung.** Ihre Sprachgemeinschaft kann ihren eigenen Testsatz besitzen – den „Lösungsschlüssel“, an dem jede Übersetzungsmethode gemessen wird – und ihren eigenen Wettbewerb zu ihren eigenen Bedingungen durchführen, ohne die Daten jemals herauszugeben. Diese Seite erklärt, was das Netzwerk von Sprachgemeinschaften erbittet (Referenzübersetzungen, Überprüfung von Übersetzungen, Coaching-Daten), was Sie im Gegenzug erhalten (vergütete Arbeit zu veröffentlichten Sätzen, sobald die Mittel bereitstehen – derzeit sind keine Mittel vorhanden – sowie Code-Eigentum und volle Kontrolle über das Deployment) und welche Schutzmaßnahmen für die Souveränität an erster Stelle stehen. Es sind keine Programmierkenntnisse erforderlich. Einige Schutzmaßnahmen sind direkt in die Software und die Datenbank integriert; andere sind derzeit noch Verpflichtungen, und [Ehrliche Einschränkungen](/docs/network/honest-limitations) legt dar, welche dies sind.

Sie müssen kein Programmierer sein, um zum Network beizutragen. Wenn Sie eine indigene oder ressourcenarme Sprache sprechen, sind Sie die wichtigste Person in diesem Ökosystem.

---

## Souveränität steht an erster Stelle

Bevor wir Sie um irgendetwas bitten, gilt die Grundregel: **Ihre Sprachdaten gehören Ihnen.** Sprachdaten sind *Biodaten* – sie tragen die Identität und die Beziehungen Ihrer Gemeinschaft in sich und können nicht sinnvoll anonymisiert werden. Daher behalten die Personen, die sie bereitstellen, die Schlüsselgewalt darüber und über alles, was daran gemessen wird. Das Netzwerk baut auf den [Prinzipien indigener Datensouveränität](/docs/network/sovereignty/data-sovereignty) auf:

- Wir erfassen oder speichern Ihre sprachlichen Daten niemals auf unseren Servern
- Übersetzungsmethoden verwenden die `api`-Architektur — alle Coaching-Daten, Wörterbücher und Grammatikregeln verbleiben auf einer von Ihnen kontrollierten Infrastruktur
- Sie entscheiden, wer Methoden für Ihre Sprache entwickeln darf
- Bestenlisten-Punktzahlen belegen, dass eine Methode funktioniert; sie erteilen jedoch keine Erlaubnis, sie bereitzustellen

:::note[Der aktuelle Stand]
Das nachfolgend beschriebene Modell der Eigentumsübertragung ist ein **verbindliches Konzept, noch kein laufendes Programm.** Die Bestenliste ist für Einreichungen geöffnet, verfügt derzeit jedoch über keine veröffentlichten Durchläufe, und bislang wurde noch keine Methode an eine Community übertragen. Wir beschreiben, wie es funktionieren soll, damit Sie uns daran messen können — nicht, um zu suggerieren, dass es bereits in Bewegung ist. Die Beziehung und Ihre Hoheit über Ihre Daten stehen an erster Stelle; alles Weitere folgt daraus.
:::

---

## Besitzen Sie Ihr Testset

Die stärkste Position, die eine Gemeinschaft in diesem System einnehmen kann, ist der **Besitz des Benchmarks selbst**. Ein Testset ist der Lösungsschlüssel: Wer es hält, entscheidet, was „gute Übersetzung“ für die Sprache bedeutet, und jede Methode — unsere, die eines Unternehmens, die von wem auch immer — wird an *Ihrem* Standard gemessen.

- **Registrierung ist Metadaten, kein Inhalt.** Ein Korpus beim Network zu registrieren bedeutet, eine beschreibende Karte zu veröffentlichen — niemals das Korpus hochzuladen. Sie wählen dessen [Offenlegungsstufe](/docs/network/sovereignty/registering-corpora): offen, eingeschränkt oder vollständig souverän.
- **Souveräne Benchmarks bleiben geheim.** In der souveränen Stufe verlässt das Testset niemals die Infrastruktur der Gemeinschaft, und wir bekommen es niemals zu sehen. Methoden werden auf Ihrer Seite daran bewertet; nur die Punktzahl wird übermittelt.
- **Sie können Ihren eigenen Wettbewerb durchführen.** Das Schritt-für-Schritt-Handbuch — [Einen souveränen Wettbewerb durchführen](/docs/network/sovereignty/run-a-sovereign-contest) — führt Sie durch die Ausrichtung einer von der Gemeinschaft kontrollierten Evaluierung zu Ihren eigenen Bedingungen: Ihr Testset, Ihre Regeln, Ihre Entscheidung darüber, was (falls überhaupt) veröffentlicht wird.

Die Garantien hinter alledem sind schriftlich festgelegt und nicht bloß implizit:
[Daten-Stewardship](/docs/network/sovereignty/data-sovereignty) (die Position
zur Datensouveränität/zu den CARE-Prinzipien und was sie uns untersagt) sowie
[Eigentum & Bedingungen](/docs/network/sovereignty/ownership-transfer) (was
vertraglich geschieht, wenn eine Methode gewinnt).

---

## Was wir von Ihnen benötigen

### Referenzübersetzungen

Wir benötigen kuratierte Übersetzungspaare für die Evaluierung — Englisch auf der einen Seite, Ihre Sprache auf der anderen. Diese werden zum „Lösungsschlüssel“, an dem alle Übersetzungsmethoden bewertet werden.

Sie könnten diese aus folgenden Quellen erstellen:
- **Lehrmaterialien** — Schulbuchübungen, Unterrichtspläne, Arbeitsblätter
- **Gemeinschaftsdokumente** — Sitzungsprotokolle, Newsletter, Ankündigungen
- **Alltagsphrasen** — UI-Zeichenketten, App-Beschriftungen, gängige Ausdrücke
- **Kulturelle Inhalte** — Geschichten, Lieder oder Beschreibungen (mit entsprechenden Genehmigungen)

Das Format ist einfaches JSON:
```json
{
  "entries": [
    { "id": 1, "source": "Hello", "reference": "tânisi" },
    { "id": 2, "source": "Thank you", "reference": "kinanâskomitin" }
  ]
}
```

### Übersetzungsprüfung

Jede Methode, die behauptet, funktionierende Übersetzungen zu erzeugen, benötigt menschliche Validierung. Zweisprachige Sprecher überprüfen die Ausgaben und teilen uns mit, ob der Computer es richtig gemacht hat — und, was noch wichtiger ist, *warum* er es falsch gemacht hat.

### Coaching-Daten

Grammatikregeln, Wörterbucheinträge, morphologische Muster — dies sind die sprachlichen Ressourcen, die Übersetzungsmethoden zum Funktionieren bringen. Ihr Wissen darüber, wie Ihre Sprache funktioniert, ist durch kein KI-Modell zu ersetzen.

---

## Was Sie dafür erhalten

### Eigentum

Wenn eine Übersetzungsmethode für Ihre Sprache entwickelt und im Network validiert wurde, [geht das Eigentum über](/docs/network/sovereignty/ownership-transfer) an die Governance-Organisation Ihrer Gemeinschaft. Ihnen gehören der Code, die Modellgewichte und die Bereitstellung.

### Bezahlte Arbeit, keine Ausbeutung

Der Aufbau von Korpora und die Überprüfung von Übersetzungen sind professionelle Arbeit, die nach
[veröffentlichten Sätzen](/docs/network/perspectives/how-speakers-get-paid) vergütet werden soll, sobald Mittel zur Verfügung stehen
(derzeit sind keine Mittel vorhanden) – und die Bezahlung kauft Ihre Daten nicht ab. Sie werden für die Arbeit bezahlt *und* bleiben
Eigentümer dessen, was Sie aufbauen. Champollion ist ein nicht-kommerzielles Forschungsprojekt: Es
verkauft nichts, rechnet keine Nutzung ab und [behält keinen Anteil](/docs/network/sovereignty/economic-model)
von dem ein, was Ihre Gemeinschaft jemals mit einer Methode verdient, die ihr gehört.

### Kontrolle

Ihre Governance-Organisation kontrolliert:
- Wer auf die Methode zugreifen kann
- Ob sie kommerziell genutzt werden kann — und falls ja, zu Ihren Bedingungen, wobei alles, was sie einbringt, bei Ihnen bleibt
- Wann und wie sie aktualisiert wird
- Welche Daten für die weitere Entwicklung verwendet werden

---

## So beteiligen Sie sich

:::tip[Was Sprechende schon heute tun können – wenn die Gemeinschaft zustimmt]
Champollion erstellt oder hostet keine Korpora – Testdaten werden stets von
ihrer Quelle bezogen. Wenn Sprechende aus Ihrer Gemeinschaft *schon jetzt*
Sätze beisteuern möchten: [Tatoeba](https://tatoeba.org) akzeptiert satzweise
Beiträge in jeder Sprache, und offene Sammlungen wie
[OPUS](https://opus.nlpl.eu/) aggregieren parallele Texte, aus denen das Netzwerk
Benchmarks erstellt. Dort hinzugefügte Sätze können hier zu Evaluierungsdaten werden.

Kennen Sie jedoch vorher die Rahmenbedingungen: Tatoeba veröffentlicht Sätze unter einer offenen Lizenz
(standardmäßig CC BY 2.0 FR), sodass jede Person sie kopieren kann – einschließlich zum Trainieren von KI-Modellen –,
und bereits erstellte Kopien können nicht zurückgerufen werden. Für alltägliche Sätze kann dies die richtige
Wahl sein. Für alles, was Ihre Gemeinschaft unter eigener Kontrolle behalten möchte,
behalten Sie die Daten selbst und verwenden stattdessen einen
[versiegelten Testsatz](/docs/network/sovereignty/run-a-sovereign-contest).
Eine App für direkte Beiträge von Sprechenden und ein Korpus-Builder sind geplant, aber noch
nicht realisiert.
:::

1. **Kontakt aufnehmen** – Eröffnen Sie ein Issue im [Netzwerk-Repository](https://github.com/gamedaysuits/Champollion) oder schreiben Sie eine E-Mail an [info@champollion.dev](mailto:info@champollion.dev)
2. **Beschreiben Sie Ihre Sprache** – Zu welcher Sprachfamilie gehört sie? Wie viele Sprechende gibt es? Welche Schriftsysteme werden verwendet? Welche computerlinguistischen Ressourcen existieren (FSTs, Wörterbücher, Korpora)?
3. **Klein anfangen** – Bereits 50 kuratierte Übersetzungspaare genügen, um einen Evaluierungsdatensatz zu erstellen und eine neue Leaderboard-Kategorie zu eröffnen. Korpusarbeit wird nach [veröffentlichten Sätzen vergütet](/docs/network/perspectives/how-speakers-get-paid), sobald Mittel bereitstehen; derzeit sind keine Mittel vorhanden
4. **Behalten Sie die Kontrolle** – Registrieren Sie das Korpus als Metadaten im Bereich Ihrer Wahl ([Korpora registrieren](/docs/network/sovereignty/registering-corpora)); wenn Sie den Testsatz vollständig geheim halten möchten, ist das [Runbook für souveräne Wettbewerbe](/docs/network/sovereignty/run-a-sovereign-contest) der richtige Weg
5. **Verbinden Sie uns mit Ihren Entscheidungsträgern** – Wer in Ihrer Gemeinschaft hat die Autorität über Sprachdaten und -technologie? Das Souveränitätsmodell des Netzwerks erfordert einen Governance-Partner

---

## Siehe auch

- [Einen souveränen Wettbewerb durchführen](/docs/network/sovereignty/run-a-sovereign-contest) – das Runbook für eine von der Gemeinschaft kontrollierte Evaluierung
- [Vorlagen für Nutzungsbedingungen](/docs/network/sovereignty/terms-templates) – rechtlich einfache, auf Trustless-Prinzipien ausgerichtete Bedingungen, die Ihre Gemeinschaft anpassen kann, mit detaillierter Erläuterung der Trojanisches-Pferd-Risiken
- [Daten-Stewardship](/docs/network/sovereignty/data-sovereignty) – die Position und die Rahmenwerke (CARE, Te Mana Raraunga und andere Instrumente indigener Datensouveränität), die sie geprägt haben
- [Eigentum & Bedingungen](/docs/network/sovereignty/ownership-transfer) – sprachspezifische Bedingungen und was geschieht, wenn eine Methode gewinnt
- [Wie die Arbeit finanziert wird](/docs/network/sovereignty/economic-model) – wie Geldflüsse in einem nicht-kommerziellen Projekt funktionieren
- [Eine ressourcenarme Sprache unterstützen](/docs/network/community/low-resource-languages) – technischer Kontext für Forschende, die an der Seite von Gemeinschaften arbeiten
