/**
 * vitality-map.mjs — the vitality badge, read from the card's OWN Glottolog
 * AES claim.
 *
 * WHY NOT the card's derived `vitality.unescoStatus`: that field is the
 * reader's 5-tier collapse (safe/vulnerable/endangered/extinct/unknown) of
 * whichever authority speaks FIRST in shared/catalogue/vitality-scales.json
 * — ELCat before Glottolog. The website's badge vocabulary
 * (cli/website/src/utils/vitalityScale.js) is the AES gradient itself —
 * thriving/shifting/endangered/critical/dormant — and every `desc` string
 * there says "Glottolog AES: …". Publishing an ELCat assessment, or a
 * 5-tier collapse that erases 'critical' (312 languages in prod) and merges
 * moribund into endangered, under a Glottolog-AES label would misattribute
 * the claim AND flatten the gradient the explorer renders. So the badge is
 * read from the glottolog-cldf claim inside the card's `endangerment`
 * envelope — the same AES authority the legacy facts row carried —
 * verbatim on Glottolog's own scale.
 *
 * THE f6b533965 INVARIANT: no AES evidence → level null, source 'unknown',
 * NEVER a default. Silence must not read as reassurance — the old
 * 'thriving' fallback stamped "Not endangered" on 987 unassessed languages
 * including Ancient Macedonian.
 */

import { attributions } from '../../../cli/lib/cards/reader.js';

/**
 * Glottolog's AES vocabulary → (badge word, AES integer). The words are
 * Glottolog's own (glottolog-cldf `endangerment` values); the badge words
 * and the 1–6 integers match the legacy AES_MAP and the website's
 * vitalityScale ids exactly.
 */
export const GLOTTOLOG_AES_TO_BADGE = Object.freeze({
  'not endangered': { level: 'thriving', aesValue: 1 },
  'threatened': { level: 'shifting', aesValue: 2 },
  'shifting': { level: 'shifting', aesValue: 3 },
  'moribund': { level: 'endangered', aesValue: 4 },
  'nearly extinct': { level: 'critical', aesValue: 5 },
  'extinct': { level: 'dormant', aesValue: 6 },
});

/** Every level the badge may carry (must stay ⊆ vitalityScale.js ids). */
export const BADGE_LEVELS = Object.freeze(
  [...new Set(Object.values(GLOTTOLOG_AES_TO_BADGE).map((v) => v.level))],
);

/**
 * The vitality badge for one card, from its raw (pre-normalize is fine —
 * normalizeCard never rewrites `endangerment`) card object.
 * Returns { level, source, aesValue }.
 */
export function vitalityBadgeFromCard(card) {
  const claims = attributions(card?.endangerment);
  const hit = claims.find((c) => String(c?.source ?? '').startsWith('glottolog-cldf'));
  if (hit) {
    const mapped = GLOTTOLOG_AES_TO_BADGE[String(hit.value).trim().toLowerCase()];
    if (mapped) {
      return { level: mapped.level, source: 'glottolog-aes', aesValue: mapped.aesValue };
    }
  }
  return { level: null, source: 'unknown', aesValue: null };
}
