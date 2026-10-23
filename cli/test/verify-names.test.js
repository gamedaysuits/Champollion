/**
 * Post-sync verification agrees with the quality gate about names.
 *
 * curtisforbes.com ran every sync with --no-verify because verification
 * failed on "Curtis Forbes" / "Game Day Suits" in non-Latin locales — values
 * the gate had accepted. Verify now exempts the same things the gate does:
 * declared names (config.protectedTerms) and names the gate settled
 * (TM-stamped echoes). Anything else ASCII-only in a non-Latin locale is
 * still an error — that is what caught "Translation CLI" in Arabic.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { auditTranslations } from '../lib/verify.js';

const source = { person: 'Curtis Forbes', brand: 'Game Day Suits', label: 'Evaluation harness' };
const ja = { person: 'Curtis Forbes', brand: 'Game Day Suits', label: 'Evaluation harness' };
const config = (extra = {}) => ({ fallbackPrefix: '[EN] ', ...extra });

test('without declarations or stamps, ASCII-only values in a non-Latin locale are errors', () => {
  const { errors } = auditTranslations(source, ja, 'ja', config());
  assert.match(errors.join('\n'), /3 wrong script \(Latin letters only, expected [\w-]+'s script\)/);
});

test('declared protected terms are neither script errors nor echo warnings', () => {
  const { errors, warnings } = auditTranslations(source, ja, 'ja',
    config({ protectedTerms: ['Curtis Forbes', 'Game Day Suits'] }));
  assert.match(errors.join('\n'), /1 wrong script \(Latin letters only, expected [\w-]+'s script\): label/, 'the label is still caught');
  assert.doesNotMatch(warnings.join('\n'), /person|brand/);
});

test('a name the gate settled (TM-stamped echo) is not a script error', () => {
  const settled = new Set(['person', 'brand']);
  const { errors } = auditTranslations(source, ja, 'ja', config(), null, (k) => settled.has(k));
  assert.match(errors.join('\n'), /1 wrong script \(Latin letters only, expected [\w-]+'s script\): label/);
});
