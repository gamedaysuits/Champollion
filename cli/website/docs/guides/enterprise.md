---
sidebar_position: 7
title: For Enterprise
description: "How organizations can standardize translation with leaderboard-proven methods, custom plugins, and one-command deployment."
---

# champollion for Enterprise

Your team translates content regularly. You have a stack of locale files, a CI pipeline, and a process that probably involves someone manually running Google Translate, copying results into JSON, and hoping for the best. Or you're paying for a TMS platform where you're locked into one vendor's translation engine.

champollion gives you a calmer option: choose the right method for each language — machine or human — and run them all through one command.

## Why teams use champollion

1. **Choose the right method for each language** — machine or human, not whatever your vendor defaults to
2. **Deploy with one command** — `npx champollion sync` translates every locale, every format, every time
3. **Swap methods without changing code** — a config change, not a migration
4. **Own your pipeline** — no vendor lock-in, no monthly dashboards, no accounts

```json title="champollion.config.json"
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "deepl" },
    "en:ja": { "method": "llm", "model": "google/gemini-3.1-pro-preview" },
    "en:de": { "method": "google-translate" },
    "en:ko": { "method": "llm", "register": "polite-haeyo" },
    "en:es": { "method": "api", "endpoint": "https://review.your-lsp.example/mtpe" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

French gets DeepL (your team prefers its European fluency). Japanese gets a frontier LLM. German gets Google Translate (fast, cheap, good enough). Korean gets an LLM with a formal register. Spanish routes to a professional human / MTPE service via the `api` method — human translation is a first-class method here, not a bolt-on. Plains Cree gets the coached LLM method, with grammar notes and a dictionary you supply.

**Same command. Same CI pipeline. Different methods per pair — human or machine. One config file.**

:::note[Community-language methods are sovereign]
The Plains Cree pair above is not just another pair. Methods for Indigenous and other community languages are **community-owned and governed**: the community holds the keys to the data behind them, sets the terms of use, and any non-commercial (NC) corpus or method is carved out of commercial paths by default. If your use is commercial, check the method's license before you ship. See [Data Sovereignty](/docs/network/sovereignty/data-sovereignty).
:::

## The Leaderboard → Deploy Workflow

:::tip[`champollion network leaderboard` ships with the CLI]
The workflow below runs on the `champollion network leaderboard` command — browse the [Network](/arena) leaderboard from your terminal and install a method plugin straight from it. See the [CLI reference](/docs/reference/cli#leaderboard) for every option.
:::

The [Network](/arena) is where translation methods are benchmarked with reproducible, fingerprinted scoring. Runs are ranked the way the MT field ranks them: by corpus-level chrF++ with its 95% confidence interval. BLEU, TER and COMET are shown beside it, and diagnostics such as exact match and FST acceptance are reported separately, never blended into the headline. Whether one method is genuinely better than another is a paired significance test, not a gap between two numbers. The leaderboard tracks every submission.

The workflow:

```bash
# Browse the leaderboard from your terminal
npx champollion network leaderboard --pair "eng>fra"

# Output (abridged):
#   #   Model         chrF++ [95% CI]      BLEU   …   EM     FST
#   1   gemini-3.5    72.3 [70.8, 73.7]    48.1   …   0.31   —
#   2   deepl         70.9 [69.2, 72.4]    46.0   …   0.29   —
#   3   claude-4      68.4 [66.9, 70.0]    43.7   …   0.27   —
#   Headline: chrF++ with its 95% bootstrap CI; rows whose intervals overlap are not distinguishable.

# Install the method that fits as a plugin (by its rank)
npx champollion network leaderboard --install 1

# Use it
npx champollion sync
```

*Illustrative only — the leaderboard rows above are an example layout. In this example the first two rows' intervals overlap, so the board does not tell you one is better than the other. The board is currently open for submissions and has no published runs yet.*

**You don't build the method. You don't train the model. You pick the method that fits your domain, budget, and license — human or machine — and deploy it.** If a better-fitting method appears next month, you swap it with one command.

## What's Available Today

The leaderboard-to-CLI bridge is in development. Here's what works right now:

### Built-in methods (no plugins needed)

| Method | Best For | Cost |
|--------|----------|------|
| `llm` (default) | Quality-focused, any language | Per-token via OpenRouter |
| `gemini` | Quality + free tier | Free (limited), then per-token |
| `google-translate` | Speed + volume | $20/M characters |
| `deepl` | European languages | $25/M characters |
| `llm-coached` | Languages with coaching data | Per-token via OpenRouter |
| `api` | Custom/community-hosted methods | Self-hosted |

### Plugin methods (install separately)

Custom plugins can wrap any translation logic — a fine-tuned model, an FST-gated pipeline, a community API, or anything else that produces JSON. See [Build a Plugin](/docs/tutorials/build-a-plugin).

## Enterprise Workflow

### 1. Evaluate your current quality

```bash
# See what you're getting today
npx champollion status

# Output shows: method per pair, cache hit rate, quality gate stats
```

### 2. Run the eval harness on candidates

The [eval harness](/docs/network/specifications/harness) lets you benchmark multiple methods against the same dataset. Run a sweep, compare scores, pick winners:

```bash
# In the eval harness repo
python -m mt_eval_harness.run \
  --methods coached-v3 baseline prompt-tuned \
  --dataset data/your-corpus.json
```

### 3. Configure per-pair winners

Update your config to use the best method per language pair. Different languages have different best methods — that's the point.

### 4. Integrate into CI/CD

```bash
# In your CI pipeline — pinned to the 0.5 line, so a new release never
# changes what the pipeline runs (the CI guide has the complete workflow)
npx --yes champollion@0.5 lint        # Catch hardcoded strings
npx --yes champollion@0.5 sync        # Translate what changed
npx --yes champollion@0.5 audit       # Fail if any locale is incomplete
npx --yes champollion@0.5 integrity   # Validate placeholder consistency
```

Three commands. Zero manual translation. The pipeline catches hardcoded strings, translates them with your chosen methods, and fails the build if anything is missing or corrupted.

### 5. Professional review (optional)

For high-stakes content, export to XLIFF for human review:

```bash
npx champollion xliff export --locale ja --out translations.xliff
# → Send to your translation agency
# → Import corrections back:
npx champollion xliff import translations.xliff
```

Machine-translate the bulk. Human-review the critical paths. Pay for human time only where it matters.

## Cost Model

champollion has **no subscription and no per-seat pricing**. The CLI is source-available under PolyForm Noncommercial 1.0.0 — free for noncommercial use: research, education, charities, public hospitals and clinics, government, personal projects. Using it for a commercial purpose, such as a for-profit business's product, is not covered by that license. Check [who may use this](/docs/getting-started/who-may-use-this) before you adopt it. Beyond that, you pay only for the translation API calls:

| Volume | Google Translate | LLM (Gemini Flash) | LLM (GPT-4o) |
|--------|-----------------|---------------------|---------------|
| 1,000 keys × 5 locales | ~$0.50 | ~$0.30 (free tier) | ~$2.00 |
| 10,000 keys × 15 locales | ~$15 | ~$8 | ~$60 |
| 50,000 keys × 30 locales | ~$75 | ~$40 | ~$300 |

Translation Memory means you only pay for **changed keys** on subsequent syncs. If you update 10 strings out of 10,000, you pay for 10 translations, not 10,000.

## vs. TMS Platforms

| | champollion | Crowdin / Phrase / Locize |
|---|---|---|
| **Pricing** | Free for noncommercial use ([who may use this](/docs/getting-started/who-may-use-this)) + API costs | $50–$500/month + per-seat |
| **Vendor lock-in** | None — switch providers in config | High — data in their cloud |
| **Method choice** | Any provider, any model, per pair | Whatever they offer |
| **CI/CD** | First-class (`lint → sync → audit`) | Plugin/webhook |
| **Custom methods** | Plugin system, community plugins | Not supported |
| **Quality gate** | Built-in (wrong-script, echo, length) | Varies |
| **Self-hosted** | Yes (LibreTranslate, custom API) | No |

See the [full comparison](/docs/guides/comparison) for details.

## Further Reading

- **[Quick Start](/docs/getting-started/quick-start)** — run your first sync in 60 seconds
- **[Translation Methods](/docs/guides/translation-methods)** — the full method menu with decision tree
- **[CI/CD Integration](/docs/guides/ci-cd)** — automate in your pipeline
- **[Working with Professional Translators](/docs/guides/professional-translators)** — XLIFF export/import
- **[the Network](/arena)** — benchmark and leaderboard
- **[Configuration Reference](/docs/getting-started/configuration)** — every config option
