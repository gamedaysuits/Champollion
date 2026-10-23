---
sidebar_position: 4
title: "Fehler melden und Korrekturen verantworten"
slug: '/network/perspectives/reporting-errors-and-owning-corrections'
description: "Wie eine sprechende Person eine falsche Tatsache oder eine fehlerhafte Übersetzung meldet, wer über das weitere Vorgehen entscheidet, wie Korrekturen ihre Herkunft mitführen und warum Gemeinschaften ein Vetorecht über ihre Sprachdaten besitzen."
related:
  - label: "Data Sovereignty"
    to: /docs/your-words-your-rules
    kind: doc
    note: "Who holds veto power over language data"
  - label: "Ownership Transfer"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Speaker Validation Protocol"
    to: /docs/network/specifications/speaker-validation
    kind: spec
  - label: "Working with speakers"
    to: /docs/working-with-speakers
    kind: position
---

# Fehler melden und Korrekturen verantworten

> **Standpunkt.** Fehler sind für eine Plattform, die Fakten und Auswertungen zu vielen Sprachen veröffentlicht, unvermeidlich. Was jedoch *nicht* unvermeidlich ist: wem geglaubt wird, wenn ein Fehler gemeldet wird, und wer die Korrektur bestimmt. Unsere Antwort darauf: Die Meldung einer Person mit fließenden Sprachkenntnissen wiegt schwerer als unsere Automatisierung; jede Korrektur enthält Herkunftsangaben darüber, wer was und warum geändert hat; und eine Gemeinschaft kann die Nutzung ihrer Sprachdaten widerrufen oder ein Veto dagegen einlegen – nicht aus Kulanz, sondern als eine durch die Architektur erzwungene Eigenschaft.

Die meisten Datenplattformen behandeln Fehlermeldungen wie Support-Tickets: Ein Nutzer beschwert sich, ein Verantwortlicher entscheidet, der Datensatz ändert sich stillschweigend. Für Daten indigener Sprachen steht dieses Modell auf dem Kopf. Die Person, die den Fehler meldet, ist in der Regel maßgeblicher als die Plattform — ein Sprechender, der uns mitteilt, dass ein Wort falsch ist, ist kein „Nutzer", sondern die Grundwahrheit, die eine Annäherung korrigiert. Das nachstehende Konzept ergibt sich daraus, dies ernst zu nehmen.

---

## Zwei Arten von Fehlern, ein Prinzip

Die Plattform veröffentlicht zwei Arten von Aussagen, die falsch sein können:

1. **Fakten über eine Sprache** – die Sprachkarten, die die Evaluation steuern: Klassifikationsdaten, Orthografie, linguistische Merkmale, welche Metriken gelten. Eine Karte könnte eine falsche Sprecherzahlenschätzung, eine falsche Dialektbeziehung oder einen falschen Status des Schriftsystems angeben.
2. **Beurteilungen von Übersetzungen** – eine Referenzübersetzung in einem Korpus, die ein Sprecher als falsch oder unnatürlich ansieht; eine automatisierte Metrik, die ein gültiges Wort ablehnt oder ein ungültiges akzeptiert; eine hohe automatische Bewertung für eine Ausgabe, die Sprecher nicht akzeptieren würden.

Das für beide geltende Prinzip, das bereits in der [Scoring-Spezifikation](/docs/network/specifications/scoring) und der [Benchmark-Spezifikation §7](/docs/network/specifications/benchmark#7-human-validation) verbindlich ist: **Automatisierte Ausgaben sind Annäherungen; Sprechende sind die Grundwahrheit.** Die im [Speaker-Validation-Protokoll §6](/docs/network/specifications/speaker-validation#6-what-speakers-get) veröffentlichte Verpflichtung formuliert es unmissverständlich: Wenn ein Sprechender sagt, dass der Linter sich in einer Sache irrt, beheben wir den Linter.

## Wie eine Meldung verläuft

Hier ist der Weg, den eine Meldung nimmt, mit ehrlichen Statusmarkierungen — manches davon ist heute in Betrieb, manches ist spezifiziert und noch nicht umgesetzt.

**Melden einer fehlerhaften Übersetzung oder Metrik-Beurteilung (bereits heute über direkte Kanäle möglich).** Sprecherinnen und Sprecher, die eine falsche Referenzübersetzung, ein fälschlicherweise abgelehntes Wort oder ein unannehmbares „Äquivalent“ bemerken, können dies über den Issue-Tracker des öffentlichen Projekt-Repositorys oder durch direkte Kontaktaufnahme mit dem Projekt melden. Die strukturierte Fassung hiervon – Bewertungsmasken mit den Optionen *Ablehnen / Kernbotschaft / Annehmbar / Ausgezeichnet* sowie Freitextnotizen – ist die Schnittstelle für die Überprüfung durch Gemeinschaften, die in der [Benchmark-Spezifikation §7.3](/docs/network/specifications/benchmark#7-human-validation) beschrieben, aber noch nicht freigeschaltet ist. Bis dahin werden Meldungen persönlich bearbeitet, und die Validierungsaufgaben selbst (bezahlte, strukturierte Überprüfung durch Sprechende – siehe [Zusammenarbeit mit Sprechenden](/docs/working-with-speakers)) bilden den zentralen Pfad für Korrekturen.

**Einen falschen Fakt auf einer Sprachkarte melden (heute in Betrieb, dieselben Kanäle).** Kartenkorrekturen folgen demselben Weg: Meldung, Überprüfung, versionierte Änderung. Da Karten das Bewertungsverhalten steuern — welche Metriken geladen, welche Modelle empfohlen werden — kann eine Kartenkorrektur Bewertungen verändern, weshalb Korrekturen als aufgezeichnete Datenänderungen angewendet werden, niemals als stillschweigende Bearbeitungen.

**Was als Nächstes geschieht — wer entscheidet:**

- **Linguistische Ermessensentscheidungen liegen bei den Sprechenden der jeweiligen Sprache.** Ob eine Form gültig ist, ob zwei Formulierungen gleichwertig sind, ob ein Register angemessen ist – die Plattform setzt die Antwort um; sie liefert sie nicht selbst. Wenn Sprechende uneins sind (Dialekte, orthografische Konventionen), wird die Antwort als Variation erfasst und nicht von uns entschieden – die Schemas für Korpora und Linter unterstützen die Kennzeichnung dialektaler Varianten als annehmbare Alternativen, statt eine einzige Variante als Sieger durchzusetzen.
- **Entscheidungen über die Daten einer Gemeinschaft liegen bei deren Selbstverwaltungsorganisation.** Bei Sprachen mit einer solchen Organisation laufen Änderungen an Evaluierungskorpora, die Aufnahme von Korrekturen in versiegelte Testsätze und Konsequenzen für die Bereitstellung über diese Stelle – das bedeutet gemeinschaftliche Kontrolle über Sprachdaten – siehe [Ihre Wörter, Ihre Regeln](/docs/your-words-your-rules) – umgesetzt als Prozess, nicht als Lippenbekenntnis.
- **Technische Fehler werden einfach behoben.** Ein Tippfehler, ein defekter Link, ein fehlerhaft analysiertes Feld – gemeldet, korrigiert, protokolliert. Nicht alles erfordert ein Gremium.

## Korrekturen tragen eine Provenienz

Eine Korrektur, die Sie nicht nachverfolgen können, ist nur eine neuere Meinung. Drei Provenienzregeln gelten für jeden Fakt und jede Korrektur:

1. **Jeder Fakt nennt seine Quelle.** Sprachkarten und Korpuseinträge halten fest, woher jeder Wert stammt – aus einem veröffentlichten Datensatz, einem Beitrag aus der Gemeinschaft oder der Überprüfung durch Sprechende.
2. **Abgeleitete Werte werden als unsere gekennzeichnet, nicht als die der vorgelagerten Quelle.** Wenn die Plattform etwas berechnet – ein Aggregat, eine Neukodierung, eine Zusammensetzung –, wird dies als Plattform-Ableitung *aus* der vorgelagerten Quelle erfasst, niemals unter dem Namen der vorgelagerten Quelle geführt. Einem vorgelagerten Datensatz sollte niemals eine Zahl angelastet oder zugeschrieben werden, die er nicht selbst veröffentlicht hat.
3. **Korrekturen werden Teil der Aufzeichnungen.** Die Korrektur durch Sprechende wird als neue, zugeordnete Aussage festgehalten (je nach Wunsch der sprechenden Person namentlich oder anonym – dieselben Bedingungen wie bei der Validierungsarbeit), die den alten Wert ersetzt; der Verlauf der Änderungen bleibt nachvollziehbar. Korpusversionen sind über Hash-Manifeste erfasst ([Registrieren von Korpora](/docs/network/sovereignty/registering-corpora)), sodass ein korrigiertes Korpus sichtbar eine neue Version darstellt und jede Ausführungskarte exakt dokumentiert, anhand welcher Version bewertet wurde – alte Ergebnisse bleiben interpretierbar, neue Ergebnisse spiegeln die Korrektur wider.

## Das Veto, konkret

„Kontrolle durch die Gemeinschaft" ist leicht behauptet. Hier ist, was es in der veröffentlichten Architektur konkret bedeutet:

- **Sprechende können ihre Beiträge zurückziehen.** Sprechende können ihre Bewertungen jederzeit zurückziehen, und ein solcher Widerruf entfernt diese aus sämtlichen Analysen ([Validierung durch Sprechende §5](/docs/network/specifications/speaker-validation#5-data-governance)). Sprechende haben zudem ein Vetorecht gegen die Veröffentlichung von Ergebnissen, die sie als problematisch ansehen.
- **Gemeinschaften können die Evaluierung vollständig beenden.** Versiegelte Testsätze sind verschlüsselt, und Champollion besitzt keine Schlüsselanteile; die Plattform allein kann sie somit niemals wiederherstellen. Derzeit werden die Schlüssel versiegelter Sätze von den Organisatoren verwahrt – Schlüsselbeauftragte der Gemeinschaften: noch keine ernannt. Sobald von einer Gemeinschaft benannte Beauftragte Anteile am Schlüssel eines Satzes halten, können sie die Evaluierung beenden, indem sie sich der Wiederherstellung des Schlüssels verweigern ([Registrieren von Korpora](/docs/network/sovereignty/registering-corpora)). Auf die Frage „Was ist, wenn wir aufhören möchten?“ gibt es eine eindeutige Antwort: Die versiegelten Daten werden niemals offengelegt, und die Evaluierung endet.
- **Kein Ergebnis überstimmt eine Entscheidung der Gemeinschaft.** Ein Platz auf der Bestenliste gibt niemandem die Erlaubnis, eine Methode für die Sprache einer Gemeinschaft bereitzustellen ([Eigentumsübertragung](/docs/network/sovereignty/ownership-transfer)) – und wenn eine Gemeinschaft entscheidet, dass maschinelle Übersetzung für ihre Sprache überhaupt nicht eingesetzt werden soll, nutzt sie das System genau wie vorgesehen, statt es zu durchbrechen (siehe [Übersetzung ist keine Revitalisierung](/docs/network/perspectives/translation-is-not-revitalization)).

## Was wir noch nicht gebaut haben

Ganz im Sinne des Rests dieses Bereichs: Die Schnittstelle für die Überprüfung durch die Gemeinschaft ist geplant, noch nicht live. Für keine der aktuellen Sprachen sind bislang Governance-Organisationen eingerichtet – für keinen Benchmark wurden bisher Treuhänder aus den Gemeinschaften ernannt, Plains Cree eingeschlossen, und wir nennen Treuhänder nicht öffentlich, bevor sie zugestimmt haben. Bis diese Komponenten existieren, laufen Korrekturen über direkte, nachvollziehbare Kanäle, und die veröffentlichten Spezifikationen – nicht diese Seite – bleiben die verbindliche Beschreibung des Prozesses. Wenn diese Seite und eine Spezifikation voneinander abweichen, gilt die Spezifikation, und wir würden diese Diskrepanz ebenfalls als meldenswerten Fehler betrachten.

---

## Was das für Sie bedeutet

:::info[Wenn Sie Mitglied einer Gemeinschaft sind]
Wenn Angaben zu Ihrer Sprache auf dieser Plattform fehlerhaft sind – ein Fakt, eine Übersetzung, eine Bezeichnung –, ist Ihre Meldung ein Zeugnis der tatsächlichen Gegebenheiten, keine Beschwerde, die abgewickelt werden muss. Sie entscheiden, ob Ihre Korrektur namentlich genannt wird; Ihr Beitrag kann später zurückgezogen werden; und Ihre Gemeinschaft kann die Nutzung ihrer Daten vollständig stoppen. Beginnen Sie bei [Ihre Wörter, Ihre Regeln](/docs/your-words-your-rules) oder eröffnen Sie einfach ein Issue im öffentlichen Repository.
:::

:::info[Wenn Sie ein Forscher sind]
Korrekturen sind hier Daten mit Herkunftsnachweis, keine stillen Bearbeitungen: Korpusversionen werden gehasht, Run Cards fixieren die exakte Version, gegen die sie bewertet wurden, und abgeleitete Werte werden als Ableitungen gekennzeichnet. Wenn Sie auf Network-Scores oder Korpora aufbauen, zitieren Sie die Version – und behandeln Sie eine von Sprechern getriebene Korrekturwelle als Befund über die Validität einer Metrik, denn genau das ist sie.
:::

:::info[Wenn Sie ein Entwickler sind]
Der Score Ihrer Methode kann sich legitim ändern, ohne dass sich Ihr Code ändert – ein fälschlicherweise abgelehntes Wort wird auf die Allowlist gesetzt, eine Referenzübersetzung wird korrigiert, eine Variantenklasse wird behoben. Richten Sie sich darauf ein: Fixieren Sie Korpusversionen in Ihren Run Cards ([Run-Card-Spezifikation](/docs/network/specifications/run-card)), beobachten Sie Datensatz-Changelogs und behandeln Sie Sprecherkorrekturen als das zuverlässigste Fehlersignal, das Sie je kostenlos erhalten werden.
:::

## Siehe auch

- [Zusammenarbeit mit Sprechenden](/docs/working-with-speakers) — dieselbe Autorität der Sprechenden in der Benchmark-Phase
- [In die Praxis umsetzen](/docs/put-it-to-work) — wo Korrekturen auf den Veröffentlichungsablauf treffen
- [Ihre Worte, Ihre Regeln](/docs/your-words-your-rules) — wer darüber entscheidet, was mit Sprachdaten geschieht, was die Werkzeuge durchsetzen und was kein Werkzeug verhindern kann
