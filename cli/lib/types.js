/**
 * Shared type definitions for champollion.
 *
 * This file contains JSDoc @typedef declarations for the core data shapes
 * that flow between modules. It has no runtime code — it exists only so
 * that editors can resolve type references via imports.
 *
 * USAGE IN OTHER MODULES:
 *   /** @typedef {import('./types.js').PairConfig} PairConfig * /
 *
 *   Or, for VS Code auto-resolution without explicit import, just reference
 *   the type name — jsconfig.json's include paths make these globally visible.
 */

// -----------------------------------------------------------------
// ChampollionConfig — the fully resolved project configuration
// Produced by: config.js:resolveConfig()
// Consumed by: sync.js, commands/*, seo.js, lint.js, pairs.js
// -----------------------------------------------------------------

/**
 * @typedef {object} ChampollionConfig
 * @property {number} version - Config schema version (currently 3)
 * @property {string} inputLocale - Source locale code (e.g., 'en')
 * @property {string} baseUrl - Site base URL for SEO commands
 * @property {string} localesDir - Absolute path to locale files directory
 * @property {string|null} contentDir - Hugo/Docusaurus content directory, or null if disabled
 * @property {string[]|null} translatableFields - Override for content translatable fields, or null for defaults
 * @property {Array<string>|object} languages - Target languages (array of codes or object with config)
 * @property {Object<string, LanguageConfig>} [resolvedLanguages] - Fully resolved language map (code → config). Set by resolveConfig.
 * @property {string[]} noTranslate - Dot-path keys / glob patterns whose value is copied verbatim to every locale (e.g. ['**.url']). Never sent to a backend, gated, or billed.
 * @property {boolean} noTranslateUrls - Auto-treat source values that are bare `scheme://` URLs as no-translate (default true)
 * @property {object|null} pairs - Advanced per-pair overrides, or null
 * @property {string} model - Default translation model (e.g., 'openai/gpt-4o-mini')
 * @property {string} defaultMethod - Global default method: 'llm', 'google-translate', 'api'
 * @property {number} batchSize - Default batch size for translation calls
 * @property {string} fallbackPrefix - Prefix for untranslated fallback values (default: '[EN] ')
 * @property {string} apiKeyEnvVar - Environment variable name for the API key
 * @property {string} format - Locale file format: 'json', 'toml', 'yaml', 'auto', 'docusaurus'
 * @property {string[]} [forceKeys] - Dot-notation keys to force re-translate (from --force-keys). Set by resolveConfig.
 * @property {{ srcDir: string|null, ignore: string[], minLength: number }} lint - Lint config
 * @property {{ urlPattern: string, pages: string[]|null }} seo - SEO config
 * @property {{ output: string|null, autoGenerate: boolean }} typegen - Type generation config
 */

// -----------------------------------------------------------------
// PairConfig — a single source→target translation pair
// Produced by: pairs.js:resolvePairs(), enriched by plugins.js
// Consumed by: translate.js, methods/*.js, sync.js, provenance.js
// -----------------------------------------------------------------

/**
 * @typedef {object} PairConfig
 * @property {string} source - Source locale code (e.g., 'en')
 * @property {string} target - Target locale code (e.g., 'fr')
 * @property {string} method - Translation method name: 'llm', 'llm-coached', 'google-translate', 'api'
 * @property {string} model - Model identifier (e.g., 'openai/gpt-4o-mini')
 * @property {string} qualityTier - Quality tier: 'standard', 'high', 'research', 'verified'
 * @property {number} batchSize - Max keys per API call
 * @property {number} maxRetries - Max cascade retries on parse failure
 * @property {string} register - Translation register / style instruction (resolved prompt text)
 * @property {string|null} registerPreset - Preset key name (e.g., 'casual-tu') for metadata lookups, or null for custom text
 * @property {string} name - Human-readable language name (e.g., 'French')
 * @property {string} dir - Text direction: 'ltr' or 'rtl'
 * @property {string|null} scripts - LEGACY: the card's scriptConverter key (misleading name, kept for JSON-output compat)
 * @property {string|null} script - User's `script:` config value (ISO 15924), or null
 * @property {object|null} scriptFallback - User transliteration rules for unmapped letters ({ sequence: replacement }), or null
 * @property {{script: string|null, source: string, converterKey: string|null, choices?: Array}} [scriptResolution] - Resolved script decision (set by resolvePairs; see lib/scripts.js resolveTargetScript)
 * @property {string|null} methodPlugin - Plugin name reference, or null
 * @property {string|null} formalitySystem - Formality system name (e.g., 'T-V', 'speech-levels'). Used by DeepL for structured formality mapping.
 * @property {string|null} genderGuidance - Language-specific gender guidance for LLM prompts, or null
 * @property {Set<string>} _defaults - Fields that were filled from system defaults (used by plugin precedence)
 *
 * --- Plugin-injected fields (present after resolvePluginForPair) ---
 * @property {string} [endpoint] - Plugin API endpoint URL
 * @property {string} [pluginName] - Installed plugin name
 * @property {string} [pluginVersion] - Plugin version string
 * @property {string} [pluginDir] - Absolute path to plugin directory
 * @property {object|null} [pluginBenchmarks] - Plugin quality benchmarks, or null
 * @property {object|null} [pluginProvenance] - Plugin provenance/licensing info, or null
 *
 * --- Validation thresholds (used by validate.js quality gate) ---
 * @property {number} [maxLengthRatio] - Max target/source length ratio for validation
 * @property {number} [minLengthRatio] - Min target/source length ratio for validation
 * @property {number} [maxRepetitionRate] - Max character repetition rate threshold
 * @property {boolean} [requireNonLatin] - Whether to require non-Latin script in output
 */

// -----------------------------------------------------------------
// LanguageConfig — per-language settings from the user's config
// Produced by: config.js (from user's `languages` object)
// Consumed by: pairs.js:resolvePairs()
// -----------------------------------------------------------------

/**
 * @typedef {object} LanguageConfig
 * @property {string} name - Human-readable language name
 * @property {string} register - Translation register / style instruction (resolved prompt text)
 * @property {string|null} [registerPreset] - Preset key name for metadata lookups (e.g., DeepL formality), or null for custom text
 * @property {string} [dir] - Text direction: 'ltr' or 'rtl'
 * @property {string|null} [formalitySystem] - Formality system name (e.g., 'T-V', 'speech-levels', 'keigo')
 * @property {string} [model] - Per-language model override
 * @property {number} [batchSize] - Per-language batch size override
 * @property {number} [maxRetries] - Per-language max retries override
 * @property {string} [script] - Script system override (e.g., 'syllabics' for Cree)
 */

// -----------------------------------------------------------------
// LanguageCard — unified language metadata from language-cards/*.json
// Produced by: registers.js:getLanguageCard()
// Consumed by: config.js, pairs.js, init.js, status.js, deepl.js
//
// NOTE (v6 Unified Architecture):
//   All language data lives in a single card file. The former two-tier
//   split (v5) is eliminated. getLanguageReference() is a backward-
//   compat alias for getLanguageCard().
// -----------------------------------------------------------------

/**
 * @typedef {object} LanguageCard
 * @property {string} code - BCP 47 locale code (e.g., 'fr', 'ko', 'x-pirate')
 * @property {string} name - English language name
 * @property {string} nativeName - Name in the language itself (e.g., 'Français', '한국어')
 * @property {string} [iso639_1] - ISO 639-1 two-letter code, or null
 * @property {string} iso639_3 - ISO 639-3 three-letter code
 * @property {string} bcp47 - BCP 47 tag
 * @property {string} script - ISO 15924 script code (e.g., 'Latn', 'Kore', 'Arab')
 * @property {'ltr'|'rtl'} dir - Text directionality
 * @property {LanguageFormality|null} formality - Formality system metadata, or null if no system
 * @property {{ grammatical: boolean, inclusiveGuidance: string|null }} gender - Gender metadata
 * @property {Object<string, RegisterPreset>} registers - Named register presets
 * @property {string[]} aliases - Alternative locale codes that resolve to this card
 * @property {{ googleTranslate: {supported: boolean}, deepl: {supported: boolean, formality?: boolean}, microsoftTranslator: {supported: boolean}, libreTranslate: {supported: boolean}, nllb: {supported: boolean, code?: string}, llm: {supported: boolean} }} methodSupport - API method support — each entry is an object with 'supported' boolean plus optional metadata
 * @property {string|null} scriptConverter - Script converter reference (e.g., 'serbian-latin-cyrillic')
 * @property {string[]} evalDatasets - Dataset IDs for the companion eval harness (not consumed by champollion at runtime)
 * @property {string|null} notes - Free-text notes
 * @property {object|null} rules - Typography, plurals, capitalization, and variable rules (used by compliance plugin)
 * @property {{ reviewed: boolean, reviewer?: string, date?: string }|null} [humanReviewed] - Review status
 * @property {string|null} [glottocode] - Glottolog identifier for family tree cross-referencing
 * @property {string|null} [extends] - Parent card code for inheritance
 * @property {string|null} [macrolanguage] - ISO 639-3 macrolanguage umbrella code (e.g., 'cre', 'ara', 'zho')
 * @property {{ family: string, familyGlottocode: string, genus: string, genusGlottocode: string, ancestry: string[] }|null} [classification] - Genealogical classification from Glottolog + WALS
 * @property {Array<{ source: string, sourceIso639_3?: string, type: string, domains?: string[], depth: string, period?: string, notes?: string }>|null} [contactInfluences] - Universal contact history
 * @property {Array<{ code: string, name: string, primary: boolean }>|null} [scripts] - ISO 15924 script tracking
 * @property {string[]|null} [dataSources] - Provenance tracking (e.g., ['glottolog-5.3', 'cldr-48'])
 * @property {object|null} [linguisticChallenges] - MT-relevant linguistic challenges
 * @property {object|null} [encyclopedic] - Language family, demographics, dialect info
 * @property {object|null} [resources] - NLP corpora, models, FSTs
 * @property {Array<{ country: string, countryCode: string, officialStatus?: string, region?: string, speakerEstimate?: string, coordinates?: [number, number] }>|null} [regions] - Geographic regions where this language is actively spoken
 * @property {{ text: string, transliteration?: string, translation: string, literal?: string, source?: string }|null} [culturalAphorism] - Iconic proverb encapsulating the community's worldview
 */

/**
 * @typedef {object} LanguageFormality
 * @property {string} system - Formality system name (e.g., 'T-V', 'speech-levels', 'keigo', 'particles-and-pronouns')
 * @property {string} description - Human-readable description of how formality works in this language
 * @property {string} default - Key of the default register preset
 */

/**
 * @typedef {object} RegisterPreset
 * @property {string} label - Display label (e.g., 'Vouvoiement (Formal)', '해요체 (Polite)')
 * @property {string} description - Short description of when to use this preset
 * @property {string} prompt - Full register prompt text injected into LLM prompts
 * @property {string} [deeplFormality] - DeepL API formality value: 'prefer_more', 'prefer_less', or 'default'. Only present on presets for languages where methodSupport.deepl.formality is true.
 */

// -----------------------------------------------------------------
// DiffResult — output of comparing source vs target locale
// Produced by: diff.js:diffLocale()
// Consumed by: sync.js
// -----------------------------------------------------------------

/**
 * @typedef {object} DiffResult
 * @property {string[]} missing - Keys in source but not in target
 * @property {string[]} needsTranslation - Keys with [EN] fallback prefix in target
 * @property {string[]} changed - Keys whose source content hash changed since last sync
 * @property {string[]} forced - Keys explicitly requested for re-translation
 * @property {string[]} noTranslate - Exempt keys (config `noTranslate` / auto-detected URL) whose target is not byte-identical to the source and must be copied verbatim. Never translated, gated, or billed.
 * @property {string[]} extra - Keys in target but not in source (stale/orphaned)
 * @property {string[]} toProcess - Deduplicated union of missing + needsTranslation + changed + forced, minus every exempt key
 */

// -----------------------------------------------------------------
// CoachingData — linguistic coaching hints for LLM-coached method
// Produced by: llm-coached.js:_loadCoachingData()
// Consumed by: llm-coached.js:buildCoachedSystemMessage/buildCoachedPrompt
// -----------------------------------------------------------------

/**
 * @typedef {object} CoachingData
 * @property {string[]} [grammar_rules] - Grammar rules (e.g., "French adjectives agree in gender/number")
 * @property {Object<string, string>} [dictionary] - Term overrides (e.g., "dashboard" → "tableau de bord")
 * @property {string} [style_notes] - Style guidance (e.g., "Prefer active voice. Avoid anglicisms.")
 */

// -----------------------------------------------------------------
// CLI args shape — parsed CLI arguments passed to command modules
// Produced by: bin/cli.js (util.parseArgs)
// Consumed by: lib/commands/*.js
// -----------------------------------------------------------------

/**
 * @typedef {object} CLIArgs
 * @property {string[]} [_] - Positional arguments (command, subcommand, etc.)
 * @property {boolean} [dry] - Preview changes without writing files
 * @property {boolean} [help] - Show help
 * @property {boolean} [version] - Show version
 * @property {boolean} [fallback] - Write [EN]-prefixed placeholders
 * @property {boolean} [yes] - Skip interactive prompts
 * @property {boolean} [undo] - Restore from backup (wrap command)
 * @property {string} [config] - Custom config file path
 * @property {string} [dir] - Override locales directory
 * @property {string} [source] - Override source locale
 * @property {string} [model] - Override translation model
 * @property {string} [method] - Override translation method
 * @property {string} [format] - Locale file format override
 * @property {string} [out] - Output file path (seo sitemap)
 * @property {string} [src] - Source directory for lint/wrap
 * @property {string} ['content-dir'] - Hugo content directory
 * @property {string} ['base-url'] - Site base URL override
 * @property {string} ['min-length'] - Minimum string length to flag
 * @property {string} ['force-keys'] - Comma-separated keys to force re-translate
 * @property {boolean} ['warn-only'] - Exit 0 even with issues
 */

// Empty export so modules can import types via:
//   /** @typedef {import('./types.js').PairConfig} PairConfig */
export {};
