---
sidebar_position: 5
title: Coaching Data
related:
  - label: "Build a Translation Plugin"
    to: /docs/tutorials/build-a-plugin
    kind: tutorial
    note: "Develop and ship coaching data end-to-end"
  - label: "Plugin Specification"
    to: /docs/reference/plugin-spec
    kind: reference
  - label: "Cookbook: Coached LLM Prompting"
    to: /docs/network/tutorials/coached-llm-prompting
    kind: arena
    note: "The eval-side cookbook for coached methods"
  - label: "Quality Gate"
    to: /docs/concepts/quality-gate
    kind: concept
---

# Coaching Data

Coaching data is champollion's mechanism for teaching LLMs about languages they weren't trained on. By providing grammar rules, dictionaries, and style notes alongside each translation request, you transform a general-purpose LLM into a context-aware translator for any language — including languages with zero existing MT support.

## How It Works

When you set a pair's method to `llm-coached`, champollion loads a coaching file from `.champollion/coaching/<locale>.json` and injects its contents into every LLM prompt as part of the system message. The LLM sees your linguistic rules alongside the translation request, producing output that follows your grammar and terminology instead of guessing.

```
┌──────────────────────────────────────────────────────┐
│ System Message (cached across batches)               │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Base translation rules                           │ │
│ │ + Register instructions                          │ │
│ │ + Coaching guidance (from coachingFile, if set)   │ │
│ │ + Grammar rules (from coaching data)             │ │
│ │ + Dictionary entries (from coaching data)         │ │
│ │ + Style notes (from coaching data)               │ │
│ └──────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────┤
│ User Message (per batch)                             │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Keys to translate (JSON)                         │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

There are two types of coaching content:

1. **Structured coaching data** (`llm-coached` method) — Grammar rules, dictionaries, and style notes in JSON format. Loaded from `.champollion/coaching/<locale>.json` or a plugin's `coaching/` directory.
2. **Free-text coaching prompt** (`coachingFile` config field) — A plain text file with additional guidance injected into the system prompt. Works with any LLM method, not just `llm-coached`. Set via `coachingFile` in your config or `--coaching-file` on the CLI.

Both can be used together. The eval harness uses the exact same prompt structure — so your benchmark scores reflect your actual production prompts.

Because the coaching data is part of the system message, it benefits from **prompt caching** — providers like Anthropic and Google cache repeated system prefixes, so you only pay for coaching context once per session, not once per batch.

## Coaching File Format

Create one JSON file per locale in `.champollion/coaching/`:

```json title=".champollion/coaching/crk.json"
{
  "grammar_rules": [
    "Plains Cree is polysynthetic — a single word can express what English needs a full sentence for",
    "Animate/inanimate noun distinction affects verb conjugation",
    "Use SRO (Standard Roman Orthography) unless script converter handles conversion",
    "Verb stems are modified by prefixes and suffixes to indicate person, number, tense, and evidentiality"
  ],
  "dictionary": {
    "home": "kīwēwin",
    "settings": "isi-nākatohkēwin",
    "search": "nānātawāpahtam",
    "welcome": "tānisi",
    "submit": "ispīhci",
    "cancel": "pōni"
  },
  "style_notes": "Use formal register. Preserve English technical terms in parentheses when no Cree equivalent exists. Avoid loanwords when a descriptive Cree expression exists."
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `grammar_rules` | `string[]` | No | Array of grammar rules injected into the system prompt. Each rule should be a concise, actionable instruction the LLM can follow. |
| `dictionary` | `object` | No | Key-value map of English term → target language term. Used for domain-specific vocabulary the LLM wouldn't know. |
| `style_notes` | `string` | No | Free-form style instructions (register, tone, formality conventions). |

All fields are optional — you can start with just a dictionary and add grammar rules as you refine.

## Fallback Behavior

If a pair is configured for `llm-coached` but no coaching file exists for that locale, champollion **falls back to the standard `llm` method** with a console warning:

```
[INFO] No coaching data for "crk" at .champollion/coaching/crk.json
       Falling back to standard LLM method. Create coaching data for better results.
```

This means you can safely set `"defaultMethod": "llm-coached"` globally — languages with coaching data will use it, and the rest will get standard LLM translation without errors.

## When to Use Coaching

| Scenario | Recommended Method |
|----------|-------------------|
| Tier 1 languages (French, Spanish, German) | `llm` or `google-translate` — LLMs already know these well |
| Tier 2 languages (Korean, Turkish, Thai) | `llm` with a register — LLMs handle these adequately with style guidance |
| Tier 3 languages (Plains Cree, Yoruba, Quechua) | `llm-coached` — LLMs need grammar rules and dictionaries |
| Conlangs (Klingon, Sindarin, Kryptonian) | `llm-coached` — LLMs have some training data but need corrections |

## Building Good Coaching Data

### Grammar Rules

Write rules as **instructions**, not descriptions. The LLM follows instructions better than it interprets linguistic theory.

```json
// ❌ Descriptive (the LLM learns nothing actionable)
"Plains Cree has animate and inanimate noun classes"

// ✅ Instructive (the LLM knows what to do)
"When translating nouns, check whether the Cree equivalent is animate (NA) or inanimate (NI) — this affects which verb conjugation to use"
```

### Dictionaries

Focus on **domain-specific terms** that the LLM would get wrong or invent. Don't bother with common words the LLM already handles — focus on the terms specific to your application's UI.

### Style Notes

Be specific about register, formality, and conventions:

```json
"style_notes": "Use formal register (vous-form in French). Preserve brand names untranslated. UI labels should be imperative mood ('Save', not 'Saves'). Maximum 40 characters for button text."
```

## Testing Coached Translations

Use the [MT Eval Harness](https://github.com/gamedaysuits/Champollion) to benchmark your coached translations against a reference corpus:

```bash
# Install the harness
pip install mt-eval-harness

# Run coached translations against your test corpus
mt-eval run --corpus data/crk-corpus.json --model google/gemini-2.5-pro

# Score the results
mt-eval test eval/logs/run_*.json
```

This gives you chrF++, BLEU, and exact match scores. Create multiple coaching file versions and compare — objective metrics beat subjective review.

---

## See Also

- [Translation Methods](/docs/guides/translation-methods) — the llm-coached method
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages) — coaching in practice
- [Plugin Specification](/docs/reference/plugin-spec) — packaging coaching data in a plugin
- [Quality Gate](/docs/concepts/quality-gate) — how coached translations are validated
- [Configuration](/docs/getting-started/configuration) — per-pair coaching config
