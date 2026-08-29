/**
 * glossify — wrap glossary terms found in card prose with tooltip marks.
 *
 * buildGlossaryMatcher(glossary) compiles the term + `also` vocabulary into a
 * single case-insensitive, word-boundary regex (longest variant first, so
 * "polysynthetic language" wins over "polysynthetic"). The matcher is cached
 * per glossary object, so calling it on every render is cheap.
 *
 * glossifyText(text, matcher) tokenizes a text block and returns an array of
 * React nodes where each matched term is wrapped in <GlossaryMark> (dotted
 * underline + hover/focus tooltip + "More →" link to /glossary#term-slug).
 *
 * Noise control: at most MAX_MARKS_PER_BLOCK marks per text block, and each
 * canonical term is marked at most once per block.
 *
 * Applied deliberately to only the highest-value card text surfaces
 * (linguistic challenges + typology explanations) — not the whole site.
 */

import React from 'react';
import GlossaryMark from '../components/GlossaryMark';

const MAX_MARKS_PER_BLOCK = 10;

/** Escape a vocabulary variant for safe inclusion in a RegExp alternation. */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Matcher cache — one compiled matcher per glossary dataset object.
const _matcherCache = new WeakMap();

/**
 * Compile the glossary into a reusable matcher.
 *
 * @param {{terms: Array}|null} glossary — result of loadGlossary()
 * @returns {{regex: RegExp, byVariant: Map<string, object>}|null}
 */
export function buildGlossaryMatcher(glossary) {
  if (!glossary || !Array.isArray(glossary.terms) || glossary.terms.length === 0) {
    return null;
  }
  if (_matcherCache.has(glossary)) return _matcherCache.get(glossary);

  // variant (lowercased) → canonical glossary entry
  const byVariant = new Map();
  for (const entry of glossary.terms) {
    const variants = [entry.term, ...(entry.also || [])];
    for (const v of variants) {
      if (!v) continue;
      const key = v.toLowerCase();
      // First writer wins — keeps canonical terms ahead of overlapping `also`
      // variants from later entries.
      if (!byVariant.has(key)) byVariant.set(key, entry);
    }
  }

  // Longest-first alternation so multiword variants beat their substrings.
  const alternation = [...byVariant.keys()]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|');

  const matcher = {
    // Word boundaries keep "tone" from matching inside "stones".
    regex: new RegExp(`\\b(${alternation})\\b`, 'gi'),
    byVariant,
  };
  _matcherCache.set(glossary, matcher);
  return matcher;
}

/**
 * Wrap glossary terms in a text block with <GlossaryMark> tooltips.
 *
 * @param {string} text — plain prose from a card field
 * @param {{regex: RegExp, byVariant: Map}|null} matcher — from buildGlossaryMatcher()
 * @returns {React.ReactNode} the original string when nothing matches,
 *          otherwise an array of strings and <GlossaryMark> elements.
 */
export function glossifyText(text, matcher) {
  if (!matcher || typeof text !== 'string' || text.length === 0) return text;

  const nodes = [];
  const seenTerms = new Set();
  let marks = 0;
  let lastIndex = 0;
  let match;

  matcher.regex.lastIndex = 0;
  while (marks < MAX_MARKS_PER_BLOCK && (match = matcher.regex.exec(text)) !== null) {
    const entry = matcher.byVariant.get(match[0].toLowerCase());
    if (!entry || seenTerms.has(entry.term)) continue; // one mark per term

    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    nodes.push(
      <GlossaryMark key={`${entry.term}-${match.index}`} entry={entry}>
        {match[0]}
      </GlossaryMark>
    );
    seenTerms.add(entry.term);
    marks += 1;
    lastIndex = match.index + match[0].length;
  }

  if (marks === 0) return text;
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}
