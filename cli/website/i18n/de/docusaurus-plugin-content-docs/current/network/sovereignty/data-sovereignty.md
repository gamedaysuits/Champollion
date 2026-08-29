---
sidebar_position: 7
title: "Datenverantwortung"
description: "Champollions Haltung zu Sprachdaten: Korpora verbleiben bei ihren Verwalter:innen, jede Lizenz wird respektiert, und Community-Bedingungen regeln Community-Daten."
related:
  - label: "The Derived-Artifacts Commitment"
    to: /docs/network/sovereignty/derived-artifacts
    kind: doc
    note: "The output side: models and derived artifacts belong to speakers"
  - label: "Registering Corpora & Exposure Lanes"
    to: /docs/network/sovereignty/registering-corpora
    kind: doc
    note: "The mechanics: benchmark a corpus without handing it over"
  - label: "How the Work Is Funded"
    to: /docs/network/sovereignty/economic-model
    kind: doc
  - label: "Reporting Errors and Owning Corrections"
    to: /docs/network/perspectives/reporting-errors-and-owning-corrections
    kind: position
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
---

# Datentreuhänderschaft

> **Zusammenfassung.** Champollion ist ein Werkzeug für die Forschung und
> Entwicklung im Bereich der maschinellen Übersetzung — quelloffen und kostenlos für die nichtkommerzielle Nutzung, seine
> Evaluierungsumgebung ist Open Source. Diese Seite legt die Position zu Sprachdaten
> vollständig dar: Korpora gehören den Menschen, von denen sie stammen, jede Lizenz und Gemeinschaftsbedingung
> wird mechanisch statt nur durch Versprechen respektiert, und die Plattform stellt
> keine eigenen Bedingungen an die Sprache von irgendjemandem.

:::info[Sprachdaten sind Biodaten]
Sprachdaten sind **Biodaten**. Wie genetische oder gesundheitsbezogene Daten
trägt eine Sprache die Identität, Verwandtschaft und Beziehungen der Menschen,
die sie sprechen — und wie ein Genom lässt sie sich nicht sinnvoll
anonymisieren: Entfernen Sie die Namen, so kodiert die Sprache dennoch, wer
ihre Menschen sind. Daher besitzen die Menschen, die ein Korpus bereitstellen,
die Schlüssel dazu und zu allem, was daran gemessen wird. Dies ist die
Prämisse, auf der alles Folgende beruht.
:::

Aus dieser Prämisse ergibt sich das Design. Champollion behandelt jeden
Korpus-Beitragenden als **Treuhänder**: Das Korpus bleibt ihm — rechtlich,
physisch und praktisch — erhalten, während die Infrastruktur es *messbar* macht.

## Die Verpflichtungen

1. **Wir halten die Daten niemals.** Korpora werden als hash-fixierte
   Metadaten-Karten registriert und zum Zeitpunkt der Evaluierung vom eigenen
   Hosting des Treuhänders abgerufen. Nichts wird in dieses Repository kopiert
   oder von unserer Infrastruktur bereitgestellt. Nehmen Sie Ihr Archiv offline,
   so stoppt die Evaluierung dagegen schlicht. Siehe
   [Korpora registrieren](/docs/network/sovereignty/registering-corpora).

2. **Jede Lizenz wird respektiert — durch Kontrollmechanismus, nicht durch
   Versprechen.** Nichtkommerzielle und ausschließlich für die Forschung
   bestimmte Korpora werden maschinell von jeder Nutzung ausgeschlossen, die
   ihre Lizenz nicht zulässt. Einschränkungen, die eine Gemeinschaft über die
   Lizenz hinaus geltend macht, werden mit ihrer Quelle erfasst und auf dieselbe
   Weise geachtet. Die Durchsetzung liegt in CI-Gates und Datenbank-Triggern,
   nicht in einem Verhaltenskodex.

3. **Die Bedingungen sind die des Treuhänders, und sie variieren.**
   Verschiedene Sprachen werden verschiedene Vereinbarungen haben — ein
   öffentliches CC0-Korpus, ein ausschließlich für die Forschung bestimmtes
   Gemeinschaftskorpus und ein versiegelter Testdatensatz mit souveränen
   Bereitstellungsanforderungen können alle teilnehmen, jeweils zu ihren eigenen
   Bedingungen. Es gibt hier keinen universellen Vertrag und keinen
   voreingestellten Anspruch auf irgendetwas. Siehe das
   [Bedingungsrahmenwerk](/docs/network/sovereignty/ownership-transfer).

4. **Geheime Korpora werden als Architektur unterstützt, nicht als Ausnahme.**
   Eine Gemeinschaft kann einen Testdatensatz versiegelt halten — auf ihrer
   eigenen Infrastruktur gehalten, niemals von Champollion oder von Entwicklern
   eingesehen — und dennoch Methoden dagegen bewerten lassen. Messbarkeit ohne
   Extrahierbarkeit ist ein Designziel, kein Notbehelf.

5. **Zuschreibung und Anerkennung reisen mit den Daten.** Die Anerkennung von
   Erstellern und Linguisten ist auf jeder Oberfläche, auf der ein Korpus
   erscheint, verpflichtend. Wo eine Gemeinschaft
   [Local Contexts](https://localcontexts.org/)-TK- oder BC-Labels angewendet
   hat, zeigen wir sie an und achten das Protokoll, das sie verschlüsseln. Wir
   tragen Labels; wir prägen sie niemals.

6. **Beitragende werden bezahlt.** Korpuserstellung und -validierung sind
   professionelle Arbeit zu veröffentlichten Sätzen — siehe
   [Wie Sprechende bezahlt werden](/docs/network/perspectives/how-speakers-get-paid).
   Die Bezahlung kauft nicht das Korpus: Der Ersteller wird bezahlt *und* bleibt
   der Treuhänder.

## Wie eine Lizenz zur zwingenden Vorgabe wird

Zusage 2 ist konkret ausgestaltet, und es lohnt sich, sie vollständig darzulegen — dies zeigt,
wie „jede Lizenz wird respektiert“ in der Praxis funktioniert, und ist nicht nur eine Zusammenfassung guter
Absichten.

**Jeder Benchmark wird bei der Aufnahme zurückgehalten.** Ein neu katalogisiertes Test-Set wird standardmäßig
unter Quarantäne gestellt: Es ist im Index sichtbar, aber von der Evaluierungswarteschlange, von
Wettbewerben und von jeder Rangliste ausgeschlossen. Bei der Aufnahme wird nichts über ein Korpus vorausgesetzt
— nicht einmal eine permissiv erscheinende Lizenz —, bis seine Bedingungen anhand
des tatsächlichen Lizenztextes in einer festgelegten Upstream-Revision überprüft wurden.

**Prüfentscheidungen erfolgen mechanisch, und schwierige Fälle bleiben zurückgehalten.** Eine klar
angegebene permissive Lizenz gibt das Korpus für jeden Nutzungspfad frei. Eine klar angegebene
nichtkommerzielle Lizenz gibt es für einen Forschungs-Nutzungspfad frei, der von
allen kommerziellen, Preisgeld- und API-Umgebungen ausgeschlossen ist. Und eine Lizenz, die nicht angegeben,
modifiziert, gemischt oder maßgeschneidert ist, wird **niemals stellvertretend für den Rechteinhaber
interpretiert**: Das Korpus bleibt katalogisiert, aber zurückgehalten — außerhalb der Warteschlange, der Wettbewerbe
und der Ranglisten —, bis der Rechteinhaber Bedingungen festlegt oder eine Freigabe hinterlegt. Die
Entscheidung, ihr Datum, ihr Nutzungspfad und ihre Grundlage werden maschinenlesbar auf der
Korpus-Karte und in ihren Registereinträgen vermerkt, sodass „Warum ist dies ausführbar?“ immer eine
zitierfähige Antwort hat, und ebenso „Warum ist dies nicht der Fall?“.

**Das Senden von Text an ein Modell ist eine Übertragung, und diese unterliegt einer Zugangskontrolle.** Ein
Modell zu evaluieren bedeutet, ihm Quellsätze zu senden — das Korpus verlässt also seine Ursprungsumgebung, und
dies wird durch die jeweilige Lizenz geregelt. Permissiv lizenzierte Korpora dürfen Standardkanäle
nutzen. Korpora unter einer expliziten nichtkommerziellen Lizenz werden nur über
Kanäle übertragen, die vertraglich zusichern, nicht mit Eingabedaten zu trainieren — und zwar genau so formuliert: als
Garantie gegen das Training, nicht nur gegen die Speicherung. Korpora mit nicht angegebenen oder
modifizierten Freigaben wird die Remote-Evaluierung kategorisch verweigert, bis eine Zustimmung
hinterlegt ist, und versiegelte Community-Sets verlassen die Infrastruktur ihres Verwalters
überhaupt nicht. Wenn die Zugangskontrolle eine Übertragung ablehnt, zitiert die Ablehnungsnachricht die
Entscheidung der Lizenzprüfung.

**Die Durchsetzung greift unterhalb jedes Clients.** Sperren werden durch einen
Datenbank-Trigger erzwungen, den kein Client umgehen kann, die No-Hosting-Regel wird durch ein
Repository-Gate durchgesetzt, das jeden versionierten Pfad auf Korpus-Inhalte scannt, und die
Übertragungskontrolle läuft innerhalb der Evaluierungsumgebung selbst. Jede dieser Instanzen kann
uns den Zugriff verweigern, und genau das ist der Sinn der Sache.

## Was dies nicht ist

Champollion ist kein Datenhändler, kein Übersetzungsanbieter und keine
kommerzielle Plattform. Es ist ein Forschungswerkzeug. Ein hoher Platz in der
Bestenliste beweist, dass eine Methode technisch funktioniert; er ist keine
Lizenz, um Übersetzungen zu veröffentlichen, ein Korpus weiterzuverbreiten oder
irgendetwas gegen die Wünsche einer Gemeinschaft einzusetzen. Diese
Entscheidungen liegen stets beim Treuhänder.

## Die Rahmenwerke, die dieses Design geprägt haben

Diese Haltung wurde nicht hier erfunden. Sie ist geprägt von — und verdankt sich
— der Arbeit an der indigenen Datenverwaltung der letzten zwei Jahrzehnte:

- **Datensouveränitätsprinzipien der First Nations** — First Nations in Kanada
  haben Eigentum, Kontrolle, Zugang und Besitz der Gemeinschaft an ihren eigenen
  Informationen geltend gemacht; das hier verwendete Treuhandmodell ist so
  konzipiert, dass es mit diesen Geltendmachungen kompatibel ist.
- **[CARE-Prinzipien](https://www.gida-global.org/care)** (Collective Benefit,
  Authority to Control, Responsibility, Ethics) — Global Indigenous Data
  Alliance.
- **[Te Mana Raraunga](https://www.temanararaunga.maori.nz/)** — das Māori Data
  Sovereignty Network.
- **Die [Kaitiakitanga License](https://tehiku.nz/)** — die auf Vormundschaft
  beruhende Lizenz von Te Hiku Media für Daten in te reo Māori, ein direkter
  Einfluss auf das hier verwendete Verwahrungsmodell, bei dem der Treuhänder die
  Schlüssel hält.

Wir verweisen alle, die eine Verwaltung für die Daten ihrer eigenen Sprache
entwerfen, direkt auf diese Quellen — sie sind die maßgeblichen Instanzen, nicht
wir. Wo eine Gemeinschaft eines dieser Rahmenwerke für ihr Korpus übernimmt,
erfasst die Korpus-Karte diese Erklärung, und das Werkzeug achtet sie.

Champollion zeigt den Local Contexts **„Open to Collaborate“-Hinweis** an: Wir
bauen Beziehungen zu den Gemeinschaften auf, deren Sprachen hier erscheinen, und
von der Gemeinschaft erstellte Labels haben Vorrang vor allem, was wir über ihre
Daten sagen.

## Siehe auch

- [Datensouveränität von Grund auf](/docs/learn/data-sovereignty) — die Einsteigerversion dieser Seite, für Leser, die mit diesem Konzept noch nicht vertraut sind

- [Korpora registrieren & Exposure Lanes](/docs/network/sovereignty/registering-corpora) — die Mechanik
- [Für Sprachgemeinschaften](/docs/network/community/for-language-communities) — ein Leitfaden in einfacher Sprache
- [Wie Sprechende bezahlt werden](/docs/network/perspectives/how-speakers-get-paid) — veröffentlichte Sätze und Bedingungen
- [Übersetzungsmethoden](https://champollion.dev/docs/guides/translation-methods) — die `api`-Methode, die die Prompts, Wörterbücher und Coaching-Daten einer Gemeinschaft auf ihren eigenen Servern hält
