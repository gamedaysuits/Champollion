---
sidebar_position: 4
title: "Cookbook: Dictionary-Augmented LLM"
---

# Dictionary-Augmented LLM

> **The idea:** Force known, verified translations for specific terms from a bilingual dictionary, and let the LLM handle sentence structure and unknown vocabulary. The dictionary provides anchors of correctness; the LLM provides fluency.

:::info[This is a cookbook, not a finished implementation]
This guide sketches the approach. The specific dictionary matching and injection strategy will depend on your language pair and available lexical resources.
:::

## When to Use This

- A **bilingual dictionary exists** for your language pair (even a small one)
- The LLM consistently **hallucinates key terms** — inventing words that don't exist
- You need **terminological consistency** across translations (same word translated the same way everywhere)
- You're translating **domain-specific content** where standard LLM translations are wrong (legal, medical, educational)

## How It Works

1. **Load a bilingual dictionary** — key→value pairs mapping source terms to verified target translations
2. **Match source text against dictionary** — identify terms in the input that have known translations
3. **Inject matches into the prompt** — tell the LLM "these terms MUST be translated as follows"
4. **LLM generates translation** — with dictionary constraints as hard requirements
5. **Post-process** — verify dictionary terms appear in the output; retry if they don't

## Dictionary Format

```json title="dictionaries/crk-terms.json"
{
  "school": "kiskinwahamâtowikamik",
  "teacher": "okiskinwahamâkêw",
  "student": "kiskinwahamâkan",
  "book": "masinahikan",
  "home": "kīwēwin",
  "water": "nipiy"
}
```

## Prompt Structure

```
Translate the following English to Plains Cree (SRO).

REQUIRED TERMINOLOGY — use these exact translations:
- "school" → "kiskinwahamâtowikamik"
- "teacher" → "okiskinwahamâkêw"

Source: "The teacher went to the school"
```

## Key Design Decisions

**Matching strategy:** Exact match is simplest. Lemmatized matching ("teachers" matches "teacher") catches more but requires a source-language lemmatizer. Fuzzy matching risks false positives.

**Inflection handling:** In polysynthetic languages, the dictionary form may need inflection to fit the sentence. You can provide the root and let the LLM inflect, or provide multiple inflected forms. An [FST](./fst-gated-pipeline) can validate the result.

**Conflict resolution:** What if the LLM ignores a dictionary term? Options: (a) retry with stronger instruction, (b) post-process by string replacement, (c) accept and flag for review.

## Pros and Cons

| | |
|---|---|
| ✅ Eliminates hallucination for known terms | ❌ Dictionary coverage is always incomplete |
| ✅ Guarantees consistency for key vocabulary | ❌ Inflection/conjugation may not match sentence context |
| ✅ Easy to audit and update | ❌ Over-constraining can produce unnatural output |
| ✅ Dictionary is a reusable asset | ❌ Requires a dictionary to exist in the first place |

## Where to Find Dictionaries

- **[itwêwina](https://itwewina.altlab.app/)** — Plains Cree–English (FST-powered; the morphodict platform is open source — the dictionary content itself is not openly licensed)
- **[Wolvengrey, *nêhiyawêwin: itwêwina / Cree: Words*](https://uofrpress.ca/Books/C/Cree-Words)** — comprehensive Plains Cree reference (University of Regina Press)
- **[Apertium](https://www.apertium.org/)** — bilingual dictionaries for dozens of language pairs
- **[Giellatekno](https://giellalt.github.io/)** — dictionaries for Sámi, Uralic, and other minority languages
- Community-created glossaries, educational materials, term lists

## Combines Well With

- **[Coached LLM Prompting](./coached-llm-prompting)** — dictionary entries are a form of coaching data
- **[FST-Gated Pipeline](./fst-gated-pipeline)** — FST validates that dictionary terms are correctly inflected
- **[Rule-Based + LLM Hybrid](./rule-based-hybrid)** — deterministic dictionary lookup as one rule layer

## See Also

- [Support a Low-Resource Language](/docs/network/community/low-resource-languages) — the full context
- [Method Interface](/docs/network/specifications/methods) — how methods are structured
