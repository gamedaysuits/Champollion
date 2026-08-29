---
sidebar_position: 3
title: Quality Gate
related:
  - label: "Coaching Data"
    to: /docs/concepts/coaching-data
    kind: concept
  - label: "Script Converters"
    to: /docs/concepts/script-converters
    kind: concept
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: arena
    note: "How quality is scored on the public benchmark"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Audit quality across 30 locales"
---

# Quality Gate

Every translation passes through a deterministic validation gate before it's written to disk. The quality gate catches common machine translation failure modes — no silent fallbacks, no garbage written to your locale files.

## Validation Checks

| Check | What It Catches | Gate Label |
|-------|----------------|-----------|
| **Empty/blank** | Model returned empty string or whitespace | `[GATE] empty` |
| **Source echo** | Model returned the original English input | `[GATE] source-echo` |
| **Hallucination loop** | Repeated trigram patterns (e.g., `"Qo' Qo' Qo'"`) | `[GATE] hallucination` |
| **Length inflation** | Output is significantly longer than source | `[GATE] length` |
| **Content deletion** | Output is the source with its letters removed | `[GATE] content` |
| **Script compliance** | Wrong script for the target locale | `[GATE] script` |
| **ICU plural categories** | Missing required plural forms for the locale | `[GATE] icu-plural` |

Keys declared [`noTranslate`](/docs/getting-started/configuration#no-translate) never reach the gate — they are copied from the source verbatim, so there is nothing to validate.

### Empty/Blank

Rejects translations that are empty strings, whitespace-only, or `null`. This catches models that return nothing for difficult keys.

### Source Echo

Detects when the model returns the English source text instead of translating it. Common with short strings and under-specified prompts.

Short mostly-ASCII strings (≤ 30 characters) are exempt — `"Blog"`, `"GitHub"`, `"npm"` legitimately stay in English everywhere, and rejecting them would loop forever.

Longer values that are also correct unchanged — URLs, repository paths, product identifiers — are not a gate problem and cannot be fixed by tuning the gate: the correct answer *is* the echo, so every possible model output is wrong. Declare those keys with [`noTranslate`](/docs/getting-started/configuration#no-translate) and they bypass the pipeline entirely. URL-valued keys are handled that way by default.

### Hallucination Loop

Analyzes trigram (3-character) patterns in the output. If any trigram repeats more than a threshold number of times relative to the output length, the translation is rejected. This catches degenerate outputs like `"Qo' Qo' Qo' Qo' Qo'"`.

### Length Inflation

Rejects translations where the output length exceeds `maxLengthRatio × source length` (default: 4×). This catches model hallucinations that produce walls of text for a short input.

Configurable via `maxLengthRatio` in your config.

### Content Deletion

The mirror of length inflation. A model with no vocabulary for a string can delete every letter it cannot translate and leave the source's punctuation and spacing standing:

```
"low-resource nmt · tokenizers · nêhiyawêwin"  →  "   ·   · êhiêi"
"the simple-builder approach"                  →  "  "
```

Nothing else catches this. It is not empty, not an echo, not repetitive, and at 33% of the source *length* it clears `minLengthRatio` comfortably.

The check compares **content characters** — letters and digits, ignoring punctuation, whitespace and invisible formatting — between source and output. But density alone cannot be the rule, because legitimate dense scripts sit in exactly the same place:

| Source | Output | Content retained | Verdict |
|--------|--------|------------------|---------|
| `low-resource nmt · tokenizers · nêhiyawêwin` | `   ·   · êhiêi` | 14% | **rejected** |
| `Getting started` | `入门` | 14% | accepted |
| `Frequently asked questions` | `常见问题` | 17% | accepted |

Any threshold that catches the first rejects Chinese, Japanese and Korean outright. What separates them is not how much survived but *where it came from*: the hollowed output is a **subsequence** of its own source — producible by deleting characters from it — while a real translation shares essentially nothing with the source. A flag requires **both** signals, so the check is necessary-but-not-sufficient in the same way the repetition detector is.

Configurable via `minContentRetention` (default `0.35`), per pair or per language. Raising it makes the check more eager; it only ever fires alongside the subsequence signal.

:::note[This is a vocabulary signal, not a quality dial]
When this fires repeatedly for one target language, the model has no words for that text — usually short, jargon-dense strings in a language with a closed lexicon. Loosening the threshold restores the silent corruption; it does not produce a translation. Fix the prompt, the coaching data, or the pair.
:::

### Script Compliance

For locales whose language card records a non-Latin script (Arabic, CJK, Cyrillic, …), validates that the output actually contains non-ASCII characters — Latin-only output for those locales is rejected as wrong-script.

Two clarifications about what this check is *not*:

- It is **not driven by the `script:` config field.** That field selects the output orthography for [script conversion](/docs/getting-started/configuration#script-conversion); the gate's expectation comes from the language cards.
- It always validates the **working script the model emits**, *before* any script conversion. Locales with a script converter (crk, sr, tlh, …) correctly produce Latin working-script output, so they are exempt from this check; conversion — if the config opts in — happens after the gate.

## What Happens on Failure

1. The failing translation is logged to stderr with a `[GATE]` prefix, the key name, the reason, and a preview of the value
2. The key is **not** written to the locale file
3. The retry cascade kicks in (see below)

```
[GATE] hero.title: source-echo — "Welcome to our platform"
[GATE] nav.about: hallucination — "À À À À À À À À"
```

## Feedback Retry and the Retry Cascade

A key rejected by the gate gets **one feedback retry**: the rejection reason is injected into the prompt as per-key context (a blind retry at low temperature would return byte-identical output). If the retry passes, the key is written and the sync is **green** — a gate rejection that self-heals is not a failure, and this is the intended semantics. Only keys still failing after the retry are skipped, reported (the sync exits non-zero), and re-attempted on the next sync.

The retry runs through the pair's own translation method, whatever it is — LLM, Google Translate, DeepL, or a direct provider. It also applies to Translation Memory hits: a cached value the gate rejects is evicted and re-translated in the same run, so a poisoned cache heals itself.

Separately, when a whole batch fails (JSON parse error), champollion retries with progressively smaller batches:

```
Full batch (80 keys) → parse error
  └→ Half batch (40 keys) → 2 failures
      └→ Individual keys (1 each) → isolates the 2 problem keys
```

The retry budget is capped by `maxRetries` (default: 3, configurable per-language). This prevents runaway token spend on keys that consistently fail.

After exhausting retries, the problem keys are logged and skipped. They'll be retried on the next `sync` run.

## Prompt Caching

The system message (register, grammar rules, style notes) is split from the user message (the keys to translate). This split is intentional:

- The system message is **identical across batches** for a given locale
- Providers like Anthropic and Google cache repeated system messages
- Result: the first batch pays full token cost, subsequent batches pay only for the user message

This can significantly reduce token costs for projects with many batches.

## ICU MessageFormat Validation

The `integrity` command validates ICU MessageFormat plural patterns against CLDR plural rules. If your source file uses ICU syntax like:

```json
"items": "{count, plural, one {# item} other {# items}}"
```

Champollion verifies that translated versions include all required plural categories for the target locale. For example, Arabic requires six categories (`zero`, `one`, `two`, `few`, `many`, `other`) — not just `one` and `other`.

Run `champollion integrity` to check plural completeness across all locales.

## Terminology Enforcement

For coached pairs with a dictionary, champollion runs a post-translation terminology check. After the quality gate passes, it verifies whether the LLM actually used the required dictionary terms.

```
[TERM] en→fr: 2 term violation(s)
  • hero.title: "dashboard" → expected "tableau de bord" but got "panneau de contrôle"
```

Terminology violations are **warnings, not blocking errors**. The translation is still written to disk. This is intentional — the LLM may have valid reasons for choosing an alternative (context, grammar), and blocking on term mismatches would cause more harm than good.

To fix violations, update the coaching dictionary or manually edit the locale file.

---

## See Also

- [How Sync Works](/docs/concepts/how-sync-works) — where the quality gate fits in the pipeline
- [Translation Methods](/docs/guides/translation-methods) — methods that feed into the gate
- [Script Converters](/docs/concepts/script-converters) — post-gate script conversion
- [Coaching Data](/docs/concepts/coaching-data) — improving translation quality upstream
- [Translation Memory](/docs/concepts/translation-memory) — caching validated translations
- [CLI Reference — sync](/docs/reference/cli#sync) — sync flags including retry behavior
- [CLI Reference — integrity](/docs/reference/cli#integrity) — ICU plural auditing
