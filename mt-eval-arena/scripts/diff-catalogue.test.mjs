/**
 * diff-catalogue.test.mjs — contract tests for the Gate-1 verification
 * artifact (node --test scripts/diff-catalogue.test.mjs).
 *
 * Fixture-driven: builds tiny baseline/staging catalogue dirs and asserts
 * the bucketing contract — an unruled difference is a REGRESSION (exit 1),
 * a ruled one is intended (exit 0), code adds/retires are reported, and the
 * column checksum table tells identical from differing columns.
 *
 * Also pins the committed diff-rules.json to the schema diff-catalogue.mjs
 * consumes, and the uploader's vocab-lane flag wiring (mutual exclusivity —
 * no network, no credentials needed).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIFF = path.join(__dirname, 'diff-catalogue.mjs');
const UPLOAD = path.join(__dirname, 'upload-trading-cards.mjs');

function makeFixture({ stagingEntryPatch = {}, stagingDetailPatch = {}, retireOne = false }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'diff-cat-'));
  const mk = (name, entries, details) => {
    const dir = path.join(root, name);
    fs.mkdirSync(path.join(dir, 'tc-lang'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'tc-index.json'), JSON.stringify(entries));
    for (const [code, d] of Object.entries(details)) {
      fs.writeFileSync(path.join(dir, 'tc-lang', `${code}.json`), JSON.stringify(d));
    }
    return dir;
  };
  const baseEntries = [
    { code: 'aaa', name: 'A', speakers: '~9K', rarity: { tier: 'rare' } },
    { code: 'bbb', name: 'B', speakers: '~1K', rarity: { tier: 'epic' } },
  ];
  const baseDetails = {
    aaa: { code: 'aaa', vocabulary: { items: [1, 2] }, notes: 'x' },
    bbb: { code: 'bbb', vocabulary: { items: [3] }, notes: 'y' },
  };
  const stagEntries = baseEntries
    .filter((e) => !(retireOne && e.code === 'bbb'))
    // Deep-clone per entry, then patch aaa
    .map((e) => ({ ...JSON.parse(JSON.stringify(e)), ...(e.code === 'aaa' ? stagingEntryPatch : {}) }));
  const stagDetails = {};
  for (const [code, d] of Object.entries(baseDetails)) {
    if (retireOne && code === 'bbb') continue;
    stagDetails[code] = { ...JSON.parse(JSON.stringify(d)), ...(code === 'aaa' ? stagingDetailPatch : {}) };
  }
  return {
    root,
    baseline: mk('baseline', baseEntries, baseDetails),
    staging: mk('staging', stagEntries, stagDetails),
  };
}

function runDiff({ baseline, staging, root }, rules) {
  const rulesPath = path.join(root, 'rules.json');
  fs.writeFileSync(rulesPath, JSON.stringify(rules));
  const res = spawnSync(process.execPath, [
    DIFF, '--baseline', baseline, '--staging', staging, '--rules', rulesPath, '--sample', '10',
  ], { encoding: 'utf-8' });
  const reportPath = path.join(staging, 'catalogue-diff-report.json');
  const report = fs.existsSync(reportPath)
    ? JSON.parse(fs.readFileSync(reportPath, 'utf-8'))
    : null;
  return { status: res.status, stdout: res.stdout + res.stderr, report };
}

const EMPTY_RULES = { index: {}, detail: {}, ignoreIndex: [], ignoreDetail: [] };

test('unruled index difference is a REGRESSION and exits 1', () => {
  const fx = makeFixture({ stagingEntryPatch: { rarity: { tier: 'mythic' } } });
  const { status, report } = runDiff(fx, EMPTY_RULES);
  assert.equal(status, 1);
  assert.equal(report.index.fields.rarity.bucket, 'regression');
  assert.equal(report.index.fields.rarity.diffCount, 1);
  assert.equal(report.index.fields.speakers.bucket, 'identical');
  fs.rmSync(fx.root, { recursive: true, force: true });
});

test('a rule reclassifies the same difference as intended and exits 0', () => {
  const fx = makeFixture({ stagingEntryPatch: { rarity: { tier: 'mythic' } } });
  const { status, report } = runDiff(fx, {
    ...EMPTY_RULES,
    index: { rarity: { bucket: 'intended-fix', reason: 'recalibration (test)' } },
  });
  assert.equal(status, 0);
  assert.equal(report.index.fields.rarity.bucket, 'intended');
  assert.equal(report.index.fields.rarity.rule.reason, 'recalibration (test)');
  fs.rmSync(fx.root, { recursive: true, force: true });
});

test('detail key drop without a rule blocks; with an intended-drop rule passes', () => {
  const fx = makeFixture({ stagingDetailPatch: { vocabulary: undefined, vocabularySummary: { totalForms: 2 } } });
  const blocked = runDiff(fx, EMPTY_RULES);
  assert.equal(blocked.status, 1);
  assert.equal(blocked.report.detail.keys.vocabulary.bucket, 'regression');
  const passed = runDiff(fx, {
    ...EMPTY_RULES,
    detail: {
      vocabulary: { bucket: 'intended-drop', reason: 'moved to trading_card_vocabulary (test)' },
      vocabularySummary: { bucket: 'intended-fix', reason: 'new header (test)' },
    },
  });
  assert.equal(passed.status, 0);
  fs.rmSync(fx.root, { recursive: true, force: true });
});

test('code retirement is reported at set level', () => {
  const fx = makeFixture({ retireOne: true });
  const { report } = runDiff(fx, EMPTY_RULES);
  assert.deepEqual(report.codeSet.retired, ['bbb']);
  assert.deepEqual(report.codeSet.added, []);
  fs.rmSync(fx.root, { recursive: true, force: true });
});

test('column checksums match exactly when a column is identical', () => {
  const fx = makeFixture({ stagingEntryPatch: { rarity: { tier: 'mythic' } } });
  const { report } = runDiff(fx, EMPTY_RULES);
  assert.equal(report.checksums.speakers.match, true);
  assert.equal(report.checksums.rarity.match, false);
  fs.rmSync(fx.root, { recursive: true, force: true });
});

test('committed diff-rules.json parses and every rule carries bucket + reason', () => {
  const rules = JSON.parse(fs.readFileSync(path.join(__dirname, 'diff-rules.json'), 'utf-8'));
  for (const section of ['index', 'detail']) {
    for (const [field, rule] of Object.entries(rules[section])) {
      assert.ok(['intended-fix', 'intended-drop'].includes(rule.bucket), `${section}.${field} bucket`);
      assert.ok(typeof rule.reason === 'string' && rule.reason.length > 20, `${section}.${field} reason`);
    }
  }
});

test('uploader refuses combined lane flags (--vocab-only + --index-only)', () => {
  const res = spawnSync(process.execPath, [UPLOAD, '--target', 'dev', '--vocab-only', '--index-only'], { encoding: 'utf-8' });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /mutually exclusive/);
});

test('uploader --help-shaped source documents the vocab lane', () => {
  // The lane must stay documented where operators read it — the usage header.
  const src = fs.readFileSync(UPLOAD, 'utf-8');
  assert.match(src, /--vocab-only/);
  assert.match(src, /069_create_trading_card_vocabulary\.sql/);
  assert.match(src, /ON DELETE CASCADE/);
});
