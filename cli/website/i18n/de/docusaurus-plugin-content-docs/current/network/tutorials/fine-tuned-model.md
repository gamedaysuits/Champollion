---
sidebar_position: 5
title: "Cookbook: Fine-Tuned Model"
---

# Fine-Tuned Model

> **Die Idee:** Optimieren Sie ein Open-Weight-Modell (Llama, Mistral, Gemma) anhand von Paralleltext für Ihr Zielsprachpaar. Potenziell die höchste Qualitätsobergrenze, erfordert jedoch Paralleldaten, die möglicherweise rar sind — und die Regeln zur Kontamination von Evaluierungsdaten sind streng.

:::info[Dies ist ein Kochbuch, keine fertige Implementierung]
Dieser Leitfaden umreißt den Ansatz, die Datenanforderungen und die Fallstricke. Die eigentliche Trainingsinfrastruktur liegt außerhalb des Umfangs des Harness.
:::

## Wann Sie dies verwenden sollten

- Sie haben Zugriff auf einen **Parallelkorpus** (Hunderte bis Tausende von Satzpaaren), der **vollständig unabhängig** vom Evaluierungsdatensatz ist
- Sie haben **GPU-Zugriff** für das Training (lokale Hardware, Cloud oder universitärer Rechencluster)
- Sie wünschen die **höchste Qualitätsobergrenze** für ein bestimmtes Sprachpaar und sind bereit, in das Training zu investieren
- Andere Ansätze (Coached Prompting, Few-Shot) haben ein Qualitätsplateau erreicht

## Funktionsweise

1. **Paralleldaten zusammenstellen** — Quell-Ziel-Satzpaare aus unabhängigen Quellen (Lehrbücher, Community-Archive, Hansard-Aufzeichnungen, religiöse Texte, Lehrmaterialien)
2. **Trainingsformat vorbereiten** — Instruction-Tuning-Format (System-Prompt + Eingabe + erwartete Ausgabe)
3. **Fine-Tuning** — LoRA/QLoRA auf einem Basismodell (4-Bit-Quantisierung macht dies auf Consumer-GPUs realisierbar)
4. **Mit dem Harness evaluieren** — das feinabgestimmte Modell durch das Evaluierungs-Harness laufen lassen
5. **Iterieren** — Trainingsdaten, Hyperparameter und Auswahl des Basismodells anpassen

## Datenanforderungen

| Korpusgröße | Was zu erwarten ist |
|-------------|----------------|
| 50–200 Paare | Marginale Verbesserung gegenüber Zero-Shot; Überanpassung möglich |
| 200–1.000 Paare | Spürbare Verbesserung von Stil und Terminologie |
| 1.000–5.000 Paare | Signifikante Qualitätsgewinne für das spezifische Sprachpaar |
| 5.000+ Paare | Annäherung an die Qualitätsobergrenze des Basismodells |

:::danger[Kontamination der Eval-Daten = Disqualifikation]
Ihre Trainingsdaten DÜRFEN sich NICHT mit dem Evaluierungsdatensatz überschneiden. Weder die Sätze noch die Vokabelliste noch Paraphrasen desselben Inhalts. Das Harness erstellt Fingerabdrücke Ihrer Ausgaben; statistische Überschneidungen sind erkennbar. Falls Sie sich nicht sicher sind, ob eine Datenquelle unabhängig ist, entscheiden Sie sich im Zweifelsfall für den Ausschluss. Siehe [Leaderboard-Regeln](/docs/network/leaderboard/rules).
:::

## Grundgerüst: LoRA-Fine-Tuning

```python
# Conceptual skeleton — adapt to your framework (HuggingFace, Axolotl, etc.)

# 1. Format your parallel data as instruction pairs
training_data = [
    {"instruction": "Translate to Plains Cree (SRO)", 
     "input": "The children are playing",
     "output": "awâsisak mêtawêwak"},
    # ... hundreds more
]

# 2. Fine-tune with LoRA (4-bit for consumer GPUs)
# Base model: meta-llama/Llama-3.1-8B, google/gemma-2-9b, etc.
# Rank: 16–64, Alpha: 32–128, Epochs: 3–5

# 3. Export and serve via the harness TranslationMethod protocol
```

## Wo Sie Paralleldaten finden

- **Community-Archive** — Lehrmaterialien, Regierungsdokumente, zweisprachige Veröffentlichungen
- **Nunavut Hansard** — 1,3 Mio. ausgerichtete Englisch-Inuktitut-Paare (NRC Canada)
- **Bibelübersetzungen** — für viele ressourcenarme Sprachen verfügbar, jedoch domänenspezifisch
- **Bildungslehrbücher** — häufig zweisprachig für Sprachlernkontexte
- **Erstellen Sie Ihren eigenen** — siehe [Leitfaden zur Korpuserstellung](./corpus-creation)

## Vor- und Nachteile

| | |
|---|---|
| ✅ Höchste Qualitätsobergrenze | ❌ Erfordert Paralleldaten (rar für LRLs) |
| ✅ Modell erlernt sprachspezifische Muster | ❌ GPU-Kosten (auch wenn LoRA hilft) |
| ✅ Kann prompt-basierte Ansätze übertreffen | ❌ Überanpassungsrisiko bei kleinen Datensätzen |
| ✅ Einmalige Trainingskosten, danach kostengünstige Inferenz | ❌ Strenge Regeln zur Evaluierungskontamination |

## Lässt sich gut kombinieren mit

- **[Korpuserstellung](./corpus-creation)** — die benötigten Trainingsdaten erstellen
- **[Back-Translation](./back-translation)** — Ihren Parallelkorpus synthetisch erweitern
- **[FST-Gated Pipeline](./fst-gated-pipeline)** — feinabgestimmtes Modell + morphologische Validierung
- **[Coached LLM Prompting](./coached-llm-prompting)** — Coaching auf Basis eines feinabgestimmten Basismodells

## Siehe auch

- [Evaluierungsdatensätze](/docs/network/leaderboard/datasets) — erfahren Sie, womit Sie NICHT trainieren dürfen
- [Leaderboard-Regeln](/docs/network/leaderboard/rules) — Kontaminationsrichtlinie
- [Eine ressourcenarme Sprache unterstützen](/docs/network/community/low-resource-languages)
