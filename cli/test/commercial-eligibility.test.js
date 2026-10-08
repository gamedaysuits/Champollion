/**
 * commercial-eligibility.test.js — the routing-time licence gate.
 *
 * What this locks down:
 *   1. The shared method registry is the ONLY source of the verdict for any
 *      method it models — no second table may drift from it again.
 *   2. Unknown is ineligible (fail-safe), and a plugin cannot self-certify
 *      its way out of that.
 *   3. A plugin may RESTRICT but never widen.
 *   4. The non-commercial lane is never gated — the open project is
 *      unaffected by all of the above.
 *   5. getMethod() refuses the route, rather than warning after the fact.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
  resolveCommercialEligibility,
  assertRoutable,
  isCommercialEligible,
  CommercialRouteBlockedError,
} from '../lib/commercial-eligibility.js';
import { getMethod } from '../lib/translate.js';
import { USE_CONTEXTS } from '../lib/license-gate.mjs';

describe('commercial-eligibility: the registry is the source of truth', () => {
  it('clears proprietary commercial engines named in the registry', () => {
    for (const m of ['google-translate', 'deepl', 'microsoft-translator']) {
      const v = resolveCommercialEligibility(m);
      assert.equal(v.eligible, true, `${m} should be eligible`);
      assert.equal(v.source, 'registry');
    }
  });

  it('blocks copyleft engines named in the registry', () => {
    for (const m of ['libretranslate', 'apertium']) {
      const v = resolveCommercialEligibility(m);
      assert.equal(v.eligible, false, `${m} should be blocked`);
      assert.equal(v.source, 'registry');
      assert.match(v.license, /AGPL|GPL/);
    }
  });

  it('resolves a CLI alias to its canonical registry entry', () => {
    // "llm" is the CLI name for the canonical "openrouter" provider.
    const v = resolveCommercialEligibility('llm');
    assert.equal(v.eligible, true);
    assert.equal(v.source, 'registry');
    assert.match(v.reason, /openrouter/);
  });
});

describe('commercial-eligibility: fail-safe defaults', () => {
  it('treats an unknown method as ineligible', () => {
    const v = resolveCommercialEligibility('some-method-we-never-heard-of');
    assert.equal(v.eligible, false);
    assert.equal(v.source, 'unknown');
  });

  it('does NOT let an unknown method self-certify via plugin provenance', () => {
    // The attack this closes: ship a manifest asserting commercialReady and
    // route anything you like through the paid lane.
    const v = resolveCommercialEligibility('some-method-we-never-heard-of', {
      pluginProvenance: { commercialReady: true, resources: [], flags: [] },
    });
    assert.equal(v.eligible, false);
  });

  it('blocks the AGPL FST pipeline and the bare api/external methods', () => {
    for (const m of ['fst-gated', 'api', 'external']) {
      assert.equal(isCommercialEligible(m), false, `${m} should be blocked`);
    }
  });
});

describe('commercial-eligibility: a plugin may restrict, never widen', () => {
  it('lets a plugin block an otherwise-cleared engine', () => {
    const v = resolveCommercialEligibility('google-translate', {
      pluginProvenance: { commercialReady: false, resources: [], flags: [] },
    });
    assert.equal(v.eligible, false);
    assert.equal(v.source, 'plugin');
  });

  it('does not let a plugin clear a registry-blocked engine', () => {
    const v = resolveCommercialEligibility('libretranslate', {
      pluginProvenance: { commercialReady: true, resources: [], flags: [] },
    });
    assert.equal(v.eligible, false);
    assert.equal(v.source, 'registry');
  });
});

describe('commercial-eligibility: assertRoutable', () => {
  it('never blocks the non-commercial lane', () => {
    // The whole open project runs here. AGPL, GPL, unknown — all fine.
    for (const m of ['libretranslate', 'apertium', 'fst-gated', 'who-knows']) {
      assert.doesNotThrow(() => assertRoutable(m));
      assert.doesNotThrow(() => assertRoutable(m, { useContext: USE_CONTEXTS.NON_COMMERCIAL }));
    }
  });

  it('throws a typed, actionable error in the commercial lane', () => {
    assert.throws(
      () => assertRoutable('libretranslate', { useContext: USE_CONTEXTS.COMMERCIAL }),
      (err) => {
        assert.ok(err instanceof CommercialRouteBlockedError);
        assert.equal(err.methodName, 'libretranslate');
        assert.equal(err.verdict.eligible, false);
        // The message has to tell the operator what to do next.
        assert.match(err.message, /non-commercial lane/);
        assert.match(err.message, /AGPL/);
        return true;
      }
    );
  });

  it('passes a cleared engine through the commercial lane', () => {
    const v = assertRoutable('google-translate', { useContext: USE_CONTEXTS.COMMERCIAL });
    assert.equal(v.eligible, true);
  });
});

describe('commercial-eligibility: enforced at routing time in getMethod', () => {
  it('refuses to construct a blocked method for a commercial route', () => {
    assert.throws(
      () => getMethod('libretranslate', { useContext: USE_CONTEXTS.COMMERCIAL }),
      CommercialRouteBlockedError
    );
  });

  it('still constructs that method for the default (non-commercial) route', () => {
    const method = getMethod('libretranslate');
    assert.ok(method, 'non-commercial routing must be unaffected');
  });

  it('refuses an unknown method on licence grounds, not as a typo', () => {
    // Ordering matters: an unrecorded method in a commercial lane is a
    // licence refusal. Reporting "Unknown method — check your config" would
    // invite the operator to "fix" it by adding an adapter.
    assert.throws(
      () => getMethod('mystery-engine', { useContext: USE_CONTEXTS.COMMERCIAL }),
      CommercialRouteBlockedError
    );
  });
});
