/**
 * Method recommendation for a language pair — the routing evidence surface.
 *
 * JS port of arena/mt_eval_harness/recommend.py (the spec — keep the two in
 * sync; its test contract lives in arena/tests/test_recommend.py and is
 * mirrored in test/recommend.test.js). `champollion recommend SRC TGT`
 * answers the practical question a translator-integrator actually has:
 * "I need to translate SRC→TGT — what are my options, what does the published
 * evidence say, and what can I actually run right now?" — while refusing to
 * overclaim.
 *
 * Three evidence tiers are consulted, all offline (shared/ artifacts — no
 * network, no credentials):
 *
 *   1. Dispatchable methods — shared/method-registry.json (the cross-runtime
 *      SSOT, via lib/method-manifest.js): every engine/provider with per-
 *      method AVAILABILITY resolved live (is its API key set? is it
 *      harness-only? is its license commercial-ready?). Key resolution reads
 *      the registry's credential_env metadata (key pairs require ALL vars;
 *      config vars like AWS_REGION never count) reconciled with
 *      lib/methods/provider-env.js so the verdict matches exactly what the
 *      method loaders read (canonical name + aliases, process.env AND .env
 *      files) — see resolveAvailability for the precedence. Each method's
 *      COVERAGE of the pair is read from the recorded publisher lists — the
 *      language card's methodSupport (through the card adapter, the same
 *      verdict `champollion network card` prints) and
 *      shared/catalogue/method-coverage.json — and a method either list
 *      records as not covering the pair is UNSUPPORTED, never READY (see
 *      languageCoverage); a runnable method no record confirms for the pair
 *      is UNVERIFIED, so READY means "known to cover it". The card is read
 *      through the CLI's normal card tier: local in a checkout; in a
 *      packaged install a card that is not bundled is read from the
 *      per-user cache or fetched once, unless offline.
 *   2. Curated cited results — shared/catalogue/external-results.json
 *      (bundled into the npm package via sync:shared): hand-verified
 *      published datapoints (cited ≠ reproduced), direction-exact.
 *   3. Bulk cited results — shared/catalogue/external-mt-index.json: the
 *      machine-imported best-published-score index (OPUS-MT leaderboard
 *      family), RELATIVE-ONLY lane by construction. NOT bundled into the
 *      npm package (1.6 MB) — available in monorepo checkouts; packaged
 *      installs degrade to an explicit note.
 *
 * HONESTY CONTRACT (the whole point):
 *   - Cited evidence orders methods relative to each other on a memorized
 *     public benchmark — never absolute quality, never a deployment ranking.
 *   - Evidence and dispatchability are DIFFERENT axes: the best-evidenced
 *     model for a pair may not be runnable in Champollion, and may be
 *     NC-licensed (excluded from commercial-lane recommendations). The two
 *     are joined only with explicit caveats.
 *   - No evidence → say exactly that, and point at the runnable corpora so
 *     the user can MEASURE rather than guess.
 *   - Missing artifacts (packaged installs) → each tier degrades to an
 *     explicit "not available" note, never silently.
 *
 * Pure logic over the shared artifacts; loaders take explicit fixtures so
 * tests can inject them.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadMethodManifest, cliNameFor } from './method-manifest.js';
import { providerEnvNames } from './methods/provider-env.js';
import { getEnvOrFileVar } from './api-key.js';
import { LANE_RELATIVE_ONLY, laneForGrade, normalizeGrade } from './contamination-lane.js';
import { isMethodSupported, getLanguageCard, getCardSourceInfo } from './registers.js';
import { isAttributed, attributions } from './cards/reader.js';

// ---------------------------------------------------------------------------
// Shared-artifact resolution (mirrors method-manifest.js's loader)
// ---------------------------------------------------------------------------

/**
 * Find shared/catalogue/<filename>: package-bundled copy first
 * (cli/shared/catalogue/, shipped in the npm package), then the
 * monorepo-root SSOT. Returns null when neither exists — callers render an
 * explicit "not available" note, never a silent skip.
 *
 * @param {string} filename
 * @returns {string|null}
 */
function cataloguePath(filename) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(__dirname, '..', 'shared', 'catalogue', filename),
    path.resolve(__dirname, '..', '..', 'shared', 'catalogue', filename),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** @returns {object|null} parsed JSON, or null when the path is null/unreadable */
function loadCatalogueJson(filename) {
  const p = cataloguePath(filename);
  if (p === null) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tier 1 — dispatchable methods + live availability
// ---------------------------------------------------------------------------

/**
 * Resolve one method-registry entry to a live availability verdict.
 *
 * Returns { status, detail } where status ∈:
 *   ready        — invocable right now (needed env key present, or none needed)
 *   needs-key    — adapter exists; set one of the named env vars
 *   local-setup  — local engine; needs the optional install/extra
 *
 * Readiness is judged on the entry's CREDENTIAL vars only — the registry
 * `env` list also names non-credential config vars (AWS_REGION, *_ENDPOINT)
 * the adapter reads, and those must never make a method read "ready" (a
 * region is not auth). The var list is picked in this order:
 *   1. `credential_env` + `credential_env_all: true` (key-pair auth: EVERY
 *      var required — AWS id + secret, Lara id + secret). Beats PROVIDER_ENV,
 *      whose any-of semantics fit alias lists, not pairs.
 *   2. PROVIDER_ENV (lib/methods/provider-env.js) when the provider is
 *      registered there: exactly the surface the method loaders read
 *      (canonical + aliases, incl. names the registry doesn't carry), any-of.
 *   3. `credential_env` (any-of) — the registry's declared credential subset,
 *      for providers with no PROVIDER_ENV entry (harness-only engines).
 *   4. The raw registry `env` list (every var is a credential).
 *
 * @param {string} name - Canonical registry name (e.g. 'google-translate')
 * @param {object} entry - The method-registry entry
 * @param {object} [opts]
 * @param {Object<string,string>|null} [opts.env] - Fixture env for tests;
 *   null/omitted = live resolution via process.env AND .env files
 * @param {string} [opts.cwd] - Project root for .env lookup (live mode)
 * @returns {{status: string, detail: string}}
 */
function resolveAvailability(name, entry, { env = null, cwd = undefined } = {}) {
  const credVars = Array.isArray(entry.credential_env) ? entry.credential_env : null;
  const needAll = entry.credential_env_all === true && credVars !== null;
  const providerNames = providerEnvNames(name);
  const envVars = needAll ? credVars
    : providerNames.length > 0 ? providerNames
      : (credVars ?? entry.env ?? []);
  const extra = entry.optional_extra;
  const extraNote = extra ? ` (requires pip extra '${extra}')` : '';

  if (entry.kind === 'local-model') {
    return {
      status: 'local-setup',
      detail: extra
        ? `local engine — install extra '${extra}'`
        : 'local engine — see homepage for setup',
    };
  }
  if (envVars.length === 0) {
    return { status: 'ready', detail: `no credentials required${extraNote}` };
  }
  // A KEYLESS method needs nothing set: `local` talks to a server on this
  // machine, Apertium to its free public API; their env vars only POINT
  // ELSEWHERE. Reporting them as a missing key told people the privacy-
  // preserving option needed credentials it does not. The registry says so
  // explicitly (`keyless`) — a hosted API with a default URL still needs a key.
  if (entry.keyless) {
    const get0 = env === null ? (n) => getEnvOrFileVar(n, cwd) : (n) => env[n];
    const set = envVars.find((n) => get0(n));
    return {
      status: 'ready',
      detail: set
        ? `${set} is set${extraNote}`
        : `no key needed — uses ${entry.default_base_url} unless ${envVars[0]} points elsewhere${extraNote}`,
    };
  }
  const get = env === null ? (n) => getEnvOrFileVar(n, cwd) : (n) => env[n];
  const present = envVars.filter((n) => get(n));
  if (needAll) {
    const missing = envVars.filter((n) => !get(n));
    if (missing.length === 0) {
      return { status: 'ready', detail: `${envVars.join(' + ')} are set${extraNote}` };
    }
    const qualifier = present.length > 0
      ? ` (${present[0]} alone is not enough)`
      : ' (all required)';
    return { status: 'needs-key', detail: `set ${missing.join(' + ')}${qualifier}${extraNote}` };
  }
  if (present.length > 0) {
    return { status: 'ready', detail: `${present[0]} is set${extraNote}` };
  }
  return { status: 'needs-key', detail: `set ${envVars.join(' or ')}${extraNote}` };
}

/**
 * What the RECORDED publisher lists say about one language for one method.
 *
 * Two records exist, and both are read — never one picked over the other:
 *   - the language card's methodSupport, through the card adapter
 *     (registers.js isMethodSupported — the verdict `champollion network card`
 *     prints). The atlas projects it from the vendors' own fetched lists
 *     (Apertium, Microsoft, LibreTranslate) and the curated ones (Google,
 *     DeepL); a card answers true/false only for the services it indexes;
 *   - shared/catalogue/method-coverage.json's iso6393 list.
 * The card and recommend used to read different records: the card printed
 * "apertium ✗ unsupported" for Plains Cree while recommend, which read only
 * method-coverage.json (no Apertium list there), printed "READY … coverage
 * not indexed".
 *
 * Every record agrees it is listed → 'listed'; every record says it is not →
 * 'not-listed'; the records disagree → 'disputed' (both are named; this is an
 * index, not an arbiter). "Not indexed" is said ONLY when nothing is recorded.
 *
 * @param {string} name - Registry method name
 * @param {string} code - ISO 639-3 code (or upstream code with a script suffix)
 * @param {object|null} coverageCatalogue - method-coverage.json contents
 * @param {((code: string, method: string) => boolean|null)|null} cardSupport
 * @returns {{coverage: 'listed'|'not-listed'|'disputed'|'unknown', note: string}}
 */
function languageCoverage(name, code, coverageCatalogue, cardSupport) {
  const records = [];
  const onCard = cardSupport ? cardSupport(code, name) : null;
  if (typeof onCard === 'boolean') records.push({ source: 'language card', listed: onCard });
  const rec = (coverageCatalogue?.methods || []).find((x) => x.key === name);
  const list = rec && Array.isArray(rec.iso6393) ? rec.iso6393 : [];
  if (list.length > 0) {
    records.push({
      source: 'method-coverage.json',
      listed: list.includes(code) || list.includes(baseCode(code)),
    });
  }
  if (records.length === 0) {
    return { coverage: 'unknown',
      note: rec ? 'the publisher states a language count, not a list' : 'language coverage not indexed — check the service' };
  }
  const per = (rs) => rs.map((r) => r.source).join(' + ');
  const yes = records.filter((r) => r.listed);
  const no = records.filter((r) => !r.listed);
  if (no.length === 0) {
    return { coverage: 'listed', note: `${code} is in its published language list (${per(yes)})` };
  }
  if (yes.length === 0) {
    return { coverage: 'not-listed', note: `${code} is NOT in its published language list (${per(no)})` };
  }
  return { coverage: 'disputed',
    note: `the records disagree on ${code}: listed per ${per(yes)}, NOT listed per ${per(no)} — check the service` };
}

/**
 * Does this method cover the PAIR? Answered from the recorded publisher lists
 * (languageCoverage), never guessed. "READY" only ever meant "no key missing";
 * without this a keyless public API read as ready for a language it does not
 * translate (Round 1, hospital persona: Apertium "READY" for English→Ayta).
 * A language a list-based service does not list cannot be translated from
 * either, so the SOURCE side is read too: either side recorded as not listed
 * makes the pair unsupported.
 *
 * @returns {{target: {coverage: string, note: string}, source: ({coverage: string, note: string}|null)}}
 */
function pairCoverage(name, entry, src, tgt, coverageCatalogue, cardSupport) {
  if (entry.kind === 'llm-provider' || entry.paradigm === 'llm') {
    const any = { coverage: 'any', note: 'takes text in any language — quality for this one is unmeasured' };
    return { target: any, source: src ? any : null };
  }
  if (entry.kind === 'local-model') {
    const dep = { coverage: 'unknown', note: 'depends on the model you load' };
    return { target: dep, source: src ? dep : null };
  }
  return {
    target: languageCoverage(name, tgt, coverageCatalogue, cardSupport),
    source: src ? languageCoverage(name, src, coverageCatalogue, cardSupport) : null,
  };
}

/**
 * Tier-1 rows: every registry method with availability + lane verdicts.
 *
 * useContext ∈ {'non-commercial', 'commercial'}: the commercial lane is
 * STRICT (mirrors the harness's license lane) — a method whose
 * commercialReady is not true is excluded-with-reason, never silently
 * dropped. Entries whose runtimes exclude 'cli' are flagged harness-only
 * and point at mt-eval (mirrors translate.js's findHarnessOnlyEntry).
 *
 * With a target, `availability` is the verdict for the PAIR: a method a
 * recorded list says does not cover either side is 'unsupported' — never
 * 'ready' — and the credential verdict stays readable as `key_availability`.
 * A method that is runnable on keys alone but whose coverage of either side
 * is not confirmed (nothing recorded, a count instead of a list, or records
 * that disagree) is 'unverified': 'ready' means known to cover the pair
 * (Round 5, hospital persona: Apertium READY for English→Ayta with coverage
 * "not indexed"). It sorts right after 'ready' — runnable, but check first.
 *
 * @param {string} useContext
 * @param {object} [opts]
 * @param {object|null} [opts.manifest] - Fixture manifest for tests
 * @param {Object<string,string>|null} [opts.env] - Fixture env for tests
 * @param {string} [opts.cwd]
 * @param {string|null} [opts.src] - Source language (pair coverage)
 * @param {string|null} [opts.tgt] - Target language (pair coverage)
 * @param {object|null} [opts.coverage] - Fixture method-coverage.json
 * @param {Function|null} [opts.cardSupport] - Fixture card lookup
 *   (code, method) → true/false/null; omitted = the card adapter
 *   (isMethodSupported); null = no card records
 * @returns {object[]}
 */
function dispatchableMethods(useContext, { manifest = undefined, env = null, cwd = undefined,
  src = null, tgt = null, coverage = undefined, cardSupport = undefined } = {}) {
  const m = manifest !== undefined ? manifest : loadMethodManifest();
  if (!m || !m.entries) return [];
  const coverageCatalogue = tgt ? (coverage !== undefined ? coverage : loadCatalogueJson('method-coverage.json')) : null;
  const cardLookup = cardSupport !== undefined ? cardSupport : isMethodSupported;
  const rows = [];
  for (const [name, entry] of Object.entries(m.entries)) {
    const avail = resolveAvailability(name, entry, { env, cwd });
    const cov = tgt ? pairCoverage(name, entry, src, tgt, coverageCatalogue, cardLookup) : null;
    const notCovered = cov
      ? [cov.source, cov.target].filter((c) => c && c.coverage === 'not-listed')
      : [];
    const unconfirmed = cov
      ? [cov.source, cov.target].filter((c) => c && (c.coverage === 'unknown' || c.coverage === 'disputed'))
      : [];
    const availability = notCovered.length > 0 ? 'unsupported'
      : avail.status === 'ready' && unconfirmed.length > 0 ? 'unverified'
        : avail.status;
    const runtimes = entry.runtimes || ['harness', 'cli'];
    const harnessOnly = Array.isArray(entry.runtimes) && !entry.runtimes.includes('cli');
    let laneOk = true;
    let laneNote = null;
    if (useContext === 'commercial' && entry.commercialReady !== true) {
      laneOk = false;
      laneNote = `excluded from the commercial lane — license: ${entry.license || 'unknown'}`;
    }
    rows.push({
      method: name,
      cli_name: cliNameFor(name, entry),
      kind: entry.kind ?? null,
      paradigm: entry.paradigm ?? null,
      license: entry.license ?? null,
      commercial_ready: entry.commercialReady === true,
      runtimes,
      harness_only: harnessOnly,
      runtime_note: harnessOnly
        ? `harness-only — no CLI adapter; run it with: mt-eval run --method ${name}`
        : null,
      availability,
      availability_detail: notCovered.length > 0
        ? notCovered.map((c) => c.note).join('; ')
        : avail.detail,
      key_availability: avail.status,
      key_availability_detail: avail.detail,
      lane_ok: laneOk,
      lane_note: laneNote,
      cost_note: entry.cost_note ?? null,
      ...(cov ? { target_coverage: cov.target.coverage, target_coverage_note: cov.target.note } : {}),
      ...(cov && cov.source
        ? { source_coverage: cov.source.coverage, source_coverage_note: cov.source.note }
        : {}),
    });
  }
  const order = { 'ready': 0, 'unverified': 1, 'needs-key': 2, 'local-setup': 3, 'unsupported': 4 };
  rows.sort((a, b) =>
    (a.lane_ok === b.lane_ok ? 0 : a.lane_ok ? -1 : 1)
    || ((order[a.availability] ?? 9) - (order[b.availability] ?? 9))
    || a.method.localeCompare(b.method));
  return rows;
}

// ---------------------------------------------------------------------------
// Tier 1b — open models a model card declares for the target
// ---------------------------------------------------------------------------

/**
 * Weight formats the harness's local-model engine does not load from a
 * Hugging Face id: it runs a transformers checkpoint by id, or a CTranslate2
 * conversion only from a DIRECTORY on this machine (it picks that backend by
 * the directory's model.bin) — so a quantized or ONNX export (GGUF, AWQ,
 * GPTQ, MLX, ONNX), an adapter (LoRA) or a CTranslate2 conversion on the Hub
 * (`…-ct2`, `…-ct2-int8`: transformers cannot read its model.bin) named on
 * the card is listed as declared (`not_loadable`) but never offered as
 * something to run by id. Round 11: NLLB/MADLAD cards name many `-ct2` repos.
 */
const NOT_LOADABLE_BY_LOCAL_MODEL = /gguf|lora|awq|gptq|mlx|onnx|(?:^|[-_./])ct2(?:[-_.]|$)/i;

/** How many declared models are offered to try, in the card's own order. */
const DECLARED_CANDIDATE_LIMIT = 3;

/**
 * Open models whose OWN model card declares the target language, that the
 * harness's local-model engine can load — what to try when nothing is
 * measured. ONE selection for every surface: `champollion network recommend`
 * renders it, and the MCP language_overview reads it from this payload (Round
 * 11: the overview suggested OmniTranslate for Plains Cree from its own copy
 * of this rule while `recommend eng crk` named no model at all).
 *
 * Read from the language card's methodSupportEvidence (the atlas's
 * methodSupport claims, through the CLI's card tier — getLanguageCard runs
 * normalizeCard at the load site): every named claim that is not a service
 * listing. A claim is the model publisher's statement, never a measurement;
 * which of them is any good is the leaderboard's question. Candidates are the
 * Hugging Face ids among them in a format local-model loads, the first
 * DECLARED_CANDIDATE_LIMIT in the card's order (alphabetical by id — not a
 * ranking). The card names a capped sample when there are many claims
 * (`declared_total` is the full count).
 *
 * @param {string} code - Target ISO 639-3 code
 * @param {object} [opts]
 * @param {(code: string) => object|null} [opts.getCard] - Card lookup
 *   (default: the CLI card tier). Injectable for tests.
 * @param {number} [opts.limit]
 * @returns {{declared_total: number, listed: number, loadable: number,
 *   candidates: object[], not_loadable: string[], problem: string|null}}
 */
function declaredModelCandidates(code, { getCard = getLanguageCard, limit = DECLARED_CANDIDATE_LIMIT } = {}) {
  const none = { declared_total: 0, listed: 0, loadable: 0, candidates: [], not_loadable: [] };
  const card = getCard(code);
  if (!card) {
    const packaged = getCard === getLanguageCard && getCardSourceInfo().mode === 'packaged';
    return {
      ...none,
      problem: packaged
        ? `no language card for '${code}' in this install (not bundled or cached, and not fetchable now)`
        : `no language card for '${code}'`,
    };
  }
  const ev = card.methodSupportEvidence && typeof card.methodSupportEvidence === 'object'
    ? card.methodSupportEvidence : null;
  const claims = (Array.isArray(ev?.named) ? ev.named : [])
    .filter((n) => n && n.value !== 'service' && typeof n.variant === 'string' && n.variant);
  if (claims.length === 0) {
    return { ...none, problem: `the language card for '${code}' records no model that declares it` };
  }
  const hf = claims.filter((n) => n.variant.startsWith('hf:'));
  const loadable = hf.filter((n) => !NOT_LOADABLE_BY_LOCAL_MODEL.test(n.variant));
  return {
    declared_total: Number.isInteger(ev.total) ? ev.total : claims.length,
    listed: claims.length,
    // Hugging Face ids named on the card in a format local-model loads (the
    // candidates are the first `limit` of them).
    loadable: loadable.length,
    candidates: loadable.slice(0, limit).map((n) => ({
      id: n.variant.slice('hf:'.length),
      claim: n.confidence ?? n.value ?? null,
      source: n.source ?? null,
    })),
    not_loadable: hf.filter((n) => NOT_LOADABLE_BY_LOCAL_MODEL.test(n.variant)).map((n) => n.variant.slice('hf:'.length)),
    problem: null,
  };
}

/**
 * The declared-model section of a recommendation: the candidates, each joined
 * to what can run it (the registry's local-model engine — its availability
 * and lane, from the same rows the method list shows) and to the pair's
 * published evidence (an exact model-id match in the curated or bulk rows:
 * "runnable, no published evidence" is said only when no row names it).
 *
 * @returns {object}
 */
function declaredModelsSection(tgt, methods, curatedRows, bulkRows, { declared = undefined } = {}) {
  const found = declared !== undefined ? declared : declaredModelCandidates(tgt);
  const engine = methods.find((m) => m.kind === 'local-model') || null;
  const evidenced = new Set([...curatedRows, ...bulkRows]
    .flatMap((r) => [r.model, r.method_ref]).filter(Boolean).map((s) => String(s).toLowerCase()));
  return {
    ...found,
    // The engine that loads them (null: this registry has none — then they
    // are listed as declared, never as runnable).
    engine: engine
      ? { method: engine.method, availability: engine.availability, availability_detail: engine.availability_detail,
        harness_only: engine.harness_only, lane_ok: engine.lane_ok, lane_note: engine.lane_note }
      : null,
    candidates: found.candidates.map((c) => ({
      ...c,
      method: engine ? engine.method : null,
      runnable: Boolean(engine) && engine.lane_ok,
      published_evidence: evidenced.has(c.id.toLowerCase()),
      ...(engine ? { run: `mt-eval run --method ${engine.method} --model ${c.id} --corpus <your test file>` } : {}),
    })),
  };
}

// ---------------------------------------------------------------------------
// Tier 2 — curated cited results (direction-exact)
// ---------------------------------------------------------------------------

/**
 * Direction-exact curated datapoints + the cited-methods index.
 *
 * Rows carry per-datapoint provenance; ranking across different
 * (benchmark, metric) buckets is deliberately NOT performed — metric
 * variants are incomparable (metric_variant_flag).
 *
 * @param {string} src - ISO 639-3 source code
 * @param {string} tgt - ISO 639-3 target code
 * @param {object|null} [catalogue] - Fixture for tests; omit to load the
 *   shared artifact
 * @returns {{rows: object[], methodsIndex: Object<string, object>}}
 */
function curatedEvidence(src, tgt, catalogue = undefined) {
  const cat = catalogue !== undefined
    ? catalogue
    : loadCatalogueJson('external-results.json');
  if (!cat || Object.keys(cat).length === 0) return { rows: [], methodsIndex: {} };
  const methodsIndex = {};
  for (const m of cat.methods || []) {
    if (m && m.id != null) methodsIndex[m.id] = m;
  }
  const rows = [];
  for (const r of cat.results || []) {
    const pair = r.pair || {};
    if (pair.source !== src || pair.target !== tgt) continue;
    const grade = normalizeGrade((r.signal_strength || {}).contamination);
    rows.push({
      tier: 'curated',
      model: r.model ?? null,
      benchmark: r.benchmark ?? null,
      metric: r.metric ?? null,
      value: r.value ?? null,
      lower_is_better: r.lower_is_better === true,
      grade: (r.signal_strength || {}).grade ?? null,
      lane: grade ? laneForGrade(grade) : LANE_RELATIVE_ONLY,
      verified: r.verified === true,
      citation: r.citation ?? null,
      source_url: r.source_url ?? null,
      method_ref: r.method_ref ?? null,
    });
  }
  return { rows, methodsIndex };
}

// ---------------------------------------------------------------------------
// Tier 3 — bulk cited index (relative-only by construction)
// ---------------------------------------------------------------------------

/** Strip a FLORES-style script suffix: 'ace_Arab' → 'ace'. */
function baseCode(code) {
  return code.split('_', 1)[0];
}

/**
 * Best-published rows for the pair from the bulk index.
 *
 * Pair keys are upstream codes (may carry script suffixes); we match on the
 * script-stripped base and surface the exact upstream key on each row so
 * nothing is silently relabelled.
 *
 * @param {string} src
 * @param {string} tgt
 * @param {object} [opts]
 * @param {object|null} [opts.index] - Fixture for tests
 * @param {number} [opts.maxRows]
 * @returns {{rows: object[], meta: object}}
 */
function bulkEvidence(src, tgt, { index = undefined, maxRows = 8 } = {}) {
  const idx = index !== undefined ? index : loadCatalogueJson('external-mt-index.json');
  if (!idx || Object.keys(idx).length === 0) return { rows: [], meta: {} };
  const models = idx.models || [];
  const posture = idx.contamination_posture || {};
  const rows = [];
  for (const [key, cells] of Object.entries(idx.pairs || {})) {
    const sep = key.indexOf('-');
    const s = sep === -1 ? key : key.slice(0, sep);
    const t = sep === -1 ? '' : key.slice(sep + 1);
    if (baseCode(s) !== src || baseCode(t) !== tgt) continue;
    for (const [testset, metrics] of Object.entries(cells)) {
      for (const [metric, cell] of Object.entries(metrics)) {
        const [modelIdx, value] = cell;
        const model = (Number.isInteger(modelIdx) && modelIdx < models.length)
          ? models[modelIdx]
          : String(modelIdx);
        rows.push({
          tier: 'bulk',
          pair_key: key,
          model,
          benchmark: testset,
          metric,
          value,
          lane: LANE_RELATIVE_ONLY,
          posture: posture[testset] ?? null,
        });
      }
    }
  }
  rows.sort((a, b) =>
    a.benchmark.localeCompare(b.benchmark)
    || a.metric.localeCompare(b.metric)
    || a.pair_key.localeCompare(b.pair_key));
  const meta = {
    provider: idx.provider ?? null,
    provenance: idx.provenance ?? null,
    truncated: rows.length > maxRows,
    total_rows: rows.length,
  };
  return { rows: rows.slice(0, maxRows), meta };
}

// ---------------------------------------------------------------------------
// Tier 4 — metric-reliability evidence (which metric to BELIEVE for the target)
// ---------------------------------------------------------------------------

/**
 * Every cited claim the target's language card makes about its family.
 *
 * Twin of card_family_claims in arena/mt_eval_harness/recommend.py — same
 * shapes, same order of preference, same messages. Read through the CLI's
 * card tier (registers.js getLanguageCard: normalizeCard at the load site,
 * the per-user cache / one-time fetch in a packaged install) and the
 * reader's isAttributed()/attributions() — never a bare card read:
 * `classification.family` is an attribution envelope wherever Glottolog and
 * WALS disagree, and a disagreement stays a disagreement here — nothing is
 * elected. Three shapes, in this order:
 *   1. the envelope (atlas card) → every {value, source} it carries;
 *   2. the published projection's flat family + `familyAttributions` list;
 *   3. a flat family, its source read from `_fieldSources`.
 *
 * @param {string} code
 * @param {object} [opts]
 * @param {(code: string) => object|null} [opts.getCard] - Card lookup
 *   (default: the CLI card tier). Injectable for tests.
 * @returns {{claims: {value: string, source: string|null}[], problem: string|null}}
 *   `problem` is a plain reason when no claim could be read (no card, no
 *   family recorded), else null.
 */
function cardFamilyClaims(code, { getCard = getLanguageCard } = {}) {
  const card = getCard(code);
  if (!card) {
    // A packaged install holds a core set; a card that is neither bundled,
    // cached nor fetchable right now is "not here", not "does not exist".
    const packaged = getCard === getLanguageCard && getCardSourceInfo().mode === 'packaged';
    return {
      claims: [],
      problem: packaged
        ? `no language card for '${code}' in this install (not bundled or cached, and not fetchable now)`
        : `no language card for '${code}'`,
    };
  }
  const cls = card.classification && typeof card.classification === 'object'
    && !Array.isArray(card.classification) ? card.classification : {};
  const fam = cls.family;
  let claims;
  if (isAttributed(fam)) {
    claims = attributions(fam);
  } else if (Array.isArray(cls.familyAttributions) && cls.familyAttributions.length > 0) {
    // The published projection: a flat family plus its attribution list.
    claims = cls.familyAttributions.filter((c) => c && typeof c === 'object');
  } else if (fam) {
    const stamped = (card._fieldSources || {})['classification.family'];
    const source = Array.isArray(stamped)
      ? stamped.filter((s) => typeof s === 'string').join(', ')
      : stamped;
    claims = [{ value: fam, source: source || null }];
  } else {
    claims = [];
  }
  claims = claims
    .filter((c) => typeof c?.value === 'string' && c.value)
    .map((c) => ({ value: c.value, source: c.source ?? null }));
  if (claims.length === 0) {
    return { claims: [], problem: `the language card for '${code}' records no family` };
  }
  return { claims, problem: null };
}

/** 'Uralic (glottolog-v5.3, wals-v2020.5)' — every claim, grouped by value. */
function claimsText(claims) {
  const byValue = new Map();
  for (const c of claims) {
    if (!byValue.has(c.value)) byValue.set(c.value, []);
    byValue.get(c.value).push(c.source || 'source not recorded');
  }
  return [...byValue].map(([v, srcs]) => `${v} (${srcs.join(', ')})`).join('; ');
}

/**
 * Per-target-family metric↔human correlation evidence (workstream B3).
 *
 * Answers a different question from tiers 1–3: not "which SYSTEM scores
 * best" but "which METRIC can you trust to score output in this target
 * language". Sourced from shared/catalogue/metric-reliability.json — the
 * champollion-derived correlations between automatic metrics and the WMT
 * Metrics-task human judgments (wmt19–wmt25); methodology spec:
 * https://champollion.dev/docs/network/specifications/metric-reliability
 *
 * A target WMT never judged is looked up by FAMILY: its language card's
 * family claims (`familyClaims`, default cardFamilyClaims) are matched
 * EXACTLY against the index's family roll-up names — no renaming between
 * classifications, so a Glottolog "Atlantic-Congo" claim does not match a
 * "Niger-Congo" roll-up, while WALS's "Niger-Congo" claim on the same card
 * does (the Python twin's handling, verbatim). Exactly one evidenced family
 * → that roll-up, with the claims that put the target there, any source
 * disagreement, and the transfer caveat. Sources naming two different
 * evidenced families → no pick, UNMEASURED. (This lookup used to stop at
 * the judged languages while its note claimed "directly or via its
 * family", so Northern Sami was told no family evidence covered it while
 * Uralic — its own family — had evidence.)
 *
 * Fail-honest: an absent index, or a target neither judged nor in an
 * evidenced family, yields an explicit note that says what was consulted —
 * never a silent skip, never borrowed numbers.
 *
 * @param {string} tgt
 * @param {object|null} [reliability] - Fixture for tests (null = absent)
 * @param {object} [opts]
 * @param {(code: string) => {claims: object[], problem: string|null}} [opts.familyClaims]
 *   Family lookup (default: cardFamilyClaims). Injectable for tests.
 * @returns {{section: object|null, notes: string[]}}
 */
function metricReliabilityEvidence(tgt, reliability = undefined, { familyClaims = null } = {}) {
  const rel = reliability !== undefined
    ? reliability
    : loadCatalogueJson('metric-reliability.json');
  if (!rel) {
    return {
      section: null,
      notes: ['Metric-reliability index not bundled in the npm package — '
        + 'metric-trust tier skipped explicitly. See the methodology spec at '
        + 'https://champollion.dev/docs/network/specifications/metric-reliability, '
        + 'or run from a monorepo checkout (or `mt-eval recommend`) for the '
        + 'full evidence.'],
    };
  }
  const languages = rel.languages || {};
  const families = rel.families || {};
  let code = null;
  let info = null;
  for (const key of Object.keys(languages).sort()) {
    const entry = languages[key] || {};
    if (tgt === key || tgt === entry.iso639_3) {
      code = key;
      info = entry;
      break;
    }
  }
  const notes = [];
  let familyBasis = null;
  let family;
  if (info === null) {
    const { claims = [], problem = null } = (familyClaims || cardFamilyClaims)(tgt) || {};
    const evidenced = [...new Set(claims.map((c) => c.value)
      .filter((v) => Object.hasOwn(families, v)))].sort();
    const unmeasuredTail = ' — metric choice for this language is UNMEASURED. Treat '
      + 'every metric as unvalidated there; prefer metrics with '
      + 'morphology-robust behaviour and validate locally where possible.';
    if (problem) {
      return {
        section: null,
        notes: [`No WMT human-judgment meta-evaluation covers target '${tgt}' `
          + `directly, and its family could not be checked (${problem})${unmeasuredTail}`],
      };
    }
    if (evidenced.length === 0) {
      return {
        section: null,
        notes: [`No WMT human-judgment meta-evaluation covers target '${tgt}' `
          + `directly or via its family (per its language card: ${claimsText(claims)} `
          + `— no WMT-judged target language in that family)${unmeasuredTail}`],
      };
    }
    if (evidenced.length > 1) {
      return {
        section: null,
        notes: [`No WMT human-judgment meta-evaluation covers target '${tgt}' `
          + 'directly, and its language card\'s family sources disagree '
          + 'between families that each have evidence '
          + `(${claimsText(claims)}) — Champollion does not pick between `
          + `sources${unmeasuredTail}`],
      };
    }
    family = evidenced[0];
    familyBasis = {
      via: 'language-card',
      claims,
      matched_sources: claims.filter((c) => c.value === family).map((c) => c.source),
    };
    notes.push(`'${tgt}' was never a WMT-judged target; its language card `
      + `classifies it as ${claimsText(claims.filter((c) => c.value === family))}, `
      + `so the ${family} family roll-up is the closest evidence.`);
    if (claims.some((c) => c.value !== family)) {
      notes.push(`The card's family sources disagree (${claimsText(claims)}); `
        + `only '${family}' names a family this index rolls up, so the `
        + 'evidence shown rests on that classification alone.');
    }
  } else {
    family = info.family || 'Unclassified';
  }
  const famBlock = families[family] || {};
  const metricsOut = [];
  for (const [metricId, levels] of Object.entries(famBlock.metrics || {}).sort()) {
    const sysE = levels.sys || {};
    const segE = levels.seg || {};
    metricsOut.push({
      metric: metricId,
      sys_pearson: sysE.pearson_weighted_mean ?? null,
      sys_pairwise_accuracy: sysE.pairwise_accuracy_weighted_mean ?? null,
      sys_n_pairs: sysE.n_pairs ?? null,
      seg_kendall: segE.kendall_tau_b_weighted_mean ?? null,
      seg_n_pairs: segE.n_pairs ?? null,
    });
  }
  metricsOut.sort((a, b) =>
    (b.sys_pearson ?? -2) - (a.sys_pearson ?? -2)
    || a.metric.localeCompare(b.metric));
  const exactPairs = [...new Set((rel.cells || [])
    .filter((c) => code !== null && c.tgt === code && c.preferred)
    .map((c) => c.pair))].sort();
  if (exactPairs.length === 0) {
    notes.push(`Family-level metric evidence only: the '${family}' `
      + `correlations come from other ${family} target languages, never from `
      + `'${tgt}' itself — transfer within a family is an assumption, not a `
      + 'measurement.');
  }
  if ((rel.license_lane || {}).commercial_ok === false) {
    notes.push('Metric-reliability evidence rides a non-commercial hold: the '
      + 'upstream WMT human-judgment data states no license, and its use '
      + 'beyond research has not yet been reviewed — cite it in research '
      + 'lanes only.');
  }
  return {
    section: {
      target_code: code,
      target_iso639_3: info?.iso639_3 ?? null,
      target_family: family,
      exact_pairs_measured: exactPairs,
      family_metrics: metricsOut,
      provenance: rel.provenance ?? null,
      ...(familyBasis ? { family_basis: familyBasis } : {}),
    },
    notes,
  };
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

/**
 * Assemble the full recommendation payload for one directed pair.
 *
 * The payload shape mirrors the harness's `mt-eval recommend --json` output
 * (snake_case keys) so machine consumers see one cross-runtime contract.
 *
 * @param {string} src
 * @param {string} tgt
 * @param {object} [opts]
 * @param {string} [opts.useContext]
 * @param {object|null} [opts.manifest] - Fixture for tests
 * @param {object|null} [opts.curated] - Fixture for tests
 * @param {object|null} [opts.bulk] - Fixture for tests
 * @param {object|null} [opts.reliability] - Fixture for tests
 * @param {Object<string,string>|null} [opts.env] - Fixture env for tests
 * @param {string} [opts.cwd]
 * @param {object|null} [opts.coverage] - Fixture method-coverage.json
 * @param {Function|null} [opts.cardSupport] - Fixture card lookup
 *   (code, method) → true/false/null; omitted = the card adapter
 * @param {Function|null} [opts.familyClaims] - Fixture family lookup for the
 *   metric-trust tier (code → {claims, problem}); omitted = cardFamilyClaims
 * @param {object} [opts.declared] - Fixture declaredModelCandidates() result;
 *   omitted = read from the target's language card
 * @returns {object}
 */
function recommend(src, tgt, {
  useContext = 'non-commercial',
  manifest = undefined,
  coverage = undefined,
  cardSupport = undefined,
  curated = undefined,
  bulk = undefined,
  reliability = undefined,
  familyClaims = null,
  declared = undefined,
  env = null,
  cwd = undefined,
} = {}) {
  const methods = dispatchableMethods(useContext,
    { manifest, env, cwd, src, tgt, coverage, cardSupport });
  const { rows: curatedRows, methodsIndex: citedMethods } = curatedEvidence(src, tgt, curated);
  const { rows: bulkRows, meta: bulkMeta } = bulkEvidence(src, tgt, { index: bulk });
  const declaredModels = declaredModelsSection(tgt, methods, curatedRows, bulkRows, { declared });
  const { section: reliabilitySection, notes: reliabilityNotes } =
    metricReliabilityEvidence(tgt, reliability, { familyClaims });

  // Join: which cited models are dispatchable / commercially deployable?
  const evidencedModels = [];
  const seen = new Set();
  for (const row of curatedRows) {
    const ref = row.method_ref;
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);
    const m = citedMethods[ref] || {};
    evidencedModels.push({
      id: ref,
      name: m.name ?? null,
      runnable_in_champollion: m.runnable_in_champollion === true,
      commercial_use: m.commercial_use ?? null,
      license: m.license ?? null,
    });
  }

  const notes = [
    'Cited evidence orders methods RELATIVE to each other on memorized '
    + 'public benchmarks — it is never absolute quality and never a '
    + 'deployment ranking (relative-comparison-only lane).',
    'Evidence and runnability are different axes: the best-evidenced '
    + 'model may not be dispatchable here, and NC-licensed weights are '
    + 'excluded from commercial-lane recommendations.',
  ];
  if (curated === undefined && cataloguePath('external-results.json') === null) {
    notes.push('Curated cited-results index not available in this install — '
      + 'tier skipped explicitly.');
  }
  if (bulk === undefined && cataloguePath('external-mt-index.json') === null) {
    notes.push('Bulk published-results index not bundled in the npm package '
      + '(1.6 MB) — tier skipped explicitly. Browse it at '
      + 'https://champollion.dev/catalogue, or run from a monorepo checkout '
      + '(or `mt-eval recommend`) for the full index.');
  }
  if (curatedRows.length === 0 && bulkRows.length === 0) {
    notes.push(
      `NO published evidence indexed for ${src}→${tgt}. That is the `
      + 'honest answer — measure instead of guessing: '
      + `\`mt-eval corpora --source ${src} --target ${tgt}\` lists runnable `
      + 'benchmarks, `mt-eval run` produces your own scored evidence.');
  }
  notes.push(...reliabilityNotes);

  return {
    pair: { source: src, target: tgt },
    use_context: useContext,
    runnable_methods: methods,
    // Open models whose model card declares the target, loadable by the
    // local-model engine: what to try when nothing is measured. A claim,
    // never evidence (declaredModelCandidates).
    declared_models: declaredModels,
    curated_evidence: curatedRows,
    bulk_evidence: bulkRows,
    bulk_meta: bulkMeta,
    evidenced_models: evidencedModels,
    metric_reliability: reliabilitySection,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * The declared-model section: open models whose own model card names the
 * target, labelled by what is true of each — runnable here with no published
 * evidence (the usual case), runnable with evidence above, excluded from the
 * lane, or declared with nothing here that loads it. Absent data is said,
 * never left out (a payload without the section — an older one — renders
 * nothing).
 *
 * @param {object} payload
 * @returns {string[]}
 */
function renderDeclaredModels(payload) {
  const d = payload.declared_models;
  if (!d) return [];
  const tgt = payload.pair.target;
  const out = [''];
  if (d.problem) {
    out.push(`Open models whose model card declares ${tgt}: none to suggest (${d.problem}).`);
    return out;
  }
  out.push(`Open models whose model card declares ${tgt} (${d.declared_total} declared`
    + `${d.listed < d.declared_total ? `, ${d.listed} named on the card` : ''}`
    + ' — the publisher\'s claim, not a measurement):');
  const e = d.engine;
  if (d.candidates.length === 0) {
    out.push(`  none in a format ${e ? e.method : 'local-model'} loads (a transformers checkpoint on Hugging Face, or a CTranslate2 directory).`);
  } else if (!e) {
    out.push('  DECLARED — no method in this registry loads them:');
  } else if (!e.lane_ok) {
    out.push(`  EXCLUDED — ${e.method}: ${e.lane_note}:`);
  } else {
    const label = (c) => (c.published_evidence ? 'RUNNABLE, PUBLISHED EVIDENCE ABOVE' : 'RUNNABLE, NO PUBLISHED EVIDENCE');
    const kinds = [...new Set(d.candidates.map(label))];
    out.push(`  ${kinds.join(' / ')} — via ${e.method} (${e.harness_only ? 'harness-only; ' : ''}${e.availability_detail}),`
      + ' in the card\'s order, not a ranking:');
  }
  for (const c of d.candidates) {
    const tag = e && e.lane_ok && c.published_evidence ? '  (published evidence above)' : '';
    out.push(`    ${c.id}   [${c.claim || 'claim'}; ${c.source || 'source not recorded'}]${tag}`);
  }
  const more = (d.loadable ?? d.candidates.length) - d.candidates.length;
  if (more > 0) {
    out.push(`    (+${more} more on the card in a format ${e ? e.method : 'local-model'} loads — `
      + `\`champollion network card ${tgt} --json\` lists every claim it names, under methodSupportEvidence)`);
  }
  if (d.candidates.length > 0 && e && e.lane_ok) {
    out.push(`    try one: ${d.candidates[0].run}`);
    out.push(`    (${e.method} runs seq2seq translation checkpoints — check the model card first)`);
  }
  if (d.not_loadable.length > 0) {
    const shown = d.not_loadable.slice(0, 3).join(', ');
    out.push(`  not loadable by ${e ? e.method : 'local-model'} by id (an adapter, a quantized or ONNX export, or a CTranslate2 conversion): ${shown}`
      + `${d.not_loadable.length > 3 ? `, … (${d.not_loadable.length} in all)` : ''}`);
  }
  return out;
}

/**
 * Human-readable rendering of a recommend() payload (mirrors the harness's
 * render_text, plus CLI-name and harness-only annotations).
 *
 * @param {object} payload
 * @returns {string}
 */
function renderText(payload) {
  const p = payload.pair;
  const out = [
    `Method guidance — ${p.source} → ${p.target}   (lane: ${payload.use_context})`,
    '',
  ];

  out.push('Runnable methods (shared/method-registry.json):');
  if (payload.runnable_methods.length === 0) {
    out.push('  (method registry not available in this install)');
  }
  const badges = {
    'ready': 'READY       ',
    // Runnable on keys alone, but no record confirms the pair: the "?" line
    // under it says why (not indexed, a count only, or records disagree).
    'unverified': 'UNVERIFIED  ',
    'needs-key': 'NEEDS KEY   ',
    'local-setup': 'LOCAL       ',
    // A recorded publisher list says the pair is not covered: whatever the
    // key state, this is not runnable for this pair (the reason is the detail).
    'unsupported': 'UNSUPPORTED ',
  };
  const mark = (c) => (c === 'not-listed' ? '✗' : c === 'unknown' || c === 'disputed' ? '?' : '↳');
  const indent = ' '.repeat(14);
  for (const m of payload.runnable_methods) {
    // Show the name a champollion.config.json actually uses when it differs
    // from the canonical registry name (e.g. openrouter → llm).
    const shown = m.cli_name && m.cli_name !== m.method
      ? `${m.method} (cli: ${m.cli_name})`
      : m.method;
    let line;
    if (!m.lane_ok) {
      line = `  EXCLUDED    ${shown.padEnd(22)}${m.lane_note}`;
    } else {
      const badge = badges[m.availability] || '?           ';
      line = `  ${badge}${shown.padEnd(22)}${m.availability_detail}`;
      if (m.license) line += `   [${m.license}]`;
    }
    out.push(line);
    // An UNSUPPORTED row already states why on its own line.
    if (m.lane_ok && m.availability !== 'unsupported') {
      if (m.target_coverage_note) {
        out.push(`${indent}${mark(m.target_coverage)} ${m.target_coverage_note}`);
      }
      // The source side is shown only when it adds something the target line
      // does not: a disagreement, or no record for the source alone.
      const sc = m.source_coverage;
      if (m.source_coverage_note && (sc === 'disputed'
        || (sc === 'unknown' && m.target_coverage !== 'unknown'))) {
        out.push(`${indent}${mark(sc)} source ${payload.pair.source}: ${m.source_coverage_note}`);
      }
    }
    if (m.runtime_note) out.push(`${indent}↳ ${m.runtime_note}`);
  }

  out.push(...renderDeclaredModels(payload));

  out.push('');
  out.push('Published evidence for this pair (cited — never reproduced '
    + 'by us; relative ordering only):');
  if (payload.curated_evidence.length === 0 && payload.bulk_evidence.length === 0) {
    out.push('  none indexed.');
  }
  for (const r of payload.curated_evidence) {
    const v = r.verified ? 'verified' : 'UNVERIFIED';
    out.push(`  [curated/${v}] ${r.benchmark} ${r.metric}=${r.value} — `
      + `${r.model}  (grade ${r.grade}; ${r.citation})`);
  }
  for (const r of payload.bulk_evidence) {
    out.push(`  [bulk] ${r.benchmark} ${r.metric}=${r.value} — ${r.model}  `
      + `(pair key ${r.pair_key})`);
  }
  if (payload.bulk_meta.truncated) {
    out.push(`  … ${payload.bulk_meta.total_rows} bulk rows total `
      + '(showing best-per-bucket head).');
  }

  if (payload.evidenced_models.length > 0) {
    out.push('');
    out.push('Evidenced models vs. dispatchability:');
    for (const m of payload.evidenced_models) {
      const bits = [];
      bits.push(m.runnable_in_champollion
        ? 'runnable in Champollion'
        : 'NOT dispatchable here yet');
      if (m.commercial_use === false) bits.push('weights NC — non-commercial only');
      out.push(`  ${m.name || m.id}: ${bits.join('; ')}`);
    }
  }

  const rel = payload.metric_reliability;
  if (rel) {
    const fmt = (v) => (v === null || v === undefined
      ? '    —'
      : `${v >= 0 ? '+' : ''}${v.toFixed(2)}`);
    out.push('');
    out.push(`Metric trust for the target (family: ${rel.target_family} — `
      + 'WMT human-judgment correlations; which metric to believe):');
    for (const m of rel.family_metrics) {
      const n = m.sys_n_pairs ?? m.seg_n_pairs ?? 0;
      out.push(`  ${m.metric.padEnd(18)} sys-Pearson ${fmt(m.sys_pearson)}   `
        + `seg-Kendall ${fmt(m.seg_kendall)}   (${n} pair(s))`);
    }
    const measured = rel.exact_pairs_measured.length > 0
      ? rel.exact_pairs_measured.join(', ')
      : 'none — family-level only';
    out.push(`  directly measured pairs for this target: ${measured}`);
    // How the target got its family when WMT never judged it: every claim
    // its card makes, disagreements included (the notes say which one the
    // roll-up rests on).
    if (rel.family_basis) {
      out.push(`  family per the target's language card: ${claimsText(rel.family_basis.claims)}`);
    }
  }

  out.push('');
  for (const n of payload.notes) {
    out.push(`⚠ ${n}`);
  }
  return out.join('\n');
}

export {
  cataloguePath,
  resolveAvailability,
  dispatchableMethods,
  curatedEvidence,
  bulkEvidence,
  cardFamilyClaims,
  declaredModelCandidates,
  metricReliabilityEvidence,
  recommend,
  renderText,
};
