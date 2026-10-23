---
sidebar_position: 0
title: "Zum Index beitragen"
description: "Schlagen Sie einen Datensatz, eine Ressource, eine Methode, einen menschlichen Übersetzungsdienst oder ein externes Ergebnis vor — oder eine Korrektur für eine Sprachkarte. Jede Einreichung wird von Menschen auf IP-, Lizenz- und Souveränitätskonformität überprüft — nichts wird automatisch genehmigt."
related:
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Already have a benchmark run? Publish the run card instead."
  - label: "Registering Corpora"
    to: /docs/network/sovereignty/registering-corpora
    kind: guide
    note: "Exposure tiers for corpora you own"
  - label: "Data Sovereignty"
    to: /docs/your-words-your-rules
    kind: doc
  - label: "Honest Limitations"
    to: /docs/network/honest-limitations
    kind: doc
---

# An den Index übermitteln

> **Zusammenfassung.** Schlagen Sie etwas für den Champollion-Index vor — einen Benchmark, eine Ressource, eine Übersetzungsmethode, einen menschlichen Übersetzungsdienst oder ein extern veröffentlichtes Ergebnis. Sie reichen ein kurzes strukturiertes Formular ein (in Ihrem Browser oder über die CLI); ein **Maintainer prüft jede Einreichung von Hand** auf IP-, Lizenz- sowie Community-/Souveränitätskonformität, bevor irgendetwas hinzugefügt wird. **Nichts wird automatisch genehmigt.**

Der Index ist die gemeinsame Karte: die Datensätze, anhand derer Methoden gebenchmarkt werden, die Wörterbücher und Werkzeuge, die helfen, die Methoden selbst, die Menschen, die von Hand übersetzen, und die Ergebnisse, die andere veröffentlicht haben. Jeder kann eine Ergänzung vorschlagen. Da dies eine Infrastruktur für Sprachgemeinschaften ist, durchläuft jeder Vorschlag zunächst eine menschliche Prüfinstanz.

---

## Was Sie übermitteln können

| Typ | Was es ist | Was wir hinzufügen |
|---|---|---|
| **Benchmark / Datensatz** | Ein Evaluierungskorpus oder Benchmark | Eine Metadatenkarte + ein *Fetch-from-Source*-Verweis — niemals der Korpusinhalt |
| **Ressource** | Ein Wörterbuch, Archiv, eine App, ein FST (morphologischer Analysator) oder Werkzeug | Ein Eintrag mit einem Verweis + Zugriffsebene (offen / eingeschränkt / Zustimmung erforderlich) |
| **Übersetzungsmethode** | Eine MÜ-Engine, ein LLM-Anbieter oder eine Pipeline | Ein Eintrag im Methodenregister, damit sie ausgeführt und evaluiert werden kann |
| **Menschlicher Übersetzungsdienst** | Eine Opt-in-Gemeinschaftsstelle, Agentur oder ein einzelner Übersetzer | Ein Eintrag pro Sprachpaar (Kontaktdaten bleiben Out-of-Band — niemals im öffentlichen Issue) |
| **Extern veröffentlichtes Ergebnis** | Ein von einem anderen System oder einer Arbeit berichteter Score | Eine **Quellenangabe** — externe Ergebnisse werden zitiert, niemals erneut gehostet oder als unsere eigene Messung eingestuft |
| **Korrektur einer Sprachenkarte** | Etwas auf einer [Sprachenkarte](/catalogue) ist falsch, veraltet oder fehlt — eine Schätzung der Sprecherzahl, ein Status, eine Schrift, eine noch nicht aufgeführte Ressource | Eine **belegte Korrektur direkt an der Datenquelle** (Karten werden generiert, sodass die Korrektur dauerhaft erhalten bleibt); bei abweichenden Quellen zeigt die Karte alle an, jeweils mit Quellenzuordnung |

Jede Sprachenkarte enthält zudem einen Link **„Korrektur oder Ergänzung vorschlagen“**,
der das Korrekturformular mit der bereits vorausgewählten Sprache öffnet.

**Anträge aus Gemeinschaften auf Entfernung und Einschränkung.** Wenn Sie Mitglied
oder eine Vertretung einer Gemeinschaft sind und möchten, dass Daten über Ihre Sprache eingeschränkt oder entfernt werden, nutzen Sie
das Korrekturformular (oder kontaktieren Sie die Projektleitung auf direktem Weg, falls Sie dies
nicht öffentlich machen möchten). Diese Anfragen durchlaufen die [Souveränitätsprüfung](/docs/your-words-your-rules)
mit Priorität — kein Beleg erforderlich.

---

## Wie die Prüfung funktioniert

Dies ist der wichtige Teil: **Einreichungen werden von einem Menschen geprüft, nicht von einem Roboter.** Wenn Sie etwas einreichen, eröffnen Sie ein GitHub-Issue. Dieses Issue ist die Prüfwarteschlange. Ein Maintainer liest es und gleicht es mit den Regeln des Projekts ab, bevor irgendetwas hinzugefügt wird:

- **Geistiges Eigentum & Lizenz.** Wir müssen berechtigt sein, das Material aufzulisten. Material mit nicht-kommerzieller Lizenz, Weitergabeverbot oder unklarer Lizenz kann dennoch *katalogisiert* werden, ist jedoch von jeglichen kommerziellen Pfaden, Preiswettbewerben oder öffentlichen Abrufkanälen ausgeschlossen.
- **Gemeinschaft & Souveränität.** Daten zu indigenen Sprachen und Gemeinschaftssprachen werden ausschließlich mit Zustimmung der jeweiligen Gemeinschaft aufgeführt. Anbieter oder Verwalter werden niemals öffentlich genannt, bevor sie dies bestätigt haben (bislang ist niemand aufgeführt).
- **Wir hosten niemals Korpusinhalte.** Datensätze werden als Metadaten zusammen mit einem Verweis darauf aufgeführt, von wo die Daten bezogen werden. **Fügen Sie keine Quell-/Referenzsätze in eine Einreichung ein.**
- **Keine personenbezogenen Daten.** Keine E-Mail-Adressen, Telefonnummern oder sonstige personenbezogene Daten (PII) in einem öffentlichen Issue. Bei menschlichen Übersetzungsdiensten werden die Kontaktdaten dem Maintainer out-of-band übermittelt.
- **Geltungsbereich.** Biblische / liturgische und andere Korpora kolonialer Fremdbestimmung liegen außerhalb des Rahmens und werden abgelehnt.

Jedes Formular endet mit einer erforderlichen Bestätigung:

> *„Ich bestätige, dass dies öffentlich listbar ist, KEINE Korpusinhalte oder personenbezogenen Daten enthält und die Lizenz der Quelle sowie etwaige Community-/Souveränitätsbeschränkungen respektiert."*

---

## Zwei Möglichkeiten der Einreichung

### Über Ihren Browser

Öffnen Sie die Issue-Auswahl und wählen Sie das Formular, das zu Ihrer Einreichung passt:

➡️ **[Ein Einreichungsformular auf GitHub öffnen](https://github.com/gamedaysuits/Champollion/issues/new/choose)**

Jedes Formular fragt nur das ab, was der zugehörige Index benötigt (Name, Sprachen/Sprachpaare, Lizenz, Quell-URL und so weiter) sowie das Bestätigungskästchen.

### Über die CLI

Wenn Sie die [champollion CLI](/docs/network/getting-started/submit-a-method) haben, sammelt `champollion submit` die Felder und übergibt Ihnen eine **vorausgefüllte** Version desselben GitHub-Formulars:

```bash
# Interactive — pick a type and answer the prompts
champollion submit

# See the submission types
champollion submit --list

# Fully scripted (prints a pre-filled GitHub issue URL)
champollion submit --yes --type dataset --attest \
  --field dataset-name="GlobalVoices eng-amh" \
  --field pairs=eng-amh \
  --field license=CC-BY-4.0 \
  --field source-url=https://globalvoices.org
```

Die CLI gibt eine URL aus — öffnen Sie sie, prüfen Sie die Bestätigung im Browser und reichen Sie ein. Fügen Sie `--out submission.json` hinzu, um zusätzlich eine lokale, inhaltsfreie Kopie dessen zu speichern, was Sie vorschlagen. Die CLI lädt niemals selbst etwas hoch und schreibt niemals in den Index.

---

## Was nach Ihrer Einreichung geschieht

1. Ihre Einreichung trifft als GitHub-Issue ein — die Prüfwarteschlange.
2. Ein Maintainer prüft sie anhand der oben genannten IP-/Lizenz-/Souveränitätsregeln.
3. **Bei Annahme:** Der Maintainer fügt den Eintrag der relevanten Source-of-Truth (dem Datensatz-Registry, einer Karte, dem Methoden- oder Menschen-Dienst-Registry oder dem Katalog externer Ergebnisse) durch eine normale Änderung hinzu und versieht das Issue mit dem Label **accepted**.
4. **Wenn es nicht in der vorliegenden Form gelistet werden kann:** Der Maintainer versieht es mit dem Label **declined** (oder bittet um weitere Informationen) unter Angabe des Grundes.

Es gibt kein automatisches Mergen und keine automatische Veröffentlichung. Eine Person trifft jedes Mal die Entscheidung.

---

## Siehe auch

- [Eine Methode einreichen](/docs/network/getting-started/submit-a-method) — Haben Sie bereits einen Benchmark-Durchlauf? Veröffentlichen Sie die Durchlaufkarte direkt.
- [Korpora registrieren](/docs/network/sovereignty/registering-corpora) — Freigabestufen (lokal / privat / öffentlich / versiegelt) für Korpora in Ihrem Besitz.
- [Ihre Worte, Ihre Regeln](/docs/your-words-your-rules) — wie die Kontrolle über Sprachdaten durch die Gemeinschaft hier funktioniert.
- [Ihre Worte, Ihre Regeln](/docs/your-words-your-rules) — Partnerschaft, Zustimmung und Schlüsselverwahrung.
