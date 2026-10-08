/**
 * The register-corpus card states each term once, and truly (release blocker
 * for 0.4.0; Round 14, synthetic researcher persona).
 *
 * A local-only CC-BY-2.0 test set registered with `champollion network
 * register-corpus --data …` got a card that contradicted itself:
 *   - redistribution: license.redistribution true AND
 *     usageRestrictions.redistribution "prohibited" (the exposure tier written
 *     as a licence term) — `mt-eval contest prepare` read the second and told
 *     the organizer not to release a CC-BY-2.0 dev set;
 *   - training three ways: license.aiTraining null, doNotTrain true ("must
 *     not"), usageRestrictions.training "discouraged" ("not prohibited");
 *   - license.notes called the standard SPDX id CC-BY-2.0 "Custom/unconfirmed".
 * Now: the licence as given (recognised as standard SPDX when it is one);
 * redistribution from the licence only; the local-only mark a SEPARATE field
 * (`transmission`); training as doNotTrain, with usageRestrictions.training
 * saying only who set it.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  resolveLicense, resolveTier, buildCorpusCard, deriveLicenseBlock, redistributionTerm, gatePublicRegistration,
} from '../lib/corpus-registration.mjs';
import { run as registerCorpus } from '../lib/commands/register-corpus.js';

const SCHEMA = JSON.parse(fs.readFileSync(new URL('../shared/schemas/corpora-card.schema.json', import.meta.url), 'utf8'));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'card-terms-'));

const card = (license, tier = 'local-only', extra = {}) => buildCorpusCard({
  id: 'eval-eng-sme-sami-test-v1', name: 'Sami test', description: 'A test set',
  pair: { source: 'eng', target: 'sme' }, publisher: 'Tester',
  licenseOption: resolveLicense(license), tier: resolveTier(tier),
  size: 50, domain: 'general', role: 'test', addedAt: '2026-10-04', ...extra,
});

/** Every top-level key is a schema property, and the enum fields hold schema values. */
function assertSchemaShape(c) {
  for (const k of Object.keys(c)) assert.ok(k in SCHEMA.properties, `"${k}" is not a corpora-card schema property`);
  const ur = SCHEMA.properties.usageRestrictions.properties;
  assert.ok(ur.training.enum.includes(c.usageRestrictions.training), c.usageRestrictions.training);
  assert.ok(ur.commercialUse.enum.includes(c.usageRestrictions.commercialUse), String(c.usageRestrictions.commercialUse));
  assert.ok(ur.redistribution.enum.includes(c.usageRestrictions.redistribution), c.usageRestrictions.redistribution);
  if ('transmission' in c) assert.ok(SCHEMA.properties.transmission.enum.includes(c.transmission));
}

/** No term contradicts another. */
function assertConsistent(c) {
  // Redistribution: the enum says what the licence boolean says.
  assert.equal(c.usageRestrictions.redistribution === 'prohibited', c.license.redistribution === false,
    `redistribution: license ${c.license.redistribution} vs usageRestrictions ${c.usageRestrictions.redistribution}`);
  // Commercial use: stated once, by the licence.
  assert.equal(c.usageRestrictions.commercialUse, null);
  // Training: doNotTrain is the term; the enum agrees with it.
  assert.equal(c.usageRestrictions.training === 'permitted', c.doNotTrain === false);
  assert.notEqual(c.usageRestrictions.training, 'discouraged', '"discouraged" (not prohibited) contradicts doNotTrain: true');
}

describe('the licence as given', () => {
  it('a standard SPDX id outside the picklist is recorded as standard, with its own terms — never "custom/unconfirmed"', () => {
    for (const [spdx, commercial, redistribution] of [
      ['CC-BY-2.0', true, true], ['CC-BY-SA-3.0', true, true], ['MIT', true, true],
      ['CC-BY-NC-3.0', false, true], ['CC-BY-NC-ND-3.0', false, true], ['CC-BY-ND-3.0', true, true],
    ]) {
      const o = resolveLicense(spdx);
      assert.equal(o.custom, undefined, spdx);
      assert.equal(o.standard, true, spdx);
      assert.equal(o.commercial, commercial, spdx);
      assert.equal(o.redistribution, redistribution, spdx);
      assert.equal(deriveLicenseBlock(o).notes, null, `${spdx}: no "custom/unconfirmed" note`);
    }
  });

  it('an id the licence gate does not know, or any LicenseRef-, stays custom/unconfirmed and fails safe', () => {
    for (const spdx of ['Weird-Custom-1.0', 'LicenseRef-Ward-Terms', 'ODbL-1.0']) {
      const o = resolveLicense(spdx);
      assert.equal(o.custom, true, spdx);
      assert.equal(o.redistribution, false, spdx);
      assert.equal(o.publicEligible, false, spdx);
      assert.match(deriveLicenseBlock(o).notes, /unconfirmed/i, spdx);
    }
  });

  it('CC-BY-NC-4.0 lets others share non-commercially — redistribution true — and is still kept out of the public lane', () => {
    const o = resolveLicense('cc-by-nc-4.0');
    assert.equal(o.redistribution, true);
    assert.equal(o.commercial, false);
    assert.equal(gatePublicRegistration(o).allowed, false);
    assert.equal(redistributionTerm(deriveLicenseBlock(o)), 'same-terms');
  });
});

describe('the card states each term once, and truly', () => {
  it('the Round 14 card: local-only CC-BY-2.0 test set', () => {
    const c = card('CC-BY-2.0');
    assertSchemaShape(c);
    assertConsistent(c);
    assert.equal(c.license.spdx, 'CC-BY-2.0');
    assert.equal(c.license.redistribution, true);
    assert.equal(c.usageRestrictions.redistribution, 'permitted', 'the licence allows it; the tier is not a licence term');
    assert.equal(c.license.notes, null);
    // The local-only mark: its own field.
    assert.equal(c.transmission, 'local-only');
    assert.equal(c.exposureTier, 'local-only');
    // Training: doNotTrain, and who set it (the registrant, not the licence).
    assert.equal(c.doNotTrain, true);
    assert.equal(c.usageRestrictions.training, 'prohibited-by-community');
  });

  it('holds for every picklist licence and every tier', () => {
    for (const license of ['cc-by-4.0', 'cc-by-sa-4.0', 'cc0-1.0', 'cc-by-nc-4.0', 'cc-by-nc-sa-4.0', 'cc-by-nd-4.0',
      'community-eval-grant', 'community-eval-grant-nc', 'proprietary', 'other', 'CC-BY-2.0']) {
      for (const tier of ['local-only', 'private']) {
        const c = card(license, tier);
        assertSchemaShape(c);
        assertConsistent(c);
        assert.equal('transmission' in c, tier === 'local-only', `${license}/${tier}`);
      }
    }
  });

  it('a licence that refuses training makes doNotTrain true, and says the licence set it', () => {
    const c = card('community-eval-grant', 'private', { doNotTrain: false });
    assert.equal(c.doNotTrain, true);
    assert.equal(c.usageRestrictions.training, 'prohibited-by-license');
  });

  it('a non-commercial licence does not claim to prohibit training (NC says nothing about it)', () => {
    const c = card('cc-by-nc-4.0', 'private');
    assert.equal(c.usageRestrictions.training, 'prohibited-by-community');
    assert.equal(card('cc-by-nc-4.0', 'private', { doNotTrain: false }).usageRestrictions.training, 'permitted');
  });

  it('proprietary: redistribution prohibited, by the licence', () => {
    const c = card('proprietary');
    assert.equal(c.license.redistribution, false);
    assert.equal(c.usageRestrictions.redistribution, 'prohibited');
  });

  it('a private registration of a file already marked local-only keeps the mark on the card', () => {
    assert.equal(card('cc-by-4.0', 'private', { transmission: 'local-only' }).transmission, 'local-only');
  });
});

describe('register-corpus --data, end to end', () => {
  it('writes one consistent card, and the summary says each term once', async () => {
    const d = tmp();
    const data = path.join(d, 'test.tsv');
    fs.writeFileSync(data, 'hello\tbures\nthanks\tgiitu\n');
    const lines = [];
    const orig = console.log;
    console.log = (...a) => lines.push(a.join(' '));
    let code;
    try {
      code = await registerCorpus({
        _: ['register-corpus'], yes: true, data, name: 'Sami test', pair: 'eng>sme', license: 'CC-BY-2.0',
        tier: 'local-only', domain: 'general', role: 'test', contamination: 'MEDIUM',
      }, d);
    } finally {
      console.log = orig;
    }
    assert.equal(code, 0, lines.join('\n'));
    const c = JSON.parse(fs.readFileSync(path.join(d, 'eval-eng-sme-sami-test-v1.json'), 'utf8'));
    assertSchemaShape(c);
    assertConsistent(c);
    assert.equal(c.transmission, 'local-only');
    const side = JSON.parse(fs.readFileSync(`${data}.champollion.json`, 'utf8'));
    assert.equal(side.transmission, 'local-only');
    assert.equal(side.license, 'CC-BY-2.0');
    const out = lines.join('\n');
    assert.match(out, /License: {6}CC-BY-2\.0 — commercial use yes, redistribution yes\n/);
    assert.match(out, /Training: {5}not permitted — doNotTrain: true \(set at registration: a test set is not trained on\)/);
    assert.match(out, /Transmission: local-only — only a model on this machine may see it \(a mark, not a licence term\)/);
    assert.doesNotMatch(out, /prohibited|custom|unconfirmed/i);
  });
});
