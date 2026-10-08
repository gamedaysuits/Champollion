/**
 * language_overview — the stage-1 answer of the north-star flow.
 *
 * Pinned: every section appears or says why it is unavailable; the next
 * steps name real tools and commands; licence lanes are reported from the
 * corpora (consent / NC / do_not_train); the local-model suggestion comes
 * only from a loadable model-card claim. Everything injected — no network.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { languageOverview, formatOverview, licenceLane } from '../src/tools/overview.js';
import { loadRecommend } from '../src/tools/overview.js';
import { mapResultRow } from '../src/tools/results.js';
import { registerLocalOnlyCommand } from '../src/tools/register-corpus-hint.js';
import { declaredModelCandidates } from '../../cli/lib/recommend.js';

const CARD = {
  code: 'crk',
  name: 'Plains Cree',
  iso639_3: 'crk',
  classification: { family: { agreement: 'unanimous', consensus: 'Algic', values: [{ value: 'Algic', source: 'glottolog-v5.3' }] } },
  speakerEstimates: [{ count: 4100, source: 'linguameta-x' }],
  endangerment: { agreement: 'single', values: [{ value: 'threatened', source: 'elcat-v2024.1' }] },
  scripts: ['Cans', 'Latn'],
  resources: {
    fsts: [{ name: 'lang-crk', publisher: 'giellalt', license: null }],
    corpora: [{ corpus: 'Tatoeba', alignmentPairsTotal: 43 }],
  },
  lexicalResources: { dictionaries: [{ name: 'dict-crk-eng', publisher: 'giellalt', license: 'CC-BY-4.0' }] },
  methodSupport: { googleTranslate: { supported: false }, deepl: { supported: false }, llm: { supported: true } },
  methodSupportEvidence: {
    total: 2,
    named: [
      { value: 'open', variant: 'hf:MihaiPopa-1/OmniTranslate-1.1', source: 'hf-x', confidence: 'model-card-declared' },
      { value: 'open', variant: 'hf:someone/OmniTranslate-1.1-GGUF', source: 'hf-x', confidence: 'model-card-declared' },
    ],
  },
};

const PKG = {
  getCardSourceInfo: () => ({ mode: 'packaged' }),
  resolveCode: (c) => c,
  prefetchLanguageCards: async (codes) => ({ fetched: [], missing: [], failed: [], skipped: codes }),
  getLanguageCard: (c) => (c === 'crk' ? CARD : null),
  normalizeCard: (c) => c,
};
const INDEX = [{ code: 'crk', name: 'Plains Cree', aliases: [], lean: false }];
// The harness FST probe spawns Python; these tests inject its answer instead.
const NO_HARNESS = async () => ({ status: 'not-installed', how: 'no `mt-eval` on PATH' });

const CORPORA = async () => ({
  items: [
    { id: 'eval-eng-crk-consent-v1', source: 'eng', target: 'crk', size: 436, license: 'LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0', contamination: 'LOW', availability: 'fetch', do_not_train: true },
    { id: 'eval-eng-crk-nc-v1', source: 'eng', target: 'crk', size: 200, license: 'CC-BY-NC-4.0', contamination: 'LOW', availability: 'fetch', do_not_train: true },
  ],
  total: 2,
  hiddenQuarantined: 3,
  source: 'registry.json (remote)',
});
// The declared models come from the CLI's own selection (one rule for the
// overview and `champollion network recommend`), here over the fixture card.
const DECLARED = declaredModelCandidates('crk', { getCard: (c) => (c === 'crk' ? CARD : null) });
const RECOMMEND = {
  recommend: () => ({
    declared_models: { ...DECLARED, candidates: DECLARED.candidates.map((c) => ({ ...c, runnable: true })) },
    runnable_methods: [
      { method: 'openrouter', cli_name: 'llm', availability: 'needs-key', lane_ok: true },
      // The CLI reports the keyless local engine as needs-key (its endpoint
      // vars read as credentials); the overview must not.
      { method: 'local', availability: 'needs-key', lane_ok: true },
    ],
    curated_evidence: [],
    bulk_evidence: [],
    metric_reliability: null,
  }),
};

describe('language_overview', () => {
  it('composes every section and names the exact next steps', async () => {
    const o = await languageOverview({ code: 'crk' }, {
      champollion: PKG, index: INDEX, harnessFst: NO_HARNESS,
      corpora: CORPORA,
      results: async () => [],
      contests: async () => ({ contests: [], total: 0 }),
      recommend: RECOMMEND,
    });
    assert.equal(o.status, 'ok');
    const text = formatOverview(o);
    assert.match(text, /# Plains Cree \(crk\)/);
    assert.match(text, /Algic/);
    assert.match(text, /FST\/analyzer ×1 \(giellalt\)/);
    assert.match(text, /2 runnable, 3 quarantined/);
    assert.match(text, /none on the public leaderboard/);
    assert.match(text, /LOCAL local/);
    assert.doesNotMatch(text, /needs a key: [^\n]*\blocal\b/);
    assert.match(text, /UNMEASURED/);
    // Licence lanes from the corpora themselves
    // Counts agree with their verbs (Round 7: "1 are marked")
    assert.match(text, /1 carries a bespoke licence \(LicenseRef-\*\)/);
    assert.match(text, /1 is non-commercial/);
    assert.match(text, /2 are marked do_not_train — never put them/);
    assert.match(text, /of the 2 listed corpora/);
    // Next steps name tools/commands
    // the exact command the CLI accepts (Round 7: --domain and --yes were missing)
    assert.ok(text.includes(registerLocalOnlyCommand({ pair: 'eng-crk' })), 'step 1 shows the shared register-corpus command');
    assert.match(text, /\{"transmission":"local-only"\}/);
    assert.match(text, /run_benchmark \{ "corpus": "\/path\/to\/test\.jsonl", "provider": "local", "model": "llama3\.1"/);
    assert.match(text, /"method": "local-model", "model": "MihaiPopa-1\/OmniTranslate-1\.1"/);
    assert.doesNotMatch(text, /GGUF", "dry_run"/, 'a GGUF checkpoint is not loadable by local-model');
    assert.match(text, /forge_discover \{ "code": "crk" \} shows what forge sees, then forge_init \{ "code": "crk" \} → forge_register_eval/);
    assert.match(text, /pip install 'nmt-forge\[hf\]'/);
    // Round 10 (school + hospital): register, screen, predict come BEFORE the
    // baseline — an agent following the numbers in order never spends a
    // scoring read before the predictions.
    const steps = text.slice(text.indexOf('NEXT STEPS'));
    const at = (re) => { const m = steps.match(re); assert.ok(m, String(re)); return m.index; };
    assert.ok(at(/forge_register_eval/) < at(/run_benchmark/), 'registration before any benchmark');
    assert.ok(at(/forge_leak_audit/) < at(/run_benchmark/), 'the leak audit before any benchmark');
    assert.ok(at(/forge_prereg \{/) < at(/run_benchmark/), 'the predictions before any benchmark');
    assert.match(steps, /a benchmark of the test file is a scoring read, and forge refuses a preregistration written after one/);
    assert.match(steps, /If you may train against that test set, this comes AFTER step 2's predictions/);
    assert.match(steps, /drop_test_twins with its OWN clean_to, "corpus\.notwins\.jsonl"/);
    assert.match(steps, /confirming downloads its weights from Hugging Face/);
    assert.match(steps, /^4\. Build\.[^\n]*forge_split[^\n]*forge_preflight/m);
    assert.match(steps, /^5\. Prove\./m);
    assert.match(steps, /^6\. Deploy\./m);
    assert.match(text, /`translate` tool/);
    assert.doesNotMatch(text, /\[object Object\]|undefined/);
  });

  it('published results rank by chrF++ with its CI — no composite, no tier (scoring standard/1)', async () => {
    let asked = null;
    const o = await languageOverview({ code: 'crk' }, {
      champollion: PKG, index: INDEX, harnessFst: NO_HARNESS, corpora: CORPORA,
      results: async (q) => {
        asked = q;
        return [mapResultRow({
          id: 'r1', model_slug: 'm/x', language_pair: 'eng>crk', condition: 'naive', trust: 'unverified',
          chrf_plus_plus: 38.12, chrf_ci_lower: 35.9, chrf_ci_upper: 40.33,
          composite_score: 0.62, quality_tier: 'functional', contamination: 'LOW',
        })];
      },
      contests: async () => ({ contests: [], total: 0 }), recommend: RECOMMEND,
    });
    assert.equal(asked.sort, 'chrf');
    const text = formatOverview(o);
    assert.match(text, /Published results \(top by chrF\+\+, with its 95% CI; get_results for more\):/);
    assert.match(text, /eng>crk {2}m\/x {2}chrF\+\+ 38\.1 \[35\.9, 40\.3\]/);
    const results = text.slice(text.indexOf('Published results'), text.indexOf('Published results') + 400);
    assert.doesNotMatch(results, /composite/);
    assert.doesNotMatch(results, /\b(baseline|emerging|functional|deployable|fluent)\b/i);
  });

  it('one corpus reads as one: "1 is marked do_not_train", "of the 1 listed corpus" (Round 7)', async () => {
    const one = async () => ({
      items: [{ id: 'eval-eng-crk-nc-v1', source: 'eng', target: 'crk', size: 1, license: 'CC-BY-NC-4.0',
        contamination: 'LOW', availability: 'fetch', do_not_train: true }],
      total: 1, hiddenQuarantined: 0, source: 'registry.json (remote)',
    });
    const o = await languageOverview({ code: 'crk' }, {
      champollion: PKG, index: INDEX, harnessFst: NO_HARNESS, corpora: one,
      results: async () => [], contests: async () => ({ contests: [], total: 0 }), recommend: RECOMMEND,
    });
    const text = formatOverview(o);
    assert.match(text, /1 is marked do_not_train — never put it in a training mix/);
    assert.match(text, /1 is non-commercial/);
    assert.match(text, /of the 1 listed corpus\)/);
    assert.match(text, /eval-eng-crk-nc-v1  eng→crk  1 row  /);
    assert.doesNotMatch(text, /\b1 are\b|\b1 rows\b|\(s\)/);
  });

  it('a method whose coverage of the pair is not indexed is listed as UNVERIFIED, never READY', async () => {
    const o = await languageOverview({ code: 'crk' }, {
      champollion: PKG, index: INDEX, harnessFst: NO_HARNESS,
      corpora: CORPORA,
      results: async () => [],
      contests: async () => ({ contests: [], total: 0 }),
      recommend: { recommend: () => ({
        runnable_methods: [
          { method: 'apertium', availability: 'unverified', key_availability: 'ready', target_coverage: 'unknown', lane_ok: true },
          { method: 'openrouter', cli_name: 'llm', availability: 'ready', lane_ok: true },
        ],
        curated_evidence: [], bulk_evidence: [], metric_reliability: null,
      }) },
    });
    const line = formatOverview(o).split('\n').find((l) => l.startsWith('Runnable here:'));
    assert.match(line, /READY openrouter \(llm\)/);
    assert.match(line, /UNVERIFIED \(coverage of this pair not indexed — check the service\) apertium/);
    assert.doesNotMatch(line, /READY [^·]*apertium/);
  });

  it('a failing section says "unavailable" and the rest still answers', async () => {
    const o = await languageOverview({ code: 'crk' }, {
      champollion: PKG, index: INDEX, harnessFst: NO_HARNESS,
      corpora: async () => { throw new Error('registry.json HTTP 503'); },
      results: async () => { throw new Error('Leaderboard fetch failed: HTTP 500'); },
      contests: async () => ({ contests: [], total: 0 }),
      recommend: null,
    });
    const text = formatOverview(o);
    assert.match(text, /Benchmarks: unavailable right now \(registry\.json HTTP 503\)/);
    assert.match(text, /Published results: unavailable right now/);
    assert.match(text, /champollion network recommend eng crk/);
    assert.match(text, /NEXT STEPS/);
  });

  it('an unknown language returns get_language\'s not-found (with suggestions)', async () => {
    const o = await languageOverview({ code: 'Plians Cree' }, { champollion: PKG, index: INDEX });
    assert.equal(o.status, 'not-found');
    assert.match(formatOverview(o), /crk/);
  });

  it('licenceLane mirrors the harness\'s transmission lanes', () => {
    assert.equal(licenceLane('LicenseRef-WMT-Research'), 'consent');
    assert.equal(licenceLane('CC-BY-NC-SA-4.0'), 'nc');
    assert.equal(licenceLane('CC-BY-4.0'), 'open');
    assert.equal(licenceLane(null), 'unstated');
  });

  it('the CLI recommend module is importable from this checkout', async (t) => {
    const mod = await loadRecommend();
    if (!mod) { t.skip('champollion not resolvable here'); return; }
    const r = mod.recommend('eng', 'crk', { useContext: 'non-commercial', env: {} });
    assert.ok(Array.isArray(r.runnable_methods) && r.runnable_methods.length > 0);
  });
});

// The index invariant on the overview line: Plains Cree's endangerment is
// assessed by several sources on different scales; every value is shown
// with its source, none elected and none dropped (the line used to keep
// three unattributed values).
describe('language_overview — disputed facts keep every source', () => {
  it('every endangerment assessment and every family claim appears, attributed', async () => {
    const disputedCard = {
      ...CARD,
      classification: { family: { agreement: 'disputed', values: [
        { value: 'Algic', source: 'glottolog-v5.3' }, { value: 'Algonquian', source: 'wals-v2020' }] } },
      endangerment: { agreement: 'disputed', values: [
        { value: 'Severely endangered', source: 'linguameta-x' },
        { value: 'threatened', source: 'elcat-v2024.1' },
        { value: 'vulnerable', source: 'elcat-v2024.1' },
        { value: 'moribund', source: 'glottolog-v5.3' },
      ] },
    };
    const o = await languageOverview({ code: 'crk' }, {
      champollion: { ...PKG, getLanguageCard: (c) => (c === 'crk' ? disputedCard : null) }, harnessFst: NO_HARNESS,
      index: INDEX, corpora: CORPORA, results: async () => [],
      contests: async () => ({ contests: [], total: 0 }), recommend: RECOMMEND,
    });
    const line = formatOverview(o).split('\n').find((l) => l.startsWith('Index:'));
    for (const [value, source] of [['Severely endangered', 'linguameta-x'], ['threatened', 'elcat-v2024.1'],
      ['vulnerable', 'elcat-v2024.1'], ['moribund', 'glottolog-v5.3'], ['Algic', 'glottolog-v5.3'], ['Algonquian', 'wals-v2020']]) {
      assert.ok(line.includes(`${value} [${source}]`), `${value} [${source}] missing from: ${line}`);
    }
    assert.match(line, /endangerment sources differ:/);
  });
});

// Metric trust reads the CLI's recommend (lib/recommend.js). That lookup used
// to stop at the WMT-judged languages, so Northern Sami was told no evidence
// covered it while Uralic — its own family — had evidence; it now rolls up
// through the card's family claims, and a roll-up that rests on one of two
// disagreeing sources says so instead of reading as an elected winner.
describe('language_overview — metric trust via the family roll-up', () => {
  const overviewWith = (metricReliability) => languageOverview({ code: 'crk' }, {
    champollion: PKG, index: INDEX, harnessFst: NO_HARNESS, corpora: CORPORA, results: async () => [],
    contests: async () => ({ contests: [], total: 0 }),
    recommend: { recommend: () => ({ ...RECOMMEND.recommend(), metric_reliability: metricReliability }) },
  });
  const trustLine = (o) => formatOverview(o).split('\n').find((l) => l.startsWith('Metric trust:'));

  it('a roll-up resting on one of two disagreeing card sources says so', async () => {
    const line = trustLine(await overviewWith({
      target_family: 'Niger-Congo', exact_pairs_measured: [],
      family_basis: { via: 'language-card', matched_sources: ['wals-v2020.5'], claims: [
        { value: 'Atlantic-Congo', source: 'glottolog-v5.3' }, { value: 'Niger-Congo', source: 'wals-v2020.5' }] },
    }));
    assert.match(line, /family-level evidence for Niger-Congo/);
    assert.match(line, /sources disagree; this rests on wals-v2020\.5's classification alone/);
  });

  it('agreeing sources add no caveat', async () => {
    const line = trustLine(await overviewWith({
      target_family: 'Uralic', exact_pairs_measured: [],
      family_basis: { via: 'language-card', matched_sources: ['glottolog-v5.3', 'wals-v2020.5'], claims: [
        { value: 'Uralic', source: 'glottolog-v5.3' }, { value: 'Uralic', source: 'wals-v2020.5' }] },
    }));
    assert.match(line, /family-level evidence for Uralic \(this language itself never judged/);
    assert.doesNotMatch(line, /disagree/);
  });

  it('the CLI recommend this server imports rolls sme up to Uralic', async (t) => {
    const mod = await loadRecommend();
    if (!mod) { t.skip('champollion not resolvable here'); return; }
    const r = mod.recommend('eng', 'sme', { useContext: 'non-commercial', env: {} });
    assert.ok(r.metric_reliability, r.notes.join('\n'));
    assert.equal(r.metric_reliability.target_family, 'Uralic');
    assert.deepEqual(r.metric_reliability.exact_pairs_measured, []);
  });
});

// An FST on the card is a fact that one EXISTS; whether the eval harness can
// download and load it is the harness's pin (mt_eval_harness/data/fst-pins.json).
// Kalaallisut's card lists giellalt's lang-kal and the harness has no pin for
// kal, yet the overview read "FST/analyzer ×1 (giellalt)" as if FST metrics
// would run. Fixtures mirror the real pins file at the time of writing: crk
// pinned (giellalt nightly @ bec054ef), kal not.
describe('language_overview — card FST vs what the harness can use', () => {
  const KAL = {
    code: 'kal', name: 'Kalaallisut', iso639_3: 'kal',
    resources: { fsts: [{ name: 'lang-kal', url: 'https://github.com/giellalt/lang-kal', publisher: 'giellalt', license: 'GPL-3.0' }] },
  };
  const CRK_TWO_FSTS = {
    ...CARD,
    resources: { ...CARD.resources, fsts: [
      { name: 'lang-crk', url: 'https://github.com/UAlbertaALTLab/lang-crk', publisher: 'UAlbertaALTLab', license: null },
      { name: 'lang-crk', url: 'https://github.com/giellalt/lang-crk', publisher: 'giellalt', license: 'NOASSERTION' },
    ] },
  };
  const CARDS = { kal: KAL, crk: CRK_TWO_FSTS };
  const pkg = { ...PKG, getLanguageCard: (c) => CARDS[c] ?? null };
  const index = [...INDEX, { code: 'kal', name: 'Kalaallisut', aliases: [], lean: false }];
  const CRK_PIN = {
    repo: 'giellalt/lang-crk', format: 'giellalt-nightly-apt', maturity: 'production', kind: null,
    langCommit: 'bec054ef6db5a9813f5f987e48a7253438027101', releaseTag: null,
    name: 'GiellaLT Plains Cree FST (lang-crk)', url: 'https://github.com/giellalt/lang-crk',
  };
  const harness = (langs, extra = {}) => async (codes) => ({
    status: 'ok', how: '`mt-eval` on PATH', version: '0.2.0', pinsShipped: true, pinsOverride: false, pyhfst: true,
    langs: Object.fromEntries(codes.map((c) => [c, langs[c] ?? { pin: null, installed: false, stale: false, evalPackFst: false }])),
    ...extra,
  });
  const overview = async (code, harnessFst) => formatOverview(await languageOverview({ code }, {
    champollion: pkg, index, harnessFst,
    corpora: async () => ({ items: [], total: 0, hiddenQuarantined: 0, source: 'test' }),
    results: async () => [], contests: async () => ({ contests: [], total: 0 }), recommend: null,
  }));
  const fstLines = (text) => text.split('\n').filter((l) => l.startsWith('FSTs') || l.startsWith('  - lang-') || l.startsWith('  - harness pin'));

  it('kal: the card records lang-kal, the harness has no pin — FST metrics will not run', async () => {
    let asked = null;
    const text = await overview('kal', async (codes) => { asked = codes; return harness({})(codes); });
    assert.deepEqual(asked, ['kal'], 'the harness is asked about the card\'s canonical code');
    assert.match(text, /Tooling: FST\/analyzer ×1 \(giellalt\)/, 'the card fact stays');
    const [head, line] = fstLines(text);
    assert.match(head, /card records that each exists; whether the eval harness here \(mt-eval-harness 0\.2\.0\) can download and load it is a separate check/);
    assert.match(line, /lang-kal \(giellalt\) <https:\/\/github\.com\/giellalt\/lang-kal>: recorded on the card, but the harness has no pin for kal yet — it cannot download or load it, so FST metrics will not run for this language\./);
    assert.doesNotMatch(line, /pins this build|installed here/);
  });

  it('crk: the giellalt build is the pinned one, with the command the harness prints; the ALTLab entry is not', async () => {
    const text = await overview('crk', harness({ crk: { pin: CRK_PIN, installed: false, stale: false, evalPackFst: true } }));
    const lines = fstLines(text);
    const altlab = lines.find((l) => l.includes('UAlbertaALTLab'));
    const giellalt = lines.find((l) => l.includes('<https://github.com/giellalt/lang-crk>'));
    assert.match(altlab, /recorded on the card; not the build the harness pins for crk \(giellalt\/lang-crk\)\./);
    // Round 8: nothing downloads by itself — never "downloads on the first evaluation"
    assert.match(giellalt, /recorded on the card; the harness pins this build \(giellalt\/lang-crk @ bec054ef; GiellaLT maturity: production\); not installed here — nothing downloads by itself: `mt-eval setup --lang crk` installs it; until then a run proceeds with FST acceptance marked not computed\./);
    assert.doesNotMatch(giellalt, /first evaluation/);
    assert.ok(!lines.some((l) => l.startsWith('  - harness pin')), 'the pin matched a card entry — no extra line');
  });

  it('the harness\'s own FST-state sentence is used when it gives one (one wording, Round 8)', async () => {
    const stateLine = 'FST for Plains Cree (crk): not installed here — the Plains Cree FST analyzer is missing. Nothing '
      + 'downloads unless you run `mt-eval setup --lang crk`; until then FST acceptance and morphology are marked not computed.';
    const lines = fstLines(await overview('crk', harness({ crk: { pin: CRK_PIN, installed: false, stale: false,
      evalPackFst: true, stateLine } })));
    const giellalt = lines.find((l) => l.includes('<https://github.com/giellalt/lang-crk>'));
    assert.ok(giellalt.includes(stateLine), giellalt);
  });

  it('crk installed: says so; a stale install is not passed off as the pin', async () => {
    const ok = fstLines(await overview('crk', harness({ crk: { pin: CRK_PIN, installed: true, stale: false, evalPackFst: true } })));
    assert.match(ok.find((l) => l.includes('giellalt/lang-crk>')), /pins this build \([^)]*\); installed here\./);
    const stale = fstLines(await overview('crk', harness({ crk: { pin: CRK_PIN, installed: true, stale: true, evalPackFst: true } })));
    assert.match(stale.find((l) => l.includes('giellalt/lang-crk>')), /an FST is installed here, but the harness cannot confirm it is the pinned build/);
  });

  it('no harness here: "cannot tell", never "no pin"', async () => {
    const lines = fstLines(await overview('kal', async () => ({ status: 'not-installed', how: 'no `mt-eval` on PATH' })));
    assert.match(lines[1], /recorded on the card; harness not installed — cannot tell whether it can use this FST \(`python3 -m pip install mt-eval-harness`; then `mt-eval setup --status` lists the FSTs it pins\)\./);
    assert.doesNotMatch(lines.join('\n'), /no pin/);
  });

  it('a harness that cannot answer (error / thrown / timed out) is "cannot tell" too', async () => {
    const err = fstLines(await overview('kal', async () => ({ status: 'error', how: 'x', error: 'the harness does not import: ModuleNotFoundError' })));
    assert.match(err[1], /cannot tell whether the harness can use it — the harness could not report its FST pins \(the harness does not import/);
    const thrown = fstLines(await overview('kal', async () => { throw new Error('spawn EACCES'); }));
    assert.match(thrown[1], /cannot tell whether the harness can use it — asking the harness failed \(spawn EACCES\)/);
  });
});
