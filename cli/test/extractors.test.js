/**
 * extractor test suite — the refusals that keep an unattributable fact out.
 *
 * The store held 3,972,064 facts with no release, written by scripts several of
 * which no longer exist. Every one cited a source NAME, which reads like
 * provenance and is not: a name cannot say WHICH bytes, so nothing derived from
 * it can be re-derived or checked.
 *
 * These tests hold the two guarantees that stop that recurring:
 *   - an extraction cannot START without a verified, pinned snapshot
 *   - a derived value cannot wear an upstream's name
 *
 * plus the absence semantics and the spine-resolution bug that silently
 * discarded 97% of Grambank on its first run.
 *
 * @see cli/scripts/extractors/lib/extract-lib.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { DATA_ROOT, readSnapshot } from '../scripts/fetchers/lib/fetch-lib.mjs';
import { codeIndex, openExtraction, readCldf } from '../scripts/extractors/lib/extract-lib.mjs';

const SPEC = JSON.parse(fs.readFileSync(
  path.join(DATA_ROOT, '..', '..', 'shared', 'card-field-spec.json'), 'utf-8',
));

describe('openExtraction — refuses to produce unattributable facts', () => {
  it('refuses a source with no SNAPSHOT', () => {
    assert.throws(
      () => openExtraction({ source: 'nope', dir: '__no_such_dir__', extractor: 'test' }),
      /SNAPSHOT\.json is missing/,
      'extracting without a pin is exactly how 3.97M unattributable facts happened',
    );
  });
});

describe('the shipped extractors', () => {
  const dir = path.join(DATA_ROOT, '..', 'scripts', 'extractors');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mjs'));

  it('every extractor names a source that can be pinned', async () => {
    assert.ok(files.length >= 4, 'expected at least the spine plus typology extractors');
    for (const f of files) {
      const mod = await import(`../scripts/extractors/${f}`);
      assert.ok(mod.source, `${f} exports no source name`);

      if (mod.kind === 'curated-language') {
        // A CURATED-LANGUAGE extractor writes LANGUAGE facts (not entity facts)
        // from a repo-maintained file. It pins to that file's content hash plus
        // the commit that changed it, exactly like the entity-curated lane — the
        // only difference is which table it writes to, so it has no entityType.
        assert.match(mod.source, /^(curated:|champollion-)/,
          `${f} writes curated language facts but its source name does not mark `
          + 'it as internal — that prefix is what stops a hand-maintained value '
          + 'from ever being stamped with an upstream\'s name');
        assert.equal(mod.dir, null, `${f} is curated but also declares a data dir`);
        continue;
      }

      if (mod.kind === 'derived') {
        // A DERIVED extractor computes from other facts. Its release pins to the
        // derivation's own version, bumped when the logic changes — otherwise a
        // card could change meaning while claiming the same basis. It has no
        // upstream directory and no entity type, and says so deliberately.
        assert.equal(mod.dir, null, `${f} declares kind:'derived' but also a data dir`);
        continue;
      }

      if (!mod.dir) {
        // A CURATED extractor has no upstream directory because we are the
        // upstream. It must say which entity type it builds, and its release is
        // its own file's content hash plus the commit that last changed it —
        // registered at extraction time, not from a SNAPSHOT.
        assert.ok(mod.entityType,
          `${f} declares no data directory and no entityType — it is neither a `
          + 'fetched source nor a curated one, so nothing can pin its facts');
        assert.match(mod.source, /^curated:/,
          `${f} is a curated extractor but its source name does not start with `
          + '"curated:", which is what keeps a hand-maintained value from ever '
          + 'being stamped with an upstream\'s name');
        continue;
      }

      const snap = readSnapshot(mod.dir);
      assert.ok(snap, `${f} names cli/data/${mod.dir}/ which has no SNAPSHOT`);
      assert.ok(snap.pin?.value || snap.pin?.doi,
        `${f}'s source is not pinned — its facts could not name a release`);
    }
  });
});

describe('code resolution goes through the spine', () => {
  // The bug this guards: Grambank ships Glottocode populated and ISO639P3code
  // EMPTY for nearly every row. Taking the first non-empty field yields
  // "abkh1244" where the spine holds "abk", so 429,446 of 441,663 facts were
  // discarded as "off-spine" — 97% of the dataset, reported as a coverage gap
  // rather than a resolution bug.
  const fakeSpine = {
    _knownCodes: new Set(['abk', 'crk']),
    _byGlottocode: new Map([['abkh1244', 'abk'], ['plai1258', 'crk']]),
    resolveCode(iso, glotto) {
      if (iso && this._knownCodes.has(iso)) return iso;
      if (glotto && this._byGlottocode.has(glotto)) return this._byGlottocode.get(glotto);
      if (glotto && this._knownCodes.has(glotto)) return glotto;
      return iso || glotto || null;
    },
  };

  it('maps a glottocode-only row onto the spine\'s ISO code', () => {
    const { map } = codeIndex(
      [{ ID: 'abkh1244', Glottocode: 'abkh1244', ISO639P3code: '' }], fakeSpine,
    );
    assert.equal(map.get('abkh1244'), 'abk',
      'a glottocode-keyed dataset row must resolve to the spine code, not stay a glottocode');
  });

  it('prefers the ISO code when both are given and both resolve', () => {
    const { map } = codeIndex(
      [{ ID: 'x', Glottocode: 'plai1258', ISO639P3code: 'crk' }], fakeSpine,
    );
    assert.equal(map.get('x'), 'crk');
  });

  it('counts rows it cannot resolve rather than dropping them silently', () => {
    const { map, unresolvable } = codeIndex(
      [{ ID: 'y', Glottocode: '', ISO639P3code: '' }], fakeSpine,
    );
    assert.equal(map.size, 0);
    assert.equal(unresolvable, 1, 'coverage we do not have must not look like coverage we do');
  });
});

describe('CLDF reading', () => {
  it('uses the RFC-4180 reader, so quoted multi-line prose survives', () => {
    // ELCat's endangerment comments run to paragraphs inside quoted fields. A
    // line-based split shreds them — that was the 2026-07-19 damage.
    const { languages } = readCldf('elcat', ['languages']);
    assert.ok(languages.length > 3000, 'expected ELCat to carry thousands of languages');
    const withProse = languages.filter((l) => (l.Comment ?? '').includes('\n'));
    for (const l of withProse.slice(0, 5)) {
      assert.ok(l.ID && /^\d+$/.test(l.ID),
        `row ${JSON.stringify(l.ID)} is misaligned — a multi-line field leaked into the ID`);
    }
  });
});

describe('the field spec keeps the card-boundary invariant', () => {
  const flat = [];
  for (const [name, def] of Object.entries(SPEC.fields)) {
    flat.push([name, def]);
    for (const [sub, s] of Object.entries(def.properties ?? {})) flat.push([`${name}.${sub}`, s]);
  }

  it('names no measured score of method output', () => {
    // Lint R3: chrF/BLEU/COMET/TER and FST acceptance are run results keyed by
    // (method, dataset, metric) and belong on the leaderboard, never a card.
    const banned = /\b(chrf|bleu|comet|ter|fst[ -]?accept|accuracy|score)\b/i;
    for (const [name, def] of flat) {
      assert.ok(!banned.test(name), `spec field "${name}" looks like a run result`);
      for (const f of def.facts ?? []) {
        assert.ok(!banned.test(f.property),
          `spec field "${name}" reads fact property "${f.property}", which looks like a score`);
      }
    }
  });

  it('sources a tone claim ONLY from PHOIBLE', () => {
    // Lint R1. WALS chapter 13A is also called "Tone" and IS in the store, but
    // a card's tone claim has exactly one authority.
    const tone = flat.filter(([n]) => /tone/i.test(n));
    assert.ok(tone.length, 'expected the spec to define tone somewhere');
    for (const [name, def] of tone) {
      for (const s of def.sources ?? []) {
        assert.ok(['phoible', 'champollion-derived'].includes(s),
          `"${name}" draws tone from "${s}" — PHOIBLE is the sole tone authority`);
      }
    }
  });

  it('attributes every derived field to champollion-derived, never an upstream', () => {
    for (const [name, def] of flat) {
      if (!/median|count$/i.test(name)) continue;
      if (!def.note || !/OURS/.test(def.note)) continue;
      assert.deepEqual(def.sources, ['champollion-derived'],
        `"${name}" is documented as our derivation but cites an upstream as its source`);
    }
  });

  it('gives every field an absence policy', () => {
    for (const [name, def] of flat) {
      if (def.rule === 'identity' || def.rule === 'object') continue;
      assert.ok(def.absence, `"${name}" does not say what happens when no source asserts it`);
    }
  });
});

describe('one field per concept, and the conflict lives inside it', () => {
  // The founder's rule: do not have "a bazillion different fields that all mean
  // the same thing", and never let one source silently overwrite another.
  // Both failure modes were present — endangerment existed as four fields
  // (elcatEndangerment, aesStatus, aesLevel, linguametaEndangerment) plus a
  // fifth list, and `name` was a `direct` field with a source priority that
  // discarded the losing registries' names entirely.
  const F = SPEC.fields;

  it('has exactly ONE endangerment field, fed by every assessing body', () => {
    const endangerment = Object.keys(F).filter((k) => /endanger|vitality/i.test(k));
    assert.deepEqual(endangerment, ['endangerment'],
      `found ${endangerment.length} fields for one concept: ${endangerment.join(', ')}`);
    assert.equal(F.endangerment.rule, 'attributed');
    assert.ok(F.endangerment.sources.length >= 3,
      'all three assessing bodies must feed the one field');
  });

  it('has exactly ONE speaker-count field, ranges included', () => {
    const speakers = Object.keys(F).filter((k) => /speaker/i.test(k));
    assert.deepEqual(speakers, ['speakerEstimates'],
      `splitting counts from ranges makes a consumer look in two places: ${speakers.join(', ')}`);
  });

  it('never resolves a disagreement with a source PRIORITY', () => {
    // A `direct` field whose spec lists more than one source picks a winner
    // silently and the losing value never appears anywhere.
    for (const [name, def] of Object.entries(F)) {
      if (def.rule !== 'direct') continue;
      assert.ok((def.sources ?? []).length <= 1,
        `"${name}" is direct with ${def.sources.length} sources — it would silently `
        + 'pick one and discard the rest. Use `attributed`.');
    }
  });

  it('declares a scale wherever sources use different vocabularies', () => {
    // "severely endangered" (ELCat) and "moribund" (Glottolog AES) are not a
    // dispute — they are different scales, and saying so is the difference
    // between reporting a disagreement and inventing one.
    assert.ok(F.endangerment.scaleBySource,
      'endangerment mixes three vocabularies and must name them');
    for (const s of F.endangerment.sources) {
      assert.ok(F.endangerment.scaleBySource[s], `no scale declared for "${s}"`);
    }
    assert.ok(!F.speakerEstimates.scaleBySource,
      'speaker counts ARE commensurable — declaring a scale would disguise a real '
      + 'conflict as a vocabulary difference');
  });
});
