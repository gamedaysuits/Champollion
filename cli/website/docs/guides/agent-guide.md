---
sidebar_position: 9
title: 'Agent Guide: Using champollion'
description: 'How AI agents can install, configure, and run champollion to translate locale files.'
related:
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: arena
    note: "The eval-side guide for the same agents"
  - label: "Serving a Custom Method as an API"
    to: /docs/guides/serving-a-method
    kind: guide
  - label: "Build a Translation Plugin"
    to: /docs/tutorials/build-a-plugin
    kind: tutorial
  - label: "CLI Reference"
    to: /docs/reference/cli
    kind: reference
---

# Agent Guide: Using champollion

champollion is a CLI tool that translates your app's locale files with one command. This guide is for AI agents (or developers working with AI agents) who want to go from zero to translated locale files quickly.

:::tip[Already familiar?]
If you just need commands, jump to the [CLI Reference](/docs/reference/cli). If you want to build and benchmark a translation method, see the [Network Agent Guide](/docs/network/getting-started/agent-guide).
:::

---

## Environment Setup

```bash
# No global install needed — npx runs it directly
npx champollion sync
```

**Requirements:**
- Node.js 20.11+ (native ESM)
- An API key for your translation provider

**API key setup** — champollion needs at least one key depending on which methods you use:

```bash
# Option 1: export (session only)
export OPENROUTER_API_KEY="sk-or-..."        # for llm / llm-coached methods
export GOOGLE_TRANSLATE_API_KEY="AIza..."    # for google-translate method

# Option 2: .env file in your project root (persistent, gitignored)
echo 'OPENROUTER_API_KEY=sk-or-...' > .env
```

Champollion reads `.env.local` and `.env` automatically (priority: `process.env` → `.env.local` → `.env`). Get an OpenRouter key at [openrouter.ai/keys](https://openrouter.ai/keys).

---

## First Sync

Champollion auto-detects your locale files, their format (JSON, TOML, or YAML), and your target languages:

```bash
npx champollion sync
```

**What happens:**
1. Loads `champollion.config.json` (or auto-detects settings)
2. Scans your source locale file, flattens nested keys
3. Compares against `.champollion.lock` (SHA-256 hashes of previously translated values)
4. Checks `.champollion/tm.json` for cached translations (Translation Memory)
5. Translates only **changed, missing, or stale keys** via the configured method
6. Runs the quality gate (5 checks) on every translation
7. Writes passing translations to the target locale file
8. Updates the lock file and TM cache

On a typical re-run after changing one key, step 4 serves 142 keys from cache and step 5 translates 1 key. This is why subsequent syncs are fast and cheap.

---

## Configuration

Create `champollion.config.json` in your project root:

```json
{
  "inputLocale": "en",
  "pairs": {
    "en:fr": { "method": "llm-coached" },
    "en:ja": { "method": "google-translate" },
    "en:crk": { "method": "api", "endpoint": "http://localhost:3000/translate" }
  }
}
```

Pair keys use a **colon** (`en:fr`), not a hyphen — hyphens are reserved for regional locale codes like `es-MX`.

Key fields:

| Field | Purpose | Default |
|-------|---------|---------|
| `inputLocale` | Source language | `en` |
| `languages` | Target languages (array or object) | `[]` |
| `pairs` | Per-pair overrides (`"src:tgt"` keys) with method config | optional |
| `localesDir` | Where locale files live | `./locales` |
| `model` | LLM model for `llm`/`llm-coached` methods | `google/gemini-3.8-flash` |
| `batchSize` | Keys per API call | 80 (LLM); Google Translate caps at 128 segments/request |
| `jsonConcurrency` | Parallel locale translations for JSON keys | 50 |
| `contentConcurrency` | Parallel API calls for content translation | 48 (Docusaurus docs), 12 (`contentDir`) |

Full reference: [Configuration](/docs/getting-started/configuration)

---

## Translation Methods

| Method | When to use | Cost | API key needed |
|--------|------------|------|---------------|
| **`llm`** | General-purpose, good for well-resourced languages | Per-token (model-dependent) | `OPENROUTER_API_KEY` |
| **`llm-coached`** | When you have grammar rules/dictionary for the target language | Per-token + coaching context | `OPENROUTER_API_KEY` |
| **`google-translate`** | High-resource languages where GT works well | $20/million chars | `GOOGLE_TRANSLATE_API_KEY` |
| **`api`** | Custom pipeline hosted behind an HTTP endpoint | Server-determined | None (endpoint handles auth) |
| **`plugin`** | Pre-packaged method installed locally | Varies | Varies |

Details: [Translation Methods](/docs/guides/translation-methods)

---

## Coaching Data

For `llm-coached` pairs, coaching data steers the LLM with explicit linguistic knowledge. Create a coaching file:

```json title="coaching/fr.json"
{
  "grammar_rules": [
    "Use formal register (vous) for all UI text",
    "Adjectives agree in gender and number with the noun"
  ],
  "dictionary": {
    "dashboard": "tableau de bord",
    "settings": "paramètres"
  },
  "style_notes": "Prefer active voice. Avoid anglicisms."
}
```

Reference it in your pair config:

```json
"en:fr": { "method": "llm-coached", "coachingFile": "coaching/fr.json" }
```

The quality gate verifies that dictionary terms actually appear in the output — violations are logged as `[TERM]` warnings.

Details: [Coaching Data](/docs/concepts/coaching-data)

---

## Quality Gate

Every translation passes through five automated checks before it's written to disk:

| Check | What it catches | Example |
|-------|----------------|---------|
| **Empty/blank** | Model returned nothing | `""` |
| **Source echo** | Model returned the English input unchanged | `"Welcome"` for Japanese |
| **Hallucination loop** | Repeated trigrams | `"Qo' Qo' Qo' Qo'"` |
| **Length inflation** | Output is more than 4× the source length (exactly 4× passes) | 10-char source → 50-char output |
| **Script compliance** | Wrong script for the locale | Latin text for Arabic locale |

Failures are logged with `[GATE]` prefix. No silent fallbacks — if a translation fails, it's reported, not quietly accepted.

Details: [Quality Gate](/docs/concepts/quality-gate)

---

## Translation Memory

Champollion caches translations in `.champollion/tm.json`, keyed by source text + locale + method. On subsequent syncs, unchanged keys are served from cache — no API call, no cost.

```
[TM] 142 key(s) served from cache
Translating 3 key(s) to French (llm)... [OK]
```

To bypass the cache for one run: `npx champollion sync --no-tm`

Details: [Translation Memory](/docs/concepts/translation-memory)

---

## Generated Files

Champollion creates several files in your project. Know what they are so you don't accidentally delete or commit the wrong ones:

| File | Purpose | Git? |
|------|---------|------|
| `.champollion.lock` | SHA-256 hashes of translated source values (change detection), plus per locale: what sync wrote, keys a redo left pending, keys held back after a refusal | **Yes** — commit this |
| `.champollion-replaced-edits.jsonl` | Hand-edited translations a sync replaced, with their wording (written only when that happens) | **Yes** — commit this |
| `.champollion-content.lock` | Same, but for Markdown/MDX content files | **Yes** — commit this |
| `.champollion/` | Internal state directory (`tm.json` cache, XLIFF exports, backups) | **No** — gitignore it; `tm.json` is a local cache (see [Configuration](/docs/getting-started/configuration)) |
| Coaching files you author (e.g. `coaching/fr.json`) | Your linguistic knowledge | **Yes** — commit these |
| `champollion.config.json` | Project configuration | **Yes** — commit this |

---

## Common Patterns

**Translate all configured pairs:**
```bash
npx champollion sync
```
Champollion translates all locales in parallel. With TM caching, only changed keys hit the API (unchanged pairs are served from cache, so a full sync is cheap).

**Translate only specific pairs:**
```bash
npx champollion sync --pair en:fr          # one pair
npx champollion sync --pair en:fr,en:de    # comma-separated list
```
`--pair` restricts the run to the named pair(s); readiness checks and spend apply only to those pairs. Naming a pair that isn't in your configured pair graph fails loud with the list of configured pairs — never a silent no-op.

**How to write a pair.** A project pair is written the way `champollion.config.json` keys it, `en:fr`. `sync`, `verify` and `serve` also read `en>fr` and `en-fr`, and `en-pt-BR` is matched against the pairs you configured. The network commands (`network register-corpus`, `leaderboard`, `recommend`, `submit`) write a pair `eng>crk`, the form the leaderboard stores, and read `eng-crk` and `eng:crk` the same way. There, a pair with hyphens only must be two codes of two or three letters (`eng-crk`). A code with its own hyphen needs `>`: `--pair "eng>pt-BR"`. `eng-pt-BR` could also mean `eng-pt` and `BR`, so it is refused, never guessed. In a shell, quote the `>` form: `--pair "eng>crk"`. Unquoted, the shell sends the output to a file named `crk`.

**Content mode (a folder of Markdown/MDX: a Hugo `content/` or any folder; Docusaurus docs are found without it):**
```bash
npx champollion sync --content-dir ./content
```
Translates docs, blog posts, and content files alongside locale JSON. Each translation is written beside its source as `<name>.<locale>.md`; edits a reviewer makes to it are kept when the source changes elsewhere ([Content Translation](/docs/guides/content-translation#reviewing-and-editing-translations)). Content translation runs in parallel; tune with `--content-concurrency`.

**Dry run (preview without writing):**
```bash
npx champollion sync --dry-run
```

**Force re-translate specific keys:**
```bash
npx champollion sync --force-keys "hero.title,nav.about"
```

**Re-process all content files (cached text is reused, so unchanged text is free):**
```bash
npx champollion sync --force-content
```

**Translate specific content files fresh (billed), or limit a run to some files:**
```bash
npx champollion sync --retranslate docs/intro.md
npx champollion sync --files "docs/guides/**"
```

**Machine-readable run:** `--json` writes one JSON object per line (NDJSON), each with a `level`: on stdout `info` and `ok` messages, `event` records (`"event": "cost"` — the estimate, before the `--max-cost` gate — and one `"event": "file"` per content file and locale), and last the closing `{"level": "summary", "command": "sync", …}`; on stderr `warn` and `error` lines, also JSON. Select the summary by its level, never by line position alone: `npx champollion sync --dry --json 2>/dev/null | jq -c 'select(.level == "summary")'`. Exit code `2` means partial (some work done, something failed).

In the estimate (`cost` event, and `costEstimate` in the summary), `totalEstimatedCost` is `null` whenever any part has no known price — never a partial sum, never `0` for unknown; `knownEstimatedCost` holds the priced part, `unknownCost.reason` names the pairs without a price, and `unknownCost.notes` says what has none and why — `{ subject, pairs, note }`, such as a model name OpenRouter's list does not have (a likely typo, with the closest listed names), a listed model with no per-token price, or a price list that could not be read. A model on this machine (a `local` or `api` endpoint at `localhost`/`127.0.0.1`/`::1`) is priced `0` with `"local": true`. The summary's `sentToModel` counts keys sent to the method this run (`tmHits`: served from the cache). A dry run's summary carries `preflight: { ready, failures }` — `ready: false` means the real run would stop and exit `1` (a missing key, or a model server the run needs that does not answer), though the dry run itself exits `0` ([exit codes](/docs/reference/cli#sync-exit-codes)). With `--max-cost` it also carries `maxCost: { cap, estimatedCost, wouldStop }` — `wouldStop: true` (with `exitCode: 2` and the `reason`) means the real run would stop at the cap before any API call. `realRun: { exitCode, wouldStop, reasons }` is the exit code the real run would end with, as far as a preview can tell: the preflight and the cap, plus what would leave it partial — keys held back, plural messages on disk without a form the language uses that it would not ask for again (counted in the dry run's `totalPluralGaps`). A dry run verifies nothing (`verify: { "ran": false }`). Run the dry run with the real run's `--method`/`--model`: without them it checks the method the config names.

**Check translation status:**
```bash
npx champollion status
```
Shows each pair's method, model, coverage and plugin info (a `qualityTier` only when the config sets one — a label, not a measurement).

**Audit for untranslated fallbacks:**
```bash
npx champollion audit
```
Lists all `[EN]` fallback values that need translation.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `OPENROUTER_API_KEY not set` | Export the key or add it to `.env` in your project root |
| `No locale files found` | Set `localesDir` in config, or ensure your locale files match standard naming (`en.json`, `fr.json`) |
| `[GATE] Script compliance failed` | Your target locale got Latin text instead of the expected script — try a different model or add coaching data |
| `[GATE] Source echo` | The model returned English unchanged — coaching data or a different model usually fixes this |
| All translations cached | Run with `--no-tm` to bypass the cache, or `--force-keys` for specific keys |
| Lock file conflicts | `.champollion.lock` holds hashes — a merge conflict is safe to resolve by keeping either version, then re-running sync. Keeping the other side's per-locale record can make a few values read as hand-edited (a bulk redo then keeps them and names them; `--redo keys:` replaces one) — never the reverse |
| Keys "held back" | The quality gate refused that model's answer before; a plain sync does not re-send it (it would bill the same answer). `champollion sync --redo keys:<key>` asks again; or add a `fallback`, list it in `noTranslate`, or write it by hand |

---

## What's Next

- [Quick Start](/docs/getting-started/quick-start) — full getting-started walkthrough
- [CLI Reference](/docs/reference/cli) — every command and flag
- [How It Works](/docs/how-it-works) — the sync pipeline explained
- [The Eval Harness Bridge](/docs/guides/bridge) — how champollion connects to the Network
- **Want to build your own translation method?** See the [Network Agent Guide](/docs/network/getting-started/agent-guide) — build a method, prove it works on the public leaderboard, and compete for a prize if/when one is open (prizes are a planned mechanism — see [Honest Limitations](/docs/network/honest-limitations)).
