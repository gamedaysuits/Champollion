---
sidebar_position: 8
title: "Cookbook: Back-Translation-Augmentierung"
---

# Augmentierung durch Rückübersetzung

> **Die Idee:** Erzeugen Sie synthetische Paralleldaten, indem Sie vorhandenen zielsprachigen Text in die Ausgangssprache zurückübersetzen, und verwenden Sie diese synthetischen Paare anschließend, um ein Vorwärtsmodell zu trainieren oder zu prompten. So erweitern Sie Ihr Parallelkorpus kostengünstig — jedoch mit Einschränkungen hinsichtlich der Qualität.

:::info[Dies ist ein Kochbuch, keine fertige Implementierung]
Dieser Leitfaden skizziert die Strategie und ihre entscheidenden Fallstricke. Rückübersetzung ist leistungsstark, kann jedoch Fehler verstärken, wenn sie nicht sorgfältig durchgeführt wird.
:::

## Wann Sie dies verwenden sollten

- Sie verfügen über **einsprachigen zielsprachigen Text**, aber nur über begrenzte Paralleldaten
- Sie möchten ein **Trainingskorpus erweitern** für das [Fine-Tuning](./fine-tuned-model), ohne manuell zu übersetzen
- Sie benötigen **mehr Few-Shot-Beispiele**, können jedoch nicht schnell genug menschliche Übersetzungen erhalten
- Sie sind bereit, die synthetischen Daten **aggressiv zu qualitätsfiltern**

## Funktionsweise

```
[Target-language text]          "awâsisak mêtawêwak"
        │
        ▼
[Back-translate to source]      "The children are playing"  (via LLM or MT API)
        │
        ▼
[Create synthetic pair]         ("The children are playing", "awâsisak mêtawêwak")
        │
        ▼
[Quality filter]                Keep only high-confidence pairs
        │
        ▼
[Use for training/prompting]    Expand your parallel corpus
```

1. **Einsprachigen Text sammeln** — zielsprachige Bücher, Artikel, Transkripte, Social Media
2. **Rückübersetzen** — verwenden Sie ein LLM oder eine MT-API, um jeden Satz in die Ausgangssprache zu übersetzen
3. **Qualitätsfilter** — Hin- und Rückübersetzung (erneut zurückübersetzen) und vergleichen; behalten Sie Paare, bei denen die Rückübersetzung ≈ dem Original entspricht
4. **Das synthetische Korpus verwenden** — für Fine-Tuning, Few-Shot-Beispiele oder Coaching-Daten

## Qualitätsfilterung: Der Hin-und-Rück-Test

```python
# Pseudo-code for round-trip quality filtering
for target_text in monolingual_corpus:
    # Back-translate: target → source
    synthetic_source = translate(target_text, "crk", "en")
    
    # Forward-translate: source → target
    round_trip = translate(synthetic_source, "en", "crk")
    
    # Compare round-trip to original
    chrf_score = compute_chrf(target_text, round_trip)
    
    if chrf_score > 0.70:  # High similarity = high-quality pair
        parallel_corpus.append((synthetic_source, target_text))
```

## Entscheidender Fallstrick: Fehlerverstärkung

:::warning[Rückübersetzung verstärkt bestehende Modellverzerrungen]
Wenn Ihr Rückübersetzungsmodell durchgehend dieselben Fehler macht, wird Ihr synthetisches Korpus diese Fehler als „korrekt“ codieren. Dies erzeugt eine Rückkopplungsschleife: Training mit schlechten Daten → Erzeugung schlechterer Übersetzungen → Generierung schlechterer synthetischer Daten. **Filtern Sie stets aggressiv nach Qualität** und mischen Sie synthetische Daten mit verifizierten menschlichen Übersetzungen.
:::

## Wo Sie einsprachigen Text finden

- Newsletter, Zeitungen und Publikationen von Gemeinschaften
- Behördendokumente in der Zielsprache (z. B. Nunavut Hansard für Inuktitut)
- Lehrmaterialien und Lehrbücher
- Religiöse Texte (für viele Sprachen weithin verfügbar)
- Social Media (mit entsprechenden Genehmigungen und Qualitätsfilterung)
- Transkribierte Audio-/Videoinhalte aus Sprachprogrammen

## Vor- und Nachteile

| | |
|---|---|
| ✅ Erweitert Trainingsdaten kostengünstig | ❌ Verstärkt Modellfehler, wenn nicht gefiltert wird |
| ✅ Nutzt reichlich vorhandenen einsprachigen Text | ❌ Qualitätsgrenze durch das Rückübersetzungsmodell begrenzt |
| ✅ Einfach in großem Maßstab zu erzeugen | ❌ Hin-und-Rück-Filterung ist rechenintensiv |
| ✅ Ergänzt andere Ansätze | ❌ Synthetische Daten sind nie so gut wie menschliche Übersetzung |

## Lässt sich gut kombinieren mit

- **[Fine-Tuned Model](./fine-tuned-model)** — Rückübersetzung erzeugt Trainingsdaten für das Fine-Tuning
- **[Korpuserstellung](./corpus-creation)** — synthetische Daten ergänzen von Menschen erstellte Korpora
- **[Coached LLM Prompting](./coached-llm-prompting)** — synthetische Beispiele können Coaching-Wörterbücher informieren

## Siehe auch

- [Evaluierungsdatensätze](/docs/network/leaderboard/datasets) — synthetische Daten dürfen sich nicht mit Evaluierungsdaten überschneiden
- [Leaderboard-Regeln](/docs/network/leaderboard/rules) — Kontaminationsrichtlinie
- [Eine ressourcenarme Sprache unterstützen](/docs/network/community/low-resource-languages)
