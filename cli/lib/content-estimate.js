/**
 * content-estimate.js — what a content file will actually BILL.
 *
 * The cost gate (--max-cost) must price what the run will pay for, not the
 * whole file: front-matter fields and body blocks the Translation Memory
 * already holds are served at $0 by the sync. Pricing whole files made a
 * $100 cap refuse runs whose real cost was ~$30, and operators raised the
 * cap past the honest number to get work done (dogfood 2026-08-28, finding
 * 1) — the guardrail stopped guarding.
 *
 * This walks the SAME ladder both content lanes run at sync time:
 *   1. each front-matter field, cached on its own source text;
 *   2. the whole body (a revert or lock-loss re-run is free);
 *   3. in 'block' segmentation, each translatable block.
 * One implementation for the Hugo and Docusaurus estimators, so the two can
 * no longer disagree about what is billable.
 *
 * Pure lookups (lookupTM, never the evicting lookupTMValidated): an
 * estimate must not change the cache it is estimating against.
 */

import { lookupTM } from './tm.js';
import { splitBlocks } from './segment.js';
import { protectBlocks, restoreBlocks } from './content.js';

/**
 * Restored source texts of a body's translatable blocks — the exact unit
 * block-mode sync caches and bills.
 *
 * @param {string} body - Markdown body (front matter stripped)
 * @returns {string[]}
 */
export function translatableBlockSources(body) {
  const { protectedBody, blocks } = protectBlocks(body);
  return splitBlocks(protectedBody)
    .filter(seg => seg.type === 'translatable')
    .map(seg => restoreBlocks(seg.text, blocks));
}

/**
 * Billable vs total source characters for one (file × locale) work item.
 *
 * @param {object} args
 * @param {object} args.tm - Loaded TM (carry-over settings apply)
 * @param {string} args.code - Target locale
 * @param {string} args.tmKey - tmMethodKey(pairConfig)
 * @param {string|null} [args.fallbackTmKey] - tmMethodKey(pairConfig.fallback)
 *   when the pair has a fallback: the sync serves the fallback's cached text
 *   before asking the primary (lib/fallback.js), so it is free here too
 * @param {Record<string, string>} args.fields - Front-matter fields to translate
 * @param {string} args.body - Markdown body
 * @param {'block'|'page'} args.segMode - Content segmentation mode
 * @param {() => string[]} args.blockSources - Lazily computed block sources
 *   (callers cache per source file: segmentation is locale-independent)
 * @param {ReturnType<import('./content-refusals.js').contentHolds>|null} [args.holds] -
 *   What the quality gate refused before (lib/content-refusals.js): a block
 *   or field the pair's method refused is not sent to it (held, or the
 *   fallback's — which this estimate does not price); a held page body in
 *   'page' segmentation holds its whole page, so nothing of it is billed. A
 *   held front-matter field keeps its source text and the rest of the page
 *   is still sent (since 2026-10-05)
 * @returns {{ billedChars: number, totalChars: number }}
 */
export function billableContentChars({ tm, code, tmKey, fallbackTmKey = null, fields, body, segMode, blockSources, holds = null }) {
  let billedChars = 0;
  let totalChars = 0;
  let pageHeld = false;
  const cached = (text) => lookupTM(tm, text, code, tmKey) !== null
    || (fallbackTmKey !== null && lookupTM(tm, text, code, fallbackTmKey) !== null);

  for (const [field, text] of Object.entries(fields)) {
    totalChars += text.length;
    if (cached(text)) continue;
    const hold = holds ? holds.field(field, text) : 'send';
    if (hold === 'send') billedChars += text.length;
  }

  if (body.trim()) {
    totalChars += body.length;
    if (!cached(body)) {
      if (segMode === 'page') {
        // A page translated whole and refused before: held (its page is
        // not processed — nothing of it is billed), or the fallback's.
        const hold = holds ? holds.page(body) : 'send';
        if (hold === 'held') pageHeld = true;
        else if (hold === 'send') billedChars += body.length;
      } else {
        for (const source of blockSources()) {
          if (!cached(source) && (!holds || holds.block(source) === 'send')) billedChars += source.length;
        }
      }
    }
  }

  return { billedChars: pageHeld ? 0 : billedChars, totalChars };
}
