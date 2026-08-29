---
sidebar_position: 3
title: Configuration
related:
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "What the method fields actually select"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Per-pair methods and registers at scale"
  - label: "Register"
    to: /glossary#term-register
    kind: glossary
    note: "The linguistic term behind the register field"
  - label: "Supported Languages"
    to: /docs/reference/supported-languages
    kind: reference
  - label: "CLI Reference"
    to: /docs/reference/cli
    kind: reference
---

# Configuration

Champollion works zero-config — it auto-detects locale files, format, and target languages from your project. For more control, create `champollion.config.json` in your project root, or run:

```bash
npx champollion init
```

## Full Config Reference

```json title="champollion.config.json"
{
  "version": 3,
  "inputLocale": "en",
  "localesDir": "./locales",
  "contentDir": null,
  "translatableFields": null,
  "format": "auto",
  "model": "google/gemini-3.5-flash",
  "temperature": 0.3,
  "defaultMethod": "llm",
  "batchSize": 80,
  "coachingFile": null,
  "promptContext": null,
  "jsonConcurrency": 200,
  "contentConcurrency": 48,
  "fallbackPrefix": "[EN] ",
  "apiKeyEnvVar": "OPENROUTER_API_KEY",
  "noTranslate": [],
  "noTranslateUrls": true,
  "baseUrl": "",
  "pairs": {},
  "languages": {},
  "lint": {
    "srcDir": null,
    "ignore": ["node_modules", ".next", "dist"],
    "minLength": 2
  },
  "seo": {
    "urlPattern": "/:locale/:path",
    "pages": null
  },
  "typegen": {
    "output": null,
    "autoGenerate": false
  }
}
```

:::note[typegen is not yet implemented]
The `typegen` config block is recognized and preserved by the config loader, but TypeScript type generation is not yet implemented. This is a placeholder for a planned feature. Setting these values has no effect.
:::


### Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `version` | `number` | `3` | Config schema version. Always `3`. |
| `inputLocale` | `string` | `"en"` | Source language code (BCP 47). |
| `localesDir` | `string` | `"./locales"` | Path to locale files. Champollion scans this directory. |
| `contentDir` | `string` | `null` | Hugo content directory. Enables Markdown body translation. |
| `translatableFields` | `string[]` | `null` | Override default translatable frontmatter fields for content translation. `null` uses built-in defaults (`title`, `description`, `summary`). |
| `format` | `string` | `"auto"` | File format: `json`, `toml`, `yaml`, or `auto` (detect from extension). |
| `model` | `string` | `"google/gemini-3.5-flash"` | Default model for LLM methods. Accepts full OpenRouter slugs (`provider/model`) or short aliases from `shared/model-aliases.json` (e.g., `gemini-flash`). Direct providers use bare names (e.g., `gpt-4o`). |
| `temperature` | `number` | `0.3` | LLM temperature (0.0–2.0). Lower = more deterministic. |
| `defaultMethod` | `string` | `"llm"` | Default translation method: `llm`, `llm-coached`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `openai`, `anthropic`, `gemini`, `api`. Overridden by `--method` CLI flag. |
| `batchSize` | `number` | `80` | Keys per translation batch. Higher = fewer API calls, but larger prompts. |
| `coachingFile` | `string` | `null` | Path to a free-text coaching prompt file (relative to project root). Contents are read at startup and injected into the system prompt as a `Coaching guidance:` block. |
| `promptContext` | `string` | `null` | Application context string injected into the system prompt (e.g., "E-commerce product descriptions"). Helps the model tailor translations to your domain. |
| `jsonConcurrency` | `number` | `200` | Max parallel locale translations for JSON key sync. Overridden by `--json-concurrency` CLI flag. |
| `contentConcurrency` | `number` | `48` | Max parallel API calls for content (Markdown/MDX) translation. Overridden by `--content-concurrency` CLI flag. |
| `fallbackPrefix` | `string` | `"[EN] "` | Marker prefix used by `audit` and `verify` to detect legacy untranslated values from prior runs. Champollion does not write this prefix — it only reads it for detection. |
| `apiKeyEnvVar` | `string` | `"OPENROUTER_API_KEY"` | Environment variable name for the API key. Override for custom env var names. |
| `minContentRetention` | `number` | `0.35` | Fraction of the source's letters/digits an output must retain before the [content-deletion check](/docs/concepts/quality-gate) consults its second signal. Also settable per pair and per language. |
| `noTranslate` | `string[]` | `[]` | Dot-path keys and glob patterns whose value is copied to every locale verbatim. See [No-Translate Keys](#no-translate). Also accepted as `skipKeys`. |
| `noTranslateUrls` | `boolean` | `true` | Treat source values that are nothing but a `scheme://` URL as no-translate. Set `false` to send URL-valued keys to the translation backend. |
| `baseUrl` | `string` | `""` | Base URL for SEO artifact generation (hreflang, sitemaps, JSON-LD). |
| `pairs` | `object` | `{}` | Per-pair method, model, and quality overrides. See [Pair Configuration](#pair-configuration). |
| `languages` | `object` | `{}` | Per-language overrides. See [Language Configuration](#language-configuration). |
| `lint.srcDir` | `string` | `null` | Source directory for lint scanning. `null` = auto-detect from framework. |
| `lint.ignore` | `string[]` | `["node_modules", ...]` | Glob patterns to exclude from lint. |
| `lint.minLength` | `number` | `2` | Minimum string length to flag as hardcoded. |
| `seo.urlPattern` | `string` | `"/:locale/:path"` | URL pattern template for hreflang tag generation. |
| `seo.pages` | `string[]` | `null` | Explicit page list for SEO. `null` = auto-detect from locale keys. |
| `typegen.output` | `string` | `null` | Output path for generated TypeScript types. `null` = disabled. |
| `typegen.autoGenerate` | `boolean` | `false` | Auto-regenerate types after each sync. |

## No-Translate Keys {#no-translate}

Some values have exactly one correct rendering in every language: a URL, a
repository path, a package name, a product identifier. A correct translation of
`https://example.org/paper` is `https://example.org/paper`.

Champollion's [quality gate](/docs/concepts/quality-gate) rejects
source-echo — a translation identical to its source — because that is normally
a model refusing to do the work. For these keys, that makes the correct answer
the rejected one, and there is no output the model can produce that passes.
Weaker models learn to defeat the gate by altering the value just enough (a
fabricated `#fragment`, a stray trailing slash, an invisible zero-width space),
which ships broken links. Stronger models return the value unchanged and fail
the gate, so `sync` exits non-zero on every run.

Declare those keys instead:

```json title="champollion.config.json"
{
  "noTranslate": ["**.url", "pages.software.*.repo", "meta.appId"]
}
```

A matching key is **copied from the source locale verbatim** — never sent to a
translation backend, never quality-gated, never counted as a failure, and never
billed. It is excluded from the pre-run cost estimate for the same reason.

### Pattern syntax

Patterns are dot-paths over the flattened key space, with two wildcards:

| Pattern | Matches | Does not match |
|---------|---------|----------------|
| `nav.brand` | `nav.brand` (exact path) | `nav.brandName` |
| `**.url` | `url`, `pages.a.b.url` (a `url` leaf at any depth) | `pages.urlLabel`, `pages.url.caption` |
| `pages.software.*.repo` | `pages.software.portal.repo` | `pages.software.a.b.repo` |
| `meta.og*` | `meta.ogImage`, `meta.ogTitle` | `meta.twitterImage`, `meta.og.image` |

`*` matches within a single segment; `**` matches zero or more whole segments.
A pattern with no wildcard is an exact key path.

### URLs are handled by default

Because a URL-valued key has no correct outcome under the gate,
`noTranslateUrls` is `true` out of the box: any source value that is nothing but
an absolute `scheme://` URL is treated as no-translate without configuration.

Detection is deliberately narrow — the whole trimmed value must be the URL.
Prose that merely contains a link (`"Read the paper at https://…"`) is still
translated normally.

Turn it off with `"noTranslateUrls": false` if your URLs really are
locale-specific (per-language documentation hosts, for instance) — then declare
the ones that are not with `noTranslate`.

### Repair and enforcement

For a no-translate key there is exactly one correct target value, so any
difference is a defect. Champollion enforces that in both directions:

- **`sync` repairs it.** A no-translate key whose target is missing,
  `[EN] `-prefixed, or altered is rewritten from the source. That costs no API
  call, and it is idempotent: once the values match, later syncs skip the key
  entirely.
- **`verify` and `integrity` fail on it.** A drifted no-translate key is
  reported as `NO-TRANSLATE DRIFT` with the expected and actual values —
  invisible characters escaped as `\uXXXX`, since that class of corruption is
  otherwise impossible to see in a diff. `champollion integrity` exits `1`, so a
  build wired to it catches a corrupted URL before it ships.

If `integrity` fails this way on a project you have just configured, it is
reporting damage that was already in your locale files. Run `champollion sync`
once to repair it.

## Script Conversion {#script-conversion}

Some languages Champollion translates can be *written* in more than one way. The model always works in the language's **working script** (Latin romanization — SRO for Plains Cree, Okrand romanization for Klingon), and a deterministic converter can then rewrite the output into a display script. Whether it should is a decision the config makes — **never a default**:

| Locale | Working script | Convertible to | Kind |
|--------|---------------|----------------|------|
| `crk` (Plains Cree) | `Latn` (SRO) | `Cans` (Syllabics) | Real Unicode — **choice required** |
| `sr` / `srp` (Serbian) | `Latn` | `Cyrl` (Cyrillic) | Real Unicode — **choice required** |
| `tlh` (Klingon) | `Latn` (romanization) | `Piqd` (pIqaD) | PUA — opt-in |
| `x-elvish-s` (Sindarin) | `Latn` | `Teng` (Tengwar) | PUA — opt-in |
| `x-kryptonian` | `Latn` | Kryptonian | PUA — opt-in via `"script": "x-kryptonian"` |

**Real-Unicode pairs (crk, sr) require the choice.** Cree Syllabics and Cyrillic are ordinary Unicode — they render everywhere — and both orthographies are in real use. Champollion will not pick a community's writing system on a project's behalf: `init` asks when you select the language, and `sync` refuses to run until the config says which:

```json
{
  "languages": {
    "crk": { "script": "Cans" }
  }
}
```

**PUA scripts (tlh, x-elvish-s, x-kryptonian) default to romanization.** pIqaD, Tengwar and Kryptonian are *not in Unicode* — the converters emit Private Use Area codepoints that render as nothing unless you ship a font mapped to those codepoints. Romanization is the only output that renders everywhere, so it is the default. To emit the display script instead:

```json
{
  "languages": {
    "tlh": { "script": "Piqd" }
  }
}
```

…and run `champollion fonts install` so your site has a font that can draw it. If your fonts are keyed to Latin transliteration (many conlang fonts are), keep the default.

`script` takes an ISO 15924 code, any casing (`"cans"`, `"Cans"` and `"CANS"` are the same). It can also be set per pair, which wins over the language level. An invalid value, or a script the locale cannot produce, fails at startup — before any API call.

### Unmapped letters and `scriptFallback` {#script-fallback}

Converters translate what their orthography defines and nothing else. Klingon romanization has no `d`, `c`, `f`, `g`, `i`, `k`, `s`, `x` or `z` — so model output containing a proper noun like "GitHub" cannot fully convert. Champollion **never writes a half-converted value**: if any letter is unmappable, the whole value stays in the working script, and the warning names the letters plus the config line that would map them.

Those mappings are yours to declare:

```json
{
  "languages": {
    "tlh": {
      "script": "Piqd",
      "scriptFallback": { "d": "D", "f": "p", "z": "S" }
    }
  }
}
```

Each rule replaces a working-script sequence with one the converter *can* map, before conversion runs. Rules are validated at startup — a replacement that is itself unmappable is rejected.

Champollion ships **no fallback rules of its own**: inventing orthographic adaptations, especially for a real language's writing system, is not an index's call to make. Communities and fandoms have conventions — adopt them deliberately, per project.

### Repairing unwanted conversion {#repair-script}

Before 0.3.0, conversion was unconditional — projects targeting the PUA locales got unrenderable output whether they wanted it or not. Two tools close the loop:

- **`champollion repair-script`** scans locales whose config says conversion is *off* for PUA codepoints and restores the romanization using the converter's own reverse table (`--dry` to preview). pIqaD reverses exactly; Tengwar and Kryptonian reversals lose capitalisation and say so.
- **`champollion integrity`** fails (exit 1) on PUA found where conversion is off — so a build gate catches unrenderable text before it ships, and the report names the repair.

The Translation Memory never needs repair: it stores pre-conversion values, so switching `script:` on or off later requires no cache work.

Script conversion applies to UI strings (key-value files and Docusaurus JSON). Markdown bodies are never converted — a greedy character converter has no safe way through code spans, URLs and front matter.

## Pair Configuration {#pair-configuration}

Each source→target pair can be independently configured:

```json
{
  "pairs": {
    "en:fr": {
      "method": "google-translate",
      "qualityTier": "high"
    },
    "en:ja": {
      "method": "llm",
      "model": "google/gemini-2.5-pro"
    },
    "en:crk": {
      "methodPlugin": "crk-coached-v1"
    }
  }
}
```

### Pair Fields

| Field | Type | Description |
|-------|------|-------------|
| `method` | `string` | Translation method: `llm`, `llm-coached`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `openai`, `anthropic`, `gemini`, `api` |
| `methodPlugin` | `string` | Name of an installed plugin (from `.champollion/methods/`) |
| `model` | `string` | Override the default model for this pair |
| `temperature` | `number` | Override the default temperature for this pair |
| `batchSize` | `number` | Override the default batch size for this pair |
| `register` | `string` | Register/tone override (preset key or freeform text) |
| `endpoint` | `string` | Remote API endpoint URL. Required when `method` is `api`. |
| `coachingFile` | `string` | Path to a coaching prompt file for this pair |
| `promptContext` | `string` | Application context for this pair |
| `qualityTier` | `string` | Display tier: `standard`, `high`, `research`, `verified` |

## Language Configuration {#language-configuration}

Languages accept three formats:

### Array of codes (simplest)

```json
{
  "languages": ["fr", "de", "ja"]
}
```

Each language gets its default register from the built-in register table. Languages without a default get `"Professional register."`.

### Object with register strings

The value can be a **preset key** from the language's card, or custom register text:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "ja": "Custom: Polite Japanese for a gaming app."
  }
}
```

Champollion checks if the string matches a preset key in the language card. If it does, the full register prompt from the card is used. If not, the string is used as-is. See [Supported Languages](/docs/reference/supported-languages#language-cards) for available presets.

### Object with full config

```json
{
  "languages": {
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

You can mix shorthand and full objects in the same block.


### Language Fields

| Field | Type | Description |
|-------|------|-------------|
| `register` | `string` | Style/tone instructions. Can be a **preset key** (e.g., `casual-tu`, `formal-hapsyo`) or custom text. See [Language Cards](/docs/reference/supported-languages#language-cards). |
| `name` | `string` | Human-readable language name (for status display) |
| `model` | `string` | Override the default model |
| `temperature` | `number` | Override the default temperature |
| `batchSize` | `number` | Override the default batch size |
| `coachingFile` | `string` | Path to a coaching prompt file for this language |
| `promptContext` | `string` | Application context for this language |
| `maxRetries` | `number` | Maximum retry budget for failed batches (default: 3) |
| `script` | `string` | ISO 15924 code of the orthography Champollion writes (e.g. `"Cans"`, `"Piqd"`). See [Script Conversion](#script-conversion). |
| `scriptFallback` | `object` | Transliteration rules for letters the script converter cannot map. See [Script Conversion](#script-conversion). |

:::info[Inheritance chain]
Settings resolve in this order (first wins):

**pair-level** → **language-level** → **global config** → **defaults**

For example, if `pairs["en:fr"]` sets `model`, it overrides both the language-level and global `model` values.
:::

## Non-English Source

If your source language isn't English:

```bash
# CLI flag (one-time)
npx champollion sync --source fr
```

```json title="champollion.config.json (permanent)"
{
  "inputLocale": "fr"
}
```

## Lock File

Champollion creates `.champollion.lock` to track SHA-256 hashes of translated source values. **Commit this file** so all developers share the same translation baseline.

When a source value changes, the hash no longer matches, and champollion re-translates that key on the next sync.

## `.champollionignore`

Create `.champollionignore` in your project root to exclude files from `lint` scanning. Uses glob patterns, like `.gitignore`:

```text title=".champollionignore"
src/components/legacy/**
src/utils/constants.js
**/*.test.js
```

## `.champollion/` Directory

Champollion creates a `.champollion/` directory in your project root for internal state. You should generally **add this to `.gitignore`** — it's local optimization, not project source:

```gitignore
.champollion/
```

| File | Purpose | Commit? |
|------|---------|--------|
| `tm.json` | Translation Memory cache — stores previous translations keyed by source text + locale + method | No (local cache) |
| `xliff/*.xliff` | XLIFF export files for professional translator review | No (transient) |
| `methods/` | Installed method plugin manifests | Yes (shared config) |
| `backups/` | Pre-wrap backups (created by `wrap --undo`) | No (safety net) |

See [Translation Memory](/docs/concepts/translation-memory) for details on `tm.json` and how it saves API costs.

---

## Programmatic API

For build scripts and custom integrations, import directly from the package:

```javascript
import { GeminiMethod, runSync, resolveConfig } from 'champollion';

// Use a method class directly
const gemini = new GeminiMethod();
const result = await gemini.translate(
  ['greeting', 'farewell'],
  { greeting: 'Hello', farewell: 'Goodbye' },
  { target: 'fr', name: 'French', register: 'formal', model: 'gemini-2.5-flash' },
  { cwd: process.cwd() }
);
// result = { greeting: 'Bonjour', farewell: 'Au revoir' }
```

### Available Exports

| Export | What It Does |
|--------|-------------|
| `TranslationMethod` | Base class for all methods |
| `LLMMethod` | Base class for LLM methods (OpenRouter) |
| `DirectLLMMethod` | Base class for direct LLM providers (OpenAI, Anthropic, Gemini) |
| `OpenAIMethod`, `AnthropicMethod`, `GeminiMethod` | Direct LLM provider classes |
| `DeepLMethod`, `MicrosoftTranslatorMethod`, `LibreTranslateMethod`, `TildeMethod`, `TranslatedMethod` | Traditional MT classes |
| `GoogleTranslateMethod` | Google Cloud Translation |
| `LLMCoachedMethod` | Coached LLM (OpenRouter + coaching data) |
| `APIMethod` | Remote API client |
| `runSync`, `runContentSync` | Full sync pipeline |
| `resolveConfig`, `resolvePairs` | Config resolution |
| `validateTranslations` | Quality gate |
| `loadCoachingData`, `findDictionaryMatches` | Coaching utilities |

### Custom Provider Extension

Extend `DirectLLMMethod` to add a new LLM provider in ~40 lines:

```javascript
import { DirectLLMMethod } from 'champollion';

class MistralMethod extends DirectLLMMethod {
  constructor(options) {
    super(options);
    this.name = 'mistral';
  }
  _getApiKeyEnvVar()     { return 'MISTRAL_API_KEY'; }
  _getApiKeyOptionsKey() { return 'mistralApiKey'; }
  _getDefaultModel()     { return 'mistral-large-latest'; }
  _getProviderLabel()    { return 'Mistral'; }

  _buildApiRequest({ prompt, systemMessage, apiKey, model, temperature }) {
    return {
      url: 'https://api.mistral.ai/v1/chat/completions',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: {
        model,
        messages: [
          ...(systemMessage ? [{ role: 'system', content: systemMessage }] : []),
          { role: 'user', content: prompt },
        ],
        temperature,
      },
    };
  }

  _extractResponseText(json) {
    return json.choices?.[0]?.message?.content;
  }

  // Optional but recommended: provider-specific setup help when translation fails
  getSetupHelp() {
    if (!process.env.MISTRAL_API_KEY) {
      return [
        '',
        '  ┌─ Missing API Key ─────────────────────────────────────────────┐',
        '  │ Mistral requires an API key from https://console.mistral.ai   │',
        '  │ Run: export MISTRAL_API_KEY=...                               │',
        '  └────────────────────────────────────────────────────────────────┘',
      ];
    }
    return ['        API key is set but translation failed. Check your Mistral dashboard.'];
  }
}
```

You get translate, coaching, retry loops, model validation, quality tiers, and setup help for free. Only the HTTP request shape is provider-specific. For non-LLM adapters that use raw `fetch()`, use the shared `fetchWithRetry()` helper from `lib/methods/fetch-with-retry.js` instead of writing your own retry loop.

---

## See Also

- [CLI Reference](/docs/reference/cli) — all commands and flags
- [Translation Methods](/docs/guides/translation-methods) — choosing and mixing methods
- [Translation Memory](/docs/concepts/translation-memory) — caching and cost savings
- [Working with Professional Translators](/docs/guides/professional-translators) — XLIFF workflow
- [Plugin Specification](/docs/reference/plugin-spec) — method plugin manifest format
- [Architecture](/docs/concepts/architecture) — how the pieces connect
- [Supported Languages](/docs/reference/supported-languages) — built-in language support
- [How Sync Works](/docs/concepts/how-sync-works) — the translation pipeline

