/**
 * commercial-eligibility.js — the ONE answer to "may this method be routed to
 * in a COMMERCIAL lane?", enforced at routing time.
 *
 * WHY THIS EXISTS. `commercialReady` was declared in three places that had
 * already drifted: the cross-runtime SSOT (`shared/method-registry.json`),
 * a hardcoded table in `lib/provenance.js`, and each method loader's own
 * `getProvenance()`. LibreTranslate was `AGPL-3.0` + `commercialReady: true`
 * in two of them and `false` in the SSOT — i.e. the AGPL boundary CLAUDE.md
 * calls a never-cross rule was crossable by reading the wrong table. This
 * module makes the SSOT win everywhere and makes the answer enforceable
 * instead of advisory.
 *
 * THE RULES, in precedence order:
 *
 *   1. **The shared registry wins.** If `shared/method-registry.json` has an
 *      entry for the method (by canonical key OR `cli_name`), its
 *      `commercialReady` is the answer. Nothing overrides it upward — a
 *      plugin cannot declare itself commercial-ready past an SSOT `false`.
 *   2. **A plugin may only ever restrict.** `pluginProvenance.commercialReady
 *      === false` blocks even when the registry says true (a coached plugin
 *      can carry NC coaching data the engine knows nothing about).
 *   3. **Methods the registry deliberately does not model** — CLI-only
 *      pseudo-methods with no cross-runtime adapter — are declared in
 *      CLI_ONLY below, each with its reason.
 *   4. **Unknown is INELIGIBLE.** No registry entry, no declaration, no
 *      plugin provenance → not routable commercially. Fail-safe, matching
 *      `license-gate.mjs`'s doctrine for sources ("an unknown / unstated /
 *      mixed source is treated as RESTRICTED").
 *
 * SCOPE. This gates the COMMERCIAL lane only. Champollion's default lane is
 * non-commercial, where NC and copyleft engines are perfectly usable — that
 * is the open project, and nothing here restricts it. Same orthogonality
 * `license-gate.mjs` already applies to corpora: use context is a descriptor,
 * not a single bucket.
 *
 * @module commercial-eligibility
 */

import { manifestEntries, cliNameFor } from './method-manifest.js';
import { USE_CONTEXTS } from './license-gate.mjs';

/**
 * Methods with no entry in the shared registry, because they are CLI-only
 * constructs rather than engines with a cross-runtime adapter.
 *
 * Every entry states WHY. An engine that belongs in the registry must go in
 * the registry — this table is not a bypass for it.
 */
const CLI_ONLY = {
  // Plain LLM translation through the user's own provider key. The engine
  // itself carries no external data dependency; the provider's ToS governs,
  // and every LLM provider in the registry is commercialReady.
  'llm-coached': {
    eligible: true,
    license: 'Provider ToS (per LLM provider)',
    reason: 'the method carries no data dependency of its own — its COACHING '
      + 'data does, and that rides pluginProvenance (rule 2), which can only '
      + 'restrict',
  },

  // Human-in-the-loop review. No external resource at all.
  'human-review': {
    eligible: true,
    license: 'n/a',
    reason: 'no external resource — human review of output already produced',
  },

  // Points at a remote champollion-serve endpoint. Whatever is BEHIND it is
  // declared by the plugin manifest, so with no declaration there is nothing
  // to stand on.
  api: {
    eligible: false,
    license: 'unknown (declared by the plugin manifest)',
    reason: 'a remote endpoint\'s provenance is only knowable from its plugin '
      + 'manifest — supply one declaring commercialReady, or route it in the '
      + 'non-commercial lane',
  },

  // Arbitrary user-supplied Python method directory.
  external: {
    eligible: false,
    license: 'unknown (user-supplied plugin)',
    reason: 'a user-supplied plugin\'s dependencies are unknown to us',
  },

  // The Plains Cree FST pipeline: AGPL FST invoked as a separate tool, plus
  // the Wolvengrey dictionary, which is index-only and permanently
  // non-redistributable (founder ruling 2026-07-19).
  'fst-gated': {
    eligible: false,
    license: 'AGPL-3.0-or-later + PROPRIETARY dictionary',
    reason: 'depends on an AGPL FST and a proprietary dictionary under a '
      + 'pending agreement',
  },
};

/**
 * Look the method up in the shared registry by canonical key or CLI alias.
 *
 * @param {string} methodName
 * @returns {{ name: string, entry: object } | null} null when the registry is
 *   absent (standalone package with no bundled shared/) or the name is unknown
 */
function registryEntryFor(methodName) {
  for (const [name, entry] of Object.entries(manifestEntries())) {
    if (name === methodName || cliNameFor(name, entry) === methodName) {
      return { name, entry };
    }
  }
  return null;
}

/**
 * Resolve whether a method may be routed to commercially.
 *
 * Pure and offline — reads the bundled registry only. Never throws; callers
 * that want an exception use assertRoutable().
 *
 * @param {string} methodName - CLI method name or canonical registry key
 * @param {object} [opts]
 * @param {object|null} [opts.pluginProvenance] - The plugin manifest's own
 *   provenance declaration, when the pair config carries one. May only restrict.
 * @returns {{ eligible: boolean, source: string, license: string|null,
 *   reason: string }} `source` is where the verdict came from, so a report can
 *   cite it: 'registry' | 'cli-only' | 'plugin' | 'unknown'
 */
export function resolveCommercialEligibility(methodName, { pluginProvenance = null } = {}) {
  const pluginBlocks = !!pluginProvenance
    && typeof pluginProvenance === 'object'
    && pluginProvenance.commercialReady === false;

  const found = registryEntryFor(methodName);
  if (found) {
    const { name, entry } = found;
    const eligible = entry.commercialReady === true && !pluginBlocks;
    let reason;
    if (pluginBlocks) {
      reason = 'the installed plugin declares itself not commercial-ready';
    } else if (entry.commercialReady === true) {
      reason = `cleared in the shared method registry (${name})`;
    } else {
      reason = `not commercial-ready in the shared method registry (${name})`;
    }
    return {
      eligible,
      source: pluginBlocks ? 'plugin' : 'registry',
      license: entry.license || null,
      reason,
    };
  }

  const declared = CLI_ONLY[methodName];
  if (declared) {
    const eligible = declared.eligible && !pluginBlocks;
    return {
      eligible,
      source: pluginBlocks ? 'plugin' : 'cli-only',
      license: declared.license,
      reason: pluginBlocks
        ? 'the installed plugin declares itself not commercial-ready'
        : declared.reason,
    };
  }

  // Rule 4. A plugin declaring itself ready is NOT enough to clear an
  // otherwise-unknown method — that would let any manifest self-certify.
  return {
    eligible: false,
    source: 'unknown',
    license: null,
    reason: `"${methodName}" has no recorded commercial eligibility — unknown `
      + 'methods are treated as restricted',
  };
}

/**
 * Error thrown when a commercial route is refused. Carries the structured
 * verdict so an API layer can render it without re-deriving anything.
 */
export class CommercialRouteBlockedError extends Error {
  /**
   * @param {string} methodName
   * @param {{eligible:boolean, source:string, license:string|null, reason:string}} verdict
   */
  constructor(methodName, verdict) {
    super(
      `Method "${methodName}" is not cleared for the commercial lane: `
      + `${verdict.reason}`
      + (verdict.license ? ` (license: ${verdict.license})` : '')
      + '. Route it in the non-commercial lane, or use a method whose license '
      + 'permits commercial use (`champollion recommend <src> <tgt> '
      + '--use commercial` lists them).'
    );
    this.name = 'CommercialRouteBlockedError';
    this.methodName = methodName;
    this.verdict = verdict;
  }
}

/**
 * Enforcement point. Throws when the lane is commercial and the method is not
 * cleared; returns the verdict otherwise.
 *
 * The non-commercial lane is the default and is never blocked here — NC and
 * copyleft engines are legitimate there, which is the whole point of the open
 * project.
 *
 * @param {string} methodName
 * @param {object} [opts]
 * @param {('commercial'|'non-commercial')} [opts.useContext='non-commercial']
 * @param {object|null} [opts.pluginProvenance]
 * @returns {{eligible:boolean, source:string, license:string|null, reason:string}}
 * @throws {CommercialRouteBlockedError}
 */
export function assertRoutable(methodName, { useContext = USE_CONTEXTS.NON_COMMERCIAL, pluginProvenance = null } = {}) {
  const verdict = resolveCommercialEligibility(methodName, { pluginProvenance });
  if (useContext === USE_CONTEXTS.COMMERCIAL && !verdict.eligible) {
    throw new CommercialRouteBlockedError(methodName, verdict);
  }
  return verdict;
}

/**
 * Convenience boolean for report surfaces that only need the answer.
 *
 * @param {string} methodName
 * @param {object} [opts]
 * @returns {boolean}
 */
export function isCommercialEligible(methodName, opts = {}) {
  return resolveCommercialEligibility(methodName, opts).eligible;
}

export { CLI_ONLY as CLI_ONLY_ELIGIBILITY };
