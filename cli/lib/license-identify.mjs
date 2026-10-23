/**
 * license-identify.mjs — turn a raw upstream licence string into an SPDX id,
 * or REFUSE.
 *
 * WHY THIS EXISTS
 *   It replaces `toSpdx()` in cli/scripts/populate-licenses.mjs, which wrote
 *   212 of the register's 333 entries. That function was an ordered chain of
 *   `String.includes()` tests, and it failed in three ways at once:
 *
 *   1. VERSION FABRICATION. `if (s.includes('by-nc')) return 'CC-BY-NC-4.0'`
 *      stamps 4.0 on every BY-NC licence of any version. `nts` and
 *      `uclaphoneticslabarchive` are licensed BY-NC-2.0 and were recorded as
 *      4.0 — with the correct URL sitting in the adjacent license_url column.
 *
 *   2. CLAUSE LOSS. There was no `-nd` branch anywhere. A ND licence hit the
 *      `by-nc` or `by` test first and came out as CC-BY-NC-4.0 or CC-BY-4.0.
 *      Zenodo says `nts` is cc-by-nc-**nd**-2.0; the register says
 *      CC-BY-NC-4.0 with allows_redistribution = 1. NoDerivatives vanished
 *      because nothing looked for it.
 *
 *   3. RAW PASSTHROUGH. `return raw` shipped unparsed strings as SPDX ids —
 *      which is how `hayniecolorterms` carries the literal `"CC"`.
 *
 *   The fix is not a longer chain of guesses. It is a parser that reads the
 *   version and the clauses out of the string, and returns null when it cannot
 *   read them with certainty. A null becomes UNVERIFIED, which quarantines the
 *   claim (founder ruling 2026-08-01) rather than inventing a permissive one.
 *
 * THE RULE: never emit an SPDX id containing information the input did not
 * contain. If the input has no version, the output has no version — and an
 * unversioned CC licence is not identifiable, so it is refused.
 *
 * @see cli/scripts/harvest-zenodo-cldf.mjs  (authoritative licence evidence)
 * @see docs/LICENSING.md
 */

/** Canonical SPDX clause order for Creative Commons: BY, NC, ND, SA. */
const CC_CLAUSE_ORDER = ['by', 'nc', 'nd', 'sa'];

/** CC versions that actually exist as SPDX identifiers. */
const CC_VERSIONS = new Set(['1.0', '2.0', '2.5', '3.0', '4.0']);

/**
 * Non-CC licences we accept, keyed by the exact lowercased token. Explicit,
 * because "contains 'mit'" matches "transmitted", "limits" and "submitted" —
 * substring matching on short identifiers is how the old function justified
 * itself and how it went wrong.
 */
const EXACT_IDS = new Map(Object.entries({
  'mit': 'MIT',
  'apache-2.0': 'Apache-2.0',
  'apache 2.0': 'Apache-2.0',
  'apache2.0': 'Apache-2.0',
  'apache license 2.0': 'Apache-2.0',
  'gpl-3.0': 'GPL-3.0-only',
  'gpl-3.0-only': 'GPL-3.0-only',
  'gpl-3.0-or-later': 'GPL-3.0-or-later',
  'gpl-3': 'GPL-3.0-only',
  'gpl3': 'GPL-3.0-only',
  'agpl-3.0': 'AGPL-3.0-only',
  'agpl-3.0-only': 'AGPL-3.0-only',
  'agpl-3.0-or-later': 'AGPL-3.0-or-later',
  'lgpl-3.0': 'LGPL-3.0-only',
  'bsd-3-clause': 'BSD-3-Clause',
  'bsd-2-clause': 'BSD-2-Clause',
  'cc0-1.0': 'CC0-1.0',
  'cc0': 'CC0-1.0',
  'unicode-3.0': 'Unicode-3.0',
}));

/** URL forms that identify a licence exactly. */
const EXACT_URLS = [
  [/^https?:\/\/(www\.)?apache\.org\/licenses\/LICENSE-2\.0/i, 'Apache-2.0'],
  [/^https?:\/\/(www\.)?opensource\.org\/licenses\/MIT\b/i, 'MIT'],
  [/^https?:\/\/(www\.)?opensource\.org\/licenses\/GPL-3\.0\b/i, 'GPL-3.0-only'],
  [/^https?:\/\/(www\.)?gnu\.org\/licenses\/gpl-3\.0/i, 'GPL-3.0-only'],
  [/^https?:\/\/(www\.)?gnu\.org\/licenses\/agpl-3\.0/i, 'AGPL-3.0-only'],
  [/creativecommons\.org\/publicdomain\/zero\/1\.0/i, 'CC0-1.0'],
];

/**
 * Identify a licence string.
 *
 * @param {unknown} raw  the upstream string (dc:license, a LICENSE header, …)
 * @returns {{spdx: string|null, reason: string, raw: string|null}}
 *   `spdx` is null whenever the string cannot be identified exactly; `reason`
 *   always explains the outcome so a reviewer can see WHY something is
 *   UNVERIFIED without re-deriving it.
 */
export function identifyLicense(raw) {
  if (raw == null || raw === '') {
    return { spdx: null, reason: 'no licence string present', raw: null };
  }

  // CLDF metadata sometimes carries an object: {url, name, icon}.
  if (typeof raw === 'object') {
    const url = raw.url || raw.href || null;
    if (!url) {
      return { spdx: null, reason: 'licence object with no url', raw: JSON.stringify(raw) };
    }
    const inner = identifyLicense(url);
    return { ...inner, raw: JSON.stringify(raw) };
  }

  const text = String(raw).trim();
  const s = text.toLowerCase();

  for (const [re, spdx] of EXACT_URLS) {
    if (re.test(text)) return { spdx, reason: 'exact URL match', raw: text };
  }

  // Creative Commons DEED TITLE, as it appears at the top of a LICENSE file
  // shipped by the dataset itself: "Attribution-ShareAlike 4.0 International".
  // This is an exact form, not a resemblance — the clause words and the version
  // are both read from the title. It is how cli/data/segbo/LICENSE.txt resolves,
  // the file whose existence the register denies ("No LICENSE file found in
  // GitHub repo") while it sits in the tree.
  const deed = /\b(Attribution(?:-(?:NonCommercial|ShareAlike|NoDerivatives|NoDerivs))*)\s+(\d(?:\.\d)?)\s+International/i.exec(text);
  if (deed) {
    const words = deed[1].toLowerCase().split('-');
    const map = {
      attribution: 'by', noncommercial: 'nc',
      sharealike: 'sa', noderivatives: 'nd', noderivs: 'nd',
    };
    const clauses = words.map((w) => map[w]).filter(Boolean);
    let version = deed[2];
    if (!version.includes('.')) version = `${version}.0`;
    if (clauses.length === words.length && CC_VERSIONS.has(version)) {
      const ordered = CC_CLAUSE_ORDER.filter((c) => clauses.includes(c));
      return {
        spdx: `CC-${ordered.map((c) => c.toUpperCase()).join('-')}-${version}`,
        reason: 'exact Creative Commons deed title',
        raw: text.slice(0, 120),
      };
    }
  }
  if (/^\s*CC0\s+1\.0\s+Universal/im.test(text)) {
    return { spdx: 'CC0-1.0', reason: 'exact CC0 deed title', raw: text.slice(0, 120) };
  }

  if (EXACT_IDS.has(s)) {
    return { spdx: EXACT_IDS.get(s), reason: 'exact identifier match', raw: text };
  }

  // Creative Commons: read the clauses AND the version out of the string.
  // Both a URL (creativecommons.org/licenses/by-nc-sa/3.0/) and a bare id
  // (cc-by-nc-sa-3.0) are handled by the same extraction, so neither can
  // produce a version the input did not state.
  const ccUrl = /creativecommons\.org\/licenses\/([a-z-]+)\/(\d(?:\.\d)?)/i.exec(text);
  const ccId = /^cc-((?:by|nc|nd|sa)(?:-(?:by|nc|nd|sa))*)-(\d(?:\.\d)?)$/i.exec(s);
  const m = ccUrl || ccId;
  if (m) {
    const clauses = m[1].toLowerCase().split('-').filter(Boolean);
    let version = m[2];
    if (!version.includes('.')) version = `${version}.0`;

    if (!CC_VERSIONS.has(version)) {
      return { spdx: null, reason: `CC version ${version} is not a known SPDX version`, raw: text };
    }
    const unknown = clauses.filter((c) => !CC_CLAUSE_ORDER.includes(c));
    if (unknown.length) {
      return { spdx: null, reason: `unrecognised CC clause(s): ${unknown.join(', ')}`, raw: text };
    }
    if (!clauses.includes('by')) {
      // CC licences without BY exist only in 1.0. Refuse rather than assume.
      return { spdx: null, reason: 'CC licence without a BY clause — needs review', raw: text };
    }
    const ordered = CC_CLAUSE_ORDER.filter((c) => clauses.includes(c));
    return {
      spdx: `CC-${ordered.map((c) => c.toUpperCase()).join('-')}-${version}`,
      reason: 'parsed CC clauses and version from the string',
      raw: text,
    };
  }

  // A CC licence we can see but cannot version. This is the `hayniecolorterms`
  // case: the metadata says only "CC". It grants nothing determinable, and the
  // old function shipped the raw string as an SPDX id.
  if (/\bcc\b|creativecommons/i.test(s)) {
    return {
      spdx: null,
      reason: 'Creative Commons licence with no identifiable version — grants nothing determinable',
      raw: text,
    };
  }

  return { spdx: null, reason: 'unrecognised licence string', raw: text };
}

/**
 * Derive obligation flags from an SPDX id.
 *
 * Structural, not heuristic: every flag reads a clause that is actually present
 * in the identifier. The old `licenseFlags()` set
 * `redistribution: !s.includes('PROPRIETARY')` — i.e. everything on earth was
 * redistributable unless the string happened to contain that one word. Nothing
 * upstream ever says "PROPRIETARY", so the flag was effectively a constant.
 *
 * `noDerivatives` is NEW. The register had no field for it, which is why ND
 * silently vanished from `nts`: there was nowhere to record it even if the
 * parser had seen it.
 *
 * @param {string|null} spdx
 * @returns {{redistribution: boolean|null, attribution: boolean, sharealike: boolean,
 *            nonCommercial: boolean, noDerivatives: boolean}}
 */
export function deriveFlags(spdx) {
  if (!spdx) {
    // UNVERIFIED grants nothing. `redistribution: null` is "unknown", which is
    // NOT the same as false and must not read as a permission either way.
    return {
      redistribution: null, attribution: false, sharealike: false,
      nonCommercial: false, noDerivatives: false,
    };
  }
  const s = spdx.toUpperCase();
  const nd = /-ND(-|$)/.test(s);
  return {
    // ND permits verbatim redistribution but forbids distributing derivatives.
    // For a project whose whole output is derived data, treating an ND source
    // as redistributable is the error we are removing, so this is false.
    redistribution: !nd,
    attribution: s.startsWith('CC-BY') || s.startsWith('APACHE')
      || s === 'MIT' || s.startsWith('BSD'),
    sharealike: /-SA(-|$)/.test(s) || s.includes('GPL'),
    nonCommercial: /-NC(-|$)/.test(s),
    noDerivatives: nd,
  };
}
