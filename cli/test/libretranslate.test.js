#!/usr/bin/env node
/**
 * LibreTranslate method test suite.
 *
 * Tests cover:
 *   - Constructor and naming
 *   - Cost estimation (free/self-hosted)
 *   - Quality tier and provenance
 *   - No-key behavior (LibreTranslate doesn't require a key)
 *   - Unsupported translateContent
 *   - Registry lookup
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { LibreTranslateMethod } from '../lib/methods/libretranslate.js';
import { getMethod } from '../lib/translate.js';

// =================================================================
// LibreTranslateMethod
// =================================================================
describe('LibreTranslateMethod', () => {
  it('has the correct name', () => {
    const method = new LibreTranslateMethod();
    assert.equal(method.name, 'libretranslate');
  });

  it('returns standard quality tier', () => {
    const method = new LibreTranslateMethod();
    assert.equal(method.getQualityTier(), 'standard');
  });

  it('returns correct provenance — AGPL is NOT commercial-ready', () => {
    const method = new LibreTranslateMethod();
    const prov = method.getProvenance();
    assert.ok(prov.resources[0].name.includes('LibreTranslate'));
    assert.ok(prov.resources[0].license.includes('AGPL'));
    // Until 2026-08-12 this asserted `commercialReady: true` on the same
    // object that declares AGPL-3.0, contradicting the shared method registry
    // SSOT and the CLAUDE.md AGPL boundary. The engine stays fully usable in
    // the default non-commercial lane; only the commercial lane is gated.
    assert.equal(prov.commercialReady, false);
    assert.ok(prov.flags.includes('COPYLEFT_AGPL'));
  });

  it('returns zero cost estimate (self-hosted)', () => {
    const method = new LibreTranslateMethod();
    const cost = method.estimateCost(100);
    assert.equal(cost.estimatedCost, 0, 'LibreTranslate is self-hosted and free');
    assert.equal(cost.currency, 'USD');
    assert.ok(cost.note.includes('free'));
  });

  it('returns null for translateContent (unsupported)', async () => {
    const method = new LibreTranslateMethod();
    // Suppress the warning output during testing
    const origError = console.error;
    console.error = () => {};
    try {
      const result = await method.translateContent(
        'Translate this markdown.',
        { name: 'French', register: 'Standard.', target: 'fr' },
        {},
      );
      assert.equal(result, null);
    } finally {
      console.error = origError;
    }
  });
});

// =================================================================
// Registry integration
// =================================================================
describe('METHOD_REGISTRY — libretranslate', () => {
  it('getMethod returns LibreTranslateMethod for "libretranslate"', () => {
    const method = getMethod('libretranslate');
    assert.equal(method.name, 'libretranslate');
    assert.ok(method instanceof LibreTranslateMethod);
  });
});
