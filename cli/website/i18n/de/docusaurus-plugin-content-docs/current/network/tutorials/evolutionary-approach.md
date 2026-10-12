---
sidebar_position: 9
title: "Cookbook: Evolutionär / Suchbasiert"
---

# Evolutionäre / suchbasierte Übersetzung

> **Die Grundidee:** Mehrere Übersetzungskandidaten erzeugen, sie anhand einer Fitnessfunktion bewerten (chrF++, FST-Akzeptanz, Round-Trip-Konsistenz), die besten Kandidaten mutieren und wiederholen. Natürliche Selektion für Übersetzungen — die am besten geeigneten überleben.

:::info[Dies ist ein Kochbuch, keine fertige Implementierung]
Dies ist der experimentellste Ansatz in der Kochbuchreihe. Er wurde nicht für MT im großen Maßstab erprobt, aber die Architektur ist solide, und das Harness bewertet bereitwillig, was auch immer es hervorbringt.
:::

## Wann Sie dies verwenden sollten

- Sie verfügen über eine **gute Bewertungsfunktion**, aber kein einzelnes Modell liefert konsistente Ergebnisse
- Sie möchten den **Lösungsraum** breiter **erkunden** als bei einer einzelnen Greedy-Generierung
- Sie verfügen über **Rechenbudget** für viele parallele Generierungen (Dutzende Kandidaten pro Eingabe)
- Sie interessieren sich für **neuartige Forschung** — dieser Ansatz ist für ressourcenarme MT noch wenig erforscht

## Wie es funktioniert

```
[Generation 0]    Generate N candidates (different models, temperatures, prompts)
       │
       ▼
[Score]           Evaluate each candidate: chrF++, FST acceptance, fluency
       │
       ▼
[Select]          Keep top K performers
       │
       ▼
[Mutate]          Prompt an LLM: "improve this translation, fix these issues"
       │
       ▼
[Generation 1]    Score again. Repeat for G generations.
       │
       ▼
[Output]          Best-scoring candidate from final generation
```

## Grundgerüst

```python
async def evolutionary_translate(source, reference=None, generations=3, pop_size=8):
    # Generation 0: diverse candidates
    population = []
    for model in ["gemini-2.5-pro", "gpt-4o", "claude-sonnet-4-6"]:
        for temp in [0.3, 0.7, 1.0]:
            candidate = await translate(source, model=model, temperature=temp)
            population.append(candidate)
    
    for gen in range(generations):
        # Score each candidate
        scored = [(c, score(c, reference)) for c in population]
        scored.sort(key=lambda x: x[1], reverse=True)
        
        # Select top K
        survivors = [c for c, s in scored[:pop_size // 2]]
        
        # Mutate: ask LLM to improve each survivor
        mutants = []
        for survivor in survivors:
            mutant = await improve(source, survivor, feedback=scored[0])
            mutants.append(mutant)
        
        population = survivors + mutants
    
    return max(population, key=lambda c: score(c, reference))
```

## Gestaltung der Fitnessfunktion

Die Fitnessfunktion ist alles entscheidend. Optionen:

| Metrik | Was sie misst | Automatisiert? |
|--------|-----------------|------------|
| chrF++ gegen Referenz | Zeichenebene-Ähnlichkeit zum Goldstandard | ✅ Ja |
| FST-Akzeptanzrate | Morphologische Validität | ✅ Ja (sofern FST verfügbar) |
| Round-Trip-Konsistenz | Stellt die Rückübersetzung die Quelle wieder her? | ✅ Ja |
| LLM-as-judge | Ein weiteres LLM bewertet Sprachfluss/Genauigkeit | ✅ Ja (aber verrauscht) |
| Vorhandensein von Wörterbuchbegriffen | Erscheinen bekannte Begriffe korrekt? | ✅ Ja |

:::tip[Mehrere Signale kombinieren]
Eine Kombination von Signalen kann die Suche besser steuern als ein einzelnes Signal. Stellen Sie sicher, dass sie nicht manipuliert werden kann: Eine Mischung, die sich auf die FST-Akzeptanz stützt, belohnt Ausgaben, die zwar gültig, aber unübersetzt sind – weshalb das harness-eigene [gewichtete Komposit ausgemustert wurde](/docs/network/specifications/scoring#why-the-composite-was-retired). Gegen welche Fitnessfunktion Sie auch optimieren: Beurteilen Sie die finalen Kandidaten so, wie es das Harness tut – anhand von chrF++ samt Konfidenzintervall, verglichen mit einem gepaarten Signifikanztest (`mt-eval compare --significance`), wobei die anderen Signale als Diagnosewerte aufgeführt werden.
:::

## Vor- und Nachteile

| | |
|---|---|
| ✅ Erkundet vielfältige Lösungen | ❌ Rechenintensiv (N × G API-Aufrufe) |
| ✅ Kann Ansätze entdecken, die kein einzelnes Modell findet | ❌ Erfordert eine gute Fitnessfunktion |
| ✅ Parallelisierbar | ❌ Langsam — mehrere Generierungen pro Übersetzung |
| ✅ Modellagnostisch | ❌ Abnehmender Ertrag nach einigen Generierungen |

## Lässt sich gut kombinieren mit

- **[Chained Models](./chained-models)** — der Mutationsschritt ist eine Form der Verkettung
- **[FST-Gated Pipeline](./fst-gated-pipeline)** — FST-Akzeptanz als Fitnesssignal
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — Vorhandensein von Wörterbucheinträgen als Fitnesssignal

## Siehe auch

- [Run Card Specification](/docs/network/specifications/run-card) — Kosten und Latenz werden pro Eintrag erfasst
- [Eval Harness](/docs/network/specifications/harness) — das Harness bewertet Ihre endgültige Ausgabe, nicht Ihren Prozess
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages)
