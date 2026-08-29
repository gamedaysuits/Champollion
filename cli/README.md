# Champollion

[![npm version](https://img.shields.io/npm/v/champollion.svg)](https://www.npmjs.com/package/champollion)
[![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/license-PolyForm--Noncommercial--1.0.0-blue.svg)](#license)

<!-- readme-i18n-banner-start -->
🌐 **README translations** — *translated by champollion, of course:*
[Français](docs/README.fr.md) · [Deutsch](docs/README.de.md) · [Español](docs/README.es.md) · [Português](docs/README.pt.md) · [Nederlands](docs/README.nl.md) · [日本語](docs/README.ja.md) · [한국어](docs/README.ko.md) · [简体中文](docs/README.zh.md) · [ไทย](docs/README.th.md) · [Tiếng Việt](docs/README.vi.md) · [Filipino](docs/README.fil.md) · [العربية](docs/README.ar.md)
<!-- readme-i18n-banner-end -->

Translate your locale files with one command:

```bash
npx champollion sync
```

Champollion auto-detects your locale files, their format, and the target languages. It translates missing keys, skips what's already done, and writes the results. That's it.

> **Part of Champollion** — infrastructure for trustworthy machine translation
> across every language, source-available and free for noncommercial use (the
> evaluation harness and shared registries are open source). This CLI is the
> deployment end of a larger
> project that builds the test sets and the map showing who can translate what,
> how good each method is on each kind of text, and where the gaps still are. It
> runs on two kinds of benchmark: public benchmarks on open data (broad, cheap,
> every method welcome) and sovereign benchmarks — secret test sets that
> communities create, own, and control, and that we never see. The infrastructure
> is source-available and singly stewarded; the test sets and the methods for a
> community's language belong to that community. Built with communities, never
> scraped from them — they hold the keys. Every method is welcome, human and
> machine. Explore the network at
> [champollion.dev/docs/network](https://champollion.dev/docs/network/).

## Why Not Just Script It Yourself?

You could write a quick script that loops through your English keys and calls Google Translate. Most developers do — it takes about 30 lines. Here's why it breaks:

- **No change detection.** When you update an English string, the translation stays stale forever. Champollion tracks every source value with SHA-256 hashes and re-translates only what changed.
- **No batching.** One API call per key means 200 keys = 200 round trips. Champollion batches intelligently (configurable, default 80 keys/batch for LLM, 128 for Google).
- **No quality gate.** Machine translation hallucinates, echoes the source back, or outputs in the wrong script. Champollion validates every translation before writing it — wrong-script, length inflation, and source echoes are caught and rejected.
- **No format awareness.** Hardcoded to JSON? Champollion handles JSON, TOML, YAML, and Hugo Markdown (frontmatter + body) with auto-detection.
- **No safety.** Champollion guards against prototype pollution, path traversal via crafted locale codes, and code block corruption during Markdown translation.

Champollion is the production version of that script.

> [!NOTE]
> **What Champollion translates.** Champollion targets **locale files and structured content** — JSON key-value pairs, TOML/YAML configuration, Hugo Markdown pages, XLIFF interchange documents. It is optimized for formal written text: UI strings, documentation, official communications, educational materials. It is not a chatbot, real-time speech translator, or general-purpose conversational AI. For each language pair, the translation method is configurable — from commercial APIs (Google Translate, DeepL) to community-developed plugins benchmarked through the [MT Eval Arena](https://champollion.dev/arena).

## Quick Start

```bash
npm install --save-dev champollion
```

### Get an API Key

Champollion needs a translation backend. Pick one:

| Provider | Key | Best for |
|----------|-----|----------|
| **OpenRouter** (recommended) | `OPENROUTER_API_KEY` | Content-heavy projects, Markdown, 200+ models |
| **OpenAI** | `OPENAI_API_KEY` | Direct GPT-4o access |
| **Anthropic** | `ANTHROPIC_API_KEY` | Direct Claude access |
| **Gemini** | `GEMINI_API_KEY` | Free tier available |
| **DeepL** | `DEEPL_API_KEY` | European languages, glossary support |
| **Google Translate** | `GOOGLE_TRANSLATE_API_KEY` | 130+ languages, high volume |

**Fastest start** (free): Sign up at [aistudio.google.com](https://aistudio.google.com/apikey) for a free Gemini key:

```bash
export GEMINI_API_KEY=AI...
npx champollion sync --method gemini
```

**OpenRouter** (200+ models): Sign up at [openrouter.ai](https://openrouter.ai), then:

```bash
export OPENROUTER_API_KEY=sk-or-v1-...
npx champollion sync
```

**Google Translate** alternative (key-value pairs only — no Markdown awareness):

```bash
export GOOGLE_TRANSLATE_API_KEY=...
npx champollion sync --method google-translate
```

> **Note**: If only `GOOGLE_TRANSLATE_API_KEY` is set, champollion auto-switches to Google Translate. No config change needed. Uses the REST API directly — no SDK, no service account, no `pip install`. Just the key.

That's it. For more control, create a config file:

```bash
npx champollion init                        # guided wizard — walks you through registers, methods, and content
npx champollion init --yes --langs fr,de,ja  # quick setup with specific languages and default registers
```

Each language comes with **register presets** — pre-built tone/formality instructions tuned to its linguistic system (vouvoiement for French, Siezen for German, です/ます for Japanese, 해요체 for Korean). The init wizard lets you browse and pick presets, or pass `--yes` to accept the defaults.

### Non-English Source

If your source language isn't English:

```bash
champollion sync --source fr                      # CLI flag
```

Or set it permanently in your config:

```json
{ "inputLocale": "fr" }
```

## What It Does

You handle the i18n framework (next-intl, i18next, Hugo). Champollion handles the translation files.

- **Multi-format** — JSON, TOML, YAML, Hugo Markdown (front matter + body), and XLIFF 1.2
- **Incremental** — Only translates what changed (SHA-256 hash tracking)
- **Cached** — Translation Memory stores previous results; re-running sync costs nothing for unchanged keys
- **Quality-gated** — Validates every translation: catches hallucinations, wrong-script output, source echoes, and length inflation
- **Content-aware** — LLM methods shield code blocks, shortcodes, links, and interpolation variables during Markdown translation
- **Pipeline tools** — `lint`, `audit`, `integrity`, `seo` for CI gates
- **XLIFF interop** — Export translations for professional review in CAT tools (memoQ, SDL Trados, Phrase), import them back
- **Minimal dependencies** — two runtime dependencies (better-sqlite3 for the bundled language database, CLDR locale names); no provider SDKs. Requires Node 20+

## Beyond Google Translate

The quick start gets you running with an LLM or Google Translate. But Google Translate supports ~130 languages. There are over 7,000.

**Champollion's core idea: the translation method is configurable per language pair.** Use Google Translate for French, an LLM with morphological coaching for Plains Cree, and a community-hosted API for Quechua — all in the same project, all with the same CLI.

```json
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "google-translate" },
    "en:ja": { "method": "llm" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

If you can figure out how to translate a language pair — through prompt engineering, community dictionaries, FST pipelines, or fine-tuned models — champollion lets you package that method as a plugin and deploy it alongside everything else.

> Born from translating a production website into Plains Cree, where no off-the-shelf API exists. The per-pair architecture isn't theoretical — it exists because one project needed Google Translate for French and a coached FST pipeline for an Indigenous language, running side by side in the same sync command.

The companion [MT Eval Harness](https://github.com/gamedaysuits/Champollion) lets you benchmark and compare translation approaches, then export working methods as champollion plugins. Anyone who speaks both languages can develop, test, and share a translation method — no proprietary platform required.

### Choose Your Method

Champollion supports 10 translation methods. Each language pair can use a different method.

**LLM providers** — best for quality, Markdown-aware, coaching-compatible:

| Method | Key | What It Does |
|--------|-----|-------------|
| `llm` (default) | `OPENROUTER_API_KEY` | LLM via OpenRouter — 200+ models, auto-routing |
| `llm-coached` | `OPENROUTER_API_KEY` | LLM + grammar rules, dictionaries, style notes |
| `openai` | `OPENAI_API_KEY` | Direct OpenAI API (gpt-4o, gpt-4o-mini) |
| `anthropic` | `ANTHROPIC_API_KEY` | Direct Anthropic API (Claude Sonnet, Haiku, Opus) |
| `gemini` | `GEMINI_API_KEY` | Direct Google Gemini API (Flash, Pro) — free tier available |

**Traditional MT** — best for speed, cost, and high-volume key-value pairs:

| Method | Key | What It Does |
|--------|-----|-------------|
| `google-translate` | `GOOGLE_TRANSLATE_API_KEY` | Google Cloud Translation API v2 (130+ languages) |
| `deepl` | `DEEPL_API_KEY` | DeepL API with glossary support (30+ languages) |
| `microsoft-translator` | `MICROSOFT_TRANSLATOR_API_KEY` | Azure Cognitive Services Translator (100+ languages) |
| `libretranslate` | *(self-hosted)* | Self-hosted LibreTranslate (AGPL, free) |

**Infrastructure** — for custom or community-hosted endpoints:

| Method | Key | What It Does |
|--------|-----|-------------|
| `api` | *(per provider)* | Thin HTTP client for any REST endpoint |

```bash
# Force a specific method for one run
champollion sync --method deepl

# Or configure per pair
```

```json
{
  "pairs": {
    "en:fr": { "method": "deepl" },
    "en:ja": { "method": "openai", "model": "gpt-4o" },
    "en:crk": { "methodPlugin": "crk-coached-v1" }
  }
}
```

> **Note**: Traditional MT methods (Google Translate, DeepL, Microsoft Translator, LibreTranslate) handle key-value pairs well but cannot safely translate Markdown content. For content-heavy projects, LLM methods are recommended — they explicitly shield code blocks, shortcodes, and interpolation variables.

## Plugins

Plugins are pre-packaged translation recipes for specific language pairs. They're JSON manifests — not code — that tell champollion which method to use, with what settings, and what quality has been benchmarked.

```bash
champollion plugin install ./french-formal-v1/    # install from directory
champollion plugin list                           # see installed plugins
champollion plugin remove french-formal-v1        # uninstall
champollion status                                # shows quality tiers + benchmarks
```

See [the reference docs](https://champollion.dev/docs/reference/plugin-spec) for the manifest format.

## Commands

| Command | Purpose |
|---------|---------|
| `init` | Interactive setup wizard (or `--yes` for quick defaults) |
| `sync` | Translate & sync all locale files |
| `serve` | Serve this project's translation stack over HTTP (api-method contract) |
| `watch` | Auto-sync on file changes |
| `audit` | Flag incomplete locales (CI gate) |
| `card` | Pretty-print a language card (`card <code>`, `--json` for raw) |
| `register-corpus` | Register an evaluation corpus: pick a license + exposure tier (local-only/private/public/sealed) |
| `seal-corpus` | Sealed-tier crypto verbs: `keygen` / `seal` / `open` (organizer-node bridge) |
| `submit` | Propose an index entry (review-gated) — prints a pre-filled GitHub issue |
| `lint` | Find hardcoded strings in source code |
| `status` | Show pair configuration, methods, registers, and quality tiers |
| `provenance` | Audit translation resource licensing |
| `wrap` | Auto-wrap hardcoded strings in `t()` calls (with undo) |
| `seo` | Generate hreflang, sitemap.xml, or JSON-LD schema |
| `integrity` | Check for placeholder corruption, encoding, and ICU plural completeness |
| `plugin` | Install, remove, or list method plugins |
| `fonts` | Download web fonts for PUA script converters |
| `tm` | Manage Translation Memory cache (stats, clear, seed, prune) |
| `xliff` | Export/import XLIFF 1.2 for professional translator review |
| `models` | List available models for a provider (`--method gemini`) |
| `verify` | Re-read written locale files and confirm translations are present and correct (CI gate) |
| `leaderboard` | Show the MT leaderboard (`--pair`, `--sort`, `--install N`) |
| `recommend` | Method guidance for a pair — availability + cited evidence (`--use`, `--json`) |
| `doctor` | System health check: cards, config, methods, and converters |

Run `champollion <command> --help` for detailed help on any command.

Full reference: [the reference docs](https://champollion.dev/docs/reference/cli)

### Pre-commit gate

`champollion lint` is built to be a commit gate: it exits `1` when it finds hardcoded user-facing strings and `0` when clean (`--warn-only` reports without blocking). Wire it into a tracked hooks directory in your project:

```bash
mkdir -p .githooks
printf '#!/bin/sh\nnpx champollion lint\n' > .githooks/pre-commit
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks   # once per clone
```

Or trigger it from [lint-staged](https://github.com/lint-staged/lint-staged) so it only runs when source files are staged:

```json
{
  "lint-staged": {
    "src/**/*.{js,jsx,ts,tsx}": "champollion lint"
  }
}
```

Keep `champollion sync` out of pre-commit — it makes network API calls, so it's slow at best and blocks commits offline at worst. Run it in CI or a pre-push hook instead, with `champollion audit` / `champollion verify` as the gate.

## Configuration

Create `champollion.config.json` or run `champollion init`:

```json
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "model": "google/gemini-3.5-flash",
  "pairs": {
    "en:fr": { "qualityTier": "high" },
    "en:ja": { "method": "google-translate" }
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `inputLocale` | `"en"` | Source language code |
| `localesDir` | `"./locales"` | Path to locale files |
| `contentDir` | `null` | Hugo content directory (enables Markdown translation) |
| `format` | `"auto"` | File format: `json`, `toml`, `yaml`, or `auto` |
| `model` | `"google/gemini-3.5-flash"` | Default model (OpenRouter slug). Direct providers resolve their own default at runtime. Run `champollion models --method gemini` to discover available models. |
| `defaultMethod` | `"llm"` | Default translation method (overridden by `--method` flag) |
| `batchSize` | `80` | Keys per translation batch |
| `pairs` | `{}` | Per-pair method, model, and quality overrides |

**Per-language overrides**: Each language has a [Language Card](https://champollion.dev/docs/reference/language-card-spec) — one of 50 curated cards containing register presets, formality systems, typography rules, and method support flags. Cards use a [two-tier architecture](https://champollion.dev/docs/concepts/architecture) (runtime + reference) for performance at scale. Scaffold a new card with `node scripts/generate-language-card.mjs <code>`. Use preset keys as shorthand, or write custom register text:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "crk": {
      "name": "Plains Cree",
      "register": "SRO syllabics with grammatical precision.",
      "model": "google/gemini-2.5-pro",
      "batchSize": 5,
      "maxRetries": 5,
      "script": "Cans"
    }
  }
}
```

**Zero-config mode**: No config file? Champollion auto-detects locale files, format, and target languages from your project.

Language values can be a preset key (e.g., `"casual-tu"`), custom register text, or an object (full control). Pair-level overrides in `pairs` take priority over language-level settings. Run `npx champollion init` to browse available presets for each language.

See the [CLI Reference](https://champollion.dev/docs/reference/cli) for framework-specific setup details.

## CLI Output

When you run `sync`, champollion shows exactly what's happening:

```
champollion v0.1.0

[INFO] Detected format: json (auto)
[INFO] Detected framework: Hugo
[INFO] Source: en.json (2,847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl, it:llm
[INFO] Estimated translation cost:

  Pair       Method   Keys  Est. Cost
  ────────   ──────   ────  ─────────
  en:es-MX   llm      2847    ~$0.8400
  en:fr      deepl    2847    ~$0.5694
  en:it      llm      2847    ~$0.8400

  Total: ~$2.2494

[INFO] es-MX.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 5,694 keys total.
```

The progress bar updates in-place as each batch completes (~80 keys per update). Framework detection shows `Hugo` when `contentDir` is set. Format detection distinguishes `(auto)` from `(config)` to clarify how the format was resolved.

**Output modes**: `--quiet` suppresses informational output (errors and warnings only). `--json` emits machine-readable NDJSON for CI/CD pipelines.

## Hardening

- **Exponential backoff** — 3 retries with jitter on 429/5xx errors
- **30s request timeout** — AbortController prevents hanging
- **Response validation** — only accepts keys that were sent for translation
- **Quality gate** — catches hallucination loops, wrong-script output, length inflation, and source echoes
- **Retry cascade** — on JSON parse failure, retries batch → half-batch → individual keys (budget-capped via `maxRetries`)
- **Translation Memory** — `.champollion/tm.json` caches translations keyed by source text + locale + method; unchanged keys are served from cache on subsequent syncs, eliminating redundant API calls
- **Prompt caching** — system/user message split enables provider-level caching, reducing token cost across batches
- **Terminology enforcement** — coached translations are verified against dictionary terms after the LLM responds
- **Prototype pollution guard** — blocks `__proto__`, `constructor`, `prototype`
- **Path containment** — file writes validated to stay within configured directories
- **Block protection** — code blocks, shortcodes, HTML shielded during content translation
- **Fail-loud architecture** — translation failures always throw with actionable error messages, never silently write garbage
- **Post-sync verification** — `verify` command re-reads written files and confirms translations are present, correct script, and placeholder-intact
- **Partial success** — one failed batch doesn't block the rest

## Testing

```bash
npm test      # all tests
npm run test:unit                # core sync pipeline
npm run test:redteam             # adversarial edge cases
npm run test:format              # TOML/YAML adapters
npm run test:content             # Markdown content parser
npm run test:hugo                # full Hugo E2E
npm run test:lint                # hardcoded string detection
npm run test:pairs               # pair graph resolution
npm run test:methods             # translation method suite
```

**Minimal dependencies** — see above.

## License

PolyForm Noncommercial 1.0.0. The Champollion CLI is source-available — free to install, use, and modify for noncommercial purposes (research, education, community work) under the [PolyForm Noncommercial License 1.0.0](LICENSE); commercial use requires the licensor's permission. The published `champollion` npm package is PolyForm-Noncommercial-1.0.0; `cli/LICENSE` is the authoritative license for the distributed package. The companion MT Eval Harness and specs are open source, licensed AGPL-3.0-or-later — with a §7 eval-standard-plugin exception — at the public [harness repository](https://github.com/gamedaysuits/Champollion).
