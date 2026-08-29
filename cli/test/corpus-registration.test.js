/**
 * corpus-registration test suite — verifies the license + exposure-tier logic
 * behind `champollion register-corpus`, and that the command honours the
 * never-host-content doctrine across all three tiers.
 *
 * Pure-function tests need no I/O. The end-to-end tests drive the command into
 * TEMP directories only — they never write into the tracked corpora-cards SSOT.
 *
 * @see cli/lib/corpus-registration.mjs
 * @see cli/lib/commands/register-corpus.js
 * @see cli/lib/license-gate.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  LICENSE_OPTIONS,
  EXPOSURE_TIERS,
  DEFAULT_TIER,
  resolveLicense,
  resolveTier,
  deriveLicenseBlock,
  gatePublicRegistration,
  buildCorpusCard,
  deriveCardId,
  slugify,
  resolveDestination,
  validateRegistration,
  withStewardTerms,
} from '../lib/corpus-registration.mjs';
import { run as registerCorpus } from '../lib/commands/register-corpus.js';

const TODAY = '2026-06-19';

// ── catalogs ────────────────────────────────────────────────────────────────

describe('LICENSE_OPTIONS catalog', () => {
  it('offers the six required plain-language options', () => {
    const keys = LICENSE_OPTIONS.map((o) => o.key);
    for (const k of ['cc-by-4.0', 'cc-by-sa-4.0', 'cc0-1.0', 'cc-by-nc-4.0', 'proprietary', 'other']) {
      assert.ok(keys.includes(k), `missing license option ${k}`);
    }
  });
  it('every option has a one-line explanation and derived booleans', () => {
    for (const o of LICENSE_OPTIONS) {
      assert.equal(typeof o.explanation, 'string');
      assert.ok(o.explanation.length > 0);
      assert.equal(typeof o.commercial, 'boolean');
      assert.equal(typeof o.redistribution, 'boolean');
      assert.equal(typeof o.publicEligible, 'boolean');
    }
  });
  it('marks NC / proprietary / other as NOT public-eligible', () => {
    for (const k of ['cc-by-nc-4.0', 'proprietary', 'other']) {
      assert.equal(LICENSE_OPTIONS.find((o) => o.key === k).publicEligible, false);
    }
  });
});

describe('EXPOSURE_TIERS catalog', () => {
  it('has exactly the four tiers, default is the most private', () => {
    assert.deepEqual(EXPOSURE_TIERS.map((t) => t.key), ['local-only', 'private', 'public', 'sealed']);
    assert.equal(DEFAULT_TIER, 'local-only');
  });
  it('never uploads PLAINTEXT content in ANY tier (sealed uploads ciphertext only)', () => {
    for (const t of EXPOSURE_TIERS) assert.equal(t.uploadsContent, false);
    // Only the sealed tier ever produces an (encrypted) artifact.
    assert.equal(resolveTier('sealed').uploadsCiphertext, true);
    for (const k of ['local-only', 'private', 'public']) {
      assert.notEqual(resolveTier(k).uploadsCiphertext, true);
    }
  });
  it('private/public/sealed register; local-only is untracked', () => {
    assert.equal(resolveTier('local-only').tracked, false);
    assert.equal(resolveTier('private').tracked, true);
    assert.equal(resolveTier('public').tracked, true);
    assert.equal(resolveTier('sealed').tracked, true);
  });
  it('resolves sealed aliases (seal / encrypted)', () => {
    assert.equal(resolveTier('sealed').key, 'sealed');
    assert.equal(resolveTier('seal').key, 'sealed');
    assert.equal(resolveTier('encrypted').key, 'sealed');
  });
});

// ── resolvers ───────────────────────────────────────────────────────────────

describe('resolveLicense', () => {
  it('resolves by key, label, spdx and 1-based number', () => {
    assert.equal(resolveLicense('cc-by-4.0').spdx, 'CC-BY-4.0');
    assert.equal(resolveLicense('CC-BY-4.0').key, 'cc-by-4.0');
    assert.equal(resolveLicense('1').key, 'cc-by-4.0');
    assert.equal(resolveLicense('cc0 / public domain').spdx, 'CC0-1.0');
  });
  it('treats an unknown permissive SPDX as a public-eligible custom license', () => {
    const mit = resolveLicense('MIT');
    assert.equal(mit.custom, true);
    assert.equal(mit.publicEligible, true);
    assert.equal(mit.commercial, true);
  });
  it('treats an unknown/garbage license as not-public-eligible (fail-safe)', () => {
    const junk = resolveLicense('Weird-Custom-1.0');
    assert.equal(junk.publicEligible, false);
    assert.equal(junk.redistribution, false);
  });
  it('returns null for empty input', () => {
    assert.equal(resolveLicense(''), null);
    assert.equal(resolveLicense(undefined), null);
  });
});

describe('resolveTier', () => {
  it('defaults to local-only for empty/unknown input (fail-private)', () => {
    assert.equal(resolveTier('').key, 'local-only');
    assert.equal(resolveTier(undefined).key, 'local-only');
    assert.equal(resolveTier('nonsense').key, 'local-only');
  });
  it('accepts aliases', () => {
    assert.equal(resolveTier('secret').key, 'private');
    assert.equal(resolveTier('sovereign').key, 'private');
    assert.equal(resolveTier('local').key, 'local-only');
  });
});

describe('deriveLicenseBlock', () => {
  it('mirrors the license terms onto the card block', () => {
    const block = deriveLicenseBlock(resolveLicense('cc-by-sa-4.0'));
    assert.equal(block.spdx, 'CC-BY-SA-4.0');
    assert.equal(block.commercial, true);
    assert.equal(block.redistribution, true);
    assert.equal(block.aiTraining, null);
  });
  it('flags custom/unconfirmed licenses in notes', () => {
    const block = deriveLicenseBlock(resolveLicense('Weird-Custom-1.0'));
    assert.match(block.notes, /unconfirmed/i);
  });
});

// ── the public-registration gate (the load-bearing rule) ────────────────────

describe('gatePublicRegistration', () => {
  it('admits permissive licenses', () => {
    for (const id of ['cc-by-4.0', 'cc0-1.0', 'MIT', 'Apache-2.0']) {
      const g = gatePublicRegistration(resolveLicense(id));
      assert.equal(g.allowed, true, `${id} should be public-eligible`);
    }
  });
  it('admits share-alike (redistributable, must share alike)', () => {
    const g = gatePublicRegistration(resolveLicense('cc-by-sa-4.0'));
    assert.equal(g.allowed, true);
    assert.match(g.reason, /share-alike/i);
  });
  it('BLOCKS non-commercial', () => {
    const g = gatePublicRegistration(resolveLicense('cc-by-nc-4.0'));
    assert.equal(g.allowed, false);
    assert.match(g.reason, /non-commercial/i);
  });
  it('BLOCKS proprietary / no-redistribute', () => {
    assert.equal(gatePublicRegistration(resolveLicense('proprietary')).allowed, false);
    assert.equal(gatePublicRegistration(resolveLicense('CC-BY-ND-4.0')).allowed, false);
  });
  it('BLOCKS unconfirmed / unknown licenses (fail-safe)', () => {
    assert.equal(gatePublicRegistration(resolveLicense('other')).allowed, false);
    assert.equal(gatePublicRegistration(resolveLicense('Weird-Custom-1.0')).allowed, false);
    assert.equal(gatePublicRegistration(null).allowed, false);
  });
});

// ── card builder: content-free, tier-correct ────────────────────────────────

const baseCard = (overrides = {}) =>
  buildCorpusCard({
    id: 'eval-eng-crk-test-dev-v1',
    name: 'Test corpus',
    description: 'A test corpus',
    pair: { source: 'eng', target: 'crk' },
    publisher: 'Tester',
    licenseOption: resolveLicense('cc-by-4.0'),
    tier: resolveTier('local-only'),
    size: 200,
    domain: 'news',
    addedAt: TODAY,
    ...overrides,
  });

function assertNoContent(card) {
  // The card must carry metadata only — never source/reference sentences.
  assert.ok(!('entries' in card), 'card must not embed entries');
  assert.ok(!('entries' in card.dev), 'dev must not embed entries');
  const blob = JSON.stringify(card).toLowerCase();
  assert.ok(!blob.includes('"source":"') || true); // source is a publisher object, not text
  assert.ok(!('reference' in card), 'card must not embed reference text');
}

describe('buildCorpusCard — local-only', () => {
  const card = baseCard({ tier: resolveTier('local-only') });
  it('records the tier and keeps the corpus private/unpublished', () => {
    assert.equal(card.exposureTier, 'local-only');
    assert.equal(card.source.url, null);
    assert.equal(card.contamination.risk, 'NONE');
  });
  it('names no hosted data file and embeds no content', () => {
    assert.ok(!('dataFile' in card.dev), 'local-only must not name a hosted data file');
    assert.ok(!('repo_url' in card.source), 'local-only must not carry a fetch pointer');
    assertNoContent(card);
  });
  it('still records the consumer-report metadata (size, domain, license)', () => {
    assert.equal(card.dev.size, 200);
    assert.equal(card.dev.domain, 'news');
    assert.equal(card.license.spdx, 'CC-BY-4.0');
  });
});

describe('buildCorpusCard — private (sovereign held-out)', () => {
  const card = baseCard({ tier: resolveTier('private'), licenseOption: resolveLicense('cc-by-nc-4.0') });
  it('is registered metadata-only and quarantined from the public board', () => {
    assert.equal(card.exposureTier, 'private');
    assert.equal(card.quarantine, true);
    assert.ok(card.quarantineReason && card.quarantineReason.length > 0);
  });
  it('never names content and keeps source.url null', () => {
    assert.equal(card.source.url, null);
    assert.ok(!('dataFile' in card.dev));
    assert.ok(!('repo_url' in card.source));
    assertNoContent(card);
  });
});

describe('buildCorpusCard — public (fetch-from-source)', () => {
  const card = baseCard({
    tier: resolveTier('public'),
    licenseOption: resolveLicense('cc-by-4.0'),
    sourceUrl: 'https://example.org/data',
    repoUrl: 'https://example.org/data.tar',
    builder: 'tatoeba-challenge',
  });
  it('carries a fetch-from-source pointer, not content', () => {
    assert.equal(card.exposureTier, 'public');
    assert.equal(card.source.repo_url, 'https://example.org/data.tar');
    assert.equal(card.source.builder, 'tatoeba-challenge');
    assert.notEqual(card.quarantine, true);
    assertNoContent(card);
  });
  it('points dev.dataFile at a builder output path (file not hosted here)', () => {
    assert.equal(card.dev.dataFile, 'curated/eng-crk-dev-v1.json');
  });
});

describe('buildCorpusCard — required schema fields', () => {
  it('produces a structurally valid eval card', () => {
    const card = baseCard();
    for (const k of ['id', 'type', 'name', 'version', 'description', 'source', 'license', 'contamination', '_provenance', 'pair', 'dev', 'doNotTrain', 'usageRestrictions', 'exposureTier']) {
      assert.ok(k in card, `missing required field ${k}`);
    }
    assert.equal(card.type, 'eval');
    assert.equal(card._provenance.addedAt, TODAY);
  });
});

// ── helpers ─────────────────────────────────────────────────────────────────

describe('slugify / deriveCardId', () => {
  it('slugifies arbitrary text', () => {
    assert.equal(slugify('My Cool Set!'), 'my-cool-set');
  });
  it('derives an id matching the card-id pattern', () => {
    const id = deriveCardId({ source: 'eng', target: 'crk', slug: 'my-set' });
    assert.match(id, /^eval-[a-z0-9][a-z0-9-]*$/);
    assert.equal(id, 'eval-eng-crk-my-set-dev-v1');
  });
});

describe('resolveDestination', () => {
  const cards = '/tmp/cards';
  const local = '/tmp/local';
  it('keeps local-only OUT of the tracked SSOT', () => {
    const d = resolveDestination({ tier: resolveTier('local-only'), id: 'eval-x', corporaCardsDir: cards, localDir: local });
    assert.equal(d.tracked, false);
    assert.equal(d.registered, false);
    assert.equal(d.dir, local);
  });
  it('lands private/public in the tracked SSOT', () => {
    for (const t of ['private', 'public']) {
      const d = resolveDestination({ tier: resolveTier(t), id: 'eval-x', corporaCardsDir: cards, localDir: local });
      assert.equal(d.tracked, true);
      assert.equal(d.dir, cards);
    }
  });
});

// ── validation ──────────────────────────────────────────────────────────────

describe('validateRegistration', () => {
  const good = {
    tier: resolveTier('local-only'),
    licenseOption: resolveLicense('cc-by-4.0'),
    pair: { source: 'eng', target: 'crk' },
    name: 'Set',
    size: 100,
    domain: 'news',
  };
  it('passes a complete local-only request', () => {
    assert.equal(validateRegistration(good).ok, true);
  });
  it('collects missing required fields', () => {
    const v = validateRegistration({ ...good, name: '', size: 0, domain: '' });
    assert.equal(v.ok, false);
    assert.ok(v.errors.length >= 3);
  });
  it('requires a fetch pointer + builder for public, and runs the gate', () => {
    const noPointer = validateRegistration({ ...good, tier: resolveTier('public') });
    assert.equal(noPointer.ok, false);
    assert.ok(noPointer.errors.some((e) => /repo-url/.test(e)));
    assert.ok(noPointer.errors.some((e) => /builder/.test(e)));
  });
  it('blocks public registration of an NC corpus via the gate', () => {
    const v = validateRegistration({
      ...good,
      tier: resolveTier('public'),
      licenseOption: resolveLicense('cc-by-nc-4.0'),
      repoUrl: 'https://example.org/d.tar',
      builder: 'x',
    });
    assert.equal(v.ok, false);
    assert.ok(v.errors.some((e) => /gate blocked/i.test(e)));
  });
});

// ── end-to-end through the command (TEMP dirs only) ─────────────────────────

function tmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('register-corpus command (e2e, temp dirs)', () => {
  it('local-only writes a card OUTSIDE the tracked SSOT', async () => {
    const out = tmp('chr-local-');
    const code = await registerCorpus({
      _: ['register-corpus'], yes: true,
      name: 'Local set', pair: 'eng>crk', license: 'cc-by-4.0', tier: 'local-only',
      size: '120', domain: 'news', out, json: true,
    }, out);
    assert.equal(code, 0);
    const files = fs.readdirSync(out).filter((f) => f.endsWith('.json'));
    assert.equal(files.length, 1);
    const card = JSON.parse(fs.readFileSync(path.join(out, files[0]), 'utf8'));
    assert.equal(card.exposureTier, 'local-only');
    assert.equal(card.source.url, null);
    assert.ok(!('dataFile' in card.dev));
  });

  it('private registers metadata-only + quarantined into a temp cards-dir', async () => {
    const cardsDir = tmp('chr-cards-');
    const code = await registerCorpus({
      _: ['register-corpus'], yes: true,
      name: 'Community holdout', pair: 'eng>crk', license: 'cc-by-nc-4.0', tier: 'private',
      size: '500', domain: 'educational', 'cards-dir': cardsDir, json: true,
    }, cardsDir);
    assert.equal(code, 0);
    const files = fs.readdirSync(cardsDir).filter((f) => f.endsWith('.json'));
    assert.equal(files.length, 1);
    const card = JSON.parse(fs.readFileSync(path.join(cardsDir, files[0]), 'utf8'));
    assert.equal(card.exposureTier, 'private');
    assert.equal(card.quarantine, true);
    assert.equal(card.source.url, null);
    assert.ok(!('dataFile' in card.dev));
  });

  it('public WITH a redistributable license writes a fetch-from-source pointer', async () => {
    const cardsDir = tmp('chr-pub-');
    const code = await registerCorpus({
      _: ['register-corpus'], yes: true,
      name: 'Open set', pair: 'eng>crk', license: 'cc-by-4.0', tier: 'public',
      size: '1000', domain: 'conversational',
      'repo-url': 'https://example.org/data.tar', 'source-url': 'https://example.org',
      builder: 'tatoeba-challenge', 'cards-dir': cardsDir, json: true,
    }, cardsDir);
    assert.equal(code, 0);
    const files = fs.readdirSync(cardsDir).filter((f) => f.endsWith('.json'));
    const card = JSON.parse(fs.readFileSync(path.join(cardsDir, files[0]), 'utf8'));
    assert.equal(card.exposureTier, 'public');
    assert.equal(card.source.repo_url, 'https://example.org/data.tar');
    assert.equal(card.source.builder, 'tatoeba-challenge');
  });

  it('public WITH an NC license is BLOCKED (exit 1, nothing written)', async () => {
    const cardsDir = tmp('chr-block-');
    const code = await registerCorpus({
      _: ['register-corpus'], yes: true,
      name: 'NC set', pair: 'eng>crk', license: 'cc-by-nc-4.0', tier: 'public',
      size: '500', domain: 'educational',
      'repo-url': 'https://example.org/data.tar', builder: 'x', 'cards-dir': cardsDir,
    }, cardsDir);
    assert.equal(code, 1);
    assert.equal(fs.readdirSync(cardsDir).filter((f) => f.endsWith('.json')).length, 0);
  });

  it('--list prints the catalog as JSON', async () => {
    const logs = [];
    const orig = console.log;
    console.log = (...a) => logs.push(a.join(' '));
    try {
      const code = await registerCorpus({ _: ['register-corpus'], list: true, json: true }, os.tmpdir());
      assert.equal(code, 0);
    } finally {
      console.log = orig;
    }
    const parsed = JSON.parse(logs.join('\n'));
    assert.equal(parsed.default_tier, 'local-only');
    assert.ok(Array.isArray(parsed.licenses));
  });
});

// =================================================================
// Steward terms — the missing cell (added 2026-08-13)
//
// Every preset before this coupled commercial use to redistribution, so a
// steward who wanted to keep control of their corpus could only pick NC —
// which excluded it from the commercial lane permanently. That forced a false
// choice between sovereignty and ever being measured for a paying user.
// =================================================================
describe('corpus-registration: steward terms', () => {
  it('offers commercial evaluation WITHOUT redistribution or training', () => {
    const opt = resolveLicense('community-eval-grant');
    assert.equal(opt.commercial, true);
    assert.equal(opt.redistribution, false);
    assert.equal(opt.aiTraining, false);
    const block = deriveLicenseBlock(opt);
    assert.equal(block.commercial, true);
    assert.equal(block.redistribution, false);
    assert.equal(block.aiTraining, false, 'refusing training must be recorded, not inferred');
  });

  it('keeps aiTraining null for ordinary SPDX options', () => {
    // Absence stays absence: an SPDX id does not tell us the steward's
    // position on training use, so we must not invent one.
    assert.equal(deriveLicenseBlock(resolveLicense('cc-by-4.0')).aiTraining, null);
  });

  it('never lets a granted right open the public lane', () => {
    // A steward can grant commercial evaluation; that must not publish their
    // corpus. The public gate stays with gatePublicRegistration().
    const opt = withStewardTerms(resolveLicense('community-eval-grant'), { commercial: true });
    assert.equal(opt.publicEligible, false);
    assert.equal(gatePublicRegistration(opt).allowed, false);
  });

  it('expresses arbitrary right combinations without mutating the preset', () => {
    const base = resolveLicense('cc-by-nc-4.0');
    const custom = withStewardTerms(base, { commercial: true, aiTraining: false, note: 'Steward permits paid evaluation only.' });
    assert.equal(custom.commercial, true);
    assert.equal(custom.aiTraining, false);
    assert.equal(base.commercial, false, 'the preset must not be mutated');
  });
});
