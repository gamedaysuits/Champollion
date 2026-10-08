---
sidebar_position: 1
title: "Übersetzung ist keine Revitalisierung"
slug: '/network/perspectives/translation-is-not-revitalization'
description: "Was maschinelle Übersetzung für bedrohte Sprachen leisten kann und was nicht – klar formuliert. Maschinelle Übersetzung ist Infrastruktur für Sprachgemeinschaften. Sie ersetzt niemals Menschen, die miteinander sprechen."
related:
  - label: "How Speakers Get Paid"
    to: /docs/network/perspectives/how-speakers-get-paid
    kind: position
  - label: "From Benchmark to Daily Use"
    to: /docs/network/perspectives/from-benchmark-to-daily-use
    kind: position
    note: "The post-editing path from draft to published text"
  - label: "Data Sovereignty"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "Data-sovereignty principles, CARE, and consent before deployment"
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
---

# Übersetzung ist keine Revitalisierung

> **Standpunkt.** Maschinelle Übersetzung überträgt Text zwischen Sprachen. Revitalisierung schafft neue Sprecher. Dies sind unterschiedliche Tätigkeiten mit unterschiedlichen Erfolgskriterien, und kein Wert auf einer Rangliste ändert daran etwas. Wir bauen MT als Infrastruktur, die den Zielen einer Gemeinschaft dient — niemals als Ersatz für die generationenübergreifende Weitergabe. Kinder lernen Sprache von Menschen, nicht von Maschinen.

Im Jahr 2026 ist es leicht zu glauben, dass Software alles beheben kann, einschließlich einer Sprache, die Sprecher verliert. Wir möchten präzise darlegen, warum dieser Glaube falsch ist — und was Übersetzungstechnologie ehrlicherweise beitragen *kann*.

Dieser Beitrag existiert, weil ein Linguist, den wir eingeladen hatten, dieses Projekt zu kritisieren, das Argument mit Nachdruck vorbrachte: Ein perfektes Englisch→Cree-Übersetzungssystem würde weder das Weitergabeproblem lösen (Kinder, die die Sprache zu Hause nicht lernen), noch das Prestigeproblem (Englisch als Sprache der wirtschaftlichen Macht) oder das pädagogische Problem (nicht genügend Immersionsschulen und ausgebildete Lehrkräfte). Es könnte die Lage sogar verschlimmern, indem es die Illusion erzeugt, dass „der Computer Cree sprechen kann“, und die Dringlichkeit der menschlichen Weitergabe abschwächt. Wir haben den Großteil dieser Kritik akzeptiert, und wir veröffentlichen unsere Antwort hier, anstatt sie zu verbergen.

---

## Was Revitalisierung tatsächlich erfordert

Die Forschungsliteratur zur Sprachrevitalisierung ist in einem Punkt eindeutig: Sprachen überleben, wenn sie zwischen den Generationen weitergegeben werden — wenn Eltern, Großeltern und Gemeinschaften sie zu Kindern sprechen und Kinder mit ihnen aufwachsen und sie zurücksprechen (Fishman 1991; Hinton & Hale 2001). Alles Übrige — Schulen, Medien, Wörterbücher, Apps — unterstützt entweder diese Weitergabe oder es unterstützt nichts.

Kein Übersetzungssystem nimmt an diesem Austausch teil. Ein Modell, das ein englisches Dokument ins Plains Cree überträgt, schafft keinen Sprecher. Es besetzt kein Immersionsklassenzimmer, bildet keine Lehrkraft aus und sitzt nicht mit einem Kind an einem Küchentisch. Wenn unsere Arbeit jemals als „Rettung von Sprachen“ beschrieben wird, ist diese Beschreibung falsch, und wir werden das auch so sagen.

## Was MT nicht leisten kann

Klar formuliert, damit es später keine Missverständnisse gibt:

- **Sie kann Sprecher nicht ersetzen.** Ein Ergebnis, das kein fließend sprechender Mensch geprüft hat, ist ein Entwurf, kein Text. Unsere eigenen [Bewertungsregeln](/docs/network/specifications/scoring) behandeln jeden automatisierten Wert als Näherungswert; nur die menschliche Prüfung bestätigt die Verwendbarkeit.
- **Sie kann keine Erstsprache vermitteln.** Kinder erwerben Sprache durch Beziehung und Immersion, nicht durch übersetzte Dokumente.
- **Sie kann eine schädliche Illusion erzeugen.** Eine Demo, die eine Sprache „spricht“, kann suggerieren, dass die Sprache sicher ist, obwohl sie es nicht ist. Dieses Prestigerisiko ist real, und wir behandeln es als offene Frage, die *gemeinsam mit* den Gemeinschaften zu untersuchen ist, nicht als zu steuernden Diskussionspunkt.
- **Sie kann nichts entscheiden.** Ob ein Übersetzungssystem für eine Sprache existieren soll und wo es eingesetzt werden darf, ist die Entscheidung der Gemeinschaft — einschließlich der Entscheidung, es überhaupt nicht einzusetzen. Diese Kontrolle ist in der Architektur der [Eigentumsübertragung](/docs/network/sovereignty/ownership-transfer) und der [Datensouveränität](/docs/network/sovereignty/data-sovereignty) verankert, und sie umfasst Kontexte: Eine Gemeinschaft könnte MT für offizielle Dokumente akzeptieren und sie für Unterrichtsmaterialien ablehnen.

## Was MT ehrlicherweise leisten kann

Vor diesem Hintergrund gibt es konkrete, begrenzte Beiträge, die Übersetzungsinfrastruktur leistet — jeder einzelne im Dienste von Menschen, die bereits die eigentliche Arbeit tun.

**1. Durchsatz für überlastete Übersetzer.** Übersetzungsbüros in Gemeinschaften stehen vor mehr Dokumenten, die *in der Sprache existieren sollten*, als menschliche Übersetzer von Grund auf erstellen können. Ein maschineller Entwurf verändert die Aufgabe von „alles übersetzen“ zu „prüfen und korrigieren“ — und kontrollierte Studien haben festgestellt, dass Post-Editing deutlich schneller ist als das Übersetzen von Grund auf, bei gleichbleibender oder verbesserter Qualität (Plitt & Masselot 2010; Green, Heer & Manning 2013). Wir beschreiben diesen Arbeitsablauf ausführlich in [Vom Benchmark zum täglichen Einsatz](/docs/network/perspectives/from-benchmark-to-daily-use). Der Vorbehalt: Diese Studien deckten ressourcenreiche Sprachpaare ab; für polysynthetische Sprachen liegen uns noch keine vergleichbaren Belege vor, was Teil dessen ist, was dieses Projekt zu messen angelegt ist.

**2. Praktische Hebelwirkung für Sprachenrechte.** Das Recht auf staatliche Dienstleistungen in indigenen Sprachen ist in mehreren Rechtsordnungen gesetzlich verankert. Was häufig fehlt, ist die praktische Kapazität, Übersetzungen in dem Tempo zu erstellen, das die Bürokratie verlangt. Eine Gemeinschaft, die ein fünfzigseitiges Grundsatzdokument in Tagen statt Monaten in eine geprüfte Übersetzung verwandeln kann, befindet sich in einer stärkeren Verhandlungsposition. Die Technologie schafft nicht das Recht; sie macht es schwerer, das Recht zu ignorieren.

**3. Wiederverwendbare linguistische Infrastruktur.** Der morphologische Analysator (FST), den wir verwenden, um zu überprüfen, dass ein Übersetzungsergebnis echte Wörter enthält — keine halluzinierten —, kodiert, *warum* jede Wortform gültig ist. Genau dieselbe Maschinerie ist die Grundlage für Lernwerkzeuge: Konjugationstrainer, fehlerkorrigierende Schreibhilfen, morphologische Explorer. Die Verifikationsengine und die pädagogische Engine sind ein und dasselbe Artefakt. Dies ist ein Weg, kein Versprechen — die Lernwerkzeuge müssen erst gebaut werden, und ob sie gebaut werden, ist eine Entscheidung der Gemeinschaft.

**4. Unterstützung für Zweitsprachenlernende.** Revitalisierung bedeutet nicht nur, dass Kinder eine Erstsprache erwerben. Sie umfasst auch Erwachsene, die als Zweitsprache lernen — Menschen, die vielleicht nie das Niveau der fließenden Sprachbeherrschung von Ältesten erreichen, aber Gemeinschaftsdokumente lesen, mit Verständnis teilnehmen und durch ihre Verwendung die öffentliche Präsenz der Sprache erhöhen können. Für diese Gruppe ist eine Übersetzungshilfe ein echtes Werkzeug, so wie ein Wörterbuch ein Werkzeug ist.

**5. Ein Grund dafür, dass die Arbeit vor Ort finanziert und besessen wird.** In unserem Modell werden bewährte Methoden vollständig [in das Eigentum der Gemeinschaft überführt](/docs/network/sovereignty/ownership-transfer), und alles, was eine Gemeinschaft aus einem ihr gehörenden Vermögenswert erwirtschaftet, gehört vollständig ihr ([wie die Arbeit finanziert wird](/docs/network/sovereignty/economic-model)). Sprecher werden [für ihre Expertise bezahlt](/docs/network/perspectives/how-speakers-get-paid), nicht gebeten, sie ehrenamtlich zur Verfügung zu stellen. Auch das ist keine Revitalisierung — aber es lenkt Ressourcen zu den Menschen, die Revitalisierung betreiben, statt von ihnen weg.

## Die ehrliche Einordnung

Das Fachgebiet hat eine lange Geschichte von Technologieprojekten, die mit Rettungserzählungen ankommen und mit Publikationen wieder abziehen (Bird 2020). Wir versuchen, uns an eine engere Behauptung zu halten: **MT ist Infrastruktur.** Infrastruktur dient Zielen, die andere Menschen setzen. Straßen entscheiden nicht, wohin Sie reisen; diese Technologie entscheidet nicht, ob eine Sprache überlebt. Das tun Sprecher, Familien und Gemeinschaften — und die Rahmung der [Internationalen Dekade der indigenen Sprachen der UNESCO](https://idil2022-2032.org/) stellt zu Recht indigene Völker und nicht Werkzeuge in den Mittelpunkt.

Wenn eine Gemeinschaft zu dem Schluss kommt, dass Übersetzungstechnologie ihren Zielen dient, wollen wir, dass sie die beste und rechenschaftspflichtigste Version ist, die möglich ist — in ihrem Eigentum, von ihren Sprechern validiert, zu ihren Bedingungen eingesetzt. Wenn eine Gemeinschaft zu dem Schluss kommt, dass sie nicht hilft, ist diese Schlussfolgerung ein gültiges Ergebnis dieses Projekts, kein Scheitern. Beide Hälften dieses Satzes sind Verpflichtungen.

---

## Was das für Sie bedeutet

:::info[Wenn Sie ein Community-Mitglied sind]
Dieses Projekt wird Ihnen nicht erzählen, dass eine App Ihre Sprache retten kann — das kann sie nicht. Was es bietet, ist begrenzt: schnellere Dokumentübersetzung unter der Prüfung durch fließend Sprechende, Infrastruktur, die Ihre Community vollständig besitzen kann, und Vergütung für das Fachwissen der Sprechenden. Ob und wie all dies genutzt wird, ist die Entscheidung Ihrer Community, einschließlich der Entscheidung, es nicht zu nutzen. Siehe [Für Sprachgemeinschaften](/docs/network/community/for-language-communities) und [Fehler melden und Korrekturen besitzen](/docs/network/perspectives/reporting-errors-and-owning-corrections).
:::

:::info[Wenn Sie ein Forscher sind]
Behandeln Sie „MÜ für bedrohte Sprachen" als eine Infrastruktur-Behauptung, nicht als eine Revitalisierungs-Behauptung, und Ihre Bewertungsfrage ändert sich: nicht „Ist der BLEU-Score hoch?", sondern „Reduziert dies messbar die Arbeitslast der Menschen, die die eigentliche Arbeit leisten, zu ihren Bedingungen?" Die [Benchmark-Spezifikation](/docs/network/specifications/benchmark) und [Wie es funktioniert §8 (Spannungen und Einschränkungen)](/docs/network/how-it-works#8-tensions-and-limitations) sind die Stellen, an denen wir uns an diesem Maßstab messen lassen.
:::

:::info[Wenn Sie ein Entwickler sind]
Entwickeln Sie für den Post-Editing-Workflow, nicht für die Demo. Der Nutzer Ihrer Methode ist ein fließend Sprechender, der einen Entwurf korrigiert, und der schlimmste Fehlerfall sind halluzinierte Wörter, die für Nicht-Sprechende plausibel erscheinen — weshalb die morphologische Validierung hier alles absichert. Beginnen Sie mit [Eine Methode einreichen](/docs/network/getting-started/submit-a-method) und [Vom Benchmark zur täglichen Nutzung](/docs/network/perspectives/from-benchmark-to-daily-use).
:::

---

## Quellen

- Fishman, J. A. (1991). *Reversing Language Shift: Theoretical and Empirical Foundations of Assistance to Threatened Languages.* Multilingual Matters.
- Hinton, L., & Hale, K. (eds.) (2001). *The Green Book of Language Revitalization in Practice.* Academic Press.
- Plitt, M., & Masselot, F. (2010). "A Productivity Test of Statistical Machine Translation Post-Editing in a Typical Localisation Context." *The Prague Bulletin of Mathematical Linguistics*, 93, 7–16. [PDF](https://ufal.mff.cuni.cz/pbml/93/art-plitt-masselot.pdf)
- Green, S., Heer, J., & Manning, C. D. (2013). "The Efficacy of Human Post-Editing for Language Translation." *Proceedings of CHI 2013.* [Paper](https://idl.uw.edu/papers/post-editing)
- Bird, S. (2020). "Decolonising Speech and Language Technology." *Proceedings of COLING 2020*, 3504–3519. [Paper](https://aclanthology.org/2020.coling-main.42/)
- UNESCO. *International Decade of Indigenous Languages 2022–2032.* [idil2022-2032.org](https://idil2022-2032.org/)

## Siehe auch

- [Wie Sprecher bezahlt werden](/docs/network/perspectives/how-speakers-get-paid) — das Vergütungsmodell, in Zahlen
- [Vom Benchmark zum täglichen Einsatz](/docs/network/perspectives/from-benchmark-to-daily-use) — der Weg des Post-Editing
- [Funktionsweise](/docs/network/how-it-works) — die vollständige Plattformarchitektur, einschließlich §8 zu Spannungen, die wir nicht aufgelöst haben
