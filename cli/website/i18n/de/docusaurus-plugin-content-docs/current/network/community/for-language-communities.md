---
sidebar_position: 1
title: "Für Sprachgemeinschaften"
---

# Für Sprachgemeinschaften

> **Zusammenfassung.** Ihre Gemeinschaft kann ihr eigenes Testset besitzen — den „Lösungsschlüssel“, an dem jede Übersetzungsmethode gemessen wird — und ihren eigenen Wettbewerb zu ihren eigenen Bedingungen durchführen, ohne die Daten jemals herauszugeben. Diese Seite erläutert, worum das Network Sprachgemeinschaften bittet (Referenzübersetzungen, Übersetzungsprüfung, Coaching-Daten), was Sie dafür erhalten (bezahlte Arbeit zu veröffentlichten Sätzen, Code-Eigentum, vollständige Kontrolle über die Bereitstellung) und die Souveränitätsgarantien, die an erster Stelle stehen. Es sind keine Programmierkenntnisse erforderlich, und nichts hier verlangt, uns zu vertrauen: Die Garantien sind struktureller Natur, keine Versprechen.

Sie müssen kein Programmierer sein, um zum Network beizutragen. Wenn Sie eine indigene oder ressourcenarme Sprache sprechen, sind Sie die wichtigste Person in diesem Ökosystem.

---

## Souveränität steht an erster Stelle

Bevor wir irgendetwas von Ihnen verlangen, gilt die Grundregel: **Ihre Sprachdaten gehören Ihnen.** Sprachdaten sind *Biodaten* — sie tragen die Identität und die Beziehungen Ihrer Gemeinschaft und lassen sich nicht sinnvoll anonymisieren — daher halten die Menschen, die sie bereitstellen, die Schlüssel dazu und zu allem, was daran gemessen wird. Das Network basiert auf [indigenen Prinzipien der Datensouveränität](/docs/network/sovereignty/data-sovereignty):

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

Die Garantien hinter all dem sind niedergeschrieben, nicht bloß impliziert: [Datenverwaltung](/docs/network/sovereignty/data-sovereignty) (die Datensouveränitäts-/CARE-Position und was sie uns untersagt) und [Eigentum & Bedingungen](/docs/network/sovereignty/ownership-transfer) (was vertraglich geschieht, wenn eine Methode gewinnt).

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

Korpusaufbau und Übersetzungsprüfung sind professionelle Arbeit, bezahlt zu [veröffentlichten Sätzen](/docs/network/perspectives/how-speakers-get-paid) — und die Bezahlung erwirbt nicht Ihre Daten. Sie werden für die Arbeit bezahlt *und* bleiben Eigentümer dessen, was Sie erstellen. Champollion ist ein nicht-kommerzielles Forschungsprojekt: Es verkauft nichts, misst nichts ab und [beansprucht keinen Anteil](/docs/network/sovereignty/economic-model) an dem, was Ihre Gemeinschaft jemals mit einer Methode verdient, die ihr gehört.

### Kontrolle

Ihre Governance-Organisation kontrolliert:
- Wer auf die Methode zugreifen kann
- Ob sie kommerziell genutzt werden kann — und falls ja, zu Ihren Bedingungen, wobei alles, was sie einbringt, bei Ihnen bleibt
- Wann und wie sie aktualisiert wird
- Welche Daten für die weitere Entwicklung verwendet werden

---

## So beteiligen Sie sich

:::tip[Etwas, das Sprecherinnen und Sprecher heute tun können]
Champollion erstellt oder hostet keine Korpora — Testdaten werden stets
aus ihrer Quelle abgerufen. Wenn Sprecherinnen und Sprecher in Ihrer Community
*jetzt sofort* Sätze beitragen möchten, akzeptiert [Tatoeba](https://tatoeba.org)
Beiträge Satz für Satz in jeder Sprache, und offene Sammlungen wie
[OPUS](https://opus.nlpl.eu/) aggregieren parallelen Text, aus dem das Network
Benchmarks erstellt. Dort hinzugefügte Sätze können beim nächsten Korpus-Build
hier zu Evaluierungsdaten werden. Eine App für direkte Beiträge von Sprecherinnen
und Sprechern sowie ein Korpus-Builder sind der geplante nächste Schritt auf
unserer Roadmap.
:::

1. **Kontaktieren Sie uns** — Öffnen Sie ein Issue im [Network-Repository](https://github.com/gamedaysuits/Champollion) oder senden Sie eine E-Mail an [info@champollion.dev](mailto:info@champollion.dev)
2. **Beschreiben Sie Ihre Sprache** — Zu welcher Sprachfamilie gehört sie? Wie viele Sprecher gibt es? Welche Schriftsysteme werden verwendet? Welche computergestützten Ressourcen existieren (FSTs, Wörterbücher, Korpora)?
3. **Fangen Sie klein an** — Schon 50 kuratierte Übersetzungspaare genügen, um einen Evaluierungsdatensatz zu erstellen und eine neue Bestenlisten-Kategorie zu eröffnen. Korpusarbeit wird [zu veröffentlichten Sätzen bezahlt](/docs/network/perspectives/how-speakers-get-paid)
4. **Behalten Sie es in Ihrer Hand** — Registrieren Sie das Korpus als Metadaten in der von Ihnen gewählten Stufe ([Korpora registrieren](/docs/network/sovereignty/registering-corpora)); wenn Sie möchten, dass das Testset vollständig geheim bleibt, ist das [Handbuch für souveräne Wettbewerbe](/docs/network/sovereignty/run-a-sovereign-contest) der richtige Weg
5. **Verbinden Sie uns mit der Governance** — Wer in Ihrer Gemeinschaft hat Autorität über Sprachdaten und -technologie? Das Souveränitätsmodell des Network erfordert einen Governance-Partner

---

## Siehe auch

- [Einen souveränen Wettbewerb durchführen](/docs/network/sovereignty/run-a-sovereign-contest) — das Handbuch für eine von der Gemeinschaft kontrollierte Evaluierung
- [Vorlagen für Bedingungen](/docs/network/sovereignty/terms-templates) — rechtlich einfache, auf Vertrauensfreiheit ausgelegte Bedingungen, die Ihre Gemeinschaft anpassen kann, mit ausbuchstabierten Trojaner-Risiken
- [Datenverwaltung](/docs/network/sovereignty/data-sovereignty) — die Position und die Rahmenwerke (CARE, Te Mana Raraunga und andere Instrumente indigener Datensouveränität), die sie geprägt haben
- [Eigentum & Bedingungen](/docs/network/sovereignty/ownership-transfer) — sprachspezifische Bedingungen und was geschieht, wenn eine Methode gewinnt
- [Wie die Arbeit finanziert wird](/docs/network/sovereignty/economic-model) — wohin das Geld in einem nicht-kommerziellen Projekt fließt
- [Eine ressourcenarme Sprache unterstützen](/docs/network/community/low-resource-languages) — technischer Kontext für Forschende, die an der Seite von Gemeinschaften arbeiten
