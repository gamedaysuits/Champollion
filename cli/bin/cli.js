#!/usr/bin/env node
/**
 * Champollion CLI — Dispatcher
 *
 * Thin entry point that parses arguments and routes to command modules
 * in lib/commands/. Each command is a separate module exporting:
 *   async function run(args, cwd) → exit code (0 or 1)
 *
 * This file handles ONLY:
 *   1. Argument parsing (via Node.js built-in util.parseArgs)
 *   2. Command routing
 *   3. Per-command --help routing
 *   4. Process exit codes
 *   5. Top-level error handling
 */

import { parseArgs } from 'node:util';

// -----------------------------------------------------------------
// Parse CLI arguments via util.parseArgs (Node 18.3+)
//
// strict: false so parseArgs collects unknown flags into `values`
// (with an inferred type) instead of throwing mid-parse — we validate
// them ourselves below against CLI_OPTIONS, which enumerates every
// flag any command reads. This turns a typo like `--forcekeys` or a
// removed flag like `--content` into a loud error instead of a
// silently ignored no-op.
// -----------------------------------------------------------------
const CLI_OPTIONS = {
    // --- Boolean flags (shared across commands) ---
    dry:              { type: 'boolean' },
    'dry-run':        { type: 'boolean' },    // alias for --dry (more intuitive)
    help:             { type: 'boolean', short: 'h' },
    version:          { type: 'boolean', short: 'v' },
    yes:              { type: 'boolean', short: 'y' },
    'warn-only':      { type: 'boolean' },
    'no-verify':      { type: 'boolean' },  // skip post-sync verification
    undo:             { type: 'boolean' },
    'force-content':  { type: 'boolean' },  // ignore the content lock (TM still serves unchanged bodies/blocks)
    'no-tm':          { type: 'boolean' },  // skip Translation Memory for this sync run
    css:              { type: 'boolean' },  // fonts install --css: generate CSS snippet
    json:             { type: 'boolean' },  // machine-readable NDJSON output
    quiet:            { type: 'boolean', short: 'q' },  // suppress info/ok messages, show only warnings/errors
    force:            { type: 'boolean' },  // init --force: regenerate config over an existing one

    // --- String flags (take a value) ---
    config:        { type: 'string' },
    dir:           { type: 'string' },
    'content-dir': { type: 'string' },
    source:        { type: 'string' },
    langs:         { type: 'string' },
    model:         { type: 'string' },
    method:        { type: 'string' },
    format:        { type: 'string' },
    'base-url':    { type: 'string' },
    out:           { type: 'string' },
    src:           { type: 'string' },
    'min-length':  { type: 'string' },
    'force-keys':  { type: 'string' },
    'list-keys':   { type: 'boolean' },    // sync --dry: name every queued key per reason

    concurrency:           { type: 'string' },     // sets both json + content concurrency (backward compat)
    'json-concurrency':    { type: 'string' },     // max parallel API calls for JSON key-value translation (default: 50)
    'content-concurrency': { type: 'string' },     // max parallel API calls for markdown content (default: 12)
    'batch-size':  { type: 'string' },     // keys per translation API call (positive integer; overrides config batchSize)
    'max-cost':    { type: 'string' },     // sync: USD cap — abort (exit 2) before any API call if the estimate exceeds it or is unknown
    temperature:   { type: 'string' },     // sampling temperature for LLM methods
    'coaching-file': { type: 'string' },   // path to coaching prompt text file
    locale:        { type: 'string' },     // target locale for xliff export, tm clear/seed
    'older-than':  { type: 'string' },     // tm prune: also remove entries older than N days
    matching:      { type: 'string' },     // tm prune: also remove entries whose cached translation matches this regex
    pair:          { type: 'string' },     // language pair filter for sync (e.g., en:fr) + leaderboard (e.g., en>crk)
    use:           { type: 'string' },     // recommend: license lane (non-commercial|commercial)
    sort:          { type: 'string' },     // leaderboard sort key (composite, chrf, exact, etc.)
    top:           { type: 'string' },     // leaderboard: show top N results
    install:       { type: 'string' },     // leaderboard: install method config from rank N
    apply:         { type: 'boolean' },    // leaderboard --install --apply: auto-wire plugin in config

    // --- register-corpus flags ---
    license:       { type: 'string' },     // register-corpus: license key / SPDX id / list number
    tier:          { type: 'string' },     // register-corpus: exposure tier (local-only|private|public)
    exposure:      { type: 'string' },     // register-corpus: alias for --tier
    name:          { type: 'string' },     // register-corpus: corpus name
    publisher:     { type: 'string' },     // register-corpus: publisher / author
    description:   { type: 'string' },     // register-corpus: one-line description
    'source-lang': { type: 'string' },     // register-corpus: source language code (alt to --pair)
    'target-lang': { type: 'string' },     // register-corpus: target language code (alt to --pair)
    'repo-url':    { type: 'string' },     // register-corpus: public-tier fetch-from-source URL
    'source-url':  { type: 'string' },     // register-corpus: public-tier canonical URL
    'license-url': { type: 'string' },     // register-corpus: upstream license URL
    builder:       { type: 'string' },     // register-corpus: builder adapter id
    sha256:        { type: 'string' },     // register-corpus: built-corpus hash (optional)
    contamination: { type: 'string' },     // register-corpus: NONE|LOW|MEDIUM|HIGH
    domain:        { type: 'string' },     // register-corpus: corpus domain
    size:          { type: 'string' },     // register-corpus: number of sentence pairs
    id:            { type: 'string' },     // register-corpus: override card id
    version:       { type: 'string' },     // register-corpus: corpus version (major)
    'do-not-train': { type: 'boolean' },   // register-corpus: benchmark-integrity flag (default true)
    'cards-dir':   { type: 'string' },     // register-corpus: corpora-cards dir override (advanced/testing)
    list:          { type: 'boolean' },    // register-corpus + submit: print catalog / types

    // --- submit flags ---
    type:          { type: 'string' },     // submit: submission type (dataset|resource|method|human-service|external-result)
    values:        { type: 'string' },     // submit: JSON object of field id -> value
    field:         { type: 'string', multiple: true }, // submit: --field id=value (repeatable)
    attest:        { type: 'boolean' },    // submit: confirm the required compliance attestation
    consent:       { type: 'boolean' },    // submit: human-service provider listing consent
    repo:          { type: 'string' },     // submit: override the GitHub repo for the issue URL
    // --- register-corpus: sealed exposure tier ---
    'seal-input':        { type: 'string' },   // sealed: local corpus file to encrypt on-device
    'threshold-pubkey':  { type: 'string' },   // sealed: custodian group threshold public key (path or inline)
    'custodian-group':   { type: 'string' },   // sealed: custodian group id
    'seal-out':          { type: 'string' },   // sealed: where to write the ciphertext artifact
    'qualifier-id':      { type: 'string' },   // sealed: paired public qualifier card id (vYYYY)
    'qualifier-threshold': { type: 'string' }, // sealed: qualifier clearance threshold
    'key-scheme':        { type: 'string' },   // sealed: custody scheme label (default TSS-3-of-5)
    // --- seal-corpus verbs (keygen/seal/open — the organizer-node crypto bridge) ---
    artifact:            { type: 'string' },   // seal-corpus open: sealed artifact path
    privkey:             { type: 'string' },   // seal-corpus open: threshold private key (file|b64|PEM)
    'card-block-out':    { type: 'string' },   // seal-corpus seal: write the content-free card block here
    // --- seal-corpus signing verbs (sign-keygen/sign/verify — Phase-B airgap score bundles) ---
    payload:             { type: 'string' },   // sign/verify: the exact bytes being signed/checked
    'sig-out':           { type: 'string' },   // sign: where to write the signature block JSON
    sig:                 { type: 'string' },   // verify: the signature block JSON
    pubkey:              { type: 'string' },   // verify: Ed25519 public key (file|b64|PEM)
    // --- serve flags (self-hosted api-method server) ---
    port:                    { type: 'string' },   // serve: listen port (default 1822; 0 = ephemeral)
    bind:                    { type: 'string' },   // serve: bind address (default 127.0.0.1 — loopback only)
    token:                   { type: 'string' },   // serve: bearer token (or CHAMPOLLION_SERVE_TOKEN env)
    'no-auth':               { type: 'boolean' },  // serve: disable auth (loopback binds only)
    'rate-limit':            { type: 'string' },   // serve: requests/minute per IP (0 disables)
    'max-body-bytes':        { type: 'string' },   // serve: request body size cap
    'max-cost-per-request':  { type: 'string' },   // serve: USD cap per request (unknown estimates refuse)
    'max-session-cost':      { type: 'string' },   // serve: USD spend ceiling for the server process
    'emit-manifest':         { type: 'boolean' },  // serve: write the consumer method.json and exit
    endpoint:                { type: 'string' },   // serve --emit-manifest: public endpoint URL for the manifest
};

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  strict: false,
  allowPositionals: true,
  options: CLI_OPTIONS,
});

// -----------------------------------------------------------------
// Strict flag validation — reject flags no command defines.
//
// With strict: false, parseArgs happily accepted any `--typo` and the
// run proceeded as if it weren't there (e.g. `sync --force-key` doing a
// normal sync). Every real flag is declared in CLI_OPTIONS, so anything
// else in `values` is unknown: fail loud with pointers to help.
// -----------------------------------------------------------------
const unknownFlags = Object.keys(values).filter((name) => !(name in CLI_OPTIONS));
if (unknownFlags.length > 0) {
  for (const name of unknownFlags) {
    console.error(`[ERR] Unknown option: ${name.length === 1 ? '-' : '--'}${name}`);
  }
  console.error('      Run "champollion <command> --help" for that command\'s flags,');
  console.error('      or "champollion help" for the full command list.');
  process.exit(1);
}

// Build the args object in the shape all command modules expect:
//   { _: ['command', 'subcommand', ...], flagName: value, ... }
// This preserves backward compatibility with every command module.
const args = { _: positionals, ...values };

// --dry-run is an alias for --dry — merge so command modules only check args.dry
if (args['dry-run']) args.dry = true;

/**
 * Exit only once stdout has actually been written.
 *
 * When stdout is a PIPE (`champollion card fra --json > out.json`, or any
 * shell pipeline) Node's writes are asynchronous, so `process.exit()` discards
 * whatever is still buffered. `card --json` for a well-resourced language is
 * ~200 KB and was being truncated mid-object — the command exited 0 and
 * emitted invalid JSON, which is worse than failing. It looked fine in a
 * terminal, where stdout is synchronous, so nobody saw it.
 *
 * Writing an empty string gives us a callback that fires after the buffer
 * drains; the exit code is set first so the process is correct either way.
 */
function exitWhenFlushed(code) {
  process.exitCode = code;
  process.stdout.write('', () => process.exit(code));
}

const command = args._[0] || 'help';
const cwd = process.cwd();

// -----------------------------------------------------------------
// --version: print version from package.json and exit
// -----------------------------------------------------------------
if (args.version) {
  // URL is a global — no need to import node:url.
  // Dynamic import of node:fs is consistent with the lazy-loading
  // strategy used for command modules below.
  import('node:fs').then(fs => {
    const pkgPath = new URL('../package.json', import.meta.url);
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    console.log(`champollion v${pkg.version}`);
    process.exit(0);
  });
} else

// -----------------------------------------------------------------
// Per-command --help: intercept before loading command modules
// If the user runs `champollion <cmd> --help`, show focused help for
// that command without loading its module (fast, no side effects).
// -----------------------------------------------------------------
if (args.help && command !== 'help') {
  import('../lib/command-help.js').then(({ showCommandHelp }) => {
    const found = showCommandHelp(command);
    if (!found) {
      console.error(`[ERR] Unknown command: ${command}`);
      console.error('       Run "champollion help" to see all commands.');
      process.exit(1);
    }
    process.exit(0);
  });
} else {
  // -----------------------------------------------------------------
  // Command routing — dynamic import() keeps startup fast (ESM-native)
  // -----------------------------------------------------------------
  const commands = {
    init:       () => import('../lib/commands/init.js'),
    sync:       () => import('../lib/commands/sync.js'),
    serve:      () => import('../lib/commands/serve.js'),
    watch:      () => import('../lib/commands/watch.js'),
    audit:      () => import('../lib/commands/audit.js'),
    card:       () => import('../lib/commands/card.js'),
    'register-corpus': () => import('../lib/commands/register-corpus.js'),
    'seal-corpus': () => import('../lib/commands/seal-corpus.js'),
    submit:     () => import('../lib/commands/submit.js'),
    lint:       () => import('../lib/commands/lint.js'),
    status:     () => import('../lib/commands/status.js'),
    provenance: () => import('../lib/commands/provenance.js'),
    wrap:       () => import('../lib/commands/wrap.js'),
    seo:        () => import('../lib/commands/seo.js'),
    integrity:  () => import('../lib/commands/integrity.js'),
    'repair-script': () => import('../lib/commands/repair-script.js'),
    plugin:     () => import('../lib/commands/plugin.js'),
    fonts:      () => import('../lib/commands/fonts.js'),
    tm:         () => import('../lib/commands/tm.js'),
    xliff:      () => import('../lib/commands/xliff.js'),
    models:     () => import('../lib/commands/models.js'),
    verify:     () => import('../lib/commands/verify.js'),
    leaderboard: () => import('../lib/commands/leaderboard.js'),
    recommend:  () => import('../lib/commands/recommend.js'),
    doctor:     () => import('../lib/commands/doctor.js'),
  };

  if (commands[command]) {
    // Packaged installs only: invalidate card-cache entries whose
    // upstream updated_at moved (TTL-gated to once per day, instant
    // no-op in repo checkouts, and never blocks or fails the command
    // on network trouble — see lib/cards/refresh.js).
    import('../lib/cards/refresh.js')
      .then(mod => mod.maybeRefreshCardCache())
      .catch(() => {})
      .then(() => commands[command]())
      .then(mod => mod.run(args, cwd))
      .then(code => exitWhenFlushed(code || 0))
      .catch(err => {
        console.error(`[ERR] ${command} failed:`, err.message);
        exitWhenFlushed(1);
      });
  } else if (command === 'help') {
    import('../lib/commands/help.js').then(mod => mod.run());
  } else {
    // Unknown command — error loudly so CI typos don't silently pass
    console.error(`[ERR] Unknown command: "${command}"`);
    console.error('      Run "champollion help" to see all commands.');
    process.exit(1);
  }
}
