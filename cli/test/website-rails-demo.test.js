/**
 * website-rails-demo.test.js — the site's rails demo is RECORDED, not
 * written (website/src/data/rails-demo/recording.json, made by
 * scripts/rails_acceptance/record_demo.mjs from the scripted walk the
 * end-to-end test proves). Fast guards, no Python: it says it was recorded,
 * names nothing of the machine it was made on, holds no sentence, and every
 * champollion command in it is a command the CLI has. (Whether the rails
 * still take those steps is record_demo.mjs --check: it walks them again.)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(HERE, '..', 'website', 'src', 'data', 'rails-demo', 'recording.json');
const CLI = fs.readFileSync(path.join(HERE, '..', 'bin', 'cli.js'), 'utf-8');

describe('the site\'s rails demo recording', () => {
  const doc = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
  const text = JSON.stringify(doc);

  it('says it was recorded, from which tools', () => {
    assert.match(doc._comment, /^RECORDED, not written/);
    assert.ok(doc.recorded_with.champollion);
    assert.ok(doc.steps.length > 20);
  });

  it('names nothing of the machine and holds no sentence', () => {
    assert.doesNotMatch(text, /\/Users\/|\/home\/|\/var\/folders|\.local\b|gamedaysuits/);
    assert.doesNotMatch(text, /sees the /, 'the tools print counts, never sentences');
  });

  it('every champollion command in it is one the CLI has', () => {
    const commands = new Set();
    const dataSubs = new Set();
    for (const s of doc.steps) {
      for (const c of [s.step?.command, ...(s.ran || []).map((r) => r.command)]) {
        const m = /^champollion ([a-z-]+)(?: ([a-z-]+))?/.exec(c || '');
        if (m) commands.add(m[1]);
        if (m && m[1] === 'data') dataSubs.add(m[2]);
      }
    }
    assert.ok(commands.size >= 1, 'the recording runs champollion commands');
    for (const c of commands) {
      assert.match(CLI, new RegExp(`\\b${c}:\\s+\\(\\) => import\\(`), `champollion ${c} is not a CLI command`);
    }
    const data = fs.readFileSync(path.join(HERE, '..', 'lib', 'commands', 'data.js'), 'utf-8');
    for (const sub of dataSubs) {
      assert.match(data, new RegExp(`sub === '${sub}'`), `champollion data ${sub} is not a data subcommand`);
    }
  });

  it('the people answer, decide and judge in it: no answer is the agent\'s', () => {
    const asked = doc.steps.filter((s) => s.step?.mode === 'ask_user').map((s) => s.step.ref);
    assert.ok(asked.includes('terms') && asked.includes('predict') && asked.includes('judge'), asked.join(', '));
    assert.ok(doc.steps.some((s) => s.step?.mode === 'confirm'), 'training is the person\'s yes');
  });
});
