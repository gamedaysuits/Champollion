/**
 * Command: help
 *
 * Prints the full CLI help screen with all commands, options,
 * supported formats, and quick-start instructions.
 */

import { CONFIG_FILENAMES, DEFAULT_OPENROUTER_MODEL } from '../config.js';

const DEFAULT_CONFIG_FILENAME = CONFIG_FILENAMES[0];

/**
 * @returns {void}
 */
function run() {
  console.log(`
  champollion — translate your project, and deploy MT you have measured

  TRANSLATE YOUR PROJECT
    init         Set up: detects your framework's locale files (or --yes for defaults)
    sync         Translate what changed (--redo / --fresh to translate again)
    verify       Check translations are present and correct (CI gate)
    status       Show pair graph, methods, and config summary
    watch        Auto-sync when the source file changes
    serve        Serve this project's translation stack over HTTP (api-method contract)
    audit        List all untranslated [EN] fallback values
    integrity    Audit locale files for placeholder/encoding/ICU issues
    tm           Manage Translation Memory cache (stats, clear, seed, prune)
    xliff        Export/import XLIFF 1.2 for professional review
    lint         Scan source files for hardcoded strings (pre-commit gate)
    wrap         Auto-wrap hardcoded strings in t() calls (with undo)
    seo          Generate hreflang, sitemap.xml, or JSON-LD schema
    repair-script  Restore romanization where script conversion was unwanted
    plugin       Manage method plugins (install, remove, list)
    models       List available models for a provider
    fonts        Download web fonts for PUA script converters
    provenance   Show licensing & resource dependencies for all pairs
    doctor       System health check (cards, config, FSTs, methods)

  THE NETWORK   champollion network <command> — each also works without the prefix
    card         What the index knows about a language (card \<code\> [--json])
    recommend    Methods you can run for a pair, with the evidence for each
    leaderboard  Published results (--pair, --sort, --json)
    register-corpus  Register a test set without handing it over (local-only/private/public/sealed)
    seal-corpus  Sealed-tier crypto verbs: keygen / seal / open (organizer-node bridge)
    submit       Propose an index entry (review-gated): print a pre-filled GitHub issue

  Building MT for a language end to end (measure, train, prove, deploy)?
    https://champollion.dev/docs/build-mt-for-your-language

  OPTIONS
    --config <path>    Path to config file (default: ${DEFAULT_CONFIG_FILENAME})
    --dir <path>       Override locales directory
    --content-dir <p>  Folder of Markdown/MDX to translate (Hugo content/ or any folder)
    --source <code>    Override source locale (default: en)
    --base-url <url>   Override base URL for SEO commands
    --model <model>    Translation model for this run only (the config's "model" is not changed)
    --method <method>  Translation method for this run only: llm, llm-coached, local (your own model), openai, anthropic, gemini, google-translate, deepl, microsoft-translator, libretranslate, api
    --format <fmt>     Locale file format: json, toml, yaml, po, arb, or auto (default: auto)
    --dry              Preview changes without writing files
    --redo <scope>     Translate again: all | keys:<k1,k2> | content | files:<glob> (cache still serves) | gaps (plural forms a model left out, asked anew)
    --prune plural-extras  Remove i18next plural keys for forms a language does not have (sync)
    --fresh            Do not use the cache for what is queued (billed again)
    --src <path>       Source directory for lint/wrap (auto-detected)
    --min-length <n>   Minimum string length to flag (default: 2)
    --warn-only        Exit 0 even with issues (lint, integrity)
    --undo             Restore files from .champollion-backup/ (wrap)
    --out <path>       Write output to file (seo sitemap, xliff export)
    --locale <code>    Target locale (xliff export, tm clear, tm seed)
    --no-verify        Skip post-sync verification pass

  SUPPORTED FORMATS
    json     Standard JSON (next-intl, i18next, react-intl)
    toml     Hugo i18n TOML files (i18n/*.toml)
    yaml     Hugo i18n YAML files (i18n/*.yaml)
    po       gettext catalogs (Django, GNU gettext; .pot templates)
    arb      Flutter Application Resource Bundles (app_<locale>.arb)
    auto     Auto-detect from file extensions

  QUICK START
    1. Set OPENROUTER_API_KEY (or a provider key; or --method local for a model on this machine)
    2. Run: champollion init     # finds your locale files
    3. Run: champollion sync

  The tool will:
    • Translate only what changed; the Translation Memory never bills the same sentence twice
    • Protect placeholders, ICU plurals and markup (a damaged translation is rejected and retried)
    • Fail loud on any translation errors (no silent failures)
    • Verify translations after writing (key parity, placeholders, script compliance)
    • Preserve your file structure and formatting

  Run champollion <command> --help for detailed help on any command.
  `);
}

export { run };
