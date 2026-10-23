/**
 * coaching-terms.test.js — a coaching file marked local-only goes only to a
 * method on this machine (lib/coaching-terms.js; checked at sync preflight).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { coachingTermsFailure, markedCoachingFiles } from '../lib/coaching-terms.js';
import { getMethod } from '../lib/translate.js';

function project({ mark = { transmission: 'local-only' }, file = true, json = true } = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'coaching-terms-'));
  if (file) {
    fs.writeFileSync(path.join(cwd, 'notes.txt'), 'zub means hello\n');
    if (mark) fs.writeFileSync(path.join(cwd, 'notes.txt.champollion.json'), JSON.stringify(mark));
  }
  if (json) {
    const dir = path.join(cwd, '.champollion', 'coaching');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'qaa.json'), JSON.stringify({ dictionary: { hello: 'zub' } }));
    if (mark) fs.writeFileSync(path.join(dir, 'qaa.json.champollion.json'), JSON.stringify(mark));
  }
  return cwd;
}

const ctx = (cwd) => ({ cwd, getMethod });

describe('coaching files marked local-only', () => {
  it('stop a hosted LLM method, naming the files', () => {
    const cwd = project();
    const reason = coachingTermsFailure({ method: 'llm', target: 'qaa', coachingFile: 'notes.txt' }, ctx(cwd));
    assert.match(reason, /notes\.txt, \.champollion\/coaching\/qaa\.json are marked local-only/);
    assert.match(reason, /Use the local method/);
  });

  it('stop DeepL too (it receives the glossary)', () => {
    const cwd = project({ file: false });
    assert.ok(coachingTermsFailure({ method: 'deepl', target: 'qaa' }, ctx(cwd)));
  });

  it('pass for the local method on a loopback endpoint', () => {
    const cwd = project();
    const pc = { method: 'local', target: 'qaa', coachingFile: 'notes.txt', baseUrl: 'http://127.0.0.1:8378/v1' };
    assert.equal(coachingTermsFailure(pc, ctx(cwd)), null);
  });

  it('stop the local method pointed at another host', () => {
    const cwd = project();
    const pc = { method: 'llm-coached', provider: 'local', target: 'qaa', baseUrl: 'https://models.example.org/v1' };
    assert.match(coachingTermsFailure(pc, ctx(cwd)), /not on this machine/);
  });

  it('do not concern a method that sends no coaching', () => {
    const cwd = project();
    assert.equal(coachingTermsFailure({ method: 'google-translate', target: 'qaa', coachingFile: 'notes.txt' }, ctx(cwd)), null);
  });

  it('unmarked coaching files are the project\'s own and pass', () => {
    const cwd = project({ mark: null });
    assert.equal(coachingTermsFailure({ method: 'llm', target: 'qaa', coachingFile: 'notes.txt' }, ctx(cwd)), null);
  });

  it('an unreadable mark is a mark', () => {
    const cwd = project({ mark: null, json: false });
    fs.writeFileSync(path.join(cwd, 'notes.txt.champollion.json'), '{nope');
    assert.equal(markedCoachingFiles({ coachingFile: 'notes.txt' }, cwd).length, 1);
  });
});
