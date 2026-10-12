/**
 * The release gate for false refusals: today's quality gate re-judges every
 * translation of champollion.dev already on disk (scripts/gate-audit.mjs) —
 * offline, no model call, no cost. A correct translation the gate refuses is
 * left in the source language for the user, so a gate change that starts
 * refusing accepted output must not ship (2026-10-06: three such bugs).
 *
 * Skips, saying why, where the site's translations are not present.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditSite } from '../scripts/gate-audit.mjs';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'website');
const present = fs.existsSync(path.join(SITE, 'i18n', 'fr')) && fs.existsSync(path.join(SITE, '.champollion-content.lock'));

/** Keep-as-written refusals (a name or citation answered twice) allowed, as a share. */
const MAX_KEEP_AS_WRITTEN = 0.002;

describe('quality gate: false refusals on accepted translations (release gate)', { skip: present ? false : 'the website translations are not in this checkout' }, () => {
  const r = present ? auditSite({ site: SITE }) : null;
  it('audits a real corpus', () => {
    assert.ok(r.pages > 100 && r.blocks > 10000, `${r.pages} pages, ${r.blocks} blocks`);
  });
  it('no hard refusal of a current page — the gate is wrong, or the CLI wrote what its own gate refuses', () => {
    assert.deepEqual(r.hard.map(x => `${x.locale} ${x.page || x.key}${x.paragraph ? ` ¶${x.paragraph}` : ''}: ${x.reason}`), []);
  });
  it(`keep-as-written refusals stay under ${MAX_KEEP_AS_WRITTEN * 100}%`, () => {
    const share = r.keepAsWritten.length / (r.blocks + r.keys);
    assert.ok(share <= MAX_KEEP_AS_WRITTEN, `${r.keepAsWritten.length} of ${r.blocks + r.keys} (${(share * 100).toFixed(3)}%)`);
  });
});
