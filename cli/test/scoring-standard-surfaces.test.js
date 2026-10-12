/**
 * Scoring standard/1 — no score surface prints a quality tier, and none
 * headlines or default-sorts by the retired composite.
 *
 * Founder, 2026-10-04: "we want scoring to be industry standard". Industry
 * practice (WMT, FLORES-200, AmericasNLP) ranks by one standard metric with
 * its CI and never labels quality from automatic scores. The tier words
 * (baseline / emerging / functional / deployable / fluent) were read off a
 * composite that rated an untrained model repeating one valid Northern Sami
 * sentence 0.62 "functional" at chrF++ 5.5.
 *
 * Two layers: behaviour (the mappers and the CLI command, fed rows that still
 * carry an old quality_tier) and a source guard over every JS score surface
 * (code only — comments may explain the retirement).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapRow } from '../website/src/utils/leaderboardUtils.js';
import {
  RETIRED_TIER_WORDS,
  DIAGNOSTICS_LABEL,
  LEGACY_COMPOSITE_LABEL,
} from '../website/src/utils/scoringStandard.mjs';
import { METRICS } from '../website/src/utils/testedEdges.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(HERE, '..');
const SITE = path.join(CLI, 'website');

/** Every JS surface that shows or sorts by scores. */
const SURFACES = [
  'website/src/pages/leaderboard.js',
  'website/src/pages/tested.js',
  'website/src/utils/leaderboardUtils.js',
  'website/src/utils/testedEdges.mjs',
  'website/src/components/GraphHero.js',
  'website/src/components/GraphEngine.js',
  'website/src/components/TranslationField.js',
  'website/src/components/FieldEngine.js',
  'website/plugins/shared-data/generateFieldJson.js',
  'website/plugins/shared-data/generateGraphJson.js',
  'website/plugins/shared-data/supabaseRuns.js',
  'lib/commands/leaderboard.js',
];

/**
 * Source with comments removed (strings kept), so a guard checks what the
 * code does, not what its comments explain. A small scanner, not a parser:
 * it tracks '', "", `` strings so a URL's // is not taken for a comment.
 */
function stripComments(src) {
  let out = '';
  let i = 0;
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') { out += n ?? ''; i += 2; continue; }
      if (c === quote) quote = null;
      i += 1;
      continue;
    }
    if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && n === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    if (c === '\'' || c === '"' || c === '`') quote = c;
    out += c;
    i += 1;
  }
  return out;
}

const code = (rel) => stripComments(readFileSync(path.join(CLI, rel), 'utf8'));

describe('scoring standard/1: no tier label on any score surface', () => {
  it('the retired tier vocabulary is the five old labels', () => {
    assert.deepEqual([...RETIRED_TIER_WORDS], ['baseline', 'emerging', 'functional', 'deployable', 'fluent']);
  });

  for (const rel of SURFACES) {
    it(`${rel} renders no quality tier`, () => {
      const src = code(rel);
      // No tier badge / label table / tier column or filter.
      for (const re of [/TierBadge/, /TIER_(META|LABELS)/, /quality_tier/, /\btierFilter\b/]) {
        assert.equal(re.test(src), false, `${rel} still uses ${re}`);
      }
      // No tier word as a display string ('Functional', "◑ Deployable", …).
      for (const w of RETIRED_TIER_WORDS) {
        const label = w[0].toUpperCase() + w.slice(1);
        const re = new RegExp(`['"\`][^'"\`\\n]{0,4}${label}['"\`]`);
        assert.equal(re.test(src), false, `${rel} prints the tier label "${label}"`);
      }
    });
  }

  it('the website mapper drops a stored tier and keeps no tier field', () => {
    for (const t of ['Baseline', 'Emerging', 'Functional', 'Deployable', 'Fluent']) {
      const entry = mapRow({ id: 'x', language_pair: 'eng>sme', quality_tier: t, composite_score: 0.62, chrf_plus_plus: 5.5 });
      assert.equal('qualityTier' in entry, false);
      assert.doesNotMatch(JSON.stringify(entry), new RegExp(t, 'i'));
    }
  });

  it('website code reads no qualityTier (the CLI config label of that name is a different concept)', () => {
    for (const rel of SURFACES.filter((r) => r.startsWith('website/'))) {
      assert.equal(/qualityTier/.test(code(rel)), false, `${rel} reads qualityTier`);
    }
  });
});

describe('scoring standard/1: chrF++ is the default, the composite is legacy', () => {
  it('the leaderboard page starts on chrF++ and offers no composite in the rank-by toggle', () => {
    const src = code('website/src/pages/leaderboard.js');
    assert.match(src, /useState\(DEFAULT_SORT_KEY\)/);
    assert.doesNotMatch(src, /useState\("composite"\)/);
    assert.match(src, /const RANK_BY_KEYS = \["chrF", "bleu", "ter", "comet"\];/);
    // The composite column exists only as the hidden legacy column.
    assert.match(src, /key: "composite",\s+label: translate\(\{id: "page\.board\.colLegacyComposite", message: "Legacy composite \(retired\)"/);
    assert.match(src, /group: "legacy", default: false/);
    // Diagnostics are grouped under their own header.
    assert.match(src, /message: "Diagnostics"/);
    assert.equal(DIAGNOSTICS_LABEL, 'diagnostics');
  });

  it('the /tested screen cannot colour by the composite', () => {
    assert.deepEqual(METRICS.map((m) => m.id), ['chrf', 'bleu', 'comet', 'ter']);
    assert.doesNotMatch(code('website/src/pages/tested.js'), /composite/);
  });

  it('the hero chips show the run\'s chrF++, never a composite', () => {
    for (const rel of [
      'website/src/components/FieldEngine.js',
      'website/src/components/TranslationField.js',
      'website/plugins/shared-data/generateFieldJson.js',
      'website/plugins/shared-data/supabaseRuns.js',
      'website/plugins/shared-data/generateGraphJson.js',
    ]) {
      // \b: the canvas API's globalCompositeOperation is not a score.
      assert.doesNotMatch(code(rel), /\bcomposite/i, `${rel} still carries the composite`);
    }
    assert.match(code('website/src/components/FieldEngine.js'), /corpus chrF\+\+/);
    // Runs are selected by chrF++, so a standard/1 card (composite null) is not dropped.
    assert.match(code('website/plugins/shared-data/supabaseRuns.js'), /chrf_plus_plus=not\.is\.null/);
  });

  it('the CLI help names chrf as the default and the composite as retired', async () => {
    const { COMMAND_HELP } = await import('../lib/command-help.js');
    const sort = COMMAND_HELP.leaderboard.options.find(([flag]) => flag.startsWith('--sort'))[1];
    assert.match(sort, /^Sort by: chrf \(default\)/);
    assert.match(sort, /composite \(the retired legacy composite, old cards only\)/);
    assert.doesNotMatch(COMMAND_HELP.leaderboard.description.join(' '), /tier/i);
  });

  it('the one label a stored composite may appear under', () => {
    assert.equal(LEGACY_COMPOSITE_LABEL, 'legacy composite (retired)');
    assert.match(code('lib/commands/leaderboard.js'), /const LEGACY_COMPOSITE_LABEL = 'legacy composite \(retired\)';/);
  });
});

// Keep the site path referenced so a moved website fails loudly here.
assert.ok(SITE.endsWith('website'));
