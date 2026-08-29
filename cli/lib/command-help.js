/**
 * Per-command help text registry.
 *
 * Each command has a structured help entry with usage, description,
 * options, and examples. The CLI dispatcher routes `champollion <cmd> --help`
 * to display the relevant entry.
 *
 * WHY: The main `champollion help` screen is a dense overview of every command.
 * Users running `champollion sync --help` expect focused, detailed help for
 * that specific command, including all relevant flags and examples.
 */

import { DEFAULT_OPENROUTER_MODEL, DEFAULT_TEMPERATURE, DEFAULT_BATCH_SIZE } from './config.js';

const COMMAND_HELP = {
  init: {
    usage: 'champollion init [options]',
    description: [
      'Runs an interactive setup wizard to create champollion.config.json.',
      'Guides you through target languages, registers (tone/formality),',
      'translation method, and content directory.',
      'In non-interactive environments (CI/piped stdin), or with --yes,',
      'generates a default config without prompting. In interactive mode',
      'the same flags prefill the wizard, so each step is Enter to accept.',
    ],
    options: [
      ['--yes',             'Skip wizard, use defaults'],
      ['--force',           'Regenerate config even if one already exists (overwrites)'],
      ['--langs <codes>',   'Target languages, comma-separated (e.g., fr,de,ja); presets: european, asian, global, nordic'],
      ['--source <code>',   'Source locale (default: en)'],
      ['--dir <path>',      'Locales directory (default: ./locales)'],
      ['--method <name>',   'Translation method: llm, openai, anthropic, gemini, deepl, microsoft-translator, libretranslate, google-translate (default: llm = OpenRouter)'],
      ['--model <model>',   `Translation model (default: ${DEFAULT_OPENROUTER_MODEL})`],
      ['--temperature <n>', `Sampling temperature, 0.0-1.0 (default: ${DEFAULT_TEMPERATURE})`],
      ['--format <fmt>',    'File format: auto, json, toml, yaml (default: auto)'],
    ],
    examples: [
      'champollion init                        # Interactive wizard',
      'champollion init --langs fr,de,ja       # Wizard with prefilled targets',
      'champollion init --yes --langs fr,de,ja # Non-interactive, quick setup',
      'champollion init --yes --langs fr,de --method deepl --temperature 0.2',
      'champollion init --yes                  # Minimal config, auto-detect',
    ],
  },

  sync: {
    usage: 'champollion sync [options]',
    description: [
      'Translates and syncs all locale files based on the project config.',
      'Detects changed keys, batches them for translation, and writes',
      'the results back to each locale file. Also syncs Hugo Markdown',
      'content files when --content-dir is configured.',
    ],
    options: [
      ['--dry',               'Preview changes without writing files'],
      ['--list-keys',         'With --dry: name every queued key, grouped by reason (missing / fallback / unstamped echo / changed / forced)'],
      ['--pair <src:tgt>',    'Only sync the named pair(s), comma-separated (e.g. en:fr). Unknown pairs fail loud'],
      ['--force',             'Re-queue EVERY source key — whole-locale rebuild. Scope with --pair; add --no-tm to also bypass the cache. TM hits are still served (and gate-checked), so an intact cache makes this cheap'],
      ['--force-keys <keys>', 'Comma-separated dot-notation keys to force re-translate'],
      ['--force-content',     'Ignore the content lock and re-process every champollion-managed content file (hand-translated files are still preserved). Content cached in the Translation Memory comes back as free hits; text the TM has never seen is re-billed'],
      ['--model <model>',     'Override translation model for this run'],
      ['--config <path>',     'Path to config file'],
      ['--dir <path>',        'Override locales directory'],
      ['--content-dir <p>',   'Hugo content directory for Markdown translation'],
      ['--source <code>',     'Override source locale (default: en)'],
      ['--format <fmt>',      'Locale file format: json, toml, yaml, auto'],
      ['--method <method>',   'Translation method: llm, llm-coached, google-translate, api, deepl, microsoft-translator, libretranslate, openai, anthropic, gemini (default: from config)'],
      ['--temperature <n>',  `Sampling temperature for LLM methods (default: ${DEFAULT_TEMPERATURE})`],
      ['--batch-size <n>',    `Keys per translation API call (positive integer, default: ${DEFAULT_BATCH_SIZE})`],
      ['--max-cost <usd>',    'Abort before any API call if the pre-run cost estimate exceeds this USD cap (exit 2; unknown estimates abort too — unknown is not free)'],
      ['--no-verify',         'Skip post-sync verification pass'],
      ['--no-tm',             'Skip Translation Memory cache (force fresh API calls for all keys)'],
      ['--json',              'Machine-readable NDJSON output (one JSON object per line)'],
      ['--quiet, -q',         'Suppress informational messages; show only warnings and errors'],
    ],
    examples: [
      'champollion sync                          # Standard sync',
      'champollion sync --dry                    # Preview only',
      'champollion sync --pair en:fr             # Only the en:fr pair',
      'champollion sync --force-keys hero.title  # Re-translate specific keys',
      'champollion sync --pair "en:tlh" --force   # Rebuild one whole locale',
      'champollion sync --pair "en:tlh" --force --no-tm  # …bypassing a suspect cache',
      'champollion sync --content-dir ./content  # Include Hugo content',
      'champollion sync --max-cost 0.50          # Refuse to spend more than $0.50',
    ],
  },

  serve: {
    usage: 'champollion serve [options]',
    description: [
      'Serves this project\'s OWN configured translation stack (method,',
      'registers, coaching, Translation Memory, quality gate) over HTTP,',
      'speaking the same contract the `api` method consumes — so another',
      'champollion project can point `method: "api"` at it. Requests run',
      'through the exact pipeline `sync` uses: TM hits are served free from',
      'cache, and quality-gate failures return structured per-key errors,',
      'never silently degraded output.',
      '',
      'Binds to 127.0.0.1 by default: anyone who can reach the port can',
      'spend your upstream API budget, so exposing the server is an explicit',
      'decision (--bind 0.0.0.0) and requires a bearer token. --no-auth is',
      'only accepted together with a loopback bind.',
    ],
    options: [
      ['--port <n>',                'Listen port (default: 1822; 0 = random free port)'],
      ['--bind <addr>',             'Bind address (default: 127.0.0.1 — loopback only; --bind 0.0.0.0 exposes the server and requires a token)'],
      ['--token <secret>',          'Bearer token consumers must send (default: CHAMPOLLION_SERVE_TOKEN from env or .env.local; min 12 chars)'],
      ['--no-auth',                 'Disable auth — refused unless --bind is loopback (127.0.0.1/::1/localhost)'],
      ['--rate-limit <n>',          'Requests per minute per client IP (default: 120; 0 disables)'],
      ['--max-body-bytes <n>',      'Request body size cap in bytes (default: 1000000)'],
      ['--max-cost-per-request <usd>', 'Refuse any request whose estimated upstream cost exceeds this cap (unknown pricing refuses too — unknown is not free)'],
      ['--max-session-cost <usd>',  'Cumulative estimated-spend ceiling for this server process; requests past it are refused (402)'],
      ['--name <kebab-case>',       'Served method name (default: derived from the project directory, e.g. my-project-serve)'],
      ['--pair <src:tgt>',          'Serve only the named configured pair(s), comma-separated'],
      ['--emit-manifest',           'Write the method.json plugin manifest a consumer installs, then exit (no server)'],
      ['--endpoint <url>',          'Consumer-reachable endpoint URL for --emit-manifest (default: http://127.0.0.1:<port>/translate)'],
      ['--out <path>',              'Where --emit-manifest writes (default: ./<name>/method.json)'],
      ['--quiet, -q',               'Suppress informational messages'],
    ],
    examples: [
      'CHAMPOLLION_SERVE_TOKEN=$(openssl rand -hex 24) champollion serve',
      'champollion serve --token my-strong-secret --max-session-cost 5',
      'champollion serve --no-auth --bind 127.0.0.1     # local-only, no token',
      'champollion serve --emit-manifest --endpoint https://translate.example.org',
      'champollion serve --pair en:crk --max-cost-per-request 0.25',
    ],
  },

  watch: {
    usage: 'champollion watch [options]',
    description: [
      'Starts a file watcher that auto-syncs when the source locale',
      'file changes. Runs until manually stopped (Ctrl+C).',
    ],
    options: [
      ['--config <path>', 'Path to config file'],
      ['--dir <path>',    'Override locales directory'],
      ['--source <code>', 'Override source locale'],
    ],
    examples: [
      'champollion watch             # Watch and auto-sync on changes',
    ],
  },

  audit: {
    usage: 'champollion audit [options]',
    description: [
      'Lists all untranslated [EN] fallback values across locale files.',
      'Returns exit code 1 if any untranslated keys exist — usable as',
      'a CI gate to block deploys with missing translations.',
    ],
    options: [
      ['--config <path>', 'Path to config file'],
      ['--dir <path>',    'Override locales directory'],
      ['--source <code>', 'Override source locale'],
      ['--format <fmt>',  'Locale file format: json, toml, yaml, auto'],
      ['--json',          'Machine-readable NDJSON output (one JSON object per line; summary carries the untranslated key list)'],
    ],
    examples: [
      'champollion audit                         # List untranslated keys',
      'champollion audit && echo "All translated" # CI gate',
      'champollion audit --json | jq \'select(.level=="summary")\'',
    ],
  },

  card: {
    usage: 'champollion card <code> [options]',
    description: [
      'Pretty-prints a language card from the shared language-cards directory.',
      'Shows identification, classification, speaker estimates, typology,',
      'corpus availability, eval datasets, pipeline readiness, method support,',
      'and data sources in a color-formatted terminal layout.',
      '',
      'Resolves aliases automatically (e.g., "fr" → "fra", "es" → "spa").',
    ],
    options: [
      ['--json',  'Output the raw card JSON instead of the formatted display'],
    ],
    examples: [
      'champollion card crk           # Plains Cree',
      'champollion card spa           # Spanish',
      'champollion card cmn --json    # Raw JSON for Mandarin',
      'champollion card fr            # French (resolves alias)',
    ],
  },

  'register-corpus': {
    usage: 'champollion register-corpus [options]',
    description: [
      'Register a new evaluation corpus, choosing its license and exposure tier.',
      'You control the license and how far the corpus travels — three exposure',
      'tiers, defaulting to the most private:',
      '  local-only — never registered or uploaded; card + text stay on your machine.',
      '  private    — register METADATA ONLY (WMT-style sovereign held-out set);',
      '               your text is never uploaded or hosted; you keep custody.',
      '  public     — publish a metadata card + fetch-from-source pointer; text never',
      '               hosted by us, and gated to redistribution-cleared licenses.',
      '  sealed     — encrypt the corpus ON YOUR DEVICE under the custodian group’s',
      '               threshold key; we receive ciphertext + a content-free card only',
      '               and cannot decrypt it. Paired with a public qualifier a method',
      '               must clear before any sealed run can be proposed.',
      '',
      'Champollion never reads, uploads, or hosts your corpus plaintext in ANY tier.',
      'Interactive in a terminal; fully scriptable with flags (or --yes).',
    ],
    options: [
      ['--tier <tier>',        'local-only | private | public | sealed (default: local-only). Alias: --exposure'],
      ['--license <id>',       'License key / SPDX id / list number (see --list)'],
      ['--name <text>',        'Corpus name (required)'],
      ['--pair <src>tgt>',     'Language pair, e.g. eng>crk (or --source-lang/--target-lang)'],
      ['--size <n>',           'Number of sentence pairs (required)'],
      ['--domain <text>',      'Domain: news, conversational, educational, … (required)'],
      ['--contamination <l>',  'NONE | LOW | MEDIUM | HIGH (default: NONE private / LOW public)'],
      ['--publisher <text>',   'Publisher / your name or org'],
      ['--repo-url <url>',     'Public tier: fetch-from-source archive/repo URL'],
      ['--source-url <url>',   'Public tier: canonical project/dataset URL'],
      ['--builder <id>',       'Public tier: builder adapter id (rebuilds from source)'],
      ['--seal-input <path>',  'Sealed tier: local corpus file to encrypt on-device'],
      ['--threshold-pubkey <k>', 'Sealed tier: custodian threshold public key (path / PEM / base64 DER)'],
      ['--custodian-group <id>', 'Sealed tier: custodian group id that holds the key'],
      ['--seal-out <path>',    'Sealed tier: where to write the ciphertext artifact'],
      ['--qualifier-id <id>',  'Sealed tier: paired public qualifier card id (vYYYY)'],
      ['--qualifier-threshold <n>', 'Sealed tier: score a method must clear on the qualifier'],
      ['--id <id>',            'Override the generated card id (eval-…)'],
      ['--out <dir>',          'local-only: where to write the card (default: cwd)'],
      ['--list',               'Print the license + tier catalog (add --json for JSON)'],
      ['--json',               'Machine-readable output (for agents)'],
      ['--yes',                'Non-interactive; take values from flags'],
    ],
    examples: [
      'champollion register-corpus                       # interactive wizard',
      'champollion register-corpus --list                # see licenses + tiers',
      'champollion register-corpus --yes --name "My set" --pair "eng>crk" \\',
      '  --license cc-by-4.0 --tier local-only --size 200 --domain news',
      'champollion register-corpus --yes --name "Holdout" --pair "eng>crk" \\',
      '  --license cc-by-nc-4.0 --tier private --size 500 --domain educational',
      'champollion register-corpus --yes --name "Sealed" --pair "eng>crk" \\',
      '  --license proprietary --tier sealed --size 500 --domain educational \\',
      '  --seal-input ./secret.json --threshold-pubkey ./group.pub \\',
      '  --custodian-group nehiyawewin-trust --qualifier-id eval-eng-crk-…-qualifier-v2026',
    ],
  },

  'seal-corpus': {
    usage: 'champollion seal-corpus <keygen|seal|open|sign-keygen|sign|verify> [options]',
    description: [
      'The crypto verbs around the sealed exposure tier (lib/seal.mjs is the one',
      'cipher implementation: X25519-ECDH → HKDF-SHA256 → AES-256-GCM). Used by',
      'contest organizers and by the mt-eval organizer node, which shells out here',
      'rather than re-implementing the cipher.',
      '',
      '  keygen — generate a WAVE-1 STAND-IN threshold keypair. Honest label: a',
      '           SINGLE keypair, not the Wave-2 M-of-N group key; whoever holds',
      '           the private-key file can decrypt alone.',
      '  seal   — encrypt a corpus file on THIS machine; writes the ciphertext',
      '           artifact + the content-free card block. Plaintext never leaves.',
      '  open   — decrypt a sealed artifact (the controlled-eval-context verb;',
      '           the organizer node decrypts to scratch, scores, then wipes).',
      '  sign-keygen / sign / verify — Ed25519 score-bundle signing for the',
      '           Phase-B airgap transport (mt-eval node export-scores / relay).',
      '           Honest label: a SINGLE node signing key, not steward custody.',
    ],
    options: [
      ['--out <path>',           'keygen/sign-keygen: output dir; open: plaintext destination (scratch!)'],
      ['--seal-input <path>',    'seal: local corpus file to encrypt on-device'],
      ['--id <card-id>',         'seal: corpus card id (bound into the AAD)'],
      ['--custodian-group <id>', 'seal: opaque custodian group id (never a real org name pre-consent)'],
      ['--threshold-pubkey <k>', 'seal: recipient public key (file / PEM / base64 DER / keygen JSON)'],
      ['--seal-out <path>',      'seal: where to write the ciphertext artifact (off-git)'],
      ['--card-block-out <path>', 'seal: also write the content-free sealed card block JSON'],
      ['--qualifier-id <id>',    'seal: paired public qualifier card id (vYYYY)'],
      ['--qualifier-threshold <n>', 'seal: score a method must clear on the qualifier'],
      ['--key-scheme <label>',   'seal: custody label (default single-keypair-wave1 — honest)'],
      ['--artifact <path>',      'open: the sealed artifact JSON'],
      ['--privkey <k>',          'open/sign: private key (file / PEM / base64 DER / keygen JSON)'],
      ['--payload <path>',       'sign/verify: the exact bytes being signed / checked'],
      ['--sig-out <path>',       'sign: where to write the signature block JSON'],
      ['--sig <path>',           'verify: the signature block JSON'],
      ['--pubkey <k>',           'verify: Ed25519 public key (file / b64 / PEM)'],
    ],
    examples: [
      'champollion seal-corpus keygen --out ~/.contest-keys',
      'champollion seal-corpus seal --seal-input ./refs.json --id eval-eng-xxx-blindtest-v1 \\',
      '  --custodian-group org-a1b2 --threshold-pubkey ~/.contest-keys/threshold-….pub.json \\',
      '  --seal-out ~/contest/refs.sealed.json --card-block-out ~/contest/sealed-block.json',
      'champollion seal-corpus open --artifact ~/contest/refs.sealed.json \\',
      '  --privkey ~/.contest-keys/threshold-….key.json --out /tmp/scratch/refs.json',
      'champollion seal-corpus sign-keygen --out ~/.contest-keys',
      'champollion seal-corpus sign --payload score-bundle.json --privkey ~/.contest-keys/score-sign-….key.json',
      'champollion seal-corpus verify --payload score-bundle.json --sig score-bundle.json.sig.json \\',
      '  --pubkey ~/.contest-keys/score-sign-….pub.json',
    ],
  },

  submit: {
    usage: 'champollion submit [options]',
    description: [
      'Propose an entry for the Champollion index along a REVIEW-GATED path.',
      'Gathers the fields for a chosen submission type and prints a PRE-FILLED',
      'GitHub issue URL (optionally also writing a local submission JSON). The',
      'GitHub issue is the human-review queue: a maintainer reviews every',
      'submission against IP / license / sovereignty rules before adding it to a',
      'source-of-truth. Nothing is auto-approved; this never writes a registry or DB.',
      '',
      'Six submission types:',
      '  dataset         — a benchmark / corpus (metadata + fetch pointer only).',
      '  resource        — a dictionary / archive / app / FST / tool (a pointer, not a copy).',
      '  method          — a translation method / MT engine / LLM provider.',
      '  human-service   — an opt-in human translation provider (contact PII stays out-of-band).',
      '  external-result — a published result from another system/paper (cited, never re-hosted).',
      '  card-correction — a fix to a language card (cited; applied at the data source).',
      '',
      'Interactive in a terminal; fully scriptable with flags (or --yes).',
    ],
    options: [
      ['--type <key>',     'dataset | resource | method | human-service | external-result'],
      ['--values <json>',  'JSON object of field id -> value'],
      ['--field <id=val>', 'Set one field (repeatable): --field source-url=https://…'],
      ['--attest',         'Confirm the required compliance attestation (and consent)'],
      ['--consent',        'human-service: confirm the provider listing consent'],
      ['--out <path>',     'Also write a local content-free submission JSON'],
      ['--repo <url>',     'Override the GitHub repo for the issue URL (advanced/testing)'],
      ['--list',           'List the submission types (add --json for JSON)'],
      ['--json',           'Machine-readable output (for agents)'],
      ['--yes',            'Non-interactive; take values from flags'],
    ],
    examples: [
      'champollion submit                                # interactive wizard',
      'champollion submit --list                         # see the submission types',
      'champollion submit --yes --type dataset --attest \\',
      '  --field dataset-name="GlobalVoices eng-amh" --field pairs=eng-amh \\',
      '  --field license=CC-BY-4.0 --field source-url=https://globalvoices.org',
      'champollion submit --yes --type external-result --attest --out ./submission.json \\',
      '  --values \'{"system-name":"NLLB-200","pairs":"eng-crk","dataset":"FLORES-200","metric":"chrF++","score":"28.4","citation":"https://arxiv.org/abs/2207.04672"}\'',
    ],
  },

  lint: {
    usage: 'champollion lint [options]',
    description: [
      'Scans source files for hardcoded user-facing strings that should',
      'be wrapped in t() calls. Returns exit code 1 if issues found',
      '(unless --warn-only is set). Usable as a pre-commit hook.',
    ],
    options: [
      ['--src <path>',    'Source directory to scan (auto-detected by default)'],
      ['--min-length <n>','Minimum string length to flag (default: 2)'],
      ['--warn-only',     'Exit 0 even if issues found'],
      ['--json',          'Machine-readable JSON output (single document with findings)'],
      ['--config <path>', 'Path to config file'],
    ],
    examples: [
      'champollion lint                        # Scan for hardcoded strings',
      'champollion lint --warn-only            # Non-blocking scan',
      'champollion lint --src ./src --min-length 4',
      'champollion lint --json | jq .findings  # Structured findings',
    ],
  },

  wrap: {
    usage: 'champollion wrap [options]',
    description: [
      'Auto-wraps hardcoded strings in t() calls. Creates a backup',
      'before modifying files, with --undo support to restore.',
      '',
      'Safety gates: git-clean check, automatic backup, diff preview.',
    ],
    options: [
      ['--dry',           'Preview changes without writing files'],
      ['--undo',          'Restore files from .champollion-backup/'],
      ['--src <path>',    'Source directory to process'],
      ['--min-length <n>','Minimum string length to wrap (default: 2)'],
      ['--config <path>', 'Path to config file'],
    ],
    examples: [
      'champollion wrap                        # Auto-wrap with backup',
      'champollion wrap --dry                  # Preview wrapping changes',
      'champollion wrap --undo                 # Restore from backup',
    ],
  },

  seo: {
    usage: 'champollion seo <subcommand> [options]',
    description: [
      'Generates SEO artifacts for multilingual sites.',
    ],
    subcommands: [
      ['hreflang', 'Generate <link rel="alternate" hreflang> tags'],
      ['sitemap',  'Generate multilingual sitemap.xml'],
      ['jsonld',   'Generate JSON-LD WebSite language schema'],
    ],
    options: [
      ['--base-url <url>', 'Override site base URL (required for sitemap)'],
      ['--out <path>',     'Write output to file (sitemap only)'],
      ['--config <path>',  'Path to config file'],
    ],
    examples: [
      'champollion seo hreflang                         # Print hreflang tags',
      'champollion seo sitemap --base-url https://example.com --out sitemap.xml',
      'champollion seo jsonld --base-url https://example.com',
    ],
  },

  integrity: {
    usage: 'champollion integrity [options]',
    description: [
      'Audits locale files for structural issues:',
      '  - Missing or extra placeholders ({name}, {count}, etc.)',
      '  - HTML tag mismatches',
      '  - Encoding problems (mojibake, BOM issues)',
      '  - Key structure drift between locales',
      '  - ICU MessageFormat plural category completeness',
      '',
      'Returns exit code 1 if issues found (unless --warn-only).',
    ],
    options: [
      ['--warn-only',     'Exit 0 even if issues found'],
      ['--json',          'Machine-readable JSON output (single document, per-locale issue lists)'],
      ['--config <path>', 'Path to config file'],
      ['--dir <path>',    'Override locales directory'],
    ],
    examples: [
      'champollion integrity                   # Full integrity audit',
      'champollion integrity --warn-only       # Non-blocking audit',
      'champollion integrity --json | jq .totalIssues',
    ],
  },

  'repair-script': {
    usage: 'champollion repair-script [options]',
    description: [
      'Reverses script conversion that should never have happened.',
      '',
      'Before 0.3.0, locales with a script converter (tlh, x-elvish-s,',
      'x-kryptonian) were converted to Private Use Area codepoints',
      'unconditionally — text that renders as nothing without a purpose-built',
      'font. This command scans locales whose configuration says conversion',
      'is OFF, and restores any PUA values to the working script',
      '(romanization) using the converter\'s own reverse table.',
      '',
      'Values without PUA are never touched. The Translation Memory and hash',
      'manifest need no repair (the TM stores pre-conversion values). Locales',
      'with conversion enabled ("script": "Piqd") are skipped — there the PUA',
      'is the configured output.',
      '',
      'pIqaD reverses exactly. Tengwar and Kryptonian reversals cannot',
      'recover capitalisation (the converters normalise case) — flagged',
      'per file as case-lossy for review.',
      '',
      'Exit 1 when PUA remains that no registered converter can reverse.',
    ],
    options: [
      ['--dry',           'Preview repairs without writing'],
      ['--locale <code>', 'Repair only one locale'],
      ['--json',          'Machine-readable JSON output (single document)'],
      ['--warn-only',     'Exit 0 even if unreversible PUA remains'],
      ['--config <path>', 'Path to config file'],
      ['--dir <path>',    'Override locales directory'],
    ],
    examples: [
      'champollion repair-script --dry         # Preview what would be restored',
      'champollion repair-script               # Restore romanization in place',
      'champollion repair-script --locale tlh  # One locale only',
    ],
  },

  status: {
    usage: 'champollion status [options]',
    description: [
      'Shows the project configuration summary:',
      '  - Resolved pair graph with methods and models',
      '  - Installed plugins with versions and benchmarks',
      '  - Translation cost estimates per pair',
      '  - Format and directory information',
    ],
    options: [
      ['--config <path>', 'Path to config file'],
      ['--dir <path>',    'Override locales directory'],
      ['--json',          'Machine-readable JSON output (single document)'],
    ],
    examples: [
      'champollion status                      # Full project summary',
      'champollion status --json | jq .pairs   # Structured pair graph',
    ],
  },

  provenance: {
    usage: 'champollion provenance [options]',
    description: [
      'Shows licensing and resource dependencies for all translation pairs.',
      'Flags methods using non-commercial resources (PROPRIETARY datasets,',
      'FST grammars, etc.) so you can verify compliance before shipping.',
    ],
    options: [
      ['--config <path>', 'Path to config file'],
    ],
    examples: [
      'champollion provenance                  # Show all pair provenance',
    ],
  },

  plugin: {
    usage: 'champollion plugin <subcommand> [options]',
    description: [
      'Manages method plugins — installable translation strategies',
      'that bundle model config, coaching data, and benchmarks.',
    ],
    subcommands: [
      ['list',              'List installed plugins with metadata'],
      ['install <path>',    'Install a plugin from a local directory'],
      ['remove <name>',     'Remove an installed plugin'],
    ],
    options: [],
    examples: [
      'champollion plugin list                          # List plugins',
      'champollion plugin install ./french-formal-v1/   # Install from dir',
      'champollion plugin remove french-formal-v1       # Remove plugin',
    ],
  },

  fonts: {
    usage: 'champollion fonts <subcommand> [options]',
    description: [
      'Downloads and manages PUA web fonts for constructed language',
      'script converters. Klingon (pIqaD), Sindarin (Tengwar), and',
      'Kryptonian output Private Use Area characters that need custom',
      'fonts to render. This command downloads them from verified',
      'open-source repositories with license attribution.',
      '',
      'Native Unicode converters (crk → Cree Syllabics, sr → Cyrillic)',
      'do NOT need fonts installed — they use standard Unicode.',
    ],
    subcommands: [
      ['list',    'Show which PUA fonts are needed and their install status'],
      ['install', 'Download fonts for configured languages'],
    ],
    options: [
      ['--dir <path>',    'Override font output directory (auto-detected by default)'],
      ['--css',           'Also generate a CSS snippet file with @font-face declarations'],
      ['--config <path>', 'Path to config file (used to detect which languages need fonts)'],
    ],
    examples: [
      'champollion fonts list                           # Show needed fonts',
      'champollion fonts install                        # Download all needed fonts',
      'champollion fonts install --css                  # Also generate CSS snippet',
      'champollion fonts install --dir ./public/fonts   # Custom output directory',
    ],
  },

  tm: {
    usage: 'champollion tm <subcommand> [options]',
    description: [
      'Manages the Translation Memory cache (.champollion/tm.json).',
      'TM stores previous translations keyed by source text + locale + method.',
      'On subsequent syncs, unchanged source values are served from cache',
      'instead of calling the translation API — saving tokens and time.',
    ],
    subcommands: [
      ['stats',  'Show entry count, file size, and per-locale breakdown'],
      ['clear',  'Delete TM cache (--locale for per-locale, --yes to skip prompt)'],
      ['seed',   'Back-fill the TM from existing translated content files (lock-gated; protects against a lost .champollion-content.lock)'],
      ['prune',  'Remove legacy entries missing locale/method metadata (and, with --older-than, stale ones); dry report unless --yes'],
    ],
    options: [
      ['--locale <code>',     'Clear/seed only entries for a specific locale'],
      ['--yes',               'Skip confirmation prompt (clear); actually delete (prune)'],
      ['--dry, --dry-run',    'Show what seed would store without writing (seed)'],
      ['--older-than <days>', 'Also prune entries older than N days (prune)'],
      ['--json',              'Machine-readable JSON output, single document (stats, seed, prune)'],
    ],
    examples: [
      'champollion tm stats                  # Show cache statistics',
      'champollion tm clear                  # Clear with confirmation',
      'champollion tm clear --yes            # Clear without confirmation',
      'champollion tm clear --locale fr      # Clear only French entries',
      'champollion tm seed --dry-run         # Preview what would be seeded',
      'champollion tm seed                   # Seed TM from existing translations',
      'champollion tm prune                  # Dry report of prunable entries',
      'champollion tm prune --older-than 90 --yes  # Delete legacy + >90-day entries',
    ],
  },

  xliff: {
    usage: 'champollion xliff <subcommand> [options]',
    description: [
      'Exports and imports XLIFF 1.2 files for professional translator review.',
      'XLIFF is the industry-standard exchange format for CAT tools like',
      'memoQ, SDL Trados, and Phrase.',
    ],
    subcommands: [
      ['export',             'Generate .xliff from source + target locale files'],
      ['import <file>',      'Merge reviewed .xliff translations into locale files (JSON, TOML, or YAML — written back in the project format)'],
    ],
    options: [
      ['--locale <code>', 'Target locale for export (required)'],
      ['--out <path>',    'Custom output path or directory (export)'],
      ['--dry',           'Preview import without writing (import)'],
      ['--json',          'Machine-readable JSON output (single document)'],
      ['--config <path>', 'Path to config file'],
    ],
    examples: [
      'champollion xliff export --locale fr                   # Export French XLIFF',
      'champollion xliff export --locale ja --out ./review/   # Custom output dir',
      'champollion xliff import .champollion/xliff/fr.xliff       # Import reviewed file',
      'champollion xliff import ./reviewed.xliff --dry        # Preview import',
    ],
  },

  models: {
    usage: 'champollion models --method <provider>',
    description: [
      'Lists available models from a translation provider\'s API.',
      'Queries the provider\'s live model endpoint and displays all',
      'models you can use. Read-only — does not modify config.',
    ],
    options: [
      ['--method <name>', 'Provider to query: gemini, openai, or anthropic (required)'],
      ['--json',          'Machine-readable JSON output (single document)'],
    ],
    examples: [
      'champollion models --method gemini      # List Gemini models',
      'champollion models --method openai      # List OpenAI models',
      'champollion models --method anthropic   # List Anthropic models',
      'champollion models --method gemini --json | jq .models',
    ],
  },

  verify: {
    usage: 'champollion verify [options]',
    description: [
      'Re-reads all locale files from disk and verifies translations are',
      'actually present and correct. Catches the gap between sync reporting',
      'success and keys being wrong in fact.',
      '',
      'Checks: key parity, [EN] fallback markers, empty values, script',
      'compliance, placeholder preservation, encoding issues, source echoes.',
      '',
      'Exits with code 1 if errors found — use as a CI gate.',
      'This is the same verification that runs automatically after sync.',
    ],
    options: [
      ['--warn-only',     'Exit 0 even if errors found'],
      ['--config <path>', 'Path to config file'],
      ['--dir <path>',    'Override locales directory'],
      ['--source <code>', 'Override source locale'],
    ],
    examples: [
      'champollion verify                        # Verify all locale files',
      'champollion verify --warn-only            # Non-blocking verification',
      'champollion verify && echo "All good"     # CI gate',
    ],
  },

  leaderboard: {
    usage: 'champollion leaderboard [options]',
    description: [
      'Fetches and displays MT evaluation leaderboard data from Supabase.',
      'Shows ranked results with composite scores, quality tiers, and metrics.',
      'Supports filtering by language pair, sorting by any metric, and',
      'NDJSON output for CI/CD integration.',
    ],
    options: [
      ['--pair <pair>',  'Filter by language pair (e.g., en>crk)'],
      ['--sort <key>',   'Sort by metric: composite (default), chrf, exact, fst, equivalent, semantic, cost, date'],
      ['--top <n>',      'Show only the top N results'],
      ['--json',         'Machine-readable NDJSON output (one JSON object per line)'],
    ],
    examples: [
      'champollion leaderboard                        # All results, sorted by composite',
      'champollion leaderboard --pair "en>crk"         # Filter to English→Cree (quote the >)',
      'champollion leaderboard --sort chrf --top 10    # Top 10 by chrF++',
      'champollion leaderboard --json | jq .composite  # Pipe to jq for processing',
    ],
  },

  recommend: {
    usage: 'champollion recommend <src> <tgt> [options]',
    description: [
      'Method guidance for one source→target pair (ISO 639-3 codes): every',
      'dispatchable engine with its live availability (API key present?',
      'license lane?), the published evidence indexed for the pair (cited,',
      'never reproduced by us; relative-comparison-only), and which evidenced',
      'models are actually runnable here.',
      '',
      'Honest by construction: no evidence means it says so and points at',
      'runnable corpora instead of guessing. The commercial lane is STRICT —',
      'methods without a commercial-ready license (e.g. AGPL/GPL engines) are',
      'excluded with reasons, never silently dropped.',
    ],
    options: [
      ['--use <lane>', 'License lane: non-commercial (default) or commercial (STRICT)'],
      ['--json',       'Machine-readable payload (mirrors `mt-eval recommend --json`)'],
    ],
    examples: [
      'champollion recommend eng yor                    # Guidance for English→Yoruba',
      'champollion recommend eng yor --use commercial   # Commercial lane (AGPL excluded)',
      'champollion recommend eng quy --json | jq .notes # Honest no-evidence state',
    ],
  },

  doctor: {
    usage: 'champollion doctor [subcommand] [options]',
    description: [
      'Comprehensive system health check for Champollion installations.',
      'Validates language cards, project config, FST installations,',
      'API key configuration, and method dependencies.',
      '',
      'Runs all checks by default. Use subcommands for targeted diagnostics.',
    ],
    subcommands: [
      ['cards',         'Verify language cards load correctly, report coverage stats'],
      ['config',        'Validate project config file and language code resolution'],
      ['fst [code]',    'Check FST installation (all or specific language)'],
      ['methods',       'Check API keys, server reachability, Python packages'],
    ],
    options: [
      ['--json', 'Machine-readable JSON output (single document with all check results)'],
    ],
    examples: [
      'champollion doctor                  # Full system health check',
      'champollion doctor cards            # Language card diagnostics',
      'champollion doctor config           # Config validation',
      'champollion doctor fst crk          # Check Plains Cree FST',
      'champollion doctor methods          # Check API keys and deps',
      'champollion doctor --json | jq .failed',
    ],
  },
};

/**
 * Format and print help for a specific command.
 *
 * @param {string} commandName - The command to show help for
 * @returns {boolean} true if help was displayed, false if command not found
 */
function showCommandHelp(commandName) {
  const help = COMMAND_HELP[commandName];
  if (!help) return false;

  console.log('');
  console.log(`  champollion ${commandName} — ${help.description[0]}`);
  console.log('');

  // Usage
  console.log('  USAGE');
  console.log(`    ${help.usage}`);
  console.log('');

  // Description
  if (help.description.length > 1) {
    console.log('  DESCRIPTION');
    for (const line of help.description) {
      console.log(`    ${line}`);
    }
    console.log('');
  }

  // Subcommands (for plugin, seo)
  if (help.subcommands && help.subcommands.length > 0) {
    console.log('  SUBCOMMANDS');
    const maxLen = Math.max(...help.subcommands.map(([name]) => name.length));
    for (const [name, desc] of help.subcommands) {
      console.log(`    ${name.padEnd(maxLen + 2)} ${desc}`);
    }
    console.log('');
  }

  // Options
  if (help.options && help.options.length > 0) {
    console.log('  OPTIONS');
    const maxLen = Math.max(...help.options.map(([flag]) => flag.length));
    for (const [flag, desc] of help.options) {
      console.log(`    ${flag.padEnd(maxLen + 2)} ${desc}`);
    }
    console.log('');
  }

  // Examples
  if (help.examples && help.examples.length > 0) {
    console.log('  EXAMPLES');
    for (const example of help.examples) {
      console.log(`    ${example}`);
    }
    console.log('');
  }

  return true;
}

export { COMMAND_HELP, showCommandHelp };
