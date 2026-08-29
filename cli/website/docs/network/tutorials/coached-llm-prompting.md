---
sidebar_position: 2
title: "Cookbook: Coached LLM Prompting"
related:
  - label: "Cookbook: Few-Shot Prompting"
    to: /docs/network/tutorials/few-shot-prompting
    kind: cookbook
  - label: "Cookbook: Fine-Tuned Model"
    to: /docs/network/tutorials/fine-tuned-model
    kind: cookbook
  - label: "Coaching Data"
    to: https://champollion.dev/docs/concepts/coaching-data
    kind: champollion
    note: "How coaching data ships to production"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
---

# Coached LLM Prompting

> **The idea:** Inject grammar rules, bilingual dictionaries, and style notes directly into the LLM's system prompt. No training, no fine-tuning — just structured linguistic knowledge that steers output toward valid translations.

:::info[This is a cookbook, not a finished implementation]
This guide sketches the approach and its key design decisions. Adapt it to your language pair, available resources, and evaluation goals.
:::

## When to Use This

- You have **linguistic knowledge** about the target language (grammar rules, dictionary entries, style preferences) but not enough parallel data for fine-tuning
- You want to **iterate fast** — prompt changes deploy in seconds, no retraining
- The target language has **known patterns** an LLM gets wrong (gender agreement, script conventions, formality levels)
- You want to benchmark coached prompting against a baseline and iterate on what works

## How It Works

1. **Assemble coaching data** — grammar rules, a bilingual dictionary, and style notes in a structured JSON file
2. **Configure the register** — a system prompt prefix that sets the language, script, and tone
3. **Run the harness** — the coaching data gets injected into every LLM prompt
4. **Review failures** — look at what the quality gate rejects, add rules to address patterns
5. **Iterate** — each coaching file revision is a new experiment; the harness tracks them all

## Coaching Data Structure

```json title="coaching/<locale>.json"
{
  "grammar_rules": [
    "Adjectives agree in gender and number with the noun they modify",
    "Use formal register (vous) for all UI text",
    "Preserve interpolation variables exactly: {{name}}, {count}"
  ],
  "dictionary": {
    "dashboard": "tableau de bord",
    "settings": "paramètres",
    "deploy": "déployer"
  },
  "style_notes": "Prefer active voice. Avoid anglicisms where a native term exists. Keep sentences concise for UI readability."
}
```

## Key Design Decisions

**Rule specificity vs. context window:** More rules give the LLM more guidance, but eat into the context window available for actual translation. Start with 5–10 high-impact rules and add more only when you see specific failure patterns.

**Dictionary coverage:** You don't need a complete dictionary — focus on terms the LLM consistently gets wrong. Even 20–30 forced terms can dramatically improve consistency.

**Rule ordering matters:** Put the most important rules first. LLMs attend more strongly to early instructions.

## Running an Experiment

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-2.5-pro \
  --name coached-v1 \
  --coaching-file coaching/crk.json
```

## Pros and Cons

| | |
|---|---|
| ✅ Zero training cost | ❌ Quality ceiling limited by LLM's base knowledge |
| ✅ Instant iteration (change prompt → re-run) | ❌ Context window limits how much coaching fits |
| ✅ Works with any LLM provider | ❌ Rules can conflict — debugging prompt interactions is art |
| ✅ Transparent — you can read exactly what the LLM sees | ❌ Doesn't create new knowledge, only steers existing knowledge |

## Combines Well With

- **[FST-Gated Pipeline](./fst-gated-pipeline)** — coaching + morphological validation catches what coaching alone misses
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — forced terminology is a form of coaching
- **[Few-Shot Prompting](./few-shot-prompting)** — examples + rules together are more powerful than either alone

## See Also

- [Method Interface](/docs/network/specifications/methods) — coaching data format and the TranslationMethod protocol
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages) — the full context
- [Eval Harness](/docs/network/specifications/harness) — how to run experiments
