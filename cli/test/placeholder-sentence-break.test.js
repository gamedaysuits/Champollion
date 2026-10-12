/**
 * A sentence break inserted beside a placeholder (release blocker for 0.4.0;
 * Round 14, synthetic hospital persona).
 *
 * "Take this medicine at {time}." came back as "… sina. {time}." — the time
 * shown as a sentence of its own — and the quality gate and verify both
 * passed it: every placeholder was present. One structural rule now lives in
 * lib/placeholders.js (placeholderSentenceBreaks): the gate refuses such a
 * translation (the retry, then the pair's fallback, takes the key) and verify
 * flags it on disk.
 *
 * Narrow on purpose. The literal rule — any sentence mark the translation
 * puts beside a placeholder where the source has none — flagged 20 of the
 * 1,371 placeholder-bearing values in this repo's own website translations
 * (ja 11, ko 9), all of them correct: SOV word order starts a sentence with
 * the placeholder ("{github}에 이슈를 열거나 …"). The rule refuses only a
 * placeholder the break leaves standing ALONE as a sentence, where the source
 * has it inside one. On the same files: 0 findings (the last test).
 *
 * End to end through the real CLI against a tiny local model
 * (test/fixtures/fake-openai-model.mjs). No network, no key.
 */
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { startFakeModel, runCli } from './fixtures/fake-openai-model.mjs';
import { placeholderSentenceBreaks } from '../lib/placeholders.js';
import { validateTranslations } from '../lib/validate.js';
import { auditTranslations } from '../lib/verify.js';

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'champollion-sentence-break-'));
after(() => fs.rmSync(ROOT, { recursive: true, force: true }));
const readJSON = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJSON = (file, obj) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
};
const NO_CI = { CI: '', GITHUB_ACTIONS: '' };

// [source, translation, a finding?]
const CASES = [
  // The Round 14 case, and the same break in other scripts.
  ['Take this medicine at {time}.', 'Iyo ta medisina. {time}.', true],
  ['Take this medicine at {time}.', 'この薬を飲んでください。{time}。', true],
  ['Take this medicine at {time}.', 'ᒥᓂᐦᑴ ᐅᒪ ᓇᓄᐦᑕᐧᐃᓐ᙮ {time}᙮', true],
  ['Take this medicine at {time}.', 'यह दवा लें। {time}।', true],
  ['Take %(dose)s at %(time)s.', 'Prenez %(dose)s. %(time)s.', true],
  ['Hello {{name}}, welcome back', 'Bonjour. {{name}}. Bon retour', true],
  ['{name} has joined the chat', '{name}. A rejoint le chat.', true],
  ['Take this at {time} with food.', 'Iyo kiya! {time}! Mîciso.', true],
  // Correct translations: word order, a moved placeholder, a clause the source already sets apart.
  ['Take this medicine at {time}.', 'Prenez ce médicament à {time}.', false],
  ['Shipped by {carrier} on {date}.', 'Expédié le {date} par {carrier}.', false],
  ['Open an issue on {github} or email {email}.', '문의 사항이 있으면 알려 주세요. {github}에 이슈를 열거나 {email}로 이메일을 보내주세요.', false],
  ['Click {button} to continue', 'Klicken Sie auf {button}. Fahren Sie fort', false],
  ['Take it at {time}', 'Prenez-le à {time}.', false],
  ['Error: {message}', 'Erreur. {message}', false],
  ['Chains traverse clean corpora; {spec}.', '체인은 깨끗한 말뭉치만 통과해요. {spec}.', false],
  ['{name}', '{name}.', false],
  // Not sentence ends: abbreviations, an ellipsis, a decimal, a file name.
  ['{count} items', 'ca. {count} Elemente', false],
  ['About {count}', 'Ca. {count}', false],
  ['Order #{id}', 'Bestellung Nr. {id}', false],
  ['Mr {name}', 'M. {name}', false],
  ['Loading {name}...', 'Chargement de {name}... patientez', false],
  ['Version {major}.{minor}', 'Version {major}.{minor}', false],
  ['Visit {host}.com today', 'Besuchen Sie heute {host}.com', false],
  // ICU plural/select: the ICU check judges the branches.
  ['{count, plural, one {Take at {time}.} other {Take at {time}.}}', '{count, plural, one {Prenez. {time}.} other {Prenez. {time}.}}', false],
];

describe('placeholderSentenceBreaks — the rule', () => {
  for (const [source, translated, expected] of CASES) {
    it(`${expected ? 'flags' : 'passes'} ${JSON.stringify(translated)}`, () => {
      const found = placeholderSentenceBreaks(source, translated);
      assert.equal(found.length > 0, expected, JSON.stringify(found));
    });
  }

  it('names the placeholder, the excerpt and why', () => {
    const [f] = placeholderSentenceBreaks('Take this medicine at {time}.', 'Iyo ta medisina. {time}.');
    assert.equal(f.token, '{time}');
    assert.equal(f.side, 'before');
    assert.equal(f.issue, 'a sentence break was inserted before {time} ("medisina. {time}.") — {time} now stands as a sentence of its own; in the source it is part of one');
  });
});

describe('the gate refuses what verify flags (one rule)', () => {
  it('value by value', () => {
    for (const [source, translated, expected] of CASES) {
      const gate = validateTranslations({ k: translated }, { k: source }, { target: 'fr', name: 'French' });
      const refused = (gate.failures || []).some((f) => f.key === 'k' && /sentence break/.test(f.reason));
      const audit = auditTranslations({ k: source }, { k: translated }, 'fr', {});
      const flagged = audit.placeholders.some((p) => p.key === 'k' && p.syntax === 'sentence-break');
      assert.equal(refused, expected, `gate on ${JSON.stringify(translated)}`);
      assert.equal(flagged, expected, `verify on ${JSON.stringify(translated)}`);
      if (expected) {
        assert.ok(audit.errors.some((e) => /sentence break\(s\) inserted beside a placeholder: k \(/.test(e) && /fix: `champollion sync --redo keys:k`/.test(e)), audit.errors.join('\n'));
        assert.ok(audit.damaged.some((d) => d.key === 'k'), 'the cache entry that produced it is evicted');
      }
    }
  });

  it('a no-translate key is never flagged (it never reaches the gate)', () => {
    const noTranslate = { matches: (key) => key === 'k' };
    const audit = auditTranslations({ k: 'Take this medicine at {time}.' }, { k: 'Iyo ta medisina. {time}.' }, 'qaa', {}, noTranslate);
    assert.equal(audit.placeholders.length, 0);
  });
});

describe('sync and verify, end to end', () => {
  const SRC = { dose: 'Take this medicine at {time}.', thanks: 'Thank you for waiting' };
  /** "bad" strands the placeholder; "good" keeps it in the sentence. */
  const answer = (key, source, { model }) => {
    if (key === 'thanks') return 'Merci de votre patience';
    return model === 'bad' ? 'Prenez ce médicament. {time}.' : 'Prenez ce médicament à {time}.';
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

  it('the gate refuses the break, says why, and the fallback writes the key; verify then passes', async () => {
    const model = await startFakeModel(answer);
    try {
      const d = project({ fallback: true });
      const r = await runCli(['sync'], d, { LOCAL_API_BASE: model.url, ...NO_CI });
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, /sentence break beside a placeholder: a sentence break was inserted before \{time\}/);
      assert.equal(readJSON(path.join(d, 'locales/fr.json')).dose, 'Prenez ce médicament à {time}.');
      assert.ok(model.calls.some((c) => c.model === 'good' && c.keys.includes('dose')), 'the fallback was asked');
      assert.equal((await runCli(['verify'], d, NO_CI)).code, 0);
    } finally {
      await model.close();
    }
  });

  it('a value already on disk with the break: verify flags it and names the redo', async () => {
    const d = project({ fallback: false });
    writeJSON(path.join(d, 'locales/fr.json'), { dose: 'Prenez ce médicament. {time}.', thanks: 'Merci de votre patience' });
    const r = await runCli(['verify'], d, NO_CI);
    assert.notEqual(r.code, 0, r.out);
    assert.match(r.out, /1 sentence break\(s\) inserted beside a placeholder: dose \(a sentence break was inserted before \{time\}/);
    assert.match(r.out, /--redo keys:dose/);
  });
});

describe('false positives on this repo\'s own translations', () => {
  it('the website\'s 13-locale UI translations raise no finding', () => {
    const i18n = new URL('../website/i18n/', import.meta.url);
    const flat = (obj, pre = '', out = {}) => {
      if (typeof obj === 'string') { out[pre] = obj; return out; }
      if (obj && typeof obj === 'object') for (const [k, v] of Object.entries(obj)) flat(v, pre ? `${pre}.${k}` : k, out);
      return out;
    };
    let values = 0;
    const found = [];
    for (const loc of fs.readdirSync(i18n)) {
      if (loc === 'en') continue;
      for (const rel of ['code.json', 'docusaurus-theme-classic/navbar.json', 'docusaurus-theme-classic/footer.json', 'glossary.json']) {
        const s = new URL(`en/${rel}`, i18n);
        const t = new URL(`${loc}/${rel}`, i18n);
        if (!fs.existsSync(s) || !fs.existsSync(t)) continue;
        const src = flat(JSON.parse(fs.readFileSync(s, 'utf8')));
        const tgt = flat(JSON.parse(fs.readFileSync(t, 'utf8')));
        for (const [k, sv] of Object.entries(src)) {
          if (typeof tgt[k] !== 'string' || !/[{%]/.test(sv)) continue;
          values++;
          for (const f of placeholderSentenceBreaks(sv, tgt[k])) found.push(`${loc}/${rel} ${k}: ${f.issue}`);
        }
      }
    }
    assert.ok(values > 1000, `measured ${values} placeholder-bearing values`);
    assert.deepEqual(found, []);
  });
});
