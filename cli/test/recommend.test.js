/**
 * Tests: lib/recommend.js — the routing evidence surface.
 *
 * Mirrors the harness contract in arena/tests/test_recommend.py (the two
 * implementations port arena/mt_eval_harness/recommend.py — keep in sync).
 * The honesty contract is the test surface: availability resolution, STRICT
 * commercial-lane exclusion, direction-exactness of curated evidence,
 * relative-only framing of bulk evidence, the evidenced-vs-dispatchable
 * split, and the explicit no-evidence state.
 *
 * CLI-specific additions on top of the Python contract:
 *   - provider-env reconciliation (aliases accepted; non-credential registry
 *     vars like *_REGION never read as "ready")
 *   - harness-only entries point at mt-eval (findHarnessOnlyEntry parity)
 *   - cli_name surfacing (openrouter → llm)
 *   - end-to-end: `champollion recommend` routing, --json stdout purity,
 *     ISO 639-3 code resolution (en → eng)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

import {
  resolveAvailability,
  dispatchableMethods,
  curatedEvidence,
  bulkEvidence,
  metricReliabilityEvidence,
  cardFamilyClaims,
  recommend,
  renderText,
} from '../lib/recommend.js';
import { LANE_RELATIVE_ONLY } from '../lib/contamination-lane.js';
import { isMethodSupported } from '../lib/registers.js';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// The REAL method registry (what an install ships), for the keyless checks.
const REAL_REGISTRY = JSON.parse(fs.readFileSync(
  fileURLToPath(new URL('../shared/method-registry.json', import.meta.url)), 'utf-8'));

// ---------------------------------------------------------------------------
// Fixtures — same shapes as arena/tests/test_recommend.py
// ---------------------------------------------------------------------------

const MANIFEST = {
  entries: {
    'google-translate': {
      kind: 'mt-api', paradigm: 'neural-nmt',
      env: ['GOOGLE_TRANSLATE_API_KEY', 'GOOGLE_API_KEY'],
      license: 'Proprietary (Google ToS)', commercialReady: true,
    },
    'libretranslate': {
      kind: 'mt-api', paradigm: 'neural-nmt',
      env: ['LIBRETRANSLATE_API_URL'],
      license: 'AGPL-3.0', commercialReady: false,
    },
    'local-model': {
      kind: 'local-model', paradigm: 'neural-nmt',
      optional_extra: 'local-models',
      license: 'Per-model', commercialReady: false,
      runtimes: ['harness'],
    },
    'amazon-translate': {
      kind: 'mt-api', paradigm: 'neural-nmt',
      env: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION'],
      credential_env: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'],
      credential_env_all: true,
      optional_extra: 'aws',
      license: 'Proprietary (AWS)', commercialReady: true,
      runtimes: ['harness'],
    },
  },
};

const CURATED = {
  results: [
    {
      model: 'NLLB-200-3.3B', benchmark: 'FLORES-200 devtest',
      metric: 'chrF++', value: 41.2, verified: true,
      citation: 'NLLB Team (2022)', source_url: 'https://x',
      method_ref: 'nllb-200',
      pair: { source: 'eng', target: 'yor' },
      signal_strength: { grade: 'B', contamination: 'HIGH' },
    },
    { // reverse direction — must NOT match eng→yor
      model: 'NLLB-200-3.3B', benchmark: 'FLORES-200 devtest',
      metric: 'chrF++', value: 55.0, verified: true,
      citation: 'NLLB Team (2022)', source_url: 'https://x',
      method_ref: 'nllb-200',
      pair: { source: 'yor', target: 'eng' },
      signal_strength: { grade: 'B', contamination: 'HIGH' },
    },
  ],
  methods: [
    { id: 'nllb-200', name: 'NLLB-200', commercial_use: false,
      license: 'CC-BY-NC-4.0', runnable_in_champollion: false },
  ],
};

const BULK = {
  models: ['Tatoeba-MT-models/eng-yor/opus-2021', 'other/model'],
  contamination_posture: { 'flores200-devtest': 'HIGH — relative-only' },
  pairs: {
    'eng-yor': { 'flores200-devtest': { chrf_pp: [0, 24.3], bleu: [0, 5.0] } },
    'eng_Latn-zul': { 'flores200-devtest': { bleu: [1, 12.0] } },
  },
};

function payloadFor(src = 'eng', tgt = 'yor') {
  return recommend(src, tgt, {
    manifest: MANIFEST, curated: CURATED, bulk: BULK, env: {},
  });
}

// ---------------------------------------------------------------------------
// Tier 1 — availability
// ---------------------------------------------------------------------------

describe('resolveAvailability', () => {
  it('key present is ready', () => {
    const r = resolveAvailability('google-translate',
      MANIFEST.entries['google-translate'], { env: { GOOGLE_API_KEY: 'x' } });
    assert.equal(r.status, 'ready');
    assert.ok(r.detail.includes('GOOGLE_API_KEY'));
  });

  it('key absent names the vars', () => {
    const r = resolveAvailability('google-translate',
      MANIFEST.entries['google-translate'], { env: {} });
    assert.equal(r.status, 'needs-key');
    assert.ok(r.detail.includes('GOOGLE_TRANSLATE_API_KEY'));
  });

  it('a keyless method is ready without any key (local → this machine, apertium → public API)', () => {
    const local = resolveAvailability('local', REAL_REGISTRY.entries.local, { env: {} });
    assert.equal(local.status, 'ready');
    assert.match(local.detail, /no key needed/);
    const apertium = resolveAvailability('apertium', REAL_REGISTRY.entries.apertium, { env: {} });
    assert.equal(apertium.status, 'ready');
  });

  it('a hosted API with a default endpoint still needs its key', () => {
    // Regression (2026-10-03): "default_base_url ⇒ ready" made Anthropic,
    // OpenAI, Gemini, OpenRouter, Tilde and Lara read "no key needed".
    const hosted = Object.entries(REAL_REGISTRY.entries)
      .filter(([, e]) => e.default_base_url && !e.keyless);
    assert.ok(hosted.length >= 4, 'the registry has hosted APIs with default URLs');
    for (const [name, entry] of hosted) {
      const r = resolveAvailability(name, entry, { env: {} });
      assert.equal(r.status, 'needs-key', `${name}: ${r.detail}`);
    }
  });

  it('local model is local-setup', () => {
    const r = resolveAvailability('local-model',
      MANIFEST.entries['local-model'], { env: {} });
    assert.equal(r.status, 'local-setup');
  });

  it('API with pip extra stays on the env-key axis, extra as a note', () => {
    const r = resolveAvailability('amazon-translate',
      MANIFEST.entries['amazon-translate'], { env: {} });
    assert.equal(r.status, 'needs-key');
    assert.ok(r.detail.includes("pip extra 'aws'"));
  });

  it('provider-env aliases are accepted (loader parity)', () => {
    // AZURE_TRANSLATOR_KEY is an alias the loader reads — the verdict must
    // agree with the loader, not just the canonical name.
    const entry = {
      kind: 'mt-api',
      env: ['MICROSOFT_TRANSLATOR_API_KEY', 'AZURE_TRANSLATOR_KEY',
        'MICROSOFT_TRANSLATOR_REGION', 'MICROSOFT_TRANSLATOR_ENDPOINT'],
    };
    const r = resolveAvailability('microsoft-translator', entry,
      { env: { AZURE_TRANSLATOR_KEY: 'x' } });
    assert.equal(r.status, 'ready');
    assert.ok(r.detail.includes('AZURE_TRANSLATOR_KEY'));
  });

  it('non-credential registry vars never read as ready', () => {
    // The registry env list names *_REGION/*_ENDPOINT config vars; a
    // region-only environment has no credential and must stay needs-key.
    const entry = {
      kind: 'mt-api',
      env: ['MICROSOFT_TRANSLATOR_API_KEY', 'AZURE_TRANSLATOR_KEY',
        'MICROSOFT_TRANSLATOR_REGION', 'MICROSOFT_TRANSLATOR_ENDPOINT'],
    };
    const r = resolveAvailability('microsoft-translator', entry,
      { env: { MICROSOFT_TRANSLATOR_REGION: 'westus' } });
    assert.equal(r.status, 'needs-key');
  });

  it('config var alone never reads ready for providers outside PROVIDER_ENV', () => {
    // amazon-translate is harness-only (no PROVIDER_ENV entry), so before the
    // credential_env metadata a region-only environment fell through to the
    // raw registry list and read "READY — AWS_REGION is set". A region is
    // not auth: it must stay needs-key, and the fix suggested must be the
    // key pair, not the region.
    const r = resolveAvailability('amazon-translate',
      MANIFEST.entries['amazon-translate'], { env: { AWS_REGION: 'us-east-1' } });
    assert.equal(r.status, 'needs-key');
    assert.ok(!r.detail.includes('AWS_REGION'));
    assert.ok(r.detail.includes('AWS_ACCESS_KEY_ID'));
    assert.ok(r.detail.includes('AWS_SECRET_ACCESS_KEY'));
  });

  it('key-pair auth (credential_env_all) requires every var', () => {
    const idOnly = resolveAvailability('amazon-translate',
      MANIFEST.entries['amazon-translate'], { env: { AWS_ACCESS_KEY_ID: 'AKIA' } });
    assert.equal(idOnly.status, 'needs-key');
    assert.ok(idOnly.detail.includes('AWS_SECRET_ACCESS_KEY'));
    assert.ok(idOnly.detail.includes('alone is not enough'));

    const both = resolveAvailability('amazon-translate',
      MANIFEST.entries['amazon-translate'],
      { env: { AWS_ACCESS_KEY_ID: 'a', AWS_SECRET_ACCESS_KEY: 's' } });
    assert.equal(both.status, 'ready');
    assert.ok(both.detail.includes('AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY'));
  });

  it('credential_env_all beats the PROVIDER_ENV any-of list (Lara key pair)', () => {
    // 'translated' IS in PROVIDER_ENV (canonical LARA_ACCESS_KEY_ID, any-of),
    // but Lara authenticates with a key PAIR — the registry's
    // credential_env_all must win, so the id alone never reads ready.
    const entry = {
      kind: 'mt-api',
      env: ['LARA_ACCESS_KEY_ID', 'LARA_ACCESS_KEY_SECRET'],
      credential_env: ['LARA_ACCESS_KEY_ID', 'LARA_ACCESS_KEY_SECRET'],
      credential_env_all: true,
    };
    const idOnly = resolveAvailability('translated', entry,
      { env: { LARA_ACCESS_KEY_ID: 'x' } });
    assert.equal(idOnly.status, 'needs-key');
    assert.ok(idOnly.detail.includes('LARA_ACCESS_KEY_SECRET'));

    const both = resolveAvailability('translated', entry,
      { env: { LARA_ACCESS_KEY_ID: 'x', LARA_ACCESS_KEY_SECRET: 'y' } });
    assert.equal(both.status, 'ready');
  });

  it('credential_env subset applies when PROVIDER_ENV has no entry (any-of)', () => {
    // Mirrors the harness contract: a harness-only microsoft-style entry —
    // REGION/ENDPOINT stay in env for the adapter, only the credential
    // subset counts, and its members are any-of aliases (not a pair).
    const entry = {
      kind: 'mt-api',
      env: ['FAKE_API_KEY', 'FAKE_KEY_ALIAS', 'FAKE_REGION'],
      credential_env: ['FAKE_API_KEY', 'FAKE_KEY_ALIAS'],
    };
    const regionOnly = resolveAvailability('fake-translator', entry,
      { env: { FAKE_REGION: 'westus' } });
    assert.equal(regionOnly.status, 'needs-key');
    const aliasKey = resolveAvailability('fake-translator', entry,
      { env: { FAKE_KEY_ALIAS: 'k' } });
    assert.equal(aliasKey.status, 'ready');
    assert.ok(aliasKey.detail.includes('FAKE_KEY_ALIAS'));
  });
});

// ---------------------------------------------------------------------------
// Tier 1 — license lane
// ---------------------------------------------------------------------------

describe('dispatchableMethods lane', () => {
  it('commercial lane is STRICT', () => {
    const rows = dispatchableMethods('commercial', { manifest: MANIFEST, env: {} });
    const by = Object.fromEntries(rows.map((r) => [r.method, r]));
    assert.equal(by['google-translate'].lane_ok, true);
    assert.equal(by['libretranslate'].lane_ok, false);
    assert.ok(by['libretranslate'].lane_note.includes('AGPL'));
  });

  it('non-commercial lane includes all', () => {
    const rows = dispatchableMethods('non-commercial', { manifest: MANIFEST, env: {} });
    assert.ok(rows.every((r) => r.lane_ok));
  });

  it('excluded methods sort last', () => {
    const rows = dispatchableMethods('commercial', { manifest: MANIFEST, env: {} });
    assert.equal(rows[rows.length - 1].lane_ok, false);
  });

  it('harness-only entries point at mt-eval (findHarnessOnlyEntry parity)', () => {
    const rows = dispatchableMethods('non-commercial', { manifest: MANIFEST, env: {} });
    const by = Object.fromEntries(rows.map((r) => [r.method, r]));
    assert.equal(by['amazon-translate'].harness_only, true);
    assert.ok(by['amazon-translate'].runtime_note.includes(
      'mt-eval run --method amazon-translate'));
    assert.equal(by['local-model'].harness_only, true);
    assert.equal(by['google-translate'].harness_only, false);
    assert.equal(by['google-translate'].runtime_note, null);
  });

  it('cli_name is surfaced (openrouter → llm)', () => {
    const manifest = {
      entries: {
        openrouter: {
          kind: 'llm-provider', cli_name: 'llm',
          env: ['OPENROUTER_API_KEY'], license: 'Proprietary (per-model)',
          commercialReady: true,
        },
      },
    };
    const rows = dispatchableMethods('non-commercial', { manifest, env: {} });
    assert.equal(rows[0].cli_name, 'llm');
    const text = renderText(recommend('eng', 'yor', {
      manifest, curated: {}, bulk: {}, env: {},
    }));
    assert.ok(text.includes('openrouter (cli: llm)'));
  });

  it('missing manifest degrades to an empty list', () => {
    assert.deepEqual(dispatchableMethods('commercial', { manifest: null, env: {} }), []);
  });
});

// ---------------------------------------------------------------------------
// Tier 2 — curated evidence
// ---------------------------------------------------------------------------

describe('curatedEvidence', () => {
  it('is direction-exact', () => {
    const { rows } = curatedEvidence('eng', 'yor', CURATED);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].value, 41.2);
  });

  it('keeps the reverse direction separate', () => {
    const { rows } = curatedEvidence('yor', 'eng', CURATED);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].value, 55.0);
  });

  it('maps HIGH contamination to the relative-only lane', () => {
    const { rows } = curatedEvidence('eng', 'yor', CURATED);
    assert.equal(rows[0].lane, LANE_RELATIVE_ONLY);
  });

  it('degrades empty when the catalogue is missing', () => {
    const { rows, methodsIndex } = curatedEvidence('eng', 'yor', {});
    assert.deepEqual(rows, []);
    assert.deepEqual(methodsIndex, {});
  });
});

// ---------------------------------------------------------------------------
// Tier 3 — bulk evidence
// ---------------------------------------------------------------------------

describe('bulkEvidence', () => {
  it('resolves model names and stays relative-only', () => {
    const { rows } = bulkEvidence('eng', 'yor', { index: BULK });
    assert.deepEqual(new Set(rows.map((r) => r.metric)), new Set(['chrf_pp', 'bleu']));
    assert.ok(rows[0].model.startsWith('Tatoeba-MT-models/'));
    assert.ok(rows.every((r) => r.lane === LANE_RELATIVE_ONLY));
  });

  it('matches script-suffix keys on the base code, surfacing the exact key', () => {
    const { rows } = bulkEvidence('eng', 'zul', { index: BULK });
    assert.equal(rows.length, 1);
    // the exact upstream key is surfaced, never silently relabelled
    assert.equal(rows[0].pair_key, 'eng_Latn-zul');
  });

  it('returns no rows for an unknown pair', () => {
    const { rows } = bulkEvidence('eng', 'quy', { index: BULK });
    assert.deepEqual(rows, []);
  });

  it('truncates to maxRows with honest meta', () => {
    const { rows, meta } = bulkEvidence('eng', 'yor', { index: BULK, maxRows: 1 });
    assert.equal(rows.length, 1);
    assert.equal(meta.truncated, true);
    assert.equal(meta.total_rows, 2);
  });
});

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

describe('recommend assembly', () => {
  it('evidenced-models join flags NC and undispatchable', () => {
    const p = payloadFor();
    assert.equal(p.evidenced_models.length, 1);
    const m = p.evidenced_models[0];
    assert.equal(m.runnable_in_champollion, false);
    assert.equal(m.commercial_use, false);
  });

  it('no-evidence state is explicit', () => {
    const p = payloadFor('eng', 'quy');
    assert.deepEqual(p.curated_evidence, []);
    assert.deepEqual(p.bulk_evidence, []);
    assert.ok(p.notes.some((n) => n.includes('NO published evidence')));
    assert.ok(p.notes.some((n) => n.includes('mt-eval corpora')));
  });

  it('relative-only notice is always present', () => {
    const p = payloadFor();
    assert.ok(p.notes.some((n) => n.includes('never absolute quality')));
  });

  it('renderText smoke', () => {
    const text = renderText(payloadFor());
    assert.ok(text.includes('eng → yor'));
    assert.ok(text.includes('NEEDS KEY'));
    assert.ok(text.includes('relative ordering only'));
    const text2 = renderText(payloadFor('eng', 'quy'));
    assert.ok(text2.includes('none indexed'));
  });
});

// ---------------------------------------------------------------------------
// End-to-end: the actual `champollion recommend` entry point
// ---------------------------------------------------------------------------

const CLI_PATH = path.join(import.meta.dirname, '..', 'bin', 'cli.js');

function runCLI(args) {
  try {
    const stdout = execFileSync(process.execPath, [CLI_PATH, ...args],
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { stdout, stderr: '', status: 0 };
  } catch (err) {
    return { stdout: err.stdout || '', stderr: err.stderr || '', status: err.status || 1 };
  }
}

describe('champollion recommend (e2e)', () => {
  it('missing args exits 1 with usage', () => {
    const { status, stderr } = runCLI(['recommend', 'eng']);
    assert.equal(status, 1);
    assert.ok(stderr.includes('Usage: champollion network recommend'));
  });

  it('invalid --use lane exits 1', () => {
    const { status, stderr } = runCLI(['recommend', 'eng', 'yor', '--use', 'freelance']);
    assert.equal(status, 1);
    assert.ok(stderr.includes('--use'));
  });

  it('--json emits one pure JSON document on stdout', () => {
    const { status, stdout } = runCLI(['recommend', 'eng', 'yor', '--json']);
    assert.equal(status, 0);
    const payload = JSON.parse(stdout); // throws if stdout isn't pure JSON
    assert.equal(payload.pair.source, 'eng');
    assert.equal(payload.pair.target, 'yor');
    assert.ok(Array.isArray(payload.runnable_methods));
    assert.ok(payload.runnable_methods.length > 0, 'real registry should load');
    assert.ok(Array.isArray(payload.notes));
  });

  it('resolves 2-letter codes to ISO 639-3 and says so', () => {
    const { status, stdout } = runCLI(['recommend', 'en', 'fr', '--json']);
    assert.equal(status, 0);
    const payload = JSON.parse(stdout);
    assert.equal(payload.pair.source, 'eng');
    assert.equal(payload.pair.target, 'fra');
    assert.equal(payload.pair.source_input, 'en');
    assert.equal(payload.pair.target_input, 'fr');
  });

  it('commercial lane excludes AGPL engines with reasons (real registry)', () => {
    const { status, stdout } = runCLI(['recommend', 'eng', 'yor', '--use', 'commercial', '--json']);
    assert.equal(status, 0);
    const payload = JSON.parse(stdout);
    const libre = payload.runnable_methods.find((m) => m.method === 'libretranslate');
    assert.ok(libre, 'libretranslate should be listed, not silently dropped');
    assert.equal(libre.lane_ok, false);
    assert.ok(libre.lane_note.includes('AGPL'));
  });
});

// ---------------------------------------------------------------------------
// Tier 4 — metric-reliability evidence (mirrors TestMetricReliability in
// arena/tests/test_recommend.py; same fixture shape)
// ---------------------------------------------------------------------------

const RELIABILITY = {
  languages: {
    iu: { iso639_3: 'iku', family: 'Eskimo-Aleut', genus: 'Inuit' },
    de: { iso639_3: 'deu', family: 'Indo-European', genus: 'Global German' },
  },
  families: {
    'Eskimo-Aleut': {
      n_pairs: 1,
      metrics: {
        comet_score: {
          sys: {
            n_cells: 1, n_pairs: 1, weight: 10, pairs: ['wmt20:en-iu'],
            pearson_weighted_mean: 0.8598, pairwise_accuracy_weighted_mean: 0.8,
          },
          seg: {
            n_cells: 1, n_pairs: 1, weight: 5000, pairs: ['wmt20:en-iu'],
            kendall_tau_b_weighted_mean: 0.21,
          },
        },
        bleu: {
          sys: {
            n_cells: 1, n_pairs: 1, weight: 10, pairs: ['wmt20:en-iu'],
            pearson_weighted_mean: 0.1629,
          },
        },
      },
    },
  },
  cells: [
    { pair: 'en-iu', tgt: 'iu', preferred: true },
    { pair: 'en-de', tgt: 'de', preferred: true },
  ],
  license_lane: { commercial_ok: false, note: 'founder review pending' },
  provenance: 'champollion-derived [derived from mt-metrics-eval]',
};

describe('metricReliabilityEvidence (tier 4 — which metric to believe)', () => {
  it('exact-language hit orders metrics by sys-Pearson', () => {
    const { section, notes } = metricReliabilityEvidence('iu', RELIABILITY);
    assert.equal(section.target_family, 'Eskimo-Aleut');
    assert.deepEqual(section.exact_pairs_measured, ['en-iu']);
    assert.deepEqual(section.family_metrics.map((m) => m.metric),
      ['comet_score', 'bleu']);
    assert.equal(section.family_metrics[0].sys_pearson, 0.8598);
    assert.ok(!notes.some((n) => n.includes('assumption')));
    assert.ok(notes.some((n) => n.includes('non-commercial hold')));
  });

  it('resolves iso639-3 codes (the CLI passes iku, not iu)', () => {
    const { section } = metricReliabilityEvidence('iku', RELIABILITY);
    assert.ok(section);
    assert.equal(section.target_code, 'iu');
  });

  it('unmeasured language is explicit, never borrowed numbers', () => {
    const { section, notes } = metricReliabilityEvidence('crk', RELIABILITY);
    assert.equal(section, null);
    assert.ok(notes.some((n) => n.includes('UNMEASURED')));
  });

  it('family-transfer caveat when no exact pair was judged', () => {
    const rel = { ...RELIABILITY, cells: [{ pair: 'en-de', tgt: 'de', preferred: true }] };
    const { section, notes } = metricReliabilityEvidence('iu', rel);
    assert.deepEqual(section.exact_pairs_measured, []);
    assert.ok(notes.some((n) => n.includes('assumption, not a measurement')));
  });

  it('absent index is an explicit note (npm installs do not bundle it)', () => {
    const { section, notes } = metricReliabilityEvidence('iu', null);
    assert.equal(section, null);
    assert.ok(notes.some((n) => n.includes('skipped explicitly')));
  });

  it('recommend() payload carries the section and renderText shows it', () => {
    const payload = recommend('eng', 'iu', {
      manifest: MANIFEST, curated: CURATED, bulk: BULK,
      reliability: RELIABILITY, env: {},
    });
    assert.equal(payload.metric_reliability.target_family, 'Eskimo-Aleut');
    assert.ok(payload.notes.some((n) => n.includes('non-commercial hold')));
    const text = renderText(payload);
    assert.ok(text.includes('Metric trust for the target'));
    assert.ok(text.includes('comet_score'));
    assert.ok(text.includes('+0.86'));
    assert.ok(text.includes('directly measured pairs for this target: en-iu'));
  });
});

describe('target coverage', () => {
  // READY meant "no key missing" and read as "works for your language"
  // (Round 1: Apertium READY for English→Ayta).
  const coverage = { methods: [{ key: 'deepl', iso6393: ['fra'] }] };
  const manifest = { entries: {
    deepl: { kind: 'mt-api', env: ['DEEPL_API_KEY'] },
    apertium: { kind: 'mt-api', env: ['APERTIUM_API_URL'], keyless: true, default_base_url: 'https://apertium.org/apy' },
    local: { kind: 'llm-provider', env: ['LOCAL_API_BASE'], keyless: true },
  } };
  const row = (name, tgt, cardSupport = null) => recommend('eng', tgt,
    { manifest, coverage, cardSupport, curated: null, bulk: null, reliability: null, env: {} })
    .runnable_methods.find((r) => r.method === name);

  it('says listed / not listed from the publisher list, unknown when there is none', () => {
    assert.equal(row('deepl', 'fra').target_coverage, 'listed');
    assert.equal(row('deepl', 'abc').target_coverage, 'not-listed');
    assert.equal(row('apertium', 'abc').target_coverage, 'unknown');
    assert.equal(row('local', 'abc').target_coverage, 'any');
  });

  it('a method a recorded list says does not cover the target is UNSUPPORTED, never READY', () => {
    // apertium is keyless (READY on keys alone); only the card records it.
    const card = (code, method) => (method === 'apertium' ? false : null);
    const r = row('apertium', 'xyz', card);
    assert.equal(r.target_coverage, 'not-listed');
    assert.equal(r.availability, 'unsupported');
    assert.equal(r.key_availability, 'ready', 'the credential verdict stays readable');
    assert.match(r.availability_detail, /xyz is NOT in its published language list \(language card\)/);
  });

  it('"not indexed" is said only when nothing is recorded', () => {
    const r = row('apertium', 'xyz', () => null);
    assert.equal(r.target_coverage, 'unknown');
    assert.match(r.target_coverage_note, /not indexed/);
    assert.equal(r.availability, 'unverified');
  });

  // Round 5, hospital persona (en→abc): Apertium READY while its coverage of
  // abc was not indexed anywhere. READY means known to cover the pair.
  it('coverage nobody records is UNVERIFIED, never READY — the key verdict stays readable', () => {
    const r = row('apertium', 'abc', () => null);
    assert.equal(r.target_coverage, 'unknown');
    assert.equal(r.availability, 'unverified');
    assert.equal(r.key_availability, 'ready');
    assert.match(r.availability_detail, /no key needed/, 'how to run it is still said');
  });

  it('coverage every record confirms on both sides is READY', () => {
    const r = row('apertium', 'fra', (code, method) => (method === 'apertium' ? true : null));
    assert.equal(r.target_coverage, 'listed');
    assert.equal(r.source_coverage, 'listed');
    assert.equal(r.availability, 'ready');
  });

  it('an unconfirmed SOURCE side is unverified too', () => {
    const r = row('apertium', 'fra', (code, method) => (method === 'apertium' && code === 'fra' ? true : null));
    assert.equal(r.target_coverage, 'listed');
    assert.equal(r.source_coverage, 'unknown');
    assert.equal(r.availability, 'unverified');
  });

  it('records that disagree leave a keyless method unverified, not ready', () => {
    const both = { methods: [{ key: 'apertium', iso6393: ['eng', 'fra'] }] };
    const r = recommend('eng', 'fra', { manifest, coverage: both,
      cardSupport: (code, method) => (method === 'apertium' && code === 'fra' ? false : null),
      curated: null, bulk: null, reliability: null, env: {} })
      .runnable_methods.find((m) => m.method === 'apertium');
    assert.equal(r.target_coverage, 'disputed');
    assert.equal(r.availability, 'unverified');
  });

  it('a missing key still reads NEEDS KEY when coverage is unknown (the key is the first blocker)', () => {
    const r = recommend('eng', 'abc', { manifest: { entries: {
      'amazon-translate': { kind: 'mt-api', env: ['AWS_ACCESS_KEY_ID'] } } },
    coverage, cardSupport: null, curated: null, bulk: null, reliability: null, env: {} })
      .runnable_methods[0];
    assert.equal(r.target_coverage, 'unknown');
    assert.equal(r.availability, 'needs-key');
  });

  it('unverified sorts after ready and before needs-key, and renders its own badge', () => {
    const withKeyed = { entries: { ...manifest.entries,
      'amazon-translate': { kind: 'mt-api', env: ['AWS_ACCESS_KEY_ID'] } } };
    const p = recommend('eng', 'abc', { manifest: withKeyed, coverage, cardSupport: () => null,
      curated: null, bulk: null, reliability: null, env: {} });
    const order = p.runnable_methods.map((m) => `${m.availability}:${m.method}`);
    assert.deepEqual(order,
      ['ready:local', 'unverified:apertium', 'needs-key:amazon-translate', 'unsupported:deepl']);
    const text = renderText(p);
    assert.match(text, /UNVERIFIED {2}apertium/);
    assert.doesNotMatch(text, /READY\s+apertium/);
    assert.match(text, /\? language coverage not indexed — check the service/);
  });

  it('records that disagree are both named, and do not make the method unsupported', () => {
    // method-coverage lists fra for deepl; a card saying no is a disagreement.
    const both = { methods: [{ key: 'deepl', iso6393: ['eng', 'fra'] }] };
    const r = recommend('eng', 'fra', { manifest, coverage: both,
      cardSupport: (code, method) => (method === 'deepl' && code === 'fra' ? false : null),
      curated: null, bulk: null, reliability: null, env: {} })
      .runnable_methods.find((m) => m.method === 'deepl');
    assert.equal(r.source_coverage, 'listed');
    assert.equal(r.target_coverage, 'disputed');
    assert.match(r.target_coverage_note, /listed per method-coverage\.json, NOT listed per language card/);
    assert.equal(r.availability, 'needs-key');
  });

  it('the source side counts: a source the publisher does not list makes the pair unsupported', () => {
    const p = recommend('xyz', 'fra', { manifest, coverage, cardSupport: null,
      curated: null, bulk: null, reliability: null, env: {} });
    const r = p.runnable_methods.find((m) => m.method === 'deepl');
    assert.equal(r.target_coverage, 'listed');
    assert.equal(r.source_coverage, 'not-listed');
    assert.equal(r.availability, 'unsupported');
  });
});

describe('target coverage — the real crk card (card and recommend agree)', () => {
  // Persona finding: `champollion network card crk` printed "apertium ✗
  // unsupported" while `champollion network recommend eng crk` printed
  // "READY apertium … ? language coverage not indexed". The two read
  // different records; recommend now reads the card through the adapter.
  it('the card adapter records apertium as not covering crk', () => {
    assert.equal(isMethodSupported('crk', 'apertium'), false);
  });

  it('recommend eng→crk: apertium is UNSUPPORTED (not READY), cited to the card', () => {
    const p = recommend('eng', 'crk', { curated: null, bulk: null, reliability: null, env: {} });
    const ap = p.runnable_methods.find((m) => m.method === 'apertium');
    assert.equal(ap.availability, 'unsupported');
    assert.equal(ap.target_coverage, 'not-listed');
    assert.match(ap.target_coverage_note, /crk is NOT in its published language list \(.*language card.*\)/);
    assert.doesNotMatch(ap.target_coverage_note, /not indexed/);
    const text = renderText(p);
    assert.match(text, /UNSUPPORTED apertium/);
    assert.doesNotMatch(text, /READY\s+apertium/);
  });

  it('every service the crk card answers for agrees with recommend', () => {
    const p = recommend('eng', 'crk', { curated: null, bulk: null, reliability: null, env: {} });
    for (const m of p.runnable_methods) {
      const onCard = isMethodSupported('crk', m.method);
      if (onCard === false) {
        assert.equal(m.availability, 'unsupported', `${m.method}: card says unsupported`);
      }
    }
  });

  it('the CLI says so end to end', () => {
    const { status, stdout } = runCLI(['network', 'recommend', 'eng', 'crk', '--json']);
    assert.equal(status, 0);
    const ap = JSON.parse(stdout).runnable_methods.find((m) => m.method === 'apertium');
    assert.equal(ap.availability, 'unsupported');
  });
});

describe('unindexed coverage — the real abc card (Round 5, hospital persona)', () => {
  // `champollion network recommend eng abc` printed "READY apertium" while
  // nothing records Apertium's coverage of abc: the card has no
  // methodSupport and method-coverage.json has no Apertium list.
  it('nothing records apertium for abc', () => {
    assert.equal(isMethodSupported('abc', 'apertium'), null);
  });

  it('the CLI labels apertium UNVERIFIED, in text and in --json', () => {
    const json = runCLI(['network', 'recommend', 'eng', 'abc', '--json']);
    assert.equal(json.status, 0);
    const methods = JSON.parse(json.stdout).runnable_methods;
    const ap = methods.find((m) => m.method === 'apertium');
    assert.equal(ap.availability, 'unverified');
    assert.equal(ap.target_coverage, 'unknown');
    assert.equal(ap.key_availability, 'ready');
    for (const m of methods.filter((x) => x.availability === 'ready')) {
      assert.ok(['listed', 'any'].includes(m.target_coverage), `${m.method} READY with ${m.target_coverage} coverage`);
    }
    const text = runCLI(['network', 'recommend', 'eng', 'abc']);
    assert.equal(text.status, 0);
    assert.match(text.stdout, /UNVERIFIED {2}apertium/);
    assert.doesNotMatch(text.stdout, /READY\s+apertium/);
  });
});

describe('pair availability — cross-runtime parity with the harness', () => {
  // The same availability per method, from arena/mt_eval_harness/recommend.py
  // on the same registry, coverage list and cards (empty env on both sides,
  // so only keyless methods can be ready). PYTHONPATH and the cards dir are
  // pinned to this checkout, as in the tier-4 parity test.
  const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const ARENA = path.join(REPO, 'arena');
  const PAIRS = [['eng', 'abc'], ['eng', 'crk'], ['eng', 'fra']];

  it('eng→abc, eng→crk and eng→fra get the same availability in JS and Python', (t) => {
    if (!fs.existsSync(path.join(ARENA, 'mt_eval_harness', 'recommend.py'))) {
      return t.skip('the harness is not in this checkout (packaged install)');
    }
    const script = [
      'import json, sys',
      'try:',
      '    import mt_eval_harness',
      '    from mt_eval_harness.recommend import recommend',
      'except ModuleNotFoundError as exc:',
      '    print(json.dumps({"skip": f"harness import needs {exc.name}"})); sys.exit(0)',
      'out = {"harness": mt_eval_harness.__file__, "pairs": {}}',
      `for src, tgt in ${JSON.stringify(PAIRS)}:`,
      '    p = recommend(src, tgt, env={}, curated={}, bulk={}, reliability={})',
      '    out["pairs"][f"{src}-{tgt}"] = {m["method"]: m["availability"] for m in p["runnable_methods"]}',
      'print(json.dumps(out))',
    ].join('\n');
    const r = spawnSync('python3', ['-c', script], {
      encoding: 'utf-8',
      timeout: 60000,
      env: {
        ...process.env,
        PYTHONPATH: ARENA,
        MT_EVAL_CARDS_DIR: path.join(REPO, 'cli', 'shared', 'language-cards'),
      },
    });
    if (r.error && r.error.code === 'ENOENT') return t.skip('python3 not available');
    assert.equal(r.status, 0, r.stderr);
    const py = JSON.parse(r.stdout);
    if (py.skip) return t.skip(py.skip);
    assert.ok(py.harness.startsWith(ARENA), `imported ${py.harness}, not this checkout's harness`);
    for (const [src, tgt] of PAIRS) {
      const js = Object.fromEntries(recommend(src, tgt, { curated: null, bulk: null, reliability: null, env: {} })
        .runnable_methods.map((m) => [m.method, m.availability]));
      assert.deepEqual(js, py.pairs[`${src}-${tgt}`], `${src}→${tgt}`);
    }
    assert.equal(py.pairs['eng-abc'].apertium, 'unverified');
  });
});

// ---------------------------------------------------------------------------
// Tier 4 — the family roll-up (parity with the harness fix; mirrors
// arena/tests/test_reliability_family_contradiction.py, same fixture)
//
// Round-3 synthetic researcher, eng→sme: the reliability surface listed
// Uralic as a family WITH WMT human-judgment evidence, then said no evidence
// covered sme "directly or via its family". The lookup only matched the
// index's judged languages and never resolved the target's family; the
// harness was fixed to read the card's family claims, and this runtime (which
// the MCP language_overview reads) had the same gap.
// ---------------------------------------------------------------------------

const FAMILY_RELIABILITY = {
  languages: {
    fi: { iso639_3: 'fin', family: 'Uralic', genus: 'Finnic' },
    xh: { iso639_3: 'xho', family: 'Niger-Congo', genus: 'Bantu' },
    ta: { iso639_3: 'tam', family: 'Dravidian', genus: 'Southern Dravidian' },
  },
  families: {
    Uralic: { n_pairs: 1, metrics: {
      chrf_plus_plus: { sys: { n_pairs: 1, pearson_weighted_mean: 0.91 } },
      bleu: { sys: { n_pairs: 1, pearson_weighted_mean: 0.85 } },
    } },
    'Niger-Congo': { n_pairs: 1, metrics: {
      comet_score: { sys: { n_pairs: 1, pearson_weighted_mean: 0.7 } },
    } },
    Dravidian: { n_pairs: 1, metrics: {
      bleu: { sys: { n_pairs: 1, pearson_weighted_mean: 0.6 } },
    } },
  },
  cells: [{ pair: 'en-fi', tgt: 'fi', preferred: true }],
  license_lane: { commercial_ok: false },
};

const claimsOf = (...pairs) => () => ({
  claims: pairs.map(([value, source]) => ({ value, source })), problem: null,
});

describe('metricReliabilityEvidence — family roll-up through the language card', () => {
  it('an unjudged language in an evidenced family gets the family roll-up', () => {
    const { section, notes } = metricReliabilityEvidence('sme', FAMILY_RELIABILITY, {
      familyClaims: claimsOf(['Uralic', 'glottolog-v5.3'], ['Uralic', 'wals-v2020.5']),
    });
    assert.ok(section, notes.join('\n'));
    assert.equal(section.target_family, 'Uralic');
    assert.equal(section.target_code, null);
    assert.equal(section.target_iso639_3, null);
    assert.deepEqual(section.exact_pairs_measured, []);
    assert.deepEqual(section.family_metrics.map((m) => m.metric), ['chrf_plus_plus', 'bleu']);
    assert.deepEqual(section.family_basis.matched_sources, ['glottolog-v5.3', 'wals-v2020.5']);
    // The transfer caveat and the basis are said; the contradiction is not.
    assert.ok(notes.some((n) => n.includes('assumption, not a measurement')));
    assert.ok(notes.some((n) => n.includes('glottolog-v5.3') && n.includes('Uralic')));
    assert.ok(!notes.some((n) => n.includes('UNMEASURED')));
  });

  it('a disputed family shows every source and rests on the one the index rolls up', () => {
    const { section, notes } = metricReliabilityEvidence('yor', FAMILY_RELIABILITY, {
      familyClaims: claimsOf(['Atlantic-Congo', 'glottolog-v5.3'], ['Niger-Congo', 'wals-v2020.5']),
    });
    assert.equal(section.target_family, 'Niger-Congo');
    assert.deepEqual(section.family_basis.matched_sources, ['wals-v2020.5']);
    const dispute = notes.find((n) => n.includes('disagree'));
    assert.ok(dispute);
    assert.ok(dispute.includes('Atlantic-Congo (glottolog-v5.3)'));
    assert.ok(dispute.includes('Niger-Congo (wals-v2020.5)'));
  });

  it('sources naming two evidenced families are never resolved by picking', () => {
    const { section, notes } = metricReliabilityEvidence('zzz', FAMILY_RELIABILITY, {
      familyClaims: claimsOf(['Uralic', 'src-a'], ['Dravidian', 'src-b']),
    });
    assert.equal(section, null);
    assert.ok(notes.some((n) => n.includes('UNMEASURED') && n.includes('does not pick')));
  });

  it('a family without evidence says so and names the family with its sources', () => {
    const { section, notes } = metricReliabilityEvidence('crk', FAMILY_RELIABILITY, {
      familyClaims: claimsOf(['Algic', 'glottolog-v5.3'], ['Algic', 'wals-v2020.5']),
    });
    assert.equal(section, null);
    assert.equal(notes.length, 1);
    assert.ok(notes[0].includes('UNMEASURED'));
    assert.ok(notes[0].includes('directly or via its family'));
    assert.ok(notes[0].includes('Algic (glottolog-v5.3, wals-v2020.5)'));
  });

  it('an unresolvable family never claims the family was checked', () => {
    const { section, notes } = metricReliabilityEvidence('xyz', FAMILY_RELIABILITY, {
      familyClaims: (code) => ({ claims: [], problem: `no language card for '${code}'` }),
    });
    assert.equal(section, null);
    assert.equal(notes.length, 1);
    assert.ok(notes[0].includes('UNMEASURED'));
    assert.ok(notes[0].includes('could not be checked') && notes[0].includes('no language card'));
    assert.ok(!notes[0].includes('via its family'));
  });

  it('a directly judged language does not consult the card', () => {
    const { section } = metricReliabilityEvidence('fin', FAMILY_RELIABILITY, {
      familyClaims: () => { throw new Error('a judged target must not need its card'); },
    });
    assert.equal(section.target_code, 'fi');
    assert.deepEqual(section.exact_pairs_measured, ['en-fi']);
    assert.ok(!('family_basis' in section));
  });

  it('recommend() threads the family lookup, and renderText shows the card basis', () => {
    const p = recommend('eng', 'yor', {
      manifest: MANIFEST, curated: CURATED, bulk: BULK, env: {},
      reliability: FAMILY_RELIABILITY,
      familyClaims: claimsOf(['Atlantic-Congo', 'glottolog-v5.3'], ['Niger-Congo', 'wals-v2020.5']),
    });
    assert.equal(p.metric_reliability.target_family, 'Niger-Congo');
    const text = renderText(p);
    assert.ok(text.includes('Metric trust for the target (family: Niger-Congo'));
    assert.ok(text.includes("family per the target's language card: "
      + 'Atlantic-Congo (glottolog-v5.3); Niger-Congo (wals-v2020.5)'));
    assert.ok(text.includes('disagree'));
  });
});

describe('cardFamilyClaims — read through the card adapter', () => {
  it('reads the envelope with every source (the real sme card)', () => {
    const { claims, problem } = cardFamilyClaims('sme');
    assert.equal(problem, null);
    assert.deepEqual([...new Set(claims.map((c) => c.value))], ['Uralic']);
    assert.ok(claims.every((c) => typeof c.source === 'string' && c.source));
  });

  it('keeps a Glottolog/WALS disagreement as two claims (the real yor card)', () => {
    const { claims } = cardFamilyClaims('yor');
    assert.ok(claims.length >= 2);
    assert.ok(new Set(claims.map((c) => c.value)).size >= 2, JSON.stringify(claims));
  });

  it('the published projection: a flat family plus familyAttributions', () => {
    const card = { classification: { family: 'Uralic', familyAttributions: [
      { value: 'Uralic', source: 'glottolog-v5.3' }, { value: 'Uralic', source: 'wals-v2020.5' }] } };
    const { claims, problem } = cardFamilyClaims('sme', { getCard: () => card });
    assert.equal(problem, null);
    assert.deepEqual(claims.map((c) => c.source), ['glottolog-v5.3', 'wals-v2020.5']);
  });

  it('a flat family takes its source from _fieldSources', () => {
    const card = { classification: { family: 'Uralic' },
      _fieldSources: { 'classification.family': ['glottolog-v5.3'] } };
    const { claims } = cardFamilyClaims('sme', { getCard: () => card });
    assert.deepEqual(claims, [{ value: 'Uralic', source: 'glottolog-v5.3' }]);
  });

  it('no card, and a card with no family, are each a stated problem', () => {
    assert.match(cardFamilyClaims('qqq', { getCard: () => null }).problem, /no language card for 'qqq'/);
    assert.match(cardFamilyClaims('act').problem, /the language card for 'act' records no family/);
  });
});

describe('metricReliabilityEvidence — the real index and real cards', () => {
  it('sme gets the Uralic roll-up the evidenced-family list already names', () => {
    const { section, notes } = metricReliabilityEvidence('sme');
    if (section === null && notes.some((n) => n.includes('not bundled'))) {
      assert.fail('metric-reliability.json should be reachable from a checkout');
    }
    assert.ok(section, notes.join('\n'));
    assert.equal(section.target_family, 'Uralic');
    assert.deepEqual(section.exact_pairs_measured, []);
    assert.ok(notes.some((n) => n.includes('assumption, not a measurement')));
    const text = renderText(recommend('eng', 'sme', { curated: null, bulk: null, env: {} }));
    assert.ok(text.includes('Metric trust for the target (family: Uralic'));
    assert.ok(text.includes("family per the target's language card: Uralic"));
    assert.ok(!text.split('Metric trust')[1].includes('UNMEASURED'));
  });

  it('crk stays UNMEASURED, and the note names the family it checked (Algic)', () => {
    const { section, notes } = metricReliabilityEvidence('crk');
    assert.equal(section, null);
    assert.equal(notes.length, 1);
    assert.match(notes[0], /directly or via its family \(per its language card: Algic \(/);
    assert.match(notes[0], /UNMEASURED/);
  });

  it('a language whose card records no family says the family could not be checked', () => {
    const { section, notes } = metricReliabilityEvidence('act');
    assert.equal(section, null);
    assert.match(notes[0], /could not be checked \(the language card for 'act' records no family\)/);
    assert.doesNotMatch(notes[0], /via its family/);
  });
});

describe('metricReliabilityEvidence — cross-runtime parity with the harness', () => {
  // The same verdicts, byte for byte, from arena/mt_eval_harness/recommend.py
  // on the same index and the same cards. PYTHONPATH pins THIS checkout's
  // harness (a system python3 can import another checkout's), and the cards
  // dir is pinned to this checkout's too.
  const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const ARENA = path.join(REPO, 'arena');
  const CODES = ['sme', 'crk', 'act'];

  it('sme, crk and a language with no family evidence get the same verdict in JS and Python', (t) => {
    if (!fs.existsSync(path.join(ARENA, 'mt_eval_harness', 'recommend.py'))) {
      return t.skip('the harness is not in this checkout (packaged install)');
    }
    const script = [
      'import json, sys',
      'try:',
      '    import mt_eval_harness',
      '    from mt_eval_harness.recommend import metric_reliability_evidence',
      'except ModuleNotFoundError as exc:',
      '    print(json.dumps({"skip": f"harness import needs {exc.name}"})); sys.exit(0)',
      'out = {"harness": mt_eval_harness.__file__, "verdicts": {}}',
      `for code in ${JSON.stringify(CODES)}:`,
      '    section, notes = metric_reliability_evidence(code)',
      '    out["verdicts"][code] = {"section": section, "notes": notes}',
      'print(json.dumps(out))',
    ].join('\n');
    const r = spawnSync('python3', ['-c', script], {
      encoding: 'utf-8',
      timeout: 60000,
      env: {
        ...process.env,
        PYTHONPATH: ARENA,
        MT_EVAL_CARDS_DIR: path.join(REPO, 'cli', 'shared', 'language-cards'),
      },
    });
    if (r.error && r.error.code === 'ENOENT') return t.skip('python3 not available');
    assert.equal(r.status, 0, r.stderr);
    const py = JSON.parse(r.stdout);
    if (py.skip) return t.skip(py.skip);
    assert.ok(py.harness.startsWith(ARENA), `imported ${py.harness}, not this checkout's harness`);
    for (const code of CODES) {
      const js = metricReliabilityEvidence(code);
      assert.deepEqual(JSON.parse(JSON.stringify(js.section)), py.verdicts[code].section, `${code}: section`);
      assert.deepEqual(js.notes, py.verdicts[code].notes, `${code}: notes`);
    }
  });
});
