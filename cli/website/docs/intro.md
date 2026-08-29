---
sidebar_position: 1
slug: /intro
title: Introduction
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
    note: "Install, configure, and run your first sync"
  - label: "How It Works"
    to: /docs/how-it-works
    kind: doc
    note: "The pipeline behind every translation"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "LLM, Google Translate, coached, plugin — when to use which"
  - label: "The Language Atlas"
    to: /languages
    kind: atlas
    note: "Every language Champollion knows, on the map"
  - label: "Live Leaderboard"
    to: /leaderboard
    kind: leaderboard
    note: "Translation methods, benchmarked in the open"
---

# champollion

A fully customizable internationalization framework. One command translates your locale files. One config controls every method, model, and language pair. And if the built-in methods aren't enough — build your own, test that it works, and deploy it.

```bash
npx champollion sync
```

champollion auto-detects your locale files, format, and target languages. It translates what's missing, skips what's done, validates every result, and writes clean output. That's the starting line.

:::info[Part of something bigger]

This CLI is the deployment end of **Champollion** — infrastructure that
measures machine translation for languages nobody else measures, and
publishes what it finds. The measuring side builds evaluation test sets and
a public map of who can translate what, how well, on which kinds of text;
the CLI is where a proven method becomes something you can actually run.

One rule shapes everything: language data is treated like biodata, so the
people who provide a corpus hold the keys to it and to anything measured
against it. The full picture — what exists, what the rules are, where you
fit — is [What Champollion Is](/docs/what-is-champollion), and the
measuring side lives under [the Network](/docs/network/).

:::

---

## Why Not Just Script It Yourself?

You could write a quick loop that calls Google Translate on each key. Most developers do — it takes about 30 lines. Here's where it breaks:

- **No change detection.** Update an English string — the translation stays stale forever. champollion tracks every source value with SHA-256 hashes and re-translates only what changed.
- **No batching.** One API call per key means 200 keys = 200 round trips. champollion batches intelligently (configurable, default 80 keys/batch for LLM, 128 for Google).
- **No caching.** Every sync re-translates everything. champollion's Translation Memory caches translations by source text + locale + method — re-running sync after one key change only translates that one key, not the entire file.
- **No quality gate.** Machine translation hallucinates, echoes the source back, or outputs in the wrong script. champollion validates every translation before writing it — wrong-script, length inflation, and source echoes are caught and rejected.
- **No format awareness.** Hardcoded to JSON? champollion handles JSON, TOML, YAML, and Hugo Markdown (frontmatter + body) with auto-detection.
- **No method control.** Every pair gets the same method. champollion lets you use Google Translate for French, an LLM for Japanese, and a custom community-hosted pipeline for Cree — in the same config file.

champollion is the production version of that script.

---

## What Makes It Different

### Every method is a plugin

The translation method is **configurable per language pair**. Mix Google Translate, LLMs, coached prompts, and custom APIs in the same project:

```json title="champollion.config.json"
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "google-translate" },
    "en:ja": { "method": "llm", "model": "google/gemini-2.5-pro" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

French gets Google Translate (fast, cheap). Japanese gets a premium LLM (nuanced). Plains Cree gets a coached plugin with grammar rules, dictionaries, and morphological validation. Same `sync` command. Same quality gate. Same CLI.

### See what works

Think your method can translate English to Spanish? Turkish to Azerbaijani? English to Cree?

**Build it and test it.** The companion [eval harness](/docs/network/specifications/harness) benchmarks any translation method with reproducible, fingerprinted scoring. The [leaderboard](/leaderboard) records each published run, so everyone can see what works.

The eval harness and the production CLI share the same plugin interface. A method that scores well in the harness can be used in production — if the community whose language it serves gives consent. For Indigenous and low-resource languages, that consent matters. See [Data Sovereignty](/docs/network/sovereignty/data-sovereignty).

```bash
# Benchmark a method against a real, non-bundled eval corpus
# (GlobalVoices amh->fra, 945 sentences, fetched from source on first run)
pip install mt-eval-harness
export OPENROUTER_API_KEY=sk-or-...   # any OpenRouter-proxied model works
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 --model gemini-pro --yes

# Use it locally
npx champollion sync
```

Same plugin. Plug and test.

### The full toolkit

champollion isn't just `sync`. It's a complete i18n pipeline:

| Command | What It Does |
|---------|-------------|
| `sync` | Translate missing and stale keys (with post-sync verification) |
| `watch` | Auto-sync when your source file changes |
| `lint` | Scan source code for hardcoded strings |
| `wrap` | Auto-wrap hardcoded strings in `t()` calls |
| `audit` | List all `[EN]` fallback markers from prior runs |
| `verify` | Verify translations are present and correct (CI gate) |
| `integrity` | Detect placeholder corruption, encoding issues, and ICU plural completeness |
| `seo` | Generate hreflang tags, sitemaps, and JSON-LD schema |
| `status` | Show pair config, plugins, and benchmark scores |
| `provenance` | Audit translation resource licensing |
| `plugin` | Install, remove, and list method plugins |
| `fonts` | Download web fonts for PUA script converters |
| `tm` | Manage Translation Memory cache (stats, clear, per-locale) |
| `xliff` | Export/import XLIFF 1.2 for professional translator review |

Four of these — `lint`, `sync`, `verify`, `audit` — form a CI pipeline that catches hardcoded strings, translates them, verifies correctness, and fails the build if any locale is incomplete.

---

## The Network

The [Method Leaderboard](/leaderboard) is the scoreboard — live, public, and open for submissions. Every submission is fingerprinted to a Git commit, versioned to a specific dataset, and scored by the same harness. Anyone can submit.

**What can you build?** The harness takes JSON. Plugins take JSON. Any method that produces JSON can be tested:

| Approach | Example |
|----------|---------|
| **Coached LLM** | Inject grammar rules and dictionaries into a frontier model's prompt |
| **Fine-tuned model** | Train an open model on parallel text — just not on the eval data |
| **FST-gated pipeline** | LLM generates → finite-state transducer validates morphology → retry |
| **Chained models** | Model A drafts → Model B post-edits → Model C scores |
| **Dictionary + LLM** | Force known terms from a dictionary, let the LLM handle the rest |
| **Evolutionary** | Generate candidates, score them, mutate the best, repeat |
| **Partial translation** | Translate a sample by hand, prove your LLM matches, auto-translate the rest |

Fine-tune models. Deploy evolutionary algorithms. Test student answers on language exams. Build lookup tables. Chain three models together. As long as your method produces JSON, the harness scores it and the framework runs it.

:::danger[The one rule]
**Do not train on the evaluation data.** Methods exposed to the benchmark dataset will be disqualified. Fine-tune on whatever you want. Just not on the test set.
:::

This is an open invitation. If you work with a low-resource language — as a researcher, a community member, a student, or just someone who cares — build a method, run the harness, and strengthen the network for everyone. The problem is unsolved. The infrastructure is here, and it's open.

**[→ View the leaderboard](/leaderboard)**

---

## Next Steps

**Getting started:**
- [Installation](/docs/getting-started/installation) — Set up in 2 minutes
- [Quick Start](/docs/getting-started/quick-start) — Run your first sync
- [Supported Languages](/docs/reference/supported-languages) — What's available out of the box

**Customizing your setup:**
- [Translation Methods](/docs/guides/translation-methods) — Choose the right method per pair
- [Translation Memory](/docs/concepts/translation-memory) — How caching saves you money
- [Configuration](/docs/getting-started/configuration) — Full config reference
- [Hugo Multilingual Site](/docs/tutorials/hugo-multilingual-site) — Markdown content translation

**Going deeper:**
- [Working with Professional Translators](/docs/guides/professional-translators) — XLIFF export/import workflow
- [Data Sovereignty](/docs/network/sovereignty/data-sovereignty) — Indigenous data-sovereignty principles: community ownership and control of language data
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages) — The challenge that started it all
- [Cookbook: FST-Gated Pipeline](/docs/network/tutorials/fst-gated-pipeline) — Build a decomposition pipeline
- [MT Evaluation](/docs/network/leaderboard/rules) — How the harness and leaderboard work
- [Method Leaderboard](/leaderboard) — Live scores and submissions
