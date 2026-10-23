/**
 * agents-md.test.js — the packaged AGENTS.md is derived from the agents'
 * operating contract and is current.
 *
 * `champollion new` writes shared/templates/language/AGENTS.md into every
 * project. cli/scripts/build-agents-md.mjs generates it (both the monorepo
 * copy and the package's bundled copy) from cli/website/docs/agents/contract.md.
 * A contract edit without a regenerated template is drift: `--check` exits 3
 * (and scripts/champollion_sync_gate.sh blocks the push).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(__dirname, '..');
const SCRIPT = path.join(CLI, 'scripts', 'build-agents-md.mjs');
const CONTRACT = path.join(CLI, 'website', 'docs', 'agents', 'contract.md');
const BUNDLED = path.join(CLI, 'shared', 'templates', 'language', 'AGENTS.md');
const ROOT_COPY = path.join(CLI, '..', 'shared', 'templates', 'language', 'AGENTS.md');

const { build } = await import(SCRIPT);

describe('AGENTS.md (build-agents-md.mjs)', () => {
  it('both template copies are current (--check exits 0)', () => {
    const r = spawnSync(process.execPath, [SCRIPT, '--check'], { encoding: 'utf8' });
    assert.equal(r.status, 0, `AGENTS.md is stale: ${r.stderr}\nRegenerate: node cli/scripts/build-agents-md.mjs`);
    assert.equal(fs.readFileSync(BUNDLED, 'utf8'), build());
    if (fs.existsSync(path.dirname(ROOT_COPY))) assert.equal(fs.readFileSync(ROOT_COPY, 'utf8'), build());
  });

  it('is the contract: header first, no frontmatter, no Go deeper, every site link absolute', () => {
    const md = build();
    assert.match(md, /^# AGENTS\.md — the rails' operating contract\n\nGenerated from https:\/\/champollion\.dev\/docs\/agents\/contract; the full manual for agents is at https:\/\/champollion\.dev\/docs\/agents\.\n/);
    assert.doesNotMatch(md, /^---$/m, 'frontmatter stripped');
    assert.doesNotMatch(md, /^## Go deeper/m, 'Go deeper stripped');
    assert.doesNotMatch(md, /\]\(\//, 'no root-relative link left');
    assert.doesNotMatch(md, /<!--/, 'no maintainer comment');
    assert.equal((md.match(/^# /gm) || []).length, 1, 'one H1: the header');
    // every rule section of the contract page is carried over, in order
    const contract = fs.readFileSync(CONTRACT, 'utf8');
    const sections = [...contract.matchAll(/^## (.+)$/gm)].map((m) => m[1]).filter((h) => h !== 'Go deeper');
    assert.ok(sections.length >= 5, 'the contract has its rule sections');
    let at = -1;
    for (const h of sections) {
      const i = md.indexOf(`\n## ${h}\n`);
      assert.ok(i > at, `section "${h}" missing or out of order`);
      at = i;
    }
  });

  it('--check exits 3 when a copy is stale, and writes nothing', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agents-md-'));
    const scripts = path.join(tmp, 'cli', 'scripts');
    fs.mkdirSync(scripts, { recursive: true });
    fs.mkdirSync(path.join(tmp, 'cli', 'website', 'docs', 'agents'), { recursive: true });
    fs.copyFileSync(CONTRACT, path.join(tmp, 'cli', 'website', 'docs', 'agents', 'contract.md'));
    fs.copyFileSync(SCRIPT, path.join(scripts, 'build-agents-md.mjs'));
    const run = (...a) => spawnSync(process.execPath, [path.join(scripts, 'build-agents-md.mjs'), ...a],
      { encoding: 'utf8' });
    assert.equal(run('--check').status, 3, 'missing copies are stale');
    assert.equal(run().status, 0);
    assert.equal(run('--check').status, 0);
    const copy = path.join(tmp, 'shared', 'templates', 'language', 'AGENTS.md');
    fs.appendFileSync(copy, '\nhand edit\n');
    assert.equal(run('--check').status, 3);
    assert.match(fs.readFileSync(copy, 'utf8'), /hand edit/);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
