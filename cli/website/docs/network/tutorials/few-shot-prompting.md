---
sidebar_position: 3
title: "Cookbook: Few-Shot Prompting"
---

# Few-Shot Prompting

> **The idea:** Include verified, high-quality translation pairs as in-context examples so the LLM learns the target language's patterns, style, and conventions from demonstration rather than instruction.

:::info[This is a cookbook, not a finished implementation]
This guide sketches the approach and its key design decisions. Adapt it to your language pair and available resources.
:::

## When to Use This

- You have a **small set of verified translations** (even 5–10 gold pairs help)
- You want the LLM to match a **specific style or register** by example rather than rule
- Your target language has patterns that are **easier to show than describe** (word order, affixation patterns, formality markers)

## How It Works

1. **Curate example pairs** — select high-quality source→target translations that demonstrate key patterns
2. **Format as in-context examples** — include them in the system or user prompt before the actual translation request
3. **Run the harness** — measure whether examples improve metrics over zero-shot
4. **Iterate on example selection** — swap examples to cover different failure modes

## Example Prompt Structure

```
You are translating English to Plains Cree (SRO orthography).

Examples of correct translations:
- "Hello" → "tânisi"
- "Thank you" → "kinanâskomitin"  
- "I am going home" → "nikîwân"
- "The children are playing" → "awâsisak mêtawêwak"

Now translate the following:
- "Welcome to the school"
```

## Critical Rule: No Eval Data Contamination

:::danger[DO NOT use evaluation data as few-shot examples]
If your examples come from the evaluation dataset, your method will be **disqualified** from the leaderboard. Few-shot examples must come from independent sources — dictionaries, textbooks, community-verified pairs, or a separate development set. The harness fingerprints your exact prompt; contamination is detectable.
:::

## Key Design Decisions

**How many examples?** 3–8 is the sweet spot. Fewer gives the LLM too little signal; more eats context window for diminishing returns.

**Which examples?** Prioritize diversity over difficulty. Cover different sentence structures, word lengths, and grammatical features. Don't cluster examples around one pattern.

**Static vs. dynamic selection?** Static examples are simpler. Dynamic selection (choosing examples similar to the current input) can improve quality but adds complexity — consider [chained models](./chained-models) for the retrieval step.

## Pros and Cons

| | |
|---|---|
| ✅ Powerful for style matching | ❌ Small context window limits example count |
| ✅ No training required | ❌ Example selection is an art, not a science |
| ✅ Works with any LLM | ❌ Risk of eval data contamination (disqualification) |
| ✅ Easy to A/B test different example sets | ❌ Examples may not generalize to all input types |

## Combines Well With

- **[Coached LLM Prompting](./coached-llm-prompting)** — rules + examples together beat either alone
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — forced terms + style examples
- **[FST-Gated Pipeline](./fst-gated-pipeline)** — examples for style, FST for morphological correctness

## See Also

- [MT Evaluation Rules](/docs/network/leaderboard/rules) — what gets disqualified
- [Evaluation Datasets](/docs/network/leaderboard/datasets) — know what you CAN'T use as examples
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages)
