/**
 * Edits made by hand to translated Markdown survive the next sync
 * (lib/content-review.js + lib/content-sync.js).
 *
 * Persona finding 2026-10-03: a reviewer corrects a sentence in
 * newsletters/2026-10.crk.md; the author then changes a DIFFERENT paragraph
 * of newsletters/2026-10.md; the next sync re-translated the file and the
 * Translation Memory put the old machine wording back over the correction,
 * with nothing said. These tests pin the fixed behaviour: the correction is
 * kept, the run says so, the TM never learns the reviewer's text as machine
 * output, and the edge cases (the edited paragraph's own source changed,
 * paragraphs added, page segmentation, a redo by name) are each loud.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runContentSync } from '../lib/sync.js';
import { countPendingContentTranslations, readContentManifest } from '../lib/content-sync.js';
import { METHOD_REGISTRY } from '../lib/translate.js';
import { loadTM, lookupTM, tmMethodKey } from '../lib/tm.js';
import { compileFileScope } from '../lib/file-scope.js';
import { parseContentFile } from '../lib/content.js';
import {
  writtenRecordKey, parseWrittenRecord, buildWrittenRecord, readReviewerEdits,
  matchEditedBlocks, assessExistingTarget, blockHash, fileHash,
} from '../lib/content-review.js';

// ── A scripted method: records every API touch ─────────────────────────
class ReviewFakeMethod {
  async translate(keys, sourceFlat) {
    ReviewFakeMethod.batchCalls.push([...keys]);
    const out = {};
    for (const k of keys) out[k] = `CRK:${sourceFlat[k]}`;
    return out;
  }

  async translateContent(prompt) {
    ReviewFakeMethod.contentCalls.push(prompt);
    const segs = [...prompt.matchAll(/⟦SEG_(\d+)⟧\n([\s\S]*?)(?=\n\n⟦SEG_|$)/g)];
    if (segs.length > 0) return segs.map(m => `⟦SEG_${m[1]}⟧\nCRK<${m[2]}>`).join('\n\n');
    const idx = prompt.indexOf('\n---\n');
    // Page mode: translate paragraph by paragraph so the structure holds.
    return prompt.slice(idx + 5).split('\n\n').map(p => (p.trim() ? `CRK<${p}>` : p)).join('\n\n');
  }

  checkReadiness() { return { ready: true }; }
}
ReviewFakeMethod.batchCalls = [];
ReviewFakeMethod.contentCalls = [];
METHOD_REGISTRY['test-review-fake'] = ReviewFakeMethod;

function resetCalls() {
  ReviewFakeMethod.batchCalls = [];
  ReviewFakeMethod.contentCalls = [];
}

/** Segments sent to the model across this run's content calls. */
function billedSegments() {
  return ReviewFakeMethod.contentCalls.flatMap(p => [...p.matchAll(/⟦SEG_\d+⟧\n([\s\S]*?)(?=\n\n⟦SEG_|$)/g)].map(m => m[1]));
}

function buildPairs({ segmentation } = {}) {
  const pairs = new Map();
  pairs.set('en:crk', {
    source: 'en', target: 'crk', method: 'test-review-fake', model: 'fake-model',
    batchSize: 30, name: 'Plains Cree', register: 'Plain.',
    ...(segmentation && { contentSegmentation: segmentation }),
  });
  return pairs;
}

const NEWSLETTER = [
  '---',
  'title: October news',
  'description: What happened this month',
  '---',
  '',
  'The school garden is growing.',
  '',
  'We need volunteers for Saturday.',
  '',
  'Thank you all.',
  '',
].join('\n');

const SRC = 'newsletters/2026-10.md';
const TGT = 'newsletters/2026-10.crk.md';

describe('content sync keeps edits made by hand to a translation', () => {
  let dir;
  let contentDir;

  const write = (rel, text) => {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, text, 'utf-8');
  };
  const read = (rel) => fs.readFileSync(path.join(dir, rel), 'utf-8');
  const editTarget = (from, to) => {
    const before = read(TGT);
    assert.ok(before.includes(from), `fixture: target contains ${JSON.stringify(from)}`);
    write(TGT, before.replace(from, to));
  };

  /** Run a content sync, capturing everything it prints. */
  async function sync(extra = {}) {
    const lines = [];
    const log = console.log;
    const err = console.error;
    console.log = (...a) => lines.push(a.join(' '));
    console.error = (...a) => lines.push(a.join(' '));
    try {
      const result = await runContentSync({
        contentDir,
        sourceLocale: 'en',
        pairs: extra.pairs || buildPairs(),
        translatableFields: null,
        apiKey: 'test-key',
        dryRun: false,
        cwd: dir,
        ...extra,
      });
      return { result, out: lines.join('\n') };
    } finally {
      console.log = log;
      console.error = err;
    }
  }

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-review-'));
    contentDir = path.join(dir, 'newsletters');
    resetCalls();
    write(SRC, NEWSLETTER);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes a block-by-block record of every translation it writes', async () => {
    await sync();
    const lock = readContentManifest(dir);
    const record = parseWrittenRecord(lock[writtenRecordKey('2026-10.md:crk')]);
    assert.ok(record, 'record written beside the source hash');
    assert.equal(record.file, fileHash(read(TGT)));
    assert.equal(record.blocks.length, 3, 'one entry per translatable paragraph');
    assert.deepEqual(Object.keys(record.fields).sort(), ['description', 'title']);
    assert.equal(record.blocks[0].s, blockHash('The school garden is growing.'));
    assert.ok(record.blocks.every(b => !b.owned), 'nothing is a person\'s yet');
    // The source-hash entry other tools read is unchanged in shape.
    assert.equal(typeof lock['2026-10.md:crk'], 'string');
  });

  it('source unchanged: the edited translation is not touched', async () => {
    await sync();
    editTarget('CRK<We need volunteers for Saturday.>', 'Reviewer: Saturday volunteers wanted.');
    const edited = read(TGT);
    resetCalls();
    await sync();
    assert.equal(read(TGT), edited, 'file left exactly as the reviewer left it');
    assert.equal(ReviewFakeMethod.contentCalls.length, 0);
  });

  it('source changed in a DIFFERENT paragraph: the edit is kept, and the run says so', async () => {
    await sync();
    editTarget('CRK<We need volunteers for Saturday.>', 'Reviewer: Saturday volunteers wanted.');
    resetCalls();

    write(SRC, NEWSLETTER.replace('Thank you all.', 'Thank you all, see you soon.'));
    const { out, result } = await sync();

    const target = read(TGT);
    assert.ok(target.includes('Reviewer: Saturday volunteers wanted.'), 'the correction survived');
    assert.ok(!target.includes('CRK<We need volunteers for Saturday.>'), 'machine wording NOT put back');
    assert.ok(target.includes('CRK<Thank you all, see you soon.>'), 'the changed paragraph is translated');
    assert.ok(target.includes('CRK<The school garden is growing.>'), 'untouched paragraph from cache');
    assert.deepEqual(billedSegments(), ['Thank you all, see you soon.'], 'only the changed paragraph is billed');
    assert.match(out, /kept the edits made by hand to 1 paragraph\(s\) of 2026-10\.crk\.md/);
    assert.match(out, /--redo files:2026-10\.md/);
    assert.equal(result.keptEdits, 1);

    // The TM still holds the MACHINE wording for that paragraph — a
    // person's text is never cached as a method's output.
    const tm = loadTM(dir);
    const key = tmMethodKey(buildPairs().get('en:crk'));
    assert.equal(lookupTM(tm, 'We need volunteers for Saturday.', 'crk', key), 'CRK<We need volunteers for Saturday.>');
    // … and no whole-body entry that would carry the reviewer's paragraph.
    assert.equal(lookupTM(tm, parseContentFile(read(SRC)).body, 'crk', key), null);
  });

  it('the kept edit stays the reviewer\'s on every later source change', async () => {
    await sync();
    editTarget('CRK<We need volunteers for Saturday.>', 'Reviewer: Saturday volunteers wanted.');
    write(SRC, NEWSLETTER.replace('Thank you all.', 'Thank you all, see you soon.'));
    await sync();

    // The record now marks that paragraph as a person's …
    const record = parseWrittenRecord(readContentManifest(dir)[writtenRecordKey('2026-10.md:crk')]);
    assert.deepEqual(record.blocks.map(b => b.owned), [false, true, false]);

    // … so a second, unrelated change keeps it again (its text now matches
    // what sync wrote, which alone would not mark it as edited).
    write(SRC, NEWSLETTER.replace('Thank you all.', 'Thanks!').replace('is growing', 'is thriving'));
    resetCalls();
    await sync();
    const target = read(TGT);
    assert.ok(target.includes('Reviewer: Saturday volunteers wanted.'));
    assert.ok(target.includes('CRK<The school garden is thriving.>'));
    assert.ok(target.includes('CRK<Thanks!>'));
  });

  it('the edited paragraph\'s own source changed: re-translated, and the edited wording is printed', async () => {
    await sync();
    editTarget('CRK<We need volunteers for Saturday.>', 'Reviewer: Saturday volunteers wanted.');
    write(SRC, NEWSLETTER.replace('We need volunteers for Saturday.', 'We need volunteers for Sunday.'));
    const { out } = await sync();

    const target = read(TGT);
    assert.ok(target.includes('CRK<We need volunteers for Sunday.>'), 'translates the source as it is now');
    assert.match(out, /paragraph 2 had been edited by hand, but the source paragraph it translates has changed/);
    assert.match(out, /Reviewer: Saturday volunteers wanted\./, 'the edited wording is not lost — it is printed');
  });

  it('a front-matter field edited by hand is kept while its source value is unchanged', async () => {
    await sync();
    editTarget('CRK:October news', 'Reviewer title');
    write(SRC, NEWSLETTER.replace('Thank you all.', 'Thanks.'));
    resetCalls();
    const { out } = await sync();
    assert.match(read(TGT), /title: "?Reviewer title"?/);
    assert.ok(!ReviewFakeMethod.batchCalls.flat().includes('title'), 'title not sent to the API');
    assert.match(out, /front matter "title"/);

    // Its source changes: re-translated, edited wording printed.
    write(SRC, NEWSLETTER.replace('title: October news', 'title: November news'));
    const second = await sync();
    assert.match(read(TGT), /CRK:November news/);
    assert.match(second.out, /front matter "title" had been edited by hand/);
    assert.match(second.out, /Reviewer title/);
  });

  it('paragraphs added by hand + a source change: the file is left as is, every run, until resolved', async () => {
    await sync();
    editTarget('CRK<Thank you all.>', 'CRK<Thank you all.>\n\nReviewer added a paragraph.');
    const edited = read(TGT);
    const lockBefore = readContentManifest(dir)['2026-10.md:crk'];
    write(SRC, NEWSLETTER.replace('is growing', 'is thriving'));
    resetCalls();

    const first = await sync();
    assert.equal(read(TGT), edited, 'nothing of the reviewer\'s is overwritten');
    assert.equal(ReviewFakeMethod.contentCalls.length, 0, 'nothing billed');
    assert.match(first.out, /2026-10\.crk\.md was left as is: it was edited by hand \(it now has 4 paragraph\(s\) where sync wrote 3/);
    assert.match(first.out, /--redo files:2026-10\.md/);
    assert.equal(first.result.held, 1);
    assert.equal(readContentManifest(dir)['2026-10.md:crk'], lockBefore, 'lock NOT advanced');

    // Said again on the next run — not a one-off warning that then goes quiet.
    const second = await sync();
    assert.match(second.out, /was left as is/);

    // The cost preview counts nothing for it.
    const pending = countPendingContentTranslations(contentDir, 'en', [...buildPairs()], dir);
    assert.equal(pending.pendingTranslations, 0);

    // The reviewer brings it up to date by hand → the next sync takes it.
    write(TGT, read(TGT).replace('Reviewer added a paragraph.', 'Reviewer added a paragraph (updated).'));
    const third = await sync();
    assert.match(third.out, /took your updated 2026-10\.crk\.md as up to date with 2026-10\.md/);
    assert.ok(read(TGT).includes('(updated)'));
    const lock = readContentManifest(dir);
    assert.notEqual(lock['2026-10.md:crk'], lockBefore, 'now current');
    assert.equal(parseWrittenRecord(lock[writtenRecordKey('2026-10.md:crk')]).owned, true, 'and the reviewer\'s');
    resetCalls();
    await sync();
    assert.equal(ReviewFakeMethod.contentCalls.length, 0, 'up to date: nothing to do');
  });

  it('--redo files:<path> (= --files + --force-content) replaces the edits from cache, billing nothing', async () => {
    await sync();
    editTarget('CRK<We need volunteers for Saturday.>', 'Reviewer: Saturday volunteers wanted.');
    resetCalls();
    const { out } = await sync({ forceContent: true, fileScope: compileFileScope({ files: ['2026-10.md'] }) });
    assert.ok(read(TGT).includes('CRK<We need volunteers for Saturday.>'), 'machine translation restored');
    assert.equal(ReviewFakeMethod.contentCalls.length, 0, 'served from cache');
    assert.match(out, /replacing the edits made by hand to 1 paragraph\(s\) of 2026-10\.crk\.md/);
  });

  it('a bare --force-content (--redo content) keeps the edits', async () => {
    await sync();
    editTarget('CRK<We need volunteers for Saturday.>', 'Reviewer: Saturday volunteers wanted.');
    const { out } = await sync({ forceContent: true });
    assert.ok(read(TGT).includes('Reviewer: Saturday volunteers wanted.'));
    assert.match(out, /kept the edits made by hand to 1 paragraph\(s\)/);
  });

  it('--retranslate replaces the edits with a fresh translation', async () => {
    await sync();
    editTarget('CRK<We need volunteers for Saturday.>', 'Reviewer: Saturday volunteers wanted.');
    resetCalls();
    const { out } = await sync({ fileScope: compileFileScope({ retranslate: ['2026-10.md'] }) });
    assert.ok(!read(TGT).includes('Reviewer:'));
    assert.equal(billedSegments().length, 3, 'all paragraphs paid for again');
    assert.match(out, /replacing the edits made by hand .* \(you named it with --retranslate\)/);
  });

  it('a hand-translated file keeps its paragraphs when the source later changes elsewhere', async () => {
    write(TGT, '---\ntitle: Hand title\ndescription: Hand description\n---\n\nHand one.\n\nHand two.\n\nHand three.\n');
    await sync(); // adopted
    write(SRC, NEWSLETTER.replace('Thank you all.', 'Thank you all, see you soon.'));
    resetCalls();
    const { out } = await sync();
    const target = read(TGT);
    assert.ok(target.includes('Hand one.') && target.includes('Hand two.'), 'the person\'s paragraphs stay');
    assert.ok(target.includes('CRK<Thank you all, see you soon.>'), 'the changed one is translated');
    assert.ok(target.includes('Hand title'));
    assert.match(out, /Hand three\./, 'the replaced hand paragraph is printed, not lost silently');
    assert.deepEqual(billedSegments(), ['Thank you all, see you soon.']);
  });

  it('a translation from before records existed: recorded on the next run, earlier edits recognised from the TM', async () => {
    await sync();
    editTarget('CRK<We need volunteers for Saturday.>', 'Reviewer: Saturday volunteers wanted.');
    // Simulate an older version: drop the written-record, keep the lock.
    const lockPath = path.join(dir, '.champollion-content.lock');
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
    delete lock[writtenRecordKey('2026-10.md:crk')];
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');

    await sync(); // source unchanged: records the file, the edit marked as a person's
    const record = parseWrittenRecord(readContentManifest(dir)[writtenRecordKey('2026-10.md:crk')]);
    assert.deepEqual(record.blocks.map(b => b.owned), [false, true, false]);

    write(SRC, NEWSLETTER.replace('Thank you all.', 'Thanks.'));
    await sync();
    assert.ok(read(TGT).includes('Reviewer: Saturday volunteers wanted.'));
  });

  it("'page' segmentation: an edited translation is left as is when its source changes", async () => {
    const pairs = buildPairs({ segmentation: 'page' });
    await sync({ pairs });
    editTarget('CRK<We need volunteers for Saturday.>', 'Reviewer: Saturday volunteers wanted.');
    const edited = read(TGT);
    write(SRC, NEWSLETTER.replace('Thank you all.', 'Thanks.'));
    const { out } = await sync({ pairs });
    assert.equal(read(TGT), edited);
    assert.match(out, /'page' segmentation/);
  });

  it('dry-run says which edits would be kept and writes nothing', async () => {
    await sync();
    editTarget('CRK<We need volunteers for Saturday.>', 'Reviewer: Saturday volunteers wanted.');
    const edited = read(TGT);
    write(SRC, NEWSLETTER.replace('Thank you all.', 'Thanks.'));
    const { out } = await sync({ dryRun: true });
    assert.match(out, /Would update: 2026-10\.crk\.md \(keeping the edits made by hand to 1 paragraph\(s\)\)/);
    assert.equal(read(TGT), edited);
  });

  it('an unreadable record is reported, not silently treated as "no edits"', async () => {
    await sync();
    const lockPath = path.join(dir, '.champollion-content.lock');
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
    lock[writtenRecordKey('2026-10.md:crk')] = { file: 'x', blocks: 'not-a-pair' };
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
    write(SRC, NEWSLETTER.replace('Thank you all.', 'Thanks.'));
    const { out } = await sync();
    assert.match(out, /the record of 2026-10\.crk\.md is unreadable/);
  });
});

describe('content-review helpers', () => {
  it('matchEditedBlocks maps a repeated paragraph occurrence by occurrence', () => {
    const h = blockHash('Same.');
    const edits = [
      { src: h, text: 'machine A', owned: false },
      { src: h, text: 'person B', owned: true },
    ];
    const { keep, superseded } = matchEditedBlocks(edits, ['Same.', 'Other.', 'Same.']);
    assert.deepEqual([...keep], [[2, 'person B']], 'the SECOND copy keeps the person\'s text');
    assert.deepEqual(superseded, []);
  });

  it('matchEditedBlocks reports an edited paragraph whose source is gone', () => {
    const { keep, superseded } = matchEditedBlocks(
      [{ src: blockHash('Gone.'), text: 'person', owned: true }], ['New.'],
    );
    assert.equal(keep.size, 0);
    assert.deepEqual(superseded, [{ paragraph: 1, text: 'person' }]);
  });

  it('readReviewerEdits: a file exactly as written is clean', () => {
    const written = '---\ntitle: "T"\n---\n\nOne.\n\nTwo.\n';
    const record = parseWrittenRecord(buildWrittenRecord({
      sourceBody: '\nA.\n\nB.\n', sourceFields: { title: 'S' }, written,
    }));
    assert.deepEqual(readReviewerEdits(written, record), { state: 'clean' });
    const edits = readReviewerEdits(written.replace('Two.', 'Two, fixed.'), record);
    assert.equal(edits.state, 'edited');
    assert.equal(edits.ownedBlocks, 1);
  });

  it('assessExistingTarget: an up-to-date file with unmergeable edits is kept under --force-content', () => {
    const written = '\nOne.\n\nTwo.\n';
    const record = parseWrittenRecord(buildWrittenRecord({ sourceBody: '\nA.\n\nB.\n', sourceFields: {}, written }));
    const verdict = assessExistingTarget({
      targetRaw: written + '\nThree.\n', record, segMode: 'block', replaceEdits: false, sourceCurrent: true,
    });
    assert.equal(verdict.action, 'keep');
  });

  it('parseWrittenRecord rejects malformed records loudly', () => {
    assert.equal(parseWrittenRecord(undefined), null);
    assert.throws(() => parseWrittenRecord('abc'), /not a written-record/);
    assert.throws(() => parseWrittenRecord({ file: 'f', blocks: 'zz:yy' }), /malformed "blocks"/);
    assert.throws(() => parseWrittenRecord({ file: 'f', blocks: '', fields: { title: 'nope' } }), /malformed field "title"/);
  });
});
