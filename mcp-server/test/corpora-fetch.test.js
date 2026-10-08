/**
 * Network-boundary tests for the corpora tool's source ladder.
 *
 * fetch is injected; the in-repo rung is pointed at a temp file. Nothing here
 * touches the real registry, champollion.dev, or the database.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  selectCorpora, loadCorpora, _resetCorporaCache,
} from '../src/tools/corpora.js';

const REGISTRY = {
  registry_version: '3.0.0',
  datasets: [
    {
      id: 'eval-eng-yor-tatoeba-dev-v1', language_pair: { source: 'eng', target: 'yor' },
      size: 37, license: 'CC-BY-2.0', access: 'fetch-from-source', segment: 'development',
      contamination: 'LOW', source_export: { builder: 'tatoeba-challenge' }, registry_source: 'tatoeba',
    },
    {
      id: 'eval-eng-crk-held', language_pair: { source: 'eng', target: 'crk' },
      size: 436, segment: 'development', quarantine: true,
      quarantine_reason: 'non-commercial lane', registry_source: 'prize',
    },
  ],
};

function tmpRegistry(obj = REGISTRY) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'corpora-reg-'));
  const p = path.join(dir, 'registry.json');
  fs.writeFileSync(p, JSON.stringify(obj));
  return p;
}

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k) => headers[k.toLowerCase()] ?? null },
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

const neverFetch = async () => { throw new Error('network must not be used'); };

describe('source ladder', () => {
  beforeEach(() => _resetCorporaCache());

  it('reads the in-repo registry without any network', async () => {
    const r = await selectCorpora({
      source_language: 'eng', target_language: 'yor',
      registryPath: tmpRegistry(), corporaSource: 'registry', fetchImpl: neverFetch,
    });
    assert.equal(r.source, 'registry.json (in-repo)');
    assert.equal(r.total, 1);
    assert.equal(r.items[0].id, 'eval-eng-yor-tatoeba-dev-v1');
    assert.equal(r.items[0].availability, 'fetch');
  });

  it('a held pair from the in-repo registry reports the hidden count', async () => {
    const r = await selectCorpora({
      source_language: 'eng', target_language: 'crk',
      registryPath: tmpRegistry(), corporaSource: 'registry', fetchImpl: neverFetch,
    });
    assert.equal(r.total, 0);
    assert.equal(r.hiddenQuarantined, 1);
  });

  it('falls through to the remote registry when the in-repo file is absent', async () => {
    const calls = [];
    const fetchImpl = async (url) => { calls.push(url); return jsonResponse(REGISTRY); };
    const r = await selectCorpora({
      family: 'tatoeba', registryPath: '/nonexistent/registry.json',
      corporaSource: 'auto', fetchImpl,
    });
    assert.equal(r.source, 'registry.json (remote)');
    assert.equal(calls[0], 'https://champollion.dev/registry.json');
    assert.equal(r.total, 1);
  });

  it('rejects an HTML holding page instead of parsing garbage', async () => {
    const fetchImpl = async () => jsonResponse('<!doctype html><html>gate</html>');
    await assert.rejects(
      loadCorpora({ corporaSource: 'remote', fetchImpl }),
      /HTML page instead of JSON/,
    );
  });

  it('falls back to the datasets mirror last, labelled as lagging', async () => {
    const seen = [];
    const fetchImpl = async (url, init) => {
      seen.push(url);
      if (url.startsWith('https://champollion.dev/')) return jsonResponse('down', { status: 503 });
      assert.match(url, /\/rest\/v1\/datasets\?/);
      assert.equal(init.headers.Prefer, 'count=exact');
      return jsonResponse([{
        id: 'eval-eng-yor-tatoeba-dev-v1', language_pair: 'eng>yor', entry_count: 37,
        license: 'CC-BY-2.0', quarantined: false,
        metadata: { registry_source: 'tatoeba', source_export: { builder: 'tatoeba-challenge' } },
      }], { headers: { 'content-range': '0-0/1' } });
    };
    const r = await selectCorpora({
      source_language: 'eng', target_language: 'yor',
      registryPath: '/nonexistent/registry.json', corporaSource: 'auto', fetchImpl,
    });
    assert.equal(r.source, 'live datasets table');
    assert.match(r.note, /MIRROR/);
    assert.equal(r.items[0].availability, 'fetch');
    assert.ok(seen.some((u) => u.includes('/rest/v1/datasets')));
  });

  it('reports every rung it tried when all fail', async () => {
    const fetchImpl = async () => jsonResponse('nope', { status: 500 });
    await assert.rejects(
      selectCorpora({ family: 'x', registryPath: '/nonexistent/r.json', corporaSource: 'auto', fetchImpl }),
      /registry: .*remote: .*db: /s,
    );
  });

  it('requires a filter and never loads anything for an unfiltered ask', async () => {
    const r = await selectCorpora({ fetchImpl: neverFetch, corporaSource: 'remote' });
    assert.equal(r.needsFilter, true);
    assert.equal(r.items.length, 0);
  });

  it('caches a loaded registry generation (second call makes no fetch)', async () => {
    let n = 0;
    const fetchImpl = async () => { n += 1; return jsonResponse(REGISTRY); };
    await selectCorpora({ family: 'tatoeba', corporaSource: 'remote', fetchImpl });
    await selectCorpora({ family: 'prize', include_quarantined: true, corporaSource: 'remote', fetchImpl });
    assert.equal(n, 1);
  });
});
