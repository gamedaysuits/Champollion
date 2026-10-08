---
sidebar_position: 7
title: "Cookbook: Rule-Based + LLM Hybrid"
---

# Rule-Based + LLM Hybrid

> **The idea:** Use deterministic linguistic rules for patterns you know are correct (morphological affixation, number formatting, known phrase structures), and let the LLM handle creative translation for everything else. Rules override the LLM where they apply; the LLM fills the gaps.

:::info[This is a cookbook, not a finished implementation]
This guide sketches the hybrid architecture. The specific rules depend entirely on your target language's grammar and available linguistic resources.
:::

## When to Use This

- You have **deep linguistic expertise** in the target language (or access to a linguist)
- Some translation patterns are **deterministic** — you know the correct output with certainty
- The LLM **consistently fails** on specific patterns (number formatting, honorifics, agglutination)
- You want to **guarantee correctness** for high-stakes patterns while maintaining fluency for the rest

## How It Works

```
Input ──→ [Rule Engine] ──→ [LLM] ──→ [Merge] ──→ Output
              │                │           │
              │ Known patterns │ Unknown    │ Rules override
              │ handled here   │ parts      │ LLM where both
              ▼                ▼            ▼ produced output
         Deterministic     Creative     Final translation
         fragments         translation
```

1. **Define rules** — regex patterns, FST lookups, lookup tables for known translations
2. **Pre-process** — identify and extract rule-matched segments from the source
3. **LLM translates** — the remaining text, with rule outputs as constraints
4. **Merge** — reassemble the translation, preferring rule output where available
5. **Validate** — optional FST/rule check on the merged result

## Example: Number and Date Rules

```python
import re

# Rule: Numbers stay as-is (don't let the LLM hallucinate number translations)
def rule_preserve_numbers(text):
    return re.sub(r'\b\d+\b', lambda m: f'__NUM_{m.group()}__', text)

# Rule: Known greetings have exact translations
GREETING_RULES = {
    "hello": "tânisi",
    "goodbye": "êkosi",
    "thank you": "kinanâskomitin",
}

# Rule: Date format conversion
def rule_date_format(text):
    # "January 15" → "kisê-pîsim 15" (deterministic month mapping)
    ...
```

## Key Design Decisions

**Rule priority:** When a rule and the LLM both produce output for the same segment, which wins? Rules should win for **correctness-critical** patterns. LLM should win for **fluency-critical** patterns.

**Granularity:** Word-level rules (dictionary lookup) vs. phrase-level rules (idiom mapping) vs. structural rules (sentence reordering). Start with word-level; add phrase-level as you identify patterns.

**Rule maintenance:** Every rule is a maintenance obligation. Prefer a small set of high-confidence rules over a large set of approximate ones. If you're not sure a rule is correct, leave it to the LLM.

## Pros and Cons

| | |
|---|---|
| ✅ Guaranteed correctness where rules apply | ❌ Requires deep linguistic expertise |
| ✅ Transparent — rules are readable and auditable | ❌ Rule/LLM seam can produce unnatural output |
| ✅ Rules are fast (no API cost) | ❌ Maintenance burden grows with rule count |
| ✅ Progressive — add rules as you learn | ❌ Hard to handle inflection at rule boundaries |

## Combines Well With

- **[FST-Gated Pipeline](./fst-gated-pipeline)** — FST as a specific kind of rule engine
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — dictionary lookup is a simple rule
- **[Coached LLM Prompting](./coached-llm-prompting)** — coaching handles soft preferences, rules handle hard requirements

## See Also

- [GiellaLT](https://giellalt.github.io/) — open-source FST infrastructure for 100+ languages
- [Apertium](https://www.apertium.org/) — rule-based MT platform with bilingual dictionaries
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages)
