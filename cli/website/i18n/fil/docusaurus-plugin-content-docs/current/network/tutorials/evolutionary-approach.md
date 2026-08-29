---
sidebar_position: 9
title: "Cookbook: Ebolusyonaryo / Nakabatay sa Paghahanap"
---

# Evolutionary / Search-Based na Pagsasalin

> **Ang ideya:** Bumuo ng maraming kandidatong salin, bigyan ang mga ito ng score laban sa isang fitness function (chrF++, FST acceptance, round-trip consistency), i-mutate ang pinakamahuhusay na performer, at ulitin. Natural selection para sa mga salin — ang pinakaangkop ang mananatili.

:::info[Ito ay isang cookbook, hindi isang tapos na implementasyon]
Ito ang pinaka-eksperimental na pamamaraan sa serye ng cookbook. Hindi pa ito napatutunayan para sa malakihang MT, ngunit matatag ang arkitektura at handa namang bigyan ng score ng harness ang anumang mailalabas nito.
:::

## Kailan Ito Gagamitin

- Mayroon kayong **mahusay na scoring function** ngunit walang iisang model na nagbibigay ng konsistent na mga resulta
- Nais ninyong **galugarin ang solution space** nang mas malawak kaysa sa iisang greedy generation
- Mayroon kayong **compute budget** para sa maraming parallel generation (dose-dosenang kandidato kada input)
- Interesado kayo sa **bagong pananaliksik** — hindi pa gaanong nasisiyasat ang lapit na ito para sa low-resource MT

## Paano Ito Gumagana

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

## Skeleton

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

## Disenyo ng Fitness Function

Ang fitness function ang pinakamahalaga. Mga opsyon:

| Metric | Ano ang Sinusukat Nito | Automated? |
|--------|-----------------|------------|
| chrF++ against reference | Character-level similarity sa gold | ✅ Oo |
| FST acceptance rate | Bisa ng morpolohiya | ✅ Oo (kung available ang FST) |
| Round-trip consistency | Naibabalik ba ng back-translation ang source? | ✅ Oo |
| LLM-as-judge | Nire-rate ng isa pang LLM ang fluency/accuracy | ✅ Oo (ngunit maingay) |
| Dictionary term presence | Lumilitaw ba nang tama ang mga kilalang termino? | ✅ Oo |

:::tip[Pagsamahin ang maraming signal]
Ang may-timbang na kombinasyon ng metrics ay lumilikha ng mas matatag na fitness function kaysa sa alinmang iisang metric. Sinasalamin nito ang sariling [composite score](/docs/network/leaderboard/rules) ng harness.
:::

## Mga Kalamangan at Kahinaan

| | |
|---|---|
| ✅ Gumagalugad ng sari-saring solusyon | ❌ Magastos sa computation (N × G API calls) |
| ✅ Maaaring makatuklas ng mga lapit na hindi nahahanap ng iisang model | ❌ Nangangailangan ng mahusay na fitness function |
| ✅ Maaaring i-parallelize | ❌ Mabagal — maraming generation kada salin |
| ✅ Model-agnostic | ❌ Paunting pakinabang matapos ang ilang generation |

## Mahusay na Naipapares Sa

- **[Chained Models](./chained-models)** — ang mutation step ay isang anyo ng chaining
- **[FST-Gated Pipeline](./fst-gated-pipeline)** — FST acceptance bilang fitness signal
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — dictionary presence bilang fitness signal

## Tingnan Din

- [Run Card Specification](/docs/network/specifications/run-card) — itinatala ang gastos at latency kada entry
- [Eval Harness](/docs/network/specifications/harness) — binibigyan ng score ng harness ang inyong final output, hindi ang inyong proseso
- [Suportahan ang isang Low-Resource Language](/docs/network/community/low-resource-languages)
