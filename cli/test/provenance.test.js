/**
 * Provenance & licensing tests — validates the audit, reporting,
 * and commercial-readiness logic in provenance.js.
 *
 * WHY THESE EXIST:
 *   auditProvenance() decides whether a project is safe for commercial use
 *   by scanning all translation pairs for PROPRIETARY flags. This logic
 *   was completely untested — a false negative could expose a user to
 *   licensing violations they didn't know about.
 *
 * CATEGORIES:
 *   1. getProvenance — registry lookups for known and unknown methods
 *   2. isCommercialReady — per-method commercial safety check
 *   3. auditProvenance — full pair graph audit with flags and blocked pairs
 *   4. formatProvenanceReport — CLI output formatting
 *   5. Plugin provenance — pluginProvenance field merge
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  METHOD_PROVENANCE,
  getProvenance,
  isCommercialReady,
  auditProvenance,
  formatProvenanceReport,
} from '../lib/provenance.js';

// =================================================================
// 1. getProvenance — registry lookups
// =================================================================
describe('provenance: getProvenance', () => {
  it('returns correct provenance for "llm" (no external resources)', () => {
    const prov = getProvenance('llm');
    assert.equal(prov.commercialReady, true);
    assert.equal(prov.resources.length, 0);
    assert.equal(prov.flags.length, 0);
  });

  it('returns correct provenance for "google-translate"', () => {
    const prov = getProvenance('google-translate');
    assert.equal(prov.commercialReady, true);
    assert.equal(prov.resources.length, 1);
    assert.equal(prov.resources[0].name, 'Google Cloud Translation API');
    assert.equal(prov.resources[0].status, 'clear');
  });

  it('returns correct provenance for "fst-gated" (PROPRIETARY)', () => {
    const prov = getProvenance('fst-gated');
    assert.equal(prov.commercialReady, false);
    assert.ok(prov.flags.includes('PROPRIETARY_DATASET'));
    assert.equal(prov.resources.length, 2);
    // Wolvengrey dictionary is the restricted resource
    const restricted = prov.resources.find(r => r.status === 'pending-agreement');
    assert.ok(restricted, 'Should have a pending-agreement resource');
    assert.equal(restricted.license, 'PROPRIETARY');
  });

  it('returns correct provenance for "human-review"', () => {
    const prov = getProvenance('human-review');
    assert.equal(prov.commercialReady, true);
    assert.ok(prov.flags.includes('REQUIRES_HUMAN'));
  });

  it('fails SAFE for an unknown method — not commercially routable', () => {
    // Reversed 2026-08-12. This previously asserted `true` and called it the
    // "safe default": an unrecorded method was silently cleared for the
    // commercial lane. On a licence boundary the safe direction is refusal.
    const prov = getProvenance('totally-unknown-method');
    assert.equal(prov.commercialReady, false);
    assert.equal(prov.eligibility.source, 'unknown');
    assert.equal(prov.resources.length, 0);
    assert.equal(prov.flags.length, 0);
  });

  it('covers all registered methods', () => {
    const expectedMethods = [
      'llm', 'llm-coached', 'google-translate', 'api', 'deepl',
      'microsoft-translator', 'libretranslate', 'openai', 'anthropic',
      'gemini', 'fst-gated', 'human-review',
    ];
    for (const method of expectedMethods) {
      assert.ok(
        METHOD_PROVENANCE[method],
        `Expected METHOD_PROVENANCE to have entry for "${method}"`
      );
    }
  });
});

// =================================================================
// 2. isCommercialReady
// =================================================================
describe('provenance: isCommercialReady', () => {
  it('returns true for standard LLM methods', () => {
    assert.equal(isCommercialReady('llm'), true);
    assert.equal(isCommercialReady('llm-coached'), true);
    assert.equal(isCommercialReady('google-translate'), true);
    assert.equal(isCommercialReady('deepl'), true);
  });

  it('returns false for fst-gated (proprietary dataset)', () => {
    assert.equal(isCommercialReady('fst-gated'), false);
  });

  it('returns false for unknown methods (fail-safe)', () => {
    assert.equal(isCommercialReady('not-a-real-method'), false);
  });

  it('returns false for AGPL/GPL engines, per the shared registry', () => {
    // Derived from shared/method-registry.json, not re-declared here — the
    // drift between the two copies is what this whole gate exists to stop.
    assert.equal(isCommercialReady('libretranslate'), false); // AGPL-3.0
    assert.equal(isCommercialReady('apertium'), false);       // GPL-3.0+
  });
});

// =================================================================
// 3. auditProvenance — pair graph audit
// =================================================================
describe('provenance: auditProvenance', () => {
  it('reports allClear for a graph with only standard methods', () => {
    const pairs = new Map([
      ['en:fr', { method: 'llm', target: 'fr' }],
      ['en:de', { method: 'google-translate', target: 'de' }],
      ['en:ja', { method: 'deepl', target: 'ja' }],
    ]);
    const audit = auditProvenance(pairs);
    assert.equal(audit.allClear, true);
    assert.equal(audit.blockedPairs.length, 0);
    assert.equal(audit.flags.length, 0);
  });

  it('detects blocked pairs with fst-gated method', () => {
    const pairs = new Map([
      ['en:fr', { method: 'llm', target: 'fr' }],
      ['en:crk', { method: 'fst-gated', target: 'crk' }],
    ]);
    const audit = auditProvenance(pairs);
    assert.equal(audit.allClear, false);
    assert.deepEqual(audit.blockedPairs, ['en:crk']);
    assert.ok(audit.flags.includes('PROPRIETARY_DATASET'));
  });

  it('reports multiple blocked pairs', () => {
    const pairs = new Map([
      ['en:crk', { method: 'fst-gated', target: 'crk' }],
      ['fr:crk', { method: 'fst-gated', target: 'crk' }],
    ]);
    const audit = auditProvenance(pairs);
    assert.equal(audit.blockedPairs.length, 2);
  });

  it('handles empty pair graph', () => {
    const audit = auditProvenance(new Map());
    assert.equal(audit.allClear, true);
    assert.equal(audit.blockedPairs.length, 0);
  });

  it('merges plugin provenance flags', () => {
    // WHY: A plugin can carry its own provenance declaration
    // that the static METHOD_PROVENANCE registry doesn't know about
    const pairs = new Map([
      ['en:xx', {
        method: 'llm',
        target: 'xx',
        pluginProvenance: {
          commercialReady: false,
          flags: ['CUSTOM_DATASET_FLAG'],
        },
      }],
    ]);
    const audit = auditProvenance(pairs);
    assert.equal(audit.allClear, false);
    assert.deepEqual(audit.blockedPairs, ['en:xx']);
    assert.ok(audit.flags.includes('CUSTOM_DATASET_FLAG'));
  });

  it('ignores null/undefined pluginProvenance', () => {
    const pairs = new Map([
      ['en:fr', { method: 'llm', target: 'fr', pluginProvenance: null }],
      ['en:de', { method: 'llm', target: 'de', pluginProvenance: undefined }],
    ]);
    const audit = auditProvenance(pairs);
    assert.equal(audit.allClear, true);
  });

  it('deduplicates flags across multiple pairs', () => {
    const pairs = new Map([
      ['en:crk', { method: 'fst-gated', target: 'crk' }],
      ['fr:crk', { method: 'fst-gated', target: 'crk' }],
    ]);
    const audit = auditProvenance(pairs);
    // PROPRIETARY_DATASET should appear only once in flags
    const propCount = audit.flags.filter(f => f === 'PROPRIETARY_DATASET').length;
    assert.equal(propCount, 1, 'Flag should be deduplicated');
  });
});

// =================================================================
// 4. formatProvenanceReport
// =================================================================
describe('provenance: formatProvenanceReport', () => {
  it('produces [OK] message for all-clear graph', () => {
    const pairs = new Map([
      ['en:fr', { method: 'llm', target: 'fr' }],
    ]);
    const report = formatProvenanceReport(pairs);
    assert.ok(report.includes('[OK]'));
    assert.ok(report.includes('commercial use'));
  });

  it('produces [WARN] message when proprietary resources detected', () => {
    const pairs = new Map([
      ['en:crk', { method: 'fst-gated', target: 'crk' }],
    ]);
    const report = formatProvenanceReport(pairs);
    assert.ok(report.includes('[WARN]'), 'Should contain warning marker');
    assert.ok(report.includes('PROPRIETARY'), 'Should mention proprietary');
    assert.ok(report.includes('en:crk'), 'Should name the blocked pair');
    assert.ok(report.includes('fst-gated'), 'Should name the method');
  });

  it('includes resource details in the report', () => {
    const pairs = new Map([
      ['en:crk', { method: 'fst-gated', target: 'crk' }],
    ]);
    const report = formatProvenanceReport(pairs);
    // Should include the Wolvengrey dictionary info
    assert.ok(
      report.includes('Wolvengrey') || report.includes('Plains Cree FST'),
      'Should include resource names'
    );
  });
});
