---
sidebar_position: 6
title: "Cookbook: Verkettete Modelle"
---

# Verkettete Modelle (mehrstufige Pipeline)

> **Die Idee:** Modell A erzeugt eine grobe Übersetzung → Modell B führt ein Post-Editing durch → Modell C bewertet oder validiert das Ergebnis. Jede Stufe spezialisiert sich auf eine Aufgabe. Die Ausgabe der Pipeline ist besser als jedes einzelne Modell für sich.

:::info[Dies ist ein Kochbuch, keine fertige Implementierung]
Dieser Leitfaden skizziert die Architektur mehrstufiger Pipelines. Die konkreten Modelle und die Verkettungskonfiguration hängen von Ihrem Sprachpaar und Ihrem Budget ab.
:::

## Wann Sie dies verwenden sollten

- Ein einzelnes Modell liefert **inkonsistente Qualität** — gut bei manchen Eingaben, schlecht bei anderen
- Sie möchten **Generierung und Validierung trennen** — ein Modell erstellt, ein anderes kritisiert
- Sie verfügen über das Budget für **mehrere API-Aufrufe pro Übersetzung** (Latenz und Kosten skalieren linear mit der Anzahl der Stufen)
- Sie möchten Modelle mit **unterschiedlichen Stärken** kombinieren (z. B. einen kreativen Generator + einen präzisen Editor)

## Funktionsweise

```
Input ──→ [Stage 1: Generator] ──→ [Stage 2: Editor] ──→ [Stage 3: Validator] ──→ Output
              │                         │                        │
              │ "Translate this"        │ "Fix errors in         │ "Rate 1-5 and
              │                         │  this translation"     │  flag issues"
              ▼                         ▼                        ▼
         Raw translation          Polished translation      Score + accept/reject
```

## Beispiel: Dreistufige Pipeline

```python
# Stage 1: Fast model generates candidate
raw = await fast_model.translate(source, target_lang="crk")

# Stage 2: Strong model post-edits
edited = await strong_model.complete(
    f"The following {target_lang} translation may contain errors. "
    f"Fix any grammatical or vocabulary mistakes:\n"
    f"Source: {source}\nTranslation: {raw}\nCorrected:"
)

# Stage 3: Validator model scores
score = await validator.complete(
    f"Rate this translation 1-5 for accuracy and fluency:\n"
    f"Source: {source}\nTranslation: {edited}\nScore:"
)

# Accept if score >= 3, otherwise retry Stage 1 with different temperature
```

## Gängige Verkettungsmuster

| Muster | Stufen | Anwendungsfall |
|---------|--------|----------|
| **Generate → Edit** | Schnelles LLM → Starkes LLM | Kosteneffiziente Qualitätsverbesserung |
| **Generate → Validate → Retry** | LLM → FST/Regeln → LLM (Wiederholung bei Fehler) | Morphologische Korrektheit (siehe [FST-Gated](./fst-gated-pipeline)) |
| **Generate → Back-translate → Score** | LLM(en→crk) → LLM(crk→en) → Vergleich | Konsistenzprüfung durch Rückübersetzung |
| **Ensemble → Vote** | 3 LLMs unabhängig → Mehrheitsentscheid | Robustheit durch Diversität |

## Zentrale Designentscheidungen

**Latenzbudget:** Jede Stufe vervielfacht die Latenz. Eine dreistufige Kette mit 2 s pro Stufe = 6 s pro Übersetzung. Für die Batch-Evaluierung ist dies unproblematisch; für Echtzeitanwendungen möglicherweise nicht.

**Kostenmultiplikator:** 3 Stufen = 3-fache API-Kosten. Verwenden Sie günstigere Modelle für frühe Stufen und teurere Modelle für kritische Stufen.

**Fehlerfortpflanzung:** Eine schlechte Ausgabe von Stufe 1 kann Stufe 2 in die Irre führen. Geben Sie in jeder Stufe die ursprüngliche Quelle mit, damit spätere Modelle Fehler korrigieren können.

## Vor- und Nachteile

| | |
|---|---|
| ✅ Kann die Stärken von Spezialisten kombinieren | ❌ Latenz und Kosten vervielfachen sich pro Stufe |
| ✅ Trennung der Zuständigkeiten (Generierung vs. Validierung) | ❌ Komplex zu debuggen — welche Stufe hat den Fehler verursacht? |
| ✅ Einzelne Stufen lassen sich leicht austauschen | ❌ Fehlerfortpflanzung zwischen den Stufen |
| ✅ Validierung durch Rückübersetzung erkennt Halluzinationen | ❌ Abnehmender Grenznutzen jenseits von 2–3 Stufen |

## Lässt sich gut kombinieren mit

- **[FST-Gated Pipeline](./fst-gated-pipeline)** — FST als Validierungsstufe
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — Wörterbucheinspeisung in der Generierungsstufe
- **[Coached LLM Prompting](./coached-llm-prompting)** — Coaching in einer oder mehreren Stufen

## Siehe auch

- [Eval Harness](/docs/network/specifications/harness) — das Harness misst die End-to-End-Ausgabe der Pipeline
- [Run Card Specification](/docs/network/specifications/run-card) — Latenz und Kosten werden pro Eintrag erfasst
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages)
