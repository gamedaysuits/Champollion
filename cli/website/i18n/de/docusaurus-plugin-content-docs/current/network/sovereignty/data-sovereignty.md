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

> **Kurzzusammenfassung.** Champollion ist ein Werkzeug für Forschung und
> Entwicklung im Bereich der maschinellen Übersetzung — mit einsehbarem Quellcode (source-available) und kostenlos für die
> nicht-kommerzielle Nutzung, seine Evaluierungs-Harness ist Open Source. Diese Seite legt seine Haltung zu
> Sprachdaten vollständig dar: Korpora gehören den Menschen, von denen sie stammen; jede Lizenz und jede
> Bestimmung einer Gemeinschaft wird maschinell statt durch reine Versprechen respektiert, und die Plattform stellt
> keinerlei eigene Bedingungen an die Sprache von irgendjemandem.

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

2. **Jede Lizenz wird respektiert — durch Gates, nicht durch Versprechen.** Nicht-kommerzielle und
   ausschließlich für die Forschung bestimmte Korpora werden maschinell von jeder Nutzung ausgeschlossen,
   die ihre Lizenz nicht gestattet. Einschränkungen, die von einer Gemeinschaft über die Lizenz hinaus geltend
   gemacht werden, werden mit ihrer Quelle erfasst und auf dieselbe Weise eingehalten. Die Durchsetzung erfolgt über
   Pre-Push-Gates, die vor jedem Push lokal ausgeführt werden (CI ist derzeit deaktiviert), sowie
   über Datenbank-Trigger, nicht über einen Verhaltenskodex.

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

5. **Namensnennung und Würdigung reisen mit den Daten.** Die Nennung der Ersteller und Linguisten
   ist auf jeder Oberfläche, auf der ein Korpus erscheint, obligatorisch. Wo eine Gemeinschaft
   TK- oder BC-Labels von [Local Contexts](https://localcontexts.org/) angewendet hat,
   beabsichtigen wir, diese anzuzeigen und das von ihnen kodierte Protokoll zu respektieren; die Unterstützung von Labels ist
   noch nicht implementiert. Wir werden Labels mitführen; wir vergeben sie niemals selbst.

6. **Beitragende werden bezahlt.** Korpusaufbau und -validierung sind
   professionelle Arbeit, die nach veröffentlichten Sätzen vergütet wird, sobald Fördermittel vorhanden sind (derzeit
   sind keine Mittel vorhanden) — siehe
   [Wie Sprechende bezahlt werden](/docs/network/perspectives/how-speakers-get-paid).
   Die Bezahlung kauft nicht das Korpus: Die erstellende Person wird bezahlt *und* bleibt die
   verwaltende Instanz (Steward).

## Wie aus einer Lizenz eine Durchsetzung wird

Verpflichtung 2 hat eine konkrete Ausgestaltung, und es lohnt sich, sie vollständig darzulegen — so
wird „Jede Lizenz wird respektiert“ tatsächlich ausgeführt, es ist keine Zusammenfassung guter
Absichten.

**Jeder Benchmark geht im Status „zurückgehalten“ (held) ein.** Ein neu katalogisiertes Testset wird standardmäßig
unter Quarantäne gestellt: im Index sichtbar, aber von der Evaluierungs-Warteschlange, von
Wettbewerben und von jedem Ranking ausgeschlossen. Bei der Aufnahme wird nichts über ein Korpus
vorausgesetzt — nicht einmal eine freizügig wirkende Lizenz —, bis seine Bestimmungen mit
dem tatsächlichen Lizenztext bei einer festgesteckten (pinned) Upstream-Revision abgeglichen wurden.

**Prüfurteile erfolgen maschinell, und die schwierigen Fälle bleiben zurückgehalten.** Eine eindeutig
ausgewiesene freizügige (permissive) Lizenz gibt das Korpus für jede Spur (Lane) frei. Eine eindeutig ausgewiesene
nicht-kommerzielle Lizenz gibt es für eine Forschungsspur frei, die von
jeglicher kommerziellen, Preis- und API-Oberfläche ausgeschlossen ist. Und eine Lizenz, die unbestimmt,
modifiziert, gemischt oder maßgeschneidert ist, wird **niemals im Namen des Rechteinhabers
interpretiert**: Das Korpus bleibt katalogisiert, aber zurückgehalten — außerhalb der Warteschlange, der Wettbewerbe
und der Rankings —, bis der Rechteinhaber Bestimmungen festlegt oder eine Freigabe erteilt. Das
Prüfurteil, sein Datum, seine Spur und seine Grundlage werden maschinenlesbar auf der
Korpuskarte und den zugehörigen Registry-Einträgen vermerkt, sodass auf die Frage „Warum ist dies ausführbar?“ stets eine
zitierfähige Antwort vorliegt — ebenso wie auf „Warum ist dies nicht ausführbar?“.

**Das Senden von Text an ein Modell ist eine Übertragung und wird kontrolliert.** Die Evaluierung eines
Modells bedeutet, ihm Quellsätze zu senden — damit verlässt das Korpus seine gewohnte Umgebung, und
dies wird je nach Lizenz geregelt. Freizügig lizenzierte Korpora dürfen Standardkanäle
nutzen. Korpora unter einer angegebenen nicht-kommerziellen Lizenz werden ausschließlich über
Kanäle übertragen, die vertraglich vereinbart nicht mit Eingaben trainieren — und zwar genau so formuliert: als
No-Training-Garantie, nicht als No-Retention-Garantie. Korpora unter unbestimmten oder
modifizierten Einräumungen wird die Remote-Evaluierung grundsätzlich verweigert, bis eine Einwilligung
vorliegt, und versiegelte Sets von Gemeinschaften verlassen die Infrastruktur ihres
Stewards zu keinem Zeitpunkt. Wenn das Gate den Vorgang verweigert, zitiert seine Ablehnungsnachricht das
Urteil der Lizenzprüfung.

**Die Durchsetzung liegt unterhalb jedes Clients.** Zurückhaltungen werden durch einen
Datenbank-Trigger erzwungen, den kein Client umgehen kann; die No-Hosting-Regel wird durch ein
Pre-Push-Gate erzwungen, das vor jedem Push lokal ausgeführt wird (CI ist derzeit deaktiviert) und
jeden getrackten und gepushten Pfad nach Korpus-Inhalten durchsucht; und das
Übertragungs-Gate (Transmission Gate) läuft innerhalb der Evaluierungs-Harness selbst. Jeder dieser Mechanismen kann
uns ein „Nein“ entgegensetzen — und genau darum geht es.

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

- **Grundsätze der Datensouveränität der First Nations** — First Nations in Kanada
  haben gemeinschaftliches Eigentum, Kontrolle, Zugang und Besitz an
  ihren eigenen Informationen formuliert; das hier verwendete Stewardship-Modell ist so konzipiert,
  dass es mit diesen Grundsätzen vereinbar ist.
- **[CARE-Prinzipien](https://www.gida-global.org/care)** (Collective Benefit,
  Authority to Control, Responsibility, Ethics) — Global Indigenous Data
  Alliance.
- **[Te Mana Raraunga](https://www.temanararaunga.maori.nz/)** — das Māori Data
  Sovereignty Network.
- **Die [Kaitiakitanga-Lizenz](https://tehiku.nz/)** — die auf Vormundschaft (Guardianship) basierende Lizenz
  von Te Hiku Media für te reo Māori-Daten, ein direkter Einfluss auf das hier verwendete
  „Steward-holds-the-keys“-Verwahrungsmodell.

Wir verweisen alle, die eine Verwaltung für die Daten ihrer eigenen Sprache
entwerfen, direkt auf diese Quellen — sie sind die maßgeblichen Instanzen, nicht
wir. Wo eine Gemeinschaft eines dieser Rahmenwerke für ihr Korpus übernimmt,
erfasst die Korpus-Karte diese Erklärung, und das Werkzeug achtet sie.

Champollion beabsichtigt, den **„Open to Collaborate“-Hinweis** und die Labels von Local Contexts
zu übernehmen; keines von beidem ist bislang implementiert. Sobald dies der Fall ist, haben von Gemeinschaften erstellte
Labels Vorrang vor allem, was wir über die Daten einer Gemeinschaft aussagen.

## Siehe auch

- [Datensouveränität von Grund auf](/docs/learn/data-sovereignty) — die Einführung zu dieser Seite für Lesende, für die dieses Konzept neu ist

- [Korpora registrieren & Exposure Lanes](/docs/network/sovereignty/registering-corpora) — die Mechanik
- [Für Sprachgemeinschaften](/docs/network/community/for-language-communities) — ein Leitfaden in einfacher Sprache
- [Wie Sprechende bezahlt werden](/docs/network/perspectives/how-speakers-get-paid) — veröffentlichte Sätze und Bedingungen
- [Übersetzungsmethoden](https://champollion.dev/docs/guides/translation-methods) — die `api`-Methode, die die Prompts, Wörterbücher und Coaching-Daten einer Gemeinschaft auf ihren eigenen Servern hält
