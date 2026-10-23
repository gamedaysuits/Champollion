/**
 * improve.test.js — the improve loop on the rails (journey plan, Phase 2):
 * after a model is in use, a round is the speaker checking the model's own
 * drafts of what the family wants to say, their fixes and confirmed drafts
 * coming in as training pairs (terms asked as for any file), the corpus
 * combined and screened into the round's training file, and training again;
 * forge judges the round. Never a sentence on the screen.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run as runNew } from '../lib/commands/new.js';
import { run as runData } from '../lib/commands/data.js';
import { run as runImprove, SHEET_HEADER } from '../lib/commands/improve.js';
import { nextStep } from '../lib/framework/journey.js';
import { currentRound, markingError, MIN_REPEATS, practiceRows, PRACTICE_MARK, readMark, readSheet, roundReport, sha256File,
  timeNote, trainedOnCurrent, verdictWords, wilson } from '../lib/framework/rounds.js';
import { blindComparison } from '../lib/commands/improve.js';
import { SCHEMA_IDS } from '../lib/framework/index.js';
import { output } from '../lib/output.js';

async function quiet(fn) {
  const raw = output.raw;
  const error = output.error;
  const lines = [];
  output.raw = (s) => lines.push(String(s));
  output.error = (s) => lines.push(String(s));
  try {
    return { code: await fn(), text: lines.join('\n') };
  } finally {
    output.raw = raw;
    output.error = error;
  }
}

const someTool = () => '/usr/local/bin/nmt-forge';

/** Rounds of marks written as `champollion improve marks` writes them: the share
 * the speaker marked right (of 60 drafts a round), the training pairs behind the
 * model in use (200, 400, 800, … by default) and — on the visit after each
 * promotion, unless `checked` is false — the blind check against the model it
 * replaced (`blind[i]`: [its share, its pairs]; by default the round before's). */
function writeRounds(root, ledger, before, { accs, total = 'maybe 800 sentences all told', perWeek = 'thirty a visit',
  pairs = accs.map((_, i) => 200 * 2 ** i), checked = true,
  blind = checked ? accs.map((_, i) => (i ? [accs[i - 1], pairs[i - 1]] : null)) : [] }) {
  fs.rmSync(path.join(root, 'improve'), { recursive: true, force: true });
  fs.mkdirSync(path.join(root, 'improve'), { recursive: true });
  fs.writeFileSync(path.join(root, 'improve/time.json'), JSON.stringify({ per_week: perWeek, total }));
  fs.writeFileSync(ledger, before);
  accs.forEach((a, i) => {
    const right = Math.round(a * 60);
    const [lo, hi] = wilson(right, 60);
    const b = blind[i];
    const otherRight = b ? Math.round(b[0] * 60) : 0;
    fs.mkdirSync(path.join(root, `improve/round-${i + 1}`), { recursive: true });
    fs.writeFileSync(path.join(root, `improve/round-${i + 1}/marks.json`), JSON.stringify({ round: i + 1,
      right, wrong: 60 - right, acceptance: right / 60, ci95: [lo, hi], in_use_pairs: pairs[i],
      ...(b ? { blind: { ...blindComparison(right, 60 - right, otherRight, 60 - otherRight, 'replaced'),
        relation: 'replaced', in_use_pairs: pairs[i], other_pairs: b[1] } } : {}) }));
  });
}
/** A round's verdict as forge writes it, and — on "better" — the people's yes
 * (forge's export + choose records): a verdict alone puts nothing to use. */
function verdictRound(ledger, i, verdict, extra = {}, { yes = verdict === 'better' } = {}) {
  const run = `r${i + 2}`;
  fs.appendFileSync(ledger, JSON.stringify({ event: 'improve-compare', round: i + 1, verdict, in_use: `r${i + 1}`,
    new: run, ...extra }) + '\n');
  if (yes) {
    fs.appendFileSync(ledger, JSON.stringify({ event: 'export', run, dir: `export/${run}`, model_dir: `export/${run}/model` })
      + '\n' + JSON.stringify({ event: 'choose', model_dir: `export/${run}/model` }) + '\n');
  }
}
const SENTENCES = Array.from({ length: 20 }, (_, i) => `We ate fish number ${i} by the river.`);

/** A project whose first model is served (the state forge's status reports). */
async function servedProject() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'improve-'));
  await quiet(() => runNew({ _: ['new', 'p'], from: 'English', to: 'qaa', 'target-name': 'Our language' }, cwd));
  const root = path.join(cwd, 'p');
  const side = (extra) => JSON.stringify({ $schema: SCHEMA_IDS.set, transmission: 'local-only', ...extra });
  fs.writeFileSync(path.join(root, 'data/parallel/combined.tsv'), 'Good morning.\tzub kef\nThank you.\tmol tav\n');
  fs.writeFileSync(path.join(root, 'data/parallel/combined.tsv.champollion.json'),
    side({ kind: 'parallel', terms: { training: 'allowed', owner: 'the family', speakers_agreed: 'yes' },
      written_by: 'champollion data combine' }));
  fs.writeFileSync(path.join(root, 'data/test/t.tsv'), 'c\td\n');
  fs.writeFileSync(path.join(root, 'data/test/t.tsv.champollion.json'), side({ role: 'test' }));
  fs.mkdirSync(path.join(root, '.forge'));
  fs.writeFileSync(path.join(root, '.forge', 'eval-registry.json'),
    JSON.stringify({ version: 1, sets: { t: { role: 'test', path: path.join(root, 'data/test/t.tsv') }, d: { role: 'dev' } } }));
  fs.writeFileSync(path.join(root, '.forge', 'ledger.jsonl'),
    [{ event: 'audit-verdict' }, { event: 'prereg', set: 't' }].map((e) => JSON.stringify(e)).join('\n') + '\n');
  fs.mkdirSync(path.join(root, 'data', 'clean'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data/clean/combined.clean.jsonl'),
    Array.from({ length: 30 }, (_, i) => JSON.stringify({ i })).join('\n') + '\n');
  fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ run_name: 'r', data: { gold: ['data/split/train.jsonl'], dev: 'd' } }));
  return root;
}

/** forge, stubbed: status says serving; jobs lists the served model; leak-audit writes the clean copy. */
const calls = [];
function forge(root) {
  return (tool, args) => {
    if (args[0] === 'status') {
      return { status: 0, stdout: JSON.stringify({ snapshot: {}, advice: { state: 'serving', why: 'the model is served — try it on its page', next_command: 'npx champollion connect export/model', blockers: [], warnings: [] } }) };
    }
    if (args[0] === 'jobs') {
      return { status: 0, stdout: JSON.stringify([{ kind: 'serve', state: 'running', healthy: true, health_url: 'http://127.0.0.1:8378/health' }]) };
    }
    if (args[0] === 'wishlist') {
      const out = path.join(root, args[args.indexOf('--out') + 1]);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, '# sheet\n');
      calls.push(args);
      return { status: 0, stdout: JSON.stringify({ sheet: out, prompts: 40, text: ['40 prompts: 18 new words, 12 kinds of sentence (questions 12), 10 open — on the sheet.'] }) };
    }
    if (args[0] === 'draft-newer') {
      return { status: 0, stdout: JSON.stringify({ newer: null, in_use: 'r', n: 0 }) };
    }
    if (args[0] === 'speaker-verdict') {
      calls.push(args);
      const n = (flag) => Number(args[args.indexOf(flag) + 1]);
      const clear = n('--newer-right') / n('--newer-judged') > n('--in-use-right') / n('--in-use-judged') + 0.3
        ? 'newer' : 'neither';
      return { status: 0, stdout: JSON.stringify({ clear }) };
    }
    if (args[0] === 'round-plan') {
      return { status: 0, stdout: JSON.stringify({ mode: 'full', epochs: 20, why: 'no model is in use yet',
        text: 'this round trains from the start (20 passes): no model is in use yet' }) };
    }
    if (args[0] === 'leak-audit') {
      const corpus = fs.readFileSync(path.join(root, args[1]), 'utf-8').split('\n').filter(Boolean);
      fs.mkdirSync(path.dirname(path.join(root, args[3])), { recursive: true });
      fs.writeFileSync(path.join(root, args[3]), corpus.map((l) => JSON.stringify({ source: l.split('\t')[0], target: l.split('\t')[1] })).join('\n') + '\n');
      return { status: 0, stdout: JSON.stringify({ kept: corpus.length }) };
    }
    return { status: 2, stdout: '', stderr: `unexpected nmt-forge ${args.join(' ')}` };
  };
}

/** the served model, stubbed: a draft per sentence */
const model = async (url, req) => {
  const keys = JSON.parse(req.body).keys;
  return { status: 200, json: async () => ({ translations: Object.fromEntries(Object.keys(keys).map((k) => [k, `draft ${k}`])) }) };
};

const step = (root) => nextStep(root, { findTool: someTool, spawn: forge(root) });

describe('champollion improve — a round on the rails', () => {
  it('walks a whole round: time, sentences, the model\'s drafts, the speaker\'s marks, terms, combine, prepare, train', async () => {
    const root = await servedProject();
    const hooks = { findTool: someTool, spawn: forge(root), fetch: model };

    // a model in use: the improve stage asks the speaker's time first
    let r = step(root);
    assert.ok(r.step.id.startsWith('improve-time:'), r.step.id);
    assert.equal(r.forge.why, 'the model is served — try it on its page');
    assert.equal((await quiet(() => runImprove({ _: ['improve', 'time'], 'per-week': 'two evenings', total: 'a few hundred' }, root))).code, 0);

    // round 1's wishlist: a sheet for the people, only counts on the screen
    r = step(root);
    assert.ok(r.step.id.startsWith('improve-wishlist:') && r.step.mode === 'auto', r.step.id);
    assert.equal(r.step.command, 'champollion improve wishlist');
    const wl = await quiet(() => runImprove({ _: ['improve', 'wishlist'] }, root, hooks));
    assert.equal(wl.code, 0, wl.text);
    assert.match(wl.text, /Round 1 wishlist — 40 prompts: 18 new words/);
    assert.match(wl.text, /improve\/round-1\/to-translate\.txt/);
    const argv = calls[calls.length - 1];
    assert.deepEqual(argv.slice(0, 7), ['wishlist', '--out', 'improve/round-1/wishlist.md', '--n', '40', '--round', '1']);
    assert.ok(!argv.includes('--wanted') && !argv.includes('--lexicon'), 'no sentences or word lists yet');

    // round 1: the people write the sentences they want translated
    r = step(root);
    assert.ok(r.step.id.startsWith('improve-sentences:'), r.step.id);
    assert.equal(r.step.mode, 'human_only');
    assert.match(r.step.say, /^Round 1: write 20 or more English sentences/);
    assert.match(r.step.say, /The wishlist beside it \(wishlist\.md\)/);
    fs.mkdirSync(path.join(root, 'improve/round-1'), { recursive: true });
    fs.writeFileSync(path.join(root, 'improve/round-1/to-translate.txt'), SENTENCES.slice(0, 5).join('\n') + '\n');
    assert.ok(step(root).step.id.startsWith('improve-sentences:'), 'five is not twenty');
    fs.writeFileSync(path.join(root, 'improve/round-1/to-translate.txt'), SENTENCES.join('\n') + '\n');

    // the model in use drafts them onto the speaker's sheet — nothing printed
    r = step(root);
    assert.ok(r.step.id.startsWith('improve-sheet:') && r.step.mode === 'auto', r.step.id);
    const sheet = await quiet(() => runImprove({ _: ['improve', 'sheet'] }, root, hooks));
    assert.equal(sheet.code, 0, sheet.text);
    assert.match(sheet.text, /Round 1: 20 sentence\(s\) drafted/);
    assert.ok(!sheet.text.includes('fish'), 'never a sentence on the screen');
    const csv = fs.readFileSync(path.join(root, 'improve/round-1/review.csv'), 'utf-8');
    assert.ok(csv.startsWith('﻿#,English'), 'a spreadsheet-friendly sheet with its header');
    assert.equal(csv.trim().split('\r\n').length, 21);

    // the speaker marks it: until most drafts are marked, it is their step
    r = step(root);
    assert.ok(r.step.id.startsWith('improve-marks:') && r.step.mode === 'human_only', r.step.id);
    const lines = csv.replace('﻿', '').trim().split('\r\n');
    const marked = lines.map((l, i) => {
      if (i === 0) return l;
      const cells = l.split(',');
      const mark = i <= 6 ? 'Y' : i <= 18 ? 'N' : '?';
      const fix = i > 6 && i <= 16 ? `zub fixed ${i}` : '';
      return [cells[0], cells[1], cells[2], mark, fix, ''].join(',');
    });
    fs.writeFileSync(path.join(root, 'improve/round-1/review.csv'), marked.join('\r\n') + '\r\n');

    // reading the marks: the speaker's verdict counted, the pairs added
    r = step(root);
    assert.ok(r.step.id.startsWith('improve-read-marks:'), r.step.id);
    const m = await quiet(() => runImprove({ _: ['improve', 'marks'] }, root, hooks));
    assert.equal(m.code, 0, m.text);
    assert.match(m.text, /20 draft\(s\) — 6 right, 12 wrong, 2 unsure/);
    assert.match(m.text, /Right on 33% of the drafts the speaker judged \(95% interval 16%–56%\)/);
    assert.match(m.text, /16 new training pair\(s\) — 6 confirmed draft\(s\) and 10 fix\(es\)/);
    assert.ok(!m.text.includes('fish') && !m.text.includes('zub'), 'never a sentence');
    const rec = JSON.parse(fs.readFileSync(path.join(root, 'improve/round-1/marks.json'), 'utf-8'));
    assert.deepEqual([rec.right, rec.wrong, rec.unsure, rec.fixes, rec.pairs], [6, 12, 2, 10, 16]);
    assert.equal(fs.readFileSync(path.join(root, 'data/parallel/review-round-1.tsv'), 'utf-8').trim().split('\n').length, 16);

    // the new pairs are a new file: the people say who holds them, as for any file
    r = step(root);
    assert.equal(r.step.mode, 'ask_user');
    assert.ok(r.step.id.startsWith('terms:'), r.step.id);
    assert.equal((await quiet(() => runData({ _: ['data', 'mark', 'data/parallel/review-round-1.tsv'], training: 'allowed', 'speakers-agreed': 'yes',
      owner: 'Grandpa', 'local-only': true }, root))).code, 0);
    // … and the round's pairs join the corpus (version 2)
    r = step(root);
    assert.equal(r.step.command, 'champollion data combine');
    assert.equal((await quiet(() => runData({ _: ['data', 'combine'] }, root))).code, 0);

    // the round's report: what the speaker's marks say, with units, and what to do next
    r = step(root);
    assert.ok(r.step.id.startsWith('improve-report:') && r.step.mode === 'auto', r.step.id);
    assert.match(r.step.say, /each number with its unit/);
    const rep = await quiet(() => runImprove({ _: ['improve', 'report'] }, root, hooks));
    assert.equal(rep.code, 0, rep.text);
    assert.match(rep.text, /Round 1: the speaker marked 6 of 18 drafts of new sentences right — 33%/);
    assert.ok(!rep.text.includes('fish') && !rep.text.includes('zub'), 'never a sentence');

    // the round's training file, screened, and the config pointed at it
    r = step(root);
    assert.ok(r.step.id.startsWith('improve-prepare:'), r.step.id);
    const prep = await quiet(() => runImprove({ _: ['improve', 'prepare'] }, root, hooks));
    assert.equal(prep.code, 0, prep.text);
    assert.match(prep.text, /data\/split\/train-r1\.jsonl — 18 pair\(s\)/);
    assert.match(prep.text, /This round trains from the start \(20 passes\): no model is in use yet/);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf-8')).data.gold, ['data/split/train-r1.jsonl']);

    // training is asked for (it spends compute)
    r = step(root);
    assert.ok(r.step.id.startsWith('improve-train:') && r.step.mode === 'confirm', r.step.id);
    assert.match(r.step.command, /nmt-forge run config\.json --detach/);
    // a run on the current training file ends the round's steps here; forge judges it
    const run = path.join(root, '.forge/runs/r-abc');
    fs.mkdirSync(run, { recursive: true });
    fs.writeFileSync(path.join(run, 'run-manifest.json'), JSON.stringify({ run_identity: { training_files: {
      'data/split/train-r1.jsonl': sha256File(path.join(root, 'data/split/train-r1.jsonl')) } } }));
    assert.ok(trainedOnCurrent(root));
    r = step(root);
    assert.equal(r.step, null);

    // forge's verdict starts round 2, relayed as forge wrote it
    fs.appendFileSync(path.join(root, '.forge/ledger.jsonl'), JSON.stringify({ event: 'improve-compare', round: 1,
      verdict: 'no-change', text: 'round 1: no measurable change: keep the model in use.' }) + '\n');
    assert.equal(currentRound(root), 2);
    r = step(root);
    assert.ok(r.step.id.startsWith('improve-wishlist:'), r.step.id);
    assert.match(r.step.say, /^Round 1's result: round 1: no measurable change: keep the model in use\. Make round 2's wishlist/);
    assert.equal((await quiet(() => runImprove({ _: ['improve', 'wishlist'], prompts: '30' }, root, hooks))).code, 0);
    const argv2 = calls[calls.length - 1];
    assert.equal(argv2[argv2.indexOf('--n') + 1], '30');
    assert.deepEqual(argv2.slice(argv2.indexOf('--wanted'), argv2.indexOf('--wanted') + 2),
      ['--wanted', 'improve/round-1/to-translate.txt'], 'last round\'s sentences: words they want come first');
    r = step(root);
    assert.ok(r.step.id.startsWith('improve-sentences:'), r.step.id);
    assert.match(r.step.say, /^Round 2: write/);
    assert.match(r.step.say, /improve\/round-2\/to-translate\.txt/);
  });

  it('practice rows: one row in two under 50 dev sentences, one in four under 200; the speaker writes them; they grow the dev set when the speakers agreed', async () => {
    // under 50 no round verdict decides (forge MIN_DECIDING; stress test 6): fill it faster
    assert.deepEqual(practiceRows(20, 30), [1, 3, 5, 7, 9, 11, 13, 15, 17, 19]);
    assert.deepEqual(practiceRows(20, 50), [3, 7, 11, 15, 19]);
    assert.deepEqual(practiceRows(20, 198), [3, 7], 'only up to 200');
    assert.deepEqual(practiceRows(20, 200), []);
    const root = await servedProject();
    fs.mkdirSync(path.join(root, 'data/split'), { recursive: true });
    fs.writeFileSync(path.join(root, 'data/split/dev.jsonl'), '{}\n'.repeat(60));
    fs.writeFileSync(path.join(root, '.forge/eval-registry.json'), JSON.stringify({ version: 1, sets: {
      t: { role: 'test', path: path.join(root, 'data/test/t.tsv') }, d: { role: 'dev', path: 'data/split/dev.jsonl' } } }));
    fs.mkdirSync(path.join(root, 'improve/round-1'), { recursive: true });
    fs.writeFileSync(path.join(root, 'improve/round-1/to-translate.txt'), SENTENCES.join('\n') + '\n');
    let asked = null;
    const seen = async (url, req) => {
      asked = Object.keys(JSON.parse(req.body).keys);
      return model(url, req);
    };
    const grown = [];
    const spawn = (tool, args, opts) => {
      if (args[0] === 'grow-dev') {
        grown.push(args);
        return { status: 0, stdout: JSON.stringify({ set: 'd', before: 60, added: 5, after: 65 }) };
      }
      return forge(root)(tool, args, opts);
    };
    const hooks = { findTool: someTool, spawn, fetch: seen };
    const sheet = await quiet(() => runImprove({ _: ['improve', 'sheet'] }, root, hooks));
    assert.equal(sheet.code, 0, sheet.text);
    assert.match(sheet.text, /Round 1: 15 sentence\(s\) drafted/);
    assert.match(sheet.text, /5 row\(s\) have no draft: the speaker writes how each is said/);
    assert.match(sheet.text, /\(now 60, growing to 200\)/);
    assert.equal(asked.length, 15);
    assert.ok(!asked.includes('l3') && !asked.includes('l19'), 'the model never drafts a practice row');
    const csv = fs.readFileSync(path.join(root, 'improve/round-1/review.csv'), 'utf-8').replace('\ufeff', '').trim().split('\r\n');
    assert.ok(csv[4].includes(PRACTICE_MARK) && !csv[1].includes(PRACTICE_MARK));
    // the speaker: drafts marked (Y for the first 5, N with a fix after), practice rows written
    const filled = csv.map((l, i) => {
      if (i === 0) return l;
      const cells = l.split(',');
      if (cells[2] === PRACTICE_MARK) return [cells[0], cells[1], cells[2], 'Y', `zub own ${i}`, ''].join(',');
      return [cells[0], cells[1], cells[2], i <= 6 ? 'Y' : 'N', i <= 6 ? '' : `zub fixed ${i}`, ''].join(',');
    });
    fs.writeFileSync(path.join(root, 'improve/round-1/review.csv'), filled.join('\r\n') + '\r\n');
    const s = readSheet(path.join(root, 'improve/round-1'));
    assert.equal(s.rows.filter((r) => r.practice).length, 5);
    assert.ok(s.rows.filter((r) => r.practice).every((r) => r.mark === null), 'a Y on a practice row means nothing');
    const m = await quiet(() => runImprove({ _: ['improve', 'marks'] }, root, hooks));
    assert.equal(m.code, 0, m.text);
    assert.match(m.text, /15 draft\(s\) — 5 right, 10 wrong/);
    assert.match(m.text, /5 practice sentence\(s\) the speaker wrote → data\/dev\/practice-round-1\.tsv/);
    assert.ok(!m.text.includes('zub') && !m.text.includes('fish'), 'never a sentence');
    const practice = fs.readFileSync(path.join(root, 'data/dev/practice-round-1.tsv'), 'utf-8').trim().split('\n');
    assert.equal(practice.length, 5);
    const side = JSON.parse(fs.readFileSync(path.join(root, 'data/dev/practice-round-1.tsv.champollion.json'), 'utf-8'));
    assert.equal(side.role, 'dev');
    assert.equal(side.transmission, 'local-only');
    assert.equal(side.terms.training, 'not-allowed');
    assert.deepEqual(side['x-practice'], { round: 1, rows: 5, review_pairs: 'data/parallel/review-round-1.tsv' });
    const rec = JSON.parse(fs.readFileSync(path.join(root, 'improve/round-1/marks.json'), 'utf-8'));
    assert.deepEqual([rec.right, rec.wrong, rec.practice, rec.pairs], [5, 10, 5, 15]);
    // the review pairs' speakers have not all agreed: the practice sentences wait too
    fs.mkdirSync(path.join(root, 'data/combined-from'), { recursive: true });
    fs.renameSync(path.join(root, 'data/parallel/review-round-1.tsv'), path.join(root, 'data/combined-from/review-round-1.tsv'));
    const reviewSide = path.join(root, 'data/combined-from/review-round-1.tsv.champollion.json');
    fs.renameSync(path.join(root, 'data/parallel/review-round-1.tsv.champollion.json'), reviewSide);
    const setTerms = (terms) => {
      const d = JSON.parse(fs.readFileSync(reviewSide, 'utf-8'));
      fs.writeFileSync(reviewSide, JSON.stringify({ ...d, terms }));
    };
    setTerms({ training: 'not-allowed', speakers: 'grandpa and his sister', speakers_agreed: 'not-yet' });
    let prep = await quiet(() => runImprove({ _: ['improve', 'prepare'] }, root, hooks));
    assert.equal(prep.code, 0, prep.text);
    assert.equal(grown.length, 0, 'not grown while the speakers have not all agreed');
    assert.match(prep.text, /practice sentences held back — data\/dev\/practice-round-1\.tsv: the speakers of review-round-1\.tsv have not all agreed \(not-yet\)/);
    // once they have, the practice set grows — before the training file is screened against it
    setTerms({ training: 'allowed', speakers: 'grandpa and his sister', speakers_agreed: 'yes' });
    prep = await quiet(() => runImprove({ _: ['improve', 'prepare'] }, root, hooks));
    assert.equal(prep.code, 0, prep.text);
    assert.deepEqual(grown[0], ['grow-dev', 'data/dev/practice-round-1.tsv', '--set', 'd', '--json']);
    assert.match(prep.text, /the practice set: 60 → 65 sentences/);
    const prepared = JSON.parse(fs.readFileSync(path.join(root, 'improve/round-1/prepared.json'), 'utf-8'));
    assert.deepEqual([prepared.dev_before, prepared.dev_after], [60, 65]);
  });

  it('a newer model not in use drafts half the rows, unmarked; the speaker judges both blind', async () => {
    const root = await servedProject();
    fs.mkdirSync(path.join(root, 'improve/round-1'), { recursive: true });
    fs.writeFileSync(path.join(root, 'improve/round-1/to-translate.txt'), SENTENCES.join('\n') + '\n');
    let asked = null;
    const seen = async (url, req) => {
      asked = Object.keys(JSON.parse(req.body).keys);
      return model(url, req);
    };
    const spawn = (tool, args, opts) => {
      if (args[0] === 'draft-newer') {
        const lines = fs.readFileSync(path.join(root, args[1]), 'utf-8').split('\n').filter(Boolean);
        fs.writeFileSync(path.join(root, args[3]), lines.map((l, i) => JSON.stringify({ row: i, draft: `newer ${i}` }))
          .join('\n') + '\n');
        return { status: 0, stdout: JSON.stringify({ newer: 'r2', in_use: 'r1', n: lines.length }) };
      }
      return forge(root)(tool, args, opts);
    };
    const hooks = { findTool: someTool, spawn, fetch: seen };
    const sheet = await quiet(() => runImprove({ _: ['improve', 'sheet'] }, root, hooks));
    assert.equal(sheet.code, 0, sheet.text);
    assert.match(sheet.text, /10 sentence\(s\) drafted by the model in use and 10 by the newer model \(not in use yet\) — mixed in at random and not marked/);
    assert.equal(asked.length, 10, 'the model in use drafts only its half');
    const key = JSON.parse(fs.readFileSync(path.join(root, 'improve/round-1/sheet-key.json'), 'utf-8'));
    // a forge before 2026-10-13 names only a newer model: read as one
    assert.equal(key.other, 'r2');
    assert.equal(key.relation, 'newer');
    assert.equal(key.other_rows.length, 10);
    const csv = fs.readFileSync(path.join(root, 'improve/round-1/review.csv'), 'utf-8').replace('\ufeff', '');
    assert.ok(!/r2|newer model/.test(csv.split('\r\n').slice(1).map((l) => l.split(',')[3]).join('')), 'nothing on the sheet says which');
    assert.ok(!fs.existsSync(path.join(root, 'improve/round-1/.newer-lines.txt')), 'the scratch files are gone');
    // the speaker: every newer draft right, every in-use draft wrong (with a fix)
    const rows = csv.trim().split('\r\n');
    const marked = rows.map((l, i) => {
      if (i === 0) return l;
      const c = l.split(',');
      const isNewer = key.other_rows.includes(Number(c[0]));
      return [c[0], c[1], c[2], isNewer ? 'Y' : 'N', isNewer ? '' : `zub fixed ${i}`, ''].join(',');
    });
    fs.writeFileSync(path.join(root, 'improve/round-1/review.csv'), marked.join('\r\n') + '\r\n');
    const m = await quiet(() => runImprove({ _: ['improve', 'marks'] }, root, hooks));
    assert.equal(m.code, 0, m.text);
    assert.match(m.text, /10 draft\(s\) — 0 right, 10 wrong/, 'the progress measure is the model in use\'s');
    assert.match(m.text, /Blind, on new sentences: the model in use was marked right on 0 of 10 \(0%\), the newer model \(not in use\) on 10 of 10 \(100%\) — the newer model is clearly better/);
    assert.match(m.text, /20 new training pair\(s\) — 10 confirmed draft\(s\) and 10 fix\(es\)/);
    const rec = JSON.parse(fs.readFileSync(path.join(root, 'improve/round-1/marks.json'), 'utf-8'));
    assert.equal(rec.blind.clear, 'newer');
    assert.equal(rec.blind.newer_share, 1, 'the names the newer-model comparison always carried');
    // recorded with forge, counts only: where the practice set is too small,
    // the speaker's clear preference lets forge offer the newer model for use
    const sv = calls.find((c) => c[0] === 'speaker-verdict');
    assert.deepEqual(sv, ['speaker-verdict', '--newer', 'r2', '--in-use', 'r1', '--newer-right', '10',
      '--newer-judged', '10', '--in-use-right', '0', '--in-use-judged', '10', '--json']);
    assert.match(m.text, /forge recorded it: it offers to put the newer model to use \(the people say yes first\)/);
    assert.ok(!m.text.includes('fish') && !m.text.includes('zub'), 'never a sentence');
  });

  it('after a promotion the model it replaced drafts the blind half: the speaker checks the change on the same visit', async () => {
    // stress test 12 (2026-10-13): a promotion the practice set got wrong by
    // chance, plus marking that grew kinder, read as "Real progress"
    const root = await servedProject();
    fs.mkdirSync(path.join(root, 'improve/round-1'), { recursive: true });
    fs.writeFileSync(path.join(root, 'improve/round-1/to-translate.txt'), SENTENCES.join('\n') + '\n');
    const spawn = (tool, args, opts) => {
      if (args[0] === 'draft-newer') {
        const lines = fs.readFileSync(path.join(root, args[1]), 'utf-8').split('\n').filter(Boolean);
        fs.writeFileSync(path.join(root, args[3]), lines.map((l, i) => JSON.stringify({ row: i, draft: `before ${i}` }))
          .join('\n') + '\n');
        return { status: 0, stdout: JSON.stringify({ other: 'r1', relation: 'replaced', newer: null, in_use: 'r2',
          in_use_pairs: 400, other_pairs: 300, n: lines.length }) };
      }
      return forge(root)(tool, args, opts);
    };
    const hooks = { findTool: someTool, spawn, fetch: model };
    const sheet = await quiet(() => runImprove({ _: ['improve', 'sheet'] }, root, hooks));
    assert.equal(sheet.code, 0, sheet.text);
    assert.match(sheet.text, /and 10 by the model the one in use replaced — mixed in at random and not marked/);
    const key = JSON.parse(fs.readFileSync(path.join(root, 'improve/round-1/sheet-key.json'), 'utf-8'));
    assert.deepEqual([key.other, key.relation, key.in_use_pairs, key.other_pairs], ['r1', 'replaced', 400, 300]);
    const csv = fs.readFileSync(path.join(root, 'improve/round-1/review.csv'), 'utf-8').replace('﻿', '');
    const marked = csv.trim().split('\r\n').map((l, i) => {
      if (i === 0) return l;
      const c = l.split(',');
      const before = key.other_rows.includes(Number(c[0]));
      return [c[0], c[1], c[2], before ? 'N' : 'Y', before ? `zub fixed ${i}` : '', ''].join(',');
    });
    fs.writeFileSync(path.join(root, 'improve/round-1/review.csv'), marked.join('\r\n') + '\r\n');
    const m = await quiet(() => runImprove({ _: ['improve', 'marks'] }, root, hooks));
    assert.equal(m.code, 0, m.text);
    assert.match(m.text, /the model put to use last was marked right on 10 of 10 \(100%\), the model it replaced on 0 of 10 \(0%\) — the new model is clearly better/);
    const rec = JSON.parse(fs.readFileSync(path.join(root, 'improve/round-1/marks.json'), 'utf-8'));
    assert.deepEqual([rec.blind.relation, rec.blind.clear, rec.blind.in_use_pairs, rec.blind.other_pairs, rec.in_use_pairs],
      ['replaced', 'in-use', 400, 300, 400]);
    assert.equal(rec.blind.newer_share, undefined, 'no "newer" names for the model it replaced');
  });

  it('rows come back from earlier sheets, announced; the speaker\'s agreement with themselves is counted apart (decision 7)', async () => {
    const root = await servedProject();
    const ledger = path.join(root, '.forge/ledger.jsonl');
    // round 1, marked: rows 1–10 right, 11–20 wrong
    fs.mkdirSync(path.join(root, 'improve/round-1'), { recursive: true });
    fs.writeFileSync(path.join(root, 'improve/round-1/review.csv'), [SHEET_HEADER.map((c) => `"${c}"`).join(','),
      ...SENTENCES.map((s, i) => [i + 1, s, `draft one ${i}`, i < 10 ? 'Y' : 'N', i < 10 ? '' : `zub ${i}`, ''].join(','))]
      .join('\r\n') + '\r\n');
    fs.writeFileSync(path.join(root, 'improve/round-1/sheet-key.json'), JSON.stringify({ round: 1, other_rows: [] }));
    fs.appendFileSync(ledger, JSON.stringify({ event: 'improve-compare', round: 1, verdict: 'too-few' }) + '\n');
    // round 2: twenty new sentences — two rows come back
    fs.mkdirSync(path.join(root, 'improve/round-2'), { recursive: true });
    fs.writeFileSync(path.join(root, 'improve/round-2/to-translate.txt'),
      SENTENCES.map((s) => s.replace('fish', 'bread')).join('\n') + '\n');
    const hooks = { findTool: someTool, spawn: forge(root), fetch: model };
    const sheet = await quiet(() => runImprove({ _: ['improve', 'sheet'] }, root, hooks));
    assert.equal(sheet.code, 0, sheet.text);
    assert.match(sheet.text, /2 row\(s\) come back from earlier sheets on purpose, as the sheet says at the top/);
    assert.ok(!sheet.text.includes('fish') && !sheet.text.includes('bread'), 'never a sentence on the screen');
    const key = JSON.parse(fs.readFileSync(path.join(root, 'improve/round-2/sheet-key.json'), 'utf-8'));
    assert.equal(key.repeat_rows.length, 2);
    assert.ok(key.repeat_rows.every((x) => x.from_round === 1 && x.mark === (x.from_row <= 10 ? 'Y' : 'N')));
    const lines = fs.readFileSync(path.join(root, 'improve/round-2/review.csv'), 'utf-8').replace('﻿', '').trim()
      .split('\r\n');
    assert.ok(lines[0].includes('come back from earlier sheets on purpose'), 'announced at the top');
    assert.ok(lines[1].startsWith('#,English'));
    assert.equal(lines.length, 2 + 22);
    // the speaker marks: the first repeat as before, the second the other way;
    // every new draft right
    const [first, second] = key.repeat_rows;
    const flip = (m) => (m === 'Y' ? 'N' : 'Y');
    const marked = lines.map((l, i) => {
      if (i < 2) return l;
      const c = l.split(',');
      const n = Number(c[0]);
      const mark = n === first.row ? first.mark : n === second.row ? flip(second.mark) : 'Y';
      return [c[0], c[1], c[2], mark, '', ''].join(',');
    });
    fs.writeFileSync(path.join(root, 'improve/round-2/review.csv'), marked.join('\r\n') + '\r\n');
    const m = await quiet(() => runImprove({ _: ['improve', 'marks'] }, root, hooks));
    assert.equal(m.code, 0, m.text);
    assert.match(m.text, /20 draft\(s\) — 20 right, 0 wrong/, 'the repeats are not this round\'s drafts');
    assert.match(m.text, /Rows shown again: the speaker marked 1 of 2 the way they did before \(50%\)/);
    const rec = JSON.parse(fs.readFileSync(path.join(root, 'improve/round-2/marks.json'), 'utf-8'));
    assert.deepEqual([rec.drafts, rec.pairs, rec.repeats.shown, rec.repeats.judged, rec.repeats.agreed],
      [20, 20, 2, 2, 1], 'never trained on again');
    // pooled over rounds: the speaker's error, once enough rows came back
    assert.equal(markingError([rec]), null, `under ${MIN_REPEATS} judged`);
    const est = markingError([{ repeats: { judged: 20, agreed: 18, wrong_to_right: 1, right_to_wrong: 1 } }]);
    assert.equal(Math.round(est.error * 1000), 53, 'agreement 90% ⇒ about 5% of marks go the other way');
  });

  it('the blind comparison says a difference only when it is clear', () => {
    assert.equal(blindComparison(5, 5, 6, 4).clear, 'neither');
    assert.equal(blindComparison(2, 18, 16, 4).clear, 'newer');
    assert.equal(blindComparison(16, 4, 2, 18).clear, 'in-use');
    assert.equal(blindComparison(2, 18, 16, 4, 'replaced').clear, 'replaced');
    assert.match(blindComparison(2, 18, 16, 4, 'replaced').text, /the model it replaced was clearly better/);
    assert.match(blindComparison(5, 5, 6, 4).text, /no clear difference on 20 sentences/);
  });

  it('marks are read the ways people write them, and the interval is Wilson\'s', () => {
    assert.deepEqual(['Y', 'yes', '✓', 'n', 'No', 'x', '?', 'not sure', ''].map(readMark),
      ['Y', 'Y', 'Y', 'N', 'N', 'N', '?', '?', null]);
    const [lo, hi] = wilson(6, 18);
    assert.ok(Math.abs(lo - 0.163) < 0.002 && Math.abs(hi - 0.564) < 0.002, `${lo} ${hi}`);
    assert.deepEqual(wilson(0, 0), [0, 0]);
  });

  it('refuses what it cannot do yet, and says the step that comes first', async () => {
    const root = await servedProject();
    const hooks = { findTool: someTool, spawn: forge(root), fetch: model };
    assert.equal((await quiet(() => runImprove({ _: ['improve', 'time'] }, root))).code, 1);
    const noSentences = await quiet(() => runImprove({ _: ['improve', 'sheet'] }, root, hooks));
    assert.match(noSentences.text, /round 1: no improve\/round-1\/to-translate\.txt yet/);
    const noSheet = await quiet(() => runImprove({ _: ['improve', 'marks'] }, root, hooks));
    assert.match(noSheet.text, /no review sheet/);
    fs.writeFileSync(path.join(root, 'data/parallel/extra.tsv'), 'a\tb\n');
    const two = await quiet(() => runImprove({ _: ['improve', 'prepare'] }, root, hooks));
    assert.match(two.text, /combine them first/);
    const notServed = { findTool: someTool, spawn: () => ({ status: 0, stdout: '[]' }), fetch: model };
    fs.mkdirSync(path.join(root, 'improve/round-1'), { recursive: true });
    fs.writeFileSync(path.join(root, 'improve/round-1/to-translate.txt'), 'One.\n');
    assert.match((await quiet(() => runImprove({ _: ['improve', 'sheet'] }, root, notServed))).text,
      /no model is being served/);
  });

  it('the sheet header is what the marks reader expects', () => {
    assert.ok(SHEET_HEADER[1].startsWith('English') && /Right\?/.test(SHEET_HEADER[3]));
  });

  it('what the speaker\'s time looks like it can buy — said only from a measurable trend, plainly when it is too little', async () => {
    const root = await servedProject();
    const ledger = path.join(root, '.forge/ledger.jsonl');
    const before = fs.readFileSync(ledger, 'utf-8');
    const rounds = (accs, total = 'maybe 800 sentences all told', verdict = 'better', checked = true) => {
      writeRounds(root, ledger, before, { accs, total, perWeek: 'thirty a visit, twice a week', checked });
      accs.forEach((a, i) => verdictRound(ledger, i, verdict, { text: 'x' }));
    };
    rounds([0.05, 0.1]);
    assert.equal(timeNote(root), 'So far the speaker has checked 120 drafts, of the about 800 sentences they said they can give in all. ',
      'two rounds: counts, no projection');
    rounds([0.05, 0.08, 0.1]);
    assert.match(timeNote(root), /has not measurably risen \(5% in round 1, 10% in round 3\)/);
    // 200, 400, 800 training pairs; each promotion checked blind against the model it replaced
    rounds([0.05, 0.25, 0.45], 'maybe 2000 sentences');
    const note = timeNote(root);
    assert.match(note, /at 45% of drafts right now, doubling to 1,600 training sentences would make it about 76%/);
    assert.match(note, /about 980 more than the 800 now \(from what the checks so far can tell, somewhere between 540 and 4,000\), roughly 19 hours/);
    assert.ok(!/more than the time they said is left/.test(note), '980 fits in 2,000 − 180');
    // promoted, but never checked blind against the model it replaced: no projection (stress test 12)
    rounds([0.05, 0.25, 0.45], 'maybe 800', 'better', false);
    assert.match(timeNote(root), /No projection yet: the speaker's blind check has not yet shown the new model beating/);
    // the same model in use all along: the rise is the sentences', not the model's (critique finding 2)
    rounds([0.05, 0.25, 0.45], 'maybe 800', 'no-change', false);
    assert.match(timeNote(root), /rose while the same model was in use, so the rise says nothing yet/);
    rounds([0.02, 0.1, 0.18], 'maybe 300');
    assert.match(timeNote(root), /about 3,000 more than the 800 now .*That is more than the time they said is left: tell them plainly/);
    // and it travels with the round's writing step, beside their own words
    const r = nextStep(root, { findTool: someTool, spawn: forge(root) });
    assert.ok(r.step.id.startsWith('improve-wishlist:'), r.step.id);
    assert.equal(currentRound(root), 4);
    fs.mkdirSync(path.join(root, 'improve/round-4'), { recursive: true });
    fs.writeFileSync(path.join(root, 'improve/round-4/wishlist.md'), '# sheet\n');
    const w = nextStep(root, { findTool: someTool, spawn: forge(root) });
    assert.ok(w.step.id.startsWith('improve-sentences:'), w.step.id);
    assert.match(w.step.say, /^So far the speaker has checked 180 drafts/);
    assert.match(w.step.say, /\(they said: thirty a visit, twice a week\)/);
  });

  it('the round report: progress with units, a check that gains are real, a projection, things to do', async () => {
    const root = await servedProject();
    const ledger = path.join(root, '.forge/ledger.jsonl');
    const before = fs.readFileSync(ledger, 'utf-8');
    const rounds = (accs, devs, total = 'maybe 800 sentences all told', checked = true) => {
      writeRounds(root, ledger, before, { accs, total, checked });
      devs.forEach(([inUse, neu, verdict, detectable], i) => verdictRound(ledger, i, verdict, {
        n: 23, score_in_use: inUse, score_new: neu, text: 'x', ...(detectable != null ? { detectable } : {}) }));
    };
    // a real rise: progress first, every measure with its unit, a projection in sentences and hours
    rounds([0.05, 0.25, 0.45], [[12.7, 15.3, 'better'], [15.3, 19.0, 'better']]);
    let r = roundReport(root);
    assert.equal(r.round, 3);
    assert.match(r.progress[0], /^Real progress: the speaker marked 5% of new drafts right in round 1 and 45% in round 3 .* marked the new model right more often than the one it replaced \(35% against 15%, on 240 drafts\)/);
    assert.ok(r.progress.some((l) => /Round 3: the speaker marked 27 of 60 drafts of new sentences right — 45% \(95% range \d+%–\d+%\)/.test(l)));
    assert.ok(r.progress.some((l) => /on the same 23 practice \(dev\) sentences, chrF\+\+ \(0–100, overlap with the checked translation\) 19 for the new model against 15\.3/.test(l)));
    assert.match(r.projection, /80% right \(working\) needs about 1,800 training sentences: about 980 more than the 800 now .* roughly 19 hours/);
    assert.deepEqual(r.projection_numbers, { more_sentences: 984, range: [541, 3981], speaker_hours: 19.1 });
    assert.ok(r.checks.some((c) => /practice set is 23 sentences/.test(c)), 'a small practice set is said');
    assert.ok(r.actions.length >= 1 && r.actions.length <= 4);
    // judged better, but the people never said yes: nothing was put to use,
    // so no progress is claimed for it (2026-10-13)
    writeRounds(root, ledger, before, { accs: [0.05, 0.25, 0.45] });
    [[12.7, 15.3], [15.3, 19.0]].forEach(([u, n], i) => verdictRound(ledger, i, 'better',
      { n: 23, score_in_use: u, score_new: n }, { yes: false }));
    r = roundReport(root);
    assert.ok(!r.progress.some((l) => /^Real progress/.test(l)), r.progress.join(' | '));
    assert.ok(r.progress.some((l) => /measurably better: not put to use — the people have not chosen it/.test(l)));
    assert.match(r.projection, /^No projection: .*the same model was in use/);
    // promoted on the practice set, never checked blind against the model it
    // replaced: the rise is said, not counted as progress (stress test 12)
    rounds([0.05, 0.25, 0.45], [[12.7, 15.3, 'better'], [15.3, 19.0, 'better']], 'maybe 800', false);
    r = roundReport(root);
    assert.ok(!r.progress.some((l) => /^Real progress/.test(l)));
    assert.match(r.progress[0], /a model measured as better on the practice sentences was put to use in between — but the speaker has not yet checked it blind/);
    assert.match(r.projection, /^No projection yet: the speaker's blind check/);
    assert.equal(r.projection_numbers, null);
    // checked blind, and no better than the model it replaced: not progress either
    writeRounds(root, ledger, before, { accs: [0.05, 0.25, 0.45], blind: [null, [0.25, 200], [0.45, 400]] });
    [[12.7, 15.3], [15.3, 19.0]].forEach(([u, n], i) => verdictRound(ledger, i, 'better',
      { n: 23, score_in_use: u, score_new: n }));
    r = roundReport(root);
    assert.match(r.progress[0], /did not mark it clearly better than the one it replaced \(35% against 35%, on 240 drafts\)/);
    // the model it replaced marked clearly better: said, as a thing to ask them
    writeRounds(root, ledger, before, { accs: [0.3, 0.1], blind: [null, [0.5, 200]] });
    verdictRound(ledger, 0, 'better', { n: 23, score_in_use: 10, score_new: 14 });
    r = roundReport(root);
    assert.ok(r.actions.some((a) => /the practice set said better, the family's own sentences say worse/.test(a)), r.actions.join(' | '));
    // gains on the practice set that the speaker's marks do not show: flagged
    rounds([0.2, 0.2], [[12.0, 16.0, 'better']]);
    r = roundReport(root);
    assert.ok(r.checks.some((c) => /practice-set chrF\+\+ rose 4 points while the speaker's marks on new sentences did not/.test(c)));
    assert.match(r.projection, /No projection yet/);
    // more than the time they said they have: said, as a thing to do
    rounds([0.02, 0.1, 0.18], [[10, 11, 'better'], [11, 12.5, 'better']], 'maybe 300');
    r = roundReport(root);
    assert.ok(r.actions.some((a) => /more than the 300 the speaker said they can give in all/.test(a)), r.actions.join(' | '));
    // marks that rose while the same model was in use: not progress, no projection (critique finding 2)
    rounds([0.05, 0.25, 0.45], [[10, 11, 'no-change'], [10, 10.5, 'no-change']]);
    r = roundReport(root);
    assert.ok(!r.progress.some((l) => /^Real progress/.test(l)));
    assert.ok(r.progress.some((l) => /the model in use did not change in between .* Not counted as progress/.test(l)));
    assert.match(r.projection, /^No projection: .*the same model was in use/);
    // two flat rounds on a practice set that cannot see a round's gain: keep going, grow it
    fs.mkdirSync(path.join(root, 'data/split'), { recursive: true });
    fs.writeFileSync(path.join(root, 'data/split/dev.jsonl'), '{}\n'.repeat(23));
    fs.writeFileSync(path.join(root, '.forge/eval-registry.json'), JSON.stringify({ version: 1, sets: {
      t: { role: 'test', path: path.join(root, 'data/test/t.tsv') }, d: { role: 'dev', path: 'data/split/dev.jsonl' } } }));
    rounds([0.1, 0.12], [[10, 11, 'no-change', 7.9], [10, 10.5, 'no-change', 7.6]]);
    r = roundReport(root);
    assert.ok(r.progress.some((l) => /only a difference of about 7\.6 points or more shows reliably/.test(l)), r.progress.join(' | '));
    assert.ok(r.checks.some((c) => /about 7\.6 chrF\+\+ points or more shows reliably.* the practice set's limit/.test(c)));
    assert.ok(r.actions.some((a) => /^Grow the practice set: one sentence in 2 .* \(now 23; 50 lets a round be judged at all, 200 lets/.test(a)), r.actions.join(' | '));
    assert.ok(r.actions.some((a) => /cannot see a round's usual gain: keep going/.test(a)));
    // too few practice sentences to tell, and the people chose the new model on
    // the speaker's blind marks (forge export + choose): put to use, said so
    writeRounds(root, ledger, before, { accs: [0.05, 0.25, 0.45] });
    [['r1', 'r2'], ['r2', 'r3']].forEach(([used, neu], i) => {
      fs.appendFileSync(ledger, JSON.stringify({ event: 'improve-compare', round: i + 1, n: 23, score_in_use: 10,
        score_new: 12, verdict: 'too-few', in_use: used, new: neu }) + '\n');
      fs.appendFileSync(ledger, JSON.stringify({ event: 'export', run: neu, dir: `export/${neu}`,
        model_dir: `export/${neu}/model` }) + '\n');
      fs.appendFileSync(ledger, JSON.stringify({ event: 'improve-speaker', newer: neu, in_use: used, clear: 'newer' })
        + '\n');
      fs.appendFileSync(ledger, JSON.stringify({ event: 'choose', model_dir: `export/${neu}/model` }) + '\n');
    });
    r = roundReport(root);
    assert.ok(r.progress.some((l) => /too few practice sentences to tell \(under 50\) — put to use on the speaker's blind marks/.test(l)),
      r.progress.join(' | '));
    // one words for the report and `improve status` (docs review 2026-10-13):
    // a model chosen by hand after a worse verdict is not "not used"
    assert.equal(verdictWords(root, { verdict: 'worse', new: 'r2' }), 'measurably worse — put to use on the speaker\'s blind marks');
    assert.equal(verdictWords(root, { verdict: 'worse', new: 'r9' }), 'measurably worse: not used');
    fs.appendFileSync(ledger, JSON.stringify({ event: 'export', run: 'r9', dir: 'export/r9', model_dir: 'export/r9/model' })
      + '\n' + JSON.stringify({ event: 'choose', model_dir: 'export/r9/model' }) + '\n');
    assert.equal(verdictWords(root, { verdict: 'worse', new: 'r9' }), 'measurably worse — put to use by the people\'s own choice');
    assert.equal(verdictWords(root, { verdict: 'too-few', new: 'r8' }),
      'too few practice sentences to tell (under 50): the speaker\'s blind marks decide');
    assert.equal(verdictWords(root, { verdict: 'no-change', new: 'r8' }), 'no measurable change: not used');
    assert.match(r.progress[0], /^Real progress:/, 'chosen on the speaker\'s marks is a promotion');
    assert.match(r.progress[0], /a newer model was put to use in between, on the speaker's blind marks\./,
      'said as it happened, not "measured as better"');
    // … and on one that can see 3 points: it cannot tell slow gains from none,
    // and says so — never "may not help" (stress test 11)
    rounds([0.1, 0.12], [[10, 11, 'no-change', 2.1], [10, 10.5, 'no-change', 2.0]]);
    r = roundReport(root);
    assert.ok(r.actions.some((a) => /^Two rounds without a gain this practice set can see \(about 2 chrF\+\+ points or more\): the rounds may be adding less than that, or nothing — it cannot tell which\. Faster ways forward/.test(a)), r.actions.join(' | '));
    assert.ok(!r.actions.some((a) => /may not help/.test(a)));
    assert.ok(!r.actions.some((a) => /Grow the practice set/.test(a)));
    // close to working: the milestone on the locked test set
    rounds([0.5, 0.85], [[30, 60, 'better']]);
    r = roundReport(root);
    assert.ok(r.actions.some((a) => /check it on the locked test set/.test(a)));
    // the command writes it beside the round, and prints no sentence
    const out = await quiet(() => runImprove({ _: ['improve', 'report'] }, root));
    assert.equal(out.code, 0, out.text);
    assert.ok(fs.existsSync(path.join(root, 'improve/round-2/report.json')));
    assert.match(out.text, /How it is going:/);
    assert.match(out.text, /What to do next:/);
    assert.ok(!SENTENCES.some((s) => out.text.includes(s)));
  });
});
