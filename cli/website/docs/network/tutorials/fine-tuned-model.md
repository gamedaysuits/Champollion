---
sidebar_position: 5
title: "Cookbook: Fine-Tuned Model"
---

# Fine-Tuned Model

> **The idea:** Fine-tune an open-weight model (Llama, Mistral, Gemma) on parallel text for your target language pair. Potentially the highest quality ceiling, but requires parallel data that may be scarce — and the eval data contamination rules are strict.

:::info[This is a cookbook, not a finished implementation]
This guide outlines the approach, data requirements, and pitfalls. Actual training infrastructure is outside the harness scope.
:::

## When to Use This

- You have access to a **parallel corpus** (hundreds to thousands of sentence pairs) that is **completely independent** of the evaluation dataset
- You have **GPU access** for training (local hardware, cloud, or university compute cluster)
- You want the **highest quality ceiling** for a specific language pair and are willing to invest in training
- Other approaches (coached prompting, few-shot) have hit a quality plateau

## How It Works

1. **Assemble parallel data** — source-target sentence pairs from independent sources (textbooks, community archives, Hansard records, religious texts, educational materials)
2. **Prepare training format** — instruction-tuning format (system prompt + input + expected output)
3. **Fine-tune** — LoRA/QLoRA on a base model (4-bit quantization makes this feasible on consumer GPUs)
4. **Evaluate with the harness** — run the fine-tuned model through the eval harness
5. **Iterate** — adjust training data, hyperparameters, base model selection

## Data Requirements

| Corpus Size | What to Expect |
|-------------|----------------|
| 50–200 pairs | Marginal improvement over zero-shot; may overfit |
| 200–1,000 pairs | Noticeable style and terminology improvement |
| 1,000–5,000 pairs | Significant quality gains for the specific language pair |
| 5,000+ pairs | Approaching the quality ceiling for the base model |

:::danger[Eval data contamination = disqualification]
Your training data MUST NOT overlap with the evaluation dataset. Not the sentences, not the vocabulary list, not paraphrases of the same content. The harness fingerprints your outputs; statistical overlap is detectable. If you're unsure whether a data source is independent, err on the side of exclusion. See [Leaderboard Rules](/docs/network/leaderboard/rules).
:::

## Skeleton: LoRA Fine-Tuning

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

## Where to Find Parallel Data

- **Community archives** — educational materials, government documents, bilingual publications
- **Nunavut Hansard** — 1.3M aligned English-Inuktitut pairs (NRC Canada)
- **Bible translations** — available for many low-resource languages, but domain-specific
- **Educational textbooks** — often bilingual for language learning contexts
- **Create your own** — see [Corpus Creation Guide](./corpus-creation)

## Pros and Cons

| | |
|---|---|
| ✅ Highest quality ceiling | ❌ Requires parallel data (scarce for LRLs) |
| ✅ Model learns language-specific patterns | ❌ GPU costs (though LoRA helps) |
| ✅ Can outperform prompted approaches | ❌ Overfitting risk with small datasets |
| ✅ One-time training cost, then cheap inference | ❌ Strict eval contamination rules |

## Combines Well With

- **[Corpus Creation](./corpus-creation)** — build the training data you need
- **[Back-Translation](./back-translation)** — expand your parallel corpus synthetically
- **[FST-Gated Pipeline](./fst-gated-pipeline)** — fine-tuned model + morphological validation
- **[Coached LLM Prompting](./coached-llm-prompting)** — coaching on top of a fine-tuned base

## See Also

- [Evaluation Datasets](/docs/network/leaderboard/datasets) — know what you CAN'T train on
- [Leaderboard Rules](/docs/network/leaderboard/rules) — contamination policy
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages)
