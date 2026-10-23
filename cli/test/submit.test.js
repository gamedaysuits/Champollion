/**
 * submit test suite — verifies the declarative model + the `champollion submit`
 * command behind Champollion's REVIEW-GATED community submission path.
 *
 * Pure-function tests need no I/O. A parity test asserts the lib field ids stay
 * in lockstep with the GitHub issue forms (.github/ISSUE_TEMPLATE/*.yml), since
 * the issue-form pre-fill query params are keyed by those ids. The end-to-end
 * tests drive the command with captured stdout and TEMP files only — they never
 * write anywhere tracked, never hit the network, and never auto-approve.
 *
 * @see cli/lib/submit.mjs
 * @see cli/lib/commands/submit.js
 * @see .github/ISSUE_TEMPLATE/
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SUBMISSION_TYPES,
  ATTESTATION_TEXT,
  DEFAULT_REPO_BASE,
  resolveType,
  repoBaseFromRepository,
  validateSubmission,
  buildIssueUrl,
  buildSubmissionRecord,
} from '../lib/submit.mjs';
import { run as submit } from '../lib/commands/submit.js';

const TEMPLATE_DIR = fileURLToPath(new URL('../../.github/ISSUE_TEMPLATE/', import.meta.url));

// Capture console.log/error output around an async fn (the command writes there).
async function capture(fn) {
  const out = [];
  const err = [];
  const ol = console.log;
  const oe = console.error;
  console.log = (...a) => out.push(a.join(' '));
  console.error = (...a) => err.push(a.join(' '));
  let code;
  try {
    code = await fn();
  } finally {
    console.log = ol;
    console.error = oe;
  }
  return { code, out: out.join('\n'), err: err.join('\n') };
}

const tmp = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

// ── catalog ───────────────────────────────────────────────────────────────

describe('SUBMISSION_TYPES catalog', () => {
  it('offers exactly the six submission types', () => {
    assert.deepEqual(
      SUBMISSION_TYPES.map((t) => t.key),
      ['dataset', 'resource', 'method', 'human-service', 'external-result', 'card-correction'],
    );
  });
  it('every type carries a required attestation bool field with the canonical text', () => {
    for (const t of SUBMISSION_TYPES) {
      const att = t.fields.find((f) => f.id === 'attestation');
      assert.ok(att, `${t.key} missing attestation`);
      assert.equal(att.kind, 'bool');
      assert.equal(att.required, true);
      assert.equal(att.label, ATTESTATION_TEXT);
    }
  });
  it('every type has exactly one primary field (for the issue title)', () => {
    for (const t of SUBMISSION_TYPES) {
      assert.equal(t.fields.filter((f) => f.primary).length, 1, `${t.key} primary count`);
    }
  });
  it('the human-service type also requires a provider-consent confirmation', () => {
    const hs = SUBMISSION_TYPES.find((t) => t.key === 'human-service');
    const consent = hs.fields.find((f) => f.id === 'consent');
    assert.ok(consent && consent.kind === 'bool' && consent.required === true);
  });
});

// ── parity with the GitHub issue forms ──────────────────────────────────────

describe('issue-form parity (.mjs ids ↔ .yml ids)', () => {
  // Lightweight: pull every `id:` key out of the form YAML (no YAML dep needed).
  function formIds(file) {
    const text = fs.readFileSync(path.join(TEMPLATE_DIR, file), 'utf-8');
    const ids = [];
    for (const m of text.matchAll(/^\s+id:\s*([A-Za-z0-9-]+)\s*$/gm)) ids.push(m[1]);
    return ids;
  }
  it('each type points at an existing template file', () => {
    for (const t of SUBMISSION_TYPES) {
      assert.ok(fs.existsSync(path.join(TEMPLATE_DIR, t.template)), `${t.template} missing`);
    }
  });
  it('every field id appears as an id in the matching issue form (same set & order)', () => {
    for (const t of SUBMISSION_TYPES) {
      assert.deepEqual(
        t.fields.map((f) => f.id),
        formIds(t.template),
        `field ids drifted for ${t.key} (${t.template})`,
      );
    }
  });
  it('config.yml exists and disables nothing required for intake', () => {
    const cfg = fs.readFileSync(path.join(TEMPLATE_DIR, 'config.yml'), 'utf-8');
    assert.match(cfg, /contact_links:/);
    assert.match(cfg, /submit-to-the-index/);
  });
});

// ── resolveType ─────────────────────────────────────────────────────────────

describe('resolveType', () => {
  it('resolves by key, alias, label and 1-based number', () => {
    assert.equal(resolveType('dataset').key, 'dataset');
    assert.equal(resolveType('benchmark').key, 'dataset');
    assert.equal(resolveType('fst').key, 'resource');
    assert.equal(resolveType('engine').key, 'method');
    assert.equal(resolveType('translator').key, 'human-service');
    assert.equal(resolveType('published').key, 'external-result');
    assert.equal(resolveType('1').key, 'dataset');
    assert.equal(resolveType('Translation method').key, 'method');
  });
  it('returns null for empty / unknown input', () => {
    assert.equal(resolveType(''), null);
    assert.equal(resolveType(undefined), null);
    assert.equal(resolveType('nonsense'), null);
    assert.equal(resolveType('99'), null);
  });
});

// ── repoBaseFromRepository ──────────────────────────────────────────────────

describe('repoBaseFromRepository', () => {
  it('normalizes a git+https package.json repository url', () => {
    assert.equal(
      repoBaseFromRepository('git+https://github.com/gamedaysuits/Champollion.git'),
      'https://github.com/gamedaysuits/Champollion',
    );
  });
  it('normalizes an ssh remote', () => {
    assert.equal(
      repoBaseFromRepository('git@github.com:gamedaysuits/Champollion.git'),
      'https://github.com/gamedaysuits/Champollion',
    );
  });
  it('falls back to the default for empty / non-GitHub input', () => {
    assert.equal(repoBaseFromRepository(''), DEFAULT_REPO_BASE);
    assert.equal(repoBaseFromRepository('https://gitlab.com/x/y'), DEFAULT_REPO_BASE);
  });
});

// ── validateSubmission ──────────────────────────────────────────────────────

describe('validateSubmission', () => {
  const dataset = resolveType('dataset');
  it('passes a complete, attested dataset submission', () => {
    const v = validateSubmission(dataset, {
      'dataset-name': 'X', pairs: 'eng-crk', license: 'CC-BY-4.0',
      'source-url': 'https://x', attestation: true,
    });
    assert.equal(v.ok, true, v.errors.join('; '));
  });
  it('collects every missing required field', () => {
    const v = validateSubmission(dataset, { attestation: true });
    assert.equal(v.ok, false);
    assert.ok(v.errors.some((e) => /dataset-name/.test(e)));
    assert.ok(v.errors.some((e) => /pairs/.test(e)));
    assert.ok(v.errors.some((e) => /source-url/.test(e)));
  });
  it('BLOCKS a submission whose attestation is not affirmatively true', () => {
    const base = { 'dataset-name': 'X', pairs: 'eng-crk', license: 'CC-BY-4.0', 'source-url': 'https://x' };
    assert.equal(validateSubmission(dataset, base).ok, false);
    assert.equal(validateSubmission(dataset, { ...base, attestation: false }).ok, false);
    assert.ok(validateSubmission(dataset, base).errors.some((e) => /confirm/i.test(e)));
  });
  it('human-service ALSO requires the provider-consent confirmation', () => {
    const hs = resolveType('human-service');
    const base = { 'display-name': 'Collective', 'provider-type': 'community_org', pairs: 'eng-crk', attestation: true };
    assert.equal(validateSubmission(hs, base).ok, false); // consent missing
    assert.ok(validateSubmission(hs, base).errors.some((e) => /consent/i.test(e)));
    assert.equal(validateSubmission(hs, { ...base, consent: true }).ok, true);
  });
  it('rejects an unknown type', () => {
    assert.equal(validateSubmission(null, {}).ok, false);
  });
});

// ── buildIssueUrl ───────────────────────────────────────────────────────────

describe('buildIssueUrl', () => {
  const type = resolveType('dataset');
  const values = {
    'dataset-name': 'GlobalVoices eng-amh', pairs: 'eng-amh', license: 'CC-BY-4.0',
    'source-url': 'https://globalvoices.org', size: '', attestation: true,
  };
  const url = buildIssueUrl({ type, values, repoBase: 'https://github.com/o/r' });
  it('targets the matching template on the right repo', () => {
    assert.ok(url.startsWith('https://github.com/o/r/issues/new?'));
    assert.match(url, /template=01-dataset\.yml/);
  });
  it('carries the labels and a prefixed title', () => {
    assert.match(url, /labels=submission/);
    const title = new URL(url).searchParams.get('title');
    assert.equal(title, '[Dataset] GlobalVoices eng-amh');
  });
  it('pre-fills non-empty fields but NOT the attestation checkbox or empties', () => {
    const sp = new URL(url).searchParams;
    assert.equal(sp.get('pairs'), 'eng-amh');
    assert.equal(sp.get('license'), 'CC-BY-4.0');
    assert.equal(sp.has('attestation'), false); // checkboxes can't be pre-checked
    assert.equal(sp.has('size'), false);         // empty omitted
  });
  it('defaults the repo base when none is given', () => {
    const u = buildIssueUrl({ type, values });
    assert.ok(u.startsWith(DEFAULT_REPO_BASE + '/issues/new?'));
  });
});

// ── buildSubmissionRecord ───────────────────────────────────────────────────

describe('buildSubmissionRecord', () => {
  it('is content-free, records the attestation, and embeds the issue URL', () => {
    const type = resolveType('external-result');
    const rec = buildSubmissionRecord({
      type,
      values: { 'system-name': 'NLLB-200', pairs: 'eng-crk', dataset: 'FLORES-200', metric: 'chrF++', score: '28.4', citation: 'https://arxiv.org/abs/2207.04672', attestation: true },
      generatedAt: '2026-06-23T00:00:00.000Z',
    });
    assert.equal(rec.champollion_submission, 1);
    assert.equal(rec.type, 'external-result');
    assert.equal(rec.attestation.confirmed, true);
    assert.equal(rec.fields['system-name'], 'NLLB-200');
    assert.ok(!('attestation' in rec.fields), 'bool fields must not leak into fields');
    assert.match(rec.issueUrl, /template=05-external-result\.yml/);
    assert.equal(rec.generatedAt, '2026-06-23T00:00:00.000Z');
    assert.match(rec.review, /not auto-approved/);
  });
  it('records provider_consent only for the human-service type', () => {
    const hs = buildSubmissionRecord({ type: resolveType('human-service'), values: { consent: true, attestation: true } });
    assert.equal(hs.attestation.provider_consent, true);
    const ds = buildSubmissionRecord({ type: resolveType('dataset'), values: { attestation: true } });
    assert.ok(!('provider_consent' in ds.attestation));
  });
});

// ── end-to-end through the command ──────────────────────────────────────────

describe('submit command (e2e)', () => {
  it('--list --json prints the six types and the attestation', async () => {
    const { code, out } = await capture(() => submit({ _: ['submit'], list: true, json: true }, os.tmpdir()));
    assert.equal(code, 0);
    const parsed = JSON.parse(out);
    assert.equal(parsed.types.length, 6);
    assert.equal(parsed.attestation, ATTESTATION_TEXT);
  });

  it('builds a pre-filled issue URL for a complete, attested dataset (json)', async () => {
    const { code, out } = await capture(() => submit({
      _: ['submit'], yes: true, json: true, type: 'dataset', attest: true,
      field: ['dataset-name=GlobalVoices eng-amh', 'pairs=eng-amh', 'license=CC-BY-4.0', 'source-url=https://globalvoices.org'],
    }, os.tmpdir()));
    assert.equal(code, 0);
    const parsed = JSON.parse(out);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.attestationConfirmed, true);
    assert.match(parsed.issueUrl, /github\.com\/.+\/issues\/new\?.*template=01-dataset\.yml/);
    assert.equal(parsed.title, '[Dataset] GlobalVoices eng-amh');
  });

  it('accepts a --values JSON blob and writes a content-free local copy with --out', async () => {
    const dir = tmp('chr-submit-');
    const outFile = path.join(dir, 'submission.json');
    const { code } = await capture(() => submit({
      _: ['submit'], yes: true, json: true, type: 'external-result', attest: true, out: outFile,
      values: JSON.stringify({ 'system-name': 'NLLB-200', pairs: 'eng-crk', dataset: 'FLORES-200', metric: 'chrF++', score: '28.4', citation: 'https://arxiv.org/abs/2207.04672' }),
    }, dir));
    assert.equal(code, 0);
    const rec = JSON.parse(fs.readFileSync(outFile, 'utf-8'));
    assert.equal(rec.type, 'external-result');
    assert.equal(rec.attestation.confirmed, true);
    assert.match(rec.issueUrl, /05-external-result\.yml/);
    assert.ok(!('attestation' in rec.fields));
  });

  it('BLOCKS an unattested submission (exit 1, no URL)', async () => {
    const { code, err } = await capture(() => submit({
      _: ['submit'], yes: true, json: true, type: 'dataset',
      field: ['dataset-name=X', 'pairs=eng-crk', 'license=CC-BY-4.0', 'source-url=https://x'],
    }, os.tmpdir()));
    assert.equal(code, 1);
    assert.match(err, /attestation is required/i);
  });

  it('BLOCKS a human-service without provider consent (exit 1)', async () => {
    const { code } = await capture(() => submit({
      _: ['submit'], yes: true, json: true, type: 'human-service',
      // attestation true but consent explicitly false
      field: ['display-name=Collective', 'provider-type=community_org', 'pairs=eng-crk', 'attestation=true', 'consent=false'],
    }, os.tmpdir()));
    assert.equal(code, 1);
  });

  it('errors with exit 1 when no type is given non-interactively', async () => {
    const { code } = await capture(() => submit({ _: ['submit'], yes: true, json: true }, os.tmpdir()));
    assert.equal(code, 1);
  });
});
