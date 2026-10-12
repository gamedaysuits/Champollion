/**
 * Flutter / gettext / Java locales use '_' (pt_BR, zh_Hant); BCP 47 and the
 * language cards use '-'. A Flutter "pt_BR" target used to match no card and
 * was translated as a language literally named "pt_BR", with no register.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCode } from '../lib/registers.js';

describe('resolveCode — underscore locales', () => {
  it('resolves pt_BR, zh_Hant, fr_CA exactly as their hyphen forms', () => {
    for (const [u, h] of [['pt_BR', 'pt-BR'], ['zh_Hant', 'zh-Hant'], ['fr_CA', 'fr-CA']]) {
      assert.equal(resolveCode(u), resolveCode(h), u);
      assert.notEqual(resolveCode(u), u, `${u} must reach a card`);
    }
  });
});
