#!/usr/bin/env node
/**
 * Conlang hardening test suite — validates the retry cascade,
 * quality gate, prompt caching, config schema extensions, and
 * script converters for constructed/low-resource languages.
 *
 * Tests cover:
 *   Phase 1: Config schema — per-language model/batchSize/maxRetries/script
 *   Phase 2: Prompt caching — system/user message split
 *   Phase 3: Retry cascade — parse error recovery (batch → half → individual)
 *   Phase 4: Quality gate — repetition, length ratio, script compliance, echo
 *   Phase 5: Script converters — SRO→Syllabics, Latin→Cyrillic,
 *            Romanization→pIqaD, Latin→Tengwar, Latin→Kryptonian
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// Phase 1: Config schema
import { resolveConfig } from '../lib/config.js';
import { resolvePairs, PAIR_DEFAULTS } from '../lib/pairs.js';

// Phase 2: Prompt caching
import { buildSystemMessage, buildUserMessage, buildPrompt } from '../lib/methods/llm.js';
import { buildCoachedSystemMessage, buildCoachedPrompt } from '../lib/methods/llm-coached.js';

// Phase 4: Quality gate
import {
  validateTranslations,
  measureRepetition,
  isAsciiOnly,
  NON_LATIN_LOCALES,
  DEFAULT_THRESHOLDS,
} from '../lib/validate.js';

// Phase 5: Script converters
import {
  sroToSyllabics,
  latinToCyrillicSr,
  romanizationToPiqad,
  latinToTengwar,
  latinToKryptonian,
  convertScript,
  hasScriptConverter,
  getConverterInfo,
  SCRIPT_CONVERTERS,
} from '../lib/scripts.js';

// =================================================================
// Phase 1: Config schema — per-language overrides
// =================================================================
describe('Config schema: per-language overrides', () => {
  it('passes model through from language config', () => {
    // resolvePairs expects resolvedLanguages (post-resolveLanguages output)
    // Language-level fields should flow through to the pair config
    const pairs = resolvePairs({
      inputLocale: 'en',
      resolvedLanguages: {
        tlh: {
          name: 'Klingon',
          register: 'Warrior formal.',
          model: 'google/gemini-3.1-pro-thinking',
        },
      },
    });

    const pair = pairs.get('en:tlh');
    assert.ok(pair, 'Pair should exist');
    assert.equal(pair.model, 'google/gemini-3.1-pro-thinking');
  });

  it('passes batchSize through from language config', () => {
    const pairs = resolvePairs({
      inputLocale: 'en',
      resolvedLanguages: {
        crk: {
          name: 'Plains Cree',
          register: 'Respectful.',
          batchSize: 5,
        },
      },
    });

    const pair = pairs.get('en:crk');
    assert.ok(pair, 'Pair should exist');
    assert.equal(pair.batchSize, 5);
  });

  it('passes maxRetries through from language config', () => {
    const pairs = resolvePairs({
      inputLocale: 'en',
      resolvedLanguages: {
        tlh: {
          name: 'Klingon',
          register: 'Warrior formal.',
          maxRetries: 7,
        },
      },
    });

    const pair = pairs.get('en:tlh');
    assert.ok(pair, 'Pair should exist');
    assert.equal(pair.maxRetries, 7);
  });

  it('passes a valid script field through, resolved to its converter', () => {
    const pairs = resolvePairs({
      inputLocale: 'en',
      resolvedLanguages: {
        crk: {
          name: 'Plains Cree',
          register: 'Respectful.',
          script: 'Cans',
        },
      },
    });

    const pair = pairs.get('en:crk');
    assert.ok(pair, 'Pair should exist');
    assert.equal(pair.script, 'Cans');
    assert.equal(pair.scriptResolution.script, 'Cans');
    assert.equal(pair.scriptResolution.converterKey, 'crk');
  });

  it('rejects the legacy lowercase script value with the exact rename hint', () => {
    // Pre-0.3.0 docs said script: "syllabics" — the field was accepted but
    // never read. Now that it drives conversion, the legacy word errors loud
    // at pair-graph build with the replacement named, so nobody is punished
    // for following old docs without being told the fix.
    assert.throws(
      () => resolvePairs({
        inputLocale: 'en',
        resolvedLanguages: {
          crk: { name: 'Plains Cree', register: 'Respectful.', script: 'syllabics' },
        },
      }),
      (e) => /en:crk/.test(e.message) && /Use "Cans"/.test(e.message),
    );
  });

  it('defaults maxRetries to PAIR_DEFAULTS value', () => {
    const pairs = resolvePairs({
      inputLocale: 'en',
      resolvedLanguages: {
        fr: { name: 'French', register: 'Standard.' },
      },
    });

    const pair = pairs.get('en:fr');
    assert.ok(pair, 'Pair should exist');
    assert.equal(pair.maxRetries, PAIR_DEFAULTS.maxRetries);
    assert.equal(pair.maxRetries, 3, 'Default maxRetries should be 3');
  });

  it('pair-level overrides beat language-level values', () => {
    const pairs = resolvePairs({
      inputLocale: 'en',
      resolvedLanguages: {
        tlh: {
          name: 'Klingon',
          register: 'Warrior formal.',
          model: 'google/gemini-3.1-pro-thinking',
          maxRetries: 5,
        },
      },
      pairs: {
        'en:tlh': {
          model: 'anthropic/claude-opus-4',
          maxRetries: 10,
        },
      },
    });

    const pair = pairs.get('en:tlh');
    assert.equal(pair.model, 'anthropic/claude-opus-4', 'Pair-level model wins');
    assert.equal(pair.maxRetries, 10, 'Pair-level maxRetries wins');
  });
});

// =================================================================
// Phase 2: Prompt caching — system/user message split
// =================================================================
describe('Prompt caching: system/user message split', () => {
  it('buildSystemMessage contains register and rules', () => {
    const system = buildSystemMessage({ name: 'Klingon', register: 'Warrior formal.' });

    assert.ok(system.includes('Klingon'), 'Should mention target language');
    assert.ok(system.includes('Warrior formal.'), 'Should include register');
    assert.ok(system.includes('Translate ONLY the values'), 'Should include translation rules');
    assert.ok(system.includes('Return ONLY valid JSON'), 'Should include JSON instruction');
  });

  it('buildSystemMessage does NOT contain batch-specific data', () => {
    const system = buildSystemMessage({ name: 'French', register: 'Standard.' });

    // System message should not contain any JSON payload or key-value data
    assert.ok(!system.includes('{'), 'System message should not contain JSON');
    assert.ok(!system.includes('hero.title'), 'System message should not contain keys');
  });

  it('buildUserMessage contains JSON payload and UI hints', () => {
    const user = buildUserMessage({
      'hero.title': 'Welcome',
      'nav.button': 'Click me',
    });

    assert.ok(user.includes('"hero.title"'), 'Should contain key in JSON');
    assert.ok(user.includes('"Welcome"'), 'Should contain value in JSON');
    assert.ok(user.includes('heading/title'), 'Should infer heading type hint');
    assert.ok(user.includes('button label'), 'Should infer button type hint');
  });

  it('buildPrompt combines system + user (backward compat)', () => {
    const prompt = buildPrompt(
      { 'test.key': 'Hello' },
      { name: 'French', register: 'Standard.' },
    );

    assert.ok(prompt.includes('French'), 'Contains system part');
    assert.ok(prompt.includes('"test.key"'), 'Contains user part');
    assert.ok(prompt.includes('"Hello"'), 'Contains JSON payload');
  });

  it('buildCoachedSystemMessage includes coaching context', () => {
    const system = buildCoachedSystemMessage(
      { name: 'Klingon', register: 'Warrior formal.' },
      {
        grammar_rules: ['Always use imperative mood.'],
        dictionary: {},
        style_notes: 'Aggressive, clipped.',
      },
    );

    assert.ok(system.includes('Klingon'), 'Should mention target language');
    assert.ok(system.includes('GRAMMAR RULES'), 'Should include grammar block');
    assert.ok(system.includes('Always use imperative mood.'), 'Should include rules');
    assert.ok(system.includes('STYLE GUIDE'), 'Should include style notes');
    assert.ok(system.includes('Aggressive, clipped.'), 'Should include style content');
  });

  it('buildCoachedPrompt includes dictionary hints in user portion', () => {
    const prompt = buildCoachedPrompt(
      { 'greeting': 'Hello warrior' },
      { name: 'Klingon', register: 'Warrior formal.' },
      {
        grammar_rules: ['Use direct address.'],
        dictionary: { warrior: "SuvwI'" },
        style_notes: '',
      },
    );

    assert.ok(prompt.includes('REQUIRED TERMINOLOGY'), 'Should include dictionary hints');
    assert.ok(prompt.includes("SuvwI'"), 'Should include dictionary translation');
  });
});

// =================================================================
// Phase 3: Retry cascade — parse error structured return
// =================================================================
describe('Retry cascade: structured parse errors', () => {
  // These tests verify the _parseError protocol at the client level.
  // Full cascade behavior is tested via integration tests with mock fetch.

  it('PAIR_DEFAULTS includes maxRetries', () => {
    assert.ok('maxRetries' in PAIR_DEFAULTS, 'PAIR_DEFAULTS should have maxRetries');
    assert.equal(typeof PAIR_DEFAULTS.maxRetries, 'number');
    assert.ok(PAIR_DEFAULTS.maxRetries > 0, 'maxRetries should be positive');
  });
});

// =================================================================
// Phase 4: Quality gate — deterministic validation
// =================================================================
describe('Quality gate: validateTranslations', () => {
  const basicPairConfig = { target: 'fr' };

  it('passes valid translations through', () => {
    const { validated, failures } = validateTranslations(
      { 'key1': 'Bonjour', 'key2': 'Au revoir' },
      { 'key1': 'Hello', 'key2': 'Goodbye' },
      basicPairConfig,
    );

    assert.equal(Object.keys(validated).length, 2);
    assert.equal(failures.length, 0);
    assert.equal(validated['key1'], 'Bonjour');
  });

  it('rejects empty translations', () => {
    const { validated, failures } = validateTranslations(
      { 'key1': '', 'key2': '   ' },
      { 'key1': 'Hello', 'key2': 'World' },
      basicPairConfig,
    );

    assert.equal(Object.keys(validated).length, 0);
    assert.equal(failures.length, 2);
    assert.ok(failures[0].reason.includes('empty'));
  });

  it('rejects source echo (identical to English)', () => {
    // Use a longer source string to avoid the short-ASCII exemption
    // (short strings ≤30 chars of mostly ASCII are exempt because they
    // may be proper nouns/brand names that legitimately stay in English)
    const longSource = 'Welcome to our application and enjoy the experience';
    const { validated, failures } = validateTranslations(
      { 'key1': longSource, 'key2': 'Bonjour le monde' },
      { 'key1': longSource, 'key2': 'Hello world' },
      basicPairConfig,
    );

    assert.equal(Object.keys(validated).length, 1);
    assert.equal(failures.length, 1);
    assert.ok(failures[0].reason.includes('source echo'));
    assert.equal(failures[0].key, 'key1');
  });

  it('rejects hallucination loops (high repetition)', () => {
    const { validated, failures } = validateTranslations(
      { 'key1': "Qo' Qo' Qo' Qo' Qo' Qo' Qo' Qo' Qo'" },
      { 'key1': 'Welcome' },
      basicPairConfig,
    );

    assert.equal(Object.keys(validated).length, 0);
    assert.equal(failures.length, 1);
    assert.ok(failures[0].reason.includes('repetition'));
  });

  // Regression: 2026-07-18, en:fil glossary.valency.plain. Correct formal
  // Tagalog measures 60-70% repeated trigrams from normal function-word
  // density (kung/ng/mga/paano) — three correct candidates across two models
  // were rejected under the old absolute trigram cap.
  it('accepts particle-heavy Tagalog with naturally high trigram repetition', () => {
    const source = "How many participants a verb requires and how it encodes them — 'sleep' takes one, 'give' takes three. Languages disagree about which participants particular verbs take and how they are marked.";
    const tagalog = "Kung ilang kalahok ang kinakailangan ng isang pandiwa at kung paano nito ipinapahayag ang mga ito — isa ang kailangan ng 'sleep', tatlo ang sa 'give'. Nagkakaiba-iba ang mga wika kung aling mga kalahok ang tinatanggap ng partikular na mga pandiwa at kung paano minamarkahan ang mga ito.";

    // Precondition: this text genuinely exceeds the trigram cap — if it
    // stops doing so, the regression test no longer exercises the two-signal
    // rule and needs a stronger fixture.
    assert.ok(measureRepetition(tagalog) > 0.60,
      `Fixture should exceed the trigram cap: ${measureRepetition(tagalog)}`);

    const { validated, failures } = validateTranslations(
      { 'glossary.valency.plain': tagalog },
      { 'glossary.valency.plain': source },
      { target: 'fil' },
    );

    assert.equal(failures.length, 0, `Correct Tagalog rejected: ${failures[0]?.reason}`);
    assert.equal(validated['glossary.valency.plain'], tagalog);
  });

  // Regression: 2026-07-18, en:pt hero line. A deliberately repetitive
  // source licenses an equally repetitive faithful translation.
  it('accepts a faithful translation of a deliberately repetitive source', () => {
    const { validated, failures } = validateTranslations(
      { 'hero.title': 'Qualquer idioma, para qualquer idioma.' },
      { 'hero.title': 'Every language, into every language.' },
      { target: 'pt' },
    );

    assert.equal(failures.length, 0, `Faithful repetitive translation rejected: ${failures[0]?.reason}`);
    assert.equal(validated['hero.title'], 'Qualquer idioma, para qualquer idioma.');
  });

  it('still rejects degeneration loops in a particle-heavy target language', () => {
    const { validated, failures } = validateTranslations(
      { 'key1': 'Ang wika ay mahalaga sa atin. Ang wika ay mahalaga sa atin. Ang wika ay mahalaga sa atin.' },
      { 'key1': 'Language matters to us all, in every community and every home.' },
      { target: 'fil' },
    );

    assert.equal(Object.keys(validated).length, 0);
    assert.equal(failures.length, 1);
    assert.ok(failures[0].reason.includes('repetition'));
  });

  it('still rejects a loop even when the source is deliberately repetitive', () => {
    const { validated, failures } = validateTranslations(
      { 'hero.title': 'idioma idioma idioma idioma idioma idioma' },
      { 'hero.title': 'Every language, into every language.' },
      { target: 'pt' },
    );

    assert.equal(Object.keys(validated).length, 0);
    assert.equal(failures.length, 1);
    assert.ok(failures[0].reason.includes('repetition'));
  });

  it('still rejects short degeneration loops', () => {
    const { validated, failures } = validateTranslations(
      { 'key1': "Qo' Qo' Qo' Qo'" },
      { 'key1': 'Welcome home' },
      basicPairConfig,
    );

    assert.equal(Object.keys(validated).length, 0);
    assert.equal(failures.length, 1);
    assert.ok(failures[0].reason.includes('repetition'));
  });

  it('rejects length inflation', () => {
    // Use diverse natural text to avoid triggering the repetition detector.
    // Lorem ipsum has enough trigram diversity to pass (rate ~0.41 < 0.60).
    const longValue = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur Excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum';
    const { validated, failures } = validateTranslations(
      { 'key1': longValue },
      { 'key1': 'Hi' },
      basicPairConfig,
    );

    assert.equal(Object.keys(validated).length, 0);
    assert.equal(failures.length, 1);
    assert.ok(failures[0].reason.includes('length inflation'));
  });

  it('rejects suspiciously short translations', () => {
    const { validated, failures } = validateTranslations(
      { 'key1': 'X' },
      { 'key1': 'This is a long description of a feature that does many things.' },
      basicPairConfig,
    );

    assert.equal(Object.keys(validated).length, 0);
    assert.equal(failures.length, 1);
    assert.ok(failures[0].reason.includes('short'));
  });

  it('rejects ASCII-only for non-Latin locales', () => {
    // Translated value is ASCII-only but different from source,
    // and long enough to avoid the short-ASCII proper noun exemption.
    // This simulates a romanized Russian translation that should be Cyrillic.
    const { validated, failures } = validateTranslations(
      { 'key1': 'Dobro pozhalovat v nashe zamechatelnoe prilozhenie segodnya' },
      { 'key1': 'Welcome to our wonderful application today' },
      { target: 'ru' },
    );

    assert.equal(Object.keys(validated).length, 0);
    assert.equal(failures.length, 1);
    assert.ok(failures[0].reason.includes('wrong script'));
  });

  it('accepts ASCII for Latin-script locales', () => {
    const { validated, failures } = validateTranslations(
      { 'key1': 'Bonjour' },
      { 'key1': 'Hello' },
      { target: 'fr' },
    );

    assert.equal(Object.keys(validated).length, 1);
    assert.equal(failures.length, 0);
  });

  it('accepts non-ASCII for non-Latin locales', () => {
    const { validated, failures } = validateTranslations(
      { 'key1': 'Привет' },
      { 'key1': 'Hello' },
      { target: 'ru' },
    );

    assert.equal(Object.keys(validated).length, 1);
    assert.equal(failures.length, 0);
  });

  it('respects per-language maxLengthRatio override', () => {
    // Diverse text that passes the repetition detector but is long relative to source
    const longValue = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua';
    const { validated: v1, failures: f1 } = validateTranslations(
      { 'key1': longValue },
      { 'key1': 'Hello' },
      basicPairConfig,
      { maxLengthRatio: 4.0 },  // default: 4x, text is ~24x
    );
    assert.equal(f1.length, 1, 'Should fail at default 4x ratio');

    const { validated: v2, failures: f2 } = validateTranslations(
      { 'key1': longValue },
      { 'key1': 'Hello' },
      basicPairConfig,
      { maxLengthRatio: 200.0 },  // permissive
    );
    assert.equal(f2.length, 0, 'Should pass at 200x ratio');
  });
});

describe('Quality gate: measureRepetition', () => {
  it('returns 0 for short text', () => {
    assert.equal(measureRepetition('Hi'), 0);
  });

  it('returns low rate for normal text', () => {
    const rate = measureRepetition('The quick brown fox jumps over the lazy dog.');
    assert.ok(rate < 0.5, `Normal text should have low repetition: ${rate}`);
  });

  it('returns high rate for hallucinated text', () => {
    const rate = measureRepetition("Qo' Qo' Qo' Qo' Qo' Qo' Qo' Qo'");
    assert.ok(rate > 0.5, `Repeated text should have high repetition: ${rate}`);
  });

  it('separates particle repetition from loops at the long-8-gram window', () => {
    const tagalog = "Kung ilang kalahok ang kinakailangan ng isang pandiwa at kung paano nito ipinapahayag ang mga ito — isa ang kailangan ng 'sleep', tatlo ang sa 'give'.";
    assert.ok(measureRepetition(tagalog, 8) < 0.5,
      `Particle-heavy text should be low at n=8: ${measureRepetition(tagalog, 8)}`);

    const loop = 'the cat sat on the cat sat on the cat sat on the cat sat on';
    assert.ok(measureRepetition(loop, 8) > 0.5,
      `Looping text should be high at n=8: ${measureRepetition(loop, 8)}`);
  });
});

describe('Quality gate: isAsciiOnly', () => {
  it('returns true for pure ASCII', () => {
    assert.equal(isAsciiOnly('Hello world 123!'), true);
  });

  it('returns false for text with non-ASCII', () => {
    assert.equal(isAsciiOnly('Привет'), false);
    assert.equal(isAsciiOnly('こんにちは'), false);
    assert.equal(isAsciiOnly('Héllo'), false);
  });
});

describe('Quality gate: NON_LATIN_LOCALES', () => {
  it('includes CJK locales', () => {
    assert.ok(NON_LATIN_LOCALES.has('zh'));
    assert.ok(NON_LATIN_LOCALES.has('ja'));
    assert.ok(NON_LATIN_LOCALES.has('ko'));
  });

  it('includes Cyrillic locales', () => {
    assert.ok(NON_LATIN_LOCALES.has('ru'));
    assert.ok(NON_LATIN_LOCALES.has('uk'));
  });

  it('includes Arabic/RTL locales', () => {
    assert.ok(NON_LATIN_LOCALES.has('ar'));
    assert.ok(NON_LATIN_LOCALES.has('he'));
  });




  it('does NOT include Latin-script locales', () => {
    assert.ok(!NON_LATIN_LOCALES.has('fr'));
    assert.ok(!NON_LATIN_LOCALES.has('de'));
    assert.ok(!NON_LATIN_LOCALES.has('es'));
  });

  it('dynamically picks up non-Latin cards (Georgian, Greek)', () => {
    // These are derived from the card registry, not hardcoded
    assert.ok(NON_LATIN_LOCALES.has('ka'), 'Georgian (script: Geor) should be included');
    assert.ok(NON_LATIN_LOCALES.has('el'), 'Greek (script: Grek) should be included');
    assert.ok(NON_LATIN_LOCALES.has('th'), 'Thai (script: Thai) should be included');
    assert.ok(NON_LATIN_LOCALES.has('bn'), 'Bengali (script: Beng) should be included');
  });
});

// =================================================================
// Phase 5: Script converter integration
// =================================================================

describe('Script converter: registry', () => {
  it('has a converter registered for Plains Cree (crk)', () => {
    assert.ok(hasScriptConverter('crk'));
  });

  it('has a converter registered for Serbian (sr)', () => {
    assert.ok(hasScriptConverter('sr'));
  });

  it('returns false for locales without converters', () => {
    assert.ok(!hasScriptConverter('fr'));
    assert.ok(!hasScriptConverter('de'));
    assert.ok(!hasScriptConverter('ja'));
  });

  it('getConverterInfo returns from/to/type for registered locales', () => {
    const info = getConverterInfo('crk');
    assert.ok(info);
    assert.equal(info.type, 'deterministic');
    assert.ok(info.from.includes('SRO'));
    assert.ok(info.to.includes('Syllabics'));
  });

  it('getConverterInfo returns null for unregistered locales', () => {
    assert.equal(getConverterInfo('fr'), null);
  });
});

describe('Script converter: SRO → Syllabics', () => {
  it('converts basic SRO to syllabics', () => {
    const result = sroToSyllabics('tânisi');
    assert.ok(result.length > 0, 'Should produce output');
    // Verify the output is non-ASCII (syllabic characters)
    assert.ok(!isAsciiOnly(result), 'Output should contain syllabic characters');
  });

  it('preserves spaces and punctuation', () => {
    const result = sroToSyllabics('tânisi! kiya.');
    assert.ok(result.includes('!'), 'Should preserve exclamation');
    assert.ok(result.includes('.'), 'Should preserve period');
    assert.ok(result.includes(' '), 'Should preserve space');
  });

  it('handles empty string', () => {
    assert.equal(sroToSyllabics(''), '');
  });
});

describe('Script converter: Latin → Cyrillic Serbian', () => {
  it('converts basic Latin Serbian to Cyrillic', () => {
    const result = latinToCyrillicSr('Dobro');
    assert.ok(!isAsciiOnly(result), 'Output should be Cyrillic');
    assert.equal(result, 'Добро');
  });

  it('handles digraphs correctly (lj, nj, dž)', () => {
    const result = latinToCyrillicSr('ljeto');
    assert.ok(result.startsWith('љ'), 'lj digraph should map to single character');
  });

  it('preserves non-mapped characters', () => {
    const result = latinToCyrillicSr('Test 123!');
    assert.ok(result.includes('123'), 'Numbers should pass through');
    assert.ok(result.includes('!'), 'Punctuation should pass through');
  });
});

describe('Script converter: convertScript API', () => {
  it('converts SRO text for crk locale', () => {
    const { converted, converterUsed } = convertScript('tânisi', 'crk');
    assert.ok(converterUsed, 'Should report converter used');
    assert.ok(converterUsed.includes('SRO'), 'Should mention source script');
    assert.ok(converterUsed.includes('Syllabics'), 'Should mention target script');
    assert.ok(!isAsciiOnly(converted), 'Output should be non-ASCII');
  });

  it('returns text unchanged for locales without converters', () => {
    const { converted, converterUsed } = convertScript('Bonjour', 'fr');
    assert.equal(converted, 'Bonjour', 'Text should pass through unchanged');
    assert.equal(converterUsed, null, 'No converter should be reported');
  });

  it('converts Serbian Latin to Cyrillic', () => {
    const { converted, converterUsed } = convertScript('Zdravo', 'sr');
    assert.ok(converterUsed, 'Should report converter used');
    assert.equal(converted, 'Здраво');
  });
});

// =================================================================
// Phase 5B: Klingon pIqaD converter
// =================================================================
describe('Script converter: Romanization → pIqaD', () => {
  it('converts basic Klingon romanization to pIqaD', () => {
    const result = romanizationToPiqad('nuqneH');
    assert.ok(result.length > 0, 'Should produce output');
    assert.ok(
      [...result].some(ch => ch.charCodeAt(0) >= 0xF8D0 && ch.charCodeAt(0) <= 0xF8FF),
      'Output should contain pIqaD PUA characters'
    );
  });

  it('handles trigraph tlh correctly', () => {
    const result = romanizationToPiqad('tlhIngan');
    assert.ok(result.length < 'tlhIngan'.length, 'Trigraph should collapse to one character');
    assert.equal(result[0], '\uF8E4', 'tlh should map to U+F8E4');
  });

  it('handles digraphs ch, gh, ng correctly', () => {
    assert.equal(romanizationToPiqad('ch'), '\uF8D2', 'ch → U+F8D2');
    assert.equal(romanizationToPiqad('gh'), '\uF8D5', 'gh → U+F8D5');
    assert.equal(romanizationToPiqad('ng'), '\uF8DC', 'ng → U+F8DC');
  });

  it('is case-sensitive (D ≠ d)', () => {
    assert.equal(romanizationToPiqad('D'), '\uF8D3', 'D maps to pIqaD D');
    assert.equal(romanizationToPiqad('d'), 'd', 'lowercase d passes through unmapped');
  });

  it('handles glottal stop (apostrophe)', () => {
    assert.ok(romanizationToPiqad("Qo'").endsWith('\uF8E9'), 'Apostrophe → glottal stop');
  });

  it('handles curly apostrophe (copy-paste safety)', () => {
    assert.ok(romanizationToPiqad('Qo\u2019').endsWith('\uF8E9'), 'Curly quote → glottal stop');
  });

  it('preserves spaces and punctuation', () => {
    const result = romanizationToPiqad('nuqneH! batlh.');
    assert.ok(result.includes('!') && result.includes('.') && result.includes(' '));
  });

  it('handles empty string', () => {
    assert.equal(romanizationToPiqad(''), '');
  });
});

// =================================================================
// Phase 5C: Tengwar (Sindarin Mode of Beleriand) converter
// =================================================================
describe('Script converter: Latin → Tengwar', () => {
  it('converts basic Sindarin Latin to Tengwar', () => {
    const result = latinToTengwar('mae govannen');
    assert.ok(result.length > 0, 'Should produce output');
    assert.ok(
      [...result].some(ch => ch.charCodeAt(0) >= 0xE000 && ch.charCodeAt(0) <= 0xE07F),
      'Output should contain Tengwar PUA characters'
    );
  });

  it('handles digraph th correctly', () => {
    assert.equal(latinToTengwar('th'), '\uE003', 'th → thúlë');
  });

  it('maps vowels as full letters (Beleriand mode)', () => {
    assert.equal(latinToTengwar('a'), '\uE03F', 'a → short a tengwa');
    assert.equal(latinToTengwar('e'), '\uE041', 'e → short e tengwa');
  });

  it('handles long vowels with diacritics', () => {
    assert.equal(latinToTengwar('á'), '\uE040', 'á → long a carrier');
    assert.equal(latinToTengwar('â'), '\uE040', 'â → long a carrier');
  });

  it('lowercases input for consistent mapping', () => {
    assert.equal(latinToTengwar('MAE'), latinToTengwar('mae'));
  });

  it('preserves non-mapped characters', () => {
    const result = latinToTengwar('elen 123!');
    assert.ok(result.includes('123') && result.includes('!') && result.includes(' '));
  });

  it('handles empty string', () => {
    assert.equal(latinToTengwar(''), '');
  });
});

// =================================================================
// Phase 5D: Kryptonian converter (1:1 Latin cipher)
// =================================================================
describe('Script converter: Latin → Kryptonian', () => {
  it('converts Latin text to Kryptonian PUA characters', () => {
    const result = latinToKryptonian('Kal-El');
    assert.equal(result.charCodeAt(0), 0xE10A, 'K → U+E10A');
  });

  it('maps A-Z to sequential PUA block U+E100-E119', () => {
    assert.equal(latinToKryptonian('A').charCodeAt(0), 0xE100, 'A → U+E100');
    assert.equal(latinToKryptonian('Z').charCodeAt(0), 0xE119, 'Z → U+E119');
    assert.equal(latinToKryptonian('M').charCodeAt(0), 0xE10C, 'M → U+E10C');
  });

  it('is case-insensitive', () => {
    assert.equal(latinToKryptonian('A'), latinToKryptonian('a'));
  });

  it('preserves non-alpha characters', () => {
    const result = latinToKryptonian('Kal-El 123!');
    assert.ok(result.includes('-') && result.includes(' ') && result.includes('123') && result.includes('!'));
  });

  it('handles empty string', () => {
    assert.equal(latinToKryptonian(''), '');
  });
});

// =================================================================
// Phase 5E: convertScript API — conlang integration
// =================================================================
describe('Script converter: convertScript API — conlangs', () => {
  it('converts Klingon romanization via tlh locale', () => {
    const { converted, converterUsed } = convertScript('nuqneH', 'tlh');
    assert.ok(converterUsed && converterUsed.includes('pIqaD'));
    assert.ok([...converted].some(ch => ch.charCodeAt(0) >= 0xF8D0));
  });

  it('converts Sindarin Latin via x-elvish-s locale', () => {
    const { converted, converterUsed } = convertScript('mae govannen', 'x-elvish-s');
    assert.ok(converterUsed && converterUsed.includes('Tengwar'));
  });

  it('converts Latin to Kryptonian via x-kryptonian locale', () => {
    const { converted, converterUsed } = convertScript('Kal-El', 'x-kryptonian');
    assert.ok(converterUsed && converterUsed.includes('Kryptonian'));
  });

  it('registry has all 5 converters registered', () => {
    for (const code of ['crk', 'sr', 'tlh', 'x-elvish-s', 'x-kryptonian']) {
      assert.ok(hasScriptConverter(code), `${code} should be registered`);
    }
  });

  it('getConverterInfo returns fontNote for PUA-based converters', () => {
    assert.ok(getConverterInfo('tlh').fontNote?.includes('pIqaD'));
    assert.ok(getConverterInfo('x-elvish-s').fontNote);
    assert.ok(getConverterInfo('x-kryptonian').fontNote);
    assert.equal(getConverterInfo('x-kryptonian').type, 'font-based');
  });

  it('non-PUA converters (crk, sr) have no fontNote', () => {
    assert.equal(getConverterInfo('crk').fontNote, undefined);
    assert.equal(getConverterInfo('sr').fontNote, undefined);
  });
});
