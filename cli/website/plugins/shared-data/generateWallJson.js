/**
 * Generates `data/wall.json` — a tiny endonym-wall dataset for the homepage.
 *
 * The homepage must never fetch the full ~55 MB languages.json. Instead this
 * step distills it into a compact array (~150 KB) of languages that have a
 * real endonym (native name distinct from the English name) and a known
 * vitality status, so the "Living Rosetta" wall can render instantly.
 *
 * Entry shape (compact keys to keep the payload small):
 *   { c: code, e: endonym, n: English name, v: vitality tier, d: text dir }
 *
 * Vitality tiers (derived from vitality.unescoStatus on the cards):
 *   safe        ← "safe"
 *   vulnerable  ← "vulnerable"
 *   endangered  ← "definitely-endangered" | "severely-endangered" |
 *                 "critically-endangered"
 * Extinct and unknown-status languages are excluded — the wall shows the
 * living languages the project is about.
 *
 * Runs after generateLanguagesJson and reads its output, so card `extends`
 * inheritance is already resolved. Skipped when wall.json is newer than
 * languages.json (matters for the 13-locale build, which re-runs loadContent
 * per locale).
 *
 * KNOWN BIAS — signed languages are underrepresented on the wall.
 * The endonym requirement (a nativeName distinct from the English name) is
 * what filters them out: most sign languages are tagged unwritten — no
 * notation system (SignWriting, HamNoSys) has community-standard adoption
 * for everyday literacy — so their cards rarely carry an endonym. As of the
 * 2026-06 taxonomy audit, only ~19 of the 163 signed-language cards have a
 * renderable endonym and appear here (e.g. `fsl` "langue des signes
 * française", `jsl` "日本手話"); the rest (including `ase` and `psd`) are
 * excluded by data availability, not by policy — sign languages are full
 * natural languages and first-class catalog entries. Do not "fix" this by
 * synthesizing endonyms from English names. If endonym coverage improves in
 * the card data, the wall picks them up automatically.
 * See docs/LANGUAGE_TAXONOMY.md, Position 1 (sign languages) and Position 2
 * (writing is not a modality; orthographicStatus is the carrier).
 */

const fs = require('fs-extra');

const TIER_MAP = {
  safe: 'safe',
  vulnerable: 'vulnerable',
  'definitely-endangered': 'endangered',
  'severely-endangered': 'endangered',
  'critically-endangered': 'endangered',
};

/** Max characters for a chip — longer endonyms wreck the wall layout. */
const MAX_ENDONYM_LENGTH = 28;

/** Control chars / replacement char / PUA — not safe to render on the wall. */
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARS = /[\u0000-\u001F\u007F\uFFFD\uE000-\uF8FF]/;

/**
 * Pick the display endonym from a card's nativeName.
 * Cards sometimes list several variants ("nêhiyawêwin / ᓀᐦᐃᔭᐍᐏᐣ").
 * Prefer a non-Latin-script variant when one exists (more striking on the
 * wall and true to the "native scripts" intent), else the first variant.
 */
function pickEndonym(nativeName) {
  const variants = String(nativeName)
    .split(/\s*[/;]\s*/)
    .map((v) => v.trim())
    .filter(Boolean);
  if (variants.length === 0) return null;
  // "Non-Latin" = contains anything beyond Latin letters, diacritics,
  // combining marks, and spacing modifier letters (ʻokina etc.).
  const nonLatin = variants.find((v) => /[^\u0000-\u036F\u1E00-\u1EFF]/.test(v));
  return nonLatin || variants[0];
}

/** True when the endonym is safe and meaningful to render as a wall chip. */
function isRenderable(endonym, englishName) {
  if (!endonym) return false;
  if (endonym.length > MAX_ENDONYM_LENGTH) return false;
  if (UNSAFE_CHARS.test(endonym)) return false;
  if (/^[?\s.•-]*$/.test(endonym)) return false;
  // URL fragments and other junk that leaks into nativeName fields.
  if (/https?|www\.|[:=_@#%]|\d/.test(endonym)) return false;
  // The wall is about endonyms — skip languages whose native name is just
  // the English name again.
  if (endonym.toLowerCase() === String(englishName || '').trim().toLowerCase()) return false;
  return true;
}

/**
 * @param {object} opts
 * @param {string} opts.languagesFile — path to the resolved languages.json
 * @param {string} opts.outFile — path to write wall.json
 */
async function generateWallJson({languagesFile, outFile}) {
  // Freshness: languages.json is the single input.
  if (await fs.pathExists(outFile)) {
    const [outStat, inStat] = await Promise.all([
      fs.stat(outFile),
      fs.stat(languagesFile),
    ]);
    if (outStat.mtimeMs >= inStat.mtimeMs) return;
  }

  const cards = await fs.readJson(languagesFile);
  const wall = [];
  let excludedUnvetted = 0;

  for (const card of cards) {
    if (!card.code || !card.name || !card.nativeName) continue;
    const tier = TIER_MAP[card.vitality && card.vitality.unescoStatus];
    if (!tier) continue;

    // Authenticity gate (2026-06 endonym incident): only endonyms vetted by
    // validate-endonyms.mjs render on the wall. `nativeNameVerdict` is
    // stamped on cards by fix-endonym-authenticity.mjs; suspects (e.g.
    // labels attested only in another language, unresolved template names
    // like "te reo Turi" for nzs) and unstamped values are excluded — an
    // honest, smaller wall beats a wrong one.
    if (card.nativeNameVerdict !== 'verified' && card.nativeNameVerdict !== 'plausible') {
      excludedUnvetted++;
      continue;
    }

    const endonym = pickEndonym(card.nativeName);
    if (!isRenderable(endonym, card.name)) continue;

    wall.push({
      c: card.code,
      e: endonym,
      n: card.name,
      v: tier,
      d: card.dir === 'rtl' ? 'rtl' : 'ltr',
      // Cited facts for the widget to actually SHOW (languagesFile is the
      // cite-only display projection, so these already trace to a source):
      // family (Glottolog classification) + macroarea (region).
      f: (card.classification && card.classification.family) || null,
      m: card.macroarea || null,
    });
  }

  await fs.writeJson(outFile, wall);
  console.log(
    `[shared-data] Wrote ${wall.length} wall entries to ${outFile} ` +
    `(${excludedUnvetted} candidates excluded by the endonym authenticity gate)`,
  );
}

module.exports = {generateWallJson, pickEndonym, isRenderable};
