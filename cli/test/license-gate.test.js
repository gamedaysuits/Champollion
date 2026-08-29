/**
 * license-gate test suite — verifies the commercial/redistribution license gate.
 *
 * Pure-function tests (classifyLicense / isPermissiveSpdx / parseDerivedFrom) need
 * no data; the integration tests read the real shared/licenses.json + corrections.
 *
 * @see cli/lib/license-gate.mjs
 * @see shared/license-corrections.json
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  TIERS,
  USE_CONTEXTS,
  isPermissiveSpdx,
  isNonCommercialSpdx,
  classifyLicense,
  classifySource,
  isCommercialSafe,
  isRedistributable,
  isUsageAllowed,
  parseDerivedFrom,
  licenseTag,
  loadLicenseRegister,
} from '../lib/license-gate.mjs';

// ── pure: isPermissiveSpdx ──────────────────────────────────────────────────

describe('isPermissiveSpdx', () => {
  it('accepts permissive licenses', () => {
    for (const s of ['CC-BY-4.0', 'CC-BY-3.0', 'CC0-1.0', 'MIT', 'Apache-2.0', 'Unicode-3.0', 'BSD-3-Clause']) {
      assert.ok(isPermissiveSpdx(s), `${s} should be permissive`);
    }
  });
  it('rejects NC / SA / ND / copyleft / unstated', () => {
    for (const s of ['CC-BY-NC-4.0', 'CC-BY-SA-4.0', 'CC-BY-NC-SA-4.0', 'CC-BY-NC-ND-4.0', 'GPL-3.0-only', 'AGPL-3.0-only', 'UNCONFIRMED', 'LicenseRef-Unstated', 'LicenseRef-OPUS-Mixed', 'LicenseRef-SIL-Terms', 'CC', '']) {
      assert.ok(!isPermissiveSpdx(s), `${s} should NOT be permissive`);
    }
  });
});

// ── pure: classifyLicense ───────────────────────────────────────────────────

describe('classifyLicense (pure)', () => {
  const rec = (license_spdx, extra = {}) => ({ license_spdx, allows_redistribution: 1, ...extra });

  it('tiers each license family and only permissive is safe', () => {
    const cases = [
      ['CC-BY-4.0', TIERS.PERMISSIVE, true, true],
      ['CC0-1.0', TIERS.PERMISSIVE, true, true],
      ['CC-BY-NC-4.0', TIERS.NONCOMMERCIAL, false, false],
      ['CC-BY-SA-4.0', TIERS.SHAREALIKE, false, false],
      ['GPL-3.0-only', TIERS.SHAREALIKE, false, false],
      ['CC-BY-NC-ND-4.0', TIERS.NONCOMMERCIAL, false, false], // NC wins the label; either way unsafe
      ['LicenseRef-SIL-Terms', TIERS.RESTRICTED_NOREDIST, false, false],
      ['LicenseRef-OPUS-Mixed', TIERS.MIXED, false, false],
      ['LicenseRef-Unstated', TIERS.UNSTATED, false, false],
      ['UNCONFIRMED', TIERS.UNSTATED, false, false],
    ];
    for (const [spdx, tier, commercial, redist] of cases) {
      const c = classifyLicense(rec(spdx));
      assert.equal(c.tier, tier, `${spdx} tier`);
      assert.equal(c.commercialSafe, commercial, `${spdx} commercialSafe`);
      assert.equal(c.redistributable, redist, `${spdx} redistributable`);
    }
  });

  it('null record is unknown + restricted (fail-safe)', () => {
    const c = classifyLicense(null);
    assert.equal(c.tier, TIERS.UNKNOWN);
    assert.equal(c.commercialSafe, false);
    assert.equal(c.redistributable, false);
  });

  it('permissive but allows_redistribution=0 is usable-not-redistributable', () => {
    const c = classifyLicense({ license_spdx: 'CC-BY-4.0', allows_redistribution: 0 });
    assert.equal(c.commercialSafe, true);
    assert.equal(c.redistributable, false);
  });

  it('non_commercial_only flag without an -NC SPDX still classifies NonCommercial', () => {
    const c = classifyLicense({ license_spdx: 'LicenseRef-Whatever', non_commercial_only: 1, allows_redistribution: 1 });
    assert.equal(c.tier, TIERS.NONCOMMERCIAL);
    assert.equal(c.commercialSafe, false);
  });

  it('nonCommercialUseAllowed: permissive/NC/SA/ND/SIL allow NC use; mixed/unstated/unknown do not', () => {
    const rec = (license_spdx, extra = {}) => ({ license_spdx, allows_redistribution: 1, ...extra });
    for (const spdx of ['CC-BY-4.0', 'CC-BY-NC-4.0', 'CC-BY-SA-4.0', 'CC-BY-NC-ND-4.0', 'LicenseRef-SIL-Terms']) {
      assert.equal(classifyLicense(rec(spdx)).nonCommercialUseAllowed, true, `${spdx} should allow NC use`);
    }
    for (const spdx of ['LicenseRef-OPUS-Mixed', 'LicenseRef-Unstated', 'UNCONFIRMED']) {
      assert.equal(classifyLicense(rec(spdx)).nonCommercialUseAllowed, false, `${spdx} should NOT allow NC use (fail-safe)`);
    }
    assert.equal(classifyLicense(null).nonCommercialUseAllowed, false);
  });
});

// ── pure: isNonCommercialSpdx ───────────────────────────────────────────────

describe('isNonCommercialSpdx', () => {
  it('detects -NC families and plain noncommercial text', () => {
    for (const s of ['CC-BY-NC-4.0', 'CC-BY-NC-SA-4.0', 'CC-BY-NC-ND-4.0', 'LicenseRef-NonCommercial', 'something non-commercial']) {
      assert.ok(isNonCommercialSpdx(s), `${s} should be NC`);
    }
  });
  it('does not flag permissive / SA / unstated', () => {
    for (const s of ['CC-BY-4.0', 'CC-BY-SA-4.0', 'CC0-1.0', 'MIT', 'LicenseRef-Unstated', '', null, undefined]) {
      assert.ok(!isNonCommercialSpdx(s), `${s} should NOT be NC`);
    }
  });
});

// ── use-based gate: isUsageAllowed (the orthogonal commercial/NC model) ──────

describe('isUsageAllowed (pure tiers via a stub register)', () => {
  // Use real-register sources so we cover the actual classification path.
  //
  // The NC exemplar is dplace-ea, whose own shipped LICENSE file reads
  // "Attribution-NonCommercial 4.0 International" — the strongest evidence
  // class we have. It was `elcat` until 2026-08-01, when the evidence chain
  // (cli/scripts/build-license-evidence.mjs) established ELCat is CC-BY-4.0,
  // not NC: its Zenodo deposit (DOI 10.5281/zenodo.13946786, v2024.1) and its
  // CLDF metadata agree, and the register's CC-BY-NC-4.0 came from
  // pattern-matching. See the dedicated ELCat test below.
  it('an NC source PASSES non-commercial use and is BLOCKED from commercial use', () => {
    assert.equal(isUsageAllowed('dplace-ea', { use_context: USE_CONTEXTS.NON_COMMERCIAL }).allowed, true);
    assert.equal(isUsageAllowed('dplace-ea', { use_context: USE_CONTEXTS.COMMERCIAL }).allowed, false);
  });

  it('an NC source is BLOCKED when redistribution is required, in EITHER context', () => {
    assert.equal(isUsageAllowed('dplace-ea', { redistribution: true }).allowed, false);
    assert.equal(
      isUsageAllowed('dplace-ea', { use_context: USE_CONTEXTS.NON_COMMERCIAL, redistribution: true }).allowed,
      false,
    );
  });

  it('a permissive source is allowed for BOTH contexts and for redistribution', () => {
    for (const ctx of [USE_CONTEXTS.NON_COMMERCIAL, USE_CONTEXTS.COMMERCIAL]) {
      assert.equal(isUsageAllowed('grambank-1.0.3', { use_context: ctx }).allowed, true, `grambank ${ctx}`);
    }
    assert.equal(isUsageAllowed('grambank-1.0.3', { redistribution: true }).allowed, true);
  });

  it('unstated and unknown sources fail safe in EVERY context (incl. non-commercial)', () => {
    for (const src of ['saphon', 'totally-made-up-xyz']) {
      assert.equal(isUsageAllowed(src, { use_context: USE_CONTEXTS.NON_COMMERCIAL }).allowed, false, `${src} NC`);
      assert.equal(isUsageAllowed(src, { use_context: USE_CONTEXTS.COMMERCIAL }).allowed, false, `${src} commercial`);
    }
  });

  it('an unrecognized use_context is treated as commercial (most restrictive)', () => {
    // A typo / undefined context must NOT accidentally open the NC lane.
    assert.equal(isUsageAllowed('dplace-ea', { use_context: 'whatever' }).allowed, false);
    assert.equal(isUsageAllowed('dplace-ea', {}).reason.length > 0, true);
  });

  it('champollion-derived honors the use context across its upstreams', () => {
    // NC upstream (dplace-ea): allowed non-commercial, blocked commercial.
    assert.equal(isUsageAllowed('champollion-derived', { derivedFrom: ['dplace-ea'], use_context: USE_CONTEXTS.NON_COMMERCIAL }).allowed, true);
    assert.equal(isUsageAllowed('champollion-derived', { derivedFrom: ['dplace-ea'], use_context: USE_CONTEXTS.COMMERCIAL }).allowed, false);
    // Permissive upstream: allowed in both.
    assert.equal(isUsageAllowed('champollion-derived', { derivedFrom: ['grambank-1.0.3'], use_context: USE_CONTEXTS.COMMERCIAL }).allowed, true);
    // No provenance: fail-safe restricted.
    assert.equal(isUsageAllowed('champollion-derived', { use_context: USE_CONTEXTS.NON_COMMERCIAL }).allowed, false);
  });
});

// ── pure: parseDerivedFrom ──────────────────────────────────────────────────

describe('parseDerivedFrom', () => {
  it('extracts upstreams from derived-fact notes', () => {
    assert.deepEqual(parseDerivedFrom('Median of 4 PHOIBLE inventories [derived from phoible-2.0]'), ['phoible-2.0']);
    assert.deepEqual(parseDerivedFrom('Composite [derived from grambank-1.0.3]'), ['grambank-1.0.3']);
    assert.deepEqual(parseDerivedFrom('no marker here'), []);
    assert.deepEqual(parseDerivedFrom(null), []);
  });
});

// ── integration: real register (shared/licenses.json + corrections) ─────────

describe('license gate over the real register', () => {
  it('loads a non-trivial register', () => {
    assert.ok(loadLicenseRegister().size > 200);
  });

  it('NonCommercial sources are NOT commercial-safe (D-PLACE, NLLB, Grollemund, ElCat)', () => {
    // grollemundbantu added 2026-08-01: its Zenodo deposit declares
    // CC-BY-NC-4.0 while the register said CC-BY-4.0 with
    // non_commercial_only = 0 — a non-commercial dataset recorded as
    // unrestricted, cited by 324 language cards.
    for (const s of ['dplace-ea', 'meta-nllb-200', 'grollemundbantu', 'elcat']) {
      assert.equal(isCommercialSafe(s), false, `${s} must be excluded from the commercial lane`);
      assert.equal(isRedistributable(s), false, `${s} must not be bulk-redistributed`);
    }
  });

  it('ShareAlike (segbo) and no-redistribution (SIL) are not safe', () => {
    assert.equal(classifySource('segbo').tier, TIERS.SHAREALIKE);
    assert.equal(isCommercialSafe('segbo'), false);
    assert.equal(isRedistributable('sil-iso639-3'), false);
  });

  it('license-unstated sources (saphon) are labelled unstated and excluded', () => {
    assert.equal(classifySource('saphon').tier, TIERS.UNSTATED);
    assert.equal(isCommercialSafe('saphon'), false);
  });

  it('resolved permissive sources ARE safe (grambank, glottolog, lapsyd, petersonsouthasia)', () => {
    for (const s of ['grambank-1.0.3', 'glottolog-5.0', 'lapsyd', 'petersonsouthasia']) {
      assert.equal(isCommercialSafe(s), true, `${s} should be commercial-safe`);
      assert.equal(isRedistributable(s), true, `${s} should be redistributable`);
    }
  });

  it('unknown source fails safe (restricted)', () => {
    assert.equal(isCommercialSafe('totally-made-up-xyz'), false);
    assert.equal(classifySource('totally-made-up-xyz').tier, TIERS.UNKNOWN);
  });

  it('champollion-derived inherits its upstream license', () => {
    // safe upstream → safe; restricted upstream → restricted; no provenance → restricted
    assert.equal(isCommercialSafe('champollion-derived', { derivedFrom: ['grambank-1.0.3'] }), true);
    assert.equal(isCommercialSafe('champollion-derived', { derivedFrom: ['phoible-2.0'] }), false); // PHOIBLE is ShareAlike
    assert.equal(isCommercialSafe('champollion-derived', { derivedFrom: ['dplace-ea'] }), false);    // D-PLACE EA is NC
    assert.equal(isCommercialSafe('champollion-derived', {}), false);                                // unknown provenance
  });

  // ── the 2026-08-01 evidence corrections ────────────────────────────────
  //
  // These four were wrong in shared/licenses.json because populate-licenses.mjs
  // pattern-matched the licence string instead of reading it. Each is now
  // resolved from a recorded upstream statement by
  // cli/scripts/build-license-evidence.mjs. Pinning them here is what stops a
  // register regen quietly restoring the old values.

  it('grollemundbantu is NON-COMMERCIAL (was recorded as CC-BY, unrestricted)', () => {
    // Zenodo deposit declares cc-by-nc-4.0. 324 language cards cite it.
    assert.equal(classifySource('grollemundbantu').tier, TIERS.NONCOMMERCIAL);
    assert.equal(isCommercialSafe('grollemundbantu'), false);
  });

  it('nts carries its NoDerivatives clause and is NOT redistributable', () => {
    // Zenodo says cc-by-nc-nd-2.0; the CLDF metadata says by-nc/2.0. Upstreams
    // disagree, so the most restrictive reading governs and both are recorded.
    // The old toSpdx() had no -nd branch at all, so ND vanished and the entry
    // shipped with allows_redistribution = 1.
    assert.equal(classifySource('nts').license_spdx, 'CC-BY-NC-ND-2.0');
    assert.equal(isRedistributable('nts'), false);
  });

  it('elcat stays NON-COMMERCIAL even though upstream grants CC-BY-4.0', () => {
    // The evidence layer must never LOOSEN a standing determination. ELCat's
    // correction _basis records the reasoning explicitly: the CC-BY-4.0 grant
    // was already known, and NonCommercial was chosen as "a conservative,
    // sovereignty-aware call (endangered-language data)". Binding ourselves
    // more tightly than a licence requires is always ours to choose; an
    // evidence layer that silently repealed it would be exactly the quiet
    // loosening this audit exists to prevent. 5,560 language cards cite ELCat.
    const rec = loadLicenseRegister().get('elcat');
    assert.equal(rec.license_spdx, 'CC-BY-NC-4.0', 'our determination governs');
    assert.equal(isCommercialSafe('elcat'), false);
    // …and the upstream grant is still RECORDED, so the gap between what we may
    // do and what we choose to do stays visible rather than being lost.
    assert.equal(rec._upstreamSpdx, 'CC-BY-4.0');
    assert.equal(rec._moreRestrictiveThanUpstream, true);
  });

  it('segbo resolves from the LICENSE file the register said did not exist', () => {
    // shared/licenses.json note: "No LICENSE file found in GitHub repo."
    // cli/data/segbo/LICENSE.txt: "Attribution-ShareAlike 4.0 International".
    assert.equal(classifySource('segbo').license_spdx, 'CC-BY-SA-4.0');
  });

  it('licenseTag yields a human attribution label with the license', () => {
    const tag = licenseTag('dplace-ea');
    assert.match(tag.label, /CC-BY-NC/);
    assert.equal(tag.tier, TIERS.NONCOMMERCIAL);
  });
});
