/**
 * register-parity.test.js — Verifies register resolution parity between
 * the production config pipeline and the eval harness.
 *
 * WHY: The production path (config.js → resolveLanguages → pairs.js) and
 * the eval harness (run-benchmark.js → getRegister) must produce identical
 * register prompt text for the same preset key. If these diverge, the
 * harness evaluates a different prompt than production deploys.
 *
 * This test also verifies that registerPreset (the key name) is correctly
 * tracked through the config pipeline, which DeepL and status display
 * depend on for metadata lookups.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getRegister,
  getLanguageCard,
  getRegisterPresets,
  getAllLanguageCodes,
} from '../lib/registers.js';

// ---------------------------------------------------------------------------
// Helpers — simulate the two resolution paths
// ---------------------------------------------------------------------------

/**
 * Simulate the production config.js resolveLanguages() path.
 * This mirrors the logic in config.js lines 138-195.
 */
function simulateProductionPath(code, configValue) {
  const card = getLanguageCard(code);

  if (configValue === undefined) {
    // Array form: ["fr"] — uses default preset
    const defaultPresetKey = card?.formality?.default || null;
    return {
      register: getRegister(code),
      registerPreset: defaultPresetKey,
    };
  }

  if (typeof configValue === 'string') {
    // Shorthand form: { "fr": "casual-tu" }
    const isPresetKey = card?.registers?.[configValue] != null;
    return {
      register: getRegister(code, configValue),
      registerPreset: isPresetKey ? configValue : null,
    };
  }

  // Object form: { "fr": { register: "casual-tu" } }
  const regValue = configValue.register || null;
  const isPresetKey = regValue && card?.registers?.[regValue] != null;
  return {
    register: regValue ? getRegister(code, regValue) : getRegister(code),
    registerPreset: isPresetKey ? regValue : (regValue ? null : card?.formality?.default || null),
  };
}

/**
 * Simulate the eval harness resolvePresetOverride() + getRegister() path.
 * This mirrors the logic in run-benchmark.js.
 */
function simulateHarnessPath(code, registerOverrides) {
  let presetOverride;
  if (!registerOverrides) presetOverride = undefined;
  else if (typeof registerOverrides === 'string') presetOverride = registerOverrides;
  else presetOverride = registerOverrides[code] || undefined;

  return getRegister(code, presetOverride);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Register resolution parity', () => {
  it('production and harness produce identical register text for defaults', () => {
    // For every language with a card, verify that the default register text
    // is the same whether resolved via config.js or via getRegister().
    const codes = getAllLanguageCodes();

    for (const code of codes) {
      const prod = simulateProductionPath(code, undefined);
      const harness = simulateHarnessPath(code, null);

      assert.equal(
        prod.register,
        harness,
        `Register text mismatch for ${code} (default): production "${prod.register.slice(0, 40)}..." vs harness "${harness.slice(0, 40)}..."`
      );
    }
  });

  it('production and harness match for explicit preset keys', () => {
    // For languages with multiple presets, verify each preset produces
    // identical text through both paths.
    const codes = getAllLanguageCodes();

    for (const code of codes) {
      const presets = getRegisterPresets(code);
      for (const preset of presets) {
        const prod = simulateProductionPath(code, preset.key);
        const harness = simulateHarnessPath(code, { [code]: preset.key });

        assert.equal(
          prod.register,
          harness,
          `Register text mismatch for ${code}:${preset.key}`
        );
      }
    }
  });

  it('registerPreset is correctly tracked for preset keys', () => {
    // Verify that when a valid preset key is used, registerPreset is set
    // to that key (not null, not the prompt text).
    const testCases = [
      { code: 'fr', input: 'casual-tu', expectedPreset: 'casual-tu' },
      { code: 'fr', input: 'formal-vous', expectedPreset: 'formal-vous' },
      { code: 'ja', input: 'polite', expectedPreset: 'polite' },
      { code: 'ja', input: 'formal-keigo', expectedPreset: 'formal-keigo' },
    ];

    for (const { code, input, expectedPreset } of testCases) {
      const card = getLanguageCard(code);
      if (!card) continue; // Skip if no card

      const result = simulateProductionPath(code, input);
      assert.equal(
        result.registerPreset,
        expectedPreset,
        `registerPreset should be "${expectedPreset}" for ${code}:${input}, got "${result.registerPreset}"`
      );
    }
  });

  it('registerPreset is null for custom text', () => {
    const result = simulateProductionPath('fr', 'Use extremely formal legal French.');
    assert.equal(result.registerPreset, null);

    // Custom text should pass through unchanged
    assert.equal(result.register, 'Use extremely formal legal French.');
  });

  it('registerPreset is null for unknown languages', () => {
    const result = simulateProductionPath('xyz', undefined);
    assert.equal(result.registerPreset, null);
    assert.equal(result.register, 'Professional register.');
  });

  it('registerPreset tracks defaults correctly', () => {
    // When no preset is specified (array form), registerPreset should
    // be the card's default preset key.
    const testCases = ['fr', 'ko', 'ja', 'de', 'es'];

    for (const code of testCases) {
      const card = getLanguageCard(code);
      if (!card) continue;

      const result = simulateProductionPath(code, undefined);
      assert.equal(
        result.registerPreset,
        card.formality?.default || null,
        `Default registerPreset for ${code} should be "${card.formality?.default}"`
      );
    }
  });

  it('object form with register key resolves correctly', () => {
    // { "fr": { register: "casual-tu" } } should resolve preset
    const result = simulateProductionPath('fr', { register: 'casual-tu' });
    assert.equal(result.registerPreset, 'casual-tu');

    // Prompt text should match the preset's prompt
    const card = getLanguageCard('fr');
    assert.equal(result.register, card.registers['casual-tu'].prompt);
  });

  it('object form with custom register text has null preset', () => {
    const result = simulateProductionPath('fr', { register: 'Custom formal text.' });
    assert.equal(result.registerPreset, null);
    assert.equal(result.register, 'Custom formal text.');
  });

  it('object form without register field uses default', () => {
    const result = simulateProductionPath('fr', { name: 'French Custom' });
    const card = getLanguageCard('fr');
    assert.equal(result.registerPreset, card.formality?.default);
    assert.equal(result.register, getRegister('fr'));
  });
});
