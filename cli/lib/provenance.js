/**
 * Provenance & Licensing Registry — tracks resource dependencies per method.
 *
 * WHY: When champollion is used commercially, users need to know if
 * their translation pipeline depends on proprietary datasets or tools.
 * This registry makes those dependencies explicit and flaggable.
 *
 * Each translation method declares its resource dependencies:
 *   - name:    Human-readable resource name
 *   - license: SPDX license identifier or "PROPRIETARY"
 *   - owner:   Organization/person that owns the resource
 *   - status:  "clear" (licensed/open), "pending-agreement", or "restricted"
 *   - url:     Link to resource or license info (optional)
 *
 * The CLI surfaces provenance warnings when a pair uses a method with
 * non-commercial resources: "[WARN] This pair uses PROPRIETARY resources"
 *
 * This module REPORTS. Enforcement — refusing to route a non-eligible method
 * in a commercial lane — lives in lib/commercial-eligibility.js, which is
 * also where the `commercialReady` verdict is resolved from the shared
 * registry SSOT. Keep the two consistent by never re-declaring the verdict
 * here; see getProvenance().
 */

/**
 * Registry of resource dependencies per translation method.
 *
 * Methods not listed here are assumed to have no external dependencies
 * (i.e., they only use the LLM API, which is covered by the user's
 * own API key and ToS).
 */
import { resolveCommercialEligibility } from './commercial-eligibility.js';

const METHOD_PROVENANCE = {
  llm: {
    resources: [],
    flags: [],
  },

  'llm-coached': {
    resources: [],
    flags: [],
  },

  'google-translate': {
    resources: [
      {
        name: 'Google Cloud Translation API',
        license: 'Google Cloud ToS',
        owner: 'Google',
        status: 'clear',
        url: 'https://cloud.google.com/translate/docs',
      },
    ],
    flags: [],
  },

  api: {
    resources: [
      {
        name: 'Remote Translation API',
        license: 'Provider ToS',
        owner: 'API provider',
        status: 'clear',
        url: '',
      },
    ],
    flags: [],
  },

  deepl: {
    resources: [
      {
        name: 'DeepL Translation API',
        license: 'Proprietary (DeepL ToS)',
        owner: 'DeepL SE',
        status: 'clear',
        url: 'https://www.deepl.com/pro-api',
      },
    ],
    flags: [],
  },

  'microsoft-translator': {
    resources: [
      {
        name: 'Microsoft Translator Text API',
        license: 'Microsoft Services Agreement',
        owner: 'Microsoft',
        status: 'clear',
        url: 'https://azure.microsoft.com/services/cognitive-services/translator/',
      },
    ],
    flags: [],
  },

  libretranslate: {
    resources: [
      {
        name: 'LibreTranslate API',
        license: 'AGPL-3.0',
        owner: 'LibreTranslate',
        status: 'clear',
        url: 'https://libretranslate.com',
      },
    ],
    flags: ['COPYLEFT_AGPL'],
  },

  openai: {
    resources: [
      {
        name: 'OpenAI Developer API',
        license: 'Proprietary (OpenAI ToS)',
        owner: 'OpenAI',
        status: 'clear',
        url: 'https://openai.com/api',
      },
    ],
    flags: [],
  },

  anthropic: {
    resources: [
      {
        name: 'Anthropic Messages API',
        license: 'Proprietary (Anthropic ToS)',
        owner: 'Anthropic',
        status: 'clear',
        url: 'https://www.anthropic.com/api',
      },
    ],
    flags: [],
  },

  gemini: {
    resources: [
      {
        name: 'Google Gemini API',
        license: 'Proprietary (Google ToS)',
        owner: 'Google',
        status: 'clear',
        url: 'https://ai.google.dev',
      },
    ],
    flags: [],
  },

  'fst-gated': {
    resources: [
      {
        name: 'Plains Cree FST (GiellaLT)',
        // Upstream LICENSE: AGPL v3 (or-later) with a §7(b) attribution rider
        // — matches shared/licenses.json giellalt-lang-crk. Invoked as a
        // separate tool, never bundled (CLAUDE.md AGPL boundary).
        license: 'AGPL-3.0-or-later',
        owner: 'ALTLab / GiellaLT',
        status: 'clear',
        url: 'https://github.com/giellalt/lang-crk',
      },
      {
        name: 'Wolvengrey Cree Dictionary (nêhiyawêwin: itwêwina / Cree: Words)',
        license: 'PROPRIETARY',
        // Rights-holder is Arok Wolvengrey (First Nations University of
        // Canada; published by University of Regina Press) — NOT UAlberta.
        // ALTLab's itwêwina serves the content for runtime lookups only.
        owner: 'Arok Wolvengrey (First Nations University of Canada); served via ALTLab’s itwêwina',
        status: 'pending-agreement',
        url: 'https://itwewina.altlab.app/',
      },
    ],
    flags: ['PROPRIETARY_DATASET'],
  },

  'human-review': {
    resources: [],
    flags: ['REQUIRES_HUMAN'],
  },
};

/**
 * Get provenance info for a translation method.
 *
 * `resources` and `flags` are curated here; **`commercialReady` is derived**
 * from lib/commercial-eligibility.js, which reads the shared method registry
 * SSOT. It is deliberately NOT stored in the table above: it used to be, the
 * two copies drifted, and LibreTranslate ended up declared commercial-ready
 * here while the SSOT (correctly, it is AGPL) said otherwise.
 *
 * Note the default for an unrecorded method is now `false`, not `true` — a
 * licence boundary has to fail safe. This only affects the COMMERCIAL lane;
 * the default non-commercial lane is never gated.
 *
 * @param {string} methodName - Method name (e.g., "llm", "fst-gated")
 * @returns {{resources: Array, commercialReady: boolean, flags: string[],
 *   eligibility: object}} `eligibility` carries the structured verdict
 *   (source, license, reason) so reports can cite where the answer came from
 */
function getProvenance(methodName) {
  const base = METHOD_PROVENANCE[methodName] || { resources: [], flags: [] };
  const eligibility = resolveCommercialEligibility(methodName);
  return {
    resources: base.resources,
    flags: base.flags,
    commercialReady: eligibility.eligible,
    eligibility,
  };
}

/**
 * Check if a method is cleared for commercial use.
 *
 * @param {string} methodName - Method name
 * @returns {boolean}
 */
function isCommercialReady(methodName) {
  const prov = getProvenance(methodName);
  return prov.commercialReady;
}

/**
 * Get all provenance flags for a set of pairs.
 * Aggregates flags across all methods used in the pair graph.
 *
 * Checks TWO sources per pair:
 *   1. The static METHOD_PROVENANCE registry (by method name)
 *   2. The plugin's own provenance declaration (pairConfig.pluginProvenance)
 * Either source can flag a pair as non-commercial.
 *
 * @param {Map<string, object>} pairs - Pair graph from pairs.js
 * @returns {{ flags: string[], blockedPairs: string[], allClear: boolean }}
 */
function auditProvenance(pairs) {
  const allFlags = new Set();
  const blockedPairs = [];

  for (const [pairKey, pairConfig] of pairs) {
    let isBlocked = false;

    // Check 1: static METHOD_PROVENANCE registry by method name
    const methodProv = getProvenance(pairConfig.method);
    for (const flag of methodProv.flags) {
      allFlags.add(flag);
    }
    if (!methodProv.commercialReady) {
      isBlocked = true;
    }

    // Check 2: plugin's own provenance declaration (from manifest)
    // A plugin can carry licensing info that the static registry doesn't
    // know about — e.g., a coached plugin using proprietary coaching data.
    const pluginProv = pairConfig.pluginProvenance;
    if (pluginProv && typeof pluginProv === 'object') {
      if (Array.isArray(pluginProv.flags)) {
        for (const flag of pluginProv.flags) {
          allFlags.add(flag);
        }
      }
      if (pluginProv.commercialReady === false) {
        isBlocked = true;
      }
    }

    if (isBlocked) {
      blockedPairs.push(pairKey);
    }
  }

  return {
    flags: [...allFlags],
    blockedPairs,
    allClear: blockedPairs.length === 0,
  };
}

/**
 * Format a provenance report for CLI output.
 *
 * @param {Map<string, object>} pairs - Pair graph
 * @returns {string} Formatted report
 */
function formatProvenanceReport(pairs) {
  const audit = auditProvenance(pairs);
  const lines = [];

  if (audit.allClear) {
    lines.push('[OK] All translation pairs are cleared for commercial use.\n');
    return lines.join('\n');
  }

  lines.push('[WARN] PROVENANCE WARNINGS\n');

  for (const pairKey of audit.blockedPairs) {
    const pairConfig = pairs.get(pairKey);
    const prov = getProvenance(pairConfig.method);

    lines.push(`  ${pairKey} (method: ${pairConfig.method})`);
    for (const resource of prov.resources) {
      const statusIcon = resource.status === 'clear' ? '[OK]' : '[RESTRICTED]';
      lines.push(`    ${statusIcon} ${resource.name} — ${resource.license} (${resource.status})`);
      if (resource.url) {
        lines.push(`       ${resource.url}`);
      }
    }
    lines.push('');
  }

  if (audit.flags.includes('PROPRIETARY_DATASET')) {
    lines.push('  [WARN] One or more pairs depend on PROPRIETARY datasets.');
    lines.push('     Commercial use requires licensing agreements with the resource owners.');
    lines.push('');
  }

  return lines.join('\n');
}

export {
  METHOD_PROVENANCE,
  getProvenance,
  isCommercialReady,
  auditProvenance,
  formatProvenanceReport,
};
