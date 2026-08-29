---
sidebar_position: 10
title: "Cookbook: Partial Translation (Human + Machine)"
---

# Partial Translation (Human + Machine)

> **The idea:** Manually translate a representative sample, prove your machine method matches the human style on that sample, then auto-translate the remaining bulk. Combines human quality with machine scale — the human sets the standard, the machine follows it.

:::info[This is a cookbook, not a finished implementation]
This guide sketches the hybrid human-machine workflow. It's especially relevant for translation agencies, community language workers, and educational contexts.
:::

## When to Use This

- You have **access to fluent speakers** but their time is limited
- You need to translate a **large volume** but only a small portion needs to be perfect
- You want to **establish a quality baseline** with human translation, then scale with MT
- You're working in an **educational or community context** where human review of a subset is feasible

## How It Works

```
[Full corpus: 1,000 entries]
        │
        ├── [100 entries] ──→ Human translator ──→ Gold translations
        │                                              │
        │                                              ▼
        │                                    Train / prompt machine
        │                                    method to match style
        │                                              │
        └── [900 entries] ──→ Machine method ──→ Auto translations
                                                       │
                                                       ▼
                                              [Optional: human review
                                               of flagged entries]
```

1. **Select a representative sample** — cover different sentence types, lengths, and topics
2. **Human-translate the sample** — establish the gold standard for style, register, and terminology
3. **Configure your machine method** — use the human translations as coaching data, few-shot examples, or fine-tuning data
4. **Score the machine on the human sample** — does the machine match the human's style?
5. **Auto-translate the rest** — if machine quality is acceptable on the sample
6. **Optional human review** — flag low-confidence outputs for speaker review

## Quality Assurance: The Style Match Test

```bash
# Translate the human-translated sample with your machine method
mt-eval run \
  --corpus data/human-sample.json \
  --name coached-v3

# Compare: does the machine match the human translator's choices?
# Look at: chrF++ (similarity), FST acceptance (validity),
# and qualitative patterns (register, formality, terminology)
```

## Selecting the Sample

**Cover the distribution.** Your 100 entries should include:
- Short phrases (1–3 words) and full sentences
- Common vocabulary and domain-specific terms
- Simple structures and complex ones
- Multiple grammatical features (questions, imperatives, conditionals)

**Don't cherry-pick easy ones.** The sample must include entries your method is likely to struggle with — that's where human quality matters most.

## The Community Review Workflow

For Indigenous language communities, this approach respects speaker time:

1. **Speaker translates 50–100 entries** (2–4 hours of focused work)
2. **Machine translates the remaining 900** using speaker's work as coaching data
3. **Speaker reviews flagged entries** — only the ones the machine was least confident about (another 1–2 hours)
4. **Result:** 1,000 translations at near-human quality, with ~5 hours of speaker time instead of ~50

## Pros and Cons

| | |
|---|---|
| ✅ Combines human quality with machine scale | ❌ Requires initial human investment |
| ✅ Respects limited speaker availability | ❌ Machine may not capture all stylistic nuances |
| ✅ Natural quality assurance workflow | ❌ Sample selection affects overall quality |
| ✅ Great for community/educational contexts | ❌ Human review bottleneck for flagged entries |

## Combines Well With

- **[Coached LLM Prompting](./coached-llm-prompting)** — human translations inform the coaching data
- **[Few-Shot Prompting](./few-shot-prompting)** — human translations as in-context examples
- **[Corpus Creation](./corpus-creation)** — the human sample IS corpus creation

## See Also

- [For Language Communities](/docs/network/community/for-language-communities) — community engagement model
- [Data Sovereignty](/docs/network/sovereignty/data-sovereignty) — ownership of translation data
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages)
