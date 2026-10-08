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
import { LOCALE_FILE_FORMATS } from './format.js';

// The --format values a config accepts — the reader's own list, so the help
// can never fall behind a format the CLI learns (lib/format.js).
const FORMAT_CHOICES = ['auto', ...LOCALE_FILE_FORMATS].join(', ');

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
      'Finds your locale files first: Flutter lib/l10n/app_<lang>.arb (or',
      'the arb-dir/template-arb-file in l10n.yaml), gettext catalogs',
      '(Django locale/<lang>/LC_MESSAGES/<domain>.po, Babel translations/,',
      'GNU po/), next-intl messages/, i18next public/locales/<lang>/ (one',
      'folder per language), vue-i18n src/locales/, Hugo i18n/, then common',
      'folders. --langs also creates the empty target files in that layout.',
    ],
    options: [
      ['--yes',             'Skip wizard, use defaults'],
      ['--force',           'Re-run over an existing config: rewrites only what the flags name (and re-detects the locale layout when the config no longer finds the source files); every other setting is kept. Prints what changed, and backs the file up first (champollion.config.json.bak; an older backup is never overwritten — .bak.2, .bak.3 …). To change one setting, edit it in the file instead'],
      ['--langs <codes>',   'Target languages, comma-separated (e.g., fr,de,ja); presets: european, asian, global, nordic'],
      ['--script <choice>', 'Writing system for a language with more than one real orthography (Plains Cree: Latn = SRO, Cans = Syllabics; Serbian: Latn, Cyrl): crk=Cans, or several as crk=Cans,sr=Latn. Without it init says which languages need a choice'],
      ['--name <code=name>', 'Display name for a language with no card — a private-use code (qaa–qtz) for a variety not yet confirmed: qaa="Ayta (variety not yet confirmed)"; several separated by ";". Written as "languages": { "qaa": { "name": … } }; it is what the model is told'],
      ['--source <code>',   'Source locale (default: en)'],
      ['--dir <path>',      'Locales directory (default: detected from your project, else ./locales)'],
      ['--content-dir <dir>', 'A folder of Markdown/MDX files to translate too (writes "contentDir"; the folder must exist)'],
      ['--method <name>',   'Translation method: llm, openai, anthropic, gemini, local (your own model: Ollama/vLLM/LM Studio/nmt-forge), deepl, microsoft-translator, libretranslate, google-translate, api (a champollion API endpoint — needs --endpoint) (default: llm = OpenRouter; local when a file in the project is marked local-only — a <file>.champollion.json sidecar with "transmission": "local-only")'],
      ['--endpoint <url>',  'With --method api: the endpoint URL (e.g. http://127.0.0.1:8378/translate from `nmt-forge serve`). Writes one "pairs" entry per target, as the model\'s DEPLOY.md shows'],
      ['--accepts-instructions <true|false>', 'With --method api: whether the endpoint follows per-key instructions (a model trained with nmt-forge does not: false). Default: what an installed plugin manifest for that endpoint says, else not stated'],
      ['--model <model>',   `Translation model (default: ${DEFAULT_OPENROUTER_MODEL})`],
      ['--temperature <n>', `Sampling temperature, 0.0-1.0 (default: ${DEFAULT_TEMPERATURE})`],
      ['--format <fmt>',    `File format: ${FORMAT_CHOICES} (default: auto — detected from the file extension)`],
    ],
    examples: [
      'champollion init                        # Interactive wizard',
      'champollion init --langs fr,de,ja       # Wizard with prefilled targets',
      'champollion init --yes --langs fr,de,ja # Non-interactive, quick setup',
      'champollion init --yes --langs fr,de --method deepl --temperature 0.2',
      'champollion init --yes --langs fr,de --method local --model llama3.1  # a model on this machine (Ollama, LM Studio…), no key',
      'champollion init --yes --langs abc --method api --endpoint http://127.0.0.1:8378/translate --accepts-instructions false  # nmt-forge serve',
      'champollion init --yes --langs crk --script crk=Latn   # Plains Cree in SRO (Cans = Syllabics)',
      'champollion init --yes --langs qaa --name qaa="Ayta (variety not yet confirmed)"  # a variety with no confirmed code',
      'champollion init --yes                  # Minimal config, auto-detect',
      'champollion init --force --langs fr,de,es   # Over an existing config: the target list changes, every other setting stays',
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
      ['--redo <scope>',      'Translate again: all | keys:<k1,k2> | content | files:<glob> | gaps (repeatable). Anything the cache already holds is served free (and gate-checked), so a redo is cheap. all and content keep text a person edited (and say how much); keys:<k> and files:<glob> replace it — the key/file was named. gaps: every plural message on disk without a form its language uses for ordinary counts (the "other" form standing in, marked "# champollion:" in a catalog) — asked from the model, not the cache. A gettext context key can be typed as ctx\\x04msgid (or ctx␄msgid, as reports print it)'],
      ['--fresh',             'Do not use the cache for what is queued — it is paid for again. With --redo files:<glob>, the files are re-translated from scratch (lock, keep-hand-translated rule and cache all bypassed)'],
      ['--force',             'Same as --redo all: re-queue EVERY source key — whole-locale rebuild; values a person edited are kept (sync names them). Scope with --pair; add --fresh (or --no-tm) to also bypass the cache'],
      ['--force-keys <keys>', 'Same as --redo keys:<keys>: comma-separated keys to translate again — replaced even when a person edited them (the edited wording is printed and kept in .champollion-replaced-edits.jsonl). `\\,` = a comma inside a key; a gettext context key: ctx\\x04msgid'],
      ['--force-content',     'Same as --redo content: ignore the content lock and re-process every champollion-managed content file (hand-translated files are still preserved). Cached content is served free; text the TM has never seen is billed'],
      ['--files <glob>',      'Only these content files this run (repeatable; paths as sync prints them, e.g. "docs/intro.md", "posts/**")'],
      ['--retranslate <glob>', 'Same as --redo files:<glob> --fresh. Translate these content files fresh — bypasses the lock and the cache, so it is billed, and replaces paragraphs a person edited in them (said first; like --redo files:<glob>, a named file is replaced — every other redo keeps edits) (repeatable)'],
      ['--model <model>',     'Translation model for this run only — champollion.config.json is not changed, and a plain sync uses its "model" again. To switch for good, edit "model" there'],
      ['--config <path>',     'Path to config file'],
      ['--dir <path>',        'Override locales directory'],
      ['--content-dir <p>',   'Folder of Markdown/MDX to translate (Hugo content/ or any folder)'],
      ['--source <code>',     'Override source locale (default: en)'],
      ['--format <fmt>',      `Locale file format: ${FORMAT_CHOICES} (po = gettext, arb = Flutter)`],
      ['--method <method>',   'Translation method: llm, llm-coached, local (your own model: Ollama/vLLM/LM Studio/forge), openai, anthropic, gemini, google-translate, deepl, microsoft-translator, libretranslate, api. Overrides the config for this run only — including a pair\'s own method (sync names the pairs); scope with --pair. To switch for good, edit "defaultMethod" (or the pair\'s "method") in champollion.config.json'],
      ['--temperature <n>',  `Sampling temperature for LLM methods (default: ${DEFAULT_TEMPERATURE})`],
      ['--batch-size <n>',    `Keys per translation API call (positive integer, default: ${DEFAULT_BATCH_SIZE})`],
      ['--max-cost <usd>',    'Abort before any API call if the pre-run cost estimate exceeds this USD cap (exit 2; unknown estimates abort too — unknown is not free). With --dry: says whether the real run would stop there'],
      ['--show-prompt [key]', 'With --dry: print the exact request the method would be sent (system/user messages or request body, keys redacted) — for one key, or the first batch each file would send. Shows whether a gettext msgctxt or #. comment reaches the model'],
      ['--no-verify',         'Skip post-sync verification pass'],
      ['--no-tm',             'Same as --fresh: skip the Translation Memory cache (fresh API calls for everything queued)'],
      ['--fresh-on-model-change', 'Don\'t reuse the previous model\'s cached translations for what this run translates (default: reuse them, at no cost). On its own it affects only new or changed keys; to have the new model translate what an earlier model wrote: --redo all --fresh-on-model-change'],
      ['--prune plural-extras', 'Remove i18next plural keys for a form the language does not have (Spanish count_two from a source with count_one/count_other) — CLDR says which. Lists each key it removes and touches nothing else; never without this flag. With --dry: says what it would remove'],
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
      'champollion sync --content-dir ./newsletters  # Include a folder of Markdown',
      'champollion sync --max-cost 0.50          # Refuse to spend more than $0.50',
      'champollion sync --redo gaps              # Ask again for plural forms a model left out',
      'champollion sync --prune plural-extras    # Remove plural keys for forms a language does not have',
      'champollion sync --dry --show-prompt \'verb␄Open\'   # The request for one gettext entry (context included), not sent',
    ],
  },

  serve: {
    summary: "Serves this project's own translation stack over HTTP, for another project's `api` method.",
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
    summary: 'Lists what is not translated, or out of date, across locale files — with the command that fixes it.',
    usage: 'champollion audit [options]',
    description: [
      'Lists what is not translated across locale files — keys missing,',
      'empty, or still an [EN] fallback — and translations that are OUT OF',
      'DATE: made from an older source text than the current one (the record',
      'in .champollion.lock), with the command that re-translates them.',
      'Returns exit code 1 if any exist — usable as a CI gate to block',
      'deploys with missing or stale translations.',
    ],
    options: [
      ['--config <path>', 'Path to config file'],
      ['--dir <path>',    'Override locales directory'],
      ['--source <code>', 'Override source locale'],
      ['--format <fmt>',  'Locale file format: json, toml, yaml, auto'],
      ['--json',          'Machine-readable NDJSON output (one JSON object per line; summary carries the untranslated and out-of-date key lists)'],
    ],
    examples: [
      'champollion audit                         # List untranslated keys',
      'champollion audit && echo "All translated" # CI gate',
      'champollion audit --json | jq \'select(.level=="summary")\'',
    ],
  },

  network: {
    usage: 'champollion network <command> [options]',
    description: [
      'Commands for the shared index and leaderboard, not your project.',
      'Each also works without the "network" prefix.',
      '',
      '  card <code>        What the index knows about a language, every value cited',
      '  recommend <s> <t>  Methods you can run for a pair, and the evidence for each',
      '  leaderboard        Published results (--pair, --sort, --json)',
      '  register-corpus    Register a test set without handing it over',
      '  seal-corpus        Sealed-tier crypto: keygen / seal / open',
      '  submit             Propose an index entry (review-gated)',
      '',
      'A language pair is written source>target: "eng>crk" (quote it — an unquoted >',
      'sends the output to a file). The commands that take a pair also read eng-crk',
      'and eng:crk; a code with its own hyphen (pt-BR) needs >: "eng>pt-BR".',
    ],
    options: [],
    examples: [
      'champollion network card crk',
      'champollion network recommend eng crk',
      'champollion network recommend eng-crk                # the same pair, as one value',
      'champollion network leaderboard --pair "eng>crk"',
      'champollion network register-corpus --data data/test.tsv --name "Ward phrases" --pair "eng>xyz" --license proprietary --tier local-only --domain medical',
    ],
  },

  card: {
    usage: 'champollion network card <code> [options]',
    description: [
      'Pretty-prints a language card from the shared language-cards directory.',
      'Shows identification, classification, speaker estimates, endangerment,',
      'typology, corpus availability, language resources, eval datasets,',
      'pipeline readiness, method support, and data sources in a',
      'color-formatted terminal layout.',
      '',
      'Where sources disagree (names, families, speaker counts, endangerment, …)',
      'every value is printed with its source and none is elected. A section',
      'the card has nothing for says "not recorded on this card": absence is',
      'unknown, not "none".',
      '',
      'Resolves aliases automatically (e.g., "fr" → "fra", "es" → "spa").',
    ],
    options: [
      ['--json',  'Output the raw card JSON instead of the formatted display'],
    ],
    examples: [
      'champollion network card crk           # Plains Cree',
      'champollion network card spa           # Spanish',
      'champollion network card cmn --json    # Raw JSON for Mandarin',
      'champollion network card fr            # French (resolves alias)',
    ],
  },

  'register-corpus': {
    usage: 'champollion network register-corpus [options]',
    description: [
      'Register a new evaluation corpus, choosing its license and exposure tier.',
      'You control the license and how far the corpus travels — four exposure',
      'tiers, defaulting to the most private:',
      '  local-only — never registered or uploaded; card + text stay on your machine.',
      '  private    — register METADATA ONLY (WMT-style sovereign held-out set);',
      '               your text is never uploaded or hosted; you keep custody.',
      '  public     — publish a metadata card + fetch-from-source pointer; text never',
      '               hosted by us, and gated to redistribution-cleared licenses.',
      '  sealed     — encrypt the corpus ON YOUR DEVICE to the custodian group’s',
      '               key; the ciphertext stays with you and we receive only a',
      '               content-free card. Paired with a public qualifier a method',
      '               must clear before any sealed run can be proposed.',
      '',
      'Champollion never uploads or hosts your corpus text, in any tier. A file you',
      'name is read on this machine only: --data to count its entries and checksum',
      'it, --seal-input to encrypt it. None of it is sent anywhere.',
      'Interactive in a terminal; fully scriptable with flags (or --yes).',
      '',
      'A test set a model may be trained against (--role test, or a local-only or',
      'private set with no role stated): the command prints the nmt-forge steps —',
      'register it, screen the training corpus, write down predictions — that must',
      'come before its first score, then the baseline run.',
      '',
      'Card id: eval-<src>-<tgt>-<name>[-<role>]-v1, e.g. --name "Ward phrases"',
      '--pair "eng>xyz" --role test  →  eval-eng-xyz-ward-phrases-test-v1.',
      'The name part comes from --name (from --publisher only when the name has no',
      'a-z/0-9 letters). The role part appears only when you pass --role; no role is',
      'ever guessed. A file registered with --data keeps the id it was registered',
      'under: re-running asks you to pass it with --id.',
    ],
    options: [
      ['--tier <tier>',        'local-only | private | public | sealed (default: local-only). Alias: --exposure'],
      ['--license <id>',       'License key / SPDX id / list number (see --list)'],
      ['--name <text>',        'Corpus name (required; also names the card id)'],
      ['--role <role>',        'What the set is for: test | dev | train. Goes into the id; left out, the id names no role'],
      // The pair text is lib/language-pair.js's PAIR_NOTATION_HELP (a test holds them equal).
      ['--pair <pair>',        'Language pair, source>target, e.g. "eng>crk" (quote it: an unquoted > sends the output to a file). eng-crk, eng:crk and "eng crk" are read the same way; a code with its own hyphen (pt-BR) needs >, e.g. "eng>pt-BR". Or --source-lang/--target-lang'],
      ['--data <file>',        'The local test-set file (TSV/JSONL/JSON): read on this machine only to count and checksum it, never uploaded; writes <file>.champollion.json so mt-eval run applies the licence (local-only: remote models refused)'],
      ['--size <n>',           'Number of sentence pairs (required unless --data)'],
      ['--domain <text>',      'Domain: news, conversational, educational, … (required)'],
      ['--contamination <l>',  'NONE | LOW | MEDIUM | HIGH. Default: LOW for public, NONE otherwise — UNCHECKED when a --data or --seal-input file could not be compared with the public corpora (a copy of a public corpus is never graded NONE)'],
      ['--publisher <text>',   'Publisher / your name or org'],
      ['--description <text>', 'One-line description'],
      ['--repo-url <url>',     'Public tier: fetch-from-source archive/repo URL'],
      ['--source-url <url>',   'Public tier: canonical project/dataset URL'],
      ['--builder <id>',       'Public tier: builder adapter id (rebuilds from source)'],
      ['--seal-input <path>',  'Sealed tier: local corpus file to encrypt on-device'],
      ['--threshold-pubkey <k>', 'Sealed tier: custodian threshold public key (path / PEM / base64 DER)'],
      ['--custodian-group <id>', 'Sealed tier: custodian group id that holds the key'],
      ['--seal-out <path>',    'Sealed tier: where to write the ciphertext artifact'],
      ['--qualifier-id <id>',  'Sealed tier: paired public qualifier card id (vYYYY)'],
      ['--qualifier-threshold <n>', 'Sealed tier: score a method must clear on the qualifier'],
      ['--key-scheme <s>',     'Sealed tier: custody scheme label (default: TSS-3-of-5)'],
      ['--id <id>',            'Set the card id yourself (eval-…/ref-…, used as given; other text replaces the name part)'],
      ['--out <dir>',          'Where to write the card (default: next to --data, else cwd)'],
      ['--list',               'Print the license + tier catalog (add --json for JSON)'],
      ['--json',               'Machine-readable output (for agents)'],
      ['--yes',                'Non-interactive; take values from flags'],
    ],
    examples: [
      'champollion network register-corpus                       # interactive wizard',
      'champollion network register-corpus --list                # see licenses + tiers',
      'champollion network register-corpus --yes --name "My set" --pair "eng>crk" \\',
      '  --license cc-by-4.0 --tier local-only --size 200 --domain news',
      'champollion network register-corpus --yes --name "Holdout" --pair "eng>crk" \\',
      '  --license cc-by-nc-4.0 --tier private --role test --size 500 --domain educational',
      'champollion network register-corpus --yes --name "Tatoeba eng-crk" --pair eng-crk \\',
      '  --license cc-by-4.0 --tier public --size 1000 --domain conversational \\',
      '  --repo-url https://example.org/data.tar --builder tatoeba-challenge',
      'champollion network register-corpus --yes --name "Sealed" --pair "eng>crk" \\',
      '  --license proprietary --tier sealed --size 500 --domain educational \\',
      '  --seal-input ./secret.json --threshold-pubkey ./group.pub \\',
      '  --custodian-group example-community-trust --qualifier-id eval-eng-crk-…-qualifier-v2026',
    ],
  },

  'seal-corpus': {
    summary: 'Encrypts, decrypts and signs corpora for the sealed exposure tier (keygen, seal, open, sign, verify).',
    usage: 'champollion network seal-corpus <keygen|seal|open|sign-keygen|sign|verify> [options]',
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
      'champollion network seal-corpus keygen --out ~/.contest-keys',
      'champollion network seal-corpus seal --seal-input ./refs.json --id eval-eng-xxx-blindtest-v1 \\',
      '  --custodian-group org-a1b2 --threshold-pubkey ~/.contest-keys/threshold-….pub.json \\',
      '  --seal-out ~/contest/refs.sealed.json --card-block-out ~/contest/sealed-block.json',
      'champollion network seal-corpus open --artifact ~/contest/refs.sealed.json \\',
      '  --privkey ~/.contest-keys/threshold-….key.json --out /tmp/scratch/refs.json',
      'champollion network seal-corpus sign-keygen --out ~/.contest-keys',
      'champollion network seal-corpus sign --payload score-bundle.json --privkey ~/.contest-keys/score-sign-….key.json',
      'champollion network seal-corpus verify --payload score-bundle.json --sig score-bundle.json.sig.json \\',
      '  --pubkey ~/.contest-keys/score-sign-….pub.json',
    ],
  },

  submit: {
    usage: 'champollion network submit [options]',
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
      'A "pairs" field takes one language pair per line, source>target ("eng>crk";',
      'eng-crk and eng:crk work too). The issue carries each one as eng>crk.',
      '',
      'Interactive in a terminal; fully scriptable with flags (or --yes).',
    ],
    options: [
      ['--type <key>',     'dataset | resource | method | human-service | external-result | card-correction'],
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
      'champollion network submit                                # interactive wizard',
      'champollion network submit --list                         # see the submission types',
      'champollion network submit --yes --type dataset --attest \\',
      '  --field dataset-name="GlobalVoices eng-amh" --field pairs=eng-amh \\',
      '  --field license=CC-BY-4.0 --field source-url=https://globalvoices.org',
      'champollion network submit --yes --type external-result --attest --out ./submission.json \\',
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
      ['--ignore <names>', 'Comma-separated directory/file names to skip (adds to config lint.ignore)'],
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
    summary: 'Audits locale files for structural issues.',
    usage: 'champollion integrity [options]',
    description: [
      'Audits locale files for structural issues:',
      '  - Missing or extra placeholders ({name}, {count}, etc.)',
      '  - HTML tag mismatches',
      '  - Encoding problems (mojibake, BOM issues)',
      '  - Key structure drift between locales',
      '  - ICU MessageFormat plural category completeness',
      '  - ICU MessageFormat structure damage (translated keywords, variables,',
      '    selectors; lost # or printf placeholders)',
      '  - Flutter .arb file damage (@@locale, placeholder metadata)',
      '',
      'A damaged value the Translation Memory produced is removed from the',
      'cache, so `sync --force-keys <key>` translates it again.',
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
    summary: 'Shows the project configuration summary.',
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
    usage: 'champollion models --method <provider> | champollion models check',
    description: [
      'Lists available models from a translation provider\'s API.',
      'Queries the provider\'s live model endpoint and displays all',
      'models you can use. Read-only — does not modify config.',
    ],
    options: [
      ['--method <name>', 'Provider to query: gemini, openai, or anthropic (required)'],
      ['check',           'Check every default model (shared/model-defaults.json) against the providers\' live lists; exit 1 if one is gone. Free (list endpoints are not billed)'],
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
      'Checks the locale files on disk: complete, and structurally intact.',
      '',
      'Re-reads the files (not what sync remembers) and compares each locale',
      'with the source — the gap between sync reporting success and keys being',
      'wrong in fact. Structure only: the meaning is not checked.',
      '',
      'Errors (exit 1):',
      '  - a key missing — i18next plural keys included: the locale needs',
      '    a key for each of its CLDR plural forms (French count_one,',
      '    count_many, count_other; English needs count_one, count_other)',
      '  - an empty value, or a fallback marker ("[EN] " — fallbackPrefix)',
      '  - wrong script: Latin-only text in a non-Latin locale, or fullwidth',
      '    Latin letters',
      '  - a placeholder lost, renamed or added, named by its syntax:',
      '    ICU MessageFormat structure (a translated variable name,',
      '    plural/select keyword or selector, a lost #), printf/python-format',
      '    (%s, %d, %(name)s), i18next {{name}}, single-brace {name}',
      '  - markup: a tag opened, closed or nested differently',
      '  - a hollowed value (the source with its letters deleted), or a',
      '    no-translate key that differs from the source',
      '  - one text written for several different source strings',
      '  - Flutter .arb: a wrong @@locale or changed placeholder metadata',
      '  - a configured locale with no file, or nothing found to check',
      '',
      'Warnings (exit 0 unless --strict):',
      '  - plurals: an i18next key for a form the locale does not have',
      '    (Spanish count_two — `sync --prune plural-extras` removes those',
      '    keys and nothing else); an ICU plural message without a form the',
      '    language uses for ordinary counts (Russian few, many); gettext',
      '    msgstr[] forms repeating "other" (marked # champollion:), or more',
      '    of them than the catalog\'s nplurals',
      '  - source echoes, encoding issues (invisible characters, U+FFFD),',
      '    a lost closing ? or !',
      '  - two locales with identical text',
      '  - translations made from an older source text (out of date —',
      '    `audit` fails on those)',
      '  - Markdown blocks or front-matter fields the quality gate refuses',
      'Said, never counted: an i18next plural form holding the text of the',
      'form it was translated from, with no record of the model writing it.',
      '',
      'Each locale also gets a line per kind of plural it carries — the',
      'forms its CLDR rules (or its gettext Plural-Forms) expect, and how',
      'many plurals have all of them: "Plural forms (CLDR fr): one, many,',
      'other ✓". --json writes one {"level":"event","event":"verify",…}',
      'record per locale (findings, placeholders by syntax, plural coverage)',
      'before the closing line, which carries the error and warning counts.',
      '',
      'A plain sync keeps a value already on disk, damaged or not: each',
      'damage finding (placeholders, ICU structure, hollowed text) names the',
      'command that repairs it — `champollion sync --pair en:fr --redo',
      'keys:<key>` (`<ns>::<key>` when a locale spans several files, `\\,` for',
      'a comma inside a key). No --fresh is needed: a damaged value the',
      'Translation Memory produced is removed from the cache here, so the redo',
      'translates it again instead of serving the same text for free.',
      'Hand-written values and the files themselves are not touched.',
      '',
      'This is the same verification that runs automatically after sync',
      '(where `sync --pair` verifies only the pairs that ran).',
    ],
    options: [
      ['--pair <src:tgt>', 'Only verify the named pair(s), comma-separated (e.g. en:fr). Unknown pairs fail loud'],
      ['--strict',         'Exit 1 on warnings too (CI that must not pass a plural gap or an out-of-date value)'],
      ['--warn-only',      'Exit 0 even if errors found'],
      ['--json',           'NDJSON: one "verify" event per locale on stdout, errors and warnings on stderr, then the closing line with the counts'],
      ['--config <path>',  'Path to config file'],
      ['--dir <path>',     'Override locales directory'],
      ['--source <code>',  'Override source locale'],
    ],
    examples: [
      'champollion verify                        # Verify all locale files',
      'champollion verify --pair en:fr           # Only French',
      'champollion verify --warn-only            # Non-blocking verification',
      'champollion verify --strict               # Warnings fail too (CI)',
      'champollion verify && echo "All good"     # CI gate',
      'champollion verify --json 2>/dev/null | jq -c \'select(.event == "verify") | {locale, plurals}\'',
    ],
  },

  leaderboard: {
    usage: 'champollion network leaderboard [options]',
    description: [
      'Fetches and displays MT evaluation leaderboard data from Supabase.',
      'Ranks by chrF++ with its 95% confidence interval (scoring standard/1,',
      'as in WMT and FLORES-200), shows BLEU, TER and COMET beside it, and',
      'diagnostics (exact match, FST acceptance) apart. No quality labels.',
      'Supports filtering by language pair, sorting by any metric, and',
      'NDJSON output for CI/CD integration.',
    ],
    options: [
      ['--pair <pair>',  'Filter by language pair, as the board writes it: "eng>crk" (ISO 639-3; quote the >). eng-crk and eng:crk work too, and a 2-letter code is resolved (en → eng)'],
      ['--sort <key>',   'Sort by: chrf (default), bleu, ter, comet; diagnostics exact, fst, equivalent, semantic; cost, date; composite (the retired legacy composite, old cards only)'],
      ['--top <n>',      'Show only the top N results'],
      ['--json',         'Machine-readable NDJSON output (one JSON object per line)'],
    ],
    examples: [
      'champollion network leaderboard                         # All results, ranked by chrF++',
      'champollion network leaderboard --pair "eng>crk"        # Filter to English→Cree (quote the >)',
      'champollion network leaderboard --sort chrf --top 10    # Top 10 by chrF++',
      'champollion network leaderboard --json | jq .chrF       # Pipe to jq for processing',
    ],
  },

  recommend: {
    summary: 'Method guidance for one source→target pair: the engines and open models that can translate it, and the published evidence.',
    usage: 'champollion network recommend <src> <tgt> [options]   (or one pair: eng-crk, "eng>crk", --pair)',
    description: [
      'Method guidance for one source→target pair (ISO 639-3 codes): every',
      'dispatchable engine with its live availability (API key present?',
      'license lane?), the open models whose own model card declares the',
      'target and that local-model can load (runnable, no published evidence —',
      'a claim to benchmark, not a measurement), the published evidence indexed',
      'for the pair (cited, never reproduced by us; relative-comparison-only),',
      'and which evidenced models are actually runnable here.',
      '',
      'Honest by construction: no evidence means it says so and points at',
      'runnable corpora instead of guessing. The commercial lane is STRICT —',
      'methods without a commercial-ready license (e.g. AGPL/GPL engines) are',
      'excluded with reasons, never silently dropped.',
    ],
    options: [
      ['--pair <pair>', 'The pair as one value instead of two codes: "eng>yor" (quote the >), eng-yor or eng:yor'],
      ['--use <lane>', 'License lane: non-commercial (default) or commercial (STRICT)'],
      ['--json',       'Machine-readable payload (the `mt-eval recommend --json` shape, plus declared_models)'],
    ],
    examples: [
      'champollion network recommend eng yor                    # Guidance for English→Yoruba',
      'champollion network recommend eng-yor                    # The same pair, as one value',
      'champollion network recommend eng yor --use commercial   # Commercial lane (AGPL excluded)',
      'champollion network recommend eng quy --json | jq .notes # Honest no-evidence state',
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
      ['methods',       'Check API keys (that each is set; an OpenRouter key is also sent to OpenRouter\'s free key endpoint, which rejects a bad one), server reachability, Python packages'],
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
/** Abbreviations whose period does not end a sentence ("e.g. AGPL"). */
const NOT_A_SENTENCE_END = /\b(?:e\.g|i\.e|etc|vs|cf)$/i;

/**
 * The one-line heading of a command's help: its `summary`, else the first
 * sentence of its description — never the first LINE, which cut nine
 * headings off mid-sentence ("Serves this project's OWN configured
 * translation stack (method," — Round 12). A sentence ends at . ! or ?
 * followed by a space or the end, outside parentheses, and not after an
 * abbreviation; the description's first paragraph is read as one text.
 *
 * @param {{ summary?: string, description: string[] }} help
 * @returns {string}
 */
function helpHeading(help) {
  if (typeof help.summary === 'string' && help.summary.trim()) return help.summary.trim();
  const para = [];
  for (const line of help.description || []) {
    if (!line.trim()) break;
    para.push(line.trim());
  }
  const text = para.join(' ');
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0 && '.!?'.includes(ch) && (i === text.length - 1 || /\s/.test(text[i + 1]))
      && !NOT_A_SENTENCE_END.test(text.slice(0, i))) {
      return text.slice(0, i + 1);
    }
  }
  return text;
}

function showCommandHelp(commandName) {
  const help = COMMAND_HELP[commandName];
  if (!help) return false;

  console.log('');
  console.log(`  champollion ${commandName} — ${helpHeading(help)}`);
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

export { COMMAND_HELP, showCommandHelp, helpHeading };
