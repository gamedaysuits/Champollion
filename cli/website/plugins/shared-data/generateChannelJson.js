/**
 * Generates `data/channel.json` — the endonym CHANNEL dataset for the v4
 * landing (left-rail vertical conveyor, "the list of languages").
 *
 * Unlike wall.json (which is filtered to the ~1,073 languages that carry a
 * vetted, renderable endonym distinct from the English name), the channel is
 * the FULL catalog — every language is a row, because the channel functions
 * as the site's living index. The display name is the vetted endonym when one
 * exists and the English name otherwise (honest fallback — never a wrong-
 * language or unvetted endonym, per the 2026-06 endonym-authenticity rule).
 *
 * Each row also carries a speaker count: the conveyor prints it beneath the
 * name, and the runtime weights the rotation by log10(speakers) so major
 * languages surface often enough that a visitor reads the rail as "languages."
 *
 * Entry shape (compact keys; ~7.9k rows, ~140 KB gz):
 *   { c: code, e: endonym|null, n: English name, s: speakers|0,
 *     sd: speaker display string|null, v: vitality tier, d: text dir }
 *
 * Runs after generateLanguagesJson and reads its output (so `extends`
 * inheritance is resolved). Skipped when channel.json is newer than
 * languages.json (the 13-locale build re-runs loadContent per locale).
 *
 * Reuses the wall generator's endonym helpers (pickEndonym / isRenderable)
 * and authenticity gate so the two surfaces agree on what an endonym is.
 */

const fs = require('fs-extra');
const {pickEndonym, isRenderable} = require('./generateWallJson');

// Channel shows the WHOLE catalog, so its vitality map is broader than the
// wall's (which only keeps living tiers). Tints the row glow; never gates.
const TIER_MAP = {
  safe: 'safe',
  vulnerable: 'vulnerable',
  'definitely-endangered': 'endangered',
  'severely-endangered': 'endangered',
  'critically-endangered': 'endangered',
  extinct: 'extinct',
  awakening: 'endangered',
  dormant: 'extinct',
};

/**
 * Derive a representative numeric speaker count from a card.
 * Prefers the max of the structured speakerEstimates[].count (clean ints);
 * falls back to vitality.speakerCount only when it is itself numeric
 * (it is often a prose string like "~490M L1" — not usable for weighting).
 * Returns 0 when no numeric estimate exists.
 */
function speakerCount(card) {
  let max = 0;
  const ests = Array.isArray(card.speakerEstimates) ? card.speakerEstimates : [];
  for (const e of ests) {
    const n = typeof e.count === 'number' ? e.count : NaN;
    if (Number.isFinite(n) && n > max) max = n;
  }
  if (max === 0) {
    const vc = card.vitality && card.vitality.speakerCount;
    if (typeof vc === 'number' && Number.isFinite(vc)) max = vc;
  }
  return max;
}

/** Compact human display: 1_500_000_000 → "1.5B", 20_000 → "20K". */
function speakerDisplay(n) {
  if (!n || n < 1) return null;
  if (n >= 1e9) return `${+(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${+(n / 1e3).toFixed(1)}K`;
  return String(n);
}

/**
 * @param {object} opts
 * @param {string} opts.languagesFile — path to the resolved languages.json
 * @param {string} opts.outFile — path to write channel.json
 */
async function generateChannelJson({languagesFile, outFile}) {
  if (await fs.pathExists(outFile)) {
    const [outStat, inStat] = await Promise.all([
      fs.stat(outFile),
      fs.stat(languagesFile),
    ]);
    if (outStat.mtimeMs >= inStat.mtimeMs) return;
  }

  const cards = await fs.readJson(languagesFile);
  const rows = [];
  let withEndonym = 0;

  for (const card of cards) {
    if (!card.code || !card.name) continue;

    // Endonym only when vetted AND renderable — else the row shows the
    // English name (honest). Same gate as the wall.
    let endonym = null;
    const vetted =
      card.nativeNameVerdict === 'verified' || card.nativeNameVerdict === 'plausible';
    if (vetted && card.nativeName) {
      const cand = pickEndonym(card.nativeName);
      if (isRenderable(cand, card.name)) {
        endonym = cand;
        withEndonym++;
      }
    }

    const s = speakerCount(card);
    rows.push({
      c: card.code,
      e: endonym,
      n: card.name,
      s,
      sd: speakerDisplay(s),
      v: TIER_MAP[card.vitality && card.vitality.unescoStatus] || 'unknown',
      d: card.dir === 'rtl' ? 'rtl' : 'ltr',
    });
  }

  // Stable, deterministic order: most-spoken first. The runtime builds its
  // own weighted rotation; emitting sorted keeps the diff stable build-to-
  // build and lets the conveyor seed from the head for the major-language bias.
  rows.sort((a, b) => b.s - a.s || a.n.localeCompare(b.n));

  await fs.writeJson(outFile, {
    generated: new Date().toISOString().slice(0, 10),
    count: rows.length,
    withEndonym,
    items: rows,
  });
  console.log(
    `[shared-data] Wrote ${rows.length} channel rows to ${outFile} ` +
    `(${withEndonym} with a vetted endonym; rest show the English name)`,
  );
}

module.exports = {generateChannelJson};
