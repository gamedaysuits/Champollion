---
sidebar_position: 6
title: "Cookbook: Chained Models"
---

# Chained Models (Multi-Stage Pipeline)

> **The idea:** Model A generates a rough translation → Model B post-edits it → Model C scores or validates the result. Each stage specializes in one thing. The pipeline's output is better than any single model alone.

:::info[This is a cookbook, not a finished implementation]
This guide sketches multi-stage pipeline architecture. The specific models and chain configuration depend on your language pair and budget.
:::

## When to Use This

- A single model produces **inconsistent quality** — good on some inputs, bad on others
- You want to **separate generation from validation** — one model creates, another critiques
- You have budget for **multiple API calls per translation** (latency and cost scale linearly with stages)
- You want to combine models with **different strengths** (e.g., a creative generator + a precise editor)

## How It Works

```
Input ──→ [Stage 1: Generator] ──→ [Stage 2: Editor] ──→ [Stage 3: Validator] ──→ Output
              │                         │                        │
              │ "Translate this"        │ "Fix errors in         │ "Rate 1-5 and
              │                         │  this translation"     │  flag issues"
              ▼                         ▼                        ▼
         Raw translation          Polished translation      Score + accept/reject
```

## Example: Three-Stage Pipeline

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

## Common Chain Patterns

| Pattern | Stages | Use Case |
|---------|--------|----------|
| **Generate → Edit** | Fast LLM → Strong LLM | Cost-efficient quality improvement |
| **Generate → Validate → Retry** | LLM → FST/rules → LLM (retry on failure) | Morphological correctness (see [FST-Gated](./fst-gated-pipeline)) |
| **Generate → Back-translate → Score** | LLM(en→crk) → LLM(crk→en) → compare | Round-trip consistency check |
| **Ensemble → Vote** | 3 LLMs independently → majority vote | Robustness through diversity |

## Key Design Decisions

**Latency budget:** Each stage multiplies latency. A 3-stage chain with 2s per stage = 6s per translation. For batch evaluation this is fine; for real-time it may not be.

**Cost multiplier:** 3 stages = 3× the API cost. Use cheaper models for early stages, expensive models for critical stages.

**Error propagation:** A bad Stage 1 output can mislead Stage 2. Include the original source in every stage so later models can recover.

## Pros and Cons

| | |
|---|---|
| ✅ Can combine specialist strengths | ❌ Latency and cost multiply per stage |
| ✅ Separation of concerns (generate vs. validate) | ❌ Complex to debug — which stage introduced the error? |
| ✅ Easy to swap individual stages | ❌ Error propagation between stages |
| ✅ Round-trip validation catches hallucinations | ❌ Diminishing returns beyond 2-3 stages |

## Combines Well With

- **[FST-Gated Pipeline](./fst-gated-pipeline)** — FST as a validation stage
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — dictionary injection in the generation stage
- **[Coached LLM Prompting](./coached-llm-prompting)** — coaching in one or more stages

## See Also

- [Eval Harness](/docs/network/specifications/harness) — the harness measures end-to-end pipeline output
- [Run Card Specification](/docs/network/specifications/run-card) — latency and cost are recorded per entry
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages)
