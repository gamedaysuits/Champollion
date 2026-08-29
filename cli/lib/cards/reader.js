/**
 * reader.js — the ONE way JavaScript reads a language card.
 *
 * WHY THIS EXISTS
 *   Eight files under cli/lib read the card corpus, each in its own way, and
 *   three arena Python modules do the same on their side. That is eleven places
 *   to update whenever a card's shape changes — which is precisely why the last
 *   cutover attempt failed 211 tests, and why it would have failed again the
 *   next time.
 *
 *   One reader per runtime means a shape change is fixed ONCE. It is not an
 *   abstraction for its own sake; it is the difference between a corpus that
 *   can evolve and one that is frozen by its own consumers.
 *
 * WHAT A CARD LOOKS LIKE NOW, AND WHY IT CHANGED
 *   The old corpus published a field on every card whether or not anything was
 *   known: 41.1% of its field instances were empty — 237,156 published blanks,
 *   with six fields empty on 100% of cards and `nativeName` null on 7,300.
 *   A blank row asserts that there is nothing to know, when it means nobody
 *   told us.
 *
 *   The new corpus OMITS what no source asserts. So the first rule of reading a
 *   card is that `undefined` means "no source said", and it is normal.
 *
 * ATTRIBUTED FIELDS ARE OBJECTS, ON PURPOSE
 *   Where several bodies may speak — name, endangerment, speaker counts,
 *   family, endonym, method support — the card carries ALL of them with their
 *   sources, plus a word describing the shape of the disagreement. Nothing
 *   picks a winner, because picking one destroys the evidence that there was a
 *   question.
 *
 *   That makes `card.name` an object rather than a string, which is honest and
 *   inconvenient. `display()` is the inconvenience handled in one place: it
 *   returns something printable and NEVER invents a consensus that does not
 *   exist — where sources genuinely disagree it says so rather than quietly
 *   choosing the first.
 */

import fs from 'node:fs';
import path from 'node:path';

import { CARDS_DIR, isValidCardCode } from './env.js';

/**
 * Agreement labels the projector emits. Kept here so a reader can branch on
 * them without string-matching, and so an unrecognised one is caught rather
 * than silently treated as agreement.
 */
export const AGREEMENT = Object.freeze({
  SINGLE: 'single',
  UNANIMOUS: 'unanimous',
  MULTIPLE_ASSESSMENTS: 'multiple-assessments',
  MULTIPLE_VARIANTS: 'multiple-variants',
  CONFLICTING: 'conflicting',
  INCOMMENSURABLE: 'incommensurable',
});

const KNOWN_AGREEMENT = new Set(Object.values(AGREEMENT));

/** An attributed field is an object with `agreement` and `values`. */
export function isAttributed(value) {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && Array.isArray(value.values)
    && typeof value.agreement === 'string';
}

/**
 * A printable value for a field, whatever its shape.
 *
 * Returns `undefined` when nothing is known — never a placeholder, never an
 * empty string. A caller that wants "Unknown" on screen should write it there,
 * because that is a presentation decision and this is not the presentation
 * layer.
 *
 * For an attributed field it returns the CONSENSUS when there is one. Where
 * sources disagree there is no consensus to return, and inventing one by taking
 * the first value would hide exactly what the attributed shape exists to show —
 * so it returns undefined and the caller must ask for `attributions()`.
 *
 * @param {unknown} value
 * @param {{onDisagreement?: 'undefined'|'first'}} [opts]
 */
export function display(value, { onDisagreement = 'undefined' } = {}) {
  if (value === null || value === undefined) return undefined;
  if (!isAttributed(value)) {
    if (Array.isArray(value)) return value.length ? value : undefined;
    return value;
  }
  if (!KNOWN_AGREEMENT.has(value.agreement)) {
    throw new Error(
      `Unknown agreement "${value.agreement}". A reader that shrugs at an unrecognised `
      + 'agreement will present a disagreement as a fact.',
    );
  }
  if ('consensus' in value) return value.consensus;
  // No consensus: the sources genuinely differ, or they describe different
  // subjects. Callers opt in to a first-value fallback with their eyes open.
  if (onDisagreement === 'first') return value.values[0]?.value;
  return undefined;
}

/**
 * Every value of a field with its source, always an array.
 *
 * Use this wherever the answer matters — a UI showing endangerment, anything
 * citing a source, anything deciding what to translate. `display()` is for
 * labels and headings; this is for claims.
 */
export function attributions(value) {
  if (value === null || value === undefined) return [];
  if (isAttributed(value)) return value.values;
  if (Array.isArray(value)) return value.map((v) => ({ value: v }));
  return [{ value }];
}

/** True when sources disagree in a way a reader should be shown. */
export function isDisputed(value) {
  return isAttributed(value)
    && (value.agreement === AGREEMENT.CONFLICTING
      || value.agreement === AGREEMENT.INCOMMENSURABLE);
}

/**
 * Read one card. Returns null when the language has no card — which is a real
 * answer: a language with no asserted value gets no card, rather than an empty
 * one implying it is documented.
 */
export function readCard(code, { dir = CARDS_DIR } = {}) {
  // Reuses the corpus's own code validator rather than a second regex — two
  // definitions of a valid code is one more than a corpus can afford.
  if (!isValidCardCode(code)) return null;
  const file = path.join(dir, `${code}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

/** Every card code the corpus holds. */
export function listCodes({ dir = CARDS_DIR } = {}) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json') && f !== 'language-tree.json')
    .map((f) => f.replace(/\.json$/, ''))
    .sort();
}

/**
 * The atlas build a card came from.
 *
 * Cards carry a version and deliberately no build DATE — a date would make two
 * builds from identical pinned sources differ by the calendar, which destroys
 * the one property that lets anyone check the atlas. The version resolves to a
 * date in ATLAS-RELEASE.json.
 */
export function atlasVersion(card) {
  return card?._atlas?.version ?? null;
}

/**
 * Refuse a corpus older than a consumer requires.
 *
 * Compared as strings, deliberately: versions are opaque labels here, and a
 * reader that tried to parse semver out of them would start guessing about
 * orderings nobody defined. This asks only "is it the build I was written
 * against", which is the question a consumer can actually answer.
 */
export function requireAtlas(card, expected) {
  const actual = atlasVersion(card);
  if (actual !== expected) {
    throw new Error(
      `Card ${card?.code ?? '?'} was built by atlas ${actual ?? '(unversioned)'}, but this `
      + `consumer was written against ${expected}. Rebuild, or update the consumer — a `
      + 'card read against the wrong shape fails quietly rather than loudly.',
    );
  }
  return card;
}

/**
 * What is NOT known about a language, and why the card is thin.
 *
 * `coverage.notAttested` counts the times a source covered this language and
 * its documentation did not answer — which is different from nobody having
 * looked, and is the number that justifies greying a card out rather than
 * leaving it looking neglected.
 */
export function coverage(card) {
  const c = card?.coverage;
  if (!c) return null;
  return {
    sources: c.sourceCount ?? 0,
    present: c.componentsPresent ?? 0,
    total: c.componentsTotal ?? 0,
    notAttested: c.notAttested ?? 0,
    fraction: c.componentsTotal ? c.componentsPresent / c.componentsTotal : 0,
  };
}

/**
 * Normalise an atlas-shaped card into the field vocabulary the runtime reads.
 *
 * THE READER IS THE ADAPTER — the atlas is not made to lie. The store keeps its
 * honest names (`endonym`, `textDirection`, `codeAliases`, `scripts[]`) and the
 * attribution envelopes that let a card show disagreeing sources side by side.
 * The runtime grew up on the old corpus's flat names, and 24 modules import the
 * registry that serves them. Renaming the atlas to match would bake the legacy
 * vocabulary into the SSOT forever; rewriting 24 modules mid-cutover multiplies
 * risk. One adapter at the single load site does neither.
 *
 * WHAT IT REFUSES TO INVENT
 *   `dir` — text direction is asserted for only 162 languages. An absent
 *   direction stays absent; defaulting to 'ltr' would assert a fact about
 *   ~7,700 languages nobody measured, which is exactly the class of quiet
 *   fabrication the rebuild exists to end.
 *   `script` — the primary script is the FIRST entry of `scripts[]`, which is
 *   LinguaMeta's own ordering (the spec records that). Choosing it is a
 *   derivation, and it is only made when the list exists.
 *
 * Old-shape cards pass through untouched (their fields are already flat), so
 * the same runtime serves both corpora during the migration window.
 */
/**
 * The endangerment-scale decision (authority order + per-scale vocabularies).
 * Read from shared/catalogue/ in either layout — the repo root in a checkout,
 * `cli/shared/` in a published package — for the same reason the prompt config
 * is: a packaged install has no monorepo root above it.
 */
let _VITALITY_SCALES = null;
function _vitalityScales() {
  if (_VITALITY_SCALES !== null) return _VITALITY_SCALES;
  for (const rel of ['../../shared/catalogue/', '../../../shared/catalogue/']) {
    try {
      _VITALITY_SCALES = JSON.parse(fs.readFileSync(
        new URL(`${rel}vitality-scales.json`, import.meta.url), 'utf-8',
      ));
      return _VITALITY_SCALES;
    } catch { /* try the next layout */ }
  }
  _VITALITY_SCALES = false;
  return _VITALITY_SCALES;
}

let _SCRIPT_RTL = null;
function _scriptRtl() {
  if (_SCRIPT_RTL !== null) return _SCRIPT_RTL;
  try {
    const m = JSON.parse(fs.readFileSync(new URL(
      '../../data/cldr-supplemental/scriptMetadata.json', import.meta.url,
    ), 'utf-8')).scriptMetadata;
    _SCRIPT_RTL = Object.fromEntries(
      Object.entries(m).map(([k, v]) => [k, v?.rtl === 'YES']),
    );
  } catch { _SCRIPT_RTL = false; }
  return _SCRIPT_RTL;
}

export function normalizeCard(card) {
  if (!card || typeof card !== 'object') return card;
  const out = card;

  // Attribution envelopes → the displayable value, by the standing rule:
  // display() returns undefined on genuine disagreement rather than electing a
  // winner among sources.
  // `name` is an IDENTITY field: a card with no display name is unusable by
  // every list, prompt and log line. So this is the documented opt-in —
  // display(v, {onDisagreement:'first'}) — taken with eyes open: on the 439
  // languages where registries disagree, the first recorded value labels the
  // card, deterministically, while the full disagreement stays on the card in
  // `attributions()` for anything that CLAIMS rather than labels.
  if (isAttributed(out.name)) out.name = display(out.name, { onDisagreement: 'first' });

  if (out.nativeName === undefined && out.endonym !== undefined) {
    const v = display(out.endonym, { onDisagreement: 'first' });
    if (v !== undefined) out.nativeName = v;
  }
  if (out.aliases === undefined && Array.isArray(out.codeAliases)) {
    out.aliases = out.codeAliases;
  }
  if (out.script === undefined) {
    // The primary script comes from the CITED full tag (CLDR likelySubtags +
    // SIL langtags both attest en-Latn-US), never from scripts[0] — that list
    // is deterministic-alphabetical, and taking its head once made English's
    // primary script DESERET. A one-entry list cannot misorder, so it may
    // still answer; a multi-script list without a full tag stays unanswered.
    const tag = isAttributed(out.bcp47FullTag)
      ? display(out.bcp47FullTag, { onDisagreement: 'first' })
      : out.bcp47FullTag;
    const m = typeof tag === 'string' ? /^[a-z]{2,3}-([A-Z][a-z]{3})\b/.exec(tag) : null;
    if (m) {
      out.script = m[1];
    } else if (Array.isArray(out.scripts) && out.scripts.length === 1) {
      const only = out.scripts[0];
      out.script = typeof only === 'string' ? only : only?.code ?? undefined;
    }
  }
  if (out.dir === undefined && out.script && typeof out.textDirection !== 'string') {
    // No per-locale orientation claim exists for ~7,700 languages — but the
    // SCRIPT's direction is CLDR's own per-script metadata (scriptMetadata
    // `rtl`), pinned like everything else. "Arab runs right-to-left" is a
    // fact about the script, so deriving a card's direction from its script
    // is a cited derivation, not a default.
    const rtl = _scriptRtl();
    if (rtl && out.script in rtl) out.dir = rtl[out.script] ? 'rtl' : 'ltr';
  }
  if (out.dir === undefined && typeof out.textDirection === 'string') {
    // The atlas records CLDR's own vocabulary; the runtime's enum is ltr/rtl.
    // Only the two known values map — an unrecognised direction stays absent
    // rather than being guessed into one of two buckets.
    const dir = { 'left-to-right': 'ltr', 'right-to-left': 'rtl' }[out.textDirection];
    if (dir) out.dir = dir;
  }
  // ISO 639-3 publishes the TYPE as a word ("Living", "Extinct", "Ancient");
  // the old corpus stored its initial, and consumers count living languages
  // with `isoType === 'L'`. Without this the count is silently ZERO and
  // `uncoveredLiving` goes NEGATIVE — which is how a public page came to be one
  // build away from displaying minus five hundred and fifty-two.
  if (out.isoType === undefined && typeof out.isoLanguageType === 'string') {
    out.isoType = out.isoLanguageType.charAt(0).toUpperCase();
    if (out._fieldSources?.isoLanguageType && !out._fieldSources.isoType) {
      out._fieldSources.isoType = out._fieldSources.isoLanguageType;
    }
  }
  // Same shape, same reason: `isoScope` is the registry's own letter to every
  // consumer that tests it (`=== 'M'` for a macrolanguage hub). The atlas
  // records the legible word by a deliberate decision, so the initial is
  // offered ALONGSIDE it rather than replacing it.
  if (out.isoScopeInitial === undefined && typeof out.isoScope === 'string') {
    out.isoScopeInitial = out.isoScope.charAt(0).toUpperCase();
  }

  // SPEAKER ESTIMATES: the envelope IS the list, and that is the whole point.
  //
  // 2,173 languages have sources that genuinely disagree about how many people
  // speak them, so the atlas records every claim with its source. Both display
  // layers were written for the old array-of-estimates shape: the CLI iterated
  // it (`champollion card` crashed on every language — "estimates is not
  // iterable") and the website guarded it with `Array.isArray`, which an
  // envelope fails, so the block that exists precisely to show that sources
  // differ silently vanished from every page.
  //
  // The envelope's `values[]` is that array, one entry per source. Rebuilding
  // it here restores both consumers without either of them changing, and
  // without flattening a disagreement into one number — which the site's own
  // caption ("sources differ, all shown") promises we do not do.
  if (isAttributed(out.speakerEstimates)) {
    const claims = out.speakerEstimates.values ?? [];
    out.speakerEstimates = claims.map((c) => {
      // The store keeps values as text because that is how it keeps them
      // comparable; the UI formats numbers. Convert only when the value really
      // is a number — a range or a qualified figure stays verbatim rather than
      // becoming NaN.
      const n = Number(c?.value);
      return {
        count: Number.isFinite(n) && String(c?.value).trim() !== '' ? n : c?.value,
        source: c?.source ?? null,
        ...(c?.year ? { date: c.year } : {}),
        // The claim's own scope note ("BC only", "L1 speakers") travels with
        // it — dropping it once made ELCat's British-Columbia-only count of
        // Plains Cree read as the language's total.
        ...(c?.note ? { note: c.note } : {}),
      };
    });
  }

  // VITALITY: one display tier, from ONE named source, never a merge.
  //
  // The old corpus carried `vitality.unescoStatus`, and four generators plus
  // the map colouring still read it. The atlas replaced it with `endangerment`,
  // which records every source's assessment on its own scale — agreement
  // 'incommensurable', because ELCat's "severely endangered", Glottolog's
  // "moribund" and LinguaMeta's "Severely endangered" are three vocabularies,
  // not three votes. Nothing bridged them, so `vitality` was undefined and the
  // public catalogue showed a null endangerment on all 9,934 entries: the same
  // silent-zero class as the living-language count.
  //
  // The bridge reads the FIRST source in the declared authority order that has
  // an assessment, and maps that source's own words on that source's own scale.
  // It never combines two sources, and a language nobody assesses stays
  // unknown rather than defaulting to safe — a silence must not read as
  // reassurance. The authority order and every vocabulary live in
  // shared/catalogue/vitality-scales.json, so the judgement is arguable data
  // rather than a constant buried in a display path.
  if (out.vitality === undefined && out.endangerment !== undefined) {
    const scales = _vitalityScales();
    if (scales) {
      const claims = attributions(out.endangerment);
      for (const source of scales.authorityOrder) {
        const hit = claims.find((c) => String(c.source ?? '').startsWith(source));
        if (!hit) continue;
        const tier = scales.scales[source]?.map?.[String(hit.value).trim()];
        if (!tier) continue;
        out.vitality = {
          unescoStatus: tier,
          assessedBy: hit.source,
          note: 'champollion-derived: one display tier read from a single cited '
            + 'assessment. The full set of assessments stays on `endangerment`.',
        };
        if (out._fieldSources && !out._fieldSources.vitality) {
          out._fieldSources.vitality = [`derived:${hit.source}`];
        }
        break;
      }
    }
  }

  if (out.dataSources === undefined && out._fieldSources
      && typeof out._fieldSources === 'object') {
    // The atlas stamps provenance per FIELD; the old corpus also carried a
    // flat card-level `dataSources` list, and the licence sweep
    // (cli/lib/card-source-resolution.mjs) reads that list. Against new-shape
    // cards it found nothing and returned an EMPTY set — no error, the sweep
    // just silently covered zero sources, which is the worst possible failure
    // for a licence check. The union of the per-field stamps is the same
    // claim, assembled rather than duplicated.
    const all = new Set();
    for (const v of Object.values(out._fieldSources)) {
      for (const s of Array.isArray(v) ? v : [v]) if (typeof s === 'string') all.add(s);
    }
    if (all.size) out.dataSources = [...all].sort();
  }
  if (out.iso639_3 === undefined && typeof out.locale?.language === 'string') {
    // A locale's ISO 639-3 identity is its LANGUAGE's: `fra-CA` is French. The
    // locale block names the parent explicitly, so this is a lookup, not a
    // parse of the id.
    out.iso639_3 = out.locale.language;
  }
  if (out.iso639_3 === undefined && typeof out.code === 'string'
      && /^[a-z]{3}$/.test(out.code)) {
    // The atlas dropped the copy because the code IS the ISO 639-3 id for
    // three-letter spine rows. Restating it here is projection, not invention.
    out.iso639_3 = out.code;
  }
  return out;
}
