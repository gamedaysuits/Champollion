---
sidebar_position: 11
title: "Kochbuch: Korpuserstellung"
---

# Leitfaden zur Korpuserstellung

> **Die Idee:** Bevor Sie eine Übersetzungsmethode bewerten können, benötigen Sie ein Evaluierungskorpus. Dieser Leitfaden behandelt, wie Sie ein solches von Grund auf erstellen — Datenbeschaffung, Formatanforderungen, Qualitätsstandards, Lizenzierung und Beiträge zum Network.

:::info[Dies ist keine Übersetzungsmethode]
Dieser Leitfaden ist die Voraussetzung für viele Methoden. Ein guter Evaluationskorpus ist die Grundlage, die alles Weitere ermöglicht. Selbst 50 sorgfältig ausgewählte Paare genügen, um eine neue Leaderboard-Kategorie zu eröffnen.
:::

## Wann Sie dies verwenden sollten

- Sie möchten dem Network-Leaderboard ein **neues Sprachpaar hinzufügen**
- Sie sind **Sprachlehrer** und möchten die Übersetzungen Ihrer Schüler bewerten
- Sie sind ein **Sprachmitarbeiter einer Gemeinschaft** mit Zugang zu zweisprachigen Materialien
- Sie sind ein **Forscher**, der einen standardisierten Evaluierungssatz für Ihr Sprachpaar benötigt

## Korpusformat

Das Harness nimmt einfaches JSON entgegen:

```json title="my-corpus.json"
{
  "metadata": {
    "name": "Quechua Dev v1",
    "version": "1.0.0",
    "source_language": "eng",
    "target_language": "que",
    "entry_count": 75,
    "license": "CC-BY-SA-4.0",
    "author": "Your Name / Organization",
    "description": "75 English-Quechua pairs from educational materials"
  },
  "entries": [
    {
      "id": 1,
      "source": "Hello, how are you?",
      "reference": "Allillanchu, imaynallan kashanki?"
    },
    {
      "id": 2,
      "source": "The sun is shining today",
      "reference": "Kunan p'unchay inti k'anchashan"
    }
  ]
}
```

## Wo Sie Daten beschaffen

| Quelle | Qualität | Umfang | Lizenzierung |
|--------|---------|--------|-----------|
| **Lehrbücher / Bildungsmaterialien** | Hoch (fachlich geprüft) | Niedrig-mittel | Beim Verlag nachfragen |
| **Behördliche Dokumente** | Mittel (formales Register) | Mittel-hoch | Oft gemeinfrei |
| **Zweisprachige Wörterbücher** | Hoch (verifizierte Einträge) | Mittel | Variiert |
| **Ältere / Sprecher der Gemeinschaft** | Am höchsten (muttersprachliche Intuition) | Niedrig (begrenzte Zeit) | Von der Gemeinschaft verwaltet |
| **Religiöse Texte** | Mittel (domänenspezifisch) | Hoch | Meist offen |
| **Bestehende Korpora** (Hansard, FLORES) | Mittel-hoch | Hoch | Lizenz prüfen |
| **Handgefertigt** | Am höchsten | Niedrig | Sie besitzen es |

## Qualitätsstandards

Ein gutes Evaluierungskorpus weist Folgendes auf:

1. **Vielfältiger Inhalt** — nicht nur Begrüßungen oder einfache Phrasen. Beziehen Sie Fragen, Befehle, komplexe Sätze und domänenspezifische Begriffe ein
2. **Verifizierte Übersetzungen** — geprüft von mindestens einem fließenden Sprecher, idealerweise zwei
3. **Konsistente Orthografie** — durchgängig eine Schrift, eine Rechtschreibkonvention
4. **Unabhängige Quellen** — nicht aus demselben Text abgeleitet, mit dem Methoden trainiert werden
5. **Klare Lizenzierung** — eine ausdrückliche Lizenz, die die Verwendung zur Evaluierung erlaubt

:::danger[Korpus-Kontamination]
Der Evaluationskorpus muss **unabhängig** von jeglichen Trainingsdaten sein. Wenn eine Methode mit Daten aus dem Evaluationskorpus trainiert oder geprompt wurde, wird sie disqualifiziert. Konzipieren Sie Ihren Korpus von Anfang an als zurückgehaltenen Datensatz.
:::

## Größenrichtlinien

| Größe | Was es ermöglicht |
|------|----------------|
| **50 Einträge** | Minimal tragfähige Evaluierung — genug, um grobe Qualitätsunterschiede zu erkennen |
| **100–200 Einträge** | Zuverlässiges Ranking — genug für statistische Signifikanz zwischen Methoden |
| **500+ Einträge** | Forschungstauglich — robuste Gesamtwerte, Konfidenzintervalle |
| **1.000+ Einträge** | Goldstandard — entspricht der Abdeckung von FLORES devtest |

Fangen Sie klein an. 50 Einträge genügen, um einen Leaderboard-Track zu eröffnen. Sie können später erweitern.

## Beiträge zum Network

1. **Erstellen Sie Ihren Korpus** im oben genannten JSON-Format
2. **Lizenzieren Sie ihn** — CC BY-SA 4.0 wird für offene Evaluation empfohlen; CC BY-NC-SA 4.0 für eingeschränkte Nutzung
3. **Hosten Sie ihn an einer stabilen Quelle** (Ihrem eigenen Repository, einem institutionellen Archiv oder einer Datenregistrierung) — Champollion hostet oder verfolgt niemals Korpus-Inhalte
4. **Reichen Sie eine Fetch-from-Source-Metadatenkarte ein** — öffnen Sie einen PR gegen das [öffentliche Repo](https://github.com/gamedaysuits/Champollion) und fügen Sie einen Registrierungseintrag hinzu, der das Harness auf Ihre Upstream-Quelle verweist (Loader/URL, SHA-Pin, Lizenz, Herkunft); siehe [Datasets](/docs/network/leaderboard/datasets#creating-a-new-dataset) für das Kartenformat
5. **Das Leaderboard wird eröffnet** für Ihr Sprachpaar, sobald die Karte gemergt ist

## Für indigene Sprachgemeinschaften

Korpuserstellung ist ein Akt der **Sprachsouveränität**. Ihr Korpus, Ihre Bedingungen:

- Sie entscheiden über die Lizenz und die Zugangsbedingungen
- Sie können einen **öffentlichen Entwicklungssatz** beitragen (für die Methodenentwicklung), während Sie einen **geheimen Testsatz** (für die offizielle Evaluierung) unter der Kontrolle der Gemeinschaft behalten
- Das [Souveränitäts-Framework](/docs/network/sovereignty/data-sovereignty) schützt Ihre Daten auf jeder Ebene

Selbst ein kleines Korpus ist ein **strategisches Gut** — es ist der Maßstab, der bestimmt, was „gut genug" für Ihre Sprache bedeutet.

## Lässt sich gut kombinieren mit

- **[Teilübersetzung](./partial-translation)** — die Erstellung eines Korpus IST der menschliche Übersetzungsschritt
- **[Rückübersetzung](./back-translation)** — synthetische Daten ergänzen von Menschen erstellte Korpora
- Jedes andere Kochbuch — sie alle benötigen ein Evaluierungskorpus

## Siehe auch

- [Evaluierungsdatensätze](/docs/network/leaderboard/datasets) — bestehende Korpora (EDTeKLA, FLORES+)
- [Datensouveränität](/docs/network/sovereignty/data-sovereignty) — Eigentum und Kontrolle
- [Für Sprachgemeinschaften](/docs/network/community/for-language-communities) — Engagement der Gemeinschaft
- [Eine ressourcenarme Sprache unterstützen](/docs/network/community/low-resource-languages) — das Gesamtbild
