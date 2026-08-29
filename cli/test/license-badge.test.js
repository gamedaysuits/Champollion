/**
 * license-badge test suite — the pure, browser-safe NC/SA/ND badge helpers used
 * by the leaderboard / mesh / card UIs to surface a corpus's license.
 *
 * @see cli/website/src/utils/licenseBadge.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  isNonCommercialLicense,
  isShareAlikeLicense,
  isNoDerivativesLicense,
  licenseBadges,
} from '../website/src/utils/licenseBadge.js';

describe('isNonCommercialLicense', () => {
  it('detects NC families', () => {
    for (const s of ['CC-BY-NC-4.0', 'CC-BY-NC-SA-4.0', 'CC-BY-NC-ND-4.0', 'LicenseRef-NonCommercial']) {
      assert.ok(isNonCommercialLicense(s), `${s} should be NC`);
    }
  });
  it('does not flag permissive / SA / empty', () => {
    for (const s of ['CC-BY-4.0', 'CC-BY-SA-4.0', 'CC0-1.0', 'MIT', '', null, undefined]) {
      assert.ok(!isNonCommercialLicense(s), `${s} should NOT be NC`);
    }
  });
});

describe('licenseBadges', () => {
  it('emits a prominent research-only NC badge for NC licenses', () => {
    const badges = licenseBadges('CC-BY-NC-4.0');
    const nc = badges.find((b) => b.code === 'nc');
    assert.ok(nc, 'expected an nc badge');
    assert.match(nc.label, /non-commercial \/ research-only/i);
  });

  it('emits NC + SA for CC-BY-NC-SA', () => {
    const codes = licenseBadges('CC-BY-NC-SA-4.0').map((b) => b.code);
    assert.ok(codes.includes('nc'));
    assert.ok(codes.includes('sa'));
  });

  it('emits NO badges for a permissive license', () => {
    assert.deepEqual(licenseBadges('CC-BY-4.0'), []);
    assert.deepEqual(licenseBadges('CC0-1.0'), []);
    assert.deepEqual(licenseBadges(null), []);
  });

  it('flags NoDerivatives', () => {
    assert.ok(isNoDerivativesLicense('CC-BY-ND-4.0'));
    assert.ok(licenseBadges('CC-BY-ND-4.0').some((b) => b.code === 'nd'));
  });

  it('flags ShareAlike / copyleft', () => {
    assert.ok(isShareAlikeLicense('GPL-3.0-only'));
    assert.ok(isShareAlikeLicense('CC-BY-SA-4.0'));
  });
});
