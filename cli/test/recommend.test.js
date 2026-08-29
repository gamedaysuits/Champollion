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
import { execFileSync } from 'node:child_process';

import {
  resolveAvailability,
  dispatchableMethods,
  curatedEvidence,
  bulkEvidence,
  metricReliabilityEvidence,
  recommend,
  renderText,
} from '../lib/recommend.js';
import { LANE_RELATIVE_ONLY } from '../lib/contamination-lane.js';

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
    assert.ok(stderr.includes('Usage: champollion recommend'));
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
