import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadJoin, languageLabel, projectsUrl, asksUrl} from './joinProjects.mjs';

const BASE = 'https://example.supabase.co';
const ok = (rows) => ({ok: true, status: 200, json: async () => rows});
const fail = (status) => ({ok: false, status, json: async () => ({message: 'relation "public.projects" does not exist'})});
const fakeFetch = (routes) => async (url) => {
  for (const [needle, res] of routes) if (url.includes(needle)) return typeof res === 'function' ? res() : res;
  throw new Error(`unexpected ${url}`);
};

test('the reads are the contract: listed projects, open asks, nothing private', () => {
  assert.match(projectsUrl(BASE), /\/rest\/v1\/projects\?status=eq\.listed&select=.*owner_display.*&order=listed_at\.desc$/);
  assert.match(asksUrl(BASE), /\/rest\/v1\/project_asks\?status=eq\.open&select=/);
  assert.doesNotMatch(projectsUrl(BASE) + asksUrl(BASE), /offer|email/);
});

test('a failed read (the table not there yet) is the closed state, never a mock list', async () => {
  const r = await loadJoin({base: BASE, anonKey: 'k', fetchImpl: fakeFetch([['projects?', fail(404)]])});
  assert.deepEqual(r, {state: 'closed', projects: [], asksUnavailable: false});
  const thrown = await loadJoin({base: BASE, anonKey: 'k', fetchImpl: async () => { throw new Error('offline'); }});
  assert.equal(thrown.state, 'closed');
  const notList = await loadJoin({base: BASE, anonKey: 'k', fetchImpl: fakeFetch([['projects?', ok({rows: []})]])});
  assert.equal(notList.state, 'closed');
});

test('zero listed projects is the empty state', async () => {
  const r = await loadJoin({base: BASE, anonKey: 'k', fetchImpl: fakeFetch([['projects?', ok([])]])});
  assert.equal(r.state, 'empty');
});

test('listed projects carry their open asks; unknown ask kinds are left out', async () => {
  const r = await loadJoin({base: BASE, anonKey: 'k', fetchImpl: fakeFetch([
    ['projects?', ok([{id: 'p1', slug: 'a'}, {id: 'p2', slug: 'b'}])],
    ['project_asks?', ok([
      {id: 'x1', project_id: 'p1', kind: 'sentences', what: 'clinic phrases'},
      {id: 'x2', project_id: 'p1', kind: 'something-new', what: '?'},
      {id: 'x3', project_id: 'p2', kind: 'method', what: 'a gate'},
    ])],
  ])});
  assert.equal(r.state, 'listed');
  assert.deepEqual(r.projects.map((p) => p.asks.map((a) => a.id)), [['x1'], ['x3']]);
  assert.equal(r.asksUnavailable, false);
});

test('a failed asks read still lists the projects, and says so', async () => {
  const r = await loadJoin({base: BASE, anonKey: 'k', fetchImpl: fakeFetch([
    ['projects?', ok([{id: 'p1', slug: 'a'}])],
    ['project_asks?', fail(500)],
  ])});
  assert.equal(r.state, 'listed');
  assert.equal(r.asksUnavailable, true);
  assert.deepEqual(r.projects[0].asks, []);
});

test('a language shows the name its people gave it first', () => {
  assert.equal(languageLabel('qaa', 'Our language', new Map([['qaa', 'Reserved']])), 'Our language');
  assert.equal(languageLabel('fra', null, new Map([['fra', 'French']])), 'French');
  assert.equal(languageLabel('fra', null, {fra: 'French'}), 'French');
  assert.equal(languageLabel('xyz', null, null), 'xyz');
  assert.equal(languageLabel(null, null, null), '?');
});
