/**
 * init beside a local-only test set (release blocker for 0.4.0; synthetic
 * hospital persona, Rounds 10, 12 and 14).
 *
 * A project that holds a file its steward marked local-only — a
 * `<file>.champollion.json` sidecar with "transmission": "local-only", what
 * `champollion network register-corpus --data … --tier local-only` writes —
 * was set up with a hosted model (OpenRouter) by default, `--yes` included.
 * The founder's call: with a mark present the DEFAULT is the `local` method,
 * init says why (one line naming the marked file), how to choose a hosted
 * method deliberately, and what local needs. An explicit --method always
 * wins. Without a mark nothing changes.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { runCli } from './fixtures/fake-openai-model.mjs';
import { findLocalOnlyMarks, readMark } from '../lib/local-only-marks.js';

const DRIVER = fileURLToPath(new URL('./fixtures/wizard-driver.mjs', import.meta.url));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'init-mark-'));
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const readConfig = (d) => JSON.parse(fs.readFileSync(path.join(d, 'champollion.config.json'), 'utf8'));

/** A next-intl project; `mark` puts a local-only test set at data/test.tsv. */
function project({ mark = false } = {}) {
  const d = tmp();
  write(path.join(d, 'messages/en.json'), JSON.stringify({ dose: 'Take this medicine at {time}.' }));
  if (mark) {
    write(path.join(d, 'data/test.tsv'), 'Take this medicine at {time}.\tx\n');
    write(path.join(d, 'data/test.tsv.champollion.json'), JSON.stringify({ id: 'eval-eng-qaa-ward-v1', transmission: 'local-only' }));
  }
  return d;
}

describe('findLocalOnlyMarks', () => {
  it('finds a sidecar marked local-only anywhere in the project, never one under node_modules', () => {
    const d = tmp();
    write(path.join(d, 'private/deep/er/set.jsonl.champollion.json'), JSON.stringify({ transmission: 'local-only' }));
    write(path.join(d, 'data/open.tsv.champollion.json'), JSON.stringify({ license: 'CC-BY-4.0' }));
    write(path.join(d, 'node_modules/pkg/x.tsv.champollion.json'), JSON.stringify({ transmission: 'local-only' }));
    write(path.join(d, 'champollion.config.json'), '{}');
    const { marks } = findLocalOnlyMarks(d);
    assert.deepEqual(marks.map(m => path.relative(d, m.dataFile)), [path.join('private', 'deep', 'er', 'set.jsonl')]);
  });

  it('reads an unreadable sidecar as a mark (a restriction that cannot be read is not no restriction)', () => {
    const d = tmp();
    write(path.join(d, 'a.tsv.champollion.json'), '{ not json');
    assert.equal(readMark(path.join(d, 'a.tsv.champollion.json')).unreadable, true);
  });

  it('finds nothing in a project with no mark', () => {
    assert.deepEqual(findLocalOnlyMarks(project()).marks, []);
  });
});

describe('init --yes beside a local-only mark', () => {
  it('defaults to the local method and says why, how to choose hosted, and what local needs', async () => {
    const d = project({ mark: true });
    const r = await runCli(['init', '--yes', '--langs', 'fr'], d);
    assert.equal(r.code, 0, r.out);
    assert.equal(readConfig(d).defaultMethod, 'local');
    assert.equal(readConfig(d).model, undefined, 'no hosted model slug is written for local');
    // Why — one line, naming the marked file and its sidecar.
    assert.match(r.out, /Method: local — data\/test\.tsv is marked local-only \(data\/test\.tsv\.champollion\.json\): only a model on this machine may see it\./);
    // How to choose a hosted method deliberately.
    assert.match(r.out, /A hosted method is a deliberate choice: champollion init --force --method llm --model \S+/);
    // What local needs.
    assert.match(r.out, /Local needs a model server on this machine: Ollama's default \(http:\/\/localhost:11434\/v1\), or LOCAL_API_BASE set to yours/);
    // And the hosted "where the text goes" lines do not appear: nothing is sent off the machine.
    assert.doesNotMatch(r.out, /Where the text goes/);
  });

  it('the hosted switch it prints works, and rewrites only the method and model', async () => {
    const d = project({ mark: true });
    assert.equal((await runCli(['init', '--yes', '--langs', 'fr'], d)).code, 0);
    const r = await runCli(['init', '--force', '--method', 'llm', '--model', 'google/gemini-3.5-flash'], d);
    assert.equal(r.code, 0, r.out);
    const cfg = readConfig(d);
    assert.equal(cfg.defaultMethod, undefined, 'llm is the unwritten default method');
    assert.equal(cfg.model, 'google/gemini-3.5-flash');
    assert.deepEqual(Object.keys(cfg.languages), ['fr']);
    // A hosted method beside the mark: still said, naming the file.
    assert.match(r.out, /Where the text goes: llm sends every string it translates to OpenRouter/);
    assert.match(r.out, /Note: data\/test\.tsv is marked local-only/);
  });

  it('an explicit --method llm wins, and the mark is still named', async () => {
    const d = project({ mark: true });
    const r = await runCli(['init', '--yes', '--method', 'llm', '--langs', 'fr'], d);
    assert.equal(r.code, 0, r.out);
    assert.equal(readConfig(d).defaultMethod, undefined);
    assert.ok(readConfig(d).model, 'the OpenRouter default model is written');
    assert.doesNotMatch(r.out, /Method: local —/);
    assert.match(r.out, /Note: data\/test\.tsv is marked local-only/);
  });

  it('without a mark, the default is unchanged (OpenRouter) and nothing mentions local-only', async () => {
    const d = project();
    const r = await runCli(['init', '--yes', '--langs', 'fr'], d);
    assert.equal(r.code, 0, r.out);
    assert.equal(readConfig(d).defaultMethod, undefined);
    assert.ok(readConfig(d).model);
    assert.doesNotMatch(r.out, /local-only/);
    assert.match(r.out, /Where the text goes: llm sends every string it translates to OpenRouter/);
  });
});

describe('init wizard beside a local-only mark', () => {
  // Prompts: source, targets, registers, method choice, [temperature: LLM
  // methods only], content, locales dir, format, confirm.
  const wizard = (d, answers, flags = {}) => spawnSync(process.execPath, [DRIVER, JSON.stringify(answers), JSON.stringify(flags)],
    { cwd: d, encoding: 'utf-8', timeout: 30000 });

  it('Enter at the method step accepts local, and the step says why', () => {
    const d = project({ mark: true });
    const r = wizard(d, ['', 'fr', '', '1', '', '', '', 'yes']);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /Default: Local \/ self-hosted model — data\/test\.tsv is marked local-only/);
    assert.match(r.stdout, /Local needs a model server on this machine/);
    assert.equal(readConfig(d).defaultMethod, 'local');
  });

  it('--method llm given to the wizard is the default it offers', () => {
    const d = project({ mark: true });
    const r = wizard(d, ['', 'fr', '', '1', '', '', '', '', 'yes'], { method: 'llm' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /Default: OpenRouter .*\(--method llm\) — data\/test\.tsv is marked local-only/);
    assert.equal(readConfig(d).defaultMethod, undefined);
  });
});
