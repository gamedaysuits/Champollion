import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyTerminology, logTermViolations } from '../lib/terminology.js';

// -----------------------------------------------------------------
// verifyTerminology — core logic
// -----------------------------------------------------------------

test('verifyTerminology: no violations when term is correctly translated', () => {
  const translations = { 'nav.dashboard': 'Tableau de bord' };
  const sourceFlat = { 'nav.dashboard': 'Dashboard overview' };
  const dictionary = { 'dashboard': 'tableau de bord' };

  const { violations } = verifyTerminology(translations, sourceFlat, dictionary);
  assert.equal(violations.length, 0);
});

test('verifyTerminology: violation when required term is missing in translation', () => {
  const translations = { 'nav.dashboard': 'Aperçu général' };
  const sourceFlat = { 'nav.dashboard': 'Dashboard overview' };
  const dictionary = { 'dashboard': 'tableau de bord' };

  const { violations } = verifyTerminology(translations, sourceFlat, dictionary);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].key, 'nav.dashboard');
  assert.equal(violations[0].term, 'dashboard');
  assert.equal(violations[0].expected, 'tableau de bord');
});

test('verifyTerminology: no violation when source term is absent from source value', () => {
  // Dictionary has "dashboard" but the source string doesn't mention it
  const translations = { 'nav.settings': 'Paramètres' };
  const sourceFlat = { 'nav.settings': 'Settings' };
  const dictionary = { 'dashboard': 'tableau de bord' };

  const { violations } = verifyTerminology(translations, sourceFlat, dictionary);
  assert.equal(violations.length, 0);
});

test('verifyTerminology: case-insensitive matching on both source and translation', () => {
  // Source has "Dashboard" (capitalized), dictionary has "dashboard" (lowercase)
  // Translation has "TABLEAU DE BORD" (uppercase) — should still match
  const translations = { 'nav.home': 'TABLEAU DE BORD principal' };
  const sourceFlat = { 'nav.home': 'Main Dashboard' };
  const dictionary = { 'dashboard': 'tableau de bord' };

  const { violations } = verifyTerminology(translations, sourceFlat, dictionary);
  assert.equal(violations.length, 0);
});

test('verifyTerminology: empty dictionary produces no violations', () => {
  const translations = { 'key1': 'Bonjour' };
  const sourceFlat = { 'key1': 'Hello' };

  const { violations } = verifyTerminology(translations, sourceFlat, {});
  assert.equal(violations.length, 0);
});

test('verifyTerminology: null dictionary produces no violations', () => {
  const translations = { 'key1': 'Bonjour' };
  const sourceFlat = { 'key1': 'Hello' };

  const { violations } = verifyTerminology(translations, sourceFlat, null);
  assert.equal(violations.length, 0);
});

test('verifyTerminology: multiple violations across multiple keys', () => {
  const translations = {
    'nav.dashboard': 'Page principale',        // missing "tableau de bord"
    'auth.signin': 'Connexion',                // missing "se connecter"
    'nav.settings': 'Paramètres',              // "settings" not in dictionary — no check
  };
  const sourceFlat = {
    'nav.dashboard': 'Dashboard',
    'auth.signin': 'Sign in to your account',
    'nav.settings': 'Settings',
  };
  const dictionary = {
    'dashboard': 'tableau de bord',
    'sign in': 'se connecter',
  };

  const { violations } = verifyTerminology(translations, sourceFlat, dictionary);
  assert.equal(violations.length, 2);

  const keys = violations.map(v => v.key).sort();
  assert.deepEqual(keys, ['auth.signin', 'nav.dashboard']);
});

test('verifyTerminology: Unicode terms (accented characters) work correctly', () => {
  const translations = { 'ui.resume': 'Reprendre le résumé' };
  const sourceFlat = { 'ui.resume': 'Resume summary' };
  const dictionary = { 'resume': 'résumé' };

  // "résumé" appears in the translation — should pass
  const { violations } = verifyTerminology(translations, sourceFlat, dictionary);
  assert.equal(violations.length, 0);
});

test('verifyTerminology: long translations are truncated in violation output', () => {
  const longTranslation = 'A'.repeat(200);
  const translations = { 'key': longTranslation };
  const sourceFlat = { 'key': 'Dashboard metrics and analytics' };
  const dictionary = { 'dashboard': 'tableau de bord' };

  const { violations } = verifyTerminology(translations, sourceFlat, dictionary);
  assert.equal(violations.length, 1);
  // 'got' should be truncated to ~100 chars + ellipsis
  assert.ok(violations[0].got.length <= 105);
  assert.ok(violations[0].got.endsWith('…'));
});

test('verifyTerminology: skips non-string translated values', () => {
  const translations = { 'key': 42 };
  const sourceFlat = { 'key': 'Dashboard' };
  const dictionary = { 'dashboard': 'tableau de bord' };

  // Should not throw, just skip
  const { violations } = verifyTerminology(translations, sourceFlat, dictionary);
  assert.equal(violations.length, 0);
});

// -----------------------------------------------------------------
// logTermViolations — output formatting (smoke test)
// -----------------------------------------------------------------

test('logTermViolations: does not throw on empty violations', () => {
  // Just verify it doesn't crash — output goes to stderr
  assert.doesNotThrow(() => logTermViolations([], 'en:fr'));
});

test('logTermViolations: does not throw with violations', () => {
  const violations = [{
    key: 'nav.dashboard',
    term: 'dashboard',
    expected: 'tableau de bord',
    got: 'Page principale',
  }];
  assert.doesNotThrow(() => logTermViolations(violations, 'en:fr'));
});
