---
sidebar_position: 3
title: "Vom Benchmark zur täglichen Nutzung: Der Weg des Post-Editing"
slug: '/network/perspectives/from-benchmark-to-daily-use'
description: "Wie eine getestete Übersetzungsmethode zu einem Community-Übersetzungsworkflow wird: maschineller Entwurf, Post-Editing durch fließend sprechende Personen, veröffentlichter Text – mit ehrlichen Qualitätsschwellen bei jedem Schritt."
related:
  - label: "Deploy to Production"
    to: /docs/network/getting-started/deploy-to-production
    kind: guide
    note: "From proven method to live translation"
  - label: "Cookbook: Partial Translation (Human + Machine)"
    to: /docs/network/tutorials/partial-translation
    kind: cookbook
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "The quality thresholds behind the path"
  - label: "Translation Is Not Revitalization"
    to: /docs/network/perspectives/translation-is-not-revitalization
    kind: position
---

# Vom Benchmark zum täglichen Einsatz: Der Weg des Post-Editings

> **Die Kurzfassung.** Ein Ranglistenwert ist kein Produkt. Der Weg von „diese Methode erreicht 0,78" zu „das Büro der First Nation veröffentlicht jede Woche Dokumente in der Sprache" führt über genau einen Arbeitsablauf: Die Maschine erstellt einen Entwurf, ein fließend sprechender Mensch korrigiert ihn, und nur der korrigierte Text wird veröffentlicht. Jeder Qualitätsschwellenwert in unseren Spezifikationen ist auf diesen Arbeitsablauf abgestimmt — nicht auf unbeaufsichtigte maschinelle Ausgaben, die wir für keine Sprache auf dieser Plattform befürworten.

Manchmal wird gefragt, wann eine Übersetzungsmethode „gut genug ist, um sie einfach zu verwenden". Für die Sprachen, denen dieses Netzwerk dient, birgt diese Frage eine Falle. Die ehrliche Antwort lautet, dass die anzustrebende Messlatte nicht „gut genug, um ungeprüft zu veröffentlichen" ist — sondern **„gut genug, dass die Überprüfung eines Entwurfs schneller geht als die Übersetzung von Grund auf".** Diese Messlatte liegt deutlich niedriger, sie ist messbar, und ihre Überschreitung verändert, was ein gemeinschaftliches Übersetzungsbüro in einer Woche produzieren kann.

---

## Der Arbeitsablauf, von Anfang bis Ende

```
 English source document
        │
        ▼
 Machine draft  ←  a benchmarked, community-owned method
        │
        ▼
 Fluent-speaker post-edit  ←  the human gate; nothing skips it
        │
        ▼
 Published text  ←  carries human approval, not a machine score
        │
        ▼
 (Optional, community-controlled) corrections become
 data that improves the next version of the method
```

Drei Dinge sind zu beachten:

1. **Die Maschine veröffentlicht nie.** Die Ausgabeeinheit ist ein Entwurf. Der Korrekturdurchgang der sprechenden Person ist keine am Ende angefügte Qualitätssicherung — er ist der Arbeitsablauf.
2. **Die Zeit der sprechenden Person ist die zu optimierende Ressource.** Eine Methode ist genau in dem Maße besser als eine andere, wie sie der sprechenden Person weniger zu korrigieren übrig lässt. Forschung zum Post-Editing für ressourcenreiche Sprachen stellt durchweg fest, dass es bei mittlerer MT-Qualität schneller ist als die Übersetzung von Grund auf (Plitt & Masselot 2010; Green, Heer & Manning 2013, beide mit Links zitiert in [Übersetzung ist keine Revitalisierung](/docs/network/perspectives/translation-is-not-revitalization)). Ob dies auch für polysynthetische Sprachen gilt, ist genau das, was der Benchmark herausfinden soll — wir behandeln es als eine Hypothese, die pro Sprache zu verifizieren ist, nicht als eine Annahme.
3. **Die Rückkopplungsschleife ist im Eigentum der Gemeinschaft.** Jedes korrigierte Dokument ist potenzielle Trainings- und Coaching-Daten — und es gehört der Gemeinschaft, die es zu ihren eigenen Bedingungen unter den Regeln der [Datensouveränität](/docs/network/sovereignty/data-sovereignty) zurückspeisen kann (oder nicht). Der Rückkopplungsmechanismus ist ein Designziel der Plattform, noch keine implementierte Funktion; siehe [Fehler melden und Korrekturen besitzen](/docs/network/perspectives/reporting-errors-and-owning-corrections) dazu, wie Korrekturen und Herkunftsnachweise funktionieren sollen.

## Was die Qualitätsstufen für den realen Einsatz bedeuten

Die Rangliste bewertet Methoden anhand eines zusammengesetzten Maßes aus automatisierten Metriken ([Bewertungsspezifikation](/docs/network/specifications/scoring)), und die Werte werden benannten Stufen zugeordnet. Hier ist die ehrliche Übertragung dieser Stufen in die Begriffe des täglichen Einsatzes:

| Stufe (zusammengesetzt) | Was sie für den Weg des Post-Editings bedeutet |
|---|---|
| **Baseline** (0,00–0,30) | Für nichts brauchbar. Die Ausgabe ist überwiegend nicht die Zielsprache. Nur als Forschungsuntergrenze nützlich. |
| **Emerging** (0,30–0,50) | Noch kein Werkzeug zum Entwerfen. Korrekte Fragmente treten auf, aber eine sprechende Person würde mehr Zeit mit dem Korrigieren als mit dem Neuschreiben verbringen. |
| **Functional** (0,50–0,70) | Die erste Stufe, auf der Post-Editing die Übersetzung von Grund auf bei einfachen Texten *möglicherweise* übertreffen könnte — es lohnt sich, dies mit einer sprechenden Person zu erproben, aber nicht, sich darauf zu verlassen. Häufige morphologische Fehler bleiben bestehen. |
| **Deployable** (0,70–0,85) | Die Zielstufe für den oben beschriebenen Arbeitsablauf: Entwürfe, bei denen die meiste Morphologie korrekt ist und eine fließend sprechende Person deutlich schneller korrigieren kann als neu zu übersetzen. **„Deployable" bedeutet einsatzbereit *für einen Post-Editing-Arbeitsablauf* — niemals „ohne Überprüfung veröffentlichen".** |
| **Fluent** (0,85–1,00) | Nähert sich kompetenter menschlicher Übersetzung an; Fehler sind selten und geringfügig. Der Überprüfungsdurchgang bleibt bestehen — er wird lediglich schneller. |

Zwei strukturelle Ehrlichkeitsregeln liegen über dieser Tabelle, direkt aus der [Benchmark-Spezifikation §5 und §7](/docs/network/specifications/benchmark#5-quality-tiers):

- **Automatisierte Stufen sind vorläufige Bezeichnungen, keine Urteile.** Sie sind Nominierungen für die menschliche Überprüfung. Die Schwellenwerte werden neu kalibriert, sobald sich Validierungsdaten von sprechenden Personen ansammeln, und sie können für verschiedene Sprachen unterschiedlich ausfallen.
- **Keine Methode kann Deployable oder höher beanspruchen ohne gemeinschaftliche Überprüfung.** Eine geschichtete Stichprobe ihrer Ausgabe geht an zweisprachige Sprechende, die jede Übersetzung mit *reject / gist / acceptable / excellent* bewerten. Die Governance-Organisation — nicht die Rangliste — entscheidet, ob die Methode aufsteigt.

Zum Vergleich beschreibt der Schwellenwert des [Founder's Prize](/docs/network/specifications/prizes) (zusammengesetzt ≥ 0,80, ≥99 % morphologisch valide Wörter, ≥70 % von Sprechenden als akzeptabel-oder-besser bewertet) eine Methode, deren verbleibende Fehler *Fehler in der realen Sprache* sind — falsche Flexion, keine erfundenen Wörter. So sieht „ein Entwurf, der die Zeit einer sprechenden Person wert ist" in Zahlen aus.

## Von einer siegreichen Methode zu einem funktionierenden Büro

Angenommen, eine Methode überwindet diese Hürden. Die verbleibenden Schritte sind organisatorischer Natur, und sie sind spezifiziert statt improvisiert:

1. **Das Eigentum wird übertragen.** Der Code der Methode wird zum Eigentum der Governance-Organisation der Gemeinschaft — die entwickelnde Person behält die Rechte auf Namensnennung und Veröffentlichung ([Eigentumsübertragung](/docs/network/sovereignty/ownership-transfer)).
2. **Die Methode wird zu einem Dienst — dem Dienst der Gemeinschaft.** Sie wird als Plugin verpackt, das die Governance-Organisation auf ihrer eigenen Infrastruktur betreiben kann, wobei sie den Zugriff und die erlaubten Verwendungen kontrolliert ([In die Produktion überführen](/docs/network/getting-started/deploy-to-production)). Wenn die Gemeinschaft sich dazu entschließt, sie kommerziell anzubieten, ist das in jeder Hinsicht ihre Angelegenheit — Champollion nimmt keinen Anteil ([Wie die Arbeit finanziert wird](/docs/network/sovereignty/economic-model)).
3. **Übersetzende integrieren sie in ihren Arbeitsalltag.** Ein Übersetzungsbüro richtet seinen bestehenden Dokumenten-Arbeitsablauf auf die API der Methode aus: Quelltext hinein, Entwurf heraus, Post-Editing, Veröffentlichung. Der veröffentlichte Text trägt den Namen und die Autorität der übersetzenden Person — die Maschine ist ein Werkzeug auf ihrem Schreibtisch, wie ein Wörterbuch.

## Wo dies heute steht

Klar gesagt: Der vollständige Weg ist von Anfang bis Ende spezifiziert und teilweise implementiert. Das Evaluierungssystem, die Metriken, die Run Cards und die öffentliche Rangliste existieren; das Plains-Cree-Entwicklungskorpus und ein aktiver Preis existieren; die Bereitstellungsplattform existiert. Die Schnittstelle für die gemeinschaftliche Überprüfung, die Evaluierungs-Sandbox und die Rückkopplungsschleife für korrigierte Texte sind spezifiziert, aber noch nicht betriebsbereit — die Spezifikationen kennzeichnen sie als geplant, und das tun wir auch. Noch keine Methode hat die gesamte Reise vom Benchmark bis zum täglichen gemeinschaftlichen Einsatz abgeschlossen. Diese Reise ist die Definition des Projekterfolgs, und genau deshalb behaupten wir sie nicht verfrüht.

---

## Was das für Sie bedeutet

:::info[Wenn Sie ein Community-Mitglied sind]
Ein „Deployable“-Abzeichen auf einer Bestenliste bedeutet niemals, dass eine Maschine unbeaufsichtigt in Ihrer Sprache veröffentlicht — es bedeutet, dass ein Entwurfsgenerator bereit sein könnte, bei Ihren Übersetzern *vorzusprechen*, zu Ihren Bedingungen, mit Ihren Sprechern als Beurteilenden (bezahlten — siehe [Wie Sprecher bezahlt werden](/docs/network/perspectives/how-speakers-get-paid)). Wenn Ihre Community ein Übersetzungsbüro betreibt, lautet die relevante Frage, die Sie an uns richten sollten: „Wie würde ein Pilotprojekt aussehen, und wer überprüft die Ausgabe?“
:::

:::info[Wenn Sie ein Forscher sind]
Die Rahmung als Post-Editing verändert, was zu messen sich lohnt: die Zeit bis zu einem akzeptablen Text mit einem Sprecher im Prozess, nicht nur ein zusammengesetzter Wert. Die Metriken des Netzwerks sind Näherungswerte dafür ([Scoring-Spezifikation §1](/docs/network/specifications/scoring)), und sprachspezifische Post-Editing-Studien für morphologisch komplexe Sprachen sind eine offene Forschungslücke, die diese Infrastruktur zu unterstützen konzipiert ist.
:::

:::info[Wenn Sie ein Entwickler sind]
Optimieren Sie für den Bearbeiter, nicht für die Metrik. Eine Methode, die echte Wörter mit gelegentlich falschen Flexionen erzeugt, kann von einem Sprecher in Sekunden korrigiert werden; eine Methode, die plausibel aussehende Formen halluziniert, vergiftet den gesamten Arbeitsablauf — weshalb die morphologische Gültigkeit hier so streng geprüft wird. Beginnen Sie bei [Eine Methode einreichen](/docs/network/getting-started/submit-a-method), und lesen Sie das [Method Interface](/docs/network/specifications/methods) für das, was Sie letztlich übergeben werden, falls Sie gewinnen.
:::

## Siehe auch

- [Übersetzung ist keine Revitalisierung](/docs/network/perspectives/translation-is-not-revitalization) — warum die menschliche Hürde der Sinn der Sache ist, nicht eine Einschränkung
- [Fehler melden und Korrekturen besitzen](/docs/network/perspectives/reporting-errors-and-owning-corrections) — was geschieht, wenn der veröffentlichte Text trotzdem fehlerhaft ist
- [Benchmark-Spezifikation §7](/docs/network/specifications/benchmark#7-human-validation) — die menschliche Validierungshürde, formell
