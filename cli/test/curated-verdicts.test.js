/**
 * curated-verdicts.test.js — every hand-written file gets a decision, in writing.
 *
 * The founder's instruction on the curated files was two words: "Fetch or drop."
 * Six verdicts were recorded against six files. There were seven files.
 *
 * curated-sil-resources.json — the Aeta pilot's SIL/OLAC/eBible register, and
 * the ONE curated file whose entries were already properly cited — had no
 * verdict at all, because the list was written from the files somebody
 * remembered rather than from the directory. It would have survived the cutover
 * as an uncited hand-file inside a pipeline built to eliminate them.
 *
 * So the directory is the list now, and a file with no verdict fails here.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const REPO = path.join(import.meta.dirname, '..', '..');
const SHARED = path.join(REPO, 'cli', 'shared');

const verdicts = JSON.parse(
  fs.readFileSync(path.join(REPO, 'shared/cldf/curated-file-verdicts.json'), 'utf-8'),
).verdicts;

/** Every verdict must be one of these — "we'll decide later" is not a verdict. */
const DECIDED = /^(FETCHED|FETCHABLE|DROP|NO UPSTREAM|CITABLE)/;

describe('the curated files are decided, not remembered', () => {
  const onDisk = fs.existsSync(SHARED)
    ? fs.readdirSync(SHARED).filter((f) => /^curated-.*\.json$/.test(f))
    : [];

  test('every curated file on disk has a recorded verdict', () => {
    const undecided = onDisk.filter((f) => !verdicts[f]);
    assert.deepEqual(
      undecided, [],
      `no verdict recorded for: ${undecided.join(', ')}. A hand-written file with no `
      + 'decision is one that survives the cutover by default, which is how an uncited '
      + 'register ends up inside a pipeline built to eliminate them.',
    );
  });

  test('no verdict names a file that no longer exists', () => {
    // The other direction: a verdict for a deleted file reads as unfinished
    // work that is actually done, and hides the ones that are not.
    const stale = Object.keys(verdicts).filter((f) => !onDisk.includes(f));
    for (const f of stale) {
      assert.match(
        verdicts[f].action ?? '', /delete|archive/i,
        `"${f}" has a verdict but is not on disk, and its action does not say it was `
        + 'removed. Either the file went without its verdict being closed, or the '
        + 'verdict is about a file that never existed.',
      );
    }
  });

  test('every verdict states a decision and the evidence for it', () => {
    for (const [file, v] of Object.entries(verdicts)) {
      assert.match(v.verdict ?? '', DECIDED, `${file}: "${v.verdict}" is not a decision`);
      assert.ok(v.evidence, `${file}: a verdict with no evidence is an opinion`);
      assert.ok(v.action, `${file}: no action — nobody can act on it`);
    }
  });
});
