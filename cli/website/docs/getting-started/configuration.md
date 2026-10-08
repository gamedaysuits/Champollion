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
  "localesPattern": null,
  "localesLayout": null,
  "contentDir": null,
  "translatableFields": null,
  "format": "auto",
  "model": "google/gemini-3.8-flash",
  "temperature": 0.3,
  "defaultMethod": "llm",
  "batchSize": 80,
  "coachingFile": null,
  "promptContext": null,
  "genderGuidance": null,
  "protectedTerms": [],
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
| `localesDir` | `string` | `"./locales"` | Path to locale files. Holds one file per language (`fr.json`) or one folder per language (`fr/common.json`). See [Locale File Layouts](#locale-layouts). |
| `localesPattern` | `string` | `null` | Where every language's files live when neither shape fits, with `{lang}` and an optional `{ns}`: `"public/locales/{lang}/{ns}.json"`, `"src/strings/app_{lang}.json"`. Relative to the project root. Replaces `localesDir`. See [Locale File Layouts](#locale-layouts). |
| `localesLayout` | `string` | `null` | Overrides layout detection: `"flat"` (one file per language) or `"dir"` (one folder per language). Only needed when both `en.json` and `en/` exist. |
| `defaultNamespace` | `string` | `null` | In a folder-per-language project with several files, the file `champollion wrap` adds new keys to (e.g. `"common"`). |
| `contentDir` | `string` | `null` | A folder of Markdown/MDX to translate: a Hugo `content/` folder or any other folder, such as `./newsletters` in a Next.js app. Each translation is written beside its source as `<name>.<locale>.md`, for example `2026-10.md` → `2026-10.crk.md`. Files already named `<name>.<code>.md` are treated as translations, not sources. See [Content Translation](/docs/guides/content-translation). |
| `translatableFields` | `string[]` | `null` | Override default translatable frontmatter fields for content translation. `null` uses built-in defaults (`title`, `description`, `summary`). |
| `format` | `string` | `"auto"` | File format: `json`, `toml`, `yaml`, `po` ([gettext](#gettext)), `arb` ([Flutter](#arb)), or `auto` (detect from the source file's extension; `.yml` counts as YAML and targets keep `.yml`). Any other value stops with an error. |
| `model` | `string` | `"google/gemini-3.8-flash"` | Default model for LLM methods. An exact model slug: the full OpenRouter slug (`provider/model`). Short aliases (`gemini-flash`) and floating ids (`~vendor/…`, `…-latest`) are refused, naming the slug to write. Direct providers use bare names (e.g., `gpt-4o`); an OpenRouter slug of their own vendor is mapped to it (`openai/gpt-4o` → `gpt-4o`), and one they have no model for stops the run before anything is sent ([Model Names](/docs/guides/translation-methods#model-names)). |
| `temperature` | `number` | `0.3` | LLM temperature (0.0–2.0). Lower = more deterministic. |
| `defaultMethod` | `string` | `"llm"` | Default translation method: `llm`, `llm-coached`, `openai`, `anthropic`, `gemini`, `local`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `apertium`, `tilde`, `translated`, `api`. `local` is an OpenAI-compatible server on your machine (Ollama by default). Overridden by `--method` CLI flag. |
| `batchSize` | `number` | `80` | Keys per translation batch. Higher = fewer API calls, but larger prompts. |
| `coachingFile` | `string` | `null` | Path to a free-text coaching prompt file (relative to project root). Contents are read at startup and injected into the system prompt as a `Coaching guidance:` block. |
| `promptContext` | `string` | `null` | Application context string injected into the system prompt (e.g., "E-commerce product descriptions"). Helps the model tailor translations to your domain. |
| `genderGuidance` | `string` \| `false` | `null` | How LLM prompts handle grammatical gender. `null` keeps each language's default from Champollion's catalogue — for French, *écriture inclusive* with the interpunct (`Connecté·e`, `Utilisateur·rice·s`); for German, the colon form (`Benutzer:innen`). `false` sends no gender instruction; a string sends your own (e.g. `"Use the masculine generic."`). Also settable per language and per pair. See [Gender guidance](#gender-guidance). |
| `protectedTerms` | `string[]` | `[]` | Names to keep exactly as written in every language: people, companies, products (e.g. `["Curtis Forbes", "Game Day Suits"]`). The model is told to keep them, and a value made only of these names is never flagged as untranslated or wrong-script. This is different from `noTranslate`, which skips whole **keys**. |
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

## Locale File Layouts {#locale-layouts}

Champollion reads your locale files where your framework already keeps them. There are three shapes.

**One file per language** (`flat`). next-intl, vue-i18n, Hugo, most hand-rolled setups:

```text
messages/
  en.json      ← source
  fr.json
  de.json
```

```json title="champollion.config.json"
{ "localesDir": "./messages" }
```

**One folder per language** (`dir`). i18next and react-i18next, where each file is a *namespace*:

```text
public/locales/
  en/
    common.json      ← source namespaces
    admin/users.json
  fr/
    common.json
    admin/users.json
```

```json title="champollion.config.json"
{ "localesDir": "./public/locales" }
```

Champollion picks `dir` when `<localesDir>/<inputLocale>/` is a folder of locale files. Every source file is synced to the same path under each language's folder, and missing files and folders are created. A namespace can be a nested path (`admin/users`).

**Any other shape** (`localesPattern`). Name the path with `{lang}` and, if a language has several files, `{ns}`:

```json title="champollion.config.json"
{ "localesPattern": "src/translations/{ns}/{lang}.json" }
```

`{lang}` may repeat, as in `"{lang}/app_{lang}.json"`. `{ns}` may appear once and may span folders. The format comes from the extension unless `format` is set.

`champollion init` finds these layouts for you. It first checks for a Flutter app (`pubspec.yaml`, with `l10n.yaml` if present) and gettext catalogs (`locale/<lang>/LC_MESSAGES/`, `translations/`, GNU `po/`), and writes a `localesPattern` for those. Then it checks your framework's usual folder (`messages/` for next-intl, `public/locales/` then `locales/` for i18next, `src/locales/` for vue-i18n, `i18n/` for Hugo), then `locales`, `messages`, `i18n`, `lang`, `translations`, `public/locales`, `src/locales` and `src/i18n`. It only uses a folder that holds your source language's file, and prints what it found. `init --langs fr,de` also creates the empty target files in that layout.

:::note[How a multi-file language syncs]
Each file is compared, translated and written on its own. `.champollion.lock` records keys as `<namespace>::<key>` (`common::nav.home`), and so do `--force-keys`, `xliff` unit ids and `sync --dry --json`. A bare key in `--force-keys` matches that key in every file. One-file-per-language projects keep plain keys, so their lock file does not change.

The Translation Memory is keyed by source text, not by file. A string that appears in two namespaces is translated once per language. The second file gets it from the cache at no cost.
:::

If both `en.json` and a populated `en/` folder exist, Champollion stops and asks you to set `"localesLayout": "flat"` or `"dir"` rather than guess.

### i18next plural keys {#i18next-plurals}

i18next stores plurals as sibling keys with a CLDR suffix: `item_one`, `item_other`. Languages have different plural forms. French and Spanish also use `_many`, Arabic uses six forms, and Japanese only `_other`. When a JSON source file has these keys, each target gets exactly its own language's forms, read from CLDR through the JavaScript `Intl.PluralRules` API:

```json title="en.json"
{ "item_one": "{{count}} item", "item_other": "{{count}} items" }
```

After a sync, `fr.json` has `item_one`, `item_many` and `item_other`, and `ja.json` has only `item_other`. Sync says, for your own languages, which forms each one gains or drops.

New forms are translated from the source's `_other` text, `_one` from `_one`. A `_zero` in the source is kept in every language, because i18next looks it up for a count of 0 in all languages. If an earlier sync wrote a form the language does not use, such as `item_one` in Japanese, sync removes it only when the Translation Memory shows sync produced that value. A hand-written value is kept. A key for a form the language does not have that the source has no key for either (Spanish `item_two`) is never removed on its own: `verify` names it, and `sync --prune plural-extras` removes exactly those keys, listing each one (with `--dry`, it says what it would remove). For a language CLDR has no plural rules for, the source's forms are copied one to one, and sync says so.

### ICU messages {#icu}

Values written in ICU MessageFormat (next-intl, react-intl, vue-i18n, Flutter) mix code with text:

```json
{ "items": "{count, plural, =0 {No events} one {# event} other {# events}}" }
```

Only the text inside the branches is translated. The [quality gate](/docs/concepts/quality-gate) rejects a translation that changes anything else:

- variable names (`count`, `{name}`), which are never renamed or dropped;
- the words `plural`, `select` and `selectordinal`, and the type of `{price, number}`;
- selectors (`=0`, `one`, `other`, `male`). A `select` keeps exactly its options. A `plural` keeps the source's selectors and may add the categories the target language uses, from CLDR: French adds `many`, Polish `few` and `many`. A category the language does not use may be dropped, as Japanese keeps only `other`;
- `#` in each plural branch that has it, except `zero`, `one`, `two` and `=N`, where a language may write the number as a word;
- `offset:N`, nested arguments, and printf conversions such as `%s`, `%d` and `%(name)s`.

The model is told which categories the target language uses. A rejected translation is retried once with the reason, for example `ICU keyword 'other' was translated to 'óthér'`. An apostrophe before a placeholder (`d'{name}`) is fine. `verify` and `integrity` run the same check on files already written. A plain `sync` keeps a value already on disk, so each finding names the command that repairs it, `champollion sync --pair <pair> --redo keys:<key>`. When the damaged value came from the Translation Memory, they remove it from the cache, so that command translates the key again instead of serving the same text; no `--fresh` is needed.

### gettext catalogs (.po) {#gettext}

Point `localesPattern` (or `localesDir`) at your catalogs:

```json title="Django"
{ "localesPattern": "locale/{lang}/LC_MESSAGES/{ns}.po" }
```

```json title="GNU (po/fr.po, po/de.po, po/hello.pot)"
{ "localesDir": "./po", "format": "po" }
```

**The source** is the source language's catalog, for example `locale/en/LC_MESSAGES/django.po` from `django-admin makemessages -l en`. Its `msgid` is the text to translate when `msgstr` is empty. When that catalog does not exist, the source is a `.pot` template:

- With `localesDir`: the one `.pot` in that folder.
- With `localesPattern`: `<name>.pot` in the folder before the first placeholder or the folder above it. `<name>` is the namespace (`{ns}`, one template per domain such as `django.pot`), or the pattern's file name without `{lang}` (`messages.po` → `messages.pot`).
- With `localesLayout: "dir"`: no template is looked for. Keep the source catalog in `<localesDir>/<source>/`.

Two templates where one is expected stop the run. Champollion does not guess which one is the source.

**Keys.** Each `msgid` is a key. An entry with a `msgctxt` is keyed `msgctxt` + U+0004 + `msgid`, gettext's own encoding. "Open" the verb and "Open" the adjective are separate keys and separate cache entries. Reports print the separator as `␄` (`verb␄Open`), and `--force-keys "verb␄Open"` accepts it. If you cannot type `␄`, write `\x04` (`--force-keys 'verb\x04Open'`): both spellings work. `--force-keys` (and `--redo keys:`) splits on commas; write a comma inside a msgid as `\,` and quote the argument: `--redo 'keys:Welcome back\, %(name)s!'`. Unchanged entries come from the cache at no cost.

**What is translated.** An entry with an empty `msgstr`, or one flagged `fuzzy`, is untranslated. Sync translates it and removes `fuzzy` along with the `#|` previous-msgid lines. Translator comments (`# …`) are kept. References (`#:`), extracted comments (`#.`) and flags come from the source. `#.` comments and `msgctxt` are sent to the model as context. Entries sync did not change are written back byte for byte. Entries the source no longer has, and obsolete `#~` entries, are kept at the end.

A catalog Champollion creates (`init --langs`, or sync for a locale with no catalog yet) gets the full header `msginit --no-translator` writes, which `msgfmt -c` accepts: `Project-Id-Version`, `Report-Msgid-Bugs-To` and `POT-Creation-Date` copied from the template (`PACKAGE VERSION` is replaced by the project's folder name, and there is no `POT-Creation-Date` without a template date), `PO-Revision-Date` (when the file was made), `Last-Translator: Automatically generated`, `Language-Team: none`, `Language`, `MIME-Version: 1.0`, `Content-Type: text/plain; charset=UTF-8`, `Content-Transfer-Encoding: 8bit` and `Plural-Forms`. An existing catalog's header is never rewritten — only a placeholder `Plural-Forms` or `charset=CHARSET` in it is filled in.

**Plurals.** An entry with `msgid_plural` is translated as one ICU plural message (`{n, plural, one {One file} other {%(count)d files}}`), so the model writes every form at once. It is then written to `msgstr[0]`…`msgstr[n]` through the target's `Plural-Forms` header. Each index takes the CLDR category of the numbers that select it. Russian `nplurals=3` is `one`, `few`, `many`. If the target has no `Plural-Forms` header, or only the template placeholder, it gets the header `msginit` writes for its language, so the catalog's `msgstr[]` slots are the ones gettext and Django select: French `nplurals=2; plural=(n > 1);`, German `nplurals=2; plural=(n != 1);`, Russian `nplurals=3; …`. A language `msginit` has no entry for gets a header derived from CLDR, checked against `Intl.PluralRules` for every number up to 3,000 and for large numbers. If a language's rules cannot be written as a gettext expression, sync stops and names the command that writes the header: `msginit --locale=<lang> --input=<template>.pot`. A form the catalog has no slot for (French `many`, for 1 000 000, in a two-form catalog) is not asked for again, marked or reported as missing; a catalog that has its own header keeps it, and its slots are the ones checked.

**Limits.** Catalogs must be UTF-8. Convert others with `msgconv --to-code=UTF-8`. A plural msgid whose braces do not balance cannot be written as an ICU message, so it is reported and left for you to translate. Still run `msgfmt --check-format` (Django: `compilemessages`) before shipping. It checks only entries flagged `#, python-format` (or `c-format`, …): `makemessages` adds the flag to the entries it extracts with a `%` placeholder, but a catalog made by hand may lack it, and those entries go unchecked. `champollion verify` compares every entry's printf placeholders — name and type letter — whatever its flags, and sync keeps the source entry's flags on each entry it translates.

### Flutter ARB files (.arb) {#arb}

```json title="champollion.config.json"
{ "localesPattern": "lib/l10n/app_{lang}.arb" }
```

Use the `arb-dir` and `template-arb-file` from your `l10n.yaml` if they differ (`assets/i18n/intl_{lang}.arb`). Only messages are translated. On write:

- `@@locale` is set to the target in Flutter's form, matching the file name (`app_pt_BR.arb` → `"pt_BR"`). `gen-l10n` refuses a file whose `@@locale` disagrees with its name.
- Every `@key` metadata object (placeholders, their types, descriptions) is copied from the source. A key the source has no metadata for keeps the target's.
- Keys follow the source's order. Untranslated messages are left out, so Flutter falls back to the template.

Message `description`s are sent to the model as context. `{name}` placeholders and ICU plurals are protected by the [ICU check](#icu). `verify` and `integrity` also report a wrong `@@locale` and placeholder metadata that differs from the source. Any sync that rewrites the file repairs both: `champollion sync --pair en:fr --force` serves every unchanged message from the cache.

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
      "model": "google/gemini-3.1-pro-preview"
    },
    "en:crk": {
      "method": "llm-coached"
    }
  }
}
```

### Pair Fields

| Field | Type | Description |
|-------|------|-------------|
| `method` | `string` | Translation method: `llm`, `llm-coached`, `openai`, `anthropic`, `gemini`, `local`, `google-translate`, `deepl`, `microsoft-translator`, `libretranslate`, `apertium`, `tilde`, `translated`, `api` |
| `methodPlugin` | `string` | Name of an installed plugin (from `.champollion/methods/`) |
| `model` | `string` | Override the default model for this pair |
| `temperature` | `number` | Override the default temperature for this pair |
| `batchSize` | `number` | Override the default batch size for this pair |
| `register` | `string` | Register/tone override (preset key or freeform text) |
| `endpoint` | `string` | Remote API endpoint URL. Required when `method` is `api`. |
| `coachingFile` | `string` | Path to a coaching prompt file for this pair, read relative to the project; it replaces any less specific coaching, and a file that cannot be read stops the run |
| `promptContext` | `string` | Application context for this pair |
| `genderGuidance` | `string` \| `false` | Gender instruction for this pair's prompts: your own text, or `false` for none. See [Gender guidance](#gender-guidance). |
| `qualityTier` | `string` | A label you give the pair's output: `standard`, `high`, `research`, `verified`. Not measured, and sync translates the same whatever it says; `status` shows it (only when set) and `serve` advertises it |
| `fallback` | `object` | A second method for what this pair's method cannot translate safely. See [Fallback method](#fallback). `null` removes a fallback set on the language. |

### Fallback method {#fallback}

A pair can name a second method. The pair's own method translates first. Whatever it cannot translate safely goes to the fallback once:

- **Key-value files:** keys the [quality gate](/docs/concepts/quality-gate) refused (a dropped `{name}`, a broken plural, a two-word label turned into a paragraph) and keys the method returned nothing for.
- **Markdown (Hugo content and Docusaurus docs):** front-matter fields it left out or emptied of their words, and body blocks it left out of its response, damaged (lost a protected element: code, an HTML tag, a shortcode) or emptied. In `page` segmentation, the whole page.

```json
{
  "pairs": {
    "en:crk": {
      "method": "api",
      "endpoint": "http://127.0.0.1:8378/translate",
      "fallback": { "method": "llm-coached", "model": "google/gemini-3.8-flash" }
    }
  }
}
```

When no text may leave your machines (a hospital, a school, a community that keeps its language data on site), make the fallback a model you run yourself. The `local` method sends to an OpenAI-compatible server on this machine (Ollama, llama.cpp, vLLM, LM Studio; `LOCAL_API_BASE` sets the address, see [`local`](/docs/guides/translation-methods#local--your-own-model-ollama-vllm-lm-studio-a-trained-model)):

```json
{
  "pairs": {
    "en:crk": {
      "method": "api",
      "endpoint": "http://127.0.0.1:8378/translate",
      "fallback": { "method": "local", "model": "<your local model>" }
    }
  }
}
```

Which to use:

- **A hosted model** (`llm-coached` with a Gemini model, or another API method) is usually the stronger second opinion for a low-resource language, and is billed per request. Use it when the text may be sent to that provider.
- **`local`** keeps every key on this machine, and the estimate shows it as `$0 API cost (runs on this machine)`. Use it when nothing may leave the machine, even if the model you can run there is smaller.

The fallback's output passes the same quality gate. What it translates is cached under its own method in the Translation Memory, so the cache records which method produced each value. Later syncs reuse it instead of asking the first method again; `--fresh` or `--retranslate` asks again. What neither method translates stays as it would without a fallback. A key is left untranslated and keeps its old lock entry, so the next sync retries it and `champollion verify` lists it. A Markdown block is written as `[EN] `-prefixed source, not cached, and the file is processed again on the next sync. A block or front-matter field the quality gate refused from both methods is held back, not sent to them again until `--redo files:<page>` names the page ([Refused Markdown blocks and front-matter fields](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields)). A front-matter field both methods empty, or a page neither translates, fails the file, as without a fallback.

A fallback accepts the same fields as a pair: `method` (required), `model`, `provider`, `endpoint`, `methodPlugin`, `coachingFile`, `coachingPrompt`, `promptContext`, `register`, `temperature`, `batchSize`, `maxRetries`, `qualityTier`, `contentSegmentation`, `name`. It resolves like a pair. Fields it does not set (register, coaching, prompt context, …) come from its pair. Its own `coachingFile` reaches its prompt and its cache key, and `champollion status` shows it. The writing system belongs to the pair, so `script` and `scriptFallback` are refused on a fallback, and so is a fallback's own `fallback`. An unknown method, or a fallback identical to its pair, stops the sync with an error that names the pair. The fallback must be ready to run before the sync starts, just like the pair's own method (for example, its API key must be set).

- **`--method` and `--model` change the pair's own method only.** The fallback keeps what the config file says.
- **Cost.** The pre-run estimate covers the pair's own method only: nobody knows in advance what it will fail. Each fallback batch is priced just before it runs, with the same estimator. With `--max-cost`, a batch that would take the run past the cap (the estimate plus every fallback batch so far) is skipped, with a warning naming the keys. So is a fallback whose cost cannot be estimated (unknown is not free). Those keys stay failed, and the sync exits non-zero like any partial failure.
- **Reporting.** `sync` prints one line per pair, e.g. `[FALLBACK] en:crk — 6 key(s) the primary (api) could not translate safely → translated by llm-coached (4 accepted, 2 still failing)`. The `--json` summary says per pair what the fallback did (`method`, `attempted`, `accepted`, `failed`, `cached`): in each entry of `locales` for key-value files, in `fallback` for Docusaurus JSON, and in `content.fallback` for Markdown. `champollion status` shows the fallback under its pair. `--dry` cannot know what will fail, so it reports nothing about the fallback.
- **When the fallback wrote most of it.** When more than half of a run's fresh translations for a pair (the pair's method's accepted answers plus the fallback's) came from the fallback, `sync` adds one warning: how many of how many, by which method and model, why the pair's method's answers were not used (each reason counted: a memorized sentence repeated for different source strings, length inflation, …), and what to consider — the pair's method may not suit these strings; check what was written (`verify` checks structure, a speaker checks meaning); a stronger fallback. The `--json` entries carry `primaryAccepted` and `primaryReasons` beside `accepted`. `champollion status` gives the same share for the files ("from the fallback: 8 value(s) in the files (…) — 8 of the 8 sync wrote (100%)"), and says when it is most of the locale's text.
- `champollion serve` uses the fallback too, within its `--max-cost-per-request` / `--max-session-cost` caps.

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
      "model": "google/gemini-3.1-pro-preview",
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
| `coachingFile` | `string` | Path to a coaching prompt file for this language, read relative to the project; it replaces the top-level coaching, and a file that cannot be read stops the run |
| `promptContext` | `string` | Application context for this language |
| `genderGuidance` | `string` \| `false` | Gender instruction for this language's prompts: your own text, or `false` for none. See [Gender guidance](#gender-guidance). |
| `maxRetries` | `number` | Maximum retry budget for failed batches (default: 3) |
| `script` | `string` | ISO 15924 code of the orthography Champollion writes (e.g. `"Cans"`, `"Piqd"`). See [Script Conversion](#script-conversion). |
| `scriptFallback` | `object` | Transliteration rules for letters the script converter cannot map. See [Script Conversion](#script-conversion). |
| `endpoint` | `string` | Remote API endpoint URL, for `"method": "api"` |
| `fallback` | `object` | A second method for what this language's method cannot translate safely. See [Fallback method](#fallback). |

:::info[Inheritance chain]
Settings resolve in this order (first wins):

**pair-level** → **language-level** → **global config** → **defaults**

For example, if `pairs["en:fr"]` sets `model`, it overrides both the language-level and global `model` values.
:::

### Gender guidance {#gender-guidance}

LLM prompts carry an instruction about grammatical gender for languages that
have it. It comes from Champollion's catalogue: French asks for *écriture
inclusive* with the interpunct when a reader's gender is unknown
(`Connecté·e`, not `Connecté(e)` or `Connectée`; `Utilisateur·rice·s` in the
plural), German for the colon form (`Benutzer:innen`), Japanese for the
neutral `私`. `champollion init` prints it beside each language's register, and
`champollion status` shows it per pair, with where it comes from.

Choose another style with `genderGuidance`, for every language or for one:

```json
{
  "languages": {
    "fr": { "register": "formal-vous", "genderGuidance": "Use the masculine generic (Connecté), as the Académie française recommends." },
    "de": { "register": "formal-Sie", "genderGuidance": false }
  }
}
```

`false` sends no gender instruction; a string replaces the catalogue's. The
setting applies to methods that take instructions (the LLM methods); machine
translation engines (DeepL, Google, …) are not told. A changed gender
instruction is a different prompt, so it has its own cache entries: what is
already translated stays as it is until you re-translate it (`champollion sync
--redo all`, which sync suggests when the files hold the earlier style).

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

Champollion creates `.champollion.lock` to track SHA-256 hashes of translated source values. **Commit this file** so all developers share the same translation baseline. In a project with one folder per language, keys are recorded as `<namespace>::<key>`.

Per target locale, the lock also records a fingerprint of each value sync wrote and of the source text it translated (so a value a person edited is recognised, and an out-of-date translation is reported), the keys a redo could not finish (**pending**), and the keys the quality gate refused (**held back** from the same model). With any of that to record the file takes its version-2 form, `{"version": 2, "source": {…}, "locales": {…}}`; a version-1 lock (a flat key → hash map) is read as before. A replaced hand edit is kept in `.champollion-replaced-edits.jsonl` next to it — commit both. See [Quality Gate](/docs/concepts/quality-gate#refused-keys-are-held-back) and [Editing translations](/docs/guides/professional-translators#editing-key-value-files).

When a source value changes, the hash no longer matches, and champollion re-translates that key on the next sync.

## `.champollionignore`

Create `.champollionignore` in your project root to exclude files from `lint` scanning. Uses glob patterns, like `.gitignore`:

```text title=".champollionignore"
src/components/legacy/**
src/utils/constants.js
**/*.test.js
```

## `.champollion/` Directory

Champollion creates a `.champollion/` directory in your project root for internal state. Keep it out of version control — it's a per-machine cache, not project source. `champollion init` adds this line to `.gitignore`, creating the file if there is none (also in a folder that is not a git repository yet, so a later `git init` and `git add --all` do not commit the cache):

```gitignore
.champollion/
```

Commit the lock files next to it (`.champollion.lock`, `.champollion-content.lock`): they record which source text each translation was made from.

| File | Purpose | Commit? |
|------|---------|--------|
| `tm.json` | Translation Memory cache — stores previous translations keyed by source text + locale + method | No (local cache) |
| `xliff/*.xliff` | XLIFF export files for professional translator review | No (transient) |
| `methods/` | Installed method plugin manifests | Ignored by the `.champollion/` line. To share installed plugins, replace that line with `.champollion/*` and `!.champollion/methods/` |
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
| `translateWithFallback`, `translateAndValidate` | One pair's pipeline for a batch of keys, as `sync` runs it: cache, method, quality gate, cache, then the pair's fallback. Pass a pair from `resolvePairs`, `tm` from `loadTM`, and `cwd`, the project directory: the method reads its key, endpoint, coaching and glossary there, not from `process.cwd()` |
| `createFallbackBudget` | The `--max-cost` guard for fallback batches (`{ maxCost, committed, cwd }`) |
| `discoverLocaleLayout`, `resolveLocaleFiles` | The files that make up each locale (flat, folder per locale, or `localesPattern`) |
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

