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
    note: "How runs are scored, and why no score is a quality label"
  - label: "Translation Is Not Revitalization"
    to: /docs/network/perspectives/translation-is-not-revitalization
    kind: position
---

# Vom Benchmark zum täglichen Einsatz: Der Weg des Post-Editings

> **Die Kurzfassung.** Ein Score auf einer Bestenliste ist kein Produkt. Der Weg von „Diese Methode erzielt einen chrF++-Wert von 47,5“ hin zu „Die Stammesverwaltung veröffentlicht jede Woche Dokumente in der Sprache“ führt über genau einen Arbeitsablauf: Die Maschine erstellt einen Entwurf, eine fließend sprechende Person korrigiert ihn, und ausschließlich der korrigierte Text wird veröffentlicht. Jeder Qualitätsschwellenwert in unseren Spezifikationen ist auf diesen Arbeitsablauf kalibriert – nicht auf unbeaufsichtigte maschinelle Ausgaben, die wir für keine Sprache auf dieser Plattform befürworten.

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

## Was ein Bestenlisten-Score aussagen kann – und was nicht

Die Bestenliste ordnet Methoden so ein, wie es im Bereich der maschinellen Übersetzung üblich ist: nach dem **chrF++**-Wert auf Korpusebene (0–100) samt 95%-Konfidenzintervall und sacreBLEU-Signatur, flankiert von BLEU, spBLEU, TER und COMET, während Diagnosen wie die FST-Akzeptanz separat ausgewiesen werden ([Bewertungsspezifikation](/docs/network/specifications/scoring#how-runs-are-scored)). Ob eine Methode auf demselben Evaluierungsset besser ist als eine andere, wird durch einen gepaarten Signifikanztest entschieden, nicht durch das bloße Vergleichen zweier Zahlen nach Augenmaß ([Signifikanztests](/docs/network/specifications/significance)).

Was dies einer Sprachgemeinschaft zeigt: welche Methoden Ergebnisse liefern, die näher an verlässlichen Referenzübersetzungen liegen, und ob ein Unterschied zwischen zwei Methoden statistisch belastbar ist. Was es Ihnen nicht sagen kann: ob ein Entwurf die Zeit einer sprechenden Person wert ist. Derselbe chrF++-Wert bedeutet für verschiedene Sprachen und Evaluierungssets Unterschiedliches; daher trägt hier kein automatischer Score ein Qualitätsprädikat. Früher bildete das Netzwerk einen gewichteten Gesamtscore auf benannte Stufen ab („funktional“, „einsatzfähig“, …); diese Bezeichnungen wurden abgeschafft – unter anderem, weil ein System, das für jede Eingabe denselben gültigen Satz wiederholte, als „funktional“ eingestuft wurde ([warum der Gesamtscore abgeschafft wurde](/docs/network/specifications/scoring#why-the-composite-was-retired)).

Daraus ergeben sich zwei grundlegende Regeln der Aufrichtigkeit aus der [Benchmark-Spezifikation §7](/docs/network/specifications/benchmark#7-human-validation):

- **Ein Score ist eine Nominierung für die menschliche Überprüfung, kein Urteil.** Ein starker chrF++-Wert macht eine Methode zu einem Kandidaten für Pilotprojekte mit Sprecherinnen und Sprechern; er macht sie noch nicht einsatzbereit.
- **Nur die Überprüfung durch die Sprachgemeinschaft entscheidet, ob eine Methode für einen Post-Editing-Workflow bereit ist.** Eine geschichtete Stichprobe ihrer Ausgaben wird zweisprachigen Sprecherinnen und Sprechern vorgelegt, die jede Übersetzung mit *Ablehnen / Kernaussage / Akzeptabel / Ausgezeichnet* bewerten. Die Trägerorganisation der Gemeinschaft – nicht die Bestenliste – entscheidet, ob die Methode weiter vorangebracht wird.

Zum Vergleich: Die Bedingungen für den [Gründerpreis](/docs/network/specifications/prizes) (ein Mindestwert für chrF++, ≥99 % morphologisch gültige Wörter als Eingangskriterium, ≥70 % von Sprechenden als akzeptabel oder besser bewertet) beschreiben eine Methode, deren verbleibende Fehler *Fehler der echten Sprache* sind – falsche Flexion, keine frei erfundenen Wörter. So sieht „ein Entwurf, der die Zeit einer sprechenden Person wert ist“ in Zahlen aus, und das Urteil der Sprechenden ist die Bedingung, die den Ausschlag gibt.

## Von einer siegreichen Methode zu einem funktionierenden Büro

Angenommen, eine Methode überwindet diese Hürden. Die verbleibenden Schritte sind organisatorischer Natur, und sie sind spezifiziert statt improvisiert:

1. **Das Eigentum wird übertragen.** Der Code der Methode wird zum Eigentum der Governance-Organisation der Gemeinschaft — die entwickelnde Person behält die Rechte auf Namensnennung und Veröffentlichung ([Eigentumsübertragung](/docs/network/sovereignty/ownership-transfer)).
2. **Die Methode wird zu einem Dienst — dem Dienst der Gemeinschaft.** Sie wird als Plugin verpackt, das die Governance-Organisation auf ihrer eigenen Infrastruktur betreiben kann, wobei sie den Zugriff und die erlaubten Verwendungen kontrolliert ([In die Produktion überführen](/docs/network/getting-started/deploy-to-production)). Wenn die Gemeinschaft sich dazu entschließt, sie kommerziell anzubieten, ist das in jeder Hinsicht ihre Angelegenheit — Champollion nimmt keinen Anteil ([Wie die Arbeit finanziert wird](/docs/network/sovereignty/economic-model)).
3. **Übersetzende integrieren sie in ihren Arbeitsalltag.** Ein Übersetzungsbüro richtet seinen bestehenden Dokumenten-Arbeitsablauf auf die API der Methode aus: Quelltext hinein, Entwurf heraus, Post-Editing, Veröffentlichung. Der veröffentlichte Text trägt den Namen und die Autorität der übersetzenden Person — die Maschine ist ein Werkzeug auf ihrem Schreibtisch, wie ein Wörterbuch.

## Wo dies heute steht

Offen gesagt: Der gesamte Weg ist von Anfang bis Ende spezifiziert und teilweise gebaut. Das Evaluierungs-Harness, die Metriken, die Durchlauf-Karten und die öffentliche Bestenliste existieren; die Evaluierungs-Sandbox ist gebaut, wurde jedoch erst mit einer simplen Testmethode erprobt; ein Plains-Cree-Entwicklungskorpus existiert vorgelagert; ein Preis ist vorgeschlagen, aber noch keiner ausgeschrieben; die Bereitstellungsplattform existiert. Die Benutzeroberfläche für die Überprüfung durch die Sprachgemeinschaft und die Feedbackschleife für korrigierte Texte sind spezifiziert, aber noch nicht einsatzfähig – in den Spezifikationen sind sie als geplant gekennzeichnet, und genau so handhaben wir es auch. Noch hat keine Methode den gesamten Weg von der Benchmark bis zum täglichen Einsatz in der Gemeinschaft zurückgelegt. Dieser Weg ist die Erfolgsdefinition des Projekts, und genau deshalb werden wir ihn nicht vorzeitig als erreicht deklarieren.

---

## Was das für Sie bedeutet

:::info[Wenn Sie Mitglied einer Sprachgemeinschaft sind]
Ein hoher Bestenlisten-Score bedeutet niemals, dass eine Maschine ohne menschliche Aufsicht Texte in Ihrer Sprache veröffentlichen wird – er bedeutet lediglich, dass ein Entwurfsgenerator bereit sein könnte, sich bei Ihren Übersetzerinnen und Übersetzern zu *bewerben*, zu Ihren Bedingungen, mit Ihren Sprechenden als Prüfenden (vergütet – siehe [Wie Sprechende bezahlt werden](/docs/network/perspectives/how-speakers-get-paid)). Wenn Ihre Gemeinschaft ein Übersetzungsbüro betreibt, lautet die entscheidende Frage, die Sie an uns richten sollten: „Wie würde ein Pilotprojekt aussehen und wer überprüft die Ergebnisse?“
:::

:::info[Wenn Sie forschen]
Der Post-Editing-Ansatz verändert, was gemessen werden sollte: die Zeit bis zum Erreichen eines akzeptablen Textes unter Einbindung einer sprechenden Person, nicht allein chrF++. Die Metriken des Netzwerks sind Näherungswerte dafür ([Bewertungsspezifikation §1](/docs/network/specifications/scoring)), und sprachspezifische Post-Editing-Studien für morphologisch komplexe Sprachen stellen eine offene Forschungslücke dar, deren Schließung diese Infrastruktur unterstützen soll.
:::

:::info[Wenn Sie ein Entwickler sind]
Optimieren Sie für den Bearbeiter, nicht für die Metrik. Eine Methode, die echte Wörter mit gelegentlich falschen Flexionen erzeugt, kann von einem Sprecher in Sekunden korrigiert werden; eine Methode, die plausibel aussehende Formen halluziniert, vergiftet den gesamten Arbeitsablauf — weshalb die morphologische Gültigkeit hier so streng geprüft wird. Beginnen Sie bei [Eine Methode einreichen](/docs/network/getting-started/submit-a-method), und lesen Sie das [Method Interface](/docs/network/specifications/methods) für das, was Sie letztlich übergeben werden, falls Sie gewinnen.
:::

## Siehe auch

- [Übersetzung ist keine Revitalisierung](/docs/network/perspectives/translation-is-not-revitalization) — warum die menschliche Hürde der Sinn der Sache ist, nicht eine Einschränkung
- [Fehler melden und Korrekturen besitzen](/docs/network/perspectives/reporting-errors-and-owning-corrections) — was geschieht, wenn der veröffentlichte Text trotzdem fehlerhaft ist
- [Benchmark-Spezifikation §7](/docs/network/specifications/benchmark#7-human-validation) — die menschliche Validierungshürde, formell
