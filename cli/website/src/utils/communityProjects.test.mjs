/**
 * Guards for the seam's communities beat (R7).
 *
 * The founder's standing rule for this beat is that the repo is our RECORD, not
 * our proof: every project we name must carry a link to its own published work.
 * These tests make that mechanical — a roster entry without a real external URL,
 * or pointing at a language that isn't in the index, fails the build rather than
 * shipping an uncheckable name on the homepage.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {COMMUNITY_PROJECTS, KINDS, PROJECT_LANGS, PROJECT_REGIONS} from './communityProjects.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CARDS = join(HERE, '..', '..', '..', 'shared', 'language-cards');

test('every project carries a real EXTERNAL citation', () => {
  assert.ok(COMMUNITY_PROJECTS.length >= 12, 'the roster has thinned — the beat is meant to show breadth');
  const seen = new Set();
  for (const p of COMMUNITY_PROJECTS) {
    assert.ok(!seen.has(p.key), `duplicate project key ${p.key}`);
    seen.add(p.key);
    assert.ok(p.name && p.what, `${p.key} needs a name and a description`);
    assert.match(p.url, /^https:\/\/[^\s]+$/, `${p.key} must link to its own site over https (got "${p.url}")`);
    // the whole point: the citation cannot be one of ours
    assert.doesNotMatch(
      p.url,
      /champollion\.dev|github\.com\/gamedaysuits/i,
      `${p.key} cites Champollion — the citation must be the project's OWN published work`,
    );
    assert.ok(KINDS.includes(p.kind), `${p.key} kind "${p.kind}" is not in the KINDS vocabulary`);
    assert.ok(PROJECT_REGIONS.includes(p.region), `${p.key} region "${p.region}" is not a known region`);
    assert.ok(p.langs.length, `${p.key} lights no languages`);
  }
});

test('the roster spans more than deployed MT (the founder brief)', () => {
  const kinds = new Set(COMMUNITY_PROJECTS.map((p) => p.kind));
  for (const required of ['morphology', 'corpus', 'shared task', 'rule-based MT']) {
    assert.ok(kinds.has(required), `the roster lost its "${required}" entries — the beat is not just finished MT`);
  }
  assert.ok(kinds.size >= 5, 'the roster should show several kinds of work, not one');
});

test('every roster language is a real language card', () => {
  for (const code of PROJECT_LANGS) {
    assert.match(code, /^[a-z]{3}$/, `${code} is not an ISO 639-3 code`);
    assert.ok(existsSync(join(CARDS, `${code}.json`)), `${code} has no language card — the beat would point at nothing`);
  }
});

test('no project entry names a private individual', () => {
  /* §3B rule 3: credit the work, not people who never agreed to appear on our
   * homepage. Institutional actors are fine ("Government of Nunavut"); personal
   * names and honorifics are not. This is a coarse net on purpose — it should
   * trip on a rewrite that reintroduces one. */
  const banned = /\b(Dr\.?|Prof\.?|Professor)\s|\bBrixey\b|\bTraum\b/;
  for (const p of COMMUNITY_PROJECTS) {
    assert.doesNotMatch(`${p.name} ${p.what}`, banned, `${p.key} names an individual — credit the project instead`);
  }
});

test('the Choctaw entry never claims machine translation', () => {
  /* Verified against the paper itself (Brixey & Traum, ChoCo, LT4All): it does
   * not mention MT anywhere — not as done work, not as future work. A later
   * edit that "tidies" this into "Choctaw MT" would be inventing a claim the
   * source does not support, so the guard names it explicitly. */
  const choco = COMMUNITY_PROJECTS.find((p) => p.key === 'choco');
  assert.ok(choco, 'the Choctaw entry has been removed');
  assert.doesNotMatch(
    choco.what,
    /\btranslat/i,
    'the ChoCo source describes a corpus, a dialogue system and a morphology generator — not translation',
  );
});

test('CLAIMS.md carries a ledger row for every named project', () => {
  const claims = readFileSync(join(HERE, '..', '..', 'CLAIMS.md'), 'utf8');
  for (const p of COMMUNITY_PROJECTS) {
    assert.ok(claims.includes(p.url), `CLAIMS.md has no row citing ${p.key} (${p.url})`);
  }
});
