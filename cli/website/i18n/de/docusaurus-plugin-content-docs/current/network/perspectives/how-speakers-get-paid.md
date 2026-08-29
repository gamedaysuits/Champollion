---
sidebar_position: 2
title: "Wie Sprecher:innen vergütet werden"
slug: '/network/perspectives/how-speakers-get-paid'
description: "Wofür Community-Validator:innen und Übersetzer:innen für Benchmark-Arbeit vergütet werden, warum die Vergütung von Sprecher:innen nicht verhandelbar ist und wie die Vergütung mit dem Wachstum des Netzwerks skaliert. Alle Zahlen stammen aus den veröffentlichten Spezifikationen."
related:
  - label: "Speaker Validation Protocol"
    to: /docs/network/specifications/speaker-validation
    kind: spec
    note: "The work validators are paid for"
  - label: "Prize Specification"
    to: /docs/network/specifications/prizes
    kind: spec
    note: "Where prize money goes, and why"
  - label: "The Economic Model"
    to: /docs/network/sovereignty/economic-model
    kind: doc
  - label: "Reporting Errors and Owning Corrections"
    to: /docs/network/perspectives/reporting-errors-and-owning-corrections
    kind: position
---

# Wie Sprecher bezahlt werden

> **Transparenzhinweis.** Jede Zahl auf dieser Seite erscheint bereits in einer veröffentlichten Spezifikation — der [Benchmark-Spezifikation §10](/docs/network/specifications/benchmark#10-cost-framework), dem [Sprecher-Validierungsprotokoll](/docs/network/specifications/speaker-validation) und der [Preis-Spezifikation](/docs/network/specifications/prizes). Diese Seite versammelt sie an einem Ort, in einfacher Sprache, damit niemand eine Spezifikation lesen muss, um herauszufinden, was die Zeit eines Sprechers hier wert ist. Sie geht keine Verpflichtungen ein, die über das hinausgehen, was jene Dokumente bereits festlegen.

Ein zweisprachiger Sprecher, der beurteilen kann, ob ein maschinell erzeugter Satz echt und flüssig ist und das Richtige bedeutet, ist der knappste und wertvollste Teilnehmer in diesem gesamten System. Alles andere — Harnesses, Metriken, Ranglisten — existiert, um eine kleine Menge der Zeit dieser Person weit reichen zu lassen.

Die erste Regel ist also einfach: **Sprecher werden für ihre Zeit bezahlt, zu professionellen Sätzen, unabhängig davon, was die Ergebnisse zeigen.**

---

## Warum die Bezahlung von Sprechern nicht verhandelbar ist

Die Sprachtechnologieforschung hat eine lange Gewohnheit, fließende Sprecher als kostenlose Ressource zu behandeln — „Community-Engagement“, das Datensätze, Publikationen und Karrieren für alle außer den Sprechern hervorbringt. Wir betrachten dieses Muster als ausbeuterisch, und die Menschen, die am besten qualifiziert sind, diese Arbeit zu leisten, sind genau diejenigen, deren Zeit bereits durch die dringende Arbeit des Unterrichtens, Übersetzens und der Kindererziehung in der Sprache beansprucht wird.

Daraus ergeben sich drei gestalterische Konsequenzen:

1. **Keine Freiwilligen-Pipeline.** Wir bitten Sprecher nicht darum, Evaluierungsarbeit als Gefallen an die Forschung zu spenden. Die Teilnahme ist ein bezahltes Engagement, und ihre Ablehnung kostet einen Sprecher nichts.
2. **Die Bezahlung ist bedingungslos.** Sprecher werden bezahlt, unabhängig davon, ob ihre Bewertungen verwendet werden, und die Bezahlung ist nicht an Ergebnisse gebunden. Das veröffentlichte Protokoll verpflichtet zur Zahlung innerhalb von zwei Wochen nach Abschluss jedes Aufgabenblocks.
3. **Die Vergütung ist nicht die ganze Vereinbarung.** Sprecher, die Bewertungen beitragen, erhalten außerdem Anerkennung (namentlich oder anonym, ihre Wahl), optionale Mitautorschaft an Publikationen, die ihre Bewertungen verwenden, das Recht, ihre Beiträge jederzeit zurückzuziehen, sowie ein Vetorecht bei der Veröffentlichung von Ergebnissen, die sie als problematisch empfinden. Diese Bedingungen stehen im [Sprecher-Validierungsprotokoll §5–6](/docs/network/specifications/speaker-validation), nicht in einem Nebenschreiben.

## Die veröffentlichten Sätze

Der Benchmark-Kostenrahmen legt die Vergütung zweisprachiger Sprecher auf **50–65 CAD pro Stunde** für Korpus- und Validierungsarbeit fest. Was das je Rolle bedeutet:

### Aufbau eines Benchmark-Korpus

Die Erstellung der Referenzübersetzungen, an denen jede Methode gemessen wird, ist die grundlegende Sprecheraufgabe. Das veröffentlichte Etablierungsbudget je Sprache:

| Arbeit | Veröffentlichter Bereich | Grundlage |
|------|-----------------|-------|
| Korpuskuratierung (50–150 Einträge) | 2.500–6.000 $ | 50–65 $/Std., Zeit zweisprachiger Sprecher |
| Überprüfung der Methodenausgabe | 500–1.500 $ | Dieselben Stundensätze |

Ein vollständiges Korpus benötigt von einem Sprecher traditionell etwa 80 Stunden; der geplante agentengestützte Arbeitsablauf (Satzentwurf und Formatierung werden von Werkzeugen übernommen, die Übersetzung stets von einem Menschen) ist darauf ausgelegt, dies in Richtung 30–40 Stunden zu bringen — weniger Stunden repetitiver Arbeit, derselbe Stundensatz, wobei der Sprecher nur jene Teile übernimmt, die wirklich einen Menschen erfordern.

### Validierung der Metriken

Bevor automatisierte Bewertungen etwas bedeuten, müssen Sprecher sie anhand des menschlichen Urteils überprüfen. Das [Sprecher-Validierungsprotokoll](/docs/network/specifications/speaker-validation) veröffentlicht die genauen Aufgaben, Stunden und die Bezahlung:

| Aufgabe | Zeit | Bezahlung pro Sprecher |
|------|------|-----------------|
| A — Bewertung von 200 maschinellen Übersetzungen auf Angemessenheit und Flüssigkeit | ~8 Stunden | 400–520 CAD |
| B — Überprüfung von 50 „gleichwertigen“ Übersetzungspaaren | ~2 Stunden | 100–130 CAD |
| C — Überprüfung von 100 Wörtern, die der morphologische Analysator abgelehnt hat | ~1,5 Stunden | 75–100 CAD |

Ein Sprecher, der alle drei Aufgaben übernimmt, verpflichtet sich zu etwa 11,5 Stunden über zwei bis vier Wochen für **575–750 CAD**. Die vollständige Validierungsrunde mit drei Sprechern kostet das Projekt 1.475–1.920 $ — worum es genau geht: Die Sprechervalidierung ist ein kleiner Posten für das Projekt und sollte niemals die Stelle sein, an der Kosten „eingespart“ werden.

### Überprüfung von Preisansprüchen

Kein Preis wird allein auf der Grundlage automatisierter Bewertungen ausgezahlt. Der [Founder's Prize](/docs/network/specifications/prizes) (10.000 CAD, Englisch→Plains Cree) erfordert, dass mindestens zwei zweisprachige Sprecher unabhängig voneinander eine geschichtete Stichprobe von mindestens 30 Ausgaben überprüfen und dass 70 % oder mehr als „akzeptabel“ oder „ausgezeichnet“ bewertet werden. Diese Überprüfung ist bezahlte Sprecherarbeit zu denselben Sätzen — und sie ist zugleich eine Schranke: Sprecher können einen Preisanspruch versenken, und das ist beabsichtigt.

## Wie es mit Wettbewerben skaliert

Das Modell ist so aufgebaut, dass die Sprechervergütung mit der Plattform wächst, anstatt durch sie verwässert zu werden:

- **Jede neue Sprache beginnt mit einem bezahlten Korpus-Engagement.** Die veröffentlichten Etablierungskosten je Sprache (3.350–8.500 $ all-in) bestehen überwiegend aus Sprechervergütung — bewusst der größte Einzelbestandteil.
- **Jeder neue Preispool bringt seine eigene bezahlte Überprüfung mit sich.** Jeder gesponserte Wettbewerb, der der [Preisvorlage](/docs/network/specifications/prizes#4-future-prize-pools) folgt, trägt dieselbe Anforderung an eine Community-Validierung, was bedeutet, dass jeder Wettbewerb Sprecher-Überprüfungsarbeit für diese Sprache finanziert.
- **Community-eigene Methoden bleiben community-finanzierte Vermögenswerte.** Eine übertragene Methode gehört vollständig der Governance-Organisation — alles, was sie durch deren Einsatz einbringt, gehört ausschließlich der Community ([Wie die Arbeit finanziert wird](/docs/network/sovereignty/economic-model)), verfügbar für weitere Überprüfungen, Korpuswachstum und Sprachprogramme, wie sie es für richtig hält. Diese Zuweisung ist die Entscheidung der Community, nicht unsere.

## Was wir *nicht* versprochen haben

Ehrlichkeit erfordert, die Grenzen zu markieren:

- Die obigen Sätze sind die veröffentlichten Sätze für die aktuelle Plains-Cree-Arbeit. Sätze für zukünftige Sprachen werden gemeinsam mit der Partner-Community festgelegt und auf dieselbe Weise veröffentlicht — in den Spezifikationen, bevor die Arbeit beginnt.
- Champollion ist nicht-kommerziell, generiert keine eigenen Einnahmen und wird derzeit **von seinem Gründer selbst finanziert** — Förder- und Sponsorenmittel sind das, was wir anstreben, nicht das, was wir haben. [Wie die Arbeit finanziert wird](/docs/network/sovereignty/economic-model) beschreibt den Mechanismus, nicht eine Garantie.
- „Fair bezahlt“ ist notwendig, aber nicht hinreichend. Bezahlung allein macht ein Projekt nicht nicht-ausbeuterisch — das tun Eigentum und Kontrolle, weshalb die Vergütung innerhalb des [Stewardship-Modells](/docs/network/sovereignty/data-sovereignty) angesiedelt ist, anstatt es zu ersetzen.

---

## Was das für Sie bedeutet

:::info[Wenn Sie ein Mitglied der Community sind]
Wenn Sie zweisprachig in einer unterversorgten Sprache und Englisch sind, ist Ihre Einschätzung der wertvollste Beitrag in diesem System, und die veröffentlichten Konditionen lauten: 50–65 CAD/Stunde, flexible Zeiteinteilung, Zahlung innerhalb von zwei Wochen, Namensnennung nach Ihren Bedingungen und das Recht, Ihre Beiträge zurückzuziehen. Es sind keine Programmierkenntnisse erforderlich. Beginnen Sie mit [Für Sprachgemeinschaften](/docs/network/community/for-language-communities) oder dem [Speaker Validation Protocol §7](/docs/network/specifications/speaker-validation#7-how-to-get-started).
:::

:::info[Wenn Sie Forscher sind]
Kalkulieren Sie die Vergütung von Sprecherinnen und Sprechern als erstklassigen Forschungskostenpunkt ein — die veröffentlichten Beträge (1.475–1.920 $ für eine Runde zur Metrik-Validierung; 2.500–6.000 $ für die Kuratierung von Korpora) sind nach Maßstäben von Fördermitteln gering, und sie sind das, was automatisierte Bewertungen vertretbar macht. Die [Corpus Partnership Strategy](/docs/network/specifications/corpus-partnership) zeigt, wie sich eine akademische Abteilung mit integrierter, finanzierter Sprecherarbeit hier einbringt.
:::

:::info[Wenn Sie Entwickler sind]
Sie profitieren von bezahlter Sprecherarbeit, selbst wenn Sie sie nie finanzieren: Validierte Metriken sind das, was Ihre Platzierung auf dem Leaderboard bedeutsam macht, und die bezahlte Community-Überprüfung ist das, was zwischen Ihrer Methode und einem Preis steht. Wenn Sie gewinnen, gehen Sie davon aus, dass Sprecherinnen und Sprecher dafür bezahlt wurden, Ihre Ergebnisse zu prüfen — und gehen Sie davon aus, dass [das Eigentum an Ihrer Methode übertragen wird](/docs/network/sovereignty/ownership-transfer) an die Community, deren Sprache sie dient.
:::

## Siehe auch

- [Übersetzung ist keine Revitalisierung](/docs/network/perspectives/translation-is-not-revitalization) — warum die Autorität der Sprecher alles andere umrahmt
- [Fehler melden und Korrekturen verantworten](/docs/network/perspectives/reporting-errors-and-owning-corrections) — die Autorität der Sprecher auch nach dem Benchmark
- [Benchmark-Spezifikation §10](/docs/network/specifications/benchmark#10-cost-framework) — der vollständige Kostenrahmen, aus dem diese Zahlen stammen
