---
sidebar_position: 4
title: "Fehler melden und Korrekturen verantworten"
slug: '/network/perspectives/reporting-errors-and-owning-corrections'
description: "Wie eine sprechende Person eine falsche Tatsache oder eine fehlerhafte Übersetzung meldet, wer über das weitere Vorgehen entscheidet, wie Korrekturen ihre Herkunft mitführen und warum Gemeinschaften ein Vetorecht über ihre Sprachdaten besitzen."
related:
  - label: "Data Sovereignty"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "Who holds veto power over language data"
  - label: "Ownership Transfer"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Speaker Validation Protocol"
    to: /docs/network/specifications/speaker-validation
    kind: spec
  - label: "How Speakers Get Paid"
    to: /docs/network/perspectives/how-speakers-get-paid
    kind: position
---

# Fehler melden und Korrekturen verantworten

> **Standpunkt.** Für eine Plattform, die Fakten und Bewertungen über Tausende von Sprachen veröffentlicht, ist es unvermeidlich, sich zu irren. Was *nicht* unvermeidlich ist: wem geglaubt wird, wenn ein Fehler gemeldet wird, und wer die Korrektur verantwortet. Unsere Antwort: Der Bericht eines fließend Sprechenden hat Vorrang vor unserer Automatisierung, jede Korrektur trägt eine Provenienz, die angibt, wer was und warum geändert hat, und eine Gemeinschaft kann die Nutzung ihrer Sprachdaten zurückziehen oder per Veto untersagen — nicht als Höflichkeit, sondern als durchgesetzte Eigenschaft der Architektur.

Die meisten Datenplattformen behandeln Fehlermeldungen wie Support-Tickets: Ein Nutzer beschwert sich, ein Verantwortlicher entscheidet, der Datensatz ändert sich stillschweigend. Für Daten indigener Sprachen steht dieses Modell auf dem Kopf. Die Person, die den Fehler meldet, ist in der Regel maßgeblicher als die Plattform — ein Sprechender, der uns mitteilt, dass ein Wort falsch ist, ist kein „Nutzer", sondern die Grundwahrheit, die eine Annäherung korrigiert. Das nachstehende Konzept ergibt sich daraus, dies ernst zu nehmen.

---

## Zwei Arten von Fehlern, ein Prinzip

Die Plattform veröffentlicht zwei Arten von Aussagen, die falsch sein können:

1. **Fakten über eine Sprache** — die Sprachkarten, die die Bewertung steuern: Klassifikationsdaten, Orthografie, sprachliche Merkmale, welche Metriken zur Anwendung kommen. Eine Karte könnte die falsche Schätzung der Sprecherzahl, die falsche Dialektbeziehung oder den falschen Status des Schriftsystems angeben.
2. **Urteile über Übersetzungen** — eine Referenzübersetzung in einem Korpus, die ein Sprechender für falsch oder unnatürlich hält; eine automatisierte Metrik, die ein gültiges Wort ablehnt oder ein ungültiges akzeptiert; ein „Deployable"-Abzeichen an einer Ausgabe, die Sprechende nicht akzeptieren würden.

Das für beide geltende Prinzip, das bereits in der [Scoring-Spezifikation](/docs/network/specifications/scoring) und der [Benchmark-Spezifikation §7](/docs/network/specifications/benchmark#7-human-validation) verbindlich ist: **Automatisierte Ausgaben sind Annäherungen; Sprechende sind die Grundwahrheit.** Die im [Speaker-Validation-Protokoll §6](/docs/network/specifications/speaker-validation#6-what-speakers-get) veröffentlichte Verpflichtung formuliert es unmissverständlich: Wenn ein Sprechender sagt, dass der Linter sich in einer Sache irrt, beheben wir den Linter.

## Wie eine Meldung verläuft

Hier ist der Weg, den eine Meldung nimmt, mit ehrlichen Statusmarkierungen — manches davon ist heute in Betrieb, manches ist spezifiziert und noch nicht umgesetzt.

**Eine schlechte Übersetzung oder ein Metrik-Urteil melden (heute in Betrieb, über direkten Kanal).** Ein Sprechender, der eine falsche Referenzübersetzung, ein fälschlich abgelehntes Wort oder ein inakzeptables „Äquivalent" sieht, kann dies über den Issue-Tracker des öffentlichen Repositorys des Projekts oder durch direkte Kontaktaufnahme mit dem Projekt melden. Die strukturierte Version davon — Bewertungsbildschirme mit den Optionen *reject / gist / acceptable / excellent* und Freitextnotizen — ist die Schnittstelle zur Community-Überprüfung, die in der [Benchmark-Spezifikation §7.3](/docs/network/specifications/benchmark#7-human-validation) spezifiziert, aber noch nicht aktiv ist. Bis es so weit ist, werden Meldungen von Person zu Person bearbeitet, und die Validierungsaufgaben selbst (bezahlte, strukturierte Sprecherüberprüfung — siehe [Wie Sprechende bezahlt werden](/docs/network/perspectives/how-speakers-get-paid)) bilden die wichtigste Korrekturpipeline.

**Einen falschen Fakt auf einer Sprachkarte melden (heute in Betrieb, dieselben Kanäle).** Kartenkorrekturen folgen demselben Weg: Meldung, Überprüfung, versionierte Änderung. Da Karten das Bewertungsverhalten steuern — welche Metriken geladen, welche Modelle empfohlen werden — kann eine Kartenkorrektur Bewertungen verändern, weshalb Korrekturen als aufgezeichnete Datenänderungen angewendet werden, niemals als stillschweigende Bearbeitungen.

**Was als Nächstes geschieht — wer entscheidet:**

- **Sprachliche Ermessensentscheidungen liegen bei den Sprechenden der jeweiligen Sprache.** Ob eine Form gültig ist, ob zwei Formulierungen äquivalent sind, ob ein Register angemessen ist — die Plattform setzt die Antwort um; sie liefert sie nicht. Wo Sprechende uneins sind (Dialekte, orthografische Konventionen), wird die Antwort als Variation aufgezeichnet, nicht von uns entschieden — die Korpus- und Linter-Schemata unterstützen das Markieren dialektaler Varianten als akzeptable Alternativen, anstatt einen Gewinner zu erzwingen.
- **Entscheidungen über die Daten einer Gemeinschaft liegen bei ihrer Governance-Organisation.** Für Sprachen mit einer Governance-Organisation laufen Änderungen an Bewertungskorpora, die Aufnahme von Korrekturen in versiegelte Testsätze und Bereitstellungskonsequenzen über diese — das ist die Kontrolle der Gemeinschaft über ihre Sprachdaten — siehe [Datensouveränität](/docs/network/sovereignty/data-sovereignty) —, umgesetzt als Prozess, nicht als Plakat.
- **Mechanische Fehler werden einfach behoben.** Ein Tippfehler, ein defekter Link, ein falsch geparstes Feld — gemeldet, korrigiert, protokolliert. Nicht alles braucht ein Gremium.

## Korrekturen tragen eine Provenienz

Eine Korrektur, die Sie nicht nachverfolgen können, ist nur eine neuere Meinung. Drei Provenienzregeln gelten für jeden Fakt und jede Korrektur:

1. **Jeder Fakt benennt seine Quelle.** Sprachkarten und Korpuseinträge halten fest, woher jeder Wert stammt — ein veröffentlichter Datensatz, ein Beitrag der Gemeinschaft, die Überprüfung eines Sprechenden.
2. **Abgeleitete Werte werden als unsere gekennzeichnet, nicht als die der Quelle.** Wenn die Plattform etwas berechnet — einen Aggregatwert, eine Umkodierung, eine Zusammensetzung — wird es als Ableitung der Plattform *aus* der vorgelagerten Quelle aufgezeichnet, niemals unter dem Namen der Quelle geführt. Ein vorgelagerter Datensatz sollte niemals für eine Zahl getadelt oder gelobt werden, die er nicht veröffentlicht hat.
3. **Korrekturen werden Teil des Datenbestands.** Die Korrektur eines Sprechenden wird als neue, zugeschriebene Aussage aufgezeichnet (benannt oder anonym, nach Wahl des Sprechenden — zu denselben Bedingungen wie die Validierungsarbeit), die den alten Wert ersetzt; die Historie dessen, was geändert wurde, bleibt prüfbar. Korpusversionen sind mit Hash-Manifesten versehen ([Corpus Partnership §4.4](/docs/network/specifications/corpus-partnership)), sodass ein korrigiertes Korpus eine sichtbar neue Version ist, und jede Run-Card hält genau fest, gegen welche Version es bewertet wurde — alte Bewertungen bleiben interpretierbar, neue Bewertungen spiegeln die Korrektur wider.

## Das Veto, konkret

„Kontrolle durch die Gemeinschaft" ist leicht behauptet. Hier ist, was es in der veröffentlichten Architektur konkret bedeutet:

- **Sprechende können ihre Beiträge zurückziehen.** Ein Sprechender kann seine Bewertungen jederzeit zurückziehen, und der Rückzug entfernt sie aus allen Analysen ([Speaker Validation §5](/docs/network/specifications/speaker-validation#5-data-governance)). Sprechende verfügen außerdem über ein Vetorecht gegen die Veröffentlichung von Ergebnissen, die sie als problematisch erachten.
- **Gemeinschaften können die Bewertung vollständig stoppen.** Versiegelte Testsätze sind verschlüsselt, wobei die Schlüssel so verwahrt werden, dass die Plattform allein sie niemals rekonstruieren kann; eine Gemeinschaft kann den Bewertungszugriff widerrufen, indem sie die Teilnahme an der Schlüsselrekonstruktion verweigert ([Corpus Partnership §4.3](/docs/network/specifications/corpus-partnership#4-cryptographic-sealing-and-sandbox-testing)). „Was, wenn wir aufhören möchten?" hat eine spezifizierte Antwort: Die versiegelten Daten werden niemals offengelegt, und die Bewertung endet.
- **Keine Bewertung setzt sich über eine Entscheidung der Gemeinschaft hinweg.** Eine Methode, die die Bestenliste anführt, wird nur dann bereitgestellt, wenn die Governance-Organisation dies sagt ([Ownership Transfer](/docs/network/sovereignty/ownership-transfer)) — und eine Gemeinschaft, die entscheidet, dass maschinelle Übersetzung für ihre Sprache überhaupt nicht eingesetzt werden soll, nutzt das System wie vorgesehen, ohne es zu brechen (siehe [Übersetzung ist keine Revitalisierung](/docs/network/perspectives/translation-is-not-revitalization)).

## Was wir noch nicht gebaut haben

Im Sinne des restlichen Inhalts dieser Sammlung: Die Schnittstelle zur Community-Überprüfung ist geplant, nicht in Betrieb. Für keine der aktuellen Sprachen sind bislang Governance-Organisationen eingerichtet — die Treuhänderschaft der Gemeinschaft für den Plains-Cree-Benchmark befindet sich in Bestätigung, und wir nennen Treuhänder nicht öffentlich, bevor sie eingewilligt haben. Bis diese Bestandteile existieren, laufen Korrekturen über direkte, zuschreibbare Kanäle, und die veröffentlichten Spezifikationen — nicht diese Seite — bleiben die verbindliche Beschreibung des Prozesses. Wo diese Seite und eine Spezifikation voneinander abweichen, gilt die Spezifikation, und wir würden die Abweichung ebenfalls als meldenswerten Fehler betrachten.

---

## Was das für Sie bedeutet

:::info[Wenn Sie ein Community-Mitglied sind]
Wenn etwas über Ihre Sprache auf dieser Plattform falsch ist – eine Tatsache, eine Übersetzung, eine Bezeichnung –, dann ist Ihre Meldung ein Zeugnis aus erster Hand und keine Beschwerde, die es zu bearbeiten gilt. Sie entscheiden, ob Ihre Korrektur namentlich gutgeschrieben wird; Ihr Beitrag kann später zurückgezogen werden; und Ihre Community kann die Nutzung ihrer Daten vollständig unterbinden. Beginnen Sie bei [Für Sprachgemeinschaften](/docs/network/community/for-language-communities) oder eröffnen Sie einfach ein Issue im öffentlichen Repository.
:::

:::info[Wenn Sie ein Forscher sind]
Korrekturen sind hier Daten mit Herkunftsnachweis, keine stillen Bearbeitungen: Korpusversionen werden gehasht, Run Cards fixieren die exakte Version, gegen die sie bewertet wurden, und abgeleitete Werte werden als Ableitungen gekennzeichnet. Wenn Sie auf Network-Scores oder Korpora aufbauen, zitieren Sie die Version – und behandeln Sie eine von Sprechern getriebene Korrekturwelle als Befund über die Validität einer Metrik, denn genau das ist sie.
:::

:::info[Wenn Sie ein Entwickler sind]
Der Score Ihrer Methode kann sich legitim ändern, ohne dass sich Ihr Code ändert – ein fälschlicherweise abgelehntes Wort wird auf die Allowlist gesetzt, eine Referenzübersetzung wird korrigiert, eine Variantenklasse wird behoben. Richten Sie sich darauf ein: Fixieren Sie Korpusversionen in Ihren Run Cards ([Run-Card-Spezifikation](/docs/network/specifications/run-card)), beobachten Sie Datensatz-Changelogs und behandeln Sie Sprecherkorrekturen als das zuverlässigste Fehlersignal, das Sie je kostenlos erhalten werden.
:::

## Siehe auch

- [Wie Sprechende bezahlt werden](/docs/network/perspectives/how-speakers-get-paid) — dieselbe Autorität der Sprechenden, auf der Benchmark-Ebene
- [Vom Benchmark zur täglichen Nutzung](/docs/network/perspectives/from-benchmark-to-daily-use) — wo Korrekturen auf den Veröffentlichungsworkflow treffen
- [Datensouveränität](/docs/network/sovereignty/data-sovereignty) — indigene Prinzipien der Datensouveränität, CARE und Te Mana Raraunga, die Prinzipien hinter diesem Konzept
