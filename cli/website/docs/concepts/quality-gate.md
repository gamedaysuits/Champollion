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
| **Source echo** | Model returned the original English input — as it was, or in disguise (accents, case, fullwidth letters), in the whole value or in one plural form | `[GATE] source-echo` |
| **ICU / placeholder structure** | A translated variable, plural keyword or selector, a lost `#` or `%s` | `[GATE] icu` |
| **Markup** | A tag opened, closed or nested differently from the source | `[GATE] markup` |
| **Sentence break beside a placeholder** | A sentence end the translation puts right before or after a placeholder where the source has none: `Take this medicine at {time}.` → `… sina. {time}.` | `sentence break beside a placeholder` |
| **Hallucination loop** | Repeated trigram patterns (e.g., `"Qo' Qo' Qo'"`) | `[GATE] hallucination` |
| **Length inflation** | Output is significantly longer than source | `[GATE] length` |
| **Content deletion** | Output is the source with its letters removed | `[GATE] content` |
| **Script compliance** | Wrong script for the target locale | `[GATE] script` |
| **Same output, different inputs** | One text returned for several different source strings (a memorized sentence) | `[GATE] shared-output` |
| **ICU plural categories** | Missing required plural forms for the locale | `[GATE] icu-plural` |

Keys declared [`noTranslate`](/docs/getting-started/configuration#no-translate) never reach the gate — they are copied from the source verbatim, so there is nothing to validate.

**Markdown pages get the same checks, block by block.** In a content folder (`contentDir`, Docusaurus docs), each heading, paragraph, list item and table cell is checked on its own, and so is each front-matter field. The checks are the ones above: empty, source echo, hallucination loop, length inflation, content deletion, script, and same output for different inputs. A short heading such as `## Feast` that comes back as a whole sentence is refused, just as the app key with the same text is.

A refused block is **asked for once more, with the reason**. The model is told what was wrong and that text which is correct as written may come back unchanged. Some refusals can't be decided by any fixed rule: a heading that is a name (`### BLEURT (Sellam et al., 2020)`), a reference-list entry, a table of codes or a gloss can be correct exactly as written, or can be a missed translation. If the block came back unchanged, or kept in Latin script in a non-Latin language, and the model gives the same answer again, that answer is accepted as deliberate. Every other refusal must pass the gate outright on the second answer. An endpoint that declares it follows no instructions (`"acceptsInstructions": false`) is not asked again; its first answer is judged as a second one.

What is still refused goes to the pair's `fallback` method. Without one, **the block keeps its source text, with no marker added to the page**, is never cached, and the page's lock entry reads `pending:<hash>`. `status` and `verify` list such pages. The sync's last lines are an `[ERR] Not finished` list of every part left in the source language (page, language, paragraph and reason) with the command that asks again, and the run exits `2`. What the model answered for each refused part is kept in `.champollion/refused.jsonl`, beside the source and the reason, so a refusal can be read instead of paid for again. The refusal is remembered: the next plain sync does not send that block to the same model again (see [Refused Markdown blocks and front-matter fields](#refused-markdown-blocks-and-front-matter-fields)). Code, links and markup in a block are protected separately, and an HTML comment is never sent. Some text is kept as written without being asked about:
- a short name (`## GitHub`), measured without its inline code, quotes, parentheses and `{#anchor}`;
- a reference-list entry, or a whole reference list in one block;
- fullwidth letters that the source itself shows.

A table is measured by its cells, not its pipes and delimiter row. `verify` checks the blocks already on disk the same way, except one that is exactly what sync accepted and cached for its source. A block that fails is a warning, which fails `verify --strict`, and it comes with the repair command `champollion sync --pair en:fr --redo files:<page>`. Sync prints the same command for the same file.

### Empty/Blank

Rejects translations that are empty strings, whitespace-only, or `null`. This catches models that return nothing for difficult keys.

### Source Echo

Detects when the model returns the English source text instead of translating it. Common with short strings and under-specified prompts. Two rules apply, and they measure different things:

1. **An exact copy** (byte for byte the source) is refused — except a **short, mostly-ASCII** value: 30 characters or fewer, more than 80% plain ASCII. `"Blog"`, `"GitHub"`, `"npm"` legitimately stay in English, so in a Latin-script target such a copy is accepted (`verify` lists it as a source echo); in a non-Latin target the model is asked once whether it is a name, and the same answer twice is accepted as one. **This exemption is about length, and only covers exact copies.**
2. **A disguised copy** — the source with only case, accents, spacing, invisible characters or compatibility forms (fullwidth letters, ligatures) changed — is refused when the source has **three or more words** carrying letters (placeholders such as `{count}` or `%s` and markup tags do not count), **however short it is**. `"Book an appointment"` (19 characters, 3 words) → `"Bóok án appóintment"` is refused; `"cafe"` → `"café"` (1 word) is accepted, because a real translation can differ from English only by its accents. A longer name that legitimately gains accents (`"Universite de Montreal"`) is accepted once you declare the accented spelling as a protected term.

Both rules apply **to each plural form** as well. A gettext `msgstr[n]` plural, an ICU `{n, plural, …}` branch or an i18next `_one`/`_other` key is held to the same rules as a singular value: a Russian plural whose `few` form came back as the English with accents is refused just as the singular would be.

Longer values that are also correct unchanged — URLs, repository paths, product identifiers — are not a gate problem and cannot be fixed by tuning the gate: the correct answer *is* the echo, so every possible model output is wrong. Declare those keys with [`noTranslate`](/docs/getting-started/configuration#no-translate) and they bypass the pipeline entirely. URL-valued keys are handled that way by default.

### Hallucination Loop

Analyzes trigram (3-character) patterns in the output. If any trigram repeats more than a threshold number of times relative to the output length, the translation is rejected. This catches degenerate outputs like `"Qo' Qo' Qo' Qo' Qo'"`.

### Length Inflation

Rejects translations where the output length exceeds `maxLengthRatio × source length` (default: 4×) — strictly more: a translation of exactly 4× passes. This catches model hallucinations that produce walls of text for a short input.

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

For locales whose language card records a non-Latin script (Arabic, CJK, Cyrillic, …), validates that the output is not Latin-only. Letters are classified by **Unicode script**, not by byte: accented Latin (`"Bóók"`) and fullwidth Latin (`"Ｂｏｏｋ"`) are Latin, so neither passes as Russian. Fullwidth Latin letters are refused in any target outside CJK typography (where `"ＯＫ"` is ordinary Japanese usage) — they are English in disguise. The usual allowances stand: a short name kept as written (the name-or-label question above), declared protected terms, and `noTranslate` keys (URLs among them) never fail it.

Two clarifications about what this check is *not*:

- It is **not driven by the `script:` config field.** That field selects the output orthography for [script conversion](/docs/getting-started/configuration#script-conversion); the gate's expectation comes from the language cards.
- It always validates the **working script the model emits**, *before* any script conversion. Locales with a script converter (crk, sr, tlh, …) correctly produce Latin working-script output, so they are exempt from this check; conversion — if the config opts in — happens after the gate.

### Markup

Tags are code. Per tag name, the translation must open, close and self-close the same number of tags as the source, nesting them the same way (`<b>` inside `<a>` stays inside `<a>`); sibling order may change with word order. `"Please <strong>book</strong> now"` → `"Veuillez <strong>réserver maintenant"` is refused — a lost closing tag breaks the page. In a plural message each form is compared with the source form it translates. `verify` runs the same check on the files.

### Sentence Break Beside a Placeholder

A placeholder is filled in at run time, so a sentence end the translation puts right next to it changes what the reader sees: `"Take this medicine at {time}."` → `"… sina. {time}."` shows the time as a sentence of its own. The gate refuses a translation that puts a sentence end (`.`, `!`, `?`, or another script's mark: `。`, `？`, `।`, `؟`, `።`, `᙮`, …) right **before** a placeholder, or right **after** one with more text following, when the source has no mark there and the translation has more sentence ends than the source. A placeholder that only moves to the end of the sentence (`"Shipped by {carrier} on {date}."` → `"Expédié le {date} par {carrier}."`) passes. So do an ellipsis, a decimal or a file name (`{host}.com`), and a one-letter abbreviation (`"M. {name}"`). A longer abbreviation in front of a placeholder (`"ca. {count}"`) cannot be told apart from a sentence end, so it is refused too, and the pair's fallback, or a reworded answer, takes it. `verify` flags the same values on disk, with the `--redo` command that asks again. ICU plural and select messages are left to the ICU check.

### Same Output, Different Inputs

A model that memorized a training sentence can return it for strings it does not know: one sentence for the app title, "Contact the school", a newsletter title and its heading, each passing every check above on its own. When one translation answers **three or more different source strings** within a locale's run — and it has four or more words, or the sources are each two or more words with little in common — those keys are refused (so the retry, then the fallback, takes them). **Two** different source strings are enough when the evidence is strong: both are two or more words, they share under half their words, and the shared translation has four or more words (`"Thank you for coming!"` and `"Please bring the forms."` answered with one sentence). A sentence caught this way is remembered for the locale: a later sync that gets it back, even for one string, refuses it, and the cache entries that already served it are removed, so a redo asks the model again instead of writing it from the cache. Synonyms collapsing to one short translation (`"OK"`/`"Okay"`/`"Sure"` → `"D'accord"`, `"Close"`/`"Dismiss"` → `"Fermer"`) pass, and so does one source text used under several keys. Markdown blocks and front-matter fields of the run's content files count too, and so does each branch of an ICU plural or select message (the branches of one plural count as one source — a language without number inflection writes the same text in each). Outputs are compared with case, punctuation and a Markdown block marker aside, so `"S?"`, `"S."` and a heading `# S` are one output. The count includes what the locale already holds on disk and what the cache would serve (a sentence cached one text at a time by another tool is refused at the cache, not written), so a key added one sync at a time is caught too. `verify` fails on the same pattern on disk, and the MCP `translate` tool refuses it within a call.

### A Question That Lost Its Mark

When the source ends with `?` or `!` and the translation ends with neither that nor the equivalent its script uses (`？`, `؟`, Greek `;`, `¿…?`, `！`, …), `sync` and `verify` warn: `"Where does it hurt?"` written as a statement reads as one. It is a warning, not a refusal, because some languages mark a question with a word or particle instead of a mark. The warning names the keys and the `--redo keys:<key> --fresh` command that asks again (`--fresh`, because the cache holds the answer).

## What Happens on Failure

1. The failing translation is logged to stderr with a `[GATE]` prefix, the key name, the reason, and a preview of the value
2. The key is **not** written to the locale file
3. The retry cascade kicks in (see below)
4. If it still fails, the refusal is **remembered** (see [Refused keys are held back](#refused-keys-are-held-back))

```
[GATE] hero.title: source-echo — "Welcome to our platform"
[GATE] nav.about: hallucination — "À À À À À À À À"
```

## Feedback Retry and the Retry Cascade

A key rejected by the gate gets **one feedback retry**: the rejection reason is injected into the prompt as per-key context (a blind retry at low temperature would return byte-identical output). If the retry passes, the key is written and the sync is **green** — a gate rejection that self-heals is not a failure, and this is the intended semantics. Keys still failing after the retry are skipped and reported (the sync exits `2`).

The retry runs through the pair's own translation method, whatever it is — LLM, Google Translate, DeepL, or a direct provider. Only LLM methods read the feedback; the run line says so (`retrying with feedback`, or `asking once more (deepl takes no instructions…)`). An `api` endpoint gets the feedback only when it declares `"acceptsInstructions": true` (on the pair or in its plugin manifest); one that declares `false` — a trained NMT model such as `nmt-forge serve`, which would answer the same — is not asked again at all: its answers are judged as a second answer would be, and what it refuses goes to the pair's fallback. The retry also applies to Translation Memory hits: a cached value the gate rejects is evicted and re-translated in the same run, so a poisoned cache heals itself.

### Refused keys are held back

A refusal is remembered in `.champollion.lock`, per key, for the key's **current source text** and the **method and model** that produced the refused answer. Docusaurus UI strings (`i18n/<locale>/code.json` and the plugins' JSON files) follow the same rule, per file and id. The next plain `sync` does not send that key to the same model again — it would bill the same answer — and says how many were held back and how to proceed:

- ask again: `champollion sync --redo keys:<key>` (or `--redo all`, or `--fresh`) — naming the key is an explicit retry;
- fill it another way: add a `"fallback"` method to the pair (it is asked for keys the pair's own method refused), list the key in `noTranslate` if it stays as written, or write the translation in the file by hand.

A held-back key is untranslated, so the sync exits `2` until it is filled. Changing the source text, the model or the method lifts the hold (the refusal was for that text from that model). The cache is still read for it — holding back stops paid calls, not free ones. A key a redo could not finish is the one exception, below.

### Refused Markdown blocks and front-matter fields

The same rule holds for content files (`contentDir`, Docusaurus docs). A block or front-matter field the gate refused is remembered in `.champollion-content.lock`, per page, block and locale, for the block's **current source text** and the **method and model** that produced the refused answer. A block is named by its source text, so editing the paragraph lifts the hold. The next plain `sync` does not send it to the same model again, and says how many blocks and fields were held back on which page:

- a held block keeps its source text on the page, with no marker, until it is filled; the rest of the page is written;
- a held front-matter field keeps its source text in the same way, and the rest of the page is written;
- a page translated whole (`contentSegmentation: "page"`) is refused whole when its answer damages a protected block or hollows the page. It is remembered by the text of its body, and held back whole: it is not written, and nothing of it is sent, until it is filled. Editing the body, or switching to block segmentation, lifts the hold.

A refusal made by an earlier version of the gate lifts by itself. When a check is loosened, what it refused is asked for again on the next sync, without a redo.

The precedence is the keys' precedence:

1. A page named for a redo is always sent: `champollion sync --redo files:<page>`, `--redo content` (every page), `--retranslate`, or anything under `--fresh`.
2. Otherwise a refused block or field is held back. If the pair has a `fallback` method that has not refused it, the fallback is asked for it and the pair's own method is not.
3. A change of model or method lifts the hold, as does a change to the block's source text.

The cache is still read first, so holding back stops paid calls, not free ones. A block filled another way drops its record: by a fallback, by the cache, or by a paragraph you write in the translation yourself (a content folder keeps a paragraph written by hand). A held block or field is untranslated, so the sync exits `2` until it is filled. The same is true of a block the gate refused during this run. A dry run lists what a real run would hold back.

### A redo that could not finish

When `--redo all`, `--redo keys:` or a model switch (`--redo all --fresh-on-model-change`) leaves keys of a key-value file untranslated, they are recorded as **pending** in `.champollion.lock`, and the next plain `sync` asks the model for them once more — from the model, not the cache (the point of the redo was the new model's text). `champollion status` lists them. If that retry is refused too, the key stays pending (status says so) and is held back like any refused key. In order of precedence: a key named by `--redo`/`--fresh` is always sent; a pending key gets that one retry; a refused key is held back. A Docusaurus UI string has no pending retry: refused under a redo, it is held back by the next plain sync, as a content block is.

Separately, when a whole batch fails (JSON parse error), champollion retries with progressively smaller batches:

```
Full batch (80 keys) → parse error
  └→ Half batch (40 keys) → 2 failures
      └→ Individual keys (1 each) → isolates the 2 problem keys
```

The retry budget is capped by `maxRetries` (default: 3, configurable per-language). This prevents runaway token spend on keys that consistently fail.

After exhausting retries, the problem keys are logged and skipped. A key that got no usable answer (missing from the response) is asked again by the next `sync`; a key the gate refused is held back, as above.

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

### Plural forms the translation did not supply

The prompt names the target language's CLDR categories. When a plural message comes back without one the language uses for ordinary counts (any count from 0 to 1000 — Russian `few` for 2, 3, 4 and `many` for 0, 5, 6), the gate asks the model once more, naming the missing forms and the counts they cover. A second answer without them is accepted, never asked a third time, and never completed by the tool — sync then:

- warns, naming each key and its missing forms, and the command that asks again (`sync --redo keys:… --fresh`, where a stronger `--model` helps);
- in a gettext catalog, where `msgfmt` needs every `msgstr[n]`, writes the missing forms as copies of `other` and marks the entry with a `# champollion:` translator comment (Poedit and Weblate show it; `verify` reads it, also in CI without the cache);
- in ICU files (next-intl, ARB) writes the message as it came; the app shows the `other` form for those counts.

Such a message is not treated as translated. A later sync that runs another method or model — one that has not answered it yet, such as CI's hosted model after a local one — asks for it again, from the model, not from the cache (which holds the incomplete answer); the estimate prices it. `sync --redo gaps` asks for every such message, whoever left it. If the new answer lacks the forms too, the message stays as it was (marked in a catalog), and `.champollion.lock` records which setups answered without them, so none of them is asked again for the same text ([CI guide](/docs/guides/ci-cd#plural-gaps)).

`verify` reports both cases with the repair command. Forms reached only above 1000 or by fractions (French and Spanish `many`, used for 1 000 000) get an info line, not a warning. A machine translation engine (DeepL, Google, …) cannot be told which forms to write, so its answer is not retried — only reported. For i18next files, each form the source does not have (French `count_many` from English) is its own key, translated from the `_other` text: an LLM is asked for that form, and sync says so; with a machine translation engine it says the value holds the `other` form.

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
