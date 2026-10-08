/**
 * tm prune — removing dead-weight TM entries.
 *
 * Covers both layers:
 *   - lib/tm.js pruneTM(): legacy (missing l/m), matching (translation text
 *     matches a policy-eviction regex), and stale (--older-than by ts)
 *     detection, byReason counts, _meta preservation, dirty-marking.
 *   - lib/commands/tm.js runPrune(): default = DRY REPORT (file untouched),
 *     --yes actually deletes only the intended entries, --json single-doc,
 *     malformed --matching/--older-than rejected loudly.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { loadTM, saveTM, pruneTM, tmSize, isTMDirty, TM_DIR, TM_FILENAME } from '../lib/tm.js';
import { run as runTmCommand } from '../lib/commands/tm.js';
import { output } from '../lib/output.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDaysAgo(days) {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

/** A TM object with 2 legacy, 2 old-but-modern, and 2 fresh entries. */
function seedTM() {
  return {
    _meta: { version: 1, created: isoDaysAgo(400) },
    // Legacy: pre-v3.4 shape, no l/m metadata (one old, one recent — BOTH
    // are legacy; the category is about metadata, not age).
    legacyOld: { t: 'Bonjour', ts: isoDaysAgo(300) },
    legacyFresh: { t: 'Salut', ts: isoDaysAgo(1) },
    // Modern but stale (old ts).
    staleA: { t: 'Guten Tag', ts: isoDaysAgo(200), l: 'de', m: 'llm|x||' },
    staleB: { t: 'Hallo', ts: isoDaysAgo(120), l: 'de', m: 'llm|x||' },
    // Modern and fresh.
    freshA: { t: 'Hola', ts: isoDaysAgo(2), l: 'es', m: 'llm|x||' },
    freshB: { t: 'Ciao', ts: isoDaysAgo(0), l: 'it', m: 'llm|x||' },
  };
}

describe('pruneTM (lib/tm.js)', () => {
  it('legacy-only prune removes exactly the metadata-less entries', () => {
    const tm = seedTM();
    const report = pruneTM(tm, { legacy: true });

    assert.deepEqual(report, { removed: 2, kept: 4, byReason: { legacy: 2, matching: 0, stale: 0 } });
    assert.ok(!('legacyOld' in tm) && !('legacyFresh' in tm));
    assert.ok('staleA' in tm && 'freshA' in tm, 'modern entries untouched');
    assert.ok(tm._meta, '_meta preserved');
    assert.ok(isTMDirty(tm), 'removal marks the TM dirty');
  });

  it('olderThanDays removes stale modern entries too, counted separately', () => {
    const tm = seedTM();
    const report = pruneTM(tm, { legacy: true, olderThanDays: 90 });

    assert.deepEqual(report, { removed: 4, kept: 2, byReason: { legacy: 2, matching: 0, stale: 2 } });
    assert.ok(!('staleA' in tm) && !('staleB' in tm));
    assert.ok('freshA' in tm && 'freshB' in tm);
    // A legacy entry that is ALSO old counts once, under legacy.
    assert.equal(report.byReason.legacy, 2);
  });

  it('nothing to prune → no removal, not dirty', () => {
    const tm = {
      _meta: { version: 1 },
      freshA: { t: 'Hola', ts: isoDaysAgo(1), l: 'es', m: 'llm|x||' },
    };
    const report = pruneTM(tm, { legacy: true, olderThanDays: 90 });
    assert.deepEqual(report, { removed: 0, kept: 1, byReason: { legacy: 0, matching: 0, stale: 0 } });
    assert.ok(!isTMDirty(tm));
  });

  it('matching removes exactly the entries whose translation matches', () => {
    const tm = seedMatchingTM();
    const report = pruneTM(tm, { legacy: false, matching: /Legacy Brand/ });

    // With legacy: false the legacy-shaped entry is still content-tested —
    // the matching category is about wording, not entry shape.
    assert.deepEqual(report, { removed: 3, kept: 1, byReason: { legacy: 0, matching: 3, stale: 0 } });
    assert.ok(!('bannedFresh' in tm) && !('bannedOld' in tm) && !('legacyBanned' in tm));
    assert.ok('cleanFresh' in tm, 'clean entries survive');
    assert.ok(isTMDirty(tm));
  });

  it('category precedence is legacy → matching → stale, each entry counted once', () => {
    const tm = seedMatchingTM();
    const report = pruneTM(tm, { legacy: true, matching: /Legacy Brand/, olderThanDays: 90 });

    // legacyBanned counts under legacy (not matching); bannedOld counts under
    // matching (not stale) despite being 200 days old; cleanFresh survives.
    assert.deepEqual(report, { removed: 3, kept: 1, byReason: { legacy: 1, matching: 2, stale: 0 } });
    assert.ok('cleanFresh' in tm);
  });

  it('a global regex does not skip entries via lastIndex carry-over', () => {
    const tm = seedMatchingTM();
    const report = pruneTM(tm, { legacy: false, matching: /Legacy Brand/g });
    assert.equal(report.byReason.matching, 3, 'all matching entries removed despite /g');
  });
});

/** A TM with two banned-wording entries (one fresh, one old), a clean entry,
 *  and a legacy-shaped entry whose text ALSO matches (for precedence). */
function seedMatchingTM() {
  return {
    _meta: { version: 1, created: isoDaysAgo(400) },
    bannedFresh: { t: 'Legacy Brand Name Community Translation', ts: isoDaysAgo(2), l: 'fil', m: 'llm|x||' },
    bannedOld: { t: 'ang Legacy Brand Name', ts: isoDaysAgo(200), l: 'fil', m: 'llm|x||' },
    cleanFresh: { t: 'Malinis na salin', ts: isoDaysAgo(2), l: 'fil', m: 'llm|x||' },
    legacyBanned: { t: 'Legacy Brand Name', ts: isoDaysAgo(300) },
  };
}

describe('champollion tm prune (command)', () => {
  let tmp;
  const realLog = console.log;
  const realError = console.error;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-tm-prune-'));
    saveTM(tmp, seedTM());
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log = realLog;
    console.error = realError;
    output.setMode('default');
  });

  function capture() {
    const lines = [];
    console.log = (msg) => lines.push(String(msg));
    console.error = () => {};
    return lines;
  }

  function args(flags = {}) {
    return { _: ['tm', 'prune'], ...flags };
  }

  it('default is a dry report — counts by category, file untouched', async () => {
    const before = fs.readFileSync(path.join(tmp, TM_DIR, TM_FILENAME), 'utf-8');
    const lines = capture();
    const code = await runTmCommand(args({ 'older-than': '90' }), tmp);
    console.log = realLog;

    assert.equal(code, 0);
    const out = lines.join('\n');
    assert.ok(out.includes('DRY REPORT'), out);
    assert.ok(out.includes('Would remove'), out);
    // File is byte-identical: nothing was deleted.
    assert.equal(fs.readFileSync(path.join(tmp, TM_DIR, TM_FILENAME), 'utf-8'), before);
    assert.equal(tmSize(loadTM(tmp)), 6);
  });

  it('--yes deletes only the intended entries and preserves _meta', async () => {
    capture();
    const code = await runTmCommand(args({ yes: true, 'older-than': '90' }), tmp);
    console.log = realLog;

    assert.equal(code, 0);
    const tm = loadTM(tmp);
    assert.equal(tmSize(tm), 2);
    assert.ok('freshA' in tm && 'freshB' in tm, 'fresh modern entries survive');
    assert.ok(!('legacyOld' in tm) && !('legacyFresh' in tm) && !('staleA' in tm) && !('staleB' in tm));
    assert.ok(tm._meta && tm._meta.version === 1, '_meta preserved through save');
  });

  it('--yes without --older-than prunes legacy only', async () => {
    capture();
    await runTmCommand(args({ yes: true }), tmp);
    console.log = realLog;

    const tm = loadTM(tmp);
    assert.equal(tmSize(tm), 4);
    assert.ok('staleA' in tm && 'staleB' in tm, 'age-based pruning needs --older-than');
  });

  it('--json emits a single parseable document with the report counts', async () => {
    const lines = capture();
    const code = await runTmCommand(args({ json: true, 'older-than': '90' }), tmp);
    console.log = realLog;

    assert.equal(code, 0);
    const doc = JSON.parse(lines.join('\n'));
    assert.equal(doc.command, 'tm');
    assert.equal(doc.action, 'prune');
    assert.equal(doc.dryRun, true);
    assert.equal(doc.removed, 4);
    assert.equal(doc.kept, 2);
    assert.deepEqual(doc.byReason, { legacy: 2, matching: 0, stale: 2 });
    assert.equal(doc.deleted, false);
  });

  it('rejects a malformed --older-than loudly', async () => {
    capture();
    const code = await runTmCommand(args({ 'older-than': 'soon' }), tmp);
    console.log = realLog;
    assert.equal(code, 1);
  });

  it('--matching dry report counts matches, file untouched', async () => {
    saveTM(tmp, seedMatchingTM());
    const before = fs.readFileSync(path.join(tmp, TM_DIR, TM_FILENAME), 'utf-8');
    const lines = capture();
    const code = await runTmCommand(args({ matching: 'Legacy Brand' }), tmp);
    console.log = realLog;

    assert.equal(code, 0);
    const out = lines.join('\n');
    assert.ok(out.includes('DRY REPORT'), out);
    assert.ok(out.includes('matching'), out);
    assert.equal(fs.readFileSync(path.join(tmp, TM_DIR, TM_FILENAME), 'utf-8'), before);
  });

  it('--matching --yes deletes matching entries (and legacy, per default)', async () => {
    saveTM(tmp, seedMatchingTM());
    capture();
    const code = await runTmCommand(args({ yes: true, matching: 'Legacy Brand' }), tmp);
    console.log = realLog;

    assert.equal(code, 0);
    const tm = loadTM(tmp);
    assert.equal(tmSize(tm), 1);
    assert.ok('cleanFresh' in tm, 'only the clean entry survives');
    assert.ok(!('bannedFresh' in tm) && !('bannedOld' in tm) && !('legacyBanned' in tm));
  });

  it('--matching --json echoes the pattern and the byReason count', async () => {
    saveTM(tmp, seedMatchingTM());
    const lines = capture();
    const code = await runTmCommand(args({ json: true, matching: 'Legacy Brand' }), tmp);
    console.log = realLog;

    assert.equal(code, 0);
    const doc = JSON.parse(lines.join('\n'));
    assert.equal(doc.matching, 'Legacy Brand');
    assert.equal(doc.byReason.matching, 2);
    assert.equal(doc.byReason.legacy, 1);
    assert.equal(doc.deleted, false);
  });

  it('rejects a malformed --matching regex loudly', async () => {
    capture();
    const code = await runTmCommand(args({ matching: '[unclosed' }), tmp);
    console.log = realLog;
    assert.equal(code, 1);
  });
});
