/**
 * website-gate-copy.test.js — the pre-launch gate page is the only
 * champollion.dev page a stranger can reach, so it must say what the rest of
 * the site says. Revision 2 (2026-10, "on rails, with guardrails") reworded
 * the English tagline, two paragraphs and the agent prompt; a translation made
 * before that must not show its old claim (a language count, "open
 * translation infrastructure") — gateCopy() falls back to the English wording
 * for those keys until the locale's entry says rev 2.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { websiteOnly } from './repo-context.js';

const { gateCopy } = websiteOnly ? {} : await import('../website/middleware.js');
const { SITE_LOCALES } = websiteOnly ? {} : await import('../website/geo-locale.js');

const REWORDED = ['tagline', 'p1', 'p2', 'agentPrompt'];

describe('the gate page copy', { skip: websiteOnly }, () => {
  it('the English copy leads with the rails and gives no language count', () => {
    const en = gateCopy('en');
    // the founder's one phrase (2026-10-12) — never split into a separate
    // "On rails, with guardrails." line
    assert.equal(en.tagline, 'Machine translation development and deployment on rails with guardrails.');
    for (const k of Object.keys(en)) {
      assert.doesNotMatch(String(en[k]), /On rails, with guardrails/, k);
      assert.doesNotMatch(String(en[k]), /\d[\d,]*\+? languages/i, k);
      assert.doesNotMatch(String(en[k]), /universal translator|open translation infrastructure/i, k);
    }
  });

  it('a translation that predates revision 2 shows the English wording for the reworded keys', () => {
    const en = gateCopy('en');
    for (const l of SITE_LOCALES) {
      const c = gateCopy(l);
      for (const k of REWORDED) {
        if ((c.rev || 1) < 2) assert.equal(c[k], en[k], `${l}.${k}`);
        assert.doesNotMatch(String(c[k]), /\d[\d,]*\+/, `${l}.${k} carries a count`);
      }
      assert.ok(c.heading && c.button, `${l}: the unchanged keys stay translated`);
    }
  });
});
