---
sidebar_position: 1
title: CLI Reference
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# CLI Reference

## Commands

```
champollion init              Interactive setup wizard (--yes for quick defaults)
champollion sync              Translate & sync all locale files
champollion watch             Auto-sync when the source file changes
champollion audit             List all untranslated [EN] fallback values
champollion lint              Scan source code for hardcoded strings
champollion wrap              Auto-wrap hardcoded strings in t() calls (with undo)
champollion seo <sub>         Generate hreflang, sitemap.xml, or JSON-LD schema
champollion integrity         Audit locale files for format/encoding issues
champollion repair-script     Restore romanization where script conversion was unwanted
champollion verify            Verify translations are present and correct (CI gate)
champollion status            Show pair configuration, plugins, and quality tiers
champollion provenance        Audit translation resource licensing
champollion plugin <sub>      Manage method plugins (install, remove, list)
champollion fonts <sub>       Download web fonts for PUA script converters
champollion leaderboard       Browse and install methods from the Network leaderboard
champollion tm <sub>          Manage Translation Memory cache (stats, clear, seed, prune)
champollion xliff <sub>       Export/import XLIFF 1.2 for professional review
champollion card <code>       Pretty-print a language card (--json for raw output)
champollion models            List available models from a provider (--method <provider>)
champollion doctor            System health check (cards, config, FSTs, API keys, methods)
champollion recommend         Method guidance for a pair — availability + cited evidence
champollion register-corpus   Register a corpus: pick a license + exposure tier (local-only/private/public/sealed)
champollion submit            Propose an index entry (review-gated): prints a pre-filled GitHub issue
champollion seal-corpus <sub> Sealed-tier crypto verbs: keygen / seal / open (organizer-node bridge)
```

Run `champollion <command> --help` for detailed help on any command.

## Global Options

```
--help, -h              Show help (global or per-command)
--version, -v           Print version and exit
--yes, -y               Skip interactive prompts, use defaults
--config <path>         Custom config file path
--dir <path>            Override locales directory
--content-dir <path>    Hugo/Docusaurus content directory for Markdown translation
--source <code>         Override source locale (default: en)
--model <model>         Override translation model (full slug or alias from shared/model-aliases.json)
--method <method>       Translation method: llm, google-translate (default: from config)
--temperature <n>       LLM temperature (0.0–2.0, default: 0.3)
--coaching-file <path>  Path to free-text coaching prompt file (injected into system prompt)
--format <fmt>          Locale file format: json, toml, yaml, or auto
--dry, --dry-run        Preview changes without writing files
--list-keys             With --dry: name every queued key per reason
--concurrency <n>       Max parallel API calls (sets both JSON and content, default: 48)
--json-concurrency <n>  Max parallel locale translations for JSON keys (default: 200)
--content-concurrency <n> Max parallel API calls for content translation (default: 48)
--force                 Re-queue every source key (whole-locale rebuild; scope with --pair)
--force-content         Re-translate all content files (clears content lock)
--force-keys <keys>     Comma-separated dot-notation keys to force re-translate
--no-tm                 Skip Translation Memory cache for this sync run
--no-verify             Skip post-sync verification pass
--locale <code>         Target locale (xliff export, tm clear)
--quiet                 Errors and warnings only — suppress banner, progress bar, and info lines
--json                  Machine-readable NDJSON output — one JSON object per event
```

---

## init

Interactive setup wizard that creates `champollion.config.json`. Guides through source locale, target languages, file format, and translation model.

```bash
champollion init                          # interactive wizard
champollion init --yes                    # skip wizard, use defaults
champollion init --yes --langs fr,de,ja   # quick setup with specific languages
champollion init --source en --dir ./i18n # overrides with defaults
```

**`--langs` option**: Comma-separated list of target language codes. Skips the language prompt and applies default register presets for each language. Combine with `--yes` for fully non-interactive setup.

**Language presets**: When prompted for target languages, you can type preset names:
- `european` → fr, de, es, it, pt, nl
- `asian` → ja, zh, ko
- `global` → fr, es, de, ja, zh, ko, pt, ar
- `nordic` → da, fi, nb, sv

Mix presets and individual codes: `european, ja` → fr, de, es, it, pt, nl, ja

---

## sync

Translates missing and stale keys across all locale files. Runs post-sync verification by default.

```bash
champollion sync                                   # translate everything
champollion sync --dry-run                         # preview only
champollion sync --dry --list-keys                 # preview AND name every queued key
champollion sync --force-keys "hero.title"         # force re-translate
champollion sync --force-keys "a.title,a.subtitle" # multiple keys
champollion sync --pair en:tlh --force             # rebuild one whole locale
champollion sync --pair en:tlh --force --no-tm     # ...bypassing a suspect cache
champollion sync --force-content                   # re-translate all Markdown/MDX
champollion sync --content-dir ./content           # include Hugo Markdown
champollion sync --method google-translate          # force Google Translate
champollion sync --concurrency 20                  # 20 parallel API calls (both phases)
champollion sync --json-concurrency 30              # 30 parallel locale translations (JSON)
champollion sync --content-concurrency 8            # 8 parallel content translations
champollion sync --no-verify                        # skip post-sync verification
champollion sync --no-tm                            # skip cache, fresh API calls
```

**Translation Memory**: By default, `sync` loads `.champollion/tm.json` and serves cached translations for unchanged source values. Use `--no-tm` to bypass the cache (useful when switching translation providers or debugging quality). See [Translation Memory](/docs/concepts/translation-memory).

**Change detection**: champollion stores SHA-256 hashes in `.champollion.lock`. When source values change, the next sync automatically re-translates those keys. Commit the lock file so all developers share the baseline.

**Parallelism**: Both JSON key translation and content translation run in parallel. JSON locales are translated simultaneously (default: 200 concurrent locales), with batches within each locale also parallelized (4 concurrent batches). Content translation (Markdown, MDX, blog posts) runs in a flat work-item pool (default: 48 concurrent API calls). Override with `--json-concurrency`, `--content-concurrency`, or `--concurrency` (sets both).

**Output**: Sync displays a version banner, format/framework detection, cost estimate, and per-locale progress bars:

```
champollion v0.1.0

[INFO] Detected format: json (auto)
[INFO] Source: en.json (2,847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl

[INFO] es-MX.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 5,694 keys total.
```

Progress bars update in-place after each batch (~80 keys). Use `--quiet` for errors/warnings only, or `--json` for machine-readable NDJSON output. Both suppress the progress bar and banner.

---

## watch

Auto-sync when the source locale file changes. Runs until interrupted with `Ctrl+C`.

```bash
champollion watch
```

---

## audit

List all untranslated `[EN]`-prefixed fallback values from prior runs. Exits with code 1 if any are found — use as a CI gate to fail builds with incomplete translations.

```bash
champollion audit
```

---

## verify

Re-reads all locale files from disk and verifies translations are actually present and correct. This is the same verification that runs automatically at the end of every `sync` (unless `--no-verify` is passed).

```bash
champollion verify                    # verify all locale files
champollion verify --warn-only        # non-blocking
champollion verify && echo "All good" # CI gate
```

**What it checks:**
- Key parity — all source keys present in each target
- `[EN]` fallback markers from prior runs
- Empty translations
- Script compliance — non-Latin locales should have non-ASCII translations
- Placeholder preservation — ICU placeholders match source
- Encoding issues — BOM markers, invisible characters
- Source echoes — values identical to source (warning)

---

## lint

Scans source code for hardcoded user-facing strings that should use i18n translation calls. Auto-detects your framework (next-intl, react-i18next, vue-i18n, Hugo).

```bash
champollion lint                    # exits 1 if issues found
champollion lint --warn-only        # always exits 0
champollion lint --src ./app        # custom source directory
champollion lint --min-length 4     # minimum string length to flag
```

**What it detects:**
- Hardcoded strings in JSX text, `placeholder`, `alt`, `aria-label`, `title`
- Files with user-facing content but no i18n framework import
- Dead keys — locale keys that no source file references
- Coverage score — percentage of strings going through i18n

**Exclusions**: Create `.champollionignore` in your project root (glob patterns, like `.gitignore`).

---

## wrap

Auto-wraps hardcoded strings detected by `lint` in `t()` calls. Creates automatic backups before modifying files.

```bash
champollion wrap                    # auto-wrap with backup
champollion wrap --dry              # preview wrapping changes
champollion wrap --undo             # restore from .champollion-backup/
```

**Safety gates:**
1. Git-clean check (skipped in dry-run)
2. Automatic backup to `.champollion-backup/`
3. Diff preview before each file write
4. `--undo` support to restore from backup

---

## seo

Generate SEO artifacts for multilingual sites.

```bash
champollion seo hreflang                                        # print hreflang tags
champollion seo sitemap --base-url https://example.com --out sitemap.xml
champollion seo jsonld --base-url https://example.com           # JSON-LD schema
```

| Subcommand | Output |
|------------|--------|
| `hreflang` | `<link rel="alternate" hreflang>` tags |
| `sitemap` | Multilingual `sitemap.xml` |
| `jsonld` | JSON-LD WebSite language schema |

---

## integrity

Detects corruption and drift in translated locale files.

```bash
champollion integrity               # exits 1 if issues found
champollion integrity --warn-only   # non-blocking
```

**What it checks:**
- Placeholder corruption (e.g., `{name}` present in source but missing in target)
- Encoding issues (mojibake, invalid Unicode)
- Untranslated copies (target value identical to source) — [`noTranslate`](/docs/getting-started/configuration#no-translate) keys are exempt, and so are echoes the Translation Memory confirms as pipeline-produced and gate-approved. What remains flagged is exactly what `sync` would requeue — the two tools cannot disagree about a healthy file
- No-translate drift (a `noTranslate` key that is *not* identical to the source) — reported with expected/actual values and invisible characters escaped; run `champollion sync` to repair
- Unexpected PUA (Private Use Area codepoints in a locale whose [script conversion](/docs/getting-started/configuration#script-conversion) is off — renders blank without a special font); run `champollion repair-script` to repair
- Hollowed values (a target that is its source with the letters deleted — damage from a pipeline older than the content-preservation gate); re-translate with `sync --force-keys <key>` or `sync --pair <pair> --force`
- Orphaned keys (keys in target that don't exist in source)
- ICU MessageFormat plural category completeness (e.g., Arabic needs 6 categories)

---

## repair-script

Reverses script conversion that should never have happened: PUA-encoded values (pIqaD, Tengwar, Kryptonian) in locales whose configuration says conversion is off are restored to romanization via the converter's own reverse table.

```bash
champollion repair-script --dry     # preview
champollion repair-script           # repair in place
```

| Option | Effect |
|--------|--------|
| `--dry` | Preview repairs without writing |
| `--locale <code>` | Repair only one locale |
| `--json` | Machine-readable JSON output |
| `--warn-only` | Exit 0 even if unreversible PUA remains |

pIqaD reverses exactly. Tengwar and Kryptonian reversals cannot recover capitalisation (flagged as case-lossy). The Translation Memory needs no repair — it stores pre-conversion values. Exits 1 when PUA remains that no registered converter can reverse.

---

## tm

Manage the Translation Memory cache (`.champollion/tm.json`). TM stores previous translations and serves them on subsequent syncs instead of calling the API.

```bash
champollion tm stats                  # show cache statistics
champollion tm clear                  # clear cache (with confirmation)
champollion tm clear --yes            # clear without confirmation
champollion tm clear --locale fr      # clear only French entries
```

| Subcommand | Output |
|------------|--------|
| `stats` | Entry count, file size, per-locale breakdown |
| `clear` | Delete cache file (full or per-locale) |

| Option | Effect |
|--------|--------|
| `--locale <code>` | Clear only entries for one locale |
| `--yes` | Skip confirmation prompt |

See [Translation Memory](/docs/concepts/translation-memory) for how TM works and when to clear it.

---

## xliff

Export and import XLIFF 1.2 files for professional translator review. XLIFF is the universal exchange format supported by CAT tools like memoQ, SDL Trados, and Phrase.

```bash
champollion xliff export --locale fr                   # export French XLIFF
champollion xliff export --locale ja --out ./review/   # custom output path
champollion xliff import .champollion/xliff/fr.xliff       # import reviewed file
champollion xliff import ./reviewed.xliff --dry        # preview import
```

| Subcommand | Output |
|------------|--------|
| `export` | Generate `.xliff` from source + target locale files |
| `import` | Merge reviewed `.xliff` translations into locale files |

| Option | Effect |
|--------|--------|
| `--locale <code>` | Target locale for export (required) |
| `--out <path>` | Custom output path or directory |
| `--dry` | Preview import without writing |

See [Working with Professional Translators](/docs/guides/professional-translators) for the full workflow.

---

## status

Show pair configuration, installed plugins, quality tiers, and benchmark scores.

```bash
champollion status
```

---

## provenance

Audit translation resource licensing for all installed plugins.

```bash
champollion provenance
```

---

## plugin

Manage translation method plugins. Plugins are pre-packaged translation recipes installed to `.champollion/methods/`.

```bash
champollion plugin list                      # show installed plugins
champollion plugin install ./my-method/      # install from local directory
champollion plugin remove crk-coached-v1     # remove a plugin
```

See [Plugin Specification](/docs/reference/plugin-spec) for the plugin manifest format.

---

## leaderboard

Browse, search, and install translation methods from the Network leaderboard. Methods installed from the leaderboard come with benchmark scores and the full canonical MethodConfig — the exact configuration used during evaluation.

```bash
champollion leaderboard                          # show leaderboard
champollion leaderboard --pair en:fr             # filter by language pair
champollion leaderboard --install crk-coached-v8 # install a method plugin
champollion leaderboard --install crk-coached-v8 --apply  # install + patch config
```

| Option | Effect |
|--------|--------|
| `--pair <code>` | Filter leaderboard by language pair (e.g., `en:fr`) |
| `--install <name>` | Install a method plugin from the leaderboard |
| `--apply` | After install, automatically add `methodPlugin` to `champollion.config.json` |

**`--apply` workflow:** When you install with `--apply`, champollion writes the method plugin to `.champollion/methods/` **and** patches your `champollion.config.json` to use it for the relevant pair. This is the fastest path from "what scores best?" to "I'm using it in production."

---

## fonts

Downloads and manages PUA web fonts for constructed language script converters. Languages that use Private Use Area characters (Klingon, Sindarin, Kryptonian) need custom web fonts to render their scripts. This command downloads them from verified open-source repositories.

```bash
champollion fonts list                           # show needed fonts
champollion fonts install                        # download all needed fonts
champollion fonts install --css                  # also generate CSS snippet
champollion fonts install --dir ./public/fonts   # custom output directory
```

| Subcommand | Output |
|------------|--------|
| `list` | Shows which PUA fonts are needed and their install status |
| `install` | Downloads fonts for configured languages |

| Option | Effect |
|--------|--------|
| `--dir <path>` | Override font output directory (auto-detected from project type) |
| `--css` | Generate a `conlang-fonts.css` snippet alongside the fonts |
| `--config <path>` | Path to config file (used to detect which languages need fonts) |

**Auto-detection:** The output directory is inferred from your project structure:
- **Docusaurus** → `static/fonts/` or `website/static/fonts/`
- **Hugo** → `static/fonts/`
- **Default** → `public/fonts/`

**Native Unicode converters** (`crk` → Cree Syllabics, `sr` → Serbian Cyrillic) do NOT require font installation.

See [Conlangs, Scripts & Orthography](/docs/guides/conlangs-scripts-orthography) for full PUA font details.

## Three-Layer Pipeline

Use `lint`, `sync`, and `audit` together for bulletproof i18n:

```json title="package.json"
{
  "scripts": {
    "i18n:lint": "champollion lint",
    "i18n:sync": "champollion sync",
    "i18n:audit": "champollion audit"
  }
}
```

| Layer | Command | When | Purpose |
|-------|---------|------|---------|
| **Lint** | `lint` | Pre-commit | Block commits with hardcoded strings |
| **Sync** | `sync` | Post-commit / CI | Translate missing and changed keys |
| **Verify** | `verify` | Post-sync / CI | Confirm translations are present and correct |
| **Audit** | `audit` | Build step | Fail deployment if any locale has `[EN]` markers |

---

## See Also

- [Configuration](/docs/getting-started/configuration) — config file reference
- [Translation Methods](/docs/guides/translation-methods) — method selection per pair
- [Translation Memory](/docs/concepts/translation-memory) — caching and cost savings
- [Working with Professional Translators](/docs/guides/professional-translators) — XLIFF workflow
- [Plugin Specification](/docs/reference/plugin-spec) — plugin manifest format
- [CI/CD Guide](/docs/guides/ci-cd) — automating CLI commands in your pipeline
- [How Sync Works](/docs/concepts/how-sync-works) — understanding the sync pipeline
- [Quality Gate](/docs/concepts/quality-gate) — how translations are validated
