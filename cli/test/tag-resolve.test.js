/**
 * tag-resolve.test.js — the BCP 47 parser and the tag resolver.
 *
 * These cases are not hypotheticals. Almost every one of them is a fault that
 * actually occurred while building this layer, or a registry disagreement found
 * in the pinned data:
 *
 *   - `ayr` was filed as an alias of `aym`, which made Central Aymara
 *     unreachable by its own code.
 *   - `zh` produced no tag at all, because Chinese's default langtags set is
 *     tagged `zh-CN` and the reader only accepted bare tags.
 *   - `drh` is claimed by two registries for two different languages.
 *   - `aka`, `kok`, `san` and `zap` have no predominant member and earlier
 *     drafts would have invented one.
 *   - `nor` has no cited predominant member at all, which is the evidence that
 *     `no` → `nob` is an editorial decision and not a fact.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { parseTag, formatTag } from '../lib/tags/bcp47.js';
import {
  resolveTag, resolveCoverage, explainResolution, ROUTE, COVERAGE,
} from '../lib/tags/resolve.js';

const INDEX_FILE = path.join(
  import.meta.dirname, '..', '..', 'build', 'atlas', 'tag-index.json',
);
const haveIndex = fs.existsSync(INDEX_FILE);
const index = haveIndex ? JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8')) : null;

describe('bcp47: parsing by shape, not by position', () => {
  test('a bare language subtag', () => {
    const t = parseTag('fr');
    assert.equal(t.wellFormed, true);
    assert.equal(t.language, 'fr');
    assert.equal(t.script, null);
    assert.equal(t.region, null);
  });

  test('script and region are told apart by shape, not order', () => {
    const script = parseTag('sr-Latn');
    assert.equal(script.script, 'Latn');
    assert.equal(script.region, null);

    const region = parseTag('sr-RS');
    assert.equal(region.script, null);
    assert.equal(region.region, 'RS');
  });

  test('language-script-region', () => {
    const t = parseTag('zh-Hans-CN');
    assert.equal(t.language, 'zh');
    assert.equal(t.script, 'Hans');
    assert.equal(t.region, 'CN');
  });

  test('numeric regions are regions', () => {
    assert.equal(parseTag('es-419').region, '419');
  });

  test('variants', () => {
    const t = parseTag('de-CH-1901');
    assert.deepEqual(t.variants, ['1901']);
    assert.equal(t.region, 'CH');
  });

  test('a repeated variant is malformed', () => {
    const t = parseTag('de-1901-1901');
    assert.equal(t.wellFormed, false);
    assert.match(t.problem, /repeated/);
  });

  test('extensions', () => {
    const t = parseTag('en-US-u-ca-gregory');
    assert.deepEqual(t.extensions.u, ['ca', 'gregory']);
  });

  test('a whole-tag private use names no language', () => {
    const t = parseTag('x-pirate');
    assert.equal(t.wellFormed, true);
    assert.equal(t.language, null);
    assert.deepEqual(t.privateUse, ['pirate']);
  });

  test('a private-use suffix keeps its language', () => {
    const t = parseTag('crk-Cans-x-local');
    assert.equal(t.language, 'crk');
    assert.equal(t.script, 'Cans');
    assert.deepEqual(t.privateUse, ['local']);
  });

  test('extlangs', () => {
    const t = parseTag('zh-cmn-Hans');
    assert.equal(t.language, 'zh');
    assert.deepEqual(t.extlangs, ['cmn']);
    assert.equal(t.script, 'Hans');
  });

  test('grandfathered tags are well-formed and name no language', () => {
    const t = parseTag('i-klingon');
    assert.equal(t.wellFormed, true);
    assert.equal(t.grandfathered, true);
    assert.equal(t.language, null);
  });

  test('malformed input is reported, never thrown', () => {
    for (const bad of ['', '-fr', 'fr-', 'fr--FR', 'f', 'toolongforalanguage', 'fr_FR']) {
      const t = parseTag(bad);
      assert.equal(t.wellFormed, false, `${JSON.stringify(bad)} should not be well-formed`);
      assert.ok(t.problem, `${JSON.stringify(bad)} should say why`);
    }
  });

  test('case is normalised on the way out', () => {
    assert.equal(formatTag(parseTag('ZH-hans-cn')), 'zh-Hans-CN');
  });
});

/**
 * A hand-built index, so the resolver's MECHANICS are tested deterministically
 * whether or not an atlas has been built. It deliberately does not restate the
 * real registries' claims — asserting "cre denotes cwd" against a fixture we
 * wrote would keep passing after the real data changed, which is confidence
 * without evidence. The suites below use the built index for that.
 */
const FIXTURE = {
  byTag: {
    aaa: 'aaa', xx: 'aaa', mmm: 'mmm', bbb: 'bbb', ccc: 'ccc', nnn: 'nnn', ddd: 'ddd',
  },
  ambiguousTags: {
    zzz: {
      resolvesTo: null,
      reason: 'registries disagree about which language "zzz" denotes',
      alsoClaimedBy: [
        { language: 'aaa', sources: ['registry-one'] },
        { language: 'bbb', sources: ['registry-two'] },
      ],
    },
  },
  languages: {
    aaa: { scope: 'individual' },
    bbb: { scope: 'individual', macrolanguage: 'mmm' },
    ccc: { scope: 'individual', macrolanguage: 'mmm' },
    ddd: { scope: 'individual', macrolanguage: 'nnn' },
    mmm: {
      scope: 'macrolanguage',
      members: ['bbb', 'ccc'],
      predominant: { language: 'bbb', authorities: ['registry-one', 'registry-two'], agreement: 'unanimous' },
    },
    nnn: {
      scope: 'macrolanguage',
      members: ['ddd'],
      noPredominant: 'no registry names a member',
    },
  },
};

describe('resolver mechanics, against a fixture', () => {
  test('individual resolves exact', () => {
    assert.equal(resolveTag('aaa', { index: FIXTURE }).route, ROUTE.EXACT);
  });

  test('an alias reaches its language', () => {
    assert.equal(resolveTag('xx', { index: FIXTURE }).language, 'aaa');
  });

  test('a macrolanguage with one agreed member reports it', () => {
    const r = resolveTag('mmm', { index: FIXTURE });
    assert.equal(r.route, ROUTE.MACROLANGUAGE);
    assert.equal(r.predominant.language, 'bbb');
  });

  test('a macrolanguage with none says why', () => {
    const r = resolveTag('nnn', { index: FIXTURE });
    assert.equal(r.predominant, null);
    assert.equal(r.note, 'no registry names a member');
  });

  test('an ambiguous tag returns every reading, attributed', () => {
    const r = resolveTag('zzz', { index: FIXTURE });
    assert.equal(r.route, ROUTE.AMBIGUOUS);
    assert.equal(r.language, null);
    assert.equal(r.candidates.length, 2);
  });

  test('coverage: the four verdicts', () => {
    const at = (language, covered) => resolveCoverage({ language, covered, index: FIXTURE }).verdict;
    assert.equal(at('aaa', ['aaa']), COVERAGE.EXACT);
    assert.equal(at('bbb', ['mmm']), COVERAGE.VIA_PREDOMINANT);
    assert.equal(at('ccc', ['mmm']), COVERAGE.VIA_MACROLANGUAGE);
    assert.equal(at('ddd', ['nnn']), COVERAGE.VIA_MACROLANGUAGE);
    assert.equal(at('aaa', ['mmm']), COVERAGE.NONE);
  });

  test('coverage never climbs: a macrolanguage is not covered by its member', () => {
    // The inverse propagation, which is just as wrong and easier to write by
    // accident: supporting Mandarin does not mean supporting Chinese.
    assert.equal(
      resolveCoverage({ language: 'mmm', covered: ['bbb'], index: FIXTURE }).verdict,
      COVERAGE.NONE,
    );
  });

  test('coverage never spreads sideways between siblings', () => {
    assert.equal(
      resolveCoverage({ language: 'ccc', covered: ['bbb'], index: FIXTURE }).verdict,
      COVERAGE.NONE,
    );
  });
});

describe('resolveTag: an individual language resolves exactly', {
  skip: haveIndex ? false : 'no tag index — run build-atlas.mjs',
}, () => {
  test('a three-letter code is itself', () => {
    const r = resolveTag('crk', { index });
    assert.equal(r.route, ROUTE.EXACT);
    assert.equal(r.language, 'crk');
    assert.equal(r.scope, 'individual');
  });

  test('a two-letter code reaches its language', () => {
    assert.equal(resolveTag('fr', { index }).language, 'fra');
  });

  test('a deprecated code still reaches its language', () => {
    // `iw` and `in` are decades-dead and still turn up in real config files.
    assert.equal(resolveTag('iw', { index }).language, 'heb');
    assert.equal(resolveTag('in', { index }).language, 'ind');
  });

  test('script and region do not change which language it is', () => {
    for (const t of ['crk', 'crk-Cans', 'crk-Cans-CA', 'crk-Latn']) {
      assert.equal(resolveTag(t, { index }).language, 'crk', t);
    }
  });

  test('a language folded into a macrolanguage keeps its own code', () => {
    // The `ayr` regression: it was filed as an alias of `aym`, which made
    // Central Aymara unreachable by the only code it has.
    const r = resolveTag('ayr', { index });
    assert.equal(r.route, ROUTE.EXACT);
    assert.equal(r.language, 'ayr');
  });
});

describe('resolveTag: macrolanguages are reported, never silently routed', {
  skip: haveIndex ? false : 'no tag index — run build-atlas.mjs',
}, () => {
  test('zh resolves to the macrolanguage and cites its predominant member', () => {
    const r = resolveTag('zh', { index });
    assert.equal(r.route, ROUTE.MACROLANGUAGE);
    assert.equal(r.language, 'zho');
    assert.equal(r.predominant.language, 'cmn');
    assert.equal(r.predominant.agreement, 'unanimous');
    assert.equal(r.predominant.authorities.length, 2);
  });

  test('ar likewise', () => {
    const r = resolveTag('ar', { index });
    assert.equal(r.language, 'ara');
    assert.equal(r.predominant.language, 'arb');
  });

  test('cre names Woods Cree, not Plains Cree', () => {
    // Both registries agree, and they do not agree with what this project
    // would have picked. That is the whole reason the value is cited.
    const r = resolveTag('cr', { index });
    assert.equal(r.language, 'cre');
    assert.equal(r.predominant.language, 'cwd');
    assert.notEqual(r.predominant.language, 'crk');
  });

  test('Norwegian has NO cited predominant member', () => {
    // Which is why `no` -> `nob` is an editorial decision. If a future CLDR
    // release adds the alias this test fails, and the decision can be retired
    // in favour of the citation. That is the intended way for it to break.
    const r = resolveTag('no', { index });
    assert.equal(r.route, ROUTE.MACROLANGUAGE);
    assert.equal(r.language, 'nor');
    assert.equal(r.predominant, null);
    assert.ok(r.note);
  });

  test('a macrolanguage with several folded members designates none', () => {
    const r = resolveTag('ak', { index });
    assert.equal(r.language, 'aka');
    assert.equal(r.predominant, null);
    assert.match(r.note, /fold into this tag/);
  });

  test('registries disagreeing about a member designates none', () => {
    const r = resolveTag('kok', { index });
    assert.equal(r.predominant, null);
    assert.match(r.note, /disagree/);
  });
});

describe('the FLORES lang_Script convention is read, and labelled', {
  skip: haveIndex ? false : 'no tag index — run build-atlas.mjs',
}, () => {
  test('an underscore tag resolves', () => {
    // FLORES-200, NLLB and Omnilingual MT all write `arb_Arab`. It is not BCP
    // 47 — that uses a hyphen — and rejecting it outright made the resolver
    // useless for exactly the datasets this project reads.
    for (const [tag, want] of [
      ['arb_Arab', 'arb'], ['eng_Latn', 'eng'], ['crk_Cans', 'crk'], ['zho_Hans', 'zho'],
    ]) {
      assert.equal(resolveTag(tag, { index }).language, want, tag);
    }
  });

  test('and says the input was not a BCP 47 tag', () => {
    // Normalised here and REPORTED, rather than by loosening the grammar. The
    // parser answers "is this well-formed"; `arb_Arab` is not, and a caller
    // should be told so even while getting the answer.
    const r = resolveTag('arb_Arab', { index });
    assert.match(r.note, /lang_Script convention, which is not BCP 47/);
  });

  test('a FLORES macrolanguage tag keeps BOTH facts', () => {
    // `zho_Hans` is a FLORES-style tag AND a macrolanguage. An earlier version
    // overwrote the reading note with the macrolanguage note, losing it on
    // exactly the inputs that needed it.
    const r = resolveTag('zho_Hans', { index });
    assert.equal(r.route, ROUTE.MACROLANGUAGE);
    assert.match(r.note, /lang_Script/);
  });

  test('a plain BCP 47 tag is not annotated', () => {
    assert.equal(resolveTag('fr', { index }).note, null);
    assert.equal(resolveTag('zh-Hans', { index }).note ?? null, null);
  });

  test('a hyphenated tag is never re-read as FLORES', () => {
    // Only an input with no hyphen at all is a candidate, so a real BCP 47 tag
    // containing an underscore stays malformed rather than being silently
    // rewritten.
    assert.equal(resolveTag('fr_FR-x', { index }).route, ROUTE.MALFORMED);
  });
});

describe('resolveTag: nothing is guessed', {
  skip: haveIndex ? false : 'no tag index — run build-atlas.mjs',
}, () => {
  test('a tag two registries read differently is ambiguous, not resolved', () => {
    const r = resolveTag('drh', { index });
    assert.equal(r.route, ROUTE.AMBIGUOUS);
    assert.equal(r.language, null);
    assert.deepEqual(r.candidates.map((c) => c.language).sort(), ['khk', 'mon']);
    for (const c of r.candidates) assert.ok(c.sources.length, 'every reading is attributed');
  });

  test('a private-use tag says so rather than failing', () => {
    const r = resolveTag('x-pirate', { index });
    assert.equal(r.route, ROUTE.PRIVATE_USE);
    assert.equal(r.language, null);
  });

  test('a well-formed but unknown code is unknown, not malformed', () => {
    const r = resolveTag('qqq', { index });
    assert.equal(r.route, ROUTE.UNKNOWN);
    assert.match(r.note, /well-formed/);
  });

  test('a malformed tag is malformed', () => {
    // `fr_FR` used to be the example here, and no longer is: an underscore-only
    // input is now read as the FLORES/POSIX convention and resolves, with the
    // reading labelled. These are malformed under any reading.
    for (const bad of ['fr--FR', '-fr', 'f', 'fr_FR-x']) {
      assert.equal(resolveTag(bad, { index }).route, ROUTE.MALFORMED, bad);
    }
  });

  test('every route has words a human can read, naming the input', () => {
    for (const t of ['crk', 'zh', 'no', 'drh', 'x-pirate', 'fr_FR', 'qqq']) {
      const words = explainResolution(resolveTag(t, { index }));
      assert.ok(words.includes(t), `${t}: the explanation should name what was asked`);
    }
  });
});

describe('resolveCoverage: coverage is never propagated', {
  skip: haveIndex ? false : 'no tag index — run build-atlas.mjs',
}, () => {
  test('exact when the method lists the language', () => {
    const r = resolveCoverage({ language: 'fra', covered: ['fra', 'deu'], index });
    assert.equal(r.verdict, COVERAGE.EXACT);
  });

  test('via-predominant when the registries name this member', () => {
    const r = resolveCoverage({ language: 'cmn', covered: ['zho'], index });
    assert.equal(r.verdict, COVERAGE.VIA_PREDOMINANT);
    assert.equal(r.via, 'zho');
    assert.equal(r.authorities.length, 2);
    // Even at its strongest the verdict refuses to say the method said so.
    assert.match(r.because, /never said so itself/);
  });

  test('via-macrolanguage for Plains Cree under OPUS-MT\'s `cre`', () => {
    // The case this whole layer was built for. OPUS publishes `cre`; the
    // registries name `cwd`. Plains Cree gets the weaker, true answer.
    const r = resolveCoverage({ language: 'crk', covered: ['cre'], index });
    assert.equal(r.verdict, COVERAGE.VIA_MACROLANGUAGE);
    assert.equal(r.via, 'cre');
    assert.match(r.because, /cwd/);
  });

  test('and Woods Cree gets the stronger one from the same coverage', () => {
    const r = resolveCoverage({ language: 'cwd', covered: ['cre'], index });
    assert.equal(r.verdict, COVERAGE.VIA_PREDOMINANT);
  });

  test('none when neither the language nor its macrolanguage is listed', () => {
    const r = resolveCoverage({ language: 'crk', covered: ['fra', 'deu'], index });
    assert.equal(r.verdict, COVERAGE.NONE);
  });

  test('a member of an undesignated macrolanguage never gets via-predominant', () => {
    // Akan has no predominant member, so neither Fanti nor Twi may claim to be
    // the one `ak` denotes.
    for (const member of ['fat', 'twi']) {
      const r = resolveCoverage({ language: member, covered: ['aka'], index });
      assert.equal(r.verdict, COVERAGE.VIA_MACROLANGUAGE, member);
    }
  });

  test('every verdict explains itself', () => {
    for (const [lang, cov] of [['fra', ['fra']], ['cmn', ['zho']], ['crk', ['cre']], ['crk', []]]) {
      assert.ok(resolveCoverage({ language: lang, covered: cov, index }).because.length > 10);
    }
  });
});
