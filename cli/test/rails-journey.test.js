/**
 * rails-journey.test.js — `champollion new`, `next` and `data mark`: a
 * project with a place for everything, THE next step from its files, and
 * terms that only ever get stricter. See lib/framework/journey.js and
 * shared/journeys/language.json.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run as runNew } from '../lib/commands/new.js';
import { run as runData, markedSidecar } from '../lib/commands/data.js';
import { nextStep, loadJourney, CHECK_NAMES, renderNextMd, forgeFacts } from '../lib/framework/journey.js';
import { checkProject, SCHEMA_IDS } from '../lib/framework/index.js';
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

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rails-j1-'));
}

async function newProject(extra = {}) {
  const cwd = tmp();
  const args = { _: ['new', 'proj'], from: 'English', to: 'qaa', 'target-name': 'Our language', ...extra };
  const r = await quiet(() => runNew(args, cwd));
  return { ...r, root: path.join(cwd, 'proj'), cwd };
}

const noTool = () => null;
const someTool = () => '/usr/local/bin/nmt-forge';

describe('what is true right now (forge\'s record, for the agent to say)', () => {
  it('says what was trained, scored and served — and nothing that was not', () => {
    assert.deepEqual(forgeFacts({}), ['No model has been trained yet.',
      'The test set has not been checked for leaks yet: nobody can call it clean.',
      'Not scored on the locked test set yet.', 'No model is being served right now.']);
    const s = {
      runs: [{ selected_checkpoint: 'c1', dev_score: { metric: 'chrf++', score: 18.2 } },
        { selected_checkpoint: 'c2', dev_score: { metric: 'chrf++', score: 21.44 } },
        { selected_checkpoint: null, dev_score: null }],
      exports: [{ score: 19.03 }],
      leak_audits: { test: { severe: [], twins: [], twin_free: null, twin_free_trained: false } },
      jobs: [{ kind: 'train', state: 'finished' },
        { kind: 'serve', state: 'running', healthy: true, health_url: 'http://127.0.0.1:8378/health' }],
    };
    assert.deepEqual(forgeFacts(s), [
      '2 models trained; the best scores chrF++ 21.4 on the practice (dev) sentences.',
      'The leak audit found no "test" test sentences in the training data.',
      'Scored on the locked test set 1 time; the latest: chrF++ 19.0. (chrF++ runs from 0 to 100: how closely the '
        + 'model\'s sentences match the speaker\'s own, character by character — not a percentage of anything; a '
        + 'fluent speaker decides what is good enough.)',
      'A model is being served on this computer: http://127.0.0.1:8378/']);
    // a serve that is down, and a run in progress, are said as they are
    const t = forgeFacts({ ...s, jobs: [{ kind: 'train', state: 'running' },
      { kind: 'serve', state: 'running', healthy: false, health_url: 'http://127.0.0.1:8378/health' }] });
    assert.ok(t.includes('A training run is in progress.'));
    assert.ok(t.includes('No model is being served right now.'));
    // the audit's verdict is said as it is: severe until a run trains on the twin-free file
    const severe = { corpus: 'c.jsonl', n: 40, near_twin_rows: 12 };
    const dirty = forgeFacts({ leak_audits: { test: { severe: [severe], twin_free: { clean_to: 'x' }, twin_free_trained: false } } });
    assert.ok(dirty.some((l) => /copies of "test" test sentences .* not clean until a model is trained on the twin-free file/.test(l)));
    const fixed = forgeFacts({ leak_audits: { test: { severe: [severe], twin_free: { clean_to: 'x' }, twin_free_trained: true } } });
    assert.ok(fixed.some((l) => /only its score is clean/.test(l)));
    const twins = forgeFacts({ leak_audits: { test: { severe: [], twins: [{ near_twin_rows: 3 }, { near_twin_rows: 5 }] } } });
    assert.ok(twins.includes('The leak audit found 5 near-copies of "test" test sentences in the training data (not severe): scores are reported with and without them.'));
  });
});

describe('the language journey (shared/journeys/language.json)', () => {
  it('names only checks the evaluator knows, and every step has a stage', () => {
    const j = loadJourney('language');
    const stages = new Set(j.stages.map((s) => s.id));
    for (const step of j.steps) {
      assert.ok(stages.has(step.stage), `${step.id}: unknown stage ${step.stage}`);
      if (step.delegate) continue;
      assert.ok(CHECK_NAMES.includes(step.done_when.check), `${step.id}: ${step.done_when.check}`);
      assert.ok(['auto', 'confirm', 'ask_user', 'wait', 'human_only'].includes(step.mode), step.id);
    }
  });
});

describe('a file name is data, never part of a command', () => {
  // release-candidate code review, 2026-10-18 (GPT-6.1 Sol): an unquoted name
  // holding " && nmt-forge run … #" made answering a terms question train
  const HOSTILE = 'a && nmt-forge run config.json --detach #.md';
  it('is one quoted argument in the step\'s command', async () => {
    const { root } = await newProject();
    // a pair file with its terms decided, so the rails reach the grammar note's terms
    fs.writeFileSync(path.join(root, 'data', 'parallel', 'pairs.tsv'), 'the dog\tatim\n');
    fs.writeFileSync(path.join(root, 'data', 'parallel', 'pairs.tsv.champollion.json'), JSON.stringify({
      $schema: 'https://champollion.dev/schemas/set/1.json', kind: 'parallel', pair: { source: 'eng', target: 'qaa' },
      transmission: 'local-only', terms: { training: 'allowed', speakers_agreed: 'yes', owner: 'Grandpa', speakers: 'our own' } }));
    fs.writeFileSync(path.join(root, 'data', 'grammar', HOSTILE), 'notes\n');
    const next = nextStep(root, { findTool: noTool });
    assert.equal(next.step.id.split(':')[0], 'terms');
    assert.ok(next.step.command.includes(`"data/grammar/${HOSTILE}"`), next.step.command);
    const outside = next.step.command.replace(`"data/grammar/${HOSTILE}"`, '');
    assert.ok(!outside.includes('&&') && !outside.includes('#'), `nothing outside the quotes acts: ${outside}`);
  });
  it('in a folder forge reads, it is renamed by a person before anything runs', async () => {
    const { root } = await newProject();
    fs.writeFileSync(path.join(root, 'data', 'parallel', HOSTILE.replace('.md', '.tsv')), 'a\tb\n');
    const next = nextStep(root, { findTool: noTool });
    assert.equal(next.step.id.split(':')[0], 'rename-files');
    assert.equal(next.step.mode, 'human_only');
    assert.equal(next.step.command, undefined, 'no command to run');
  });
});

describe('numbers the people wrote, and where a score falls', () => {
  it('is arithmetic said plainly; the verdict stays theirs', async () => {
    const { rangeFact } = await import('../lib/framework/journey.js');
    assert.equal(rangeFact('between 10 and 25', 12.3), ' 12.3 is inside the range 10–25 they wrote.');
    assert.equal(rangeFact('maybe 15 or so', 9.25), ' They wrote 15; it scored 9.3.');
    assert.equal(rangeFact('no idea', 3), '');
  });
});

describe('the test set is every file in data/test', () => {
  it('a second, unmarked file there keeps the test step open', async () => {
    const { root } = await newProject();
    const side = (role) => JSON.stringify({ $schema: 'https://champollion.dev/schemas/set/1.json', kind: 'parallel',
      pair: { source: 'eng', target: 'qaa' }, transmission: 'local-only', ...(role ? { role } : {}),
      terms: { training: 'not-allowed' } });
    fs.writeFileSync(path.join(root, 'data', 'test', 'checked.tsv'), 'a\tb\n');
    fs.writeFileSync(path.join(root, 'data', 'test', 'checked.tsv.champollion.json'), side('test'));
    fs.writeFileSync(path.join(root, 'data', 'test', 'more.tsv'), 'c\td\n');   // dropped in by hand, no sidecar
    const { CHECKS } = await import('../lib/framework/journey.js');
    const check = () => CHECKS.protected_test_set({ root }, { dir: 'data/test' });
    assert.equal(check().done, false, 'not done while data/test/more.tsv is unmarked');
    assert.equal(check().file, 'data/test/more.tsv', 'the step names the unmarked file');
    fs.writeFileSync(path.join(root, 'data', 'test', 'more.tsv.champollion.json'), side('test'));
    assert.equal(check().done, true, 'done once every file there is marked');
  });
});

describe('every forge state has a mode on purpose', () => {
  it('names each advisor state forge can report; an unknown one is a person\'s step', async () => {
    const { FORGE_MODES } = await import('../lib/framework/journey.js');
    const advisor = new URL('../../forge/nmt_forge/advisor.py', import.meta.url);
    if (!fs.existsSync(advisor)) return;              // a standalone CLI checkout
    const states = [...new Set([...fs.readFileSync(advisor, 'utf-8').matchAll(/state="([a-z-]+)"/g)].map((m) => m[1]))];
    const missing = states.filter((st) => !(st in FORGE_MODES));
    assert.deepEqual(missing, [], `forge reports states the journey has not given a mode: ${missing.join(', ')}`);
  });
});

describe('champollion new', () => {
  it('lays out the project and writes valid files', async () => {
    const { code, root } = await newProject({ purpose: 'family phrasebook' });
    assert.equal(code, 0);
    for (const d of ['data/parallel', 'data/test', 'data/lexicon', 'data/grammar', 'data/monolingual', 'consent', 'inbox']) {
      assert.ok(fs.statSync(path.join(root, d)).isDirectory(), d);
    }
    const report = checkProject(root);
    assert.equal(report.ok, true);
    const project = JSON.parse(fs.readFileSync(path.join(root, 'champollion.project.json'), 'utf-8'));
    assert.deepEqual(project.pair, { source: 'eng', target: 'qaa', target_name: 'Our language' });
    assert.equal(project.defaults.transmission, 'local-only');
    assert.match(fs.readFileSync(path.join(root, '.gitignore'), 'utf-8'), /^data\/$/m);
    assert.match(fs.readFileSync(path.join(root, 'README.md'), 'utf-8'), /English → Our language/);
    assert.match(fs.readFileSync(path.join(root, 'NEXT.md'), 'utf-8'),
      /champollion data add <file>` with the file where it is/);
  });

  it('writes AGENTS.md — the operating contract, verbatim from the template — and says so', async () => {
    const { code, root, text } = await newProject();
    assert.equal(code, 0);
    const template = fs.readFileSync(
      new URL('../shared/templates/language/AGENTS.md', import.meta.url), 'utf-8');
    assert.equal(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf-8'), template,
      'AGENTS.md is the template, unchanged');
    assert.match(template, /^# AGENTS\.md — the rails' operating contract$/m);
    assert.match(template, /https:\/\/champollion\.dev\/docs\/agents\/contract/);
    assert.match(text, /AGENTS\.md\s+the rules an AI agent helping here works under/);
    // AGENTS.md is not data: the journey's next step is the same as before
    assert.match(fs.readFileSync(path.join(root, 'NEXT.md'), 'utf-8'),
      /champollion data add <file>` with the file where it is/);
  });

  it('a name no card carries ends its refusal with the one command that works', async () => {
    // E5 (2026-10-18): nine models of every size wrote --to "Our language" first
    const r = await newProject({ to: 'Our language', 'target-name': undefined });
    assert.equal(r.code, 2);
    assert.match(r.text, /If "Our language" has no code: champollion new proj --from English --to qaa --target-name "Our language"/);
    const again = await newProject({ to: 'qaa', 'target-name': 'Our language' });
    assert.equal(again.code, 0, 'the command the refusal gives runs');
  });

  it('resolves a name through the cards', async () => {
    const { code, root } = await newProject({ to: 'Plains Cree', 'target-name': undefined });
    assert.equal(code, 0);
    const project = JSON.parse(fs.readFileSync(path.join(root, 'champollion.project.json'), 'utf-8'));
    assert.equal(project.pair.target, 'crk');
    assert.ok(!('target_name' in project.pair), 'a card names crk; no name is stored');
  });

  it('resolves another name a registry records, and says what it took it for', async () => {
    // SIL langtags calls Siksika "Blackfoot"; the card displays Siksika.
    const { code, root, text } = await newProject({ to: 'Blackfoot', 'target-name': undefined });
    assert.equal(code, 0);
    const project = JSON.parse(fs.readFileSync(path.join(root, 'champollion.project.json'), 'utf-8'));
    assert.equal(project.pair.target, 'bla');
    assert.match(text, /"Blackfoot" is another name for this language \(sil-langtags[^)]*\): Siksika \(bla\)/);
    // a name several languages carry is refused with the choices, never picked
    const dene = await newProject({ to: 'Dene', 'target-name': undefined });
    assert.equal(dene.code, 2);
    assert.match(dene.text, /Chipewyan \(chp\)/);
    assert.ok(!fs.existsSync(dene.root), 'no project is started on a guess');
  });

  it('refuses a private-use code without a name, an unknown language, and kinds not on the rails', async () => {
    assert.equal((await newProject({ 'target-name': undefined })).code, 2);
    assert.equal((await newProject({ to: 'Notalanguageatall' })).code, 2);
    const task = await newProject({ kind: 'task' });
    assert.equal(task.code, 2);
    assert.match(task.text, /not on the rails yet/);
  });

  it('never overwrites: an existing project or a folder with files is refused', async () => {
    const { root, cwd } = await newProject();
    const again = await quiet(() => runNew({ _: ['new', 'proj'], from: 'eng', to: 'crk' }, cwd));
    assert.equal(again.code, 1);
    assert.match(again.text, /already a project/);
    const busy = path.join(cwd, 'busy');
    fs.mkdirSync(busy);
    fs.writeFileSync(path.join(busy, 'notes.txt'), 'x');
    assert.equal((await quiet(() => runNew({ _: ['new', 'busy'], from: 'eng', to: 'crk' }, cwd))).code, 1);
    assert.ok(fs.existsSync(path.join(root, 'champollion.project.json')));
  });
});

describe('champollion next — walking the rails', () => {
  it('gather → terms → test file → mark the test set → tools → workshop → register → forge', async () => {
    const { root } = await newProject();
    const at = (hooks = { findTool: noTool }) => nextStep(root, hooks);

    let r = at();
    assert.equal(r.step.mode, 'human_only');
    assert.equal(r.stage.id, 'gather');

    fs.writeFileSync(path.join(root, 'data/parallel/pairs.tsv'), 'Good morning.\tzub kef\n');
    r = at();
    assert.equal(r.step.mode, 'ask_user');
    assert.equal(r.step.file, 'data/parallel/pairs.tsv');
    assert.match(r.step.command, /^champollion data mark data\/parallel\/pairs\.tsv --speakers "\{speakers\}" --speakers-agreed \{speakers_agreed\} --owner "\{owner\}"/);
    assert.deepEqual(Object.keys(r.step.answers), ['speakers', 'speakers_agreed', 'owner', 'training', 'transmission']);

    await quiet(() => runData({ _: ['data', 'mark', 'data/parallel/pairs.tsv'], owner: 'the family',
      training: 'allowed', 'local-only': true }, root));
    // the training term alone is not enough: whose words, and did they agree
    r = at();
    assert.ok(r.step.id.startsWith('terms:'), 'asked again: nobody said whether the speakers agreed');
    await quiet(() => runData({ _: ['data', 'mark', 'data/parallel/pairs.tsv'], speakers: 'grandpa',
      'speakers-agreed': 'yes', training: 'allowed', 'local-only': true }, root));
    r = at();
    assert.equal(r.stage.id, 'protect');
    assert.equal(r.step.mode, 'human_only');

    fs.writeFileSync(path.join(root, 'data/test/checked.tsv'), 'Good night.\tzub nor\n');
    r = at();
    assert.equal(r.step.mode, 'auto');
    assert.equal(r.step.command,
      'champollion data mark data/test/checked.tsv --role test --training not-allowed --local-only');

    await quiet(() => runData({ _: ['data', 'mark', 'data/test/checked.tsv'], role: 'test',
      training: 'not-allowed', 'local-only': true }, root));
    r = at();
    assert.equal(r.stage.id, 'tools');
    assert.equal(r.step.mode, 'confirm');

    // an nmt-forge older than these rails: an upgrade, said with both versions
    const versioned = (v) => (bin, args) => (args[0] === '--version'
      ? { status: 0, stdout: `nmt-forge ${v} (mt-eval-harness 0.3.1; Python 3.12.0)\n` } : { status: 0, stdout: '{}' });
    r = at({ findTool: someTool, spawn: versioned('0.1.9') });
    assert.equal(r.step.mode, 'confirm');
    assert.equal(r.step.command, 'uv tool install --upgrade --python 3.12 nmt-forge');
    assert.match(r.step.say, /nmt-forge 0\.1\.9, and these rails need \d+\.\d+\.\d+ or newer/);
    r = at({ findTool: someTool, spawn: versioned('99.0.0') });
    assert.equal(r.step.command,
      'nmt-forge init qaa --dir . --pair eng-qaa --no-card --name "Our language" --model auto');

    r = at({ findTool: someTool });
    assert.equal(r.step.command,
      'nmt-forge init qaa --dir . --pair eng-qaa --no-card --name "Our language" --model auto');

    fs.mkdirSync(path.join(root, '.forge'));
    r = at({ findTool: someTool });
    assert.equal(r.step.command, 'nmt-forge registry add project-test data/test/checked.tsv --role test');

    fs.writeFileSync(path.join(root, '.forge', 'eval-registry.json'),
      JSON.stringify({ version: 1, sets: { 'project-test': { role: 'test', sha256: 'x', path: path.join(root, 'data/test/checked.tsv') } } }));
    // the rails' own steps before forge's advisor: screen, predict, split
    r = at({ findTool: someTool });
    assert.equal(r.step.command,
      'nmt-forge leak-audit data/parallel/pairs.tsv --clean-to data/clean/pairs.clean.jsonl');
    const ledger = path.join(root, '.forge', 'ledger.jsonl');
    fs.writeFileSync(ledger, JSON.stringify({ event: 'audit-verdict' }) + '\n');
    fs.mkdirSync(path.join(root, 'data', 'clean'));
    // a screen that left too little to train on stops the rails at the
    // people's choice — never walks on into a split of nothing (Haiku
    // acceptance run, 2026-10-11)
    fs.writeFileSync(path.join(root, 'data/clean/pairs.clean.jsonl'),
      Array.from({ length: 3 }, (_, i) => JSON.stringify({ i })).join('\n') + '\n');
    r = at({ findTool: someTool });
    assert.equal(r.step.mode, 'human_only');
    assert.match(r.step.say, /^The screen left 3 training pair\(s\) — at least 20 are needed/);
    assert.equal(r.step.command, undefined, 'nothing for an agent to run');
    fs.writeFileSync(path.join(root, 'data/clean/pairs.clean.jsonl'),
      Array.from({ length: 150 }, (_, i) => JSON.stringify({ i })).join('\n') + '\n');
    r = at({ findTool: someTool });
    assert.equal(r.step.mode, 'ask_user', 'predictions are the people\'s own words');
    assert.equal(r.step.command,
      'nmt-forge prereg new first-model --eval-set project-test --expect "{expect}" --rationale "{why}"');
    fs.appendFileSync(ledger, JSON.stringify({ event: 'prereg', set: 'project-test' }) + '\n');
    r = at({ findTool: someTool });
    assert.equal(r.step.command,
      'nmt-forge split data/clean/pairs.clean.jsonl --test 0 --dev 38 --seed 42 --near-dupe 0.6 --max-group 20 --out data/split --register project',
      'dev size: one in ten of the screened pairs, at least 50 (a quarter under 200: 150 pairs → 38) — stated, never hidden');
    assert.match(r.step.say, /one in ten, at least 50 — a quarter when there are fewer than 200 — at most 500; below 50 no round can be judged on them; seed 42/);
    fs.writeFileSync(path.join(root, '.forge', 'eval-registry.json'), JSON.stringify({ version: 1, sets: {
      'project-test': { role: 'test', sha256: 'x', path: path.join(root, 'data/test/checked.tsv') }, 'project-dev': { role: 'dev', sha256: 'y' } } }));
    let asked = null;
    const spawn = (bin, argv, opts) => {
      asked = { bin, argv, opts };
      return { status: 0, stdout: JSON.stringify({ advice: { state: 'ready-to-train',
        next_command: 'nmt-forge run config.json', why: 'everything is in place',
        blockers: [], warnings: ['dev set saturated'] } }) };
    };
    r = at({ findTool: someTool, spawn });
    assert.deepEqual(asked.argv, ['status', '--json']);
    assert.equal(asked.opts.cwd, root);
    assert.ok(asked.opts.timeout > 0, 'the forge call is bounded');
    assert.equal(r.step.mode, 'confirm', 'training spends compute: ask first');
    assert.equal(r.step.command, 'nmt-forge run config.json');
    assert.deepEqual(r.forge.warnings, ['dev set saturated']);
    assert.deepEqual(r.done, ['project-file', 'add-pairs', 'terms', 'test-file', 'one-test-file', 'test-marked',
      'forge-installed', 'workshop', 'register-test', 'one-corpus', 'screen', 'enough-to-train',
      'predict', 'split']);
    assert.match(renderNextMd(r, 'x'), /dev set saturated/);
  });

  it('when rounds stop moving the model, a stronger one is offered — the people answer yes or not now', async () => {
    const { root } = await newProject();
    fs.writeFileSync(path.join(root, 'data/parallel/p.tsv'), 'a\tb\n');
    fs.writeFileSync(path.join(root, 'data/parallel/p.tsv.champollion.json'),
      JSON.stringify({ $schema: SCHEMA_IDS.set, transmission: 'local-only', terms: { training: 'allowed', speakers_agreed: 'yes' } }));
    fs.writeFileSync(path.join(root, 'data/test/t.tsv'), 'c\td\n');
    fs.writeFileSync(path.join(root, 'data/test/t.tsv.champollion.json'),
      JSON.stringify({ $schema: SCHEMA_IDS.set, role: 'test', transmission: 'local-only' }));
    fs.mkdirSync(path.join(root, '.forge'));
    fs.writeFileSync(path.join(root, '.forge', 'eval-registry.json'),
      JSON.stringify({ version: 1, sets: { t: { role: 'test', path: path.join(root, 'data/test/t.tsv') }, d: { role: 'dev' } } }));
    fs.writeFileSync(path.join(root, '.forge', 'ledger.jsonl'),
      [{ event: 'audit-verdict' }, { event: 'prereg', set: 't' }].map((e) => JSON.stringify(e)).join('\n') + '\n');
    fs.mkdirSync(path.join(root, 'data', 'clean'), { recursive: true });
    fs.writeFileSync(path.join(root, 'data/clean/p.clean.jsonl'),
      Array.from({ length: 30 }, (_, i) => JSON.stringify({ i })).join('\n') + '\n');
    const spawn = () => ({ status: 0, stdout: JSON.stringify({ snapshot: {}, advice: {
      state: 'improve-stronger-model', next_command: 'nmt-forge use-model byt5-small --config config.json --answer {try_it}',
      why: '2 rounds in a row brought no measurable change … Ask them first', blockers: [], warnings: [],
      answers: { try_it: { enum: ['yes', 'not-now'] } } } }) });
    const r = nextStep(root, { findTool: someTool, spawn });
    assert.equal(r.step.mode, 'ask_user', 'a big download and longer training: the people decide');
    assert.equal(r.step.command, 'nmt-forge use-model byt5-small --config config.json --answer {try_it}');
    assert.deepEqual(r.step.answers.try_it.enum, ['yes', 'not-now']);
    assert.match(r.step.question, /no measurable change/);
  });

  it('before the model is used, the people judge their own prediction', async () => {
    const { root } = await newProject();
    fs.writeFileSync(path.join(root, 'data/parallel/p.tsv'), 'a\tb\n');
    fs.writeFileSync(path.join(root, 'data/parallel/p.tsv.champollion.json'),
      JSON.stringify({ $schema: SCHEMA_IDS.set, transmission: 'local-only', terms: { training: 'allowed', speakers_agreed: 'yes' } }));
    fs.writeFileSync(path.join(root, 'data/test/t.tsv'), 'c\td\n');
    fs.writeFileSync(path.join(root, 'data/test/t.tsv.champollion.json'),
      JSON.stringify({ $schema: SCHEMA_IDS.set, role: 'test', transmission: 'local-only' }));
    fs.mkdirSync(path.join(root, '.forge'));
    fs.writeFileSync(path.join(root, '.forge', 'eval-registry.json'),
      JSON.stringify({ version: 1, sets: { t: { role: 'test', path: path.join(root, 'data/test/t.tsv') }, d: { role: 'dev' } } }));
    fs.writeFileSync(path.join(root, '.forge', 'ledger.jsonl'),
      [{ event: 'audit-verdict' }, { event: 'prereg', set: 't' }].map((e) => JSON.stringify(e)).join('\n') + '\n');
    fs.mkdirSync(path.join(root, 'data', 'clean'), { recursive: true });
    fs.writeFileSync(path.join(root, 'data/clean/p.clean.jsonl'),
      Array.from({ length: 30 }, (_, i) => JSON.stringify({ i })).join('\n') + '\n');
    const snapshot = { exports: [{ prereg: { id: 'first-model', pending: [
      { number: 1, predicted: 'between 5 and 20', observed: 7.68, observed_ci: [4.58, 10.88] }] } }] };
    const spawn = () => ({ status: 0, stdout: JSON.stringify({ snapshot, advice: {
      state: 'exported', next_command: 'nmt-forge serve export/model --detach', why: 'serve it', blockers: [], warnings: [] } }) });
    const r = nextStep(root, { findTool: someTool, spawn });
    assert.equal(r.step.mode, 'ask_user');
    assert.equal(r.step.command, 'nmt-forge prereg verdict first-model --prediction 1 --{verdict} --by "{by}"');
    assert.match(r.step.question, /they predicted "between 5 and 20", and it scored chrF\+\+ 7\.68 \[4\.58, 10\.88\]/);
    assert.deepEqual(r.step.answers.verdict.enum, ['held', 'missed']);
  });

  it('a forge that hangs or breaks is reported, never waited on forever', async () => {
    const { root } = await newProject();
    fs.writeFileSync(path.join(root, 'data/parallel/p.tsv'), 'a\tb\n');
    fs.writeFileSync(path.join(root, 'data/parallel/p.tsv.champollion.json'),
      JSON.stringify({ $schema: SCHEMA_IDS.set, transmission: 'local-only', terms: { training: 'allowed', speakers_agreed: 'yes' } }));
    fs.writeFileSync(path.join(root, 'data/test/t.tsv'), 'c\td\n');
    fs.writeFileSync(path.join(root, 'data/test/t.tsv.champollion.json'),
      JSON.stringify({ $schema: SCHEMA_IDS.set, role: 'test', transmission: 'local-only' }));
    fs.mkdirSync(path.join(root, '.forge'));
    fs.writeFileSync(path.join(root, '.forge', 'eval-registry.json'),
      JSON.stringify({ version: 1, sets: { t: { role: 'test', path: path.join(root, 'data/test/t.tsv') }, d: { role: 'dev' } } }));
    fs.writeFileSync(path.join(root, '.forge', 'ledger.jsonl'),
      [{ event: 'audit-verdict' }, { event: 'prereg', set: 't' }].map((e) => JSON.stringify(e)).join('\n') + '\n');
    fs.mkdirSync(path.join(root, 'data', 'clean'), { recursive: true });
    fs.writeFileSync(path.join(root, 'data/clean/p.clean.jsonl'),
      Array.from({ length: 30 }, (_, i) => JSON.stringify({ i })).join('\n') + '\n');
    const hung = () => ({ error: Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' }) });
    const r = nextStep(root, { findTool: someTool, spawn: hung });
    assert.match(r.error, /did not answer within 60 s/);
    assert.equal(r.step.mode, 'human_only');
    // forge advice with no command (a run with no weights, evaluated): the
    // person's step, never an "auto" step with nothing to run
    const done = () => ({ status: 0, stdout: JSON.stringify({ snapshot: {}, advice: {
      state: 'evaluated-no-model', next_command: null, why: 'no model to serve', blockers: [], warnings: [] } }) });
    const d = nextStep(root, { findTool: someTool, spawn: done });
    assert.equal(d.step.mode, 'human_only');
    assert.equal(d.step.say, 'no model to serve');
  });

  it('a served model leads to the improve rounds; an app is what they may do next, not a step', async () => {
    // model ladder, 2026-10-11: a family with no app was left at "connect it
    // to your app", a person's step the agent could not take. Founder,
    // 2026-10-11: serving is where making it better starts — the improve
    // stage's first question follows, with what forge said about the model
    const { root } = await newProject();
    fs.writeFileSync(path.join(root, 'data/parallel/p.tsv'), 'a\tb\n');
    fs.writeFileSync(path.join(root, 'data/parallel/p.tsv.champollion.json'),
      JSON.stringify({ $schema: SCHEMA_IDS.set, transmission: 'local-only', terms: { training: 'allowed', speakers_agreed: 'yes' } }));
    fs.writeFileSync(path.join(root, 'data/test/t.tsv'), 'c\td\n');
    fs.writeFileSync(path.join(root, 'data/test/t.tsv.champollion.json'),
      JSON.stringify({ $schema: SCHEMA_IDS.set, role: 'test', transmission: 'local-only' }));
    fs.mkdirSync(path.join(root, '.forge'));
    fs.writeFileSync(path.join(root, '.forge', 'eval-registry.json'),
      JSON.stringify({ version: 1, sets: { t: { role: 'test', path: path.join(root, 'data/test/t.tsv') }, d: { role: 'dev' } } }));
    fs.writeFileSync(path.join(root, '.forge', 'ledger.jsonl'),
      [{ event: 'audit-verdict' }, { event: 'prereg', set: 't' }].map((e) => JSON.stringify(e)).join('\n') + '\n');
    fs.mkdirSync(path.join(root, 'data', 'clean'), { recursive: true });
    fs.writeFileSync(path.join(root, 'data/clean/p.clean.jsonl'),
      Array.from({ length: 30 }, (_, i) => JSON.stringify({ i })).join('\n') + '\n');
    const why = 'the model is served and answering at http://127.0.0.1:8378 — try it on its page, '
      + 'http://127.0.0.1:8378/ — and forge has nothing left to run. To use it in an app or a website: …';
    const spawn = () => ({ status: 0, stdout: JSON.stringify({ snapshot: {}, advice: {
      state: 'serving', next_command: 'npx champollion connect export/model --app <your app or website folder>',
      why, blockers: [], warnings: ['a caveat'] } }) });
    const r = nextStep(root, { findTool: someTool, spawn });
    assert.ok(r.step.id.startsWith('improve-time:'), r.step.id);
    assert.equal(r.step.mode, 'ask_user');
    assert.deepEqual(Object.keys(r.step.answers), ['per_week', 'total']);
    assert.equal(r.stage.id, 'improve');
    assert.ok(r.done.includes('forge'));
    assert.equal(r.forge.why, why);
    assert.deepEqual(r.forge.warnings, ['a caveat'], 'the caveats still travel with it');
    const md = renderNextMd(r, 'x');
    assert.match(md, /How much time can the speaker give/);
    assert.match(md, /try it on its page/);
    assert.match(md, /a caveat/);
  });
});

describe('champollion data mark — only ever stricter', () => {
  it('a decision about leaving the machine is required, never assumed', () => {
    assert.match(markedSidecar({}, { training: 'allowed' }).error, /--local-only or --may-leave/);
    const ok = markedSidecar({}, { training: 'allowed', mayLeave: true });
    assert.equal(ok.doc.transmission, undefined);
    assert.equal(ok.doc.terms.training, 'allowed');
  });

  it('refuses loosening: may-leave over local-only, allowed over not-allowed, a new role for a test set', () => {
    assert.match(markedSidecar({ transmission: 'local-only' }, { mayLeave: true }).error, /only ever gets stricter/);
    assert.match(markedSidecar({ transmission: 'local-only', terms: { training: 'not-allowed' } },
      { training: 'allowed' }).error, /only ever gets/);
    assert.match(markedSidecar({ role: 'test', transmission: 'local-only' }, { role: 'train' }).error,
      /learn from what it is judged on/);
    assert.match(markedSidecar({}, { role: 'test', training: 'allowed', localOnly: true }).error,
      /never trained on/);
  });

  it('a test set gets training not-allowed without being told', () => {
    const r = markedSidecar({}, { role: 'test', localOnly: true });
    assert.equal(r.doc.terms.training, 'not-allowed');
    assert.equal(r.doc.$schema, SCHEMA_IDS.set);
  });

  it('keys an older sidecar carried are kept under x-, never dropped', () => {
    const r = markedSidecar({ transmission: 'local-only', note: 'grandpa checked' }, { training: 'allowed' });
    assert.deepEqual(r.renamed, ['note']);
    assert.equal(r.doc['x-note'], 'grandpa checked');
    assert.ok(!('note' in r.doc));
  });
});

describe('the forge the rails ask for', () => {
  it('is the forge in this tree (lockstep: a release bumps both)', () => {
    const forgeToml = new URL('../../forge/pyproject.toml', import.meta.url);
    if (!fs.existsSync(forgeToml)) return;              // a standalone CLI checkout
    const version = /^version\s*=\s*"([^"]+)"/m.exec(fs.readFileSync(forgeToml, 'utf-8'))[1];
    const journey = JSON.parse(fs.readFileSync(new URL('../../shared/journeys/language.json', import.meta.url), 'utf-8'));
    const step = journey.steps.find((s) => s.id === 'forge-installed');
    assert.equal(step.done_when.min_version, version,
      `shared/journeys/language.json asks for nmt-forge ${step.done_when.min_version}; the forge here is ${version}`);
  });
});
