---
sidebar_position: 9
title: "Cookbook: Evolutionary / Search-Based"
---

# Evolutionary / Search-Based Translation

> **The idea:** Generate multiple candidate translations, score them against a fitness function (chrF++, FST acceptance, round-trip consistency), mutate the best performers, and repeat. Natural selection for translations — the fittest survive.

:::info[This is a cookbook, not a finished implementation]
This is the most experimental approach in the cookbook series. It hasn't been proven for MT at scale, but the architecture is sound and the harness will happily score whatever it produces.
:::

## When to Use This

- You have a **good scoring function** but no single model produces consistent results
- You want to **explore the solution space** more broadly than a single greedy generation
- You have **compute budget** for many parallel generations (dozens of candidates per input)
- You're interested in **novel research** — this approach is underexplored for low-resource MT

## How It Works

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

## Fitness Function Design

The fitness function is everything. Options:

| Metric | What It Measures | Automated? |
|--------|-----------------|------------|
| chrF++ against reference | Character-level similarity to gold | ✅ Yes |
| FST acceptance rate | Morphological validity | ✅ Yes (if FST available) |
| Round-trip consistency | Does back-translating recover the source? | ✅ Yes |
| LLM-as-judge | Another LLM rates fluency/accuracy | ✅ Yes (but noisy) |
| Dictionary term presence | Do known terms appear correctly? | ✅ Yes |

:::tip[Combine multiple signals]
A weighted combination of metrics makes a more robust fitness function than any single metric. This mirrors the harness's own [composite score](/docs/network/leaderboard/rules).
:::

## Pros and Cons

| | |
|---|---|
| ✅ Explores diverse solutions | ❌ Computationally expensive (N × G API calls) |
| ✅ Can discover approaches no single model finds | ❌ Requires a good fitness function |
| ✅ Parallelizable | ❌ Slow — multiple generations per translation |
| ✅ Model-agnostic | ❌ Diminishing returns after a few generations |

## Combines Well With

- **[Chained Models](./chained-models)** — the mutation step is a form of chaining
- **[FST-Gated Pipeline](./fst-gated-pipeline)** — FST acceptance as a fitness signal
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — dictionary presence as a fitness signal

## See Also

- [Run Card Specification](/docs/network/specifications/run-card) — cost and latency are recorded per entry
- [Eval Harness](/docs/network/specifications/harness) — the harness scores your final output, not your process
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages)
