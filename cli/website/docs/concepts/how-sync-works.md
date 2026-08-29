---
sidebar_position: 2
title: How Sync Works
---

# How Sync Works

The `sync` command is champollion's core operation. Here's what happens when you run `npx champollion sync`.

## Pipeline Overview

```mermaid
flowchart TD
    A["Load config\n+ resolve pairs"] --> B["Scan source locale\n(flatten nested keys)"]
    B --> C["Load lock file\n(.champollion.lock)"]
    C --> D["Diff: find missing\nand stale keys"]
    D --> TM{"TM lookup"}
    TM -->|Hits| TC["Serve from cache"]
    TM -->|Misses| E{"Keys to translate?"}
    E -->|No| F["Done ✓"]
    E -->|Yes| G["Batch keys\n(default 80/batch)"]
    G --> H["Translate batch\n(method-specific)"]
    H --> I["Quality gate\n(validate each key)"]
    I --> TERM["Terminology check\n(coached pairs)"]
    TERM --> J{"All pass?"}
    J -->|Yes| K["Write to locale file"]
    J -->|Failures| L["Retry cascade:\nfull → half → individual"]
    L --> H
    TC --> I
    K --> TMS["Store new entries\nin TM"]
    TMS --> M["Update lock file\n(SHA-256 hashes)"]
    M --> N["Next pair"]
```

## Step by Step

### 1. Config Resolution

Champollion loads `champollion.config.json` (or auto-detects settings). It resolves:
- Source locale and target locales
- The pair graph (which source→target combinations to process)
- Per-pair method, model, and quality settings

Before scanning files, champollion prints a startup header:

```
champollion v0.1.0

[INFO] Detected format: json (auto)
[INFO] Detected framework: Hugo
```

- **Version banner**: Shows the installed version for debugging and issue reports.
- **Format detection**: Reports the file format and whether it was auto-detected `(auto)` or explicitly configured `(config)`. Supports `json`, `toml`, and `yaml`.
- **Framework detection**: When `contentDir` is set, identifies the framework (`Hugo`) to confirm content sync is active.

### 2. Source Scanning

The source locale file is loaded and flattened into a key→value map:

```json
// Input (nested)
{ "hero": { "title": "Welcome", "subtitle": "Build" } }

// Flattened
{ "hero.title": "Welcome", "hero.subtitle": "Build" }
```

### 3. Change Detection

Champollion reads `.champollion.lock`, which stores SHA-256 hashes of previously translated source values. For each key, it checks:

| Condition | Action |
|-----------|--------|
| Key missing from target | **Translate** |
| Source hash changed since last sync | **Re-translate** (stale) |
| Target value starts with `[EN]` | **Re-translate** (legacy fallback marker) |
| Source hash unchanged, key exists | **Skip** |

This is why champollion only translates what changed — it's not re-translating your entire file on every sync.

### 4. Batching

Keys are grouped into batches (default: 80 keys/batch for LLM, 128 for Google Translate). Batching reduces API round trips while keeping prompts manageable.

During translation, champollion displays an inline progress bar that updates after each batch completes:

```
[INFO] fr.json — 2,847 missing
     ████████████████░░░░░░░░░░░░░░░░ 1,440/2,847 keys
```

The bar renders using `\r` carriage return for in-place updates — no scrolling. Suppressed in `--quiet` and `--json` modes.

### 4b. Translation Memory

Before batching, champollion checks the Translation Memory cache (`.champollion/tm.json`). Keys whose source text + locale + method match a previous translation are served instantly from cache — no API call needed.

```
  [TM] 142 key(s) served from cache
  Translating 3 key(s) to French (llm)... [OK]
```

TM is the primary cost-saving mechanism. Re-running sync after a single key change only translates that one key, not the entire file. See [Translation Memory](/docs/concepts/translation-memory) for details.

To bypass the cache for a single run: `champollion sync --no-tm`

### 5. Translation

Each batch is sent to the configured translation method:

- **`llm`**: Structured prompt to OpenRouter with register and gender guidance instructions
- **`llm-coached`**: Same, but with grammar rules, dictionary, and style notes injected
- **`google-translate`**: Google Cloud Translation API v2 batch request
- **`api`**: HTTP POST to a remote endpoint

The system message (register, gender guidance, rules) is identical across batches for a given locale, enabling **prompt caching** — providers like Anthropic and Google cache repeated system messages, reducing token costs.

### 6. Quality Gate

Every translation is validated before it's written to disk. Five checks run:

| Check | What it catches | Example |
|-------|----------------|---------|
| **Empty/blank** | Model returned nothing | `""` |
| **Source echo** | Model returned the English input | `"Welcome"` for Japanese |
| **Hallucination loop** | Repeated trigrams | `"Qo' Qo' Qo' Qo'"` |
| **Length inflation** | Output is 4×+ longer than source | 10-char source → 50-char output |
| **Script compliance** | Wrong script for the locale | Latin text for Arabic locale |

Failures are logged with a `[GATE]` prefix. No silent fallbacks.

See [Quality Gate](/docs/concepts/quality-gate) for details.

### 6b. Terminology Verification

For coached pairs with a dictionary, champollion checks whether the LLM actually used the required terminology after translation. Violations are logged as `[TERM]` warnings:

```
[TERM] en→fr: 2 term violation(s)
  • "dashboard" → expected "tableau de bord" but got "panneau"
```

These are warnings, not blocking errors — the translation is still written.

### 7. Retry Cascade

On JSON parse failure or batch-level errors, champollion retries with progressively smaller batches:

```
Full batch (80 keys) → Failed
  └→ Half batch (40 keys) → 1 failure
      └→ Individual keys (1 each) → Isolates the problem key
```

The retry budget is capped by `maxRetries` (default: 3) to prevent runaway token spend.

### 8. Write & Lock

Passing translations are written to the target locale file, preserving the original nesting structure. The lock file is updated with new SHA-256 hashes.

### 9. Verification

After all pairs are processed, champollion re-reads the written locale files from disk and runs a verification pass (unless `--no-verify` is set). This catches the gap between sync reporting success and keys being wrong in fact:

- **Key parity** — all source keys present in each target
- **`[EN]` fallback markers** — legacy markers from prior runs
- **Empty translations** — blank values that slipped through
- **Script compliance** — non-Latin locales with ASCII-only translations
- **Placeholder preservation** — ICU placeholders match source
- **Encoding issues** — BOM markers, invisible characters

This is also available as a standalone `champollion verify` command for CI gates.

## Content Translation (Phase 2)

For Docusaurus and Hugo projects, `sync` runs a second phase after JSON key translation. This phase translates Markdown and MDX files (docs, blog posts, tutorials) using the same methods and quality gate.

### How it works

1. Champollion discovers all source content files (`.md`, `.mdx`) by walking the content/docs directory
2. For each file × locale pair, it checks a separate content lock file (`.champollion-content.lock`) for SHA-256 hash changes
3. Changed or missing files are collected into a flat work-item pool
4. The pool is processed with **parallel concurrency** (default: 12 simultaneous API calls)

```
Phase 2: content (79 translations to process, 341 skipped, concurrency: 48)

    [1/79] (1%)  docs/concepts/security.md → ja [RE-TRANSLATE] (~3328s left)
    [2/79] (3%)  docs/concepts/security.md → th [RE-TRANSLATE] (~1821s left)
    ...
    [79/79] (100%) blog/v3-2-quality.md → de [OK]

  [OK] Created 79 content file(s), 341 unchanged
```

### Parallelism

Both Phase 1 (JSON keys) and Phase 2 (content) now run in parallel:

- **Phase 1**: All locale translations fire concurrently (default: 50 simultaneous locales). Within each locale, API batches also run in parallel (4 concurrent batches). A 12-locale sync with 120 keys completes in ~1 minute instead of ~15 minutes.
- **Phase 2**: All file×locale combinations are translated as a flat pool (default: 12 simultaneous API calls). Different files and different locales translate simultaneously.

Control parallelism with `--json-concurrency`, `--content-concurrency`, or `--concurrency` (sets both):

```bash
# Faster JSON sync (more parallel locale translations)
npx champollion sync --json-concurrency 30

# Faster content sync (more parallel API calls)
npx champollion sync --content-concurrency 20

# Slower (gentler on rate limits)
npx champollion sync --concurrency 4
```

### Content protection

During translation, champollion shields non-translatable content:

- **Code blocks** (fenced and indented) are replaced with placeholders
- **Frontmatter** fields not in the `translatableFields` list are preserved as-is
- **Links**, image paths, and HTML tags are protected
- **Shortcodes** and interpolation variables (e.g., `{count}`, `{{.Params.title}}`) are shielded

After translation, all placeholders are restored and validated. If any are missing or corrupt, the translation is rejected and retried.

## Partial Success

One failed batch doesn't block the rest. If 9 out of 10 batches succeed, those 9 are written. The failed batch is logged, and you can re-run `sync` to retry.

## Dry Run

Preview what would change without writing any files:

```bash
npx champollion sync --dry-run
```

## Force Re-translate

Force specific keys to be re-translated even if unchanged:

```bash
npx champollion sync --force-keys "hero.title,nav.about"
```

## Cost Estimation

Before translating, champollion generates a **pre-sync cost report** showing estimated costs per pair. This runs automatically during every `sync` — you see it before any API calls are made.

```
╔══════════════════════════════════════════════════════════╗
║  Cost Estimate                                          ║
╠════════════╦═══════╦════════════╦════════════════════════╣
║ Pair       ║ Keys  ║ Est. Cost  ║ Method                 ║
╠════════════╬═══════╬════════════╬════════════════════════╣
║ en → fr    ║   142 ║ $0.07      ║ google-translate       ║
║ en → ja    ║    38 ║   —        ║ llm (model-dependent)  ║
║ en → crk   ║    38 ║   —        ║ llm-coached            ║
╚════════════╩═══════╩════════════╩════════════════════════╝
```

### What Gets Estimated

Each translation method provides its own cost estimate:

| Method | Cost Basis | Precision |
|--------|-----------|-----------|
| `google-translate` | Google's published rate ($20/million chars) | Accurate |
| `llm` | Varies by OpenRouter model | Model-dependent — check [OpenRouter pricing](https://openrouter.ai/models) |
| `llm-coached` | Same as `llm` plus coaching context tokens | Model-dependent |
| `api` | Server-determined | Unknown — cannot estimate without querying the endpoint |

When a method can't determine cost (LLM methods, remote APIs), champollion reports `—` rather than guessing. Use `--dry` to see cost estimates without actually translating.

---

## See Also

- [CLI Reference — sync](/docs/reference/cli#sync) — command flags and options
- [Translation Memory](/docs/concepts/translation-memory) — caching and cost savings
- [Quality Gate](/docs/concepts/quality-gate) — how translations are validated
- [Translation Methods](/docs/guides/translation-methods) — how each method works
- [Working with Professional Translators](/docs/guides/professional-translators) — XLIFF workflow
- [Configuration](/docs/getting-started/configuration) — config reference
- [CI/CD Guide](/docs/guides/ci-cd) — automating syncs in your pipeline

