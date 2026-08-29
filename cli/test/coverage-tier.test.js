/**
 * coverage-tier — the hero's three-state green/green/red frame is honest.
 *
 * The bug this pins (founder 2026-07-19, "the map must be true"): Inga (`inb`)
 * and a spread of Quechua varieties rendered as flat "covered by MT providers"
 * green when NO deployed service ships them — they are green only because an
 * OPEN research model (MADLAD-400) lists their codes. The fix draws a deployed
 * service (bright green + core) differently from "listed by an open research
 * model only" (dim green), computed from each language's own coverage bitmask.
 *
 * Two invariants are load-bearing and guarded here:
 *   1. coverageTier(mask) classifies by COMMERCIAL_MASK / OPEN_MASK exactly.
 *   2. The coverage join is EXACT-CODE, never macrolanguage/family fan-out:
 *      a provider listing the macrolanguage `que` must NOT make its 44 SIL
 *      member varieties (`quz`, `quy`, `inb`… ) service-covered. That table
 *      (cli/data/iso639-3/iso-639-3-macrolanguages.tab) is the latent
 *      blast-radius multiplier — nothing must ever join coverage against it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import pairReachability from '../website/src/utils/pairReachability.js';

const {COMMERCIAL_MASK, OPEN_MASK, coverageTier} = pairReachability;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const COVERAGE = path.join(ROOT, 'shared', 'catalogue', 'method-coverage.json');
const MACRO_TAB = path.join(ROOT, 'cli', 'data', 'iso639-3', 'iso-639-3-macrolanguages.tab');

// key → bit, mirroring METHOD_BITS in plugins/shared-data/generateGraphJson.js
// (the same bits pairReachability's COMMERCIAL_MASK/OPEN_MASK are built from).
//
// Keyed by the METHOD-REGISTRY ID. It used to use short names (`google`,
// `microsoft`, `libre`) and so did the site plugin and a six-row table in the
// Python ranker — three copies of one mapping, which is how Apertium ended up
// with a runtime adapter and no coverage anywhere. The registry id is now the
// single identity, and the assertion below fails loudly if this list drifts
// from the register again rather than silently zeroing a mask.
const BIT = {
  'google-translate': 1, 'microsoft-translator': 2, deepl: 4, libretranslate: 8, // COMMERCIAL
  nllb: 16, opus: 32, tilde: 64, m2m100: 256, madlad: 512, // OPEN
  translated: 128, // reserved commercial — no list yet
};

test('every key this test masks on still exists in the coverage register', () => {
  // A silently-unmatched key contributes a zero mask, so every downstream
  // assertion here would pass while measuring nothing. That is worse than a
  // failure, and it is exactly what a rekey does if nobody checks.
  const cov = JSON.parse(fs.readFileSync(COVERAGE, 'utf-8'));
  const present = new Set((cov.methods || []).map((m) => m.key));
  for (const key of Object.keys(BIT)) {
    assert.ok(
      present.has(key),
      `BIT maps "${key}" but method-coverage.json has no such key. Keys are `
      + `method-registry ids; the register has: ${[...present].sort().join(', ')}`,
    );
  }
});

function buildMaskByCode() {
  const cov = JSON.parse(fs.readFileSync(COVERAGE, 'utf-8'));
  const maskByCode = new Map();
  for (const m of cov.methods || []) {
    const bit = BIT[m.key];
    if (!bit) continue;
    for (const raw of m.iso6393 || []) {
      const code = String(raw).trim().toLowerCase();
      if (!/^[a-z]{3}$/.test(code)) continue;
      maskByCode.set(code, (maskByCode.get(code) || 0) | bit);
    }
  }
  return maskByCode;
}

test('coverageTier classifies by COMMERCIAL_MASK / OPEN_MASK', () => {
  assert.equal(coverageTier(0), 0, 'no bits → uncovered');
  assert.equal(coverageTier(1), 2, 'a commercial bit → service tier');
  assert.equal(coverageTier(COMMERCIAL_MASK), 2);
  assert.equal(coverageTier(16), 1, 'an open bit only → open tier');
  assert.equal(coverageTier(OPEN_MASK), 1);
  assert.equal(coverageTier(512), 1, 'MADLAD alone → open tier');
  assert.equal(coverageTier(1 | 512), 2, 'service wins over open when both present');
});

test('Inga and the open-only Quechua varieties are tier 1, never service', () => {
  const mask = buildMaskByCode();
  // These are green today ONLY because MADLAD-400 / NLLB list their codes —
  // no deployed service ships them. They must render dim (tier 1), never
  // bright (tier 2). `inb` is the founder's canonical example.
  for (const code of ['inb', 'qub', 'quh', 'quy', 'qvc', 'qvi', 'qxr']) {
    const m = mask.get(code) || 0;
    assert.ok(m !== 0, `${code}: should be covered by SOME open model`);
    assert.equal(coverageTier(m), 1, `${code}: open-model-only, must be tier 1`);
    assert.ok(!(m & COMMERCIAL_MASK), `${code}: no deployed service lists it`);
  }
});

test('the Quechua macrolanguage `que` is deployed-service covered (Google)', () => {
  const mask = buildMaskByCode();
  const m = mask.get('que') || 0;
  assert.ok(m & COMMERCIAL_MASK, '`que` is listed by a deployed service');
  assert.equal(coverageTier(m), 2);
});

test('EXACT-CODE join: a service `que` never fans out to its member varieties', () => {
  // Load the 44 SIL members of macrolanguage `que`. `que` is service-covered
  // (Google); if coverage ever expanded macro→members, every member would go
  // bright green from that one entry. Assert NO member is service-covered
  // unless a service literally lists that member's own code (none do today).
  const mask = buildMaskByCode();
  const cov = JSON.parse(fs.readFileSync(COVERAGE, 'utf-8'));
  const serviceCodes = new Set();
  for (const meth of cov.methods || []) {
    if (!(BIT[meth.key] & COMMERCIAL_MASK)) continue;
    for (const raw of meth.iso6393 || []) serviceCodes.add(String(raw).trim().toLowerCase());
  }
  const members = [];
  for (const line of fs.readFileSync(MACRO_TAB, 'utf-8').split('\n')) {
    const [macro, member] = line.split('\t');
    if (macro === 'que' && member) members.push(member.trim().toLowerCase());
  }
  assert.ok(members.length >= 40, `expected the que macrolanguage members (got ${members.length})`);
  for (const member of members) {
    const litService = coverageTier(mask.get(member) || 0) === 2;
    assert.equal(
      litService,
      serviceCodes.has(member),
      `${member}: service-tier iff its OWN code is in a service list — no macro fan-out`,
    );
  }
});

test('tier invariant: service-tier ⟺ own code is in a COMMERCIAL provider list', () => {
  const mask = buildMaskByCode();
  const cov = JSON.parse(fs.readFileSync(COVERAGE, 'utf-8'));
  const serviceCodes = new Set();
  for (const meth of cov.methods || []) {
    if (!(BIT[meth.key] & COMMERCIAL_MASK)) continue;
    for (const raw of meth.iso6393 || []) serviceCodes.add(String(raw).trim().toLowerCase());
  }
  for (const [code, m] of mask) {
    assert.equal(
      coverageTier(m) === 2,
      serviceCodes.has(code),
      `${code}: bright-green iff a deployed service lists this exact code`,
    );
  }
});
