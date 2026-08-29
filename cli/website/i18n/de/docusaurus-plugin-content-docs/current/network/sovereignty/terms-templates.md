---
sidebar_position: 10
title: "Vertragsvorlagen"
slug: /network/sovereignty/terms-templates
description: "Anpassbare, auf Trustless-Prinzipien ausgerichtete Vertragsideen für eine Community, die einen souveränen Wettbewerb durchführt — Eigentum, ausschließlich auf Scores basierende Lizenzierung, Hash-fixierte Integrität, Fail-Closed-Standardeinstellungen und ein ehrlicher Überblick über Trojaner-Risiken."
related:
  - label: "Run a Sovereign Contest"
    to: /docs/network/sovereignty/run-a-sovereign-contest
    kind: doc
    note: "The runbook these terms attach to"
  - label: "Ownership & Terms"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
  - label: "Prize Specification"
    to: /docs/network/specifications/prizes
    kind: spec
---

# Vorlagen für Bedingungen

> **Zusammenfassung.** Ausgangspunkt-Bedingungen, die eine Gemeinschaft oder
> Organisation anpassen kann, wenn sie einen [souveränen Wettbewerb](/docs/network/sovereignty/run-a-sovereign-contest)
> durchführt. Die durchgängige Gestaltungsphilosophie ist **vertrauensminimierend
> ausgerichtet**: Wo immer möglich, wird eine Bedingung durch einen Mechanismus
> (einen Hash, ein Gate, ein Append-only-Log) gestützt statt durch ein
> Versprechen. Jede Bedingung besteht aus einem kurzen Absatz sowie einer
> allgemein verständlichen Erläuterung.

:::warning[Dies ist keine Rechtsberatung]
Hierbei handelt es sich um Formulierungs-*ideen* aus einem nicht-kommerziellen
Forschungsprojekt, nicht um Rechtsberatung, und wir sind keine Juristen. Gesetze
unterscheiden sich je nach Rechtsordnung, und indigene Daten-Governance-Rahmenwerke
begründen Verpflichtungen, die keine Vorlage erfüllen kann. Lassen Sie
alles von Ihrem eigenen Rechtsbeistand — und von Ihrem eigenen Governance-Prozess
innerhalb der Gemeinschaft — prüfen, bevor Sie sich darauf verlassen.
:::

---

## Kernbedingungen

### 1. Das Korpus ist und bleibt Eigentum des Eigentümers

*Bedingung.* Das Evaluierungskorpus, alle darin enthaltenen Einträge und alle
abgeleiteten Metadaten bleiben alleiniges Eigentum der registrierenden
Gemeinschaft/Organisation. Keine Nutzung der Registrierungs-, Wettbewerbs- oder
Evaluierungsmaschinerie des Netzwerks überträgt irgendein Recht, einen Titel
oder ein Interesse am Korpus auf die Plattform, auf Methodenentwickler oder auf
einen Sponsor. Die Plattform hält keine Kopie und beansprucht keine Lizenz über
den Digest des verschlüsselten Blobs hinaus.

*Allgemein verständlich:* Wenn Sie einen Wettbewerb gegen Ihr Korpus
durchführen, erhält niemand einen Teil davon. Champollion hält einen Hash,
keinen Anspruch.

### 2. Die Evaluierung gewährt eine reine Punktzahl-Lizenz — nichts weiter

*Bedingung.* Ein autorisierter Evaluierungslauf gewährt der Plattform und dem
Methodenentwickler eine Lizenz zum Empfang und zur Veröffentlichung von
**ausschließlich numerischen Punktzahlen und aggregierten Statistiken**. Er
gewährt **kein** Recht, Korpusinhalte nach dem Lauf zu behalten, **kein** Recht,
darauf ein Modell zu trainieren, feinzujustieren oder zu coachen, und **kein**
Recht, daraus abgeleitete Korpora, memorierte Beispiele oder Nachschlagetabellen
zu erstellen. Jegliche Speicherung von Inhalten über den Lauf hinaus beendet die
Lizenz und macht die Ergebnisse des Laufs ungültig.

*Allgemein verständlich:* Was aus einem versiegelten Lauf herauskommt, ist eine
Zahl. Sätze niemals — weder in eine Bestenliste, noch in einen Trainingsdatensatz,
noch in irgendjemandes Cache.

### 3. Hash-verankerte Integrität: Der Digest wird veröffentlicht, der Inhalt niemals

*Bedingung.* Das Korpus wird ausschließlich durch den veröffentlichten
SHA-256-Digest seines verschlüsselten Blobs und ein Versionslabel identifiziert.
Nur Blobs, die dem Digest entsprechen, gelten als das Korpus; jeder Lauf gegen
nicht übereinstimmende Bytes ist ungültig. Die Veröffentlichung des Digests ist
keine Veröffentlichung des Inhalts, und nichts in diesen Bedingungen verpflichtet
den Eigentümer, den Inhalt jemals irgendjemandem offenzulegen.

*Allgemein verständlich:* Jeder kann überprüfen, *welches* Korpus verwendet
wurde; niemand darf es *lesen*. Wenn die Bytes nicht mit dem Hash übereinstimmen,
zählt der Lauf nicht.

### 4. Fail-Closed-Standardeinstellungen

*Bedingung.* Jede Mehrdeutigkeit wird in Richtung kein Zugriff und keine
Veröffentlichung aufgelöst. Eine Anfrage, die nicht durch die
Verwalter-Schwelle ausdrücklich autorisiert ist, wird abgelehnt; eine
Genehmigung, die abgelaufen ist oder verwendet wurde, ist tot; ein Ergebnis,
dessen Herkunft nicht überprüft werden kann, wird nicht veröffentlicht; ein
Korpus, dessen Registrierung verfällt, kann nicht mehr ausgeführt werden.
Schweigen stellt niemals eine Zustimmung dar.

*Allgemein verständlich:* Im Zweifelsfall lautet die Antwort nein. Nichts ist
standardmäßig offen.

### 5. Die Verwalter-Autorisierung sichert jeden Lauf

*Bedingung.* Keine Evaluierung darf gegen das versiegelte Korpus ausgeführt
werden ohne eine aufgezeichnete, schwellenwertgenehmigte Autorisierung und eine
einmalig verwendbare, zeitlich begrenzte Genehmigung, die an die spezifische
Methode, Korpusversion und Evaluierungsumgebung gebunden ist. Alle
Autorisierungsereignisse, einschließlich Ablehnungen und blockierter Versuche,
werden in einem Append-only-Audit-Log aufgezeichnet, das öffentlich abspielbar
ist.

*Allgemein verständlich:* Ihre Verwalter genehmigen jeden einzelnen Lauf, einen
Lauf nach dem anderen, und die gesamte Historie ist öffentlich und
manipulationssicher. (Das kryptografische Werkzeug zur Schwellenwert-Signierung
befindet sich noch in Entwicklung — siehe die
[Statusbox im Runbook](/docs/network/sovereignty/run-a-sovereign-contest) —
sodass diese Bedingung heute als aufgezeichneter Prozess durchgesetzt wird und
noch nicht als Mathematik.)

### 6. Preisgelder werden vom Sponsor gehalten, und die Vergaberegel ist öffentlich

*Bedingung.* Preisgelder werden von der benannten Sponsororganisation oder einem
benannten Gemeinschaftstreuhandfonds gehalten — niemals von der Plattform. Die
Vergabeschwelle wird vor Eröffnung des Wettbewerbs veröffentlicht, ist anhand
der veröffentlichten Punktzahlen sowie des eigenen Sprecher-Validierungsurteils
der Gemeinschaft überprüfbar, und die Vergabeentscheidung gehört allein dem
Halter der Gelder.

*Allgemein verständlich:* Das Geld liegt bei demjenigen, der es bereitgestellt
hat, die Messlatte ist öffentlich, und ob die Messlatte übersprungen wurde, kann
von jedem überprüft werden. Champollion kann einen Preis nicht zahlen,
zurückhalten oder umleiten, weil Champollion das Geld niemals hält.

---

## Trojaner-Risiken {#trojan-horse-risks}

Ein ehrliches Bedingungsdokument benennt die Wege, auf denen die Vereinbarung
angegriffen werden kann. Nehmen Sie diese in Ihres auf — ein Sponsor oder eine
Gemeinschaft, die sie gelesen hat, ist schwerer zu übervorteilen.

### Bösartige Methodeneinreichungen, die versuchen, die Testdaten zu exfiltrieren

Eine „Methode" ist eingereichter Code. Ein feindseliger kann versuchen,
Testsätze herauszuschmuggeln — indem er sie in seinen Ausgaben kodiert, sie in
Logs schreibt oder nach Hause telefoniert.
**Gegenmaßnahmen:** Ausschließliche Punktzahl-Ausgabe (der pro-Eintrag-Ausgabetext
aus versiegelten Läufen wird niemals veröffentlicht — heute auf Datenebene
durchgesetzt); eine **egress-freie Sandbox** für versiegelte Ausführung (🔲 in
Entwicklung — bis sie ausgeliefert wird, betrachten Sie diese Gegenmaßnahme als
teilweise und gewichten Sie die Genehmigungen Ihrer Verwalter entsprechend); und
**Abfrage-/Laufbudgets pro Methode pro Runde** — eine Methode erhält eine kleine,
feste Anzahl versiegelter Läufe, sodass das Korpus selbst durch den
Punktzahl-Kanal nicht durch wiederholtes Sondieren rekonstruiert werden kann.

### Vergiftete oder kontaminierte eingereichte Korpora

Der Angriff kann auch in umgekehrter Richtung erfolgen: Jemand bietet einer
Gemeinschaft ein „gebrauchsfertiges" Testkorpus an, das auf subtile Weise
fehlerhaft, anstößig oder bereits öffentlich ist (sodass Methoden es memoriert
haben und die Punktzahlen bedeutungslos sind).
**Gegenmaßnahmen:** Herkunftsanforderungen an jeden Eintrag (wer ihn verfasst
hat, wann, aus welcher Quelle); [Sprecher-Validierung](/docs/network/specifications/speaker-validation)
des Korpus selbst vor der Versiegelung; und Kontaminationsprüfung gegen
öffentliche Daten, bevor ein Korpus als Qualifikations- oder Goldstandard
akzeptiert wird.

### Lizenz-Trojaner in Abhängigkeiten

Eine siegreiche Methode, die stillschweigend Inhalte oder Code bündelt, deren
Lizenz die beabsichtigte Nutzung der Gemeinschaft (kommerzieller Einsatz,
Weiterverbreitung) untersagt, vergiftet die Übertragung — Sie gewinnen ein
Werkzeug, das Sie rechtlich nicht nutzen dürfen.
**Gegenmaßnahmen:** Deklarationen der Abhängigkeitsklassen und ein mechanisches
Lizenz-Gate bei Einreichungen (siehe die Abhängigkeitsklassen-Tabelle in der
[Preis-Spezifikation](/docs/network/specifications/prizes)); nicht deklarierte
Abhängigkeiten führen zur Disqualifikation.

### Credential-Phishing

Jeder, der einen Wettbewerb durchführt, wird zum Ziel für Angriffe der Art „Fügen
Sie hier Ihren Token ein, um Ihre Registrierung zu verifizieren".
**Gegenmaßnahmen:** Fügen Sie niemals Tokens, Schlüssel oder Zugangsdaten in
Drittanbieterseiten ein und teilen Sie sie nicht im Chat; sämtliche
Authentifizierung in diesem Projekt erfolgt über den OAuth-Flow der CLI, und
**es gibt keine Browser-Flows für persönliche Zugriffstoken mehr** — jede Seite,
die danach fragt, ist feindselig. Verwalter-Entscheidungen sollten über Kanäle
erfolgen, denen Ihre Gemeinschaft bereits vertraut.

### Zahlungsausfall des Sponsors beim Preisgeld

Der stille Fehlermodus: Methoden überspringen die Messlatte, und der Sponsor
zahlt nicht. **Gegenmaßnahmen:** Veröffentlichen Sie die Identität des
Geldhalters und die Verwahrungsvereinbarung (Organisationskonto,
Treuhandfonds, Treuhandagent) *bevor* der Wettbewerb eröffnet wird; machen Sie
die Vergabebedingungen anhand der veröffentlichten Punktzahlen überprüfbar,
sodass ein Zahlungsausfall öffentlich als Ausfall sichtbar ist und nicht als
Ermessensentscheidung geleugnet werden kann; und bevorzugen Sie einen Halter,
der reputationell etwas zu verlieren hat. Champollion kann dieses Risiko nicht
absichern — konstruktionsbedingt hält es die Gelder niemals — sodass die
Glaubwürdigkeit eines Preises genau die Glaubwürdigkeit seines benannten Halters
ist.

---

## Verwendung dieser Vorlagen

Kopieren Sie, was passt, löschen Sie, was nicht passt, ergänzen Sie, was Ihre
Governance erfordert, und veröffentlichen Sie das Ergebnis zusammen mit Ihrem
Wettbewerb, sodass die Teilnehmer *Ihren* Bedingungen zustimmen und nicht einem
Bauchgefühl. Bedingungen pro Gemeinschaft — einschließlich der Übertragung des
Methodeneigentums bei gesponserten Preisen — sind hier die Norm, nicht die
Ausnahme: siehe [Eigentum & Bedingungen](/docs/network/sovereignty/ownership-transfer).
