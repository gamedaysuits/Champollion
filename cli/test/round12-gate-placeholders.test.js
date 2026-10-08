/**
 * Round 12 (i18next persona): sync and verify judge placeholders by one rule.
 *
 * The sync quality gate (lib/validate.js) checked ICU arguments, printf
 * conversions and markup, but not i18next `{{…}}` interpolation. A model that
 * wrote `{{nom}}` for `{{name}}` — or `{name}`, which i18next prints as is —
 * passed the gate, was written and cached, and the post-sync verify (which
 * now names i18next findings) flagged it: the run exited with damage it had
 * just written. The gate now refuses what verify flags, through the same
 * extraction (lib/placeholders.js), so the pair's fallback gets the text.
 *
 * End to end through the real CLI against a tiny local model
 * (test/fixtures/fake-openai-model.mjs): model "bad" renames the
 * interpolation, model "good" keeps it. No network, no key.
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { startFakeModel, runCli } from './fixtures/fake-openai-model.mjs';
import { validateTranslations } from '../lib/validate.js';
import { placeholderChanges } from '../lib/placeholders.js';
import { auditLocalePair } from '../lib/integrity.js';

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-round12-gate-'));
after(() => fs.rmSync(ROOT, { recursive: true, force: true }));
const readJSON = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJSON = (file, obj) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
};
const NO_CI = { CI: '', GITHUB_ACTIONS: '' };

const SRC = { greeting: 'Hello {{name}}, welcome back', save: 'Save your changes now' };
/** "bad" renames the interpolation (as a model translating the variable does); "good" keeps it. */
const answer = (key, source, { model }) => {
  const fr = source.replace('Hello', 'Bonjour').replace(', welcome back', ', bon retour').replace('Save your changes now', 'Enregistrez vos modifications');
  return model === 'bad' ? fr.replace('{{name}}', '{{nom}}') : fr;
};

function project({ fallback }) {
  const d = fs.mkdtempSync(path.join(ROOT, 'proj-'));
  writeJSON(path.join(d, 'locales/en.json'), SRC);
  writeJSON(path.join(d, 'champollion.config.json'), {
    inputLocale: 'en', localesDir: 'locales', languages: ['fr'], defaultMethod: 'local', model: 'bad',
    ...(fallback ? { pairs: { 'en:fr': { fallback: { method: 'local', model: 'good' } } } } : {}),
  });
  return d;
}

describe('Round 12 — 12: the sync gate refuses the placeholder changes verify flags', () => {
  it('a model that renames {{name}}: refused, the fallback writes it, and verify after the sync passes', async () => {
    const model = await startFakeModel(answer);
    try {
      const d = project({ fallback: true });
      const r = await runCli(['sync'], d, { LOCAL_API_BASE: model.url, ...NO_CI });
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /i18next \{\{…\}\} placeholder \{\{name\}\} was changed to \{\{nom\}\}/, 'the gate says why');
      const fr = readJSON(path.join(d, 'locales/fr.json'));
      assert.equal(fr.greeting, 'Bonjour {{name}}, bon retour', 'the fallback\'s answer, interpolation intact');
      assert.ok(model.calls.some((c) => c.model === 'good' && c.keys.includes('greeting')), 'the fallback was asked');
      assert.doesNotMatch(r.out, /placeholder mismatch/, 'post-sync verify finds nothing');
      assert.equal((await runCli(['verify'], d, NO_CI)).code, 0);
    } finally {
      await model.close();
    }
  });

  it('without a fallback the damaged text is never written (nor cached), so verify has nothing of it to flag', async () => {
    const model = await startFakeModel(answer);
    try {
      const d = project({ fallback: false });
      const r = await runCli(['sync'], d, { LOCAL_API_BASE: model.url, ...NO_CI });
      assert.notEqual(r.code, 0, 'the key was not translated: the run is not a success');
      const fr = readJSON(path.join(d, 'locales/fr.json'));
      assert.doesNotMatch(String(fr.greeting ?? ''), /\{\{nom\}\}/);
      assert.equal(fr.save, 'Enregistrez vos modifications');
      assert.doesNotMatch(r.out, /i18next \{\{…\}\} placeholder mismatch/, 'verify did not find damage sync wrote');
      const tm = fs.readFileSync(path.join(d, '.champollion/tm.json'), 'utf8');
      assert.doesNotMatch(tm, /\{\{nom\}\}/, 'never cached');
    } finally {
      await model.close();
    }
  });

  it('gate and verify agree, value by value (one rule: lib/placeholders.js)', () => {
    const cases = [
      ['Hello {{name}}', 'Bonjour {{nom}}', true],
      ['Hello {{name}}', 'Bonjour {name}', true],
      ['Hello {{name}}', 'Bonjour', true],
      ['Hello {{name}}', 'Bonjour {{ name }}', false],
      ['Hello {{- html}}', 'Bonjour {{html}}', true],
      ['{{count}} items', '{{count}} articles', false],
      ['{count, plural, =0{No items} one{1 item} other{{count}}}', '{count, plural, =0{Aucun} one{1 article} other{{count} articles}}', false],
      ['{{ .Count }} items', '{{ .Count }} articles', false],
      ['Hi {name}', 'Salut {name}', false],
    ];
    for (const [source, translated, damaged] of cases) {
      const gate = validateTranslations({ k: translated }, { k: source }, { target: 'fr', name: 'French' });
      const refused = (gate.failures || []).some((f) => f.key === 'k');
      const audit = auditLocalePair({ k: source }, { k: translated }, 'fr');
      const flagged = placeholderChanges(source, translated).length > 0 || audit.icuIssues.length > 0;
      assert.equal(refused, damaged, `gate on ${JSON.stringify([source, translated])}`);
      assert.equal(flagged, damaged, `verify on ${JSON.stringify([source, translated])}`);
    }
  });
});
