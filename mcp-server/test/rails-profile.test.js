/**
 * The rails profile over a real MCP client: six tools, short instructions,
 * and a language project walked from nothing to "install the training tools"
 * — with every decision left to the person (src/rails.js).
 *
 * Drives THIS checkout's CLI (CHAMPOLLION_CLI_BIN), so the steps are the ones
 * shared/journeys/language.json defines today.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createServer } from '../src/index.js';
import { tokenize, launcherFor, fillAnswers, alsoCalls, compact, declineRefusal } from '../src/rails.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CLI = resolve(__dirname, '../../cli/bin/cli.js');
const INSTRUCTIONS = readFileSync(resolve(__dirname, '../instructions-rails.md'), 'utf-8');

let client;
let parent;
const saved = {};

async function call(name, args) {
  const r = await client.callTool({ name, arguments: args });
  const body = r.content[0].text;
  let doc;
  try { doc = JSON.parse(body); } catch { doc = body; }
  return { isError: !!r.isError, doc };
}

before(async () => {
  for (const k of ['CHAMPOLLION_CLI_BIN', 'NMT_FORGE_BIN', 'CHAMPOLLION_MCP_HOME']) saved[k] = process.env[k];
  process.env.CHAMPOLLION_CLI_BIN = CLI;
  delete process.env.NMT_FORGE_BIN;
  parent = mkdtempSync(join(tmpdir(), 'rails-mcp-'));
  process.env.CHAMPOLLION_MCP_HOME = parent;
  const server = await createServer({ profile: 'rails' });
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await server.connect(serverT);
  client = new Client({ name: 'rails-test', version: '0.0.0' });
  await client.connect(clientT);
});

after(async () => {
  await client?.close();
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  rmSync(parent, { recursive: true, force: true });
});

describe('rails profile surface', () => {
  it('serves exactly the six rails tools', async () => {
    const names = (await client.listTools()).tools.map((t) => t.name).sort();
    assert.deepEqual(names, ['add_data', 'explain', 'project_status', 'run_next_step', 'start_project',
      'try_translation']);
  });

  it('has instructions a small agent can hold', () => {
    assert.ok(INSTRUCTIONS.length < 7500, `${INSTRUCTIONS.length} chars`);
    for (const mode of ['auto', 'confirm', 'ask_user', 'wait', 'use_tool', 'human_only']) {
      assert.ok(INSTRUCTIONS.includes(mode), mode);
    }
  });
});

describe('walking a project on the rails', () => {
  it('start → gather → terms (asked) → test set → tools (confirm)', async () => {
    // the first call makes nothing: it gives the direction to say back (wave 1:
    // a learner who wanted their language INTO English got it built the other way)
    const asked = await call('start_project', { folder: 'family', from: 'English', to: 'qaa',
      target_name: 'Our language', purpose: 'family phrasebook', parent_dir: parent });
    assert.equal(asked.isError, false, JSON.stringify(asked.doc));
    assert.equal(asked.doc.made, false);
    assert.ok(!existsSync(join(parent, 'family')), 'nothing is made before the direction is agreed');
    assert.match(asked.doc.ask_first, /takes English and gives back Our language — you put English in, and Our language comes out\. Is that the way round you want\?/);
    assert.deepEqual(asked.doc.if_the_other_way, { tool: 'start_project', arguments: { folder: 'family', from: 'qaa',
      source_name: 'Our language', to: 'eng', purpose: 'family phrasebook', parent_dir: parent, confirmed: true } });
    const started = await call('start_project', asked.doc.if_yes.arguments);
    assert.equal(started.isError, false, JSON.stringify(started.doc));
    assert.deepEqual(started.doc.languages, {
      source: { code: 'eng', name: 'English' }, target: { code: 'qaa', name: 'Our language' },
    }, 'what each language resolved to, for the agent to say back');
    const dir = join(parent, 'family');
    let s = (await call('project_status', { project_dir: dir })).doc;
    // a person's step an agent does with its tools: shown as that, naming the tool
    assert.equal(s.step.mode, 'use_tool');
    assert.equal(s.step.tool, 'add_data');
    assert.match(s.step.say, /^Bring in each file the person named, now, with add_data/);
    assert.match(s.step.for_the_person, /^Bring in the sentence pairs you have/);

    const refusedHuman = await call('run_next_step', { project_dir: dir, step_id: s.step.id });
    assert.equal(refusedHuman.isError, true);
    assert.match(refusedHuman.doc.refused, /this step is done with the add_data tool, not run_next_step/);

    // a mistyped project folder is said plainly, with the projects that exist
    // (it used to come back as "spawn …/node ENOENT")
    const typo = await call('project_status', { project_dir: join(parent, 'famly') });
    assert.equal(typo.isError, true);
    assert.match(typo.doc.refused, /there is no folder .*famly\. The projects here: .*family — pass one of them/);
    const nowhere = await call('start_project', { folder: 'x', from: 'English', to: 'qaa',
      target_name: 'Our language', parent_dir: '/home/your_username' });
    assert.match(nowhere.doc.refused, /there is no folder \/home\/your_username to start the project in — leave parent_dir out/);

    writeFileSync(join(dir, 'inbox', 'grandpa.tsv'),
      'English\tOur language\nGood morning.\tzub kef\nThank you.\tmol tav\n');
    const added = await call('add_data', { project_dir: dir, path: 'inbox/grandpa.tsv' });
    assert.equal(added.isError, false, JSON.stringify(added.doc));
    assert.ok(!JSON.stringify(added.doc).includes('Good morning'), 'counts and columns, never sentences');

    s = (await call('project_status', { project_dir: dir })).doc;
    assert.equal(s.step.mode, 'ask_user');
    const noAnswers = await call('run_next_step', { project_dir: dir, step_id: s.step.id });
    assert.equal(noAnswers.isError, true);
    assert.match(noAnswers.doc.refused, /never answer for them/);

    const ran = await call('run_next_step', { project_dir: dir, step_id: s.step.id,
      answers: { speakers: 'our own', speakers_agreed: 'yes', owner: 'the family', training: 'allowed',
        transmission: 'local-only' } });
    assert.equal(ran.isError, false, JSON.stringify(ran.doc));
    assert.equal(ran.doc.ran[0].exit_code, 0, JSON.stringify(ran.doc));
    assert.match(ran.doc.next.stage, /Protect your test set/);

    const stale = await call('run_next_step', { project_dir: dir, step_id: s.step.id,
      answers: { speakers: 'x', speakers_agreed: 'yes', owner: 'x', training: 'allowed', transmission: 'local-only' } });
    assert.equal(stale.isError, true);
    assert.match(stale.doc.refused, /project changed/);

    writeFileSync(join(dir, 'inbox', 'checked.tsv'), 'English\tOur language\nGood night.\tzub nor\n');
    assert.equal((await call('add_data', { project_dir: dir, path: 'inbox/checked.tsv', into: 'test' })).isError, false);

    s = (await call('project_status', { project_dir: dir })).doc;
    assert.equal(s.step.mode, 'confirm');
    assert.match(s.step.command, /^uv tool install/);
    const unconfirmed = await call('run_next_step', { project_dir: dir, step_id: s.step.id });
    assert.equal(unconfirmed.isError, true);
    assert.match(unconfirmed.doc.refused, /confirmed: true/);

    // "not now": nothing runs, and it is not asked again this session (stress test 7)
    const notNow = await call('run_next_step', { project_dir: dir, step_id: s.step.id, declined: true });
    assert.equal(notNow.isError, false, JSON.stringify(notNow.doc));
    assert.deepEqual(notNow.doc.ran, []);
    assert.ok(notNow.doc.next.step.declined_this_session);
    s = (await call('project_status', { project_dir: dir })).doc;
    assert.match(s.step.say, /^They said not now \(\d\d:\d\d UTC\) to this: .* Do not ask again this session/);
  });

  it('a file not where the agent looked is named where it is', async () => {
    // acceptance runs, 2026-10-11: three small models got only "no such file
    // in the project folder" and asked the family to move their files
    await call('start_project', { folder: 'files', from: 'English', to: 'qaa', target_name: 'Our language',
      parent_dir: parent, confirmed: true });
    const dir = join(parent, 'files');
    mkdirSync(join(parent, 'family-files'), { recursive: true });
    writeFileSync(join(parent, 'family-files', 'aunt.tsv'), 'English\tOur language\nGood night.\tzub nor\n');
    const missing = await call('add_data', { project_dir: dir, path: 'aunt.tsv' });
    assert.equal(missing.isError, true);
    assert.match(missing.doc.refused,
      /Files named aunt\.tsv nearby, as paths from the project folder: \.\.\/family-files\/aunt\.tsv/);
    const viaParent = await call('add_data', { project_dir: dir, path: '../family-files/aunt.tsv' });
    assert.equal(viaParent.isError, false, JSON.stringify(viaParent.doc));
  });

  it('a file add_data could not bring in is said on every status until it is in', async () => {
    // model ladder, 2026-10-11: a refused spreadsheet (a guessed sheet name)
    // was never tried again, and the rails went on without its 120 pairs
    await call('start_project', { folder: 'leftout', from: 'English', to: 'qaa', target_name: 'Our language',
      parent_dir: parent, confirmed: true });
    const dir = join(parent, 'leftout');
    writeFileSync(join(parent, 'old notes.txt'), 'Good night.\tzub nor\nThank you.\tmora\n');
    writeFileSync(join(parent, 'aunt2.tsv'), 'English\tOur language\nGood day.\tzub\n');
    const refused = await call('add_data', { project_dir: dir, path: '../old notes.txt' });
    assert.equal(refused.isError, true);
    assert.match(refused.doc.refused, /which column holds English/);
    // another file comes in: the add-pairs step is done, the refused one is still said
    assert.equal((await call('add_data', { project_dir: dir, path: '../aunt2.tsv' })).isError, false);
    const s = await call('project_status', { project_dir: dir });
    assert.deepEqual(s.doc.files_not_added.files.map((f) => basename(f.file)), ['old notes.txt']);
    assert.match(s.doc.files_not_added.files[0].refused, /which column holds English/);
    assert.match(s.doc.files_not_added.say, /tell the person which is left out and why/);
    const ok = await call('add_data', { project_dir: dir, path: '../old notes.txt', source_col: 'A', target_col: 'B',
      header: false });
    assert.equal(ok.isError, false, JSON.stringify(ok.doc));
    assert.equal((await call('project_status', { project_dir: dir })).doc.files_not_added, undefined);
  });

  it('the other way round makes a project from the language into English', async () => {
    const asked = await call('start_project', { folder: 'learner', from: 'English', to: 'qaa',
      target_name: 'Our language', parent_dir: parent });
    const made = await call('start_project', asked.doc.if_the_other_way.arguments);
    assert.equal(made.isError, false, JSON.stringify(made.doc));
    const file = JSON.parse(readFileSync(join(parent, 'learner', 'champollion.project.json'), 'utf-8'));
    assert.deepEqual(file.pair, { source: 'qaa', target: 'eng', source_name: 'Our language' });
  });

  it('a language name no card carries comes back with the exact call that uses a private-use code', async () => {
    const r = await call('start_project', { folder: 'ours', from: 'English', to: 'Our language',
      purpose: 'home', parent_dir: parent });
    assert.equal(r.isError, true);
    assert.match(r.doc.refused, /private-use code, qaa to qtz/);
    assert.deepEqual(r.doc.if_it_has_no_code, { tool: 'start_project', arguments: {
      folder: 'ours', from: 'English', to: 'qaa', target_name: 'Our language', purpose: 'home', parent_dir: parent } });
  });

  it('explain answers in plain words', async () => {
    const r = await call('explain', { topic: 'quality' });
    assert.match(r.doc, /phrasebook/);
  });
});

describe('only rails commands run', () => {
  it('tokenizes quotes and && and refuses shell syntax', () => {
    assert.deepEqual(tokenize('champollion data mark a.tsv --owner "the family" --local-only'),
      [['champollion', 'data', 'mark', 'a.tsv', '--owner', 'the family', '--local-only']]);
    assert.deepEqual(tokenize('nmt-forge preflight run --config config.json && nmt-forge run config.json --detach'),
      [['nmt-forge', 'preflight', 'run', '--config', 'config.json'], ['nmt-forge', 'run', 'config.json', '--detach']]);
    for (const bad of ['champollion next; rm -rf ~', 'champollion next | sh', 'champollion $(whoami)', 'a > b']) {
      assert.throws(() => tokenize(bad), /refused/);
    }
  });

  it('a # at the start of a word is a comment, as in a shell (forge explains itself after it)', () => {
    assert.deepEqual(tokenize("nmt-forge export m.json --out export-r/   # export/ holds another run's export"),
      [['nmt-forge', 'export', 'm.json', '--out', 'export-r/']]);
    assert.deepEqual(tokenize('champollion data mark "a #1.tsv" --tag x#y'),
      [['champollion', 'data', 'mark', 'a #1.tsv', '--tag', 'x#y']]);
  });

  it('launches only champollion, nmt-forge and uv installing nmt-forge', () => {
    assert.match(launcherFor(['rm', '-rf', '/']).error, /not a rails command/);
    assert.match(launcherFor(['uv', 'pip', 'install', 'evil']).error, /only `uv tool install … nmt-forge`/);
    assert.equal(launcherFor(['champollion', 'next']).args[0], CLI);
    // the rails' own upgrade of an outdated nmt-forge is the same install, with --upgrade
    const up = launcherFor(['uv', 'tool', 'install', '--upgrade', '--python', '3.12', 'nmt-forge'], { PATH: '/usr/bin' });
    assert.ok(!/only `uv tool install/.test(up.error || ''), JSON.stringify(up));
    assert.match(launcherFor(['uv', 'tool', 'install', '--upgrade', 'evil']).error, /only `uv tool install … nmt-forge`/);
  });

  it('"not now" that is one of a step\'s own answers goes in answers, not declined', () => {
    // the stronger-model offer records "not-now" in forge's ledger and comes
    // back after more rounds; declined would ask again next session
    const offer = { mode: 'ask_user', answers: { try_it: { enum: ['yes', 'not-now'] } } };
    assert.match(declineRefusal(offer), /pass it in answers \(try_it: "not-now"\)/);
    assert.equal(declineRefusal({ mode: 'confirm' }), null);
    assert.equal(declineRefusal({ mode: 'ask_user', answers: { owner: { say: 'who holds it' } } }), null);
    assert.match(declineRefusal({ mode: 'auto' }), /nothing to decline/);
  });

  it('fills answers into argv, never into a shell string', () => {
    const parts = tokenize('champollion data mark a.tsv --owner "{owner}" --{transmission}');
    const f = fillAnswers(parts, { owner: { type: 'string' }, transmission: { enum: ['local-only', 'may-leave'] } },
      { owner: 'Mary "Ma" O\'Neil; rm -rf ~', transmission: 'may-leave' });
    assert.deepEqual(f.parts[0].slice(-3), ['--owner', 'Mary "Ma" O\'Neil; rm -rf ~', '--may-leave']);
    assert.match(fillAnswers(parts, { transmission: { enum: ['local-only'] } }, { transmission: 'public' }).error, /must be one of/);
  });
});

describe('what the rails hand an agent as calls, not commands', () => {
  it('a file that also holds pairs or a word list comes with the add_data call that brings it in', () => {
    // model ladder, 2026-10-11: a Toolbox dictionary's example sentences were
    // brought in by one model, left out by another — the CLI named a command
    const out = [
      '',
      '  ../family-files/dictionary.txt → data/lexicon/dictionary-words.tsv: 14 pair(s) from a Toolbox dictionary',
      '  it also holds 6 example sentence(s) with their English — as pairs to learn from: '
        + 'champollion data add ../family-files/dictionary.txt',
      '  marked local-only for now (the project\'s default) — its holders decide the rest: champollion next',
    ].join('\n');
    assert.deepEqual(alsoCalls(out, '/p'), [{
      holds: '6 example sentence(s) with their English', as: 'as pairs to learn from', tool: 'add_data',
      arguments: { project_dir: '/p', path: '../family-files/dictionary.txt' } }]);
    const back = '  it also holds 14 gloss(es) — as a word list (the dictionary floor): '
      + 'champollion data add ../my words.txt --into lexicon';
    assert.deepEqual(alsoCalls(back, '/p')[0].arguments,
      { project_dir: '/p', path: '../my words.txt', into: 'lexicon' });
    assert.deepEqual(alsoCalls('  pairs written\n', '/p'), []);
  });

  it('every step an agent takes names the exact call — the command is never a tool', () => {
    // model ladder, round 5: Llama 3.1 8B called a tool "data_mark", made from
    // the step's `champollion data mark …` command
    const at = (step) => compact({ project: '/p', step: { why: 'w', say: 's', ...step } }).step;
    assert.deepEqual(at({ id: 'screen:1', mode: 'auto', command: 'nmt-forge leak-audit x' }).call,
      { tool: 'run_next_step', arguments: { project_dir: '/p', step_id: 'screen:1' } });
    const confirm = at({ id: 'train:1', mode: 'confirm', command: 'nmt-forge run config.json' }).call;
    assert.deepEqual(confirm.arguments, { project_dir: '/p', step_id: 'train:1' }, 'never confirmed for them');
    assert.match(confirm.once_they_say_yes, /only after they say yes/);
    const ask = at({ id: 'terms:1', mode: 'ask_user', command: 'champollion data mark f --owner "{owner}"',
      answers: { owner: { type: 'string', say: 'who holds this data' }, training: { enum: ['allowed', 'not-allowed'] } } }).call;
    assert.deepEqual(ask.arguments.answers, { owner: '<who holds this data>', training: '<allowed or not-allowed>' });
    assert.match(ask.fill_with, /never yours/);
    assert.equal(at({ id: 'pairs:1', mode: 'human_only', agent: 'bring them in', agent_tool: 'add_data' }).call.tool, 'add_data');
    assert.equal(at({ id: 'choose:1', mode: 'human_only' }).call, undefined, 'a person\'s own step has no call');
    assert.equal(at({ id: 'train:2', mode: 'wait' }).call.tool, 'project_status');
  });

  it('a slot\'s placeholder sent back as the answer is refused', () => {
    const parts = tokenize('champollion data mark a.tsv --owner "{owner}" --training {training}');
    const schema = { owner: { type: 'string' }, training: { enum: ['allowed', 'not-allowed'] } };
    assert.match(fillAnswers(parts, schema, { owner: '<who holds this data>', training: 'allowed' }).error,
      /"owner" is still the placeholder <who holds this data> — ask the person/);
    assert.equal(fillAnswers(parts, schema, { owner: 'Grandpa', training: 'allowed' }).error, undefined);
  });

  it('what is true right now travels with every status, for the agent to say and never more', () => {
    // wave 1, 2026-10-12: "your model is live" before any serve
    const now = ['1 model trained; the best scores chrF++ 21.4 on the practice (dev) sentences.',
      'Not scored on the locked test set yet.', 'No model is being served right now.'];
    const c = compact({ project: '/p', step: { id: 'forge-ready-to-score:1', mode: 'auto', say: 's', why: 'w' }, now });
    assert.deepEqual(c.true_now, now);
    // a file waiting for its speakers' agreement: its own question, its own call
    const w = compact({ project: '/p', step: { id: 'a:1', mode: 'auto', say: 's', why: 'w' },
      waiting: [{ id: 'agreed:9', file: 'data/parallel/b.tsv', mode: 'ask_user', question: 'q', say: 's',
        answers: { agreed: { enum: ['yes'] } }, command: 'champollion data mark data/parallel/b.tsv' }] });
    assert.deepEqual(w.waiting_for_agreement[0].call.arguments,
      { project_dir: '/p', step_id: 'agreed:9', answers: { agreed: '<yes — only once the person says everyone agreed>' } });
    assert.equal(w.waiting_for_agreement[0].command, undefined, 'no command for the agent to run by hand');
    // with the yes, the holders' training answer is a slot of its own, never filled for them
    const t = compact({ project: '/p', step: { id: 'a:1', mode: 'auto', say: 's', why: 'w' },
      waiting: [{ id: 'agreed:9', file: 'data/parallel/b.tsv', mode: 'ask_user', question: 'q', say: 's',
        answers: { agreed: { enum: ['yes'] }, training: { enum: ['allowed', 'not-allowed'] } } }] });
    assert.match(t.waiting_for_agreement[0].call.arguments.answers.training, /holders' answer/);
    assert.equal(compact({ project: '/p', step: { id: 'a:1', mode: 'auto', say: 's', why: 'w' } }).true_now, undefined,
      'before forge is reached there is nothing to say yet');
  });

  it('a served model\'s try page and the way into an app travel with the improve rounds', () => {
    const served = { state: 'serving', command: 'npx champollion connect export/model --app <your app or website folder>',
      why: 'the model is served and answering at http://127.0.0.1:8378 — try it on its page; to use it in an app: `champollion connect`' };
    const c = compact({ project: '/p', step: { id: 'improve-sentences:1', mode: 'human_only', say: 's', why: 'w' }, forge: served });
    assert.match(c.model_in_use.say, /try it on its page/);
    assert.match(c.model_in_use.for_the_person, /champollion connect/);
    const before = compact({ project: '/p', step: { id: 'forge-ready-to-train:1', mode: 'confirm', say: 's', why: 'w' },
      forge: { state: 'ready-to-train', why: 'w' } });
    assert.equal(before.model_in_use, undefined, 'nothing is in use before a model is served');
  });

  it('a finished journey says what the people can do now', () => {
    const c = compact({ project: '/p', done: ['forge'], step: null,
      finished: 'the model is served — try it on its page, http://127.0.0.1:8378/' });
    assert.equal(c.step, null);
    assert.match(c.say, /Every step on the rails is done/);
    assert.match(c.finished, /try it on its page/);
  });
});

describe('a step that keeps failing', () => {
  before(() => {
    // an nmt-forge that fails every command: the workshop step cannot succeed
    const fake = join(parent, 'failing-nmt-forge');
    writeFileSync(fake, '#!/bin/sh\necho "refused: the workshop folder is read-only" >&2\nexit 2\n', { mode: 0o755 });
    process.env.NMT_FORGE_BIN = fake;
  });
  after(() => { delete process.env.NMT_FORGE_BIN; });

  it('runs twice, then waits for the person (who may say to try again)', async () => {
    await call('start_project', { folder: 'stuck', from: 'English', to: 'qaa', target_name: 'Our language',
      parent_dir: parent, confirmed: true });
    const dir = join(parent, 'stuck');
    writeFileSync(join(dir, 'inbox', 'a.tsv'), 'English\tOur language\nGood morning.\tzub kef\n');
    await call('add_data', { project_dir: dir, path: 'inbox/a.tsv' });
    let s = (await call('project_status', { project_dir: dir })).doc;
    await call('run_next_step', { project_dir: dir, step_id: s.step.id,
      answers: { speakers: 'our own', speakers_agreed: 'yes', owner: 'the family', training: 'allowed',
        transmission: 'local-only' } });
    writeFileSync(join(dir, 'inbox', 'c.tsv'), 'English\tOur language\nGood night.\tzub nor\n');
    await call('add_data', { project_dir: dir, path: 'inbox/c.tsv', into: 'test' });
    s = (await call('project_status', { project_dir: dir })).doc;
    assert.match(s.step.command, /^nmt-forge init/);
    for (let n = 0; n < 2; n++) {
      const r = await call('run_next_step', { project_dir: dir, step_id: s.step.id });
      assert.equal(r.doc.ran[0].exit_code, 2);
    }
    const third = await call('run_next_step', { project_dir: dir, step_id: s.step.id });
    assert.equal(third.isError, true);
    assert.match(third.doc.refused, /failed 2 times \(last: exit 2\).*ask what to do/);
    assert.match(third.doc.last_output, /read-only/);
    const again = await call('run_next_step', { project_dir: dir, step_id: s.step.id, confirmed: true });
    assert.equal(again.isError, false);
    assert.equal(again.doc.ran[0].exit_code, 2, 'run again on the person\'s say-so');
  });
});

describe('try_translation', () => {
  let server;
  let health;
  let posted;
  let jobsFile;

  before(async () => {
    server = createHttpServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify(health));
      }
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        posted = JSON.parse(body);
        const translations = Object.fromEntries(Object.entries(posted.keys).map(([k, v]) => [k, `«${v}»`]));
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ translations, meta: { model: 'm' } }));
      });
      return undefined;
    });
    await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
    // a stand-in `nmt-forge jobs --json`: whatever jobs.json says
    jobsFile = join(parent, 'jobs.json');
    const fake = join(parent, 'fake-nmt-forge');
    writeFileSync(fake, `#!/bin/sh\ncat "${jobsFile}"\n`, { mode: 0o755 });
    process.env.NMT_FORGE_BIN = fake;
  });

  after(() => {
    server?.close();
    delete process.env.NMT_FORGE_BIN;
  });

  const serving = () => JSON.stringify([{ name: 'serve-1', kind: 'serve', state: 'running', healthy: true,
    health_url: `http://127.0.0.1:${server.address().port}/health` }]);

  it('refuses when nothing is served', async () => {
    writeFileSync(jobsFile, '[]');
    const r = await call('try_translation', { project_dir: parent, text: 'Good morning.' });
    assert.equal(r.isError, true);
    assert.match(r.doc.refused, /no model is being served/);
  });

  it('never relays what a local-only model writes — the person gets its page', async () => {
    writeFileSync(jobsFile, serving());
    posted = undefined;
    for (const h of [{ model: 'm', output_local_only: true }, { model: 'm' /* an older server: unknown */ }]) {
      health = h;
      const r = await call('try_translation', { project_dir: parent, text: 'Good morning.' });
      assert.equal(r.isError, false, JSON.stringify(r.doc));
      assert.equal(r.doc.shown_to_person_only, true);
      assert.equal(r.doc.open, `http://127.0.0.1:${server.address().port}/`);
    }
    assert.equal(posted, undefined, 'the sentence was never even sent');
  });

  it('translates with a model whose output may leave', async () => {
    writeFileSync(jobsFile, serving());
    health = { model: 'm', pair: 'eng→qaa', output_local_only: false };
    const r = await call('try_translation', { project_dir: parent, text: 'Good morning.\n\nThank you.' });
    assert.equal(r.isError, false, JSON.stringify(r.doc));
    assert.deepEqual(r.doc.translations, [{ source: 'Good morning.', translation: '«Good morning.»' },
      { source: 'Thank you.', translation: '«Thank you.»' }]);
    assert.match(r.doc.say, /fluent speaker/);
    const many = await call('try_translation', { project_dir: parent, text: Array(11).fill('x').join('\n') });
    assert.equal(many.isError, true);
  });
});
