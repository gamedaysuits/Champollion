/**
 * connect.test.js — `champollion connect` puts a served model into an app:
 * installs its method/1, points the app's pairs at it, and refuses to
 * connect a model that learned from local-only sentences unless the person
 * says who among the data's holders agreed (written beside the pair).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { run } from '../lib/commands/connect.js';
import { loadPlugins, resolvePluginForPair } from '../lib/plugins.js';
import { resolvePairs } from '../lib/pairs.js';
import { output } from '../lib/output.js';
import { APIMethod } from '../lib/methods/api.js';

/** A stand-in /translate service: /health and /translate answers as given. */
async function service({ localOnly, why = 'the dictionary it looks words up in is marked local-only', health = null }) {
  const srv = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/health') {
      return res.end(JSON.stringify(health || { status: 'ok', pair: 'eng→qaa', output_gates: 'none',
        output_local_only: localOnly, output_local_only_why: why }));
    }
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const { keys } = JSON.parse(body);
      const translations = Object.fromEntries(Object.keys(keys).map((k) => [k, 'zub']));
      res.end(JSON.stringify({ translations, meta: { output_local_only: localOnly } }));
    });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return { srv, url: `http://127.0.0.1:${srv.address().port}/translate` };
}

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

/** A forge export as nmt-forge writes it: model/forge-model.json + champollion-plugin/method.json. */
function forgeExport(root, trainedOn) {
  const model = path.join(root, 'export', 'model');
  fs.mkdirSync(path.join(model, 'champollion-plugin'), { recursive: true });
  fs.writeFileSync(path.join(model, 'forge-model.json'), JSON.stringify({ name: 'nmt-forge-family', trained_on: trainedOn }));
  fs.writeFileSync(path.join(model, 'champollion-plugin', 'method.json'), JSON.stringify({
    $schema: 'https://champollion.dev/schemas/method/1.json', id: 'nmt-forge-family', name: 'nmt-forge-family',
    version: '1.0.0', kind: 'nmt-checkpoint', model_dir: '..',
    service: { endpoint: 'http://127.0.0.1:9/translate', accepts_instructions: false },
    pairs: [{ source: 'eng', target: 'qaa' }] }));
  return path.join(root, 'export');
}

function app(root, pairs = {}) {
  const dir = path.join(root, 'site');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'champollion.config.json'), JSON.stringify({
    inputLocale: 'en', languages: ['qaa'], pairs }, null, 2));
  return dir;
}

describe('champollion connect', () => {
  it('a /health that does not follow service-api/1 is said to, never read as "may leave"', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-'));
    const { srv, url } = await service({ localOnly: false, health: { status: 'ok' } });
    try {
      fs.mkdirSync(path.join(root, 'theirs'));
      const f = path.join(root, 'theirs', 'method.json');
      fs.writeFileSync(f, JSON.stringify({ $schema: 'https://champollion.dev/schemas/method/1.json', id: 'theirs',
        name: 'theirs', kind: 'service', service: { endpoint: url }, pairs: [{ source: 'eng', target: 'qaa' }] }));
      // unknown is never "may leave": the holders' agreement is asked for
      // (service-api/1: null is "not known", never guessed)
      const refused = await quiet(() => run({ _: ['connect', f], app: app(root) }, root));
      assert.equal(refused.code, 1, refused.text);
      assert.match(refused.text, /does not know whether what it writes is local-only \(its \/health does not say/);
      const r = await quiet(() => run({ _: ['connect', f], app: app(root), 'holders-agreed-by': 'Lea' }, root));
      assert.equal(r.code, 0, r.text);
      assert.match(r.text, /its \/health does not follow service-api\/1 \(\$: missing required property 'pair'/);
    } finally {
      srv.close();
    }
  });

  it('connects a model whose output may leave, keeping what the pair already said', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-'));
    const exp = forgeExport(root, { terms: {}, recorded: 'when the model was trained' });
    const site = app(root, { 'en:qaa': { method: 'llm', fallback: { method: 'llm-coached' }, register: 'plain' } });
    const r = await quiet(() => run({ _: ['connect', exp], app: site }, root));
    assert.equal(r.code, 0, r.text);
    assert.match(r.text, /connected nmt-forge-family \(nmt-checkpoint\)/);
    assert.match(r.text, /nothing answers at http:\/\/127\.0\.0\.1:9\/translate/);
    const cfg = JSON.parse(fs.readFileSync(path.join(site, 'champollion.config.json'), 'utf-8'));
    assert.deepEqual(cfg.pairs['en:qaa'], { fallback: { method: 'llm-coached' }, register: 'plain',
      methodPlugin: 'nmt-forge-family' });
    // the app now resolves the pair to the model's server
    const plugins = loadPlugins(site);
    const pair = resolvePluginForPair(plugins, resolvePairs({ inputLocale: 'en', resolvedLanguages: {}, pairs: cfg.pairs }).get('en:qaa'));
    assert.equal(pair.method, 'api');
    assert.equal(pair.endpoint, 'http://127.0.0.1:9/translate');
    assert.equal(pair.acceptsInstructions, false);
  });

  it('a local-only model needs the holders\' agreement, said by the person and written down', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-'));
    const exp = forgeExport(root, { terms: { transmission: 'local-only' }, recorded: 'when the model was trained' });
    const site = app(root);
    const refused = await quiet(() => run({ _: ['connect', exp], app: site }, root));
    assert.equal(refused.code, 1);
    assert.match(refused.text, /learned from sentences marked local-only.*published with the app.*--holders-agreed-by/s);
    assert.ok(!fs.existsSync(path.join(site, '.champollion')), 'nothing installed on a refusal');
    const ok = await quiet(() => run({ _: ['connect', exp], app: site, 'holders-agreed-by': 'Grandpa' }, root));
    assert.equal(ok.code, 0, ok.text);
    const cfg = JSON.parse(fs.readFileSync(path.join(site, 'champollion.config.json'), 'utf-8'));
    assert.equal(cfg.pairs['en:qaa'].holdersAgreed.by, 'Grandpa');
    assert.equal(cfg.pairs['en:qaa'].holdersAgreed.method, 'nmt-forge-family', 'the agreement names its method');
  });

  it('a service that says its output is local-only is held to the same rule — by connect and by sync', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-'));
    const { srv, url } = await service({ localOnly: true });
    try {
      fs.mkdirSync(path.join(root, 'family-words'));
      const f = path.join(root, 'family-words', 'method.json');
      fs.writeFileSync(f, JSON.stringify({ $schema: 'https://champollion.dev/schemas/method/1.json', id: 'family-words',
        name: 'family-words', kind: 'service', service: { endpoint: url }, pairs: [{ source: 'eng', target: 'qaa' }] }));
      const site = app(root);
      const refused = await quiet(() => run({ _: ['connect', f], app: site }, root));
      assert.equal(refused.code, 1);
      assert.match(refused.text, /its service says what it writes is local-only \(the dictionary .* marked local-only\)/);
      const ok = await quiet(() => run({ _: ['connect', f], app: site, 'holders-agreed-by': 'Grandpa' }, root));
      assert.equal(ok.code, 0, ok.text);
      const cfg = JSON.parse(fs.readFileSync(path.join(site, 'champollion.config.json'), 'utf-8'));
      const pair = resolvePairs({ inputLocale: 'en', resolvedLanguages: {}, pairs: cfg.pairs }).get('en:qaa');
      assert.deepEqual({ by: pair.holdersAgreed.by, method: pair.holdersAgreed.method },
        { by: 'Grandpa', method: 'family-words' }, 'the resolved pair carries the agreement to sync');

      // sync's api method: a local-only answer is written only where the holders agreed, for this method
      process.env.CHAMPOLLION_API_KEY = process.env.CHAMPOLLION_API_KEY || 'local';
      const translate = (pairConfig) => quiet(() => new APIMethod({ endpoint: url, methodName: 'family-words' })
        .translate(['a'], { a: 'house' }, { source: 'en', target: 'qaa', ...pairConfig }, { cwd: root }));
      const without = await translate({});
      assert.equal(without.code, null);
      assert.match(without.text, /says what it writes is local-only.*nothing from it was written.*--holders-agreed-by/s);
      const other = await translate({ holdersAgreed: { by: 'Grandpa', method: 'another-model' } });
      assert.equal(other.code, null, 'an agreement for another method does not cover this one');
      const agreed = await translate({ holdersAgreed: { by: 'Grandpa', method: 'family-words' } });
      assert.deepEqual(agreed.code, { a: 'zub' });
    } finally {
      srv.close();
    }
  });

  it('a service whose output may leave connects without asking', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-'));
    const { srv, url } = await service({ localOnly: false, why: 'not marked' });
    try {
      fs.mkdirSync(path.join(root, 'open-words'));
      const f = path.join(root, 'open-words', 'method.json');
      fs.writeFileSync(f, JSON.stringify({ $schema: 'https://champollion.dev/schemas/method/1.json', id: 'open-words',
        name: 'open-words', kind: 'service', service: { endpoint: url }, pairs: [{ source: 'eng', target: 'qaa' }] }));
      const site = app(root);
      const r = await quiet(() => run({ _: ['connect', f], app: site }, root));
      assert.equal(r.code, 0, r.text);
      const cfg = JSON.parse(fs.readFileSync(path.join(site, 'champollion.config.json'), 'utf-8'));
      assert.equal(cfg.pairs['en:qaa'].holdersAgreed, undefined);
      assert.ok(!/nothing answers|service-api\/1/.test(r.text), r.text);
      // a method.json kept at the top of the app would copy the app into itself: refused
      const top = path.join(site, 'method.json');
      fs.copyFileSync(f, top);
      const refused = await quiet(() => run({ _: ['connect', top], app: site }, root));
      assert.equal(refused.code, 1);
      assert.match(refused.text, /holds this project.*a folder of its own/s);
      assert.ok(!fs.existsSync(path.join(site, '.champollion', 'methods', 'open-words', 'site')));
    } finally {
      srv.close();
    }
  });

  it('an unrecorded model counts as local-only; a non-app folder and another source language are refused', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-'));
    const exp = forgeExport(root, undefined);
    const site = app(root);
    const r = await quiet(() => run({ _: ['connect', exp], app: site }, root));
    assert.equal(r.code, 1);
    assert.match(r.text, /not recorded/);
    const nowhere = await quiet(() => run({ _: ['connect', exp], app: root, 'holders-agreed-by': 'x' }, root));
    assert.match(nowhere.text, /not an app project yet/);
    fs.writeFileSync(path.join(site, 'champollion.config.json'), JSON.stringify({ inputLocale: 'fr', languages: ['qaa'] }));
    const fr = await quiet(() => run({ _: ['connect', exp], app: site, 'holders-agreed-by': 'x' }, root));
    assert.equal(fr.code, 1);
    assert.match(fr.text, /translates from eng, and this app's source language \(inputLocale\) is fr/);
    // en-US is English: eng and en-US name one language
    fs.writeFileSync(path.join(site, 'champollion.config.json'), JSON.stringify({ inputLocale: 'en-US', languages: ['qaa'] }));
    const us = await quiet(() => run({ _: ['connect', exp], app: site, 'holders-agreed-by': 'x' }, root));
    assert.equal(us.code, 0, us.text);
  });

  it('a method the CLI cannot run is refused with the reason', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'connect-'));
    const f = path.join(root, 'method.json');
    fs.writeFileSync(f, JSON.stringify({ $schema: 'https://champollion.dev/schemas/method/1.json', id: 'w',
      name: 'W', kind: 'lexicon', dictionary: 'w.tsv', pairs: [{ target: 'qaa' }] }));
    const r = await quiet(() => run({ _: ['connect', f], app: app(root) }, root));
    assert.equal(r.code, 1);
    assert.match(r.text, /runs in the eval engine/);
  });
});
