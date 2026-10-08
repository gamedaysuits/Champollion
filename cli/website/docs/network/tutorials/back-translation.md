---
sidebar_position: 8
title: "Cookbook: Back-Translation Augmentation"
---

# Back-Translation Augmentation

> **The idea:** Generate synthetic parallel data by translating existing target-language text back into the source language, then use these synthetic pairs to train or prompt a forward model. This expands your parallel corpus cheaply — but with caveats about quality.

:::info[This is a cookbook, not a finished implementation]
This guide sketches the strategy and its critical pitfalls. Back-translation is powerful but can amplify errors if not done carefully.
:::

## When to Use This

- You have **monolingual target-language text** but limited parallel data
- You want to **expand a training corpus** for [fine-tuning](./fine-tuned-model) without manual translation
- You need **more few-shot examples** but can't get human translations fast enough
- You're willing to **quality-filter** the synthetic data aggressively

## How It Works

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

1. **Collect monolingual text** — target-language books, articles, transcripts, social media
2. **Back-translate** — use an LLM or MT API to translate each sentence to the source language
3. **Quality filter** — round-trip (translate back again) and compare; keep pairs where round-trip ≈ original
4. **Use the synthetic corpus** — for fine-tuning, few-shot examples, or coaching data

## Quality Filtering: The Round-Trip Test

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

## Critical Pitfall: Error Amplification

:::warning[Back-translation amplifies existing model biases]
If your back-translation model consistently makes the same errors, your synthetic corpus will encode those errors as "correct." This creates a feedback loop: train on bad data → produce worse translations → generate worse synthetic data. **Always quality-filter aggressively** and mix synthetic data with verified human translations.
:::

## Where to Find Monolingual Text

- Community newsletters, newspapers, and publications
- Government documents in the target language (e.g., Nunavut Hansard for Inuktitut)
- Educational materials and textbooks
- Religious texts (widely available for many languages)
- Social media (with appropriate permissions and quality filtering)
- Transcribed audio/video from language programs

## Pros and Cons

| | |
|---|---|
| ✅ Expands training data cheaply | ❌ Amplifies model errors if not filtered |
| ✅ Uses abundant monolingual text | ❌ Quality ceiling limited by back-translation model |
| ✅ Easy to generate at scale | ❌ Round-trip filtering is compute-intensive |
| ✅ Complements other approaches | ❌ Synthetic data is never as good as human translation |

## Combines Well With

- **[Fine-Tuned Model](./fine-tuned-model)** — back-translation creates training data for fine-tuning
- **[Corpus Creation](./corpus-creation)** — synthetic data supplements human-created corpora
- **[Coached LLM Prompting](./coached-llm-prompting)** — synthetic examples can inform coaching dictionaries

## See Also

- [Evaluation Datasets](/docs/network/leaderboard/datasets) — synthetic data must not overlap with eval data
- [Leaderboard Rules](/docs/network/leaderboard/rules) — contamination policy
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages)
