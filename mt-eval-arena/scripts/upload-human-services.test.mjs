/**
 * Tests for the human-services SSOT + its schema validator.
 *
 * Run with: node --test scripts/upload-human-services.test.mjs
 * (Node's built-in test runner — no dependencies.)
 *
 * Covers the Definition of Done item: the schema validates the example JSON,
 * and rejects malformed rows (so the uploader fails closed).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validate } from './lib/mini-schema.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const SSOT = JSON.parse(readFileSync(join(REPO_ROOT, 'shared', 'human-services.json'), 'utf-8'));
const SCHEMA = JSON.parse(readFileSync(join(REPO_ROOT, 'shared', 'schemas', 'human-services.schema.json'), 'utf-8'));

describe('human-services SSOT', () => {
  it('the committed example JSON validates against the schema', () => {
    const { valid, errors } = validate(SSOT, SCHEMA);
    assert.equal(valid, true, `expected valid, got errors:\n${errors.join('\n')}`);
  });

  it('never carries the PII `contact` field in git', () => {
    for (const s of SSOT) {
      assert.ok(!('contact' in s), `service ${s.service_id} leaks a contact (PII) into the SSOT`);
    }
  });

  it('example rows are non-publishable (pending / not consent-attested)', () => {
    // Seed/template rows must not surface publicly: the RPC requires
    // status=approved AND consent_attested=true.
    for (const s of SSOT) {
      const publishable = s.status === 'approved' && s.consent_attested === true;
      assert.equal(publishable, false, `template ${s.service_id} would publish — must be pending/unattested`);
    }
  });

  it('does not name a real nation/org as custodian (sovereignty)', () => {
    const community = SSOT.filter((s) => s.provider_type === 'community_org');
    for (const s of community) {
      assert.match(
        s.display_name.toLowerCase(),
        /in confirmation|template|example/,
        `community_org ${s.service_id} must use "(in confirmation)" framing, not a named custodian`,
      );
    }
  });
});

describe('schema validator gates', () => {
  it('rejects an unknown enum value for status', () => {
    const bad = [{ ...SSOT[0], status: 'live' }];
    const { valid, errors } = validate(bad, SCHEMA);
    assert.equal(valid, false);
    assert.ok(errors.some((e) => e.includes('status')), errors.join('\n'));
  });

  it('rejects a non-ISO-639-3 language code', () => {
    const bad = [{ ...SSOT[0], target_lang: 'crk-SRO' }];
    const { valid, errors } = validate(bad, SCHEMA);
    assert.equal(valid, false);
    assert.ok(errors.some((e) => e.includes('target_lang')), errors.join('\n'));
  });

  it('rejects a row missing a required field', () => {
    const { service_id, ...withoutId } = SSOT[0];
    const { valid, errors } = validate([withoutId], SCHEMA);
    assert.equal(valid, false);
    assert.ok(errors.some((e) => e.includes('service_id')), errors.join('\n'));
  });

  it('rejects an unexpected additional property', () => {
    const bad = [{ ...SSOT[0], surprise: true }];
    const { valid, errors } = validate(bad, SCHEMA);
    assert.equal(valid, false);
    assert.ok(errors.some((e) => e.includes('surprise')), errors.join('\n'));
  });
});
