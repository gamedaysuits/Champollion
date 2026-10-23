/**
 * Tests for the Champollion MCP server corpora tool (registry browsing).
 *
 * Pure-function tests over mock registry entries — no network, no disk beyond
 * a temp dir for the `access: local` existence check. The normalizer is the
 * JS twin of the harness's corpora_browse.normalize_entry; these assertions
 * pin the shared availability vocabulary.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  AVAILABILITY_VALUES,
  normalizeRegistryEntry,
  mapDatasetRow,
  filterCorpora,
  formatCorpora,
  buildDatasetsUrl,
  MAX_LIMIT,
} from '../src/tools/corpora.js';

const ENTRIES = [
  {
    id: 'eval-in22-conv-v1-eng-tel', name: 'IN22-Conv eng→tel',
    language_pair: { source: 'eng', target: 'tel' }, size: 1503, domain: 'conversational',
    license: 'CC-BY-4.0', source: 'AI4Bharat', access: 'fetch-from-source',
    segment: 'development', contamination: 'LOW',
    source_export: { builder: 'in22-parallel', gated: true, terms_url: 'https://hf/in22', token_env: 'HF_TOKEN' },
    registry_source: 'in22',
  },
  {
    id: 'eval-eng-tel-tatoeba-dev-v1', name: 'Tatoeba eng→tel',
    language_pair: { source: 'eng', target: 'tel' }, size: 200, domain: 'mixed',
    license: 'CC-BY-2.0', source: 'Tatoeba', access: 'fetch-from-source',
    segment: 'development', contamination: 'NONE',
    source_export: { builder: 'tatoeba-challenge' }, registry_source: 'tatoeba',
  },
  {
    id: 'eval-quar-eng-tel', language_pair: { source: 'eng', target: 'tel' },
    size: 50, segment: 'development', quarantine: true,
    quarantine_reason: 'license HELD pending rights-holder reply', registry_source: 'nusatranslation',
  },
  {
    id: 'eval-nobuilder-eng-tel', language_pair: { source: 'eng', target: 'tel' },
    size: 10, segment: 'development', access: 'fetch-from-source', registry_source: 'wmt25',
  },
  {
    id: 'eval-local-eng-tel-v1', language_pair: { source: 'eng', target: 'tel' },
    size: 5, segment: 'development', access: 'local', path: 'curated/local-eng-tel.json',
    registry_source: 'tatoeba',
  },
  {
    id: 'held-only-eng-crk', language_pair: { source: 'eng', target: 'crk' },
    size: 436, segment: 'development', quarantine: true,
    quarantine_reason: 'non-commercial lane', registry_source: 'prize',
  },
  {
    id: 'other-eng-fra', language_pair: { source: 'eng', target: 'fra' },
    size: 100, segment: 'development', registry_source: 'globalvoices',
  },
];

const byId = (infos) => Object.fromEntries(infos.map((i) => [i.id, i]));

describe('normalizeRegistryEntry', () => {
  it('derives the availability vocabulary from what the harness can do', () => {
    const by = byId(ENTRIES.map((e) => normalizeRegistryEntry(e)));
    assert.equal(by['eval-in22-conv-v1-eng-tel'].availability, 'gated');
    assert.equal(by['eval-eng-tel-tatoeba-dev-v1'].availability, 'fetch');
    assert.equal(by['eval-quar-eng-tel'].availability, 'quarantined');
    assert.equal(by['eval-nobuilder-eng-tel'].availability, 'unbuildable');
    assert.equal(by['eval-local-eng-tel-v1'].availability, 'local-missing');
    for (const i of Object.values(by)) assert.ok(AVAILABILITY_VALUES.includes(i.availability), i.id);
  });

  it('marks a local entry present when the file exists next to the registry', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'corpora-'));
    fs.mkdirSync(path.join(dir, 'curated'));
    fs.writeFileSync(path.join(dir, 'curated', 'local-eng-tel.json'), '[]');
    const info = normalizeRegistryEntry(ENTRIES[4], { registryDir: dir });
    assert.equal(info.availability, 'local');
  });

  it('surfaces gated metadata from source_export and family + reason', () => {
    const gated = normalizeRegistryEntry(ENTRIES[0]);
    assert.equal(gated.gated, true);
    assert.equal(gated.terms_url, 'https://hf/in22');
    assert.equal(gated.token_env, 'HF_TOKEN');
    assert.equal(gated.family, 'in22');
    assert.equal(gated.quarantine_reason, null);
    const q = normalizeRegistryEntry(ENTRIES[2]);
    assert.equal(q.quarantine, true);
    assert.match(q.quarantine_reason, /HELD/);
    const plain = normalizeRegistryEntry(ENTRIES[1]);
    assert.equal(plain.terms_url, null);
    assert.equal(plain.token_env, null);
  });
});

describe('mapDatasetRow', () => {
  it('maps a prod datasets row to a registry-like entry the normalizer accepts', () => {
    const row = {
      id: 'eval-eng-yor-tatoeba-dev-v1', name: 'Tatoeba eng→yor', language_pair: 'eng>yor',
      entry_count: 37, domain: 'conv', license: 'CC-BY-2.0', segment: 'development',
      source: 'Tatoeba', sha256: 'abc', quarantined: false, quarantine_reason: null,
      metadata: { contamination: 'LOW', registry_source: 'tatoeba',
        source_export: { builder: 'tatoeba-challenge' } },
    };
    const info = normalizeRegistryEntry(mapDatasetRow(row));
    assert.equal(info.source, 'eng');
    assert.equal(info.target, 'yor');
    assert.equal(info.size, 37);
    assert.equal(info.family, 'tatoeba');
    assert.equal(info.availability, 'fetch');
  });

  it('a mirror row without a recipe cannot be materialized and says so', () => {
    const info = normalizeRegistryEntry(mapDatasetRow({
      id: 'x', language_pair: 'eng>tel', quarantined: false, metadata: {},
    }));
    assert.equal(info.availability, 'unbuildable');
  });
});

describe('filterCorpora', () => {
  const infos = ENTRIES.map((e) => normalizeRegistryEntry(e));

  it('filters by exact pair, hides and COUNTS quarantined', () => {
    const { items, hiddenQuarantined } = filterCorpora(infos, { source_language: 'eng', target_language: 'tel' });
    assert.deepEqual(items.map((i) => i.id).sort(), [
      'eval-eng-tel-tatoeba-dev-v1', 'eval-in22-conv-v1-eng-tel',
      'eval-local-eng-tel-v1', 'eval-nobuilder-eng-tel',
    ]);
    assert.equal(hiddenQuarantined, 1);
  });

  it('a catalogued-but-held pair is empty with a non-zero hidden count', () => {
    const { items, hiddenQuarantined } = filterCorpora(infos, { source_language: 'ENG', target_language: 'crk' });
    assert.equal(items.length, 0);
    assert.equal(hiddenQuarantined, 1);
    const inc = filterCorpora(infos, { source_language: 'eng', target_language: 'crk', include_quarantined: true });
    assert.equal(inc.items.length, 1);
    assert.equal(inc.hiddenQuarantined, 0);
  });

  it('filters by family and by one side of the pair', () => {
    assert.deepEqual(
      filterCorpora(infos, { family: 'tatoeba' }).items.map((i) => i.id).sort(),
      ['eval-eng-tel-tatoeba-dev-v1', 'eval-local-eng-tel-v1']);
    const t = filterCorpora(infos, { target_language: 'fra' });
    assert.deepEqual(t.items.map((i) => i.id), ['other-eng-fra']);
  });

  it('sorts lowest contamination first, then larger corpora', () => {
    const { items } = filterCorpora(infos, { source_language: 'eng', target_language: 'tel' });
    assert.equal(items[0].id, 'eval-eng-tel-tatoeba-dev-v1'); // NONE before LOW
  });
});

describe('formatCorpora', () => {
  const infos = ENTRIES.map((e) => normalizeRegistryEntry(e));

  it('asks for a filter instead of dumping the registry', () => {
    const text = formatCorpora({ needsFilter: true, filters: {} });
    assert.match(text, /at least one filter/);
  });

  it('renders rows with availability, gated instructions and the hidden count', () => {
    const { items, hiddenQuarantined } = filterCorpora(infos, { source_language: 'eng', target_language: 'tel' });
    const text = formatCorpora({
      items, total: items.length, hiddenQuarantined, source: 'registry.json (in-repo)',
      note: null, filters: { source_language: 'eng', target_language: 'tel' }, limit: 20,
    });
    assert.match(text, /4 listed \(1 quarantined hidden/);
    assert.match(text, /accept terms at https:\/\/hf\/in22 then set HF_TOKEN/);
    assert.match(text, /never hosted/);
    assert.ok(!text.includes('private'));
  });

  it('an all-quarantined scope explains itself', () => {
    const text = formatCorpora({
      items: [], total: 0, hiddenQuarantined: 3, source: 'registry.json (remote)',
      note: null, filters: { source_language: 'eng', target_language: 'crk' }, limit: 20,
    });
    assert.match(text, /0 listed \(3 quarantined hidden/);
    assert.match(text, /none runnable/);
  });

  it('says when it truncated and how to see more', () => {
    const text = formatCorpora({
      items: infos.slice(0, 2), total: 5, hiddenQuarantined: 0, source: 's', note: null,
      filters: { family: 'x' }, limit: 2,
    });
    assert.match(text, new RegExp(`showing 2 of 5 \\(raise limit, max ${MAX_LIMIT}`));
  });
});

describe('buildDatasetsUrl', () => {
  it('builds server-side filters for the datasets mirror', () => {
    const url = new URL(buildDatasetsUrl({ source_language: 'ENG', target_language: 'yor', family: 'Tatoeba', quarantined: false }));
    assert.equal(url.pathname, '/rest/v1/datasets');
    assert.equal(url.searchParams.get('language_pair'), 'eq.eng>yor');
    assert.equal(url.searchParams.get('metadata->>registry_source'), 'eq.tatoeba');
    assert.equal(url.searchParams.get('quarantined'), 'eq.false');
    assert.ok(url.searchParams.get('select').includes('quarantine_reason'));
  });

  it('uses prefix/suffix matches for one-sided pairs', () => {
    assert.equal(new URL(buildDatasetsUrl({ source_language: 'fra' })).searchParams.get('language_pair'), 'like.fra>%');
    assert.equal(new URL(buildDatasetsUrl({ target_language: 'yor' })).searchParams.get('language_pair'), 'like.%>yor');
  });
});
